'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { identity, manifestMatches, readConfig } = require('./install-overlay-addon')
const { RELEASE, ALLOWED_FILES, validateAdapter } = require('./release-contract')

test('release metadata is exact and the adapter is checksum-bound', () => {
  const config = readConfig()
  for (const [key, value] of Object.entries(RELEASE)) assert.equal(config[key], value)
  validateAdapter(config)
  assert.throws(() => validateAdapter({ ...config, patchSha256: '0'.repeat(64) }), /checksum/)
  assert.throws(() => validateAdapter({ ...config, commit: '0'.repeat(40) }), /identity/)
})

test('adapter changes only the reviewed release/import files', () => {
  const patch = fs.readFileSync(readConfig().patchPath, 'utf8')
  const files = [...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)]
  assert.equal(files.length, ALLOWED_FILES.length)
  for (const [, a, b] of files) {
    assert.equal(a, b)
    assert.ok(ALLOWED_FILES.includes(a), a)
  }
  for (const forbidden of ['src/persistence/', 'src/signer/', 'src/ldk', 'rust-lightning/']) {
    assert.ok(!files.some(([, file]) => file.startsWith(forbidden)), forbidden)
  }
})

test('adapter includes only the approved import extension and released binding repairs', () => {
  const patch = fs.readFileSync(readConfig().patchPath, 'utf8')
  for (const symbol of ['rln_native_external_signer_new_with_storage', 'rln_sdk_node_apay_new_with_address',
    'rln_binding_build_info', 'min_final_cltv_expiry_delta', 'JsonDecodedRgbAssignment']) assert.ok(patch.includes(symbol))
  for (const symbol of ['rln_wallet_snapshot', 'rln_prepare_btc_send', 'native_operations.rs']) assert.ok(!patch.includes(symbol))
})

test('adapter preserves native blinded receive reservation counts', () => {
  const patch = fs.readFileSync(readConfig().patchPath, 'utf8')
  assert.match(patch, /\+\s+pub pending_blinded: u32/)
  assert.match(patch, /\+\s+pending_blinded: u\.pending_blinded/)
  assert.match(patch, /pending-blinded-v1/)
  assert.match(patch, /preserves_pending_blinded_reservations/)
})

test('manifest rejects wrong artifact, source, wrapper, lock and target identities', () => {
  const config = readConfig()
  const manifest = { ...identity(config), addonSha256: 'a'.repeat(64) }
  assert.equal(manifestMatches(config, manifest, 'a'.repeat(64)), true)
  for (const key of Object.keys(manifest)) {
    assert.equal(manifestMatches(config, { ...manifest, [key]: 'wrong' }, 'a'.repeat(64)), false, key)
  }
  assert.equal(manifestMatches(config, null, 'a'.repeat(64)), false)
})

test('wrapper lock uses the released RGB-lib and path transaction sync', () => {
  const lock = fs.readFileSync(path.join(__dirname, '..', 'Cargo.lock'), 'utf8')
  assert.match(lock, /rgb-lib\.git\?tag=v0\.3\.0-beta\.34#62a8c3a045901147b3b06aed9f1e61f345695dce/)
  assert.doesNotMatch(lock, /95332c41|94b6221|dcorral/)
  const sync = lock.split('[[package]]').find(block => block.includes('name = "lightning-transaction-sync"'))
  assert.ok(sync)
  assert.ok(!sync.includes('source ='))
})
