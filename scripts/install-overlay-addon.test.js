'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
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
    '59d5d7c77a6563934d571ff36b0564c7e44b24f68ce07b305fe6c535ab1f50d1'
  )
  assert.equal(config.rustToolchain, '1.88.0')
})

test('overlay contains the complete native operation registry source', () => {
  const config = readConfig()
  const patch = fs.readFileSync(path.resolve(config.patchPath), 'utf8')

  assert.match(
    patch,
    /diff --git a\/bindings\/c-ffi\/src\/native_operations\.rs b\/bindings\/c-ffi\/src\/native_operations\.rs/
  )
  assert.match(patch, /new file mode 100644/)
  assert.match(patch, /pub\(crate\) fn start_unlock\(/)
  assert.match(patch, /pub\(crate\) fn status\(/)
  assert.match(patch, /pub\(crate\) fn adopt\(/)
  assert.match(patch, /pub\(crate\) fn cancel\(/)
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
