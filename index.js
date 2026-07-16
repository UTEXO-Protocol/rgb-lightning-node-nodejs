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

// ─── 1. Native addon resolution ──────────────────────────────────────────

const platform = os.platform()
const arch = os.arch()

function resolvePlatformSuffix () {
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64'
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64'
  if (platform === 'linux' && arch === 'x64') {
    if (fs.existsSync('/etc/alpine-release')) return 'linux-x64-musl'
    return 'linux-x64-gnu'
  }
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64-gnu'
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
    '`bash scripts/download-libs.sh` manually or rebuild via `npm run build`.'
  )
}

const napi = require(addonPath)

// ─── 2. SdkNode wrapper ─────────────────────────────────────────────────

class SdkNode {
  constructor (inner) {
    this._inner = inner
    this._closed = false
  }

  static create (request) {
    return new SdkNode(napi.SdkNode.create(JSON.stringify(request)))
  }

  // External-signer lifecycle (matches bare addon)
  initWithNativeExternalSigner (signer) {
    this._inner.initWithNativeExternalSigner(signer._inner)
  }
  attachNativeExternalSigner (signer) {
    this._inner.attachNativeExternalSigner(signer._inner)
  }
  unlockWithNativeExternalSigner (signer, request) {
    this._inner.unlockWithNativeExternalSigner(signer._inner, JSON.stringify(request))
  }
  initWithExternalSigner (bootstrap) {
    this._inner.initWithExternalSigner(JSON.stringify(bootstrap))
  }
  detachExternalSigner () { this._inner.detachExternalSigner() }
  unlockWithAttachedExternalSigner (request) {
    this._inner.unlockWithAttachedExternalSigner(JSON.stringify(request))
  }

  shutdown () {
    if (this._closed) return
    this._inner.shutdown()
    this._closed = true
  }

  // Forces takeover of a stale VSS ownership fence after a previous node
  // died holding it. Throws if VSS isn't configured. Pointing two live
  // nodes at the same VSS store corrupts state — call only when certain
  // the previous owner is gone.
  vssClearFence (request) { this._inner.vssClearFence(JSON.stringify(request)) }

  // Force an immediate VSS backup flush. Returns `{ version }` where
  // version is the snapshot index just persisted. Throws if VSS isn't
  // configured / the flush fails. Backed by upstream vss_backup() PR.
  vssBackup () { return JSON.parse(this._inner.vssBackup()) }

  // APay receiver-side: register this node with an LSP as an async-order
  // recipient. Pass the LSP's node_id (hex). Returns the parsed
  // AsyncOrderNewResponse (request_id, host_node_id, protocol_version,
  // order_id, status, accepted_through_index, next_index_expected,
  // unused_hashes, refill_batch_size, first_hash_index).
  apayNew (hostNodeId) { return JSON.parse(this._inner.apayNew(hostNodeId)) }

  // Info / network / sync
  nodeInfo () { return JSON.parse(this._inner.nodeInfo()) }
  networkInfo () { return JSON.parse(this._inner.networkInfo()) }
  sync () { return JSON.parse(this._inner.sync()) }
  rotateAddress () { return JSON.parse(this._inner.rotateAddress()) }

  // Peers / channels
  // C-FFI's `rln_connect_peer` takes the raw pubkey@addr string (not a
  // JSON envelope) — matches @utexo/rgb-lightning-node-bare/index.js.
  connectPeer (peerPubkeyAndAddr) {
    return JSON.parse(this._inner.connectPeer(peerPubkeyAndAddr))
  }
  disconnectPeer (request) {
    return JSON.parse(this._inner.disconnectPeer(JSON.stringify(request)))
  }
  listPeers () { return JSON.parse(this._inner.listPeers()) }
  openChannel (request) {
    return JSON.parse(this._inner.openChannel(JSON.stringify(request)))
  }
  closeChannel (request) {
    return JSON.parse(this._inner.closeChannel(JSON.stringify(request)))
  }
  listChannels () { return JSON.parse(this._inner.listChannels()) }
  getChannelId (temporaryChannelIdHex) {
    return JSON.parse(this._inner.getChannelId(temporaryChannelIdHex))
  }

  // BTC + UTXOs
  getAddress () { return JSON.parse(this._inner.getAddress()) }
  // Alias to match bare addon's `address()` method name; both work.
  address () { return JSON.parse(this._inner.getAddress()) }
  btcBalance (skipSync = false) {
    return JSON.parse(this._inner.getBtcBalance(!!skipSync))
  }
  listUnspents (skipSync = false) {
    return JSON.parse(this._inner.listUnspents(!!skipSync))
  }
  listTransactions (skipSync = false) {
    return JSON.parse(this._inner.listTransactions(!!skipSync))
  }
  listTransactionsByTxid (txid, skipSync = false) {
    return JSON.parse(this._inner.listTransactionsByTxid(txid, !!skipSync))
  }
  sendBtc (request) {
    return JSON.parse(this._inner.sendBtc(JSON.stringify(request)))
  }
  createUtxos (request) {
    return JSON.parse(this._inner.createUtxos(JSON.stringify(request)))
  }
  // blocks: 1..=65535 — sat/vB fee rate target
  estimateFee (blocks) {
    return JSON.parse(this._inner.estimateFee(blocks >>> 0))
  }

  // Lightning invoices / payments
  lnInvoice (request) {
    return JSON.parse(this._inner.lnInvoice(JSON.stringify(request)))
  }
  decodeLnInvoice (invoice) {
    // C-FFI expects the raw BOLT11 string (matches bare addon).
    return JSON.parse(this._inner.decodeLnInvoice(invoice))
  }
  invoiceStatus (invoice) {
    return JSON.parse(this._inner.invoiceStatus(invoice))
  }
  cancelHodlInvoice (request) {
    return JSON.parse(this._inner.cancelHodlInvoice(JSON.stringify(request)))
  }
  claimHodlInvoice (request) {
    return JSON.parse(this._inner.claimHodlInvoice(JSON.stringify(request)))
  }
  sendPayment (request) {
    return JSON.parse(this._inner.sendPayment(JSON.stringify(request)))
  }
  keysend (request) {
    return JSON.parse(this._inner.keysend(JSON.stringify(request)))
  }
  listPayments () { return JSON.parse(this._inner.listPayments()) }
  getPayment (paymentHashHex, paymentType) {
    return JSON.parse(this._inner.getPayment(paymentHashHex, paymentType))
  }

  // Atomic swaps (parity with bare addon; WDK does not surface these)
  makerInit (request) {
    return JSON.parse(this._inner.makerInit(JSON.stringify(request)))
  }
  makerExecute (request) {
    return JSON.parse(this._inner.makerExecute(JSON.stringify(request)))
  }
  taker (request) {
    return JSON.parse(this._inner.taker(JSON.stringify(request)))
  }
  listSwaps () { return JSON.parse(this._inner.listSwaps()) }
  getSwap (paymentHash, takerFlag) {
    return JSON.parse(this._inner.getSwap(paymentHash, !!takerFlag))
  }

  // RGB assets — issuance
  issueAssetNia (request) {
    return JSON.parse(this._inner.issueAssetNia(JSON.stringify(request)))
  }
  issueAssetUda (request) {
    return JSON.parse(this._inner.issueAssetUda(JSON.stringify(request)))
  }
  issueAssetCfa (request) {
    return JSON.parse(this._inner.issueAssetCfa(JSON.stringify(request)))
  }
  issueAssetIfa (request) {
    return JSON.parse(this._inner.issueAssetIfa(JSON.stringify(request)))
  }

  // RGB assets — listing / metadata / balance
  listAssets (filterAssetSchemas) {
    return JSON.parse(this._inner.listAssets(JSON.stringify(filterAssetSchemas ?? [])))
  }
  assetBalance (assetId) {
    return JSON.parse(this._inner.getAssetBalance(assetId))
  }
  assetMetadata (assetId) {
    return JSON.parse(this._inner.assetMetadata(assetId))
  }

  // RGB invoices / transfers
  rgbInvoice (request) {
    return JSON.parse(this._inner.rgbInvoice(JSON.stringify(request)))
  }
  decodeRgbInvoice (invoice) {
    return JSON.parse(this._inner.decodeRgbInvoice(invoice))
  }
  sendRgb (request) {
    return JSON.parse(this._inner.sendRgb(JSON.stringify(request)))
  }
  refreshTransfers (request) {
    this._inner.refreshTransfers(JSON.stringify(request))
    return { ok: true }
  }
  failTransfers (request) {
    return JSON.parse(this._inner.failTransfers(JSON.stringify(request)))
  }
  inflate (request) {
    return JSON.parse(this._inner.inflate(JSON.stringify(request)))
  }
  listTransfers (assetId) {
    return JSON.parse(this._inner.listTransfers(assetId))
  }
  listTransfersByTxid (txid) {
    return JSON.parse(this._inner.listTransfersByTxid(txid))
  }

  // RGB asset media
  getAssetMedia (digest) {
    return JSON.parse(this._inner.getAssetMedia(digest))
  }
  postAssetMedia (request) {
    return JSON.parse(this._inner.postAssetMedia(JSON.stringify(request)))
  }

  // Signing / onion / diagnostics
  signMessage (message) {
    return JSON.parse(this._inner.signMessage(message))
  }
  verifyMessage (message, signature) {
    return JSON.parse(this._inner.verifyMessage(message, signature))
  }
  sendOnionMessage (request) {
    return JSON.parse(this._inner.sendOnionMessage(JSON.stringify(request)))
  }
  checkIndexerUrl (indexerUrl) {
    return JSON.parse(this._inner.checkIndexerUrl(indexerUrl))
  }
  checkProxyEndpoint (proxyEndpoint) {
    return JSON.parse(this._inner.checkProxyEndpoint(proxyEndpoint))
  }
}

// ─── 3. NativeExternalSigner wrapper ────────────────────────────────────

class NativeExternalSigner {
  constructor (inner) {
    this._inner = inner
    this._destroyed = false
  }

  static create (seedHex, network, permissivePolicy = true) {
    if (typeof seedHex !== 'string' || seedHex.length !== 64) {
      throw new Error('NativeExternalSigner.create: seedHex must be a 64-char hex string')
    }
    return new NativeExternalSigner(
      napi.NativeExternalSigner.create(seedHex, network, !!permissivePolicy)
    )
  }

  bootstrap () {
    if (this._destroyed) throw new Error('NativeExternalSigner already destroyed')
    return JSON.parse(this._inner.bootstrap())
  }

  destroy () {
    if (this._destroyed) return
    try { this._inner.destroy() } catch { /* ignore */ }
    this._destroyed = true
  }
}

// ─── 4. Module-level helpers (parity with bare addon, no-ops for now) ───

// The bare addon exposes uniffiHealthcheck / uniffiIsInitialized /
// sdkInitialize / sdkShutdown. The napi binding doesn't surface these
// yet — wdk-rgb-lightning's BareRgbLightningBinding / NodeRgbLightningBinding
// only call them as static helpers, so we stub them with sensible
// fallbacks. Wire real implementations when we surface the module-level
// uniffi entry points through napi.

exports.SdkNode = SdkNode
exports.NativeExternalSigner = NativeExternalSigner
exports.uniffiHealthcheck = () => 'unsupported-in-node-binding'
exports.uniffiIsInitialized = () => true
exports.sdkInitialize = () => undefined
exports.sdkShutdown = () => undefined
