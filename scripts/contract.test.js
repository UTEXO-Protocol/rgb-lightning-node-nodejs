'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const boundary = require('../json-boundary')

test('burn preserves the merged native contract, exact u64 tokens and failures', () => {
  const calls = []
  let fail = false
  const error = new Error('Rln(InvalidBurnRecipient): recipient required for BFA')
  const native = { burn: (...args) => {
    if (fail) throw error
    calls.push(args.at(-1))
    return '{"txid":"abc","batch_transfer_idx":2147483647}'
  } }
  const node = new (facade().SdkNode)(native)
  const request = { asset_id: 'rgb:test', amount: '18446744073709551615',
    fee_rate: '1', min_confirmations: 0 }
  for (const method of ['burn', 'burnAsset']) {
    for (const recipient of [undefined, null, 'ab'.repeat(32)]) {
      const input = { ...request, burn_recipient: recipient }
      assert.deepEqual(node[method](input), { txid: 'abc', batch_transfer_idx: 2147483647 })
      assert.match(calls.at(-1), /"amount":18446744073709551615/)
      assert.match(calls.at(-1), /"fee_rate":1/)
      assert.equal(boundary.parse(calls.at(-1)).burn_recipient, recipient)
      assert.equal(input.amount, request.amount)
    }
    fail = true
    assert.throws(() => node[method](request), error)
    fail = false
  }
})

test('burn rejects invalid or lossy values before native submission', () => {
  let calls = 0
  const native = { burn: () => { calls++; return '{}' } }
  const node = new (facade().SdkNode)(native)
  const request = { asset_id: 'rgb:test', amount: 1, fee_rate: 1, min_confirmations: 1 }
  for (const method of ['burn', 'burnAsset']) {
    for (const field of ['amount', 'fee_rate']) {
      for (const value of [-1, 1.5, NaN, Infinity, 2 ** 64, '-1', '1.5', '1e3', '01',
        '18446744073709551616', null, undefined, {}, true]) {
        assert.throws(() => node[method]({ ...request, [field]: value }))
      }
    }
    for (const min_confirmations of [-1, 256, 1.5, '1', null]) {
      assert.throws(() => node[method]({ ...request, min_confirmations }))
    }
    for (const burn_recipient of ['', '0x' + 'ab'.repeat(32), 'ab'.repeat(31), 'gg'.repeat(32), 1]) {
      assert.throws(() => node[method]({ ...request, burn_recipient }))
    }
    assert.throws(() => node[method]({ ...request, recipient: 'ab'.repeat(32) }), /Unknown burn/)
    for (const input of [null, undefined, [], { ...request, asset_id: '' }]) {
      assert.throws(() => node[method](input))
    }
  }
  assert.equal(calls, 0)
})
const installer = require('./install-overlay-addon')

function facade (overrides = {}) {
  const root = path.resolve(__dirname, '..')
  const identity = installer.identity(installer.readConfig())
  const info = { abi_version: 1, rln_version: '0.17.0-beta.3', rln_commit: identity.commit,
    lightning_commit: identity.lightningCommit, adapter_sha256: identity.patchSha256,
    wrapper_sha256: identity.wrapperSha256, lock_sha256: identity.lockSha256,
    target: identity.target, capabilities: [], ...overrides }
  const native = { getRuntimeInfo: () => JSON.stringify(info) }
  const result = {}
  const localRequire = createRequire(path.join(root, 'index.js'))
  vm.runInNewContext(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), {
    __dirname: root, exports: result, Buffer, process,
    require: (id) => id === './scripts/install-overlay-addon'
      ? { ...installer, verifyAddonAdmission: () => identity }
      : id.endsWith('.node') ? native : id === 'fs'
      ? { ...fs, existsSync: () => true } : localRequire(id)
  })
  return result
}

test('large JSON response integers remain exact and unsafe input numbers fail', () => {
  assert.equal(boundary.parse('{"amount":9007199254740993}').amount, '9007199254740993')
  assert.equal(boundary.parse('{"channel_asset_max_amount":18446744073709551615}').channel_asset_max_amount, '18446744073709551615')
  assert.equal(boundary.parse('{"short_channel_id":989560465031299073}').short_channel_id, '989560465031299073')
  assert.deepEqual(boundary.parse('[-9223372036854775808,0,1.25,1e3]'), ['-9223372036854775808', 0, 1.25, 1000])
  for (const raw of ['[1e999]', '[1e20]']) {
    assert.throws(() => boundary.parse(raw), { code: 'ERR_RLN_UNSAFE_NUMBER' })
  }
  assert.equal(boundary.parse('{"amount":9007199254740991}').amount, Number.MAX_SAFE_INTEGER)
  for (const amount of [Number.MAX_SAFE_INTEGER + 1, Infinity, NaN]) {
    assert.throws(() => boundary.stringify({ amount }), { code: 'ERR_RLN_UNSAFE_NUMBER' })
  }
  assert.equal(boundary.parse('{"memo":"9007199254740993"}').memo, '9007199254740993')
})

test('compiled runtime identity is checked before any node is created', () => {
  assert.throws(() => facade({ rln_commit: 'old' }), /identity mismatch/)
  assert.throws(() => facade({ rln_version: '0.15.0-beta.3' }), /rln_version/)
  const info = facade().getRuntimeInfo()
  assert.ok(Object.isFrozen(info))
  assert.ok(Object.isFrozen(info.capabilities))
})

test('both external unlock entrypoints preserve optional Ethereum RPC and native errors', () => {
  for (const method of ['unlockWithNativeExternalSigner', 'unlockWithAttachedExternalSigner']) {
    const requests = []
    const error = new Error('Rln(InvalidIndexer): Ethereum RPC unavailable')
    const native = { [method]: (...args) => { requests.push(JSON.parse(args.at(-1))) } }
    const node = new (facade().SdkNode)(native)
    const invoke = request => method === 'unlockWithNativeExternalSigner'
      ? node[method]({ _inner: {} }, request) : node[method](request)
    for (const request of [{}, { eth_rpc_url: null }, { eth_rpc_url: 'http://127.0.0.1:29545' }]) {
      invoke(request)
      assert.deepEqual(requests.at(-1), request)
    }
    native[method] = () => { throw error }
    assert.throws(() => invoke({ eth_rpc_url: 'http://127.0.0.1:29545' }), error)
  }
})

test('all unsupported APIs throw before accessing a native handle', () => {
  const { SdkNode, UnsupportedCapabilityError } = facade()
  const node = new SdkNode(new Proxy({}, { get () { throw new Error('native accessed') } }))
  for (const method of [
    'startUnlockWithNativeExternalSigner', 'nativeOperationStatus', 'adoptNativeOperation',
    'cancelNativeOperation', 'vssDeleteAll', 'syncWallet', 'walletSnapshot', 'prepareBtcSend',
    'commitPreparedBtcSend', 'cancelBtcSendPlan', 'prepareCreateUtxos', 'commitPreparedCreateUtxos',
    'cancelCreateUtxosPlan', 'listPendingVanillaTransactions', 'listAddressReceipts',
    'prepareRgbSend',
    'commitPreparedRgbSend', 'cancelRgbSendPlan', 'listPendingRgbSendPlans'
  ]) assert.throws(() => node[method]({}), UnsupportedCapabilityError, method)
})

test('refresh preserves per-batch nulls and failures', () => {
  const response = { transfers: { 12: { updated_status: null, failure: { name: 'Failed', message: 'reason' } },
    13: { updated_status: 'WaitingBroadcast', failure: null } } }
  const node = new (facade().SdkNode)({ refreshTransfers: () => JSON.stringify(response) })
  assert.deepEqual(node.refreshTransfers({}), response)
})

test('unsupported payment controls and unsafe values cannot reach native submission', () => {
  let calls = 0
  const node = new (facade().SdkNode)({ sendPayment: () => { calls++; return '{}' } })
  assert.throws(() => node.sendPayment({ invoice: 'invoice', max_total_routing_fee_msat: 0 }), {
    code: 'ERR_RLN_UNSUPPORTED_CAPABILITY'
  })
  assert.throws(() => node.sendPayment({ invoice: 'invoice', asset_amount: 2 ** 64 }), RangeError)
  assert.equal(calls, 0)
})

test('combined and absent transfer filters are forwarded independently', () => {
  const calls = []
  const node = new (facade().SdkNode)({ listTransfers: (...args) => { calls.push(args); return '[]' } })
  node.listTransfers()
  node.listTransfers('asset', 'txid')
  node.listTransfers({ asset_id: 'asset', txid: 'txid' })
  assert.deepEqual(calls, [[null, null], ['asset', 'txid'], ['asset', 'txid']])
})

test('failed shutdown retains native state for retry and reports the failure', () => {
  let calls = 0
  const node = new (facade().SdkNode)({ shutdown () { if (++calls === 1) throw new Error('flush failed') } })
  assert.throws(() => node.shutdown(), /flush failed/)
  assert.equal(node._closed, false)
  assert.ok(node._inner)
  node.shutdown()
  node.shutdown()
  assert.equal(calls, 2)
})

test('signer revocation is explicit, terminal, retryable and separate from host-handle release', () => {
  const calls = []
  let fail = true
  let revoked = false
  const native = {
    shutdown () {
      calls.push('shutdown')
      if (fail) throw new Error('revocation failed')
      revoked = true
    },
    bootstrap () {
      if (revoked) throw new Error('signer shut down')
      return '{"node_id":"fixture"}'
    },
    destroy () { calls.push('free') }
  }
  const { NativeExternalSigner } = facade()
  const signer = new NativeExternalSigner(native)
  assert.throws(() => signer.shutdown(), /revocation failed/)
  assert.equal(signer.bootstrap().node_id, 'fixture')
  assert.equal(signer._shutdown, false)
  fail = false
  signer.shutdown()
  signer.shutdown()
  assert.throws(() => signer.bootstrap(), /shut down/)
  signer.destroy()
  signer.destroy()
  assert.deepEqual(calls, ['shutdown', 'shutdown', 'free'])

  calls.length = 0
  const earlyDrop = new NativeExternalSigner(native)
  earlyDrop.destroy()
  assert.deepEqual(calls, ['free'])
  assert.throws(() => earlyDrop.shutdown(), /destroyed/)
})

test('approved RGB imports preserve payloads, exact metadata and native failures', () => {
  for (const method of ['importRgbContract', 'importRgbTransferConsignment']) {
    let received
    const native = { [method]: (request) => {
      received = JSON.parse(request)
      return '{"asset_id":"rgb:expected","already_imported":false,"metadata":{"max_supply":18446744073709551615}}'
    } }
    const node = new (facade().SdkNode)(native)
    const request = method === 'importRgbContract'
      ? { contract_base64: 'YQ==', expected_asset_id: 'rgb:expected' }
      : { consignment_base64: 'YQ==', offchain_txid: 'a'.repeat(64), expected_asset_id: 'rgb:expected' }
    assert.equal(node[method](request).metadata.max_supply, '18446744073709551615')
    assert.deepEqual(received, request)
    native[method] = () => { throw new Error('invalid contract') }
    assert.throws(() => node[method](request), /invalid contract/)
  }
})

test('local export preserves hexadecimal bytes, native paths and errors', () => {
  const calls = []
  const native = {
    getConsignment: (...args) => { calls.push(args); return '{"bytes_hex":"00ff80"}' },
    getConsignmentPath: () => '{"path":"/local/wallet/transfer/consignment.rgb"}'
  }
  const node = new (facade().SdkNode)(native)
  assert.deepEqual(node.getConsignment('asset', 'txid'), { bytes_hex: '00ff80' })
  assert.deepEqual(calls, [['asset', 'txid']])
  assert.equal(node.getConsignmentPath('asset', 'txid').path, '/local/wallet/transfer/consignment.rgb')
  const error = new Error('Rln(UnknownTransfer): missing consignment')
  native.getConsignment = () => { throw error }
  assert.throws(() => node.getConsignment('asset', 'txid'), error)
})

test('released mainnet policy errors retain their native identity', () => {
  const error = new Error('Rln(LightningUnsupportedOnMainnet): Lightning unsupported on mainnet')
  const node = new (facade().SdkNode)({ sendPayment: () => { throw error } })
  assert.throws(() => node.sendPayment({ invoice: 'invoice' }), error)
})


test('compiled VSS policy metadata is exposed read-only', () => {
  const policy = { supported: true, code: null, reason: null }
  const runtime = facade({ capabilities: ['vss-backup-v1'], vss_policy: policy }).getRuntimeInfo()
  assert.deepEqual(runtime.vss_policy, policy)
  assert.ok(Object.isFrozen(runtime.vss_policy))
  assert.throws(() => { runtime.vss_policy.supported = false }, TypeError)
})


test('VSS checkpoint and read-only info forward exact versions and native errors', () => {
  const payload = '{"version":9007199254740993}'
  const info = '{"backup_exists":true,"version":9007199254740993,"backup_required":false,"last_auto_backup_failed":false}'
  const node = new (facade().SdkNode)({ vssBackup: () => payload, vssBackupInfo: () => info })
  assert.deepEqual(node.vssBackup(), { version: '9007199254740993' })
  assert.deepEqual(node.vssBackupInfo(), { backup_exists: true, version: '9007199254740993', backup_required: false, last_auto_backup_failed: false })
})
