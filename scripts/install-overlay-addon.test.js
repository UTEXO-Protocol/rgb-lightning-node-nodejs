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

test('adapter changes only reviewed C-FFI and lifecycle files', () => {
  const patch = fs.readFileSync(readConfig().patchPath, 'utf8')
  const files = [...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)]
  assert.equal(files.length, ALLOWED_FILES.length)
  for (const [, a, b] of files) {
    assert.equal(a, b)
    assert.ok(ALLOWED_FILES.includes(a), a)
  }
  for (const forbidden of ['src/persistence/', 'rust-lightning/']) {
    assert.ok(!files.some(([, file]) => file.startsWith(forbidden)), forbidden)
  }
})

test('BIP-322 signer attachment only adds a revocable native signer handle', () => {
  const patch = fs.readFileSync(readConfig().patchPath, 'utf8')
  const section = patch.split('diff --git a/src/signer/external.rs b/src/signer/external.rs\n')[1].split('\ndiff --git ')[0]
  const added = section.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'))
  assert.deepEqual(added, [
    '+    #[cfg(all(feature = "uniffi", feature = "vls"))]',
    '+    pub(crate) message_signer: Option<Arc<crate::uniffi_api::NativeExternalSigner>>,',
  ])
})

test('adapter contains binding repairs without a core import backport', () => {
  const patch = fs.readFileSync(readConfig().patchPath, 'utf8')
  for (const symbol of ['rln_native_external_signer_new_with_storage', 'rln_sdk_node_apay_new_with_address',
    'rln_binding_build_info', 'min_final_cltv_expiry_delta', 'JsonDecodedRgbAssignment']) assert.ok(patch.includes(symbol))
  for (const symbol of ['rln_wallet_snapshot', 'rln_prepare_btc_send', 'native_operations.rs']) assert.ok(!patch.includes(symbol))
  assert.match(patch, /diff --git a\/src\/uniffi_api\/native_signer.rs/)
  assert.match(patch, /native-signer-shutdown-v1/)
  assert.match(patch, /owned-session-cleanup-v1/)
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

test('wrapper lock uses the pinned BFA library and path transaction sync', () => {
  const lock = fs.readFileSync(path.join(__dirname, '..', 'Cargo.lock'), 'utf8')
  assert.match(lock, /rgb-lib-bfa\.git\?rev=962730a211f0f7569d7ad8ae777052f433d87655#962730a211f0f7569d7ad8ae777052f433d87655/)
  assert.doesNotMatch(lock, /rgb-lib\.git\?|rgb-(?:consensus|ops|schemas)-s-bfa|95332c41|94b6221|dcorral/)
  const sync = lock.split('[[package]]').find(block => block.includes('name = "lightning-transaction-sync"'))
  assert.ok(sync)
  assert.ok(!sync.includes('source ='))
})
