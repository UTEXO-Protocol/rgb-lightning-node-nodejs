'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const contract = require('./release-contract')

function fixture (context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utexo-compiled-runtime-'))
  context.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const owner = require('../package.json')
  const patch = fs.readFileSync(path.join(__dirname, '..', owner.utexoNativeOverlay.patch), 'utf8')
  const section = patch.split('diff --git a/bindings/c-ffi/src/lib.rs b/bindings/c-ffi/src/lib.rs\n')[1].split('\ndiff --git ')[0]
  const source = section.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1)).join('\n')
  const file = path.join(root, 'bindings/c-ffi/src/lib.rs')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, source)
  return { root, file, source, patch }
}

test('reviewed Rust runtime declarations match the complete release graph', context => {
  const { root } = fixture(context)
  contract.verifyCompiledRuntimeIdentity(root)
})

test('stale compiled graph literals are refused independently of metadata', context => {
  const { root, file, source } = fixture(context)
  for (const [field, value, stale] of [
    ['abi_version', 1, 0],
    ['rln_version', contract.RELEASE.rlnVersion, '0.16.0'],
    ['rln_commit', contract.RELEASE.commit, 'c29d1b2dfe43ba95c25ced8984f09e42c789d6af'],
    ['lightning_commit', contract.RELEASE.lightningCommit, '510189d5700a6d1406229ce7523e181c3838715e'],
    ['rgb_lib_commit', contract.RELEASE.rgbLibCommit, '962730a211f0f7569d7ad8ae777052f433d87655']
  ]) {
    const before = `"${field}": ${JSON.stringify(value)}`
    assert.ok(source.includes(before), field)
    fs.writeFileSync(file, source.replace(before, `"${field}": ${JSON.stringify(stale)}`))
    assert.throws(() => contract.verifyCompiledRuntimeIdentity(root), new RegExp('identity mismatch: ' + field))
  }
})

test('missing or ambiguous native runtime declarations fail closed', context => {
  const { root, file, source } = fixture(context)
  for (const candidate of [
    source.replace('rln_binding_build_info()', 'another_build_info()'),
    source + '\n' + source,
    source.replace('"abi_version": 1,', '"abi_version": 1, "abi_version": 1,'),
    source.replace('"abi_version": 1,', '"abi_version": 1, "abi_version": another_version(),'),
    source.replace('"abi_version": 1,', '"abi_version": 1 + 1,')
  ]) {
    fs.writeFileSync(file, candidate)
    assert.throws(() => contract.verifyCompiledRuntimeIdentity(root), /compiled C-FFI runtime identity|C-FFI runtime identity mismatch/)
  }
})

test('normal preparation and final admission reject a checksum-valid stale native declaration', context => {
  const { root, file, source, patch } = fixture(context)
  const before = `"rln_commit": "${contract.RELEASE.commit}"`
  const stale = '"rln_commit": "c29d1b2dfe43ba95c25ced8984f09e42c789d6af"'
  const stalePatch = patch.replace(before, stale)
  assert.notEqual(stalePatch, patch)
  fs.writeFileSync(file, source.replace(before, stale))
  const patchPath = path.join(root, 'reviewed-stale.patch')
  fs.writeFileSync(patchPath, stalePatch)
  const config = { ...contract.RELEASE, patchPath, patchSha256: contract.sha256(patchPath) }
  // Git identity and frozen-diff checks succeed; the actual Rust declaration is
  // still stale. This isolates the additional normal source-admission boundary.
  const sandbox = {
    module: { exports: {} },
    require: name => name === 'node:child_process'
      ? { execFileSync: (command, args) => {
          assert.equal(command, 'git')
          if (args.includes('rev-parse')) return args[1] === path.join(root, 'rust-lightning') ? contract.RELEASE.lightningCommit : contract.RELEASE.commit
          if (args.includes('diff')) return stalePatch
          if (args.includes('ls-files') || args.includes('status')) return ''
          throw new Error('Unexpected Git operation: ' + args.join(' '))
        } }
      : require(name)
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'release-contract.js'), 'utf8'), sandbox)
  for (const check of ['prepareSource', 'verifyPreparedSource']) {
    assert.throws(() => sandbox.module.exports[check](root, config), /Compiled C-FFI runtime identity mismatch: rln_commit/)
  }
})
