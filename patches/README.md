# RLN 0.17 C binding adapter

`release-adapter-v0.17.0-beta.3.patch` applies to RLN SDK tag
`v0.17.0-beta.3`, commit `ecc69f20308231400561f6f060fea88acfa40cc4`,
LDK submodule `79b9eb5166546c62692d3a672986f385c7fe047d` and rgb-lib
`v0.3.0-beta.50-bfa` / `1b951af0c8233308c919975552487be19ad2a930`.

The eight-file allowlist in `scripts/release-contract.js` changes only the
C-FFI manifest, lockfile, build script, headers and three Rust binding files.
RLN, rgb-lib, LDK and signer runtime implementations remain upstream bytes.
Both native repositories contain byte-identical adapters.

The prior binding repairs remain: persistent external signer, address-bound APay,
invoice CLTV, structured RGB assignments, `pending_blinded`, and compiled
provenance. Upstream now supplies BFA Cargo overrides; this adapter adds only the
matching path-based transaction sync override. The reviewed h2 0.4.16 and rustls
0.23.45 lock updates remain. Existing security and runtime gates remain open.

Ethereum RPC forwarding, external-signer burn and BFA Lightning behavior come
from upstream. This source update does not enable Lightning in Iris or expose
new BFA Lightning methods in the wrappers. The compiled SDK version is now
correctly `0.17.0-beta.3`; source, adapter, wrapper, lock and target hashes remain
mandatory. Old adapters are retained solely as historical source evidence.
