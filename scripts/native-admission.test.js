'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const installer = require('./install-overlay-addon')
const { sha256 } = require('./release-contract')
const { fixture } = require('./macho-linkedit-fixture')

function setup (t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rln-admission-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const artifact = path.join(root, 'index-darwin-arm64.node')
  fs.writeFileSync(artifact, fixture())
  const config = installer.readConfig()
  const expected = { ...installer.identity(config), target: installer.TARGETS['darwin-arm64'], profile: 'release' }
  const sidecar = path.join(root, 'index-darwin-arm64.provenance.json')
  fs.writeFileSync(sidecar, JSON.stringify({ ...expected, addonSha256: sha256(artifact) }))
  let loaded = 0
  let initialized = 0
  const info = { abi_version: 1, rln_version: config.rlnVersion, rln_commit: expected.commit, lightning_commit: expected.lightningCommit,
    adapter_sha256: expected.patchSha256, wrapper_sha256: expected.wrapperSha256,
    lock_sha256: expected.lockSha256, target: expected.target, capabilities: [] }
  const localRequire = createRequire(path.resolve(__dirname, '../index.js'))
  const load = () => vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../index.js'), 'utf8'), {
    __dirname: root, exports: {}, Buffer, process,
    require: id => {
      if (id === 'os') return { platform: () => 'darwin', arch: () => 'arm64' }
      if (id.endsWith('.node')) { loaded++; return { getRuntimeInfo: () => { initialized++; return JSON.stringify(info) } } }
      return localRequire(id)
    }
  })
  return { root, artifact, sidecar, load, counts: () => [loaded, initialized] }
}

test('valid sidecar, hashes, recipe and layout are admitted before native initialization', t => {
  const f = setup(t)
  assert.doesNotThrow(f.load)
  assert.deepEqual(f.counts(), [1, 1])
})

test('missing, malformed, stale and corrupt provenance never reaches dlopen', t => {
  for (const mutate of [
    f => fs.unlinkSync(f.sidecar),
    f => fs.writeFileSync(f.sidecar, '{'),
    f => { const j = JSON.parse(fs.readFileSync(f.sidecar)); j.buildRecipeSha256 = '0'.repeat(64); fs.writeFileSync(f.sidecar, JSON.stringify(j)) },
    f => { const j = JSON.parse(fs.readFileSync(f.sidecar)); j.wrapperSha256 = '0'.repeat(64); fs.writeFileSync(f.sidecar, JSON.stringify(j)) },
    f => { const j = JSON.parse(fs.readFileSync(f.sidecar)); j.profile = 'unverified'; fs.writeFileSync(f.sidecar, JSON.stringify(j)) },
    f => fs.appendFileSync(f.artifact, 'corruption')
  ]) {
    const f = setup(t); mutate(f)
    assert.throws(f.load)
    assert.deepEqual(f.counts(), [0, 0])
  }
})

test('a hash-matching but dyld-incompatible layout is rejected before dlopen', t => {
  const f = setup(t)
  const data = fixture(); data.writeUInt32LE(84, 48); fs.writeFileSync(f.artifact, data)
  const j = JSON.parse(fs.readFileSync(f.sidecar)); j.addonSha256 = sha256(f.artifact); fs.writeFileSync(f.sidecar, JSON.stringify(j))
  assert.throws(f.load, /Misaligned/)
  assert.deepEqual(f.counts(), [0, 0])
})

test('unrelated application --debug does not select or weaken admitted build profiles', t => {
  const previous = process.argv
  try {
    for (const profile of ['release', 'debug']) {
      const f = setup(t)
      const j = JSON.parse(fs.readFileSync(f.sidecar)); j.profile = profile; fs.writeFileSync(f.sidecar, JSON.stringify(j))
      process.argv = [process.execPath, 'consumer.js', '--debug']
      assert.doesNotThrow(f.load)
      assert.deepEqual(f.counts(), [1, 1])
    }
  } finally { process.argv = previous }
})
