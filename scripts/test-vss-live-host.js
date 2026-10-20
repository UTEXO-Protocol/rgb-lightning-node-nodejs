/* global Bare */
'use strict'
// rgb-lib-bfa requires fresh addresses; address reuse is explicitly unsupported.
// Opt-in disposable-wallet qualification. Never runs during package installation.
const bare = typeof Bare !== 'undefined'
const fs = require(bare ? 'bare-fs' : 'node:fs')
const os = require(bare ? 'bare-os' : 'node:os')
const path = require(bare ? 'bare-path' : 'node:path')
const api = require('../index')
const readEnvironment = name => bare ? os.getEnv(name) : process.env[name]
const endpoint = readEnvironment('RLN_VSS_TEST_URL')
if (!endpoint) throw new Error('Set RLN_VSS_TEST_URL explicitly for the disposable-wallet test')
const network = readEnvironment('RLN_VSS_TEST_NETWORK') || 'regtest'
const indexer = readEnvironment('RLN_VSS_TEST_INDEXER') || 'http://127.0.0.1:18094'
const proxy = readEnvironment('RLN_VSS_TEST_PROXY') || 'rpc://127.0.0.1:28090/json-rpc'
const eth = readEnvironment('RLN_VSS_TEST_ETH') || 'http://127.0.0.1:18555'
const assert = (value, message) => { if (!value) throw new Error(message) }
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utexo-vss-live-'))
fs.chmodSync(root, 0o700)
const random = Buffer.alloc(32)
const fd = fs.openSync('/dev/urandom', 'r')
fs.readSync(fd, random, 0, random.length, null)
fs.closeSync(fd)
// This identity is never printed or funded. No real wallet or bridge is touched.
const seed = random.toString('hex')
random.fill(0)
let node, signer
const versions = []
const infoRows = []
const config = (directory, allowEmpty) => ({ storage_dir_path: path.join(root, directory), network,
  daemon_listening_port: 0, ldk_peer_listening_port: 0, max_media_upload_size_mb: 5,
  enable_virtual_channels_v0: false, reuse_addresses: false, vss_url: endpoint,
  vss_allow_http: false, vss_allow_empty_restore: allowEmpty })
const unlock = { ldk_chain_sync: { mode: 'TransactionSync', config: { indexer_url: indexer } },
  indexer_url: indexer, proxy_endpoint: proxy, eth_rpc_url: eth, announce_addresses: [] }
function open (directory, initialize, allowEmpty, restore = false) {
  signer = api.NativeExternalSigner.createWithStorage(seed, network, path.join(root, directory + '-signer'))
  node = api.SdkNode.create(config(directory, allowEmpty))
  if (initialize) node.initWithNativeExternalSigner(signer)
  if (initialize && !restore) {
    const missing = node.prepareVssRestore()
    assert(missing.restored === false && missing.status === 'not_found' && missing.version === null, 'Missing remote archive incorrectly claimed restore')
    assert(node.vssRestoreInfo() === null, 'Missing archive manufactured local restore proof')
  }
  if (restore) {
    const prepared = node.prepareVssRestore()
    assert(prepared.restored === true && prepared.status === 'restored' && prepared.version > 0, 'Existing remote archive was not actually prepared')
    assert(node.vssRestoreInfo().unlocked === false, 'Prepared archive claimed completed unlock')
    assert(node.prepareVssRestore().version === prepared.version, 'Same-handle preparation was not idempotent')
  }
  node.unlockWithNativeExternalSigner(signer, unlock)
  if (restore) assert(node.vssRestoreInfo().unlocked === true, 'Normal SDK unlock did not verify prepared restore')
}
function close () {
  if (node) { node.shutdown(); node = undefined }
  if (signer) { signer.shutdown(); signer.destroy(); signer = undefined }
}
function status () {
  const row = node.vssBackupInfo()
  assert(typeof row.backup_exists === 'boolean' && typeof row.backup_required === 'boolean' &&
    typeof row.last_auto_backup_failed === 'boolean', 'Invalid native backup-info shape')
  if (row.backup_exists) assert(row.version !== null, 'Existing backup must have a version')
  infoRows.push(row)
  return row
}
try {
  open('original', true, false)
  const initial = status()
  assert(initial.backup_exists, 'Initial configured wallet did not create a remote snapshot')
  const signingAddress = node.getMessageSigningAddress()
  const address = node.address().address
  const checkpoint = node.vssBackup()
  assert(checkpoint.version !== undefined, 'Checkpoint returned no version')
  versions.push(checkpoint.version)
  const current = status()
  assert(current.backup_exists && !current.backup_required && !current.last_auto_backup_failed,
    'Uploaded snapshot is not reported as current')
  close()

  open('original', false, false)
  assert(node.getMessageSigningAddress() === signingAddress, 'Graceful reopen changed the canonical signing key')
  const reopenedAddress = node.address().address
  assert(reopenedAddress !== address, 'Graceful reopen reused an already revealed receive address')
  assert(status().backup_exists, 'Graceful reopen lost remote backup information')
  versions.push(node.vssBackup().version)
  // Keep the remote checkpoint fixed, then observe the next local receive key.
  // A fresh-directory restore must recover that exact derivation cursor.
  node.setVssAutomaticBackupEnabled(false)
  const checkpointVersion = status().version
  const restoredNextAddress = node.address().address
  assert(status().version === checkpointVersion && status().backup_required, 'Paused local derivation unexpectedly replaced the remote checkpoint')
  close()

  open('restored', true, false, true)
  assert(node.getMessageSigningAddress() === signingAddress, 'Fresh-directory restore changed the canonical signing key')
  assert(node.address().address === restoredNextAddress, 'Fresh-directory restore did not recover the fresh-address derivation cursor')
  assert(status().backup_exists, 'Restored wallet did not read its remote snapshot')
  versions.push(node.vssBackup().version)
  close()
  console.log(JSON.stringify({ vssLiveQualification: 'pass', runtime: bare ? 'bare' : 'node', network,
    initialBackup: true, explicitCheckpoint: true, gracefulReopen: true,
    freshDirectoryAddressRestore: true, freshAddressCursorRestore: true, versions, infoRows, funded: false, bridgeAccessed: false,
    remoteErasureClaimed: false }))
} finally {
  close()
  fs.rmSync(root, { recursive: true, force: true })
}
