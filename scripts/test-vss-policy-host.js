/* global Bare */
'use strict'
// rgb-lib-bfa requires fresh addresses; address reuse is explicitly unsupported.
const bare = typeof Bare !== 'undefined'
const fs = require(bare ? 'bare-fs' : 'node:fs')
const os = require(bare ? 'bare-os' : 'node:os')
const path = require(bare ? 'bare-path' : 'node:path')
const api = require('../index')
const env = name => bare ? os.getEnv(name) : process.env[name]
const endpoint = env('RLN_VSS_TEST_URL')
if (!endpoint) throw new Error('Set RLN_VSS_TEST_URL for the disposable policy qualification')
const network = env('RLN_VSS_TEST_NETWORK') || 'regtest'
const failFile = env('RLN_VSS_FAIL_FILE')
const indexer = env('RLN_VSS_TEST_INDEXER') || 'http://127.0.0.1:18094'
const proxy = env('RLN_VSS_TEST_PROXY') || 'rpc://127.0.0.1:28090/json-rpc'
const eth = env('RLN_VSS_TEST_ETH') || 'http://127.0.0.1:18555'
const assert = (value, message) => { if (!value) throw new Error(message) }
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utexo-vss-policy-'))
fs.chmodSync(root, 0o700)
const bytes = Buffer.alloc(32)
const fd = fs.openSync('/dev/urandom', 'r')
fs.readSync(fd, bytes, 0, bytes.length, null); fs.closeSync(fd)
const seed = bytes.toString('hex'); bytes.fill(0)
let node, signer
const timings = []
let fundedQualified = false
let syntheticClockReceiptQualified = false
const config = { storage_dir_path: path.join(root, 'wallet'), network, daemon_listening_port: 0,
  ldk_peer_listening_port: 0, max_media_upload_size_mb: 5, enable_virtual_channels_v0: false,
  reuse_addresses: false, vss_url: endpoint, vss_allow_http: false, vss_allow_empty_restore: false }
const unlock = { ldk_chain_sync: { mode: 'TransactionSync', config: { indexer_url: indexer } },
  indexer_url: indexer, proxy_endpoint: proxy, eth_rpc_url: eth, announce_addresses: [] }
function open (initialize, override) {
  signer = api.NativeExternalSigner.createWithStorage(seed, network, path.join(root, 'signer'))
  node = api.SdkNode.create({ ...config, ...(override === undefined ? {} : { vss_automatic_backup_enabled: override }) })
  if (initialize) node.initWithNativeExternalSigner(signer)
  node.unlockWithNativeExternalSigner(signer, unlock)
}
function close () { if (node) { node.shutdown(); node = undefined }; if (signer) { signer.shutdown(); signer.destroy(); signer = undefined } }
function metadata () { return node.vssBackupMetadata() }
function status () { return node.vssBackupInfo() }
function currentVersion () { return Number(status().version) }
function timed (name, action) { const before = Date.now(); const result = action(); timings.push({ name, milliseconds: Date.now() - before }); return result }
function assertReceipt (before, after) {
  const meta = metadata(); const remote = status()
  assert(meta.schema_version === 1, 'Unknown metadata schema')
  assert(meta.last_backup && Number(meta.last_backup.version) === Number(remote.version), 'Receipt version is not the remote snapshot version')
  assert(meta.last_backup.completed_at_ms >= before && meta.last_backup.completed_at_ms <= after, 'Completion time is not bounded by the actual acknowledged upload')
  assert(meta.last_backup.network === network && meta.last_backup.vss_url === endpoint && meta.last_backup.node_id === signer.bootstrap().node_id, 'Completion receipt scope mismatch')
  assert(!remote.backup_required && !remote.last_auto_backup_failed, 'Acknowledged snapshot did not clear dirty/failure status')
  return meta.last_backup
}
try {
  // A caller may explicitly initialize a new local scope off. It must not
  // briefly enable SDK startup snapshots before applying that preference.
  const initialBytes = Buffer.alloc(32), initialFd = fs.openSync('/dev/urandom', 'r')
  fs.readSync(initialFd, initialBytes, 0, initialBytes.length, null); fs.closeSync(initialFd)
  signer = api.NativeExternalSigner.createWithStorage(initialBytes.toString('hex'), network, path.join(root, 'initial-off-signer'))
  initialBytes.fill(0)
  node = api.SdkNode.create({ ...config, storage_dir_path: path.join(root, 'initial-off-wallet'), vss_automatic_backup_enabled: false })
  node.initWithNativeExternalSigner(signer); node.unlockWithNativeExternalSigner(signer, unlock)
  assert(metadata().automatic_backup_enabled === false && metadata().last_backup === null, 'Explicit initial off was not applied before wallet startup')
  assert(status().backup_exists === false, 'Explicit initial off uploaded an initial archive')
  close()
  const beforeOpen = Date.now(); timed('initial-open', () => open(true)); const initialReceipt = assertReceipt(beforeOpen, Date.now())
  assert(metadata().automatic_backup_enabled === true, 'A fresh wallet is not automatic-on by default')
  const initial = currentVersion()
  const signingAddress = node.getMessageSigningAddress()
  const signature = node.signMessageBip322('VSS policy read-only proof', signingAddress)
  assert(node.verifyMessageBip322('VSS policy read-only proof', signingAddress, signature), 'BIP-322 proof failed while VSS configured')
  for (let i = 0; i < 3; i++) { metadata(); status(); node.btcBalance(true); node.listTransactions(true); node.listAssets() }
  assert(currentVersion() === initial, 'Pure read/status/metadata caused an upload')
  assert(metadata().last_backup.completed_at_ms === initialReceipt.completed_at_ms, 'Observation manufactured a newer timestamp')
  // Polling benchmark: a full syncing read can change chain state; record its
  // actual cost/version effects so the app integration can enforce its budget.
  const pollBefore = currentVersion()
  timed('btc-balance-sync-1', () => node.btcBalance(false))
  timed('btc-balance-sync-2', () => node.btcBalance(false))
  const pollAfter = currentVersion()
  assert(pollAfter === pollBefore, "Unchanged syncing polls uploaded redundant archives")
  assert(metadata().last_backup.completed_at_ms === initialReceipt.completed_at_ms, "Unchanged syncing polls changed actual backup time")
  console.log(JSON.stringify({ nativeVssPollingProbe: true, runtime: bare ? "bare" : "node", versionIncrease: pollAfter - pollBefore, timings: timings.filter(row => row.name.startsWith("btc-balance-sync")) }))
  timed('pause', () => node.setVssAutomaticBackupEnabled(false))
  const pausedVersion = currentVersion()
  assert(metadata().automatic_backup_enabled === false, 'Pause acknowledgement was not reflected')
  node.rotateAddress(); node.rotateAddress()
  assert(currentVersion() === pausedVersion, 'Paused mutations still uploaded a snapshot')
  assert(status().backup_required, 'Paused changes were not marked backup needed')
  const beforeManual = Date.now(); timed('manual-while-off', () => node.vssBackup()); const manualReceipt = assertReceipt(beforeManual, Date.now())
  assert(metadata().automatic_backup_enabled === false, 'Manual backup changed automatic preference')
  const manualVersion = currentVersion()
  if (env('RLN_VSS_TEST_CLOCK_RECEIPT') === '1') {
    // Synthetic owned-fixture data reproduces a corrected device clock. It is
    // not presented as a confirmed upload time and is restored before any
    // subsequent wallet mutation or actual backup assertion.
    const files = fs.readdirSync(config.storage_dir_path).filter(name => name.startsWith('.utexo-vss-policy-v1-') && name.endsWith('.completion.json'))
    assert(files.length === 1, 'Expected one owned completion receipt')
    const receiptPath = path.join(config.storage_dir_path, files[0])
    const original = fs.readFileSync(receiptPath)
    const syntheticTime = Date.now() + 3600000
    try {
      fs.writeFileSync(receiptPath, JSON.stringify({ ...JSON.parse(original.toString()), completed_at_ms: syntheticTime }))
      assert(metadata().automatic_backup_enabled === false && metadata().last_backup.completed_at_ms === syntheticTime,
        'Clock rollback made the native policy unreadable or changed its receipt')
      assert(currentVersion() === manualVersion, 'Reading a synthetic future receipt uploaded a snapshot')
      close(); timed('reopen-with-synthetic-clock-receipt', () => open(false, true))
      assert(metadata().automatic_backup_enabled === false && metadata().last_backup.completed_at_ms === syntheticTime,
        'Cold reopen after clock rollback lost the saved choice or actual stored time')
      assert(currentVersion() === manualVersion, 'Paused clock-rollback reopen uploaded a snapshot')
      syntheticClockReceiptQualified = true
    } finally {
      fs.writeFileSync(receiptPath, original)
    }
    assert(metadata().last_backup.completed_at_ms === manualReceipt.completed_at_ms,
      'Owned synthetic receipt was not restored to its actual upload time')
  }
  close(); timed('reopen-paused', () => open(false, true))
  assert(metadata().automatic_backup_enabled === false, 'Explicit initial true overrode saved off')
  assert(currentVersion() === manualVersion, 'Paused startup silently uploaded')
  assert(metadata().last_backup.completed_at_ms === manualReceipt.completed_at_ms, 'Reopen changed receipt time')
  node.rotateAddress()
  assert(currentVersion() === manualVersion && status().backup_required, 'Paused reopen mutation did not remain local')
  let failureRollback = false
  if (failFile) {
    fs.writeFileSync(failFile, 'fail')
    let failed = false
    try { node.setVssAutomaticBackupEnabled(true) } catch { failed = true }
    assert(failed && metadata().automatic_backup_enabled === false, 'Failed catch-up enabled automatic backup')
    assert(metadata().last_backup.completed_at_ms === manualReceipt.completed_at_ms, 'Failed upload manufactured a completion time')
    fs.unlinkSync(failFile)
    assert(currentVersion() === manualVersion, 'Rejected upload changed remote snapshot')
    failureRollback = true
  }
  const beforeResume = Date.now(); timed('resume-catch-up', () => node.setVssAutomaticBackupEnabled(true)); assertReceipt(beforeResume, Date.now())
  assert(metadata().automatic_backup_enabled === true && currentVersion() > manualVersion, 'Resume did not catch up pending state')
  const resumedVersion = currentVersion()
  const beforeAuto = Date.now(); timed('automatic-address-change', () => node.rotateAddress()); assertReceipt(beforeAuto, Date.now())
  assert(currentVersion() > resumedVersion, 'Enabled mutation did not automatically checkpoint')
  const stable = currentVersion(); const stableAt = metadata().last_backup.completed_at_ms
  node.setVssAutomaticBackupEnabled(true)
  assert(currentVersion() === stable && metadata().last_backup.completed_at_ms === stableAt, 'Idempotent enabled policy uploaded again')
  if (env('RLN_VSS_TEST_FUNDING') === '1') {
    assert(!bare && network === 'regtest', 'Funding qualification is Node-only and regtest-only')
    const { execFileSync } = require('node:child_process')
    const rpc = (...args) => execFileSync('docker', ['exec', 'utexo_local-btc_regtest-1', 'bitcoin-cli', '-regtest', '-rpcuser=user', '-rpcpassword=default_password', '-rpcwallet=miner', ...args], { encoding: 'utf8' }).trim()
    const receive = node.address().address
    const fundingVersion = currentVersion()
    const mining = rpc('getnewaddress')
    rpc('sendtoaddress', receive, '0.001')
    rpc('generatetoaddress', '3', mining)
    const waitForIndexer = () => {
      const targetHeight = Number(rpc('getblockcount'))
      for (let attempt = 0; attempt < 60; attempt++) {
        const indexed = Number(execFileSync('curl', ['-fsS', indexer + '/blocks/tip/height'], { encoding: 'utf8' }))
        if (indexed >= targetHeight) return
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200)
      }
      throw new Error('Local indexer did not reach the newly mined block')
    }
    waitForIndexer()
    const beforeIncoming = Date.now()
    const balance = timed('funded-incoming-btc-sync', () => node.btcBalance(false))
    assert(Number(balance.vanilla.settled) >= 100000, 'Incoming BTC did not settle')
    assertReceipt(beforeIncoming, Date.now())
    assert(currentVersion() > fundingVersion, 'Actual incoming BTC sync did not update the snapshot')
    const fundedVersion = currentVersion(), fundedTime = metadata().last_backup.completed_at_ms
    timed('funded-unchanged-btc-sync', () => node.btcBalance(false))
    assert(currentVersion() === fundedVersion && metadata().last_backup.completed_at_ms === fundedTime, 'An unchanged funded sync uploaded again')
    const destination = rpc('getnewaddress')
    const beforeSend = Date.now()
    const sent = timed('funded-outgoing-btc', () => node.sendBtc({ address: destination, amount: 50000, fee_rate: 1, skip_sync: false }))
    assert(typeof sent.txid === 'string' && sent.txid.length === 64, 'Outgoing BTC returned no transaction')
    assertReceipt(beforeSend, Date.now())
    rpc('generatetoaddress', '3', mining)
    assert(Number(rpc('getreceivedbyaddress', destination, '1')) === 0.0005, 'Local stack did not receive the outgoing BTC')
    waitForIndexer()
    const beforeConfirmed = Date.now()
    timed('outgoing-btc-confirmation-sync', () => node.btcBalance(false))
    assertReceipt(beforeConfirmed, Date.now())
    fundedQualified = true
  }
  console.log(JSON.stringify({ vssPolicyQualification: 'pass', runtime: bare ? 'bare' : 'node', network,
    defaultOn: true, pureReadsDoNotUpload: true, offPausesMutations: true, manualWhileOff: true,
    offPersistsAcrossReopen: true, initialConfigDoesNotOverrideSavedChoice: true,
    resumeCatchesUp: true, realCompletionReceipts: true, failureRollback,
    syncingPollVersionIncrease: pollAfter - pollBefore, timings, funded: fundedQualified, syntheticFutureReceiptReadAndColdReopen: syntheticClockReceiptQualified, bridgeAccessed: false }))
} finally { if (failFile && fs.existsSync(failFile)) fs.unlinkSync(failFile); close(); fs.rmSync(root, { recursive: true, force: true }) }
