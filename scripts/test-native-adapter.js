'use strict'

const { spawnSync } = require('node:child_process')
const path = require('node:path')
const { readConfig, identity, prepareSource } = require('./install-overlay-addon')
const config = readConfig()
prepareSource(config)
const descriptor = identity(config)
// Exercise the maintained Rust overlay itself, including mutation/snapshot admission,
// staged restore, signer lifetime and BIP-322 tests, rather than only its C JSON boundary.
const environment = { ...process.env, RUSTUP_TOOLCHAIN: config.rustToolchain,
  RLN_ADAPTER_SHA256: config.patchSha256, RLN_WRAPPER_SHA256: descriptor.wrapperSha256,
  RLN_LOCK_SHA256: descriptor.lockSha256 }
for (const args of [
  ['test', '--locked', '-p', 'rln-c-ffi', '--lib', '--target', descriptor.target],
  ['test', '--locked', '--manifest-path', path.resolve(__dirname, '../.native-source/Cargo.toml'),
    '--lib', '--features', 'uniffi,vls,vss', '--target', descriptor.target, '--', '--test-threads=1']
]) {
  const result = spawnSync('cargo', args, { stdio: 'inherit', env: environment })
  if (result.error) throw result.error
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break }
}
