'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')

// All supported Darwin addons are thin, little-endian 64-bit Mach-O images.
// dyld on macOS 27 rejects the string pool emitted by older rust-objcopy when
// it is only 4-byte aligned. Check the layout even on older CI runtimes.
function validateMachOLinkedit (data, target) {
  const cpu = { 'darwin-arm64': 0x0100000c, 'darwin-x64': 0x01000007 }[target]
  assert.ok(cpu, 'Unsupported Mach-O target')
  assert.ok(Buffer.isBuffer(data) && data.length >= 32, 'Truncated Mach-O header')
  assert.equal(data.readUInt32LE(0), 0xfeedfacf, 'Expected thin 64-bit Mach-O')
  assert.equal(data.readUInt32LE(4), cpu, 'Wrong Mach-O architecture')
  const count = data.readUInt32LE(16)
  const end = 32 + data.readUInt32LE(20)
  assert.ok(end <= data.length && count <= (end - 32) / 8, 'Invalid Mach-O command bounds')
  let offset = 32
  let symbols = null
  for (let i = 0; i < count; i++) {
    assert.ok(offset + 8 <= end, 'Truncated Mach-O load command')
    const command = data.readUInt32LE(offset)
    const size = data.readUInt32LE(offset + 4)
    assert.ok(size >= 8 && size % 8 === 0 && offset + size <= end, 'Invalid Mach-O command size')
    if (command === 0x02) {
      assert.ok(symbols === null && size === 24, 'Invalid or duplicate Mach-O symbol table')
      const symbolOffset = data.readUInt32LE(offset + 8)
      const symbolCount = data.readUInt32LE(offset + 12)
      const stringOffset = data.readUInt32LE(offset + 16)
      const stringSize = data.readUInt32LE(offset + 20)
      assert.ok(symbolOffset >= end && symbolOffset + symbolCount * 16 <= data.length, 'Invalid Mach-O symbol bounds')
      assert.ok(stringSize > 0 && stringOffset >= end && stringOffset + stringSize <= data.length, 'Invalid Mach-O string bounds')
      assert.equal(stringOffset % 8, 0, 'Misaligned Mach-O LINKEDIT string pool; unsafe for macOS 27')
      symbols = { target, stringOffset, stringSize }
    }
    offset += size
  }
  assert.equal(offset, end, 'Unaccounted Mach-O load commands')
  assert.ok(symbols, 'Missing Mach-O symbol table')
  return symbols
}

function verifyMachOFile (file, target) {
  return validateMachOLinkedit(fs.readFileSync(file), target)
}

module.exports = { validateMachOLinkedit, verifyMachOFile }
