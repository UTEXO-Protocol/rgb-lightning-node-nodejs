# Native upgrade: October 14, 2026

Candidate `0.2.0-beta.4` targets published RLN SDK `v0.17.0-beta.3`.
The existing `release/rln-0.15.0-beta.3` branch retains its review history.
No package, release or artifact is published.

## Exact source identity

- RLN: `ecc69f20308231400561f6f060fea88acfa40cc4`, version `0.17.0-beta.3`
- LDK: `79b9eb5166546c62692d3a672986f385c7fe047d`
- rgb-lib: `v0.3.0-beta.50-bfa`, `1b951af0c8233308c919975552487be19ad2a930`
- Shared adapter SHA-256: `a091d7d81831702f2b1a1479d32614f3ee17dae248318e98cbf8dadd00d211d9`
- C-FFI lock SHA-256: `5fcdc9ad9179d3230e48973cdfa514a863d13a837752027febf8ea04713bbeb5`
- Bare wrapper SHA-256: `36ae181f6feb775e93848125334e92dbfad7ddbdc0643667ea1f5e8a0e429651`
- Bare recipe SHA-256: `22eac5a64490e16d79cecdd086b28ae0e2cb041e88af9a9ac7491b541a6ad146`
- Node wrapper SHA-256: `f30a7b48547c4e10ab2f3f4d33f6215835344681ee575d8deb51211c80ad2418`
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
