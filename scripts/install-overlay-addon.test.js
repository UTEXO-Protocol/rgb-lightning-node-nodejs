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
    '9d8a3e76a099422106e679cb704b0b76cf9758cc79c0948da997d1620eef985f'
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

test('overlay contains the hardened shared RGB import implementation', () => {
  const config = readConfig()
  const patch = fs.readFileSync(path.resolve(config.patchPath), 'utf8')

  assert.match(patch, /diff --git a\/src\/rgb_import\.rs b\/src\/rgb_import\.rs/)
  assert.match(patch, /MAX_RGB_IMPORT_BASE64_CHARACTERS/)
  assert.match(patch, /MAX_RGB_IMPORT_BODY_BYTES/)
  assert.match(patch, /RgbTxid::from_str/)
  assert.match(patch, /let task = tokio::spawn/)
  assert.match(patch, /save_new_asset\(consignment, offchain_txid\)\?;/)
  assert.match(patch, /b33aac2188c386a2addc8feb1a99663033c32c07/)
})

test('wrapper lockfile resolves the same hardened rgb-lib revision as the overlay', () => {
  const lockfile = fs.readFileSync(path.join(__dirname, '..', 'Cargo.lock'), 'utf8')

  assert.match(
    lockfile,
    /git\+https:\/\/github\.com\/UTEXO-Protocol\/rgb-lib\.git\?rev=b33aac2188c386a2addc8feb1a99663033c32c07#b33aac2188c386a2addc8feb1a99663033c32c07/
  )
  assert.doesNotMatch(
    lockfile,
    /git\+https:\/\/github\.com\/UTEXO-Protocol\/rgb-lib\.git\?tag=v0\.3\.0-beta\.27/
  )
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
