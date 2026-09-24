'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const boundary = require('../json-boundary')
const installer = require('./install-overlay-addon')

function facade (overrides = {}) {
  const root = path.resolve(__dirname, '..')
  const identity = installer.identity(installer.readConfig())
  const info = { abi_version: 1, rln_version: '0.13.0-beta.3', rln_commit: identity.commit,
    lightning_commit: identity.lightningCommit, adapter_sha256: identity.patchSha256,
    wrapper_sha256: identity.wrapperSha256, lock_sha256: identity.lockSha256,
    target: identity.target, capabilities: [], ...overrides }
  const native = { getRuntimeInfo: () => JSON.stringify(info) }
  const result = {}
  const localRequire = createRequire(path.join(root, 'index.js'))
  vm.runInNewContext(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), {
    __dirname: root, exports: result, Buffer, process,
    require: (id) => id.endsWith('.node') ? native : id === 'fs'
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
  const info = facade().getRuntimeInfo()
  assert.ok(Object.isFrozen(info))
  assert.ok(Object.isFrozen(info.capabilities))
})

test('all unsupported APIs throw before accessing a native handle', () => {
  const { SdkNode, UnsupportedCapabilityError } = facade()
  const node = new SdkNode(new Proxy({}, { get () { throw new Error('native accessed') } }))
  for (const method of [
    'startUnlockWithNativeExternalSigner', 'nativeOperationStatus', 'adoptNativeOperation',
    'cancelNativeOperation', 'vssDeleteAll', 'syncWallet', 'walletSnapshot', 'prepareBtcSend',
    'commitPreparedBtcSend', 'cancelBtcSendPlan', 'prepareCreateUtxos', 'commitPreparedCreateUtxos',
    'cancelCreateUtxosPlan', 'listPendingVanillaTransactions', 'listAddressReceipts',
    'importRgbTransferConsignment', 'importRgbContract', 'prepareRgbSend',
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
