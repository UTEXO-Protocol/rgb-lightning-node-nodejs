'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { sendRgbInvoiceRequest, parse } = require('../json-boundary')

const request = Object.freeze({
  invoice: 'rgb:contract/recipient?pk=' + 'ab'.repeat(32) + '&enc=required&expiry=1893456000',
  asset_id: 'rgb:contract',
  amount: '9007199254740993',
  donation: false,
  fee_rate: 2,
  min_confirmations: 6
})

test('invoice-first sends preserve exact invoice and u64 numeric tokens', () => {
  const raw = sendRgbInvoiceRequest(request)
  assert.match(raw, /"amount":9007199254740993/)
  assert.equal(parse(raw).invoice, request.invoice)
  assert.equal(parse(raw).amount, request.amount)
  assert.equal(parse(raw).donation, false)
  assert.equal(parse(raw).witness_data, null)
  const max = sendRgbInvoiceRequest({ ...request, amount: '18446744073709551615', fee_rate: '1',
    witness_data: Object.freeze({ amount_sat: '9007199254740993', blinding: '18446744073709551615' }) })
  assert.equal(parse(max).witness_data.blinding, '18446744073709551615')
  assert.equal(parse(max).witness_data.amount_sat, '9007199254740993')
  assert.equal(parse(max).fee_rate, 1)
})

test('lossy amounts and caller-supplied proxy policy never reach serialization', () => {
  for (const field of ['amount', 'fee_rate']) {
    for (const value of [0, -1, 1.5, NaN, Infinity, 9007199254740992, '0', '01', '1e3', '-1', '1.0',
      '18446744073709551616', null, undefined, {}, true, 1n]) {
      assert.throws(() => sendRgbInvoiceRequest({ ...request, [field]: value }))
    }
  }
  for (const field of ['public_key', 'encryption', 'sender_proxy_url', 'expiration_timestamp', 'skip_sync', 'toJSON']) {
    assert.throws(() => sendRgbInvoiceRequest({ ...request, [field]: 'override' }), /Unknown/)
  }
  for (const value of [null, undefined, [], 'invoice']) assert.throws(() => sendRgbInvoiceRequest(value))
})

test('invoice bounds, witness integers and confirmation policy are strict', () => {
  for (const invoice of ['', 'rgb:invoice\0ignored', 'rgb:invoice\n', ' rgb:invoice', 'a'.repeat(16385), null, {}, 1]) {
    assert.throws(() => sendRgbInvoiceRequest({ ...request, invoice }))
  }
  for (const confirmations of [-1, 256, 1.5, '6', null]) {
    assert.throws(() => sendRgbInvoiceRequest({ ...request, min_confirmations: confirmations }))
  }
  for (const donation of [undefined, null, 'false', 0, 1, {}]) {
    assert.throws(() => sendRgbInvoiceRequest({ ...request, donation }))
  }
  for (const witness of [[], 1, {}, { amount_sat: 0 }, { amount_sat: 600, blinding: -1 },
    { amount_sat: 600, public_key: 'override' }, { amount_sat: '18446744073709551616' }]) {
    assert.throws(() => sendRgbInvoiceRequest({ ...request, witness_data: witness }))
  }
  assert.deepEqual(parse(sendRgbInvoiceRequest({ ...request, witness_data: { amount_sat: 600 } })).witness_data,
    { amount_sat: 600, blinding: null })
})
