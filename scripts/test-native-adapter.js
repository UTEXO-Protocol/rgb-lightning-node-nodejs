'use strict'

const { spawnSync } = require('node:child_process')
const { readConfig, identity, prepareSource } = require('./install-overlay-addon')
const config = readConfig()
prepareSource(config)
const descriptor = identity(config)
const result = spawnSync('cargo', ['test', '--locked', '-p', 'rln-c-ffi', '--lib', '--target', descriptor.target], {
  stdio: 'inherit',
  env: { ...process.env, RUSTUP_TOOLCHAIN: config.rustToolchain,
    RLN_ADAPTER_SHA256: config.patchSha256, RLN_WRAPPER_SHA256: descriptor.wrapperSha256,
    RLN_LOCK_SHA256: descriptor.lockSha256 }
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
