'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const patch = fs.readFileSync(path.join(root, require('../package.json').utexoNativeOverlay.patch), 'utf8')
const marker = 'diff --git a/src/uniffi_api/bip322.rs b/src/uniffi_api/bip322.rs\n'
const start = patch.indexOf(marker)
if (start < 0) throw new Error('BIP-322 implementation is absent from the reviewed native adapter')
const section = patch.slice(start).split('\ndiff --git ')[0]
const source = section.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1)).join('\n')
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'utexo-bip322-crypto-'))
try {
  fs.mkdirSync(path.join(directory, 'src'))
  fs.writeFileSync(path.join(directory, 'src/lib.rs'), source)
  for (const name of ['Cargo.toml', 'Cargo.lock']) fs.copyFileSync(path.join(__dirname, 'fixtures/bip322/crypto-harness', name), path.join(directory, name))
  execFileSync('cargo', ['test', '--locked', '--manifest-path', path.join(directory, 'Cargo.toml')], {
    stdio: 'inherit', env: { ...process.env, RUSTUP_TOOLCHAIN: '1.94.0',
      CARGO_TARGET_DIR: path.join(process.env.CARGO_TARGET_DIR || path.join(root, 'target'), 'bip322-vector-tests') }
  })
} finally { fs.rmSync(directory, { force: true, recursive: true }) }
