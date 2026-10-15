# Native Upgrade: October 12, 2026

Native build, artifact provenance and qualification results for candidate
0.2.0-beta.3. Historical prebuilds are not qualified for this source.
The complete release artifact gates remain mandatory.

## Shared Source Identity

- RLN source/version: 8777d71d7781b408fcce89c9c965ae29e8ad2300 / 0.15.0-beta.3
- rust-lightning: fc5c4c64db36a9b6aa8cd878ca1225a977e67106
- rgb-lib: v0.3.0-beta.47-bfa / 74a096a5bfbba7744af16c36c3595a24464c134c
- Adapter SHA-256: f6d2959e1ceff0400cbd372759c4957cd5a52964f4ec646a79ee15c21b2291c0
- C-FFI lock SHA-256: a8f4a5d0985dd9ba319572ad7e4109f19b8b2f660e48fc8ae424ecdc764d9451
- Node wrapper lock SHA-256: cbacef855bf50b4a7737766b598e4750f3755ddfa178861a8d3a956a738907ac
- Rust toolchain: 1.94.0

Both adapters are byte-identical and change only the eight C-FFI overlay
files. No RLN, rgb-lib, LDK or signer runtime implementation is patched.
The previous overlay remains necessary on merged dev. Lockfile security updates
(h2 0.4.16, rustls 0.23.45 and required transitive versions) are retained.
Merged PR #194 supplies external-signer burn; PR #200 supplies beta47.

The bridge supports SdkNode.burn(request) and its burnAsset alias. The request
uses asset_id, amount (u64), burn_recipient (optional/null 32-byte hex),
fee_rate (u64), and min_confirmations (u8). Response: txid, batch_transfer_idx.
Exact decimal u64 strings are serialized as JSON number tokens. Native errors
are preserved. Runtime capability: external-signer-burn-v1.

## Build Locations and Commands

Bare checkout: /tmp/rln-android-link-20261010/bare
Node checkout: /tmp/iris-bridge-nodejs-20261012
Verified source: /tmp/iris-bridge-nodejs-20261012/.native-source
Shared read/download Cargo cache: /tmp/iris-bridge-nodejs-20261012/.cargo-cache
Bare compilation cache: /tmp/iris-bridge-nodejs-20261012/target
Node compilation cache: /tmp/iris-bridge-nodejs-20261012/target-node

Node and Bare use isolated Cargo target directories. Local compilation ran
one target at a time within available disk capacity. Completed cache cleanup
preserved verified outputs, provenance, logs and all wallet/test data.

From the Bare repo, substitute one exact configured target:

```sh
env CARGO_HOME=/tmp/iris-bridge-nodejs-20261012/.cargo-cache \
  CARGO_TARGET_DIR=/tmp/iris-bridge-nodejs-20261012/target \
  CARGO_BUILD_JOBS=2 CARGO_PROFILE_RELEASE_DEBUG=0 CARGO_NET_OFFLINE=true \
  RLN_BARE_SOURCE_DIR=/tmp/iris-bridge-nodejs-20261012/.native-source \
  RLN_BARE_TARGETS=darwin-arm64 npm run prepare-native
```

From the Node repo, substitute one exact configured target:

```sh
env CARGO_HOME=/tmp/iris-bridge-nodejs-20261012/.cargo-cache \
  CARGO_TARGET_DIR=/tmp/iris-bridge-nodejs-20261012/target-node \
  CARGO_BUILD_JOBS=2 CARGO_PROFILE_RELEASE_DEBUG=0 CARGO_NET_OFFLINE=true \
  RLN_NODE_TARGET=darwin-arm64 npm run build
```

Linux requires the appropriate actual Linux toolchain and runtime. Use the
existing .github/docker/runtime-gnu.Dockerfile and scripts/runtime-matrix.sh
recipes, preserving Ubuntu 22.04/glibc and Alpine 3.23/musl qualifications.
Cross-build results are recorded separately from runtime execution.

Bare artifacts: lib/<target>/librlncffi.a, prebuilds/<target>/*.bare,
.utexo-native-overlay.json. Node artifacts: index-<target>.node and matching
index-<target>.provenance.json. Build scripts stamp artifact provenance.

## Verification and Artifact Matrix

Wrapper implementation commits used for these builds:

- Bare: cc62bf3a1765d89cb8b0b990ea16a47936f799de
- Node: c30cf547fb2960f737b1463f3410445f43932b1b
- Bare wrapper SHA-256: 4977603fb88e81cb9ef805354a8a74fa3385cd9c823235e6f936aba4692c0de7
- Node wrapper SHA-256: a9d942060b37196ec9e82f6e22ed60a6ec0a7fc32e2bfb3d833bb13def09d99f

Later documentation-only branch HEADs do not replace these implementation pins.
WDK and Iris may retain the implementation commits above; no native artifact
identity changes and no artifact restamping or replacement is required.

The [Bare build-only matrix](https://github.com/UTEXO-Protocol/rgb-lightning-node-bare/actions/runs/38213919881)
uses cc62bf3. The [Node runtime matrix](https://github.com/UTEXO-Protocol/rgb-lightning-node-nodejs/actions/runs/38213891152)
tests c30cf547 via PR merge checkout 0df41c217a64e1eb1486fb8d0625fa14fac414ce.
The duplicate Node manual run 38213925206 was canceled; it is not build evidence.
All seven Bare hosted jobs passed, including Android production staging.
All five Node hosted jobs passed; the complete runtime matrix finished
successfully on October 12, 2026 at 08:08:52 UTC.
Frozen artifacts retain their original verified build outputs; duplicate hosted
results are recorded separately.

Source/adapter equality and both locked Git dependency graphs were verified.
Final local checks pass: 56 Bare tests, 23 Node tests, both TypeScript checks
and both actual Darwin arm64 native identity/lifecycle/error/persistence canaries.
The Bare seven-target packed release gate and full archive/addon symbol,
provenance and Android ELF checks pass. The Node five-target release artifact
gate passes with the original per-artifact provenance sidecars.
Logs are retained as native-*.log
inside each repository checkout.

| Package | Target | Origin and current qualification |
| --- | --- | --- |
| Bare | darwin-arm64 | Local optimized build; native host smoke passed; hosted job also passed |
| Bare | ios-arm64 | Local optimized build, 10m20s; header/symbol/provenance verified; hosted job also passed |
| Bare | ios-arm64-simulator | Hosted job 114694121604 passed; strict import verified |
| Bare | ios-x64-simulator | Hosted job 114694121740 passed; strict import verified |
| Bare | android-arm64 | Local optimized build, 10m55s; header/symbol/provenance/ELF verified; hosted production staging also passed |
| Bare | android-arm | Hosted job 114694121737 and production staging passed; strict import verified |
| Bare | android-x64 | Hosted job 114694121780 and 16-KiB production staging passed; strict import verified |
| Node | darwin-arm64 | Local optimized binary verified; hosted native canary and 10 Rust adapter tests passed |
| Node | darwin-x64 | Hosted optimized build, 68m31s; native runtime and 10 Rust adapter tests passed; binary imported and verified |
| Node | linux-arm64-gnu | Hosted native runtime and 10 Rust adapter tests passed; binary imported and verified |
| Node | linux-x64-gnu | Hosted native runtime and 10 Rust adapter tests passed; binary imported and verified |
| Node | linux-x64-musl | Hosted native runtime and 10 Rust adapter tests passed; binary imported and verified |

All Bare binaries and archives are centralized in the Bare checkout.
Its .utexo-native-overlay.json contains all seven matching identities/hashes and
is stable for consumer imports. All iOS slices target minimum iOS 16.0;
the local device slice used SDK 27.0 and hosted simulator slices SDK 18.5.
Android uses NDK 27.1.12297006/API 29. The 64-bit ELF checks include 16-KiB
layout, RELRO/DYNAMIC/GOT protection and retained Rust TLS code.
ARMv7 passes the applicable provenance, symbol and lifetime checks; the
64-bit-only 16-KiB check is not applied to ARMv7.

Node binaries are centralized in the Node checkout with their original
provenance sidecars. GNU x64 and arm64 ran on Ubuntu 22.04 with Node 22.23.0;
both inspected binaries require glibc symbols through 2.34. Runtime evidence
is retained under target-artifacts/38213891152/<target>/; completed job logs
record each native smoke and all 10 passing Rust C-FFI adapter tests.
The musl binary passed on Alpine 3.23 with Node 24.18.1 and no glibc dependency.
Intel macOS passed with Node 22.23.2 and macOS deployment target 13.0.
All five Node binaries and provenance sidecars are available in the Node
checkout; the original local Darwin arm64 binary remains unchanged.

### Frozen Bare Addon Hashes

| Target | Addon SHA-256 |
| --- | --- |
| darwin-arm64 | db8c52c9227c916bdc7c05492f248d74ef1341443244bef0c07dd8a01e2642ce |
| ios-arm64 | dc58beabb3388c8634491fc09e547baec7a021e3af0b251b79a8171d2b749a20 |
| ios-arm64-simulator | d3f380e97d9862aee37b141248f2f27a41d4dfe28c7fff88976b41a34d54e01d |
| ios-x64-simulator | b3e4a1943500b8311b80949d6d3418e0d68c4127200bb5560e9139dacce0284f |
| android-arm64 | 9bdcfedb64bde03682094e8ac242e2a8bd2fd9be2905a3b22baed3aeaa47022a |
| android-arm | 61985184d28d9ef8f4ad6963da56dfd59d89a7db893523e520f85f3aded7a820 |
| android-x64 | 7a14e7bfb29bafdc29e20270a4b90fd69aa933804b46058fdf58acbeeec741ed |

Static archive hashes are recorded alongside those addon hashes in the
shared Bare manifest. Verified Node addon hashes:

- darwin-arm64: f3d7c0b51b8a9fef4119dcc2b937486f91683c97e8e50067b821821b287f343e
- darwin-x64: 2857d98813baa717b5739bd7e277a4922500ecd07160f644a52e5a281d64c18c
- linux-arm64-gnu: d687adaa64e09dccca8ca3ba7ed97bf65a4a0aa558f21c884af2a62e7cc64f93
- linux-x64-gnu: deac8a2b643d4f0aeedf087f93b7ee61618206e7dc09148ff3678ce6d006eab3
- linux-x64-musl: 8e9ba130e97d217487c8a607e5078a7f4bd163a21a1030f37a8014a5e1297eb1

## Integration and Qualification Scope

Iris integration imported all seven Bare targets with provenance checks;
wdk:generate completed for iOS and Android. Application build and runtime
qualification are tracked separately from these native artifact gates.

Independent host qualification used WDK c941925 with the frozen Bare Darwin
addon on fixture-only Bare 1.34.1: received 1,000,000 BFA, sent 250,000,
burned 100,000, and reopened Alice/Bob with 650,000/250,000.
Exported 8,881 bytes have SHA-256
edf380a96e3cbd265451ae798f413564b30c8efb7560cc5f0b1091408dfaded9.
Independent beta47 consensus validation passed with a live Bitcoin resolver,
IssuedAmountCheckExt and Anvil FundsIn; missing events, wrong amount and wrong
recipient were rejected. Evidence:
/tmp/iris-bridge-implementation-20261012/docs/engineering/bfa-wdk-qualification-20261012.md

This is Bare-host BFA qualification, not Node-funded, mobile, physical-device
or EVM-payout qualification. No general same-process unlocked-signer recovery,
crash atomicity, mainnet Lightning or production approval is inferred.
Historical failures are not silently treated as fixed by a source update.
Wallet/test data and Docker services and volumes were preserved.

## Disk and Rebuild Notes

Initial free space was 9.5 GiB. Local native targets were compiled serially;
inactive caches were reclaimed as needed. Completed Cargo targets,
the repository-local Cargo download cache and duplicate artifact staging were
removed only after preserving verified binaries, manifests and logs.
The build commands above record the cache-assisted build configuration.
Those caches no longer exist: rebuilding requires the private-source access
helper scripts/with-source-access.js and an initial fetch without
CARGO_NET_OFFLINE=true. Node and Bare require isolated Cargo target directories.
Package versions are unchanged. Publication and production promotion remain
separate release gates.
