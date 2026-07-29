'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const packageRoot = path.resolve(__dirname, '..')
const sourceRoot = path.join(packageRoot, '.native-source')
const manifestPath = path.join(packageRoot, '.utexo-node-overlay.json')
const manifestSchema = 1

function fail (message) {
  throw new Error(`[rgb-lightning-node-nodejs] ${message}`)
}

function sha256 (filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function run (command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    env: options.env ?? process.env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.capture ? 'pipe' : 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const detail = options.capture ? `: ${(result.stderr || result.stdout).trim()}` : ''
    fail(`${command} exited with status ${result.status}${detail}`)
  }
  return result.stdout
}

function probe (command, args, cwd = packageRoot) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: 'pipe'
  })
}

function readConfig () {
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
  const config = packageJson.utexoNativeOverlay
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    fail('utexoNativeOverlay is required')
  }
  for (const field of [
    'repository',
    'ref',
    'commit',
    'patch',
    'patchSha256',
    'rustToolchain'
  ]) {
    if (!Object.prototype.hasOwnProperty.call(config, field)) {
      fail(`utexoNativeOverlay.${field} is required`)
    }
  }
  if (config.repository !== 'https://github.com/UTEXO-Protocol/rgb-lightning-node.git') {
    fail('utexoNativeOverlay.repository is not approved')
  }
  if (!/^[0-9a-f]{40}$/.test(config.commit)) {
    fail('utexoNativeOverlay.commit must be a full Git commit')
  }
  if (!/^[0-9a-f]{64}$/.test(config.patchSha256)) {
    fail('utexoNativeOverlay.patchSha256 must be a SHA-256 digest')
  }
  const patchPath = path.resolve(packageRoot, config.patch)
  if (
    !patchPath.startsWith(`${path.join(packageRoot, 'patches')}${path.sep}`) ||
    !fs.existsSync(patchPath) ||
    sha256(patchPath) !== config.patchSha256
  ) {
    fail('native overlay patch is missing or does not match package metadata')
  }
  return Object.freeze({ ...config, patchPath })
}

function platformSuffix () {
  const key = `${process.platform}-${process.arch}`
  if (key === 'darwin-arm64' || key === 'darwin-x64') return key
  if (key === 'linux-arm64') return 'linux-arm64-gnu'
  if (key === 'linux-x64') {
    return fs.existsSync('/etc/alpine-release') ? 'linux-x64-musl' : 'linux-x64-gnu'
  }
  fail(`unsupported build host ${key}`)
}

function addonPath () {
  return path.join(packageRoot, `index-${platformSuffix()}.node`)
}

function identity (config) {
  return {
    schemaVersion: manifestSchema,
    repository: config.repository,
    ref: config.ref,
    commit: config.commit,
    patchSha256: config.patchSha256,
    rustToolchain: config.rustToolchain,
    platform: process.platform,
    arch: process.arch
  }
}

function manifestMatches (config, manifest, addonSha256) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return false
  }
  for (const [key, expected] of Object.entries(identity(config))) {
    if (manifest[key] !== expected) return false
  }
  return manifest.addonSha256 === addonSha256
}

function existingAddonMatches (config) {
  const addon = addonPath()
  if (!fs.existsSync(addon) || fs.statSync(addon).size === 0 || !fs.existsSync(manifestPath)) {
    return false
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    return manifestMatches(config, manifest, sha256(addon))
  } catch {
    return false
  }
}

function validateAndApplySource (config) {
  const head = run('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { capture: true }).trim()
  if (head !== config.commit) {
    fail(`native source must resolve to ${config.commit}`)
  }
  const forward = probe('git', ['-C', sourceRoot, 'apply', '--check', config.patchPath])
  if (forward.status === 0) {
    run('git', ['-C', sourceRoot, 'apply', config.patchPath])
    return
  }
  const reverse = probe(
    'git',
    ['-C', sourceRoot, 'apply', '--reverse', '--check', config.patchPath]
  )
  if (reverse.status !== 0) {
    fail('native source is neither pristine nor an exact application of the configured overlay')
  }
}

function prepareSource (config) {
  fs.rmSync(sourceRoot, { force: true, recursive: true })
  const override = process.env.RLN_NODE_SOURCE_DIR
  if (override) {
    fs.symlinkSync(path.resolve(override), sourceRoot, 'dir')
  } else {
    run('git', [
      'clone',
      '--recurse-submodules',
      '--shallow-submodules',
      '--depth', '1',
      '--branch', config.ref,
      config.repository,
      sourceRoot
    ])
  }
  validateAndApplySource(config)
}

function buildAddon (config) {
  run('rustup', ['toolchain', 'install', config.rustToolchain, '--profile', 'minimal'])
  run('cargo', ['build', '--release', '--locked'], {
    env: {
      ...process.env,
      RUSTUP_TOOLCHAIN: config.rustToolchain
    }
  })
  const extension = process.platform === 'darwin' ? 'dylib' : 'so'
  const built = path.join(packageRoot, 'target', 'release', `librln_node.${extension}`)
  if (!fs.existsSync(built) || fs.statSync(built).size === 0) {
    fail(`cargo did not produce ${built}`)
  }
  const addon = addonPath()
  fs.copyFileSync(built, addon)
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({
      ...identity(config),
      addonSha256: sha256(addon)
    }, null, 2)}\n`,
    { mode: 0o600 }
  )
}

function main () {
  const config = readConfig()
  if (existingAddonMatches(config)) {
    process.stdout.write('[rgb-lightning-node-nodejs] Native overlay addon is current.\n')
    return
  }
  prepareSource(config)
  buildAddon(config)
  if (!existingAddonMatches(config)) {
    fail('built addon failed overlay provenance verification')
  }
  process.stdout.write('[rgb-lightning-node-nodejs] Built and verified native overlay addon.\n')
}

if (require.main === module) main()

module.exports = {
  addonPath,
  existingAddonMatches,
  identity,
  manifestMatches,
  readConfig
}
