# RGB Lightning Node: Node.js

The **0.2.0-beta.3** candidate binds **RLN v0.15.0-beta.3 plus merged PR #192**, commit
`a17b685615750536f0320db1cd3f3ba68a8f1c57`. It is a breaking, release-based
replacement for the former 0.11 behavior overlay. See
[RELEASE-0.15-TRACKER.md](RELEASE-0.15-TRACKER.md) before adopting it.

## Installation

Installation reuses matching packed release artifacts after verifying provenance
and checksums, without requiring Rust. Missing, stale or corrupt artifacts trigger
the pinned, locked source build; they are never loaded as a fallback. Publication
requires all five release artifacts. This candidate is not yet published or fully
qualified.

Source builds require access to three private upstream BFA repositories even when
BFA is unused. Authorized CI uses `ORG_READ_TOKEN` through
`node scripts/with-source-access.js npm run build`; the credential helper is
restricted to those repositories and the token is not embedded in artifacts.
Source building requires Node 18+
(Node 22 is the tested development baseline), Git, Rust **1.94.0**, a C/C++
compiler, platform SDK, CMake, and native dependency prerequisites. Rust must
already be installed; installation does not silently change your Rust toolchains.

Supported build targets: macOS arm64/x64, Linux x64 GNU/musl, Linux arm64 GNU.
Unverified targets remain release gates in the tracker. There is no Windows or
Linux arm64 musl artifact. Linux GNU builds need OpenSSL development headers and
pkg-config; macOS needs Xcode command-line tools and CMake. Cross-compilation
also requires the target Rust standard library and platform compiler/sysroot.

The locally qualified GNU artifacts require OpenSSL 3 runtime libraries and
reference glibc symbols through 2.34; they were tested on Ubuntu 22.04. The musl
artifact was tested on Alpine 3.23 with OpenSSL 3 and libgcc. Rebuilding on a
different distribution can change these requirements; see the release tracker
for the exact tested runtimes and scope.

Without a verified packed addon, `npm install --ignore-scripts` is for inspection
only. Run `npm run build` after installing the
prerequisites. `npm run build:debug` is for local diagnostics only.
`RLN_NODE_TARGET` selects one of the target suffixes above for cross-builds.
The normal loader verifies the compiled release, adapter, wrapper, lock and target
identity before allowing node creation. Do not rename or reuse an old binary.

Build assets uploaded by CI are review artifacts. This installer never downloads
an unverified release binary. Anonymous clean-install qualification and approval
to redistribute the private-source build are required before publication.

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
  announce_alias: 'wallet',
  eth_rpc_url: 'https://ethereum-rpc.example.invalid'
})
```

The endpoints above are placeholders. `BlockSync` instead takes the four
`bitcoind_rpc_*` fields inside `config`. The top-level RGB indexer is independent.
`eth_rpc_url` is optional on both external-signer unlock entrypoints. Set it to
the Ethereum RPC for the asset's bridge chain for BFA validation; omitted/null
preserve the non-BFA behavior. PR #192 is built from its exact merged source,
because the published RLN release binaries do not contain it. The runtime
advertises `external-signer-eth-rpc-v1`; external-signer burn is still unsupported.
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
RLN 0.15 does not enforce a native routing-fee cap. Do not treat an uncapped payment
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

RGB contract and transfer-consignment metadata imports are released in RLN 0.15
(PR #128). Both validate payloads and
identity; neither creates balances. See `patches/README.md` for the exact pin.
No additional routing, signer-policy, VSS or persistence patch is included.
The allowlisted C-FFI adapter forwards persistent signer/APay registration,
serializes existing invoice fields, exports build identity and corrects build
metadata. The exact patch and dependency graph are checked before building.

`getConsignment(assetId, txid)` returns `{ bytes_hex }` from a locally saved
transfer. `getConsignmentPath(assetId, txid)` returns `{ path }`; keep this native
filesystem path inside the trusted host. Missing assets/transfers propagate native
errors. WDK converts the hex to `Uint8Array` and does not expose the path method.

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
in `RELEASE-0.15-TRACKER.md`; strict outgoing signing and same-process reopen still
block production. VSS is excluded from this profile. Runtime, adverse recovery
and deployed LSP qualification are not implied by unit tests. Overlay-dependent
WDK consumers need a separately reviewed API adaptation before adopting this line.

## Verification

`npm run check:types`, `npm run test:unit` and `npm test` are separate gates.
The last requires the compiled addon and runs an offline lifecycle canary; it does
not fund wallets, open channels, prove network connectivity or prove migration.
Candidate artifact builds do not publish npm packages or mutate version tags.
