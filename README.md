# @utexo/rgb-lightning-node-nodejs

Node.js (napi-rs) bindings for [`rgb-lightning-node`](https://github.com/UTEXO-Protocol/rgb-lightning-node).

The Node counterpart to [`@utexo/rgb-lightning-node-bare`](https://github.com/UTEXO-Protocol/rgb-lightning-node-bare) — same C-FFI surface (`librlncffi.a`), same `SdkNode` + `NativeExternalSigner` JS API, picked automatically at module-load by [`@utexo/wdk-rgb-lightning`](https://github.com/UTEXO-Protocol/wdk-rgb-lightning) based on the runtime (bare worklet → bare addon, Node → this package).

## Install

```sh
npm install @utexo/rgb-lightning-node-nodejs
```

A `postinstall` script downloads the matching `.node` prebuild from the GitHub Release for this package version. Supported targets: `darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-x64-musl`, `linux-arm64-gnu`.

## Architecture

```
JS                  Rust crate ("rln-node", crate-type=cdylib)        Static lib
─────────────       ──────────────────────────────────────────        ──────────────
SdkNode    ───►     #[napi] impl SdkNode { … }            ───►        librlncffi.a
                       │                                                   │
NativeExternal ───►    #[napi] impl NativeExternalSigner    ─►            (same .a the
Signer                                                                     bare addon
                                                                           builds against)
```

Each `#[napi]` method serialises its request to a C string, calls the matching `rln_*` C-FFI function, and parses the `CResultString` back. Throws `napi::Error` on the `Err` branch.

## Build from source

Requires the `rln-c-ffi` static lib built for the host (or whichever target you're cross-compiling for):

```sh
# In the rgb-lightning-node tree:
bash bindings/c-ffi/build-for-host.sh  # writes target/release/librlncffi.a

# Here:
npm run build  # produces index-<platform>.node via napi-rs CLI
```

## Status

Initial scaffolding — covers the methods used by `@utexo/wdk-rgb-lightning`. See `src/lib.rs` for the implemented surface.
