# Native upgrade: October 14, 2026

Candidate `0.2.0-beta.4` targets published RLN SDK `v0.17.0-beta.3`.
The existing `release/rln-0.15.0-beta.3` branch retains its review history.
No package, release or artifact is published.

## Exact source identity

- RLN: `ecc69f20308231400561f6f060fea88acfa40cc4`, version `0.17.0-beta.3`
- LDK: `79b9eb5166546c62692d3a672986f385c7fe047d`
- rgb-lib: `v0.3.0-beta.50-bfa`, `1b951af0c8233308c919975552487be19ad2a930`
- Shared adapter SHA-256: `bbec56a1ef9c05feb9d50a9edab556837be872f482bf1183493a4f449f45275d`
- C-FFI lock SHA-256: `5fcdc9ad9179d3230e48973cdfa514a863d13a837752027febf8ea04713bbeb5`
- Bare wrapper SHA-256: `36ae181f6feb775e93848125334e92dbfad7ddbdc0643667ea1f5e8a0e429651`
- Bare recipe SHA-256: `bcc14b617ba4ac0818dcf8c496bacc27ca35bdf3c20ca840d04c9d82b57c62b7`
- Node wrapper SHA-256: `c8b74b9698806b949bff3dd46dd4a5f48545b9f08c695f4e47c03c56d9ac2657`
- Node lock SHA-256: `de8eedbec81519cafbdf02c3445654d31ec6fbda8181be42f5926dcaf7911108`
- Rust: `1.94.0`; Apple deployment targets macOS 13.0/iOS 16.0; Android NDK `27.1.12297006`, API 29

Both adapters contain identical bytes and change only the eight allowlisted
C-FFI files. Every other reviewed Git dependency revision is retained. The SDK
version is now reported honestly. No new Lightning entrypoints are exposed;
Iris continues to enforce its on-chain-only profile.

## Qualification

Both source and locked Git graphs and declarations are verified. Bare's 56 and
Node's 23 unit checks pass locally. Fresh optimized target matrices and runtime
canaries are being rebuilt; results will be recorded here after completion.
Historical 0.15/0.16 binaries and tests are not evidence for this source.

All seven Bare targets must pass checksum, archive/addon symbol and provenance
gates. Android keeps byte-preserving staging, RELRO/DYNAMIC/GOT, Rust TLS lifetime
and 64-bit 16-KiB checks. All five Node targets must pass optimized native load,
identity/lifecycle/error canaries and ten Rust adapter tests on actual runtimes.
Missing or stale artifacts cannot substitute for the new source.

Known signer reopen, pending witness accounting, crash reservation, native
dependency security review, physical-device and funded/mobile qualification
gates remain open until fresh tests resolve them. Artifact matrices do not
constitute production approval. See the historical tracker and WDK production
gate report for reproductions.

## macOS 27 build compatibility

An initial clean host build reproduced Rust's [proc-macro stripping defect](https://github.com/rust-lang/rust/issues/157750): dyld rejects an unaligned LINKEDIT string pool. The release and development build-override profiles now set `strip = "none"` for compile-time dependencies in the C-FFI manifest and Node wrapper. Shipped target optimization and stripping remain unchanged. No caller environment flag is required. The failed trace remains local evidence, and qualification is repeated against these final identities.

Bare recipe provenance now binds the source-build orchestration and C-FFI/CMake shell scripts rather than only the CMake script. Node sidecars additionally bind `buildRecipeSha256` to its installer/build orchestration. This rejects artifacts built under older build recipes. No previous artifact is restamped as a pass.

Fresh cargo-audit reports ten lockfile vulnerabilities: five Quinn findings, rkyv, rsa and three legacy webpki findings. Quinn/rkyv/rsa are absent from the selected normal/build graph on all targets. Legacy webpki is active through minreq/rustls0.21 and remains a release security gate; no incompatible dependency version is forced into upstream runtime code.
