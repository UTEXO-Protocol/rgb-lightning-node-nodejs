/* global Bare */
'use strict'
const bare = typeof Bare !== 'undefined'
const fs = require(bare ? 'bare-fs' : 'node:fs')
const os = require(bare ? 'bare-os' : 'node:os')
const path = require(bare ? 'bare-path' : 'node:path')
const api = require('../index')
const assert = (value, message) => { if (!value) throw new Error(message || 'Assertion failed') }
const rejects = (fn) => { let caught = false; try { fn() } catch { caught = true } assert(caught, 'Expected request rejection') }
let official = 0
for (const vectors of [require('./fixtures/bip322/basic-test-vectors.json'), require('./fixtures/bip322/generated-test-vectors.json')]) {
  for (const row of vectors.simple) for (const signature of row.bip322_signatures) {
    const supported = row.type === 'p2tr' || row.type === 'p2wpkh'
    if (!supported) { let accepted = false; try { accepted = api.verifyMessageBip322(row.message, row.address, signature, 'mainnet') } catch {} assert(!accepted, 'Unsupported script was accepted'); continue }
    assert(api.verifyMessageBip322(row.message, row.address, signature, 'mainnet')); official++
    assert(!api.verifyMessageBip322(row.message + '!', row.address, signature, 'mainnet'))
  }
}
for (const row of require('./fixtures/bip322/independent-public-vectors.json')) {
  assert(api.verifyMessageBip322(row.message, row.address, row.signature, 'mainnet') === row.expected, row.description)
}
assert(api.getRuntimeInfo().capabilities.includes('bip322-simple-v1'))
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utexo-bip322-host-'))
const request = {
  ldk_chain_sync: { mode: 'TransactionSync', config: { indexer_url: 'http://127.0.0.1:18094' } },
  indexer_url: 'http://127.0.0.1:18094', proxy_endpoint: 'rpc://127.0.0.1:28090/json-rpc',
  eth_rpc_url: 'http://127.0.0.1:18555', announce_addresses: []
}
let node, signer, other
let saved
const publicProofs = []
try {
  for (let cycle = 0; cycle < 2; cycle++) {
    // Public fixture seed. Never fund this wallet.
    signer = api.NativeExternalSigner.createWithStorage('01'.repeat(32), 'regtest', path.join(root, 'signer'))
    node = api.SdkNode.create({ storage_dir_path: path.join(root, 'node'), network: 'regtest', daemon_listening_port: 0,
      ldk_peer_listening_port: 0, max_media_upload_size_mb: 5, enable_virtual_channels_v0: false, reuse_addresses: true })
    rejects(() => node.getMessageSigningAddress())
    rejects(() => node.signMessageBip322('locked', 'bcrt1ptest'))
    if (cycle === 0) node.initWithNativeExternalSigner(signer)
    node.unlockWithNativeExternalSigner(signer, request)
    const address = node.getMessageSigningAddress()
    if (saved) assert(saved === address, 'Canonical address changed on signer reopen')
    saved = address
    const receive = node.address().address
    assert(receive === address, 'First vanilla wallet receive address does not match the canonical signing address')
    assert(node.getMessageSigningAddress() === address)
    assert(node.address().address === receive, 'Signing getter rotated receive address')
    const transactions = JSON.stringify(node.listTransactions(true))
    for (const message of ['', '  exact bytes\n', 'Unicode: é e\u0301 😄', 'NUL\0inside', 'a'.repeat(4096)]) {
      const signature = node.signMessageBip322(message, address)
      assert(signature.startsWith('smp'))
      assert(node.verifyMessageBip322(message, address, signature))
      assert(api.verifyMessageBip322(message, address, signature, 'regtest'))
      assert(api.verifyMessageBip322(message, address, signature.slice(3), 'regtest'))
      const altered = message.length ? '!' + message.slice(1) : '!'
      assert(!api.verifyMessageBip322(altered, address, signature, 'regtest'))
      rejects(() => api.verifyMessageBip322(message, address, signature, 'mainnet'))
      if (message.length < 100) publicProofs.push({ message, address, signature, network: 'regtest' })
    }
    rejects(() => node.signMessageBip322('a'.repeat(4097), address))
    rejects(() => node.signMessageBip322('\ud800', address))
    rejects(() => node.signMessageBip322({ toJSON: () => 'coerced' }, address))
    other = api.NativeExternalSigner.create('02'.repeat(32), 'regtest')
    // A valid address from an official vector is still foreign and cannot be signed.
    rejects(() => node.signMessageBip322('foreign', 'bc1pcquvhrqv0q68t4m0hfq6tpn006qrskyc7yrqnp2uyrf2emg3wynsdjyk38'))
    node.detachExternalSigner()
    rejects(() => node.getMessageSigningAddress())
    rejects(() => node.signMessageBip322('detached', address))
    node.attachNativeExternalSigner(other)
    rejects(() => node.getMessageSigningAddress())
    rejects(() => node.signMessageBip322('wrong attachment', address))
    node.attachNativeExternalSigner(signer)
    assert(node.getMessageSigningAddress() === address)
    assert(JSON.stringify(node.listTransactions(true)) === transactions, 'Message proof changed wallet transactions')
    node.shutdown()
    rejects(() => node.signMessageBip322('closed', address))
    node = undefined
    signer.shutdown(); signer.shutdown()
    rejects(() => signer.bootstrap())
    signer.destroy(); signer = undefined
    other.shutdown(); other.destroy(); other = undefined
  }
} finally {
  if (node) node.shutdown()
  if (signer) { signer.shutdown(); signer.destroy() }
  if (other) { other.shutdown(); other.destroy() }
  fs.rmSync(root, { recursive: true, force: true })
}
console.log(JSON.stringify({ runtime: bare ? 'bare' : 'node', officialProofs: official,
  independentProofs: 9, cycles: 2, publicProofs }))
