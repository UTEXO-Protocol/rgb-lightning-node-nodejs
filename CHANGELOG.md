# Changelog

All notable changes to `@utexo/rgb-lightning-node-nodejs` are
documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
while pre-`1.0`.

## [Unreleased]

### Added
- Authoritative `listAddressReceipts(address)` settlement evidence backed by
  the configured Electrum or Esplora indexer, including exact received
  satoshis, transaction IDs, block heights, and confirmation counts.
- Deterministic BTC and RGB on-chain send plans. `prepareBtcSend()` and
  `prepareRgbSend()` reserve the exact unsigned plan inside the native wallet
  and return only its opaque transaction identity, fee, input/output totals,
  virtual size, and RGB batch identity. `commitPreparedBtcSend()` and
  `commitPreparedRgbSend()` idempotently validate and submit that exact
  native plan without exposing PSBT material to JavaScript.
- Idempotent BTC and RGB plan cancellation plus bounded pending-plan
  inspection, allowing consumers to release abandoned send reservations
  without touching channel or UTXO-management operations.
- `SdkNode.syncWallet()` and `SdkNode.walletSnapshot()` with a shared
  v0.9.0-beta.3 native overlay: dual-keychain FullSync/FullScan modes,
  bounded activity, coherent tip evidence, and decimal-string amounts.
- Pull-request CI that applies the pinned native overlay, runs its contract
  tests, builds the host addon, and executes the package canary.
- `SdkNode.verifyMessage(message, signature)` with canonical Lightning
  zbase32 verification, including locked external-signer nodes.
- `rotateAddress()`, `listTransactionsByTxid()`, and
  `listTransfersByTxid()` wrappers required by WDK's read-only account.
- Native-addon smoke testing and strict checking of the public TypeScript
  declarations in release CI.
- A post-publish dispatch to `wdk-rgb-lightning`, restoring the dependency
  order documented by the native SDK release workflow.

### Changed
- The published TypeScript declarations now describe the parsed object-based
  JavaScript facade instead of the internal JSON-string N-API layer, and cover
  the complete facade surface.
- Tag-specific C-FFI overlays are optional; current RLN tags build directly
  from upstream when no overlay exists.
- Release builds use reproducible `npm ci` installs.
- NAPI builds write generated raw-layer declarations to an ignored staging
  directory, preserving the committed object-based facade and its types.

### Fixed
- `decodeLnInvoice()` now preserves `min_final_cltv_expiry_delta` across the
  C-FFI JSON boundary. A native contract test guards the complete NodeJS
  response shape against future DTO drift.
- C-FFI network information now emits canonical lowercase network names,
  matching the public TypeScript contract and wallet snapshot contract v1.
- The local native-build lock graph now pins `rln-external-signer` to the
  revision required by the patched C-FFI source, restoring reproducible
  release builds for contributors and CI.
- Release version commits now include `package-lock.json`.

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
