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

export type WalletSyncMode = 'routine' | 'recovery'

export interface WalletSyncRequest {
  mode: WalletSyncMode
}

export type WalletSyncKeychainResult =
  | { status: 'succeeded' }
  | { status: 'failed'; error_code: string }

export interface WalletSyncResponse {
  contract_version: 1
  mode: WalletSyncMode
  vanilla: WalletSyncKeychainResult
  colored: WalletSyncKeychainResult
}

export interface WalletSnapshotRequest {
  asset_ids?: string[]
  max_assets?: number
  max_channels?: number
  max_activity_items?: number
  include_activity?: boolean
}

export interface WalletSnapshotNetwork {
  network: 'mainnet' | 'testnet' | 'regtest' | 'signet'
  height: number
}

export interface WalletSnapshotBalance {
  settled: DecimalString
  future: DecimalString
  spendable: DecimalString
}

export interface WalletSnapshotBtc {
  vanilla: WalletSnapshotBalance
  colored: WalletSnapshotBalance
}

export interface WalletSnapshotAssetBalance extends WalletSnapshotBalance {
  offchain_outbound: DecimalString
  offchain_inbound: DecimalString
}

export interface WalletSnapshotAsset {
  asset_id: string
  ticker: string
  name: string
  precision: number
  balance: WalletSnapshotAssetBalance
}

export interface WalletSnapshotNode {
  pubkey: string
  num_channels: DecimalString
  num_usable_channels: DecimalString
  /** Aggregate LDK amount claimable on channel close; this is not routing capacity. */
  claimable_onchain_sat: DecimalString
  eventual_close_fees_sat: DecimalString
  pending_outbound_payments_sat: DecimalString
  num_peers: DecimalString
  latest_rgs_snapshot_timestamp: DecimalString | null
}

export interface WalletSnapshotChannel {
  channel_id: string
  peer_pubkey: string
  status: 'Opening' | 'Opened' | 'Closing'
  ready: boolean
  capacity_sat: DecimalString
  /** LDK amount claimable from this channel monitor; this is not outbound capacity. */
  claimable_onchain_sat: DecimalString
  outbound_capacity_msat: DecimalString
  inbound_capacity_msat: DecimalString
  next_outbound_htlc_limit_msat: DecimalString
  next_outbound_htlc_minimum_msat: DecimalString
  is_usable: boolean
  public: boolean
  funding_txid: string | null
  peer_alias: string | null
  short_channel_id: DecimalString | null
  asset_id: string | null
  asset_local_amount: DecimalString | null
  asset_remote_amount: DecimalString | null
  virtual_open_mode: string | null
}

export interface WalletSnapshotBlockTime {
  height: number
  timestamp: DecimalString
}

export interface WalletSnapshotTransaction {
  transaction_type: 'RgbSend' | 'Drain' | 'CreateUtxos' | 'SendBtc' | 'Incoming'
  txid: string
  received: DecimalString
  sent: DecimalString
  fee: DecimalString
  confirmation_time: WalletSnapshotBlockTime | null
}

export interface WalletSnapshotPayment {
  amt_msat: DecimalString | null
  asset_amount: DecimalString | null
  asset_id: string | null
  payment_hash: string
  payment_type: 'Outbound' | 'InboundAutoClaim' | 'InboundHodl'
  status: 'Pending' | 'Claimable' | 'Claiming' | 'Succeeded' | 'Cancelled' | 'Failed'
  created_at: DecimalString
  updated_at: DecimalString
  payee_pubkey: string
}

export interface DecodedLnInvoice {
  amt_msat: number | null
  expiry_sec: number
  timestamp: number
  asset_id: string | null
  asset_amount: number | null
  payment_hash: string
  payment_secret: string
  payee_pubkey: string | null
  min_final_cltv_expiry_delta: number
  network: string
}

export type DecodedRgbAssignment =
  | { type: 'Fungible'; value: number }
  | { type: 'NonFungible' }
  | { type: 'InflationRight'; value: number }
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

export interface WalletSnapshotTransferEndpoint {
  endpoint: string
  transport_type: string
  used: boolean
}

export interface WalletSnapshotTransfer {
  idx: number
  created_at: DecimalString
  updated_at: DecimalString
  status: string
  requested_assignment: string | null
  assignments: string[]
  kind: string
  txid: string | null
  recipient_id: string | null
  receive_utxo: string | null
  change_utxo: string | null
  expiration: DecimalString | null
  transport_endpoints: WalletSnapshotTransferEndpoint[]
}

export interface WalletSnapshotAssetTransfers {
  asset_id: string
  transfers: WalletSnapshotTransfer[]
}

export interface WalletSnapshotResponse {
  contract_version: 1
  native_source: 'rgb-lightning-node-v0.9.0-beta.3+utexo-wallet-v1'
  capture_sequence: DecimalString
  started_at_ms: DecimalString
  completed_at_ms: DecimalString
  network_before: WalletSnapshotNetwork
  network_after: WalletSnapshotNetwork
  node: WalletSnapshotNode
  btc: WalletSnapshotBtc
  assets: WalletSnapshotAsset[]
  channels: WalletSnapshotChannel[]
  transactions?: WalletSnapshotTransaction[]
  payments?: WalletSnapshotPayment[]
  transfers?: WalletSnapshotAssetTransfers[]
}

export interface BtcSendRequest {
  amount: number
  address: string
  fee_rate: number
  skip_sync: boolean
}

export interface PreparedSendResponse {
  plan_id: string
  fee_sat: DecimalString
  total_input_sat: DecimalString
  total_output_sat: DecimalString
  size_vbytes: DecimalString
}

export interface PreparedRgbSendResponse extends PreparedSendResponse {
  batch_transfer_idx: number
}

export interface CreateUtxosRequest {
  up_to: boolean
  num?: number
  size?: number
  fee_rate: number
  skip_sync: boolean
}

export interface PreparedCreateUtxosResponse extends PreparedSendResponse {
  target_count: number
  output_size_sat: number
}

export interface CommitPreparedSendRequest {
  plan_id: string
}

export interface SendBtcResponse {
  txid: string
}

export interface CancelBtcSendPlanResponse {
  cancelled: boolean
}

export interface PendingVanillaTransaction {
  txid: string
  operation_type: 'CreateUtxos' | 'Drain' | 'SendBtc'
}

export interface PendingRgbSendPlan {
  plan_id: string
  batch_transfer_idx: number
}

export interface AddressReceipt {
  txid: string
  amount_sat: DecimalString
  confirmations: number
  block_height: number | null
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
  syncWallet(request: WalletSyncRequest): WalletSyncResponse
  walletSnapshot(request?: WalletSnapshotRequest): WalletSnapshotResponse
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
  sendBtc(request: BtcSendRequest): SendBtcResponse
  prepareBtcSend(request: BtcSendRequest): PreparedSendResponse
  commitPreparedBtcSend(request: CommitPreparedSendRequest): SendBtcResponse
  cancelBtcSendPlan(request: { plan_id: string }): CancelBtcSendPlanResponse
  prepareCreateUtxos(request: CreateUtxosRequest): PreparedCreateUtxosResponse
  commitPreparedCreateUtxos(request: CommitPreparedSendRequest): SendBtcResponse
  cancelCreateUtxosPlan(request: { plan_id: string }): CancelBtcSendPlanResponse
  listPendingVanillaTransactions(): PendingVanillaTransaction[]
  listAddressReceipts(address: string): AddressReceipt[]
  createUtxos(request: JsonRequest): JsonValue
  estimateFee(blocks: number): JsonObject

  // Lightning invoices / payments
  lnInvoice(request: JsonRequest): JsonObject
  decodeLnInvoice(invoice: string): DecodedLnInvoice
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
  decodeRgbInvoice(invoice: string): DecodedRgbInvoice
  sendRgb(request: JsonRequest): JsonValue
  prepareRgbSend(request: JsonRequest): PreparedRgbSendResponse
  commitPreparedRgbSend(request: CommitPreparedSendRequest): JsonValue
  cancelRgbSendPlan(request: { plan_id: string }): CancelBtcSendPlanResponse
  listPendingRgbSendPlans(): PendingRgbSendPlan[]
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
