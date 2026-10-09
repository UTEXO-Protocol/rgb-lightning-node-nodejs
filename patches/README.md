# RLN 0.15 C binding adapter

`release-adapter-v0.15.0-beta.3.patch` applies to RLN 0.15 plus merged PR #192,
`a17b685615750536f0320db1cd3f3ba68a8f1c57`, and its unchanged rust-lightning
submodule `6d6d061f840264296e7de2b1c64dac6c0dd7eb26`.

The eight-file allowlist in `scripts/release-contract.js` is limited to
`bindings/c-ffi`: its manifest, lockfile, build script, headers and three Rust
binding files. It does not modify RLN, rgb-lib, VLS or LDK runtime behavior.

The adapter exposes the released persistent external-signer constructor and
address-bound APay registration, preserves invoice CLTV, emits structured RGB
invoice assignments and `pending_blinded`, and exports runtime provenance.
It supplies the coherent transaction-sync Cargo path and the four BFA overrides
needed by the released dependency graph. Compatible lockfile updates include
`h2` 0.4.16 and `rustls` 0.23.45; remaining advisories are release gates.

Ethereum RPC forwarding comes from merged RLN, not this adapter. Compiled
capabilities include `external-signer-eth-rpc-v1`. The source version remains
`0.15.0-beta.3`; the full commit distinguishes it from the older release binary.

Contract import and accepted-transfer metadata import are already in RLN 0.15
(PR #128). There is no import backport or separate import revision. These imports
do not credit arbitrary funds. Saved consignment export also comes from the
released C API; the Node and Bare wrappers expose its bytes and local path.

Both native repositories must contain identical patch bytes. The manifest pins
the patch, C-FFI lock, source graph and build recipe; the compiled identity also
binds the wrapper and target. Source changes require rebuilt artifacts.
