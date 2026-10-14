'use strict'

function fixture (cpu = 0x0100000c) {
  const data = Buffer.alloc(104)
  data.writeUInt32LE(0xfeedfacf, 0)
  data.writeUInt32LE(cpu, 4)
  data.writeUInt32LE(1, 16)
  data.writeUInt32LE(24, 20)
  data.writeUInt32LE(2, 32)
  data.writeUInt32LE(24, 36)
  data.writeUInt32LE(64, 40)
  data.writeUInt32LE(1, 44)
  data.writeUInt32LE(88, 48)
  data.writeUInt32LE(16, 52)
  return data
}

module.exports = { fixture }
