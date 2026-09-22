'use strict'

class UnsupportedCapabilityError extends Error {
  constructor (capability) {
    super(`${capability} is not supported by released RLN 0.13.0-beta.3`)
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
  return JSON.parse(text, (_, value) => checkedNumber(value))
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

module.exports = { parse, stringify, paymentRequest, unsupported, UnsupportedCapabilityError }
