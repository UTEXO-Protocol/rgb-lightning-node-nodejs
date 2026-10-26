'use strict'

const { parse: parseLossless, stringify: stringifyLossless, LosslessNumber } = require('lossless-json')

class UnsupportedCapabilityError extends Error {
  constructor (capability) {
    super(`${capability} is not supported by released RLN 0.17.0-beta.3`)
    this.name = 'UnsupportedCapabilityError'
    this.code = 'ERR_RLN_UNSUPPORTED_CAPABILITY'
    this.capability = capability
  }
}

function unsupported (capability) {
  throw new UnsupportedCapabilityError(capability)
}

function checkedNumber (value) {
  if (typeof value === 'number' &&
      (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
    const error = new RangeError('Native JSON number exceeds the supported exact JavaScript range')
    error.code = 'ERR_RLN_UNSAFE_NUMBER'
    throw error
  }
  return value
}

function parse (text) {
  // RLN reports u64::MAX limits and 64-bit channel IDs even for small wallets.
  // Inspect numeric tokens before conversion, never an already-rounded Number.
  return parseLossless(text, undefined, {
    parseNumber (token) {
      const number = Number(token)
      if (/^-?\d+$/.test(token) && !Number.isSafeInteger(number)) return BigInt(token).toString()
      return checkedNumber(number)
    }
  })
}

function stringify (value) {
  return JSON.stringify(value, (_, item) => checkedNumber(item))
}

function paymentRequest (request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('payment request must be an object')
  }
  for (const key of Object.keys(request)) {
    if (!['invoice', 'amt_msat', 'asset_id', 'asset_amount'].includes(key)) {
      unsupported(`sendPayment.${key}`)
    }
  }
  return stringify(request)
}

function burnRequest (request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('burn request must be an object')
  }
  for (const key of Object.keys(request)) {
    if (!['asset_id', 'amount', 'burn_recipient', 'fee_rate', 'min_confirmations'].includes(key)) {
      throw new TypeError(`Unknown burn request field: ${key}`)
    }
  }
  if (typeof request.asset_id !== 'string' || !request.asset_id) {
    throw new TypeError('burn.asset_id must be a non-empty string')
  }
  const uint64 = (value, field) => {
    checkedNumber(value)
    if (!((typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) ||
        (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value))) ||
        BigInt(value) > 18446744073709551615n) {
      throw new RangeError(`burn.${field} must be an unsigned 64-bit integer`)
    }
    return new LosslessNumber(String(value))
  }
  if (!Number.isInteger(request.min_confirmations) ||
      request.min_confirmations < 0 || request.min_confirmations > 255) {
    throw new RangeError('burn.min_confirmations must be an unsigned 8-bit integer')
  }
  if (request.burn_recipient != null && (typeof request.burn_recipient !== 'string' ||
      !/^[0-9a-fA-F]{64}$/.test(request.burn_recipient))) {
    throw new TypeError('burn.burn_recipient must encode exactly 32 bytes as hex')
  }
  return stringifyLossless({
    asset_id: request.asset_id,
    amount: uint64(request.amount, 'amount'),
    burn_recipient: request.burn_recipient,
    fee_rate: uint64(request.fee_rate, 'fee_rate'),
    min_confirmations: request.min_confirmations
  })
}

function bip322Request (request) {
  for (const [key, value] of Object.entries(request)) {
    if (typeof value !== 'string') throw new TypeError(`BIP-322 ${key} must be a string`)
    const maximum = key === 'message' || key === 'signature' ? 4096 : key === 'address' ? 128 : 16
    let bytes = 0
    for (let i = 0; i < value.length; i++) {
      const unit = value.charCodeAt(i)
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = value.charCodeAt(++i)
        if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError('BIP-322 input contains an unpaired UTF-16 surrogate')
        bytes += 4
      } else if (unit >= 0xdc00 && unit <= 0xdfff) {
        throw new TypeError('BIP-322 input contains an unpaired UTF-16 surrogate')
      } else bytes += unit < 0x80 ? 1 : unit < 0x800 ? 2 : 3
      if (bytes > maximum) throw new RangeError(`BIP-322 ${key} exceeds its byte limit`)
    }
  }
  return stringify(request)
}

// Keep the invoice intact: proxy 1.0 recipient keys, encryption and expiry must
// be parsed and validated together by Rust, never reconstructed from an address.
function sendRgbInvoiceRequest (request) {
  const object = (value, allowed, field) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`${field} must be an object`)
    }
    if (Object.keys(value).some(key => !allowed.includes(key))) {
      throw new TypeError(`Unknown ${field} field`)
    }
  }
  object(request, ['invoice', 'asset_id', 'amount', 'witness_data', 'donation', 'fee_rate', 'min_confirmations'], 'sendRgbInvoice')
  const { invoice, asset_id: assetId, amount, witness_data: witness, donation, fee_rate: feeRate, min_confirmations: confirmations } = request
  if (typeof invoice !== 'string' || invoice.length === 0 || invoice.length > 16384 || /[\u0000-\u0020\u007f]/.test(invoice)) {
    throw new TypeError('sendRgbInvoice.invoice must be a bounded RGB invoice without whitespace or control characters')
  }
  if (typeof assetId !== 'string' || assetId.length === 0 || assetId.length > 512) {
    throw new TypeError('sendRgbInvoice.asset_id must be a bounded non-empty string')
  }
  if (typeof donation !== 'boolean') throw new TypeError('sendRgbInvoice.donation must be a boolean')
  if (!Number.isInteger(confirmations) || confirmations < 0 || confirmations > 255) {
    throw new RangeError('sendRgbInvoice.min_confirmations must be an unsigned 8-bit integer')
  }
  const uint64 = (value, field, positive = false) => {
    checkedNumber(value)
    if (!((typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) ||
        (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value))) ||
        BigInt(value) > 18446744073709551615n || (positive && BigInt(value) === 0n)) {
      throw new RangeError(`sendRgbInvoice.${field} must be an exact ${positive ? 'positive' : 'unsigned'} 64-bit integer`)
    }
    return new LosslessNumber(String(value))
  }
  let witnessData = null
  if (witness != null) {
    object(witness, ['amount_sat', 'blinding'], 'sendRgbInvoice.witness_data')
    witnessData = {
      amount_sat: uint64(witness.amount_sat, 'witness_data.amount_sat', true),
      blinding: witness.blinding == null ? null : uint64(witness.blinding, 'witness_data.blinding')
    }
  }
  return stringifyLossless({
    invoice,
    asset_id: assetId,
    amount: uint64(amount, 'amount', true),
    witness_data: witnessData,
    donation,
    fee_rate: uint64(feeRate, 'fee_rate', true),
    min_confirmations: confirmations
  })
}

// An operation ID is durable caller intent, never a txid inferred from history.
function createUtxosOperationRequest (request, prepare = false) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('RGB output operation request must be an object')
  }
  const allowed = prepare
    ? ['operation_id', 'up_to', 'num', 'size', 'fee_rate', 'skip_sync']
    : ['operation_id']
  if (Object.keys(request).some(key => !allowed.includes(key))) {
    throw new TypeError('Unknown RGB output operation request field')
  }
  if (typeof request.operation_id !== 'string' || !/^[a-f0-9]{32,64}$/.test(request.operation_id)) {
    throw new TypeError('RGB output operation_id must contain 32 to 64 lowercase hex characters')
  }
  if (!prepare) return stringify({ operation_id: request.operation_id })
  if (typeof request.up_to !== 'boolean' || typeof request.skip_sync !== 'boolean') {
    throw new TypeError('RGB output up_to and skip_sync must be booleans')
  }
  for (const [field, max] of [['num', 255], ['size', 4294967295]]) {
    const value = request[field]
    if (value != null && (!Number.isInteger(value) || value < 1 || value > max)) {
      throw new RangeError(`RGB output ${field} must be a positive ${field === 'num' ? '8' : '32'}-bit integer`)
    }
  }
  const fee = request.fee_rate
  checkedNumber(fee)
  if (!((typeof fee === 'number' && Number.isSafeInteger(fee) && fee > 0) ||
      (typeof fee === 'string' && /^[1-9][0-9]*$/.test(fee))) || BigInt(fee) > 18446744073709551615n) {
    throw new RangeError('RGB output fee_rate must be an exact positive 64-bit integer')
  }
  return stringifyLossless({ ...request, fee_rate: new LosslessNumber(String(fee)) })
}

module.exports = { createUtxosOperationRequest, bip322Request, parse, stringify, paymentRequest, burnRequest, sendRgbInvoiceRequest, unsupported, UnsupportedCapabilityError }
