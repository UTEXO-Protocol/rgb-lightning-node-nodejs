'use strict'

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
  node = SdkNode.create({
    storage_dir_path: nodeDir,
    daemon_listening_port: 0,
    ldk_peer_listening_port: 0,
    network: 'regtest',
    max_media_upload_size_mb: 5,
    enable_virtual_channels_v0: false,
    reuse_addresses: true
  })
  assert.throws(() => node.apayNewWithAddress('02'.repeat(33), 'canary', 'example.com'), /NotInitialized/)
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
  signer.destroy()
  signer.destroy()
  assert.throws(() => signer.bootstrap(), /destroyed/)
  signer = NativeExternalSigner.createWithStorage('01'.repeat(32), 'regtest', signerDir)
  assert.deepEqual(signer.bootstrap(), bootstrap)
  assert.equal(fs.statSync(signerDir).mode & 0o777, 0o700)
  assert.throws(() => NativeExternalSigner.create('01'.repeat(32), 'mainnet', true))
} finally {
  if (node) node.shutdown()
  if (signer) signer.destroy()
  fs.rmSync(root, { recursive: true, force: true })
}
console.log('Native identity, offline init, errors, disposal and persistent signer reopen passed.')
