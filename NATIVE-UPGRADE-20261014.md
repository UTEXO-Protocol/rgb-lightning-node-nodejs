# Native upgrade: October 14, 2026

Historical artifact/source checkpoint. The current signer/session lifecycle
overlay and its qualification are tracked in
[NATIVE-UPGRADE-20261015.md](NATIVE-UPGRADE-20261015.md).

Candidate `0.2.0-beta.4` targets published RLN SDK `v0.17.0-beta.3`.
The existing `release/rln-0.15.0-beta.3` branch retains its review history.
The candidate has not been merged, tagged or published to npm or a GitHub release.

## Exact source identity

- RLN: `ecc69f20308231400561f6f060fea88acfa40cc4`, version `0.17.0-beta.3`
- LDK: `79b9eb5166546c62692d3a672986f385c7fe047d`
- rgb-lib: `v0.3.0-beta.50-bfa`, `1b951af0c8233308c919975552487be19ad2a930`
- Shared adapter SHA-256: `bbec56a1ef9c05feb9d50a9edab556837be872f482bf1183493a4f449f45275d`
- C-FFI lock SHA-256: `5fcdc9ad9179d3230e48973cdfa514a863d13a837752027febf8ea04713bbeb5`
- Bare wrapper SHA-256: `36ae181f6feb775e93848125334e92dbfad7ddbdc0643667ea1f5e8a0e429651`
- Bare recipe SHA-256: `bcc14b617ba4ac0818dcf8c496bacc27ca35bdf3c20ca840d04c9d82b57c62b7`
- Node wrapper SHA-256: `3647ddc882ff0e04133f69d14123f2dba3c111ca31d47ffc4946a4bf402ef30d`
- Node recipe SHA-256: `07c989d17d2bf6be5cbb6d9e491937316dd67a68dd09aafa755aa91dc4ec7a84`
- Node lock SHA-256: `de8eedbec81519cafbdf02c3445654d31ec6fbda8181be42f5926dcaf7911108`
- Rust: `1.94.0`; Apple deployment targets macOS 13.0/iOS 16.0; Android NDK `27.1.12297006`, API 29

Both adapters contain identical bytes and change only the eight allowlisted
C-FFI files. Every other reviewed Git dependency revision is retained. The SDK
version is now reported honestly. No new Lightning entrypoints are exposed;
Iris continues to enforce its on-chain-only profile.

## Qualification

Both source and locked Git graphs and declarations are verified. Bare's 56 and
Node's 29 unit checks pass locally. Both final optimized Mac architectures pass
actual Node 22.23.3 canaries on macOS 27.0.1 (Intel executes through Rosetta).
The final five-target hosted matrix and assembled complete release-artifact
gate pass. Original artifact hashes, sidecars and runtime identities are verified.
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

## Final Darwin stripping and loader qualification

A second real macOS 27 check found that Rust 1.94's final `strip = "symbols"`
path also emitted an unaligned LINKEDIT string pool. The initial failed addon,
its original sidecar and failed canary log are retained as unqualified evidence.
The Darwin installer now uses `cargo rustc` with `-C strip=none` and Apple
link-time `-x` / `-S` to remove local/debug symbols while preserving loader
alignment and the code signature. GNU/musl release stripping is unchanged.

The bound build recipe includes the installer and new Mach-O validator.
Installer reuse, sidecar recording and the complete release gate reject malformed,
wrong-architecture or misaligned Darwin addons even on older macOS.
The intermediate `c8b74b` wrapper/`f7113f` recipe passed its original matrix,
but those artifacts are historical after the import-contract change below.
Both final Mac binaries pass structural checks and actual Node 22.23.3 canaries
on macOS 27.0.1. Old sidecars are never relabeled.

Current funded Bare tests still reproduce signer database locking after
unlocked same-process reopen and a doubled pending witness balance. Root's
fresh burn and independent beta50 validation pass, including missing-event,
wrong-recipient and wrong-amount rejection. These functional passes do not
close the lifecycle/accounting or native dependency security gates.

## Pre-loader admission hardening

Independent review found that callers skipping postinstall could reach dlopen
before the sidecar/build-recipe admission checks. The facade now verifies the
sidecar, full native identity, wrapper/lock/recipe hashes, actual addon bytes and
Darwin layout before loading the native module. Only the two known build
profiles (release/debug) are loadable; the application argv does not select the
profile. Publication still requires all five artifacts to be release builds.

Fresh regression tests prove missing/malformed/stale/corrupt sidecars and a
hash-matching misaligned Mach-O cannot reach dlopen or addon initialization.
Both valid profiles remain usable when a consumer passes unrelated --debug.
The 29-test suite and declarations pass. The wrapper hash is now
`3647ddc882ff0e04133f69d14123f2dba3c111ca31d47ffc4946a4bf402ef30d`;
recipe hash is `07c989d17d2bf6be5cbb6d9e491937316dd67a68dd09aafa755aa91dc4ec7a84`.
All five artifacts were rebuilt against this final import contract. The
previous f711 matrix remains historical evidence, not a final artifact pass.

Ten Rust C-FFI adapter tests also pass locally on macOS 27 under the pinned
1.94 toolchain. The native core/adapter/locks and Bare artifacts are unchanged.

## Final five-target artifact qualification

The [final build-only matrix](https://github.com/UTEXO-Protocol/rgb-lightning-node-nodejs/actions/runs/38559279576)
passes all five targets against source `82eeb4cea5038c007b44036307834156a26c71d5`
(native implementation `42b5fcbe505ec9b6aa7b48273507fb43cf96c491`). Every job
runs the 29 unit tests, declaration checks, optimized native identity/offline
lifecycle/error canary and ten Rust adapter tests on the actual target runtime.

| Target | Hosted Node | Actual libc requirement |
| --- | --- | --- |
| macOS arm64 | 22.23.2 | macOS deployment target 13.0 |
| macOS x64 | 22.23.2 | macOS deployment target 13.0 |
| Linux GNU arm64 | 22.23.0 | glibc 2.34, OpenSSL 3 |
| Linux GNU x64 | 22.23.0 | glibc 2.34, OpenSSL 3 |
| Linux musl x64 | 24.18.1 | Alpine 3.23; no glibc references |

Both GNU symbol-version requirements are checked from the original final ELF
bytes and match the CI compatibility JSON. Both original hosted Mac binaries
also pass actual Node 22.23.3 canaries on macOS 27.0.1, with Intel through
Rosetta. Both local Mac binaries additionally encode minimum OS 13.0.

All original archives retain their GitHub digest, ZIP checksum, addon checksum
and source/adapter/wrapper/lock/recipe sidecars. The central full-five gate
passes with the three original Linux outputs and the independently qualified
local Mac outputs; original hosted Mac outputs are retained separately.
No superseded artifact or sidecar is restamped. The public source, runtime and
artifact origin record is
`release-evidence/2026-10-14/native-node-final-admission-artifact-origins.json`.

## Final funded on-chain boundaries

The final `3647dd` wrapper/`07c989` recipe host was tested through WDK against
isolated regtest fixtures. All thirteen cases preserve the original native
artifact and sidecar hashes. Nine pass: twelve external-unlock controls, fourteen
asset checks, eleven BFA burn steps, seven address checks, six cold-copy checks,
eight BTC reorg checks, eight default interruption checks, twelve wide/delayed
interruption checks, and nine disk-full checks.

Four cases fail and remain release blockers: unlocked same-process signer
reopen (P01), RGB reorg recovery (P03), pending witness balance double counting
(P04), and event ordering after ten earlier passing checks (P06). The passing
interruption/copy cases do not establish broader crash or RGB recovery safety.

Independent validation uses the exact beta50 rgb-lib source. The final burn
proof passes; missing FundsIn is rejected by consensus validation, while the
wrong-recipient and wrong-amount controls are rejected by the metadata
prechecks. The proof SHA-256 is
`d213c151309dc65f507f8637136de3dcd564113fdbbee17c42ced11309474ffb`.
All forty indexed on-chain/lifecycle attempts, including earlier failed fixtures and superseded
artifacts, remain indexed in `release-evidence/2026-10-14/onchain-test-index.json`.
These passes leave the four functional failures, active native TLS advisories
and physical-device/mobile runtime qualification open. There is no production
approval, merge or publication.
