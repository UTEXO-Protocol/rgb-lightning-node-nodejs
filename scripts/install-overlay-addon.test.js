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
    'a1cd3fddfbc6b2eb572e537ca538a80c034d85a3e4d90cdf00e6ceceb56792d4'
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
  assert.match(patch, /load_or_create_writer_id/)
  assert.match(patch, /vss_same_installation_reclaims_fence_after_restart/)
  const joinTasks = patch.indexOf('for task in std::mem::take\(&mut handles.service_tasks\)')
  const disconnectPeers = patch.indexOf('handles.peer_manager.disconnect_all_peers\(\)')
  const waitForPersistence = patch.indexOf('BP_SHUTDOWN_FLUSH_TIMEOUT, &mut join_handle')
  assert.ok(joinTasks >= 0, 'overlay must join aborted service tasks')
  assert.ok(disconnectPeers > joinTasks, 'final peer disconnect must follow task quiescence')
  assert.ok(waitForPersistence > disconnectPeers, 'persistence flush must follow final disconnect')
})

test('overlay preserves wallet discovery, RGB payment identity, and inbound channel semantics', () => {
  const config = readConfig()
  const patch = fs.readFileSync(path.resolve(config.patchPath), 'utf8')

  assert.match(patch, /does not match the revealed wallet address/)
  assert.match(patch, /payment_info_persists_rgb_identity_with_its_payment_status/)
  assert.match(patch, /standard_inbound_channel_is_not_reclassified_when_virtual_support_is_enabled/)
  assert.match(patch, /INVOICE_EXPIRED/)
  assert.match(patch, /utexo-wallet-v3/)
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
