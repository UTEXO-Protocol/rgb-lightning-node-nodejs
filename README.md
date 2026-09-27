# RGB Lightning Node: Node.js

The 0.2 candidate line binds **RLN v0.13.0-beta.3**, commit
`af03c7f1a65135a429f05a5820600338215954dc`. It is a breaking, release-based
replacement for the former 0.11 behavior overlay. See
[UPGRADE-TRACKER.md](UPGRADE-TRACKER.md) before adopting it.

## Installation

This candidate deliberately retains a **source-build installation contract**.
Normal npm installation runs the pinned, locked Cargo build. It requires Node 18+
(Node 22 is the tested development baseline), Git, Rust **1.94.0**, a C/C++
compiler, platform SDK, CMake, and native dependency prerequisites. Rust must
already be installed; installation does not silently change your Rust toolchains.

Supported build targets: macOS arm64/x64, Linux x64 GNU/musl, Linux arm64 GNU.
Unverified targets remain release gates in the tracker. There is no Windows or
Linux arm64 musl artifact. Linux GNU builds need OpenSSL development headers and
pkg-config; macOS needs Xcode command-line tools and CMake. Cross-compilation
also requires the target Rust standard library and platform compiler/sysroot.

`npm install --ignore-scripts` installs JavaScript for inspection only.
It does not install a usable wallet. Run `npm run build` after installing the
prerequisites. `npm run build:debug` is for local diagnostics only.
`RLN_NODE_TARGET` selects one of the target suffixes above for cross-builds.
The normal loader verifies the compiled release, adapter, wrapper, lock and target
identity before allowing node creation. Do not rename or reuse an old binary.

Build assets uploaded by CI are review artifacts. This installer does not download
unverified release binaries and makes no no-Rust installation promise.

Use the default package-local Cargo target directory, or a dedicated cache per
package/source checkout. Sharing `CARGO_TARGET_DIR` between the Node and Bare
graphs caused Rust type/trait mismatches during qualification; an isolated Bare
build passed with the same sources. Do not treat a shared-cache failure as a
reason to patch or relax the approved dependency graph.

## Runtime Contract

```js
const { SdkNode, NativeExternalSigner, getRuntimeInfo } =
  require('@utexo/rgb-lightning-node-nodejs')

console.log(getRuntimeInfo())
// Supply a unique, durable wallet directory and signer directory.
// Keep the signer alive until node.shutdown() completes.
```

External unlock uses the released nested backend shape:

```js
node.unlockWithNativeExternalSigner(signer, {
  ldk_chain_sync: {
    mode: 'TransactionSync',
    config: { indexer_url: 'ssl://example.invalid:50002' }
  },
  indexer_url: 'ssl://example.invalid:50002',
  proxy_endpoint: 'rpc://example.invalid/json-rpc',
  announce_addresses: [],
  announce_alias: 'wallet'
})
```

The endpoints above are placeholders. `BlockSync` instead takes the four
`bitcoind_rpc_*` fields inside `config`. The top-level RGB indexer is independent.
Use `NativeExternalSigner.createWithStorage` with stable, wallet-specific storage.
The default policy is strict; permissive policy is an explicit non-mainnet option.
Persistent local signer storage does not establish fresh-device VSS recovery.

`refreshTransfers` returns `{ transfers: { [batchId]: { updated_status, failure } } }`.
The key is a batch-transfer ID, not a transfer-row index. Nulls and failure details
are retained. `listTransfers(assetId?, txid?)` and an object-filter overload support
combined filters. Returned UTXOs preserve `exists`, including false.

Native response integers outside JavaScript's safe range are exact decimal
strings; safe integers remain numbers. This preserves released node limits and
64-bit channel IDs without rounding. Unsafe numeric inputs, NaN and infinity
still throw `ERR_RLN_UNSAFE_NUMBER` before native calls. Full-range u64 request
inputs are not supported; decimal strings are not an alternative for released
request fields whose native schema requires a number.

Unknown `sendPayment` fields, including routing fee caps, fail before submission.
RLN 0.13 does not enforce a native routing-fee cap. Do not treat an uncapped payment
as a capped one. Released payment types do not promise overlay failure codes or
paid-fee fields.

## Excluded Overlay Features

The following retained compatibility methods always throw
`UnsupportedCapabilityError` (`ERR_RLN_UNSUPPORTED_CAPABILITY`) before native
access, and their declaration return type is `never`:

- Coherent snapshots and FullSync/FullScan wallet synchronization.
- Prepared/commit/cancel BTC, RGB and UTXO plans and pending plan inventories.
- Native asynchronous operation start/status/adopt/cancel.
- Address receipts and pending vanilla transaction inventory.
- VSS delete-all.

RGB contract and transfer-consignment metadata imports are the one approved
extension: RLN PR #128 rebased onto 0.13.0-beta.3. Both validate payloads and
identity; neither creates balances. See `patches/README.md` for the exact pin.
No additional routing, signer-policy, VSS or persistence patch is included.
The allowlisted C-FFI adapter forwards persistent signer/APay registration,
serializes existing invoice fields, exports build identity and corrects build
metadata. The exact patch and dependency graph are checked before building.

## Migration and Release Restrictions

Do not automatically open a wallet with existing colored channels on this
candidate. Released 0.13 deliberately rejects legacy colored-channel encodings.
Direct password-wallet users also need a supported procedure for legacy encrypted
mnemonic records; that specific format restriction does not apply to WDK's
external-signer key-source records. Seed-only recreation is not recovery of RGB,
channel or signer state. Never delete databases to make an upgrade proceed.

Do not roll back to stale state after new channel activity. The owner confirmed
no live wallets: this candidate is fresh-wallet only, with no legacy migration
promise. Real local transfer and diagnostic Lightning/APay evidence is recorded
in `UPGRADE-TRACKER.md`; strict outgoing signing and same-process reopen still
block production. VSS is excluded from this profile. Runtime, adverse recovery
and deployed LSP qualification are not implied by unit tests. Overlay-dependent
WDK consumers need a separately reviewed API adaptation before adopting this line.

## Verification

`npm run check:types`, `npm run test:unit` and `npm test` are separate gates.
The last requires the compiled addon and runs an offline lifecycle canary; it does
not fund wallets, open channels, prove network connectivity or prove migration.
Candidate artifact builds do not publish npm packages or mutate version tags.
