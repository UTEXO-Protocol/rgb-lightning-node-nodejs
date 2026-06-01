# @utexo/rgb-lightning-node-nodejs

Node.js (napi-rs) bindings for [`rgb-lightning-node`][rgb-lightning-node]
(RLN) — the Lightning + RGB daemon built on LDK and [`rgb-lib`][rgb-lib].

The Node counterpart to
[`@utexo/rgb-lightning-node-bare`][rgb-lightning-node-bare] — same
underlying Rust C-FFI (`librlncffi.a`), same `SdkNode` +
`NativeExternalSigner` JS API, picked automatically at module-load by
[`@utexo/wdk-rgb-lightning`][wdk-rgb-lightning] based on the runtime
(bare worklet → bare addon, Node → this package).

## Why a separate package?

Node.js can `dlopen` shared libraries — the bare runtime can't. So while
the **Rust** layer is shared, the **JS-binding** layer is forked:

- This package builds with [napi-rs] → one platform-specific `.node`
  per host (loaded dynamically at `require`).
- The bare sibling builds with `cmake-bare` → one self-contained
  `.bare` addon with the Rust statically linked in.

Both expose the **same JS API surface**, so the WDK layer
([`@utexo/wdk-rgb-lightning`][wdk-rgb-lightning]) writes a single
code path that works in both runtimes.

## Platform support

Prebuilt `.node` binaries ship via this repo's GitHub Releases; the
postinstall script picks the right one based on host platform/arch.

| Platform        | Target                  |
|-----------------|-------------------------|
| macOS arm64     | `darwin-arm64`          |
| macOS x64       | `darwin-x64`            |
| Linux x64 glibc | `linux-x64-gnu`         |
| Linux x64 musl  | `linux-x64-musl`        |
| Linux arm64     | `linux-arm64-gnu`       |

## Installation

You don't normally install this package directly — it's a transitive
peer dependency of [`@utexo/wdk-rgb-lightning`][wdk-rgb-lightning] in
Node-side WDK demos. If you need RLN directly from Node, install it
explicitly:

```sh
npm install @utexo/rgb-lightning-node-nodejs
```

A `postinstall` script downloads the matching `.node` prebuild from
the GitHub Release for this package version. If postinstall was
skipped (e.g. `npm install --ignore-scripts`), run it manually:

```sh
bash node_modules/@utexo/rgb-lightning-node-nodejs/scripts/download-libs.sh
```

## Usage

The package exposes two classes (`SdkNode` and `NativeExternalSigner`)
plus module-level helpers. The example below uses the **external-signer**
lifecycle — the only mode the WDK ships with.

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

// Build the in-process VLS signer from a host-owned 32-byte seed.
const signer = rln.NativeExternalSigner.create(seedHex, 'regtest')

// First-launch init (writes key-source file to storage_dir_path).
// On subsequent launches RLN throws Rln(Conflict) — swallow it.
try { node.initWithNativeExternalSigner(signer) }
catch (e) { if (!String(e.message).includes('Conflict')) throw e }

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

// ...later
node.shutdown()
```

See `index.js` for the full method list (channels, invoices, payments,
swaps, RGB asset ops, BTC ops, VSS, APay, signing, diagnostics).

> **Seed handling.** RLN never sees the BIP-39 mnemonic. The host
> derives a 32-byte BIP-32 entropy and passes it as `seedHex` to
> `NativeExternalSigner.create`. The key-source file written by
> `initWithNativeExternalSigner` records only public identifying data
> (xpubs, node id, master fingerprint). Re-deriving from the same
> mnemonic on a later launch reproduces the same `seedHex`, which
> matches the on-disk key-source file — so the LDK node identity stays
> stable across restarts.

## Architecture

```
JS                  Rust crate ("rln-node", crate-type=cdylib)        Static lib
─────────────       ──────────────────────────────────────────        ──────────────
SdkNode    ───►     #[napi] impl SdkNode { ... }            ───►      librlncffi.a
                       │                                                  │
NativeExternal ───►    #[napi] impl NativeExternalSigner    ─►           (same .a the
Signer                                                                    bare addon
                                                                          builds against)
```

Each `#[napi]` method serialises its request to a C string, calls the
matching `rln_*` C-FFI function, and parses the `CResultString` back.
Throws `napi::Error` on the `Err` branch.

## Build from source (maintainers)

Requires the `rln-c-ffi` static lib built for the host (or whichever
target you're cross-compiling for):

```sh
# In the rgb-lightning-node tree:
bash bindings/c-ffi/build-for-host.sh  # writes target/release/librlncffi.a

# Here:
npm install --ignore-scripts
npm run build       # release build  → index-<platform>.node
npm run build:debug # debug build (faster compile, slower runtime)
```

After building, tag and upload to GitHub Releases:

```sh
gh release create v0.1.0-beta.X index-*.node
```

## License

Apache-2.0. See [`LICENSE`](./LICENSE).

[napi-rs]: https://napi.rs/
[rgb-lightning-node]: https://github.com/UTEXO-Protocol/rgb-lightning-node
[rgb-lightning-node-bare]: https://github.com/UTEXO-Protocol/rgb-lightning-node-bare
[rgb-lib]: https://github.com/UTEXO-Protocol/rgb-lib
[wdk-rgb-lightning]: https://github.com/UTEXO-Protocol/wdk-rgb-lightning
