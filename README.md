# @utexo/rgb-lightning-node-nodejs

Node.js (napi-rs) bindings for [`rgb-lightning-node`][rgb-lightning-node]
(RLN) — the Lightning + RGB daemon built on LDK and [`rgb-lib`][rgb-lib].

This package is the Node counterpart to
[`@utexo/rgb-lightning-node-bare`][rgb-lightning-node-bare]. Both wrap the
same Rust C-FFI (`librlncffi.a`) and expose the identical `SdkNode` +
`NativeExternalSigner` JavaScript surface, so the WDK layer
([`@utexo/wdk-rgb-lightning`][wdk-rgb-lightning]) runs one code path across
runtimes — this package on Node.js (server, CLI, desktop), the bare addon
inside a Bare worklet on mobile.

> Status: pre-1.0 beta. The API surface is stable across the 0.1.0-beta
> line; native artifacts are distributed per release tag.

## Contents

- [Why a separate package](#why-a-separate-package)
- [Platform support](#platform-support)
- [Installation](#installation)
- [Usage](#usage)
- [API surface](#api-surface)
- [Seed handling](#seed-handling)
- [Architecture](#architecture)
- [Build and release (maintainers)](#build-and-release-maintainers)
- [License](#license)

## Why a separate package

Node.js can `dlopen` shared libraries; the Bare runtime cannot. The **Rust**
layer is shared, but the **JS-binding** layer is forked:

- This package builds with [napi-rs] into one platform-specific `.node`
  addon per host, loaded dynamically at `require` time.
- The bare sibling builds with `cmake-bare` into one self-contained `.bare`
  addon with the Rust statically linked in (required for iOS, where dynamic
  linking is disallowed).

Both expose the same JS API, so consumers — chiefly
[`@utexo/wdk-rgb-lightning`][wdk-rgb-lightning] — write a single
runtime-agnostic code path.

## Platform support

Prebuilt `.node` binaries are attached to this repo's GitHub Releases. The
`postinstall` script selects the artifact matching the host platform/arch
and the installed package version.

| Platform        | Resolver suffix     | Build host             |
|-----------------|---------------------|------------------------|
| macOS arm64     | `darwin-arm64`      | native                 |
| macOS x64       | `darwin-x64`        | native                 |
| Linux x64 glibc | `linux-x64-gnu`     | native                 |
| Linux x64 musl  | `linux-x64-musl`    | Alpine container       |
| Linux arm64     | `linux-arm64-gnu`   | native                 |

The musl variant is auto-selected on Alpine (`/etc/alpine-release`
present); all other Linux x64 hosts get the glibc build. Unsupported
platform/arch combinations throw a clear error at module load.

## Installation

```sh
npm install @utexo/rgb-lightning-node-nodejs
```

The package's `postinstall` (`scripts/download-libs.sh`) downloads the
matching `.node` prebuild from the GitHub Release for the installed
version. No Rust toolchain or cross-compiler is required on the consumer
machine.

If `postinstall` was skipped (`npm install --ignore-scripts`), fetch the
prebuild manually:

```sh
bash node_modules/@utexo/rgb-lightning-node-nodejs/scripts/download-libs.sh
```

You don't normally depend on this package directly — it's an optional peer
dependency of [`@utexo/wdk-rgb-lightning`][wdk-rgb-lightning], installed
alongside it for Node-side hosts. Install it explicitly only when calling
RLN from Node without the WDK layer.

Requires Node.js >= 18.

## Usage

The package exposes two classes (`SdkNode`, `NativeExternalSigner`) plus
module-level helpers. Requests and responses are plain JavaScript objects;
the JSON marshalling to/from the C-FFI is handled internally.

The example below uses the **external-signer** lifecycle — the mode the WDK
ships with, where the host owns the seed.

```js
const rln = require('@utexo/rgb-lightning-node-nodejs')

// Create the node handle (does not open the network yet).
const node = rln.SdkNode.create({
  storage_dir_path: '/path/to/persistent/dir',
  daemon_listening_port: 0,
  ldk_peer_listening_port: 0,
  network: 'regtest',
  max_media_upload_size_mb: 5,
  enable_virtual_channels_v0: false
})

// Build the in-process VLS signer from a host-owned 32-byte seed
// (64-char hex). permissiveSignerPolicy defaults to true.
const signer = rln.NativeExternalSigner.create(seedHex, 'regtest')

// First-launch init writes the key-source file to storage_dir_path.
// On every subsequent launch RLN throws Rln(Conflict) — swallow it.
try {
  node.initWithNativeExternalSigner(signer)
} catch (e) {
  if (!String(e.message).includes('Conflict')) throw e
}

// Bring the node online.
node.unlockWithNativeExternalSigner(signer, {
  bitcoind_rpc_username: 'user',
  bitcoind_rpc_password: 'pass',
  bitcoind_rpc_host: '127.0.0.1',
  bitcoind_rpc_port: 18443,
  indexer_url: 'tcp://localhost:50001',
  proxy_endpoint: 'rpc://localhost:3000/json-rpc',
  announce_addresses: [],
  announce_alias: 'my-node'
})

console.log(node.nodeInfo().pubkey)

// ...later — deterministic teardown (signer is dropped too).
node.shutdown()
signer.destroy()
```

## API surface

Request bodies follow the JSON schemas in `rgb-lightning-node`'s
`openapi.yaml`. All methods are synchronous and return parsed objects (or
throw `napi::Error` on the C-FFI `Err` branch).

**`NativeExternalSigner`**

| Method | Description |
|--------|-------------|
| `create(seedHex, network, permissiveSignerPolicy = true)` | In-process VLS signer from a 64-char-hex 32-byte entropy. |
| `bootstrap()` | Returns `{ node_id, account xpubs, master_fingerprint, ... }`. |
| `destroy()` | Eager drop; idempotent. |

**`SdkNode` — lifecycle**

`create(request)`, `initWithNativeExternalSigner(signer)`,
`attachNativeExternalSigner(signer)`,
`unlockWithNativeExternalSigner(signer, request)`,
`initWithExternalSigner(bootstrap)`, `unlockWithAttachedExternalSigner(request)`,
`detachExternalSigner()`, `shutdown()`.

**`SdkNode` — operations**

| Group | Methods |
|-------|---------|
| Info / sync | `nodeInfo`, `networkInfo`, `sync`, `address` / `getAddress` |
| Peers | `connectPeer`, `disconnectPeer`, `listPeers` |
| Channels | `openChannel`, `closeChannel`, `listChannels`, `getChannelId` |
| Invoices | `lnInvoice`, `decodeLnInvoice`, `invoiceStatus`, `rgbInvoice`, `decodeRgbInvoice`, `cancelHodlInvoice`, `claimHodlInvoice` |
| Payments | `sendPayment`, `keysend`, `listPayments`, `getPayment` |
| Swaps | `makerInit`, `makerExecute`, `taker`, `listSwaps`, `getSwap` |
| RGB issuance | `issueAssetNia`, `issueAssetUda`, `issueAssetCfa`, `issueAssetIfa` |
| RGB assets | `listAssets`, `assetBalance`, `assetMetadata`, `sendRgb`, `inflate`, `listTransfers`, `refreshTransfers`, `failTransfers`, `getAssetMedia`, `postAssetMedia` |
| BTC | `btcBalance`, `sendBtc`, `listTransactions`, `listUnspents`, `createUtxos`, `estimateFee` |
| VSS | `vssClearFence`, `vssBackup` |
| APay | `apayNew` |
| Signing / onion / diagnostics | `signMessage`, `sendOnionMessage`, `checkIndexerUrl`, `checkProxyEndpoint` |

**Module-level helpers** — `uniffiHealthcheck()`, `uniffiIsInitialized()`,
`sdkInitialize()`, `sdkShutdown()`. These exist for surface parity with the
bare addon (which uses them to manage a process-global tokio runtime). In
the Node binding the runtime is per-`SdkNode`, so these are stubs/no-ops;
they're safe to call.

See [`index.js`](./index.js) for the authoritative method list and
[`index.d.ts`](./index.d.ts) for type signatures.

## Seed handling

RLN never sees the BIP-39 mnemonic. The host derives a 32-byte BIP-32
entropy and passes it as `seedHex` to `NativeExternalSigner.create`. The
key-source file written by `initWithNativeExternalSigner` records only
public identifying data (xpubs, node id, master fingerprint). Re-deriving
from the same mnemonic on a later launch reproduces the same `seedHex`,
which matches the on-disk key-source — so the LDK node identity stays
stable across restarts. All channel-state cryptography runs in-process via
the VLS signer.

## Architecture

```
JS façade (index.js)        Rust crate "rln-node" (cdylib)         Static lib
────────────────────        ──────────────────────────────        ──────────────
SdkNode             ──►      #[napi] impl SdkNode { ... }   ──►     librlncffi.a
NativeExternalSigner ─►      #[napi] impl NativeExternalSigner ►    (rln-c-ffi, the
                                                                    same .a the bare
                                                                    addon links)
```

Each `#[napi]` method serialises its request to a C string, calls the
matching `rln_*` C-FFI function, and parses the returned `CResultString`,
throwing `napi::Error` on the error branch. `index.js` adds the JSON
stringify/parse layer so the JS surface matches the bare addon 1:1.

## Build and release (maintainers)

Releases are cut by the **Build and Release (Node)** GitHub Actions
workflow ([`.github/workflows/release.yml`](./.github/workflows/release.yml)),
triggered either by a `repository_dispatch` (`rln-release`) from
`rgb-lightning-node` or manually via `workflow_dispatch` with an
`rln_version` input (e.g. `v0.6.0-beta.1`). The workflow:

1. Clones `rgb-lightning-node` at the pinned tag and applies the C-FFI
   patch series at [`patches/`](./patches) (a no-op when the tag already
   carries the C-FFI surface upstream).
2. Builds the napi addon for every target in the matrix
   (`index-<suffix>.node`).
3. Attaches the `.node` artifacts to a GitHub Release and runs
   `npm publish`.

For a local host build:

```sh
# In the rgb-lightning-node tree (sibling checkout), build the static lib:
bash bindings/c-ffi/build-for-host.sh   # writes target/release/librlncffi.a

# Here:
npm install --ignore-scripts
npm run build         # release build → index-<platform>.node
npm run build:debug   # faster compile, slower runtime
```

## License

Apache-2.0. See [`LICENSE`](./LICENSE).

[napi-rs]: https://napi.rs/
[rgb-lightning-node]: https://github.com/UTEXO-Protocol/rgb-lightning-node
[rgb-lightning-node-bare]: https://github.com/UTEXO-Protocol/rgb-lightning-node-bare
[rgb-lib]: https://github.com/UTEXO-Protocol/rgb-lib
[wdk-rgb-lightning]: https://github.com/UTEXO-Protocol/wdk-rgb-lightning
