/* global Bare */
'use strict'
const bare = typeof Bare !== 'undefined'
const fs = require(bare ? 'bare-fs' : 'node:fs')
const os = require(bare ? 'bare-os' : 'node:os')
const path = require(bare ? 'bare-path' : 'node:path')
const api = require('../index')
const raw = bare ? require('../binding') : require('../index-' + process.platform + '-' + process.arch + (process.platform === 'linux' ? (process.report.getReport().header.glibcVersionRuntime ? '-gnu' : '-musl') : '') + '.node')
const policy = { supported: true, code: null, reason: null }
const assert = (value, message) => { if (!value) throw new Error(message) }
const rejects = (fn, pattern) => {
  let error
  try { fn() } catch (caught) { error = caught }
  assert(error && pattern.test(error.message), 'Expected bounded native validation failure')
  assert(!error.message.includes('private-secret'), 'Configuration error leaked credentials')
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
assert(api.getRuntimeInfo().capabilities.includes('vss-backup-v1'), 'Missing compiled VSS backup capability')
assert(!api.getRuntimeInfo().capabilities.includes('vss-safety-policy-v1'), 'Stale VSS denial capability')
assert(Object.keys(api.getRuntimeInfo().vss_policy).length === 3 && Object.keys(policy).every(key => api.getRuntimeInfo().vss_policy[key] === policy[key]), 'Incorrect compiled VSS availability metadata')
assert(Object.isFrozen(api.getRuntimeInfo().vss_policy), 'Policy metadata is mutable')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utexo-vss-admission-'))
let node
let cases = 0
try {
  const existing = path.join(root, 'existing')
  fs.mkdirSync(existing)
  fs.writeFileSync(path.join(existing, 'preserve'), 'Existing wallet data must not be changed')
  const before = snapshot(root)
  for (const network of ['regtest', 'signet', 'mainnet', 'testnet', 'testnet4']) {
    for (const vss_url of ['', ' \n\t ', 'ftp://example.invalid/vss', 'https://user:private-secret@example.invalid/vss', 'https://example.invalid/vss?private-secret', 'https://example.invalid/vss#private-secret', 'http://example.invalid/vss']) {
      for (const storage_dir_path of [path.join(root, 'must-not-exist'), existing]) {
        const config = { storage_dir_path, network, daemon_listening_port: 0, ldk_peer_listening_port: 0,
          max_media_upload_size_mb: 1, vss_url, vss_allow_http: false, vss_allow_empty_restore: false }
        rejects(() => api.SdkNode.create(config), /InvalidRequest/)
        rejects(() => bare ? raw.sdkNodeNew(JSON.stringify(config)) : raw.SdkNode.create(JSON.stringify(config)), /InvalidRequest/)
        rejects(() => raw.sdkInitialize(JSON.stringify(config)), /InvalidRequest/)
        assert(snapshot(root) === before, 'Invalid VSS configuration modified existing storage')
        cases += 3
      }
    }
  }
  // Construction validates configuration only. It must not contact a remote
  // store or silently drop an accepted URL; backup still requires unlock.
  for (const vss_url of [undefined, null, 'https://example.invalid/vss', 'http://127.0.0.1:5/vss']) {
    node = api.SdkNode.create({ storage_dir_path: path.join(root, 'accepted-' + String(cases++)), network: 'regtest',
      daemon_listening_port: 0, ldk_peer_listening_port: 0, max_media_upload_size_mb: 1, vss_url })
    rejects(() => node.vssBackup(), /Locked|NotInitialized/)
    rejects(() => node.vssBackupInfo(), /Locked|NotInitialized/)
    node.shutdown()
    node = undefined
  }
} finally {
  if (node) node.shutdown()
  fs.rmSync(root, { recursive: true, force: true })
}
console.log(JSON.stringify({ vssBackupAdmission: 'pass', runtime: bare ? 'bare' : 'node',
  constructorCases: cases, preservedExistingStorage: true, localAndValidVssConfigurationsAccepted: true }))
