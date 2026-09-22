'use strict'

// @utexo/rgb-lightning-node-nodejs — Node façade for the rgb-lightning-node C-FFI.
//
// 1. Platform-detect + load the matching .node prebuild.
// 2. Wrap the raw napi classes with the JSON-stringify/parse marshalling
//    layer so the surface matches @utexo/rgb-lightning-node-bare's index.js
//    1:1 — consumers can pass plain JS objects and get plain JS objects
//    back. This is what lets @utexo/wdk-rgb-lightning's `bare-binding.js`
//    and `node-binding.js` be structurally identical.

const os = require('os')
const path = require('path')
const fs = require('fs')
const { parse, stringify, paymentRequest, unsupported, UnsupportedCapabilityError } = require('./json-boundary')

// ─── 1. Native addon resolution ──────────────────────────────────────────

const platform = os.platform()
const arch = os.arch()

function resolvePlatformSuffix () {
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64'
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64'
  if (platform === 'linux' && arch === 'x64') {
    return process.report?.getReport().header.glibcVersionRuntime ? 'linux-x64-gnu' : 'linux-x64-musl'
  }
  if (platform === 'linux' && arch === 'arm64' && process.report?.getReport().header.glibcVersionRuntime) return 'linux-arm64-gnu'
  return null
}

const suffix = resolvePlatformSuffix()
if (!suffix) {
  throw new Error(
    `[@utexo/rgb-lightning-node-nodejs] Unsupported platform: ${platform}-${arch}. ` +
    'Supported: darwin-arm64, darwin-x64, linux-x64-gnu, linux-x64-musl, linux-arm64-gnu.'
  )
}

const addonPath = path.join(__dirname, `index-${suffix}.node`)
if (!fs.existsSync(addonPath)) {
  throw new Error(
    `[@utexo/rgb-lightning-node-nodejs] Native addon not found at ${addonPath}. ` +
    'If postinstall was skipped (npm install --ignore-scripts), run ' +
    '`npm run build` with the documented Rust/platform toolchain installed.'
  )
}

const napi = require(addonPath)
const { readConfig, identity } = require('./scripts/install-overlay-addon')
const expectedIdentity = identity(readConfig())
const runtimeInfo = parse(napi.getRuntimeInfo())
for (const [key, expected] of Object.entries({
  abi_version: 1,
  rln_commit: expectedIdentity.commit,
  lightning_commit: expectedIdentity.lightningCommit,
  adapter_sha256: expectedIdentity.patchSha256,
  wrapper_sha256: expectedIdentity.wrapperSha256,
  lock_sha256: expectedIdentity.lockSha256,
  target: expectedIdentity.target
})) {
  if (runtimeInfo[key] !== expected) throw new Error(`Native artifact identity mismatch: ${key}; rebuild the package`)
}
Object.freeze(runtimeInfo.capabilities)
Object.freeze(runtimeInfo)

// ─── 2. SdkNode wrapper ─────────────────────────────────────────────────

class SdkNode {
  constructor (inner) {
    this._inner = inner
    this._closed = false
  }

  static create (request) {
    return new SdkNode(napi.SdkNode.create(stringify(request)))
  }

  // External-signer lifecycle (matches bare addon)
  initWithNativeExternalSigner (signer) {
    this._inner.initWithNativeExternalSigner(signer._inner)
  }
  attachNativeExternalSigner (signer) {
    this._inner.attachNativeExternalSigner(signer._inner)
  }
  unlockWithNativeExternalSigner (signer, request) {
    this._inner.unlockWithNativeExternalSigner(signer._inner, stringify(request))
  }
  startUnlockWithNativeExternalSigner (signer, request) { unsupported('startUnlockWithNativeExternalSigner') }
  nativeOperationStatus (operationId) { unsupported('nativeOperationStatus') }
  adoptNativeOperation (operationId) { unsupported('adoptNativeOperation') }
  cancelNativeOperation (operationId) { unsupported('cancelNativeOperation') }
  initWithExternalSigner (bootstrap) {
    this._inner.initWithExternalSigner(stringify(bootstrap))
  }
  detachExternalSigner () { this._inner.detachExternalSigner() }
  unlockWithAttachedExternalSigner (request) {
    this._inner.unlockWithAttachedExternalSigner(stringify(request))
  }

  shutdown () {
    if (this._closed) return
    this._inner.shutdown()
    this._inner = null
    this._closed = true
  }

  // Forces takeover of a stale VSS ownership fence after a previous node
  // died holding it. Throws if VSS isn't configured. Pointing two live
  // nodes at the same VSS store corrupts state — call only when certain
  // the previous owner is gone.
  vssClearFence (request) { this._inner.vssClearFence(stringify(request)) }

  // Force an immediate VSS backup flush. Returns `{ version }` where
  // version is the snapshot index just persisted. Throws if VSS isn't
  // configured / the flush fails. Backed by upstream vss_backup() PR.
  vssBackup () { return parse(this._inner.vssBackup()) }

  vssDeleteAll (request) { unsupported('vssDeleteAll') }

  // APay receiver-side: register this node with an LSP as an async-order
  // recipient. Pass the LSP's node_id (hex). Returns the parsed
  // AsyncOrderNewResponse (request_id, host_node_id, protocol_version,
  // order_id, status, accepted_through_index, next_index_expected,
  // unused_hashes, refill_batch_size, first_hash_index).
  apayNew (hostNodeId) { return parse(this._inner.apayNew(hostNodeId)) }

  // Register the APay hash batch and bind a signed username@domain
  // attestation to the wallet node identity.
  apayNewWithAddress (hostNodeId, username, domain) {
    return parse(this._inner.apayNewWithAddress(hostNodeId, username, domain))
  }

  // Info / network / sync
  nodeInfo () { return parse(this._inner.nodeInfo()) }
  networkInfo () { return parse(this._inner.networkInfo()) }
  sync () { return parse(this._inner.sync()) }
  syncWallet (request) { unsupported('syncWallet') }
  walletSnapshot (request = {}) { unsupported('walletSnapshot') }
  rotateAddress () { return parse(this._inner.rotateAddress()) }

  // Peers / channels
  // C-FFI's `rln_connect_peer` takes the raw pubkey@addr string (not a
  // JSON envelope) — matches @utexo/rgb-lightning-node-bare/index.js.
  connectPeer (peerPubkeyAndAddr) {
    return parse(this._inner.connectPeer(peerPubkeyAndAddr))
  }
  disconnectPeer (request) {
    return parse(this._inner.disconnectPeer(stringify(request)))
  }
  listPeers () { return parse(this._inner.listPeers()) }
  openChannel (request) {
    return parse(this._inner.openChannel(stringify(request)))
  }
  closeChannel (request) {
    return parse(this._inner.closeChannel(stringify(request)))
  }
  listChannels () { return parse(this._inner.listChannels()) }
  getChannelId (temporaryChannelIdHex) {
    return parse(this._inner.getChannelId(temporaryChannelIdHex))
  }

  // BTC + UTXOs
  getAddress () { return parse(this._inner.getAddress()) }
  // Alias to match bare addon's `address()` method name; both work.
  address () { return parse(this._inner.getAddress()) }
  btcBalance (skipSync = false) {
    return parse(this._inner.getBtcBalance(!!skipSync))
  }
  listUnspents (skipSync = false) {
    return parse(this._inner.listUnspents(!!skipSync))
  }
  listTransactions (skipSync = false) {
    return parse(this._inner.listTransactions(!!skipSync))
  }
  listTransactionsByTxid (txid, skipSync = false) {
    return parse(this._inner.listTransactionsByTxid(txid, !!skipSync))
  }
  sendBtc (request) {
    return parse(this._inner.sendBtc(stringify(request)))
  }

  prepareBtcSend (request) { unsupported('prepareBtcSend') }

  commitPreparedBtcSend (request) { unsupported('commitPreparedBtcSend') }

  cancelBtcSendPlan (request) { unsupported('cancelBtcSendPlan') }

  prepareCreateUtxos (request) { unsupported('prepareCreateUtxos') }

  commitPreparedCreateUtxos (request) { unsupported('commitPreparedCreateUtxos') }

  cancelCreateUtxosPlan (request) { unsupported('cancelCreateUtxosPlan') }

  listPendingVanillaTransactions () { unsupported('listPendingVanillaTransactions') }

  listAddressReceipts (address) { unsupported('listAddressReceipts') }

  createUtxos (request) {
    return parse(this._inner.createUtxos(stringify(request)))
  }
  // blocks: 1..=65535 — sat/vB fee rate target
  estimateFee (blocks) {
    if (!Number.isInteger(blocks) || blocks < 1 || blocks > 0xffff) throw new RangeError('blocks must be a positive u16')
    return parse(this._inner.estimateFee(blocks))
  }

  // Lightning invoices / payments
  lnInvoice (request) {
    return parse(this._inner.lnInvoice(stringify(request)))
  }
  decodeLnInvoice (invoice) {
    // C-FFI expects the raw BOLT11 string (matches bare addon).
    return parse(this._inner.decodeLnInvoice(invoice))
  }
  invoiceStatus (invoice) {
    return parse(this._inner.invoiceStatus(invoice))
  }
  cancelHodlInvoice (request) {
    return parse(this._inner.cancelHodlInvoice(stringify(request)))
  }
  claimHodlInvoice (request) {
    return parse(this._inner.claimHodlInvoice(stringify(request)))
  }
  sendPayment (request) {
    return parse(this._inner.sendPayment(paymentRequest(request)))
  }
  keysend (request) {
    return parse(this._inner.keysend(stringify(request)))
  }
  listPayments () { return parse(this._inner.listPayments()) }
  getPayment (paymentHashHex, paymentType) {
    return parse(this._inner.getPayment(paymentHashHex, paymentType))
  }

  // Atomic swaps (parity with bare addon; WDK does not surface these)
  makerInit (request) {
    return parse(this._inner.makerInit(stringify(request)))
  }
  makerExecute (request) {
    return parse(this._inner.makerExecute(stringify(request)))
  }
  taker (request) {
    return parse(this._inner.taker(stringify(request)))
  }
  listSwaps () { return parse(this._inner.listSwaps()) }
  getSwap (paymentHash, takerFlag) {
    return parse(this._inner.getSwap(paymentHash, !!takerFlag))
  }

  // RGB assets — issuance
  issueAssetNia (request) {
    return parse(this._inner.issueAssetNia(stringify(request)))
  }
  issueAssetUda (request) {
    return parse(this._inner.issueAssetUda(stringify(request)))
  }
  issueAssetCfa (request) {
    return parse(this._inner.issueAssetCfa(stringify(request)))
  }
  issueAssetIfa (request) {
    return parse(this._inner.issueAssetIfa(stringify(request)))
  }

  // RGB assets — listing / metadata / balance
  listAssets (filterAssetSchemas) {
    return parse(this._inner.listAssets(stringify(filterAssetSchemas ?? [])))
  }
  assetBalance (assetId) {
    return parse(this._inner.getAssetBalance(assetId))
  }
  assetLinkCreate (request) {
    return parse(this._inner.assetLinkCreate(stringify(request)))
  }
  assetMetadata (assetId) {
    return parse(this._inner.assetMetadata(assetId))
  }

  // RGB invoices / transfers
  rgbInvoice (request) {
    return parse(this._inner.rgbInvoice(stringify(request)))
  }
  decodeRgbInvoice (invoice) {
    return parse(this._inner.decodeRgbInvoice(invoice))
  }
  sendRgb (request) {
    return parse(this._inner.sendRgb(stringify(request)))
  }

  importRgbTransferConsignment (request) { unsupported('importRgbTransferConsignment') }

  importRgbContract (request) { unsupported('importRgbContract') }

  prepareRgbSend (request) { unsupported('prepareRgbSend') }

  commitPreparedRgbSend (request) { unsupported('commitPreparedRgbSend') }
  cancelRgbSendPlan (request) { unsupported('cancelRgbSendPlan') }
  listPendingRgbSendPlans () { unsupported('listPendingRgbSendPlans') }
  refreshTransfers (request) {
    return parse(this._inner.refreshTransfers(stringify(request)))
    return { ok: true }
  }
  failTransfers (request) {
    return parse(this._inner.failTransfers(stringify(request)))
  }
  inflate (request) {
    return parse(this._inner.inflate(stringify(request)))
  }
  listTransfers (assetId, txid) {
    if (assetId && typeof assetId === 'object') {
      return parse(this._inner.listTransfers(assetId.asset_id ?? null, assetId.txid ?? null))
    }
    return parse(this._inner.listTransfers(assetId ?? null, txid ?? null))
  }
  listTransfersByTxid (txid) {
    return parse(this._inner.listTransfersByTxid(txid))
  }

  // RGB asset media
  getAssetMedia (digest) {
    return parse(this._inner.getAssetMedia(digest))
  }
  postAssetMedia (request) {
    return parse(this._inner.postAssetMedia(stringify(request)))
  }

  // Signing / onion / diagnostics
  signMessage (message) {
    return parse(this._inner.signMessage(message))
  }
  verifyMessage (message, signature) {
    return parse(this._inner.verifyMessage(message, signature))
  }
  sendOnionMessage (request) {
    return parse(this._inner.sendOnionMessage(stringify(request)))
  }
  checkIndexerUrl (indexerUrl) {
    return parse(this._inner.checkIndexerUrl(indexerUrl))
  }
  checkProxyEndpoint (proxyEndpoint) {
    return parse(this._inner.checkProxyEndpoint(proxyEndpoint))
  }
}

// ─── 3. NativeExternalSigner wrapper ────────────────────────────────────

class NativeExternalSigner {
  constructor (inner) {
    this._inner = inner
    this._destroyed = false
  }

  static create (seedHex, network, permissivePolicy = false) {
    if (typeof permissivePolicy !== 'boolean') throw new TypeError('permissivePolicy must be boolean')
    if (typeof seedHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(seedHex)) {
      throw new Error('NativeExternalSigner.create: seedHex must be a 64-char hex string')
    }
    return new NativeExternalSigner(
      napi.NativeExternalSigner.create(seedHex, network, !!permissivePolicy)
    )
  }

  static createWithStorage (seedHex, network, storageDirPath, permissivePolicy = false) {
    if (typeof permissivePolicy !== 'boolean') throw new TypeError('permissivePolicy must be boolean')
    if (typeof seedHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(seedHex)) {
      throw new Error('NativeExternalSigner.createWithStorage: seedHex must be a 64-char hex string')
    }
    if (typeof storageDirPath !== 'string' || storageDirPath.length === 0) {
      throw new Error('NativeExternalSigner.createWithStorage: storageDirPath is required')
    }
    return new NativeExternalSigner(
      napi.NativeExternalSigner.createWithStorage(
        seedHex,
        network,
        storageDirPath,
        !!permissivePolicy
      )
    )
  }

  bootstrap () {
    if (this._destroyed) throw new Error('NativeExternalSigner already destroyed')
    return parse(this._inner.bootstrap())
  }

  destroy () {
    if (this._destroyed) return
    this._inner.destroy()
    this._destroyed = true
  }
}

// ─── 4. Module-level helpers (parity with bare addon, no-ops for now) ───

// Module-level helpers forward the released C-FFI behavior.

exports.SdkNode = SdkNode
exports.NativeExternalSigner = NativeExternalSigner
exports.UnsupportedCapabilityError = UnsupportedCapabilityError
exports.getRuntimeInfo = () => runtimeInfo
exports.uniffiHealthcheck = () => napi.uniffiHealthcheck()
exports.uniffiIsInitialized = () => parse(napi.uniffiIsInitialized())
exports.sdkInitialize = (request) => napi.sdkInitialize(stringify(request))
exports.sdkShutdown = () => napi.sdkShutdown()
