# Native Upgrade: October 12, 2026

Source commits/pushes and build-only workflow dispatches are authorized.
No publication, bridge PR merges, WDK edits or Iris edits.
Historical prebuilds are not qualified for this source. The complete release
artifact gates remain mandatory.

## Shared Source Identity

- RLN source/version: 8777d71d7781b408fcce89c9c965ae29e8ad2300 / 0.15.0-beta.3
- rust-lightning: fc5c4c64db36a9b6aa8cd878ca1225a977e67106
- rgb-lib: v0.3.0-beta.47-bfa / 74a096a5bfbba7744af16c36c3595a24464c134c
- Adapter SHA-256: f6d2959e1ceff0400cbd372759c4957cd5a52964f4ec646a79ee15c21b2291c0
- C-FFI lock SHA-256: a8f4a5d0985dd9ba319572ad7e4109f19b8b2f660e48fc8ae424ecdc764d9451
- Node wrapper lock SHA-256: cbacef855bf50b4a7737766b598e4750f3755ddfa178861a8d3a956a738907ac
- Rust toolchain: 1.94.0

Both adapters are byte-identical and change only the eight approved C-FFI
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

Owned Bare repo: /tmp/rln-android-link-20261010/bare
Owned Node repo: /tmp/iris-bridge-nodejs-20261012
Verified source: /tmp/iris-bridge-nodejs-20261012/.native-source
Shared read/download Cargo cache: /tmp/iris-bridge-nodejs-20261012/.cargo-cache
Bare compilation cache: /tmp/iris-bridge-nodejs-20261012/target
Node compilation cache: /tmp/iris-bridge-nodejs-20261012/target-node

Do not compile Node and Bare into the same target directory. Run one target
at a time, check free disk first, and retain all wallet/test data. Only generated
compilation caches may be removed after outputs and provenance are verified.

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
Do not reinterpret a cross-build as runtime execution.

Bare artifacts: lib/<target>/librlncffi.a, prebuilds/<target>/*.bare,
.utexo-native-overlay.json. Node artifacts: index-<target>.node and matching
index-<target>.provenance.json. Only build scripts may stamp provenance.

## Verification and Pre-Dispatch Matrix

This is the source-commit snapshot; later build/run evidence is recorded separately.
Source/adapter equality and both locked Git dependency graphs verified.
56 Bare and 23 Node unit tests pass. Type declaration checks pass in both repos.
No funded transaction or network burn was performed by this upgrade task.

| Package | Target | New-source status |
| --- | --- | --- |
| Bare | darwin-arm64 | Building; log native-darwin-arm64-build.log |
| Bare | ios-arm64 | Pending |
| Bare | ios-arm64-simulator | Pending |
| Bare | ios-x64-simulator | Pending |
| Bare | android-arm64 | Pending |
| Bare | android-arm | Pending |
| Bare | android-x64 | Pending |
| Node | darwin-arm64 | Pending |
| Node | darwin-x64 | Pending |
| Node | linux-arm64-gnu | Pending, available for parent handoff |
| Node | linux-x64-gnu | Pending, available for parent handoff |
| Node | linux-x64-musl | Pending, available for parent handoff |

The machine has the Apple Rust targets, Xcode SDKs and NDK 27.1.12297006.
Docker is available with approximately 12 GiB RAM and existing running services;
do not stop or delete those services or volumes to obtain build resources.
Initial disk was 9.5 GiB; parent reclaimed space to approximately 14 GiB.
