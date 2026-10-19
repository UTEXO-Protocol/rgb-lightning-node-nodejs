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

module.exports = { bip322Request, parse, stringify, paymentRequest, burnRequest, unsupported, UnsupportedCapabilityError }
