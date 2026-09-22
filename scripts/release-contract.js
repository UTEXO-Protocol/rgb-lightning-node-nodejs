'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const RELEASE = Object.freeze({
  ref: 'v0.13.0-beta.3',
  commit: 'af03c7f1a65135a429f05a5820600338215954dc',
  lightningCommit: '38d73bc918f27956590585d2bb83c86f059679b0',
  rustToolchain: '1.94.0',
  cffiLockSha256: '790ebf1a68fcc60f67f2e703dfc1abc2e3e65a52494b4156ec4de7c4b2d42b4b'
})
const ALLOWED_FILES = Object.freeze([
  'bindings/c-ffi/Cargo.toml', 'bindings/c-ffi/Cargo.lock',
  'bindings/c-ffi/build.rs', 'bindings/c-ffi/rln.h', 'bindings/c-ffi/rln.hpp',
  'bindings/c-ffi/src/api.rs', 'bindings/c-ffi/src/json_types.rs', 'bindings/c-ffi/src/lib.rs'
])
const GIT_SOURCES = Object.freeze({
  musig2: 'git+https://github.com/arik-so/rust-musig2?rev=6f95a05718cbb44d8fe3fa6021aea8117aa38d50#6f95a05718cbb44d8fe3fa6021aea8117aa38d50',
  'rgb-lib': 'git+https://github.com/UTEXO-Protocol/rgb-lib.git?tag=v0.3.0-beta.34#62a8c3a045901147b3b06aed9f1e61f345695dce',
  'rgb-lib-migration': 'git+https://github.com/UTEXO-Protocol/rgb-lib.git?tag=v0.3.0-beta.34#62a8c3a045901147b3b06aed9f1e61f345695dce',
  'signer-external': 'git+https://github.com/UTEXO-Protocol/rln-external-signer.git?branch=main#0fb005ec4b927ddbe13e1646d247b5bb11e8ffed',
  'vls-core': 'git+https://github.com/UTEXO-Protocol/vls-core.git?branch=feat/rgb-compatibility#45c72edfd58620849eb486925439a76526b415ae',
  'vls-protocol-signer': 'git+https://github.com/UTEXO-Protocol/vls-protocol-signer.git?branch=feat/rgb-compatibility#dddd336fcdf84c4febdd7af8363bda8d1721d893',
  'vss-client-ng': 'git+https://github.com/lightningdevkit/vss-client?rev=ad63805047561dcf3117cd992ad6d8bc3881adef#ad63805047561dcf3117cd992ad6d8bc3881adef'
})

function sha256 (file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function validateAdapter (config) {
  for (const [key, value] of Object.entries(RELEASE)) {
    if (config[key] !== value) throw new Error(`Native release identity mismatch: ${key}`)
  }
  const patch = fs.readFileSync(config.patchPath, 'utf8')
  const changes = [...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)]
  if (changes.length === 0 || changes.some(([, a, b]) => a !== b || !ALLOWED_FILES.includes(a))) {
    throw new Error('Native adapter changes files outside the binding/build allowlist')
  }
  if (sha256(config.patchPath) !== config.patchSha256) throw new Error('Native adapter checksum mismatch')
}

function git (root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
}

function prepareSource (root, config) {
  validateAdapter(config)
  if (git(root, ['rev-parse', 'HEAD']).trim() !== RELEASE.commit) throw new Error('Unexpected RLN revision')
  if (git(root, ['ls-files', '--others', '--exclude-standard']).trim()) throw new Error('Untracked files in native source')
  const lightning = path.join(root, 'rust-lightning')
  if (git(lightning, ['rev-parse', 'HEAD']).trim() !== RELEASE.lightningCommit ||
      git(lightning, ['status', '--porcelain', '--untracked-files=no']).trim()) {
    throw new Error('Unexpected or modified rust-lightning submodule')
  }
  const patch = fs.readFileSync(config.patchPath, 'utf8')
  const diff = git(root, ['diff', '--binary', 'HEAD'])
  if (!diff) git(root, ['apply', '--index', config.patchPath])
  else if (diff !== patch) throw new Error('Native source has changes beyond the exact approved adapter')
  if (git(root, ['diff', '--binary', 'HEAD']) !== patch) throw new Error('Applied native adapter is not exact')
  if (sha256(path.join(root, 'bindings/c-ffi/Cargo.lock')) !== RELEASE.cffiLockSha256) {
    throw new Error('Unexpected C-FFI lock graph')
  }
}

function verifyGraph (metadata, sourceRoot) {
  const packages = metadata.packages.filter(p => p.source?.startsWith('git+'))
  if (packages.length !== Object.keys(GIT_SOURCES).length ||
      packages.some(p => p.source !== GIT_SOURCES[p.name])) throw new Error('Unapproved native Git dependency graph')
  const sync = metadata.packages.filter(p => p.name === 'lightning-transaction-sync')
  if (sync.length !== 1 || sync[0].source !== null ||
      fs.realpathSync(sync[0].manifest_path) !== fs.realpathSync(path.join(sourceRoot, 'rust-lightning/lightning-transaction-sync/Cargo.toml'))) {
    throw new Error('Transaction sync must use the released submodule implementation')
  }
}

function verifyCargoGraph (manifest, sourceRoot) {
  const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--format-version', '1', '--manifest-path', manifest], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, RUSTUP_TOOLCHAIN: RELEASE.rustToolchain }
  }))
  verifyGraph(metadata, sourceRoot)
}

function wrapperSha256 (root, files) {
  const hash = crypto.createHash('sha256')
  for (const file of [...files].sort()) {
    hash.update(`${file}\0`).update(fs.readFileSync(path.join(root, file))).update('\0')
  }
  return hash.digest('hex')
}

module.exports = { RELEASE, ALLOWED_FILES, GIT_SOURCES, sha256, validateAdapter, prepareSource, wrapperSha256, verifyGraph, verifyCargoGraph }
