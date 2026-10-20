'use strict'
// rgb-lib-bfa requires fresh addresses; address reuse is explicitly unsupported.

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { NativeExternalSigner, SdkNode, getRuntimeInfo } = require('./index')
const { identity, readConfig } = require('./scripts/install-overlay-addon')

const config = readConfig()
const expected = identity(config)
const info = getRuntimeInfo()
assert.equal(info.rln_commit, config.commit)
assert.equal(info.adapter_sha256, config.patchSha256)
assert.equal(info.wrapper_sha256, expected.wrapperSha256)
assert.equal(info.lock_sha256, expected.lockSha256)
assert.ok(info.capabilities.includes('persistent-native-signer'))
assert.ok(info.capabilities.includes('external-signer-burn-v1'))
require('./scripts/test-vss-safety-host')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rln-node-release-canary-'))
const signerDir = path.join(root, 'signer')
const nodeDir = path.join(root, 'node')
let signer
let node
let bootstrap
try {
  // Public deterministic fixture seed: this wallet must never be funded.
  signer = NativeExternalSigner.createWithStorage('01'.repeat(32), 'regtest', signerDir)
  bootstrap = signer.bootstrap()
  assert.match(bootstrap.node_id, /^(02|03)[a-f0-9]{64}$/)
  assert.throws(() => SdkNode.create({ storage_dir_path: path.join(root, 'unsupported-reuse'),
    network: 'regtest', daemon_listening_port: 0, ldk_peer_listening_port: 0,
    max_media_upload_size_mb: 5, reuse_addresses: true }), /Address reuse is not supported by rgb-lib-bfa/)
  node = SdkNode.create({
    storage_dir_path: nodeDir,
    daemon_listening_port: 0,
    ldk_peer_listening_port: 0,
    network: 'regtest',
    max_media_upload_size_mb: 5,
    enable_virtual_channels_v0: false,
    reuse_addresses: false
  })
  assert.throws(() => node.apayNewWithAddress('02'.repeat(33), 'canary', 'example.com'), /NotInitialized/)
  assert.equal(typeof node.burn, 'function')
  assert.equal(typeof node.burnAsset, 'function')
  assert.throws(() => node._inner.burn('{}'))
  for (const method of ['syncWallet', 'walletSnapshot', 'prepareBtcSend', 'vssDeleteAll']) {
    assert.throws(() => node[method]({}), { code: 'ERR_RLN_UNSUPPORTED_CAPABILITY' })
  }
  node.initWithNativeExternalSigner(signer)
  assert.throws(() => node.initWithNativeExternalSigner(signer), /^Error: Rln\(Conflict\):/)
  assert.throws(() => node.unlockWithNativeExternalSigner(signer, {}), /ldk_chain_sync/)
  assert.throws(() => node.sendPayment({ invoice: 'unused', max_total_routing_fee_msat: 0 }), {
    code: 'ERR_RLN_UNSUPPORTED_CAPABILITY'
  })
  node.shutdown()
  node.shutdown()
  node = undefined
  signer.shutdown()
  signer.shutdown()
  assert.throws(() => signer.bootstrap(), /shut ?down|closed/i)
  // The persistent store must reopen before the old host handle is freed.
  const reopened = NativeExternalSigner.createWithStorage('01'.repeat(32), 'regtest', signerDir)
  assert.deepEqual(reopened.bootstrap(), bootstrap)
  signer.destroy()
  signer.destroy()
  assert.throws(() => signer.bootstrap(), /destroyed/)
  signer = reopened
  assert.deepEqual(signer.bootstrap(), bootstrap)
  assert.equal(fs.statSync(signerDir).mode & 0o777, 0o700)
  assert.throws(() => NativeExternalSigner.create('01'.repeat(32), 'mainnet', true))
} finally {
  if (node) node.shutdown()
  if (signer) { signer.shutdown(); signer.destroy() }
  fs.rmSync(root, { recursive: true, force: true })
}
console.log('Native identity, offline init, errors, disposal and persistent signer reopen passed.')

const retainedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rln-node-host-free-'))
let retainedNode
let retainedSigner
try {
  const storage = path.join(retainedRoot, 'signer')
  retainedSigner = NativeExternalSigner.createWithStorage('02'.repeat(32), 'regtest', storage)
  const expectedBootstrap = retainedSigner.bootstrap()
  retainedNode = SdkNode.create({ storage_dir_path: path.join(retainedRoot, 'node'),
    daemon_listening_port: 0, ldk_peer_listening_port: 0, network: 'regtest',
    max_media_upload_size_mb: 5, enable_virtual_channels_v0: false, reuse_addresses: false })
  retainedNode.initWithNativeExternalSigner(retainedSigner)
  retainedNode.attachNativeExternalSigner(retainedSigner)
  retainedSigner.destroy()
  // Freeing the host Arc must not revoke or release the still-attached signer.
  assert.throws(() => NativeExternalSigner.createWithStorage('02'.repeat(32), 'regtest', storage),
    /Database already open|Cannot acquire lock/)
  retainedSigner = undefined
  retainedNode.shutdown()
  retainedNode = undefined
  retainedSigner = NativeExternalSigner.createWithStorage('02'.repeat(32), 'regtest', storage)
  assert.deepEqual(retainedSigner.bootstrap(), expectedBootstrap)
} finally {
  if (retainedNode) retainedNode.shutdown()
  if (retainedSigner) { retainedSigner.shutdown(); retainedSigner.destroy() }
  fs.rmSync(retainedRoot, { recursive: true, force: true })
}
console.log('Early host-handle release preserves the attached signer until node shutdown.')

const mainnetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rln-mainnet-policy-'))
const mainnet = SdkNode.create({ storage_dir_path: mainnetRoot,
  daemon_listening_port: 0, ldk_peer_listening_port: 0, network: 'mainnet',
  max_media_upload_size_mb: 5, enable_virtual_channels_v0: false, reuse_addresses: false })
try {
  assert.throws(() => mainnet.lnInvoice({ amt_msat: 1000, expiry_sec: 3600 }), /LightningUnsupportedOnMainnet/)
  assert.throws(() => mainnet.listChannels(), /LightningUnsupportedOnMainnet/)
  assert.throws(() => mainnet.btcBalance(true), /NotInitialized/)
} finally {
  mainnet.shutdown()
  fs.rmSync(mainnetRoot, { recursive: true, force: true })
}
console.log('Mainnet Lightning rejection and unchanged on-chain initialization requirements passed; no network connection or funds used.')
