'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { validateMachOLinkedit } = require('./macho-linkedit')

const { fixture } = require('./macho-linkedit-fixture')

test('Darwin addons require dyld-compatible LINKEDIT alignment on both architectures', () => {
  assert.equal(validateMachOLinkedit(fixture(), 'darwin-arm64').stringOffset, 88)
  assert.equal(validateMachOLinkedit(fixture(0x01000007), 'darwin-x64').stringOffset, 88)
  const unaligned = fixture()
  unaligned.writeUInt32LE(84, 48)
  assert.throws(() => validateMachOLinkedit(unaligned, 'darwin-arm64'), /Misaligned/)
})

test('Mach-O validation rejects wrong targets, architecture and malformed command/string bounds', () => {
  assert.throws(() => validateMachOLinkedit(fixture(), 'linux-x64-gnu'), /target/)
  assert.throws(() => validateMachOLinkedit(fixture(), 'darwin-x64'), /architecture/)
  assert.throws(() => validateMachOLinkedit(Buffer.alloc(4), 'darwin-arm64'), /Truncated/)
  for (const [offset, value] of [[0, 0], [16, 20], [20, 999], [36, 7], [40, 100], [48, 104], [52, 0], [32, 0]]) {
    const invalid = fixture()
    invalid.writeUInt32LE(value, offset)
    assert.throws(() => validateMachOLinkedit(invalid, 'darwin-arm64'))
  }
})

