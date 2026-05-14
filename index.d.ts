// TypeScript surface for @utexo/rgb-lightning-node-nodejs.
//
// Mirrors @utexo/rgb-lightning-node-bare's JS shape (camelCase methods
// over the underlying C-FFI). Each method takes / returns JSON strings
// where the request bodies follow the schemas in
// rgb-lightning-node/openapi.yaml.
//
// Hand-written for now; switch to napi-rs auto-generated `index.d.ts`
// once we wire the `type-def` feature in the napi crate.

export class NativeExternalSigner {
  /**
   * @param seedHex   32-byte VLS node entropy as a 64-char hex string.
   * @param network   "mainnet" | "testnet" | "regtest" | "signet"
   * @param permissiveSignerPolicy  Loosens the VLS policy filter for
   *   in-process / single-user use. Pass `false` to enforce the full
   *   simple policy.
   */
  static create(seedHex: string, network: string, permissiveSignerPolicy: boolean): NativeExternalSigner

  /** Returns JSON `{ node_id, account_xpub_*, master_fingerprint, … }`. */
  bootstrap(): string

  /** Explicit early-drop. Safe to call multiple times. */
  destroy(): void
}

export class SdkNode {
  static create(requestJson: string): SdkNode

  // -- External-signer lifecycle ----------------------------------------
  initWithNativeExternalSigner(signer: NativeExternalSigner): void
  unlockWithNativeExternalSigner(signer: NativeExternalSigner, requestJson: string): void
  initWithExternalSigner(requestJson: string): void
  attachNativeExternalSigner(signer: NativeExternalSigner): void
  unlockWithAttachedExternalSigner(requestJson: string): void
  detachExternalSigner(): void
  shutdown(): void

  // -- Node info / sync --------------------------------------------------
  nodeInfo(): string
  networkInfo(): string
  sync(): string

  // -- Peers / channels --------------------------------------------------
  connectPeer(requestJson: string): string
  disconnectPeer(requestJson: string): string
  listPeers(): string
  openChannel(requestJson: string): string
  closeChannel(requestJson: string): string
  listChannels(): string

  // -- BTC + UTXOs ------------------------------------------------------
  getAddress(): string
  getBtcBalance(skipSync: boolean): string
  listUnspents(skipSync: boolean): string
  sendBtc(requestJson: string): string
  createUtxos(requestJson: string): string

  // -- Lightning invoices / payments ------------------------------------
  lnInvoice(requestJson: string): string
  decodeLnInvoice(requestJson: string): string
  sendPayment(requestJson: string): string
  keysend(requestJson: string): string
  listPayments(): string

  // -- RGB assets -------------------------------------------------------
  issueAssetNia(requestJson: string): string
  listAssets(filterAssetSchemasJson: string): string
  getAssetBalance(assetId: string): string
  rgbInvoice(requestJson: string): string
  sendRgb(requestJson: string): string
  refreshTransfers(requestJson: string): void
  listTransfers(assetId: string): string
}
