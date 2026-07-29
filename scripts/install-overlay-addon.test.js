'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  existingAddonMatches,
  identity,
  manifestMatches,
  readConfig
} = require('./install-overlay-addon')

test('package overlay metadata is exact and checksum-pinned', () => {
  const config = readConfig()

  assert.equal(config.commit, '0bfa66fa256a6c36f3737d5b6402eacea40c68fc')
  assert.equal(
    config.patchSha256,
    'dfdb28778d8ec54fbcbf8be5f1acee9a7b7b6749e792d7204ea5d987e00bbbb8'
  )
  assert.equal(config.rustToolchain, '1.88.0')
})

test('addon provenance rejects stale patch and tampered artifact identities', () => {
  const config = readConfig()
  const addonSha256 = 'a'.repeat(64)
  const manifest = {
    ...identity(config),
    addonSha256
  }

  assert.equal(manifestMatches(config, manifest, addonSha256), true)
  assert.equal(manifestMatches(config, {
    ...manifest,
    patchSha256: 'b'.repeat(64)
  }, addonSha256), false)
  assert.equal(manifestMatches(config, manifest, 'c'.repeat(64)), false)
})

test('the locally built addon matches its persisted provenance manifest', () => {
  assert.equal(existingAddonMatches(readConfig()), true)
})
