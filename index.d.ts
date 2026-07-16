// TypeScript surface for @utexo/rgb-lightning-node-nodejs.
//
// The Rust N-API layer exchanges JSON strings internally. The public
// JavaScript facade in index.js owns that marshalling, so package consumers
// pass plain objects and receive parsed JSON values.

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export interface JsonObject { [key: string]: JsonValue }
export type JsonRequest = Record<string, unknown>

export class NativeExternalSigner {
  static create(
    seedHex: string,
    network: 'mainnet' | 'testnet' | 'testnet4' | 'regtest' | 'signet',
    permissiveSignerPolicy?: boolean
  ): NativeExternalSigner

  bootstrap(): JsonObject
  destroy(): void
}

export class SdkNode {
  static create(request: JsonRequest): SdkNode

  // External-signer lifecycle
  initWithNativeExternalSigner(signer: NativeExternalSigner): void
  attachNativeExternalSigner(signer: NativeExternalSigner): void
  unlockWithNativeExternalSigner(signer: NativeExternalSigner, request: JsonRequest): void
  initWithExternalSigner(bootstrap: JsonRequest): void
  detachExternalSigner(): void
  unlockWithAttachedExternalSigner(request: JsonRequest): void
  shutdown(): void

  // VSS / APay
  vssClearFence(request: JsonRequest): void
  vssBackup(): JsonObject
  apayNew(hostNodeId: string): JsonObject

  // Node info / network / sync
  nodeInfo(): JsonObject
  networkInfo(): JsonObject
  sync(): JsonValue
  getAddress(): JsonObject
  address(): JsonObject
  rotateAddress(): JsonObject

  // Peers / channels
  connectPeer(peerPubkeyAndAddr: string): JsonValue
  disconnectPeer(request: JsonRequest): JsonValue
  listPeers(): JsonValue
  openChannel(request: JsonRequest): JsonValue
  closeChannel(request: JsonRequest): JsonValue
  listChannels(): JsonValue
  getChannelId(temporaryChannelIdHex: string): JsonValue

  // BTC / UTXOs
  btcBalance(skipSync?: boolean): JsonObject
  listUnspents(skipSync?: boolean): JsonValue
  listTransactions(skipSync?: boolean): JsonValue
  listTransactionsByTxid(txid: string, skipSync?: boolean): JsonValue
  sendBtc(request: JsonRequest): JsonValue
  createUtxos(request: JsonRequest): JsonValue
  estimateFee(blocks: number): JsonObject

  // Lightning invoices / payments
  lnInvoice(request: JsonRequest): JsonObject
  decodeLnInvoice(invoice: string): JsonObject
  invoiceStatus(invoice: string): JsonObject
  cancelHodlInvoice(request: JsonRequest): JsonValue
  claimHodlInvoice(request: JsonRequest): JsonValue
  sendPayment(request: JsonRequest): JsonValue
  keysend(request: JsonRequest): JsonValue
  listPayments(): JsonValue
  getPayment(paymentHashHex: string, paymentType: string): JsonValue

  // Atomic swaps
  makerInit(request: JsonRequest): JsonValue
  makerExecute(request: JsonRequest): JsonValue
  taker(request: JsonRequest): JsonValue
  listSwaps(): JsonValue
  getSwap(paymentHash: string, taker: boolean): JsonValue

  // RGB issuance / assets
  issueAssetNia(request: JsonRequest): JsonValue
  issueAssetUda(request: JsonRequest): JsonValue
  issueAssetCfa(request: JsonRequest): JsonValue
  issueAssetIfa(request: JsonRequest): JsonValue
  listAssets(filterAssetSchemas?: string[]): JsonValue
  assetBalance(assetId: string): JsonObject
  assetMetadata(assetId: string): JsonObject

  // RGB invoices / transfers
  rgbInvoice(request: JsonRequest): JsonObject
  decodeRgbInvoice(invoice: string): JsonObject
  sendRgb(request: JsonRequest): JsonValue
  refreshTransfers(request: JsonRequest): { ok: true }
  failTransfers(request: JsonRequest): JsonValue
  inflate(request: JsonRequest): JsonValue
  listTransfers(assetId: string): JsonValue
  listTransfersByTxid(txid: string): JsonValue

  // RGB asset media
  getAssetMedia(digest: string): JsonValue
  postAssetMedia(request: JsonRequest): JsonValue

  // Signing / onion / diagnostics
  signMessage(message: string): JsonObject
  verifyMessage(message: string, signature: string): { valid: boolean }
  sendOnionMessage(request: JsonRequest): JsonValue
  checkIndexerUrl(indexerUrl: string): JsonObject
  checkProxyEndpoint(proxyEndpoint: string): JsonValue
}

export function uniffiHealthcheck(): string
export function uniffiIsInitialized(): boolean
export function sdkInitialize(request?: JsonRequest): void
export function sdkShutdown(): void
