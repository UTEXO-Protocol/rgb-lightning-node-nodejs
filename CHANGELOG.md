# Changelog

## [0.2.0-beta.5] — 2026-10-20

### Added

- BIP-322 v2 simple Bitcoin address proofs using the owned first vanilla BIP86
  Taproot address, exact UTF-8 messages and native signing. Offline verification
  supports P2TR key-path and P2WPKH simple proofs. Existing Lightning node-identity
  signing retains its original semantics.
- Explicitly configured VSS backup and pre-unlock cloud restore, with bounded
  archive-path validation, wallet/network identity checks, no-overwrite promotion
  and authenticated local restore receipts.
- Durable, default-on automatic RGB backup preference scoped to wallet, network
  and exact VSS endpoint. Pausing retains manual backup and pending changes;
  re-enabling checkpoints current state before confirming the preference.
- Separate remote backup-health and versioned local upload-receipt APIs. Receipts
  contain the canonical manifest version and actual upload completion time, and
  remain readable after device clock corrections.

### Fixed

- Serialize backup policy, admitted mutations, checkpoints and shutdown. Failed
  uploads retain pending state and the prior preference; read-only status does
  not manufacture a new backup time or repeat a financial operation.
- Retain terminal signer shutdown, session task/listener cleanup and explicit
  locked-node writer recovery. No automatic foreign-writer takeover is added.

### Compatibility and distribution

- Continue RLN v0.17.0-beta.3, rgb-lib v0.3.0-beta.50-bfa and the same pinned LDK.
  Native runtime/build inputs and previously qualified binary bytes are preserved;
  package versioning does not relabel their original compilation provenance.
- VSS does not back up the mnemonic, separate VLS signer database or application
  journals. Upstream public-derived external-signer credentials, interrupted
  chunk replacement and broader crash/device-loss recovery remain limitations.

- Retain the complete five-target Node package: Darwin ARM64/x64, Linux
  ARM64/x64 GNU and Linux x64 musl. Published beta.4 artifacts remain unchanged.

## 0.2.0-beta.4

- Pin RLN SDK v0.17.0-beta.3, its released LDK submodule and rgb-lib beta.50-bfa.
- Rebase the C-FFI-only adapter and enforce new compiled provenance. Existing API behavior and strict native artifact protection gates remain.


All notable changes to `@utexo/rgb-lightning-node-nodejs` are
documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
while pre-`1.0`.

## Historical pre-0.17 API work (superseded)

These development notes retain earlier API history; they are not the current
0.2.0-beta.5 API reference. See the README and current declarations.

### Added
- `SdkNode.apayNewWithAddress(hostNodeId, username, domain)` with the generated
  C-FFI entry point required for signed Lightning Address attestation. The
  legacy `apayNew` method remains available for explicit compatibility use.
- Authoritative `listAddressReceipts(address)` settlement evidence backed by
  the configured Electrum or Esplora indexer, including exact received
  satoshis, transaction IDs, block heights, and confirmation counts.
- Deterministic BTC and RGB on-chain send plans. `prepareBtcSend()` and
  `prepareRgbSend()` reserve the exact unsigned plan inside the native wallet
  and return only its opaque transaction identity, fee, input/output totals,
  virtual size, and RGB batch identity. `commitPreparedBtcSend()` and
  `commitPreparedRgbSend()` idempotently validate and submit that exact
  native plan without exposing PSBT material to JavaScript.
- Explicit RGB wallet UTXO setup plans. `prepareCreateUtxos()` reserves an
  exact native transaction and returns only review-safe fee, input, output,
  virtual-size, target-count, and output-size data.
  `commitPreparedCreateUtxos()` signs and broadcasts that exact plan, while
  `cancelCreateUtxosPlan()` releases only a matching setup reservation.
- Preserve `pending_blinded` in every `listUnspents()` item so callers can
  distinguish a genuinely free RGB allocation slot from a receive-reserved
  colorable UTXO.
- Include `Cargo.lock` in the npm package so Git-branch installs can honor the
  native installer's `cargo build --locked` reproducibility contract.
- Idempotent BTC and RGB plan cancellation plus bounded pending-plan
  inspection, allowing consumers to release abandoned send reservations
  without touching channel or UTXO-management operations.
- `SdkNode.syncWallet()` and `SdkNode.walletSnapshot()` with a shared
  v0.11.0-beta.3 native overlay: dual-keychain FullSync/FullScan modes,
  bounded activity, coherent tip evidence, and decimal-string amounts.
- Pull-request CI that applies the pinned native overlay, runs its contract
  tests, builds the host addon, and executes the package canary.
- `SdkNode.assetLinkCreate(request)` for the RLN v0.11 parent/child RGB
  asset-link contract.
- `SdkNode.verifyMessage(message, signature)` with canonical Lightning
  zbase32 verification, including locked external-signer nodes.
- `rotateAddress()`, `listTransactionsByTxid()`, and
  `listTransfersByTxid()` wrappers required by WDK's read-only account.
- Native-addon smoke testing and strict checking of the public TypeScript
  declarations in release CI.
- A post-publish dispatch to `wdk-rgb-lightning`, restoring the dependency
  order documented by the native SDK release workflow.

### Changed
- Publish the persisted local VSS writer identity with an Android-safe
  exclusive-create protocol, bounded concurrent-reader retry, and fail-closed
  corruption handling.
- Updated the transaction and transfer query bindings for the consolidated
  RLN v0.11 C-FFI filter signatures while retaining the existing JavaScript
  convenience methods.
- The published TypeScript declarations now describe the parsed object-based
  JavaScript facade instead of the internal JSON-string N-API layer, and cover
  the complete facade surface.
- Tag-specific C-FFI overlays are optional; current RLN tags build directly
  from upstream when no overlay exists.
- Release builds use reproducible `npm ci` installs.
- NAPI builds write generated raw-layer declarations to an ignored staging
  directory, preserving the committed object-based facade and its types.

### Fixed
- Prepared RGB UTXO setup atomically isolates allocation outputs on a fresh
  colored address and advances the receive address again before returning the
  plan. Existing and future witness invoices can no longer quarantine setup
  outputs as `pending_witness`.
- Explicit node shutdown now releases its native handle immediately, including
  persistent signer database locks once the signer is destroyed, instead of
  waiting for nondeterministic garbage collection.
- Reopening a trusted virtual channel no longer fails after the previous
  channel was safely abandoned. Active and abandon-pending sessions still
  block duplicate opens; only the terminal abandoned state is reusable.
- `decodeRgbInvoice()` now returns a stable tagged assignment object instead
  of an implementation-defined Rust `Debug` string. The exact blind/witness
  recipient type and nullable expiration remain preserved.
- `decodeLnInvoice()` now preserves `min_final_cltv_expiry_delta` across the
  C-FFI JSON boundary. A native contract test guards the complete NodeJS
  response shape against future DTO drift.
- C-FFI network information now emits canonical lowercase network names,
  matching the public TypeScript contract and wallet snapshot contract v1.
- The local native-build lock graph now pins `rln-external-signer` to the
  revision required by the patched C-FFI source, restoring reproducible
  release builds for contributors and CI.
- Release version commits now include `package-lock.json`.

## [0.1.0-beta.15]

### Added
- Expose the disk-backed native VLS signer needed for channel operation after
  process restarts.

### Changed
- Build branch installs from the exact checksum-pinned native overlay instead
  of downloading a stale release addon.

## [0.1.0-beta.8] — 2026-06-01

### Added
- `vssBackup()` napi method — exposes upstream `vss_backup()` for
  app-controlled VSS flush. Returns `{ version }` of the snapshot
  just persisted. Built against `rgb-lightning-node` v0.5.0-beta.1
  + the C-FFI patch series that adds `rln_sdk_node_vss_backup`.

## [0.1.0-beta.7] — 2026-05-31

### Added
- `apayNew` napi wrapper — receiver-side async-payments registration
  against an LSP (upstream RLN PR #51).

## [0.1.0-beta.6] — 2026-05-28

### Added
- `vssClearFence` napi wrapper — forcibly takes over a stale VSS
  ownership fence after a previous node died holding it.

## [0.1.0-beta.5] — 2026-05-27

### Changed
- Rebuilt against `rgb-lightning-node` v0.4.3-beta.1.

## [0.1.0-beta.4] — 2026-05-26

### Added
- VSS cloud backup feature and APay receiver-side surface, built
  against `rgb-lightning-node` v0.4.0-beta.1.

## [0.1.0-beta.3] — 2026-05-25

### Added
- Locally cherry-picked PR #34 (openchannel race fix) into the C-FFI
  build until merged upstream.

## [0.1.0-beta.2] — 2026-05-21

### Changed
- Rebuilt against the merged `feat/external-signer` branch of
  `rgb-lightning-node`.

## [0.1.0-beta.1] — 2026-05-20

### Added
- Full `SdkNode` + `NativeExternalSigner` napi surface, parity with
  the bare addon.

## [0.1.0-beta.0] — 2026-05-14

### Added
- Initial napi-rs scaffolding for `@utexo/rgb-lightning-node-nodejs`.
