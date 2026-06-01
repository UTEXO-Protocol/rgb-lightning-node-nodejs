# Changelog

All notable changes to `@utexo/rgb-lightning-node-nodejs` are
documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
while pre-`1.0`.

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
