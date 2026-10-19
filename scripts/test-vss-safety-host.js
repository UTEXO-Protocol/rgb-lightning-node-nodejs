/* global Bare */
'use strict'
const bare = typeof Bare !== 'undefined'
const fs = require(bare ? 'bare-fs' : 'node:fs')
const os = require(bare ? 'bare-os' : 'node:os')
const path = require(bare ? 'bare-path' : 'node:path')
const api = require('../index')
const raw = bare ? require('../binding') : require('../index-' + process.platform + '-' + process.arch + (process.platform === 'linux' ? (process.report.getReport().header.glibcVersionRuntime ? '-gnu' : '-musl') : '') + '.node')
const policy = { supported: false, code: 'ERR_VSS_UNSAFE_UPSTREAM',
  reason: 'VSS is unavailable until upstream backup security and recovery defects are fixed.' }
const assert = (value, message) => { if (!value) throw new Error(message) }
const rejects = fn => {
  let error
  try { fn() } catch (caught) { error = caught }
  assert(error && error.message.includes(policy.code) && error.message.includes(policy.reason), 'Native VSS policy denial missing')
  assert(!error.message.includes('private-secret') && !error.message.includes('example.invalid'), 'Denied configuration leaked URL or credentials')
}
function snapshot (root) {
  const result = []
  const walk = p => { for (const name of fs.readdirSync(p).sort()) {
    const file = path.join(p, name)
    if (fs.statSync(file).isDirectory()) walk(file)
    else result.push([path.relative(root, file), fs.readFileSync(file).toString('hex')])
  } }
  walk(root)
  return JSON.stringify(result)
}
assert(api.getRuntimeInfo().capabilities.includes('vss-safety-policy-v1'), 'Missing compiled VSS policy capability')
assert(Object.keys(api.getRuntimeInfo().vss_policy).length === 3 && Object.keys(policy).every(key => api.getRuntimeInfo().vss_policy[key] === policy[key]), 'Incorrect compiled VSS policy metadata')
assert(Object.isFrozen(api.getRuntimeInfo().vss_policy), 'Policy metadata is mutable')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utexo-vss-disabled-'))
let node
let cases = 0
try {
  const existing = path.join(root, 'existing')
  fs.mkdirSync(existing)
  fs.writeFileSync(path.join(existing, 'preserve'), 'Existing wallet data must not be changed')
  const before = snapshot(root)
  for (const network of ['regtest', 'signet', 'mainnet', 'testnet', 'testnet4']) {
    for (const vss_url of ['', ' \n\t ', 'ftp://example.invalid/vss', 'https://example.invalid/vss', 'http://127.0.0.1:5/vss', 'https://user:private-secret@example.invalid/vss']) {
      for (const storage_dir_path of [path.join(root, 'must-not-exist'), existing]) {
        const config = { storage_dir_path, network, daemon_listening_port: 0, ldk_peer_listening_port: 0,
          max_media_upload_size_mb: 1, vss_url, vss_allow_http: true, vss_allow_empty_restore: true }
        rejects(() => api.SdkNode.create(config))
        rejects(() => bare ? raw.sdkNodeNew(JSON.stringify(config)) : raw.SdkNode.create(JSON.stringify(config)))
        rejects(() => raw.sdkInitialize(JSON.stringify(config)))
        assert(snapshot(root) === before, 'VSS denial modified existing storage or created files')
        cases += 3
      }
    }
  }
  for (const vss_url of [undefined, null]) {
    node = api.SdkNode.create({ storage_dir_path: path.join(root, 'local-only'), network: 'regtest',
      daemon_listening_port: 0, ldk_peer_listening_port: 0, max_media_upload_size_mb: 1, vss_url })
    rejects(() => node.vssBackup())
    rejects(() => node.vssClearFence({ password: 'private-secret' }))
    const keySource = path.join(root, 'local-only', 'key_source.json')
    assert(!fs.existsSync(keySource), 'Denied backup initialized a wallet')
    node.shutdown()
    node = undefined
  }
} finally {
  if (node) node.shutdown()
  fs.rmSync(root, { recursive: true, force: true })
}
console.log(JSON.stringify({ vssSafetyPolicy: 'pass', runtime: bare ? 'bare' : 'node',
  deniedConstructorCalls: cases, preservedExistingStorage: true, omittedAndNullVssRemainLocal: true }))
