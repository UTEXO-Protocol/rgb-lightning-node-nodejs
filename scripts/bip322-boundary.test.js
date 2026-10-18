const test = require('node:test')
const assert = require('node:assert/strict')
const { bip322Request } = require('../json-boundary')
test('BIP-322 preserves exact valid UTF-8, including empty and embedded NUL', () => {
  for (const message of ['', '  x\n', '😄', 'é', 'e\u0301', 'x\0y', 'a'.repeat(4096), '😄'.repeat(1024)]) {
    assert.equal(JSON.parse(bip322Request({ message, address: 'bcrt1ptest' })).message, message)
  }
})
test('BIP-322 rejects coercion, malformed Unicode and byte overflows', () => {
  for (const message of [null, undefined, 7, {}, { toJSON: () => 'hi' }, '\ud800', '\udc00', '\ud800x', '😄'.repeat(1025), 'a'.repeat(4097)]) {
    assert.throws(() => bip322Request({ message, address: 'test' }))
  }
  assert.throws(() => bip322Request({ message: 'x', address: 'a'.repeat(129) }))
  assert.throws(() => bip322Request({ message: 'x', address: 'a', signature: 'a'.repeat(4097) }))
})
