// TypeScript surface for @utexo/rgb-lightning-node-nodejs.
//
// The Rust N-API layer exchanges JSON strings internally. The public
// JavaScript facade in index.js owns that marshalling, so package consumers
// pass plain objects and receive parsed JSON values.

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export interface JsonObject { [key: string]: JsonValue }
export type JsonRequest = Record<string, unknown>

/** Integer encoded as base-10 text so values never cross JS's safe-number boundary. */
export type DecimalString = `${bigint}`

/** Safe integers are numbers; larger native response integers are exact decimal strings. */
export type ExactInteger = number | DecimalString

export interface DecodedLnInvoice {
  description: string | null
  description_hash: string | null
  amt_msat: ExactInteger | null
  expiry_sec: number
  timestamp: number
  asset_id: string | null
  asset_amount: ExactInteger | null
  payment_hash: string
  payment_secret: string
  payee_pubkey: string | null
  min_final_cltv_expiry_delta: number
  network: string
}

export type LightningPaymentStatus =
  | 'Pending'
  | 'Claimable'
  | 'Claiming'
  | 'Succeeded'
  | 'Cancelled'
  | 'Failed'

export interface SendPaymentResponse {
  payment_id: string
  payment_hash: string | null
  payment_secret: string | null
  status: LightningPaymentStatus
}

export interface LightningPayment {
  amt_msat: ExactInteger | null
  asset_amount: ExactInteger | null
  asset_id: string | null
  payment_hash: string
  payment_type: 'Outbound' | 'InboundAutoClaim' | 'InboundHodl'
  status: LightningPaymentStatus
  created_at: number
  updated_at: number
  payee_pubkey: string
  preimage: string | null
  description: string | null
  description_hash: string | null
}

export type DecodedRgbAssignment =
  | { type: 'Fungible'; value: ExactInteger }
  | { type: 'NonFungible' }
  | { type: 'InflationRight'; value: ExactInteger }
  | { type: 'Any' }

export interface DecodedRgbInvoice {
  recipient_id: string
  recipient_type: 'Blind' | 'Witness'
  asset_schema: string | null
  asset_id: string | null
  assignment: DecodedRgbAssignment
  network: string
  expiration_timestamp: number | null
  transport_endpoints: string[]
}

export interface BtcSendRequest {
  amount: number
  address: string
  fee_rate: number
  skip_sync: boolean
}

export interface CreateUtxosRequest {
  up_to: boolean
  num?: number
  size?: number
  fee_rate: number
  skip_sync: boolean
}

export interface SendBtcResponse {
  txid: string
}

export interface RgbAllocation {
  asset_id: string | null
  assignment: string
  settled: boolean
}

export interface RgbUnspent {
  utxo: {
    outpoint: string
    btc_amount: number
    colorable: boolean
    exists: boolean
  }
  rgb_allocations: RgbAllocation[]
}

export interface AssetLinkCreateRequest {
  parent_asset_id: string
  child_asset_id: string
  min_confirmations: number
}

export interface AssetLinkRecord {
  parent_asset_id: string
  child_asset_id: string | null
  created_at: number | null
  txid: string | null
}

export class NativeExternalSigner {
  static create(
    seedHex: string,
    network: 'mainnet' | 'testnet' | 'testnet4' | 'regtest' | 'signet',
    permissiveSignerPolicy?: boolean
  ): NativeExternalSigner

  static createWithStorage(
    seedHex: string,
    network: 'mainnet' | 'testnet' | 'testnet4' | 'regtest' | 'signet',
    storageDirPath: string,
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
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  startUnlockWithNativeExternalSigner(
    signer: NativeExternalSigner,
    request: JsonRequest
  ): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  nativeOperationStatus(operationId: string): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  adoptNativeOperation(operationId: string): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  cancelNativeOperation(operationId: string): never
  initWithExternalSigner(bootstrap: JsonRequest): void
  detachExternalSigner(): void
  unlockWithAttachedExternalSigner(request: JsonRequest): void
  shutdown(): void

  // VSS / APay
  vssClearFence(request: JsonRequest): void
  vssBackup(): JsonObject
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  vssDeleteAll(request: { password: string }): never
  apayNew(hostNodeId: string): JsonObject
  apayNewWithAddress(hostNodeId: string, username: string, domain: string): JsonObject

  // Node info / network / sync
  nodeInfo(): JsonObject
  networkInfo(): JsonObject
  sync(): JsonValue
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  syncWallet(request: JsonRequest): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  walletSnapshot(request?: JsonRequest): never
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
  listUnspents(skipSync?: boolean): RgbUnspent[]
  listTransactions(skipSync?: boolean): JsonValue
  listTransactionsByTxid(txid: string, skipSync?: boolean): JsonValue
  sendBtc(request: BtcSendRequest): SendBtcResponse
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  prepareBtcSend(request: BtcSendRequest): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  commitPreparedBtcSend(request: JsonRequest): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  cancelBtcSendPlan(request: { plan_id: string }): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  prepareCreateUtxos(request: CreateUtxosRequest): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  commitPreparedCreateUtxos(request: JsonRequest): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  cancelCreateUtxosPlan(request: { plan_id: string }): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  listPendingVanillaTransactions(): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  listAddressReceipts(address: string): never
  createUtxos(request: JsonRequest): JsonValue
  estimateFee(blocks: number): JsonObject

  // Lightning invoices / payments
  lnInvoice(request: JsonRequest): JsonObject
  decodeLnInvoice(invoice: string): DecodedLnInvoice
  invoiceStatus(invoice: string): JsonObject
  cancelHodlInvoice(request: JsonRequest): JsonValue
  claimHodlInvoice(request: JsonRequest): JsonValue
  sendPayment(request: JsonRequest): SendPaymentResponse
  keysend(request: JsonRequest): JsonValue
  listPayments(): LightningPayment[]
  getPayment(paymentHashHex: string, paymentType: string): LightningPayment

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
  assetLinkCreate(request: AssetLinkCreateRequest): AssetLinkRecord
  assetMetadata(assetId: string): JsonObject

  // RGB invoices / transfers
  rgbInvoice(request: JsonRequest): JsonObject
  decodeRgbInvoice(invoice: string): DecodedRgbInvoice
  sendRgb(request: JsonRequest): JsonValue
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  importRgbTransferConsignment(request: JsonRequest): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  importRgbContract(request: JsonRequest): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  prepareRgbSend(request: JsonRequest): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  commitPreparedRgbSend(request: JsonRequest): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  cancelRgbSendPlan(request: { plan_id: string }): never
  /** @deprecated Unsupported by released RLN; always throws UnsupportedCapabilityError. */
  listPendingRgbSendPlans(): never
  refreshTransfers(request: JsonRequest): RefreshTransfersResponse
  failTransfers(request: JsonRequest): JsonValue
  inflate(request: JsonRequest): JsonValue
  listTransfers(assetId?: string, txid?: string): JsonValue
  listTransfers(filters: { asset_id?: string; txid?: string }): JsonValue
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
export interface RuntimeInfo {
  readonly abi_version: 1
  readonly rln_version: '0.13.0-beta.3'
  readonly rln_commit: string
  readonly lightning_commit: string
  readonly adapter_sha256: string
  readonly wrapper_sha256: string
  readonly lock_sha256: string
  readonly target: string
  readonly capabilities: readonly string[]
}
export interface RefreshTransfersResponse {
  transfers: Record<string, {
    updated_status: string | null
    failure: { name: string; message: string } | null
  }>
}
export class UnsupportedCapabilityError extends Error {
  readonly code: 'ERR_RLN_UNSUPPORTED_CAPABILITY'
  readonly capability: string
}
export function getRuntimeInfo(): RuntimeInfo
export function uniffiIsInitialized(): boolean
export function sdkInitialize(request?: JsonRequest): void
export function sdkShutdown(): void
