# Released RLN Adapter

Only `c-ffi-release-adapter-v0.13.0-beta.3.patch` is active.
It applies to RLN `af03c7f1a65135a429f05a5820600338215954dc` and changes
only the eight allowlisted files in `scripts/release-contract.js`.

Permitted changes: C-FFI wrappers for released persistent signer/address-attested
APay APIs, existing invoice field serialization, compiled build identity,
generated headers, and lock/transaction-sync patch-map correction.

No root RLN, rust-lightning, wallet, channel, signer, VSS or payment-routing behavior
changes are allowed. The former behavior overlays have been removed from this line.
Use the same adapter bytes in Node and Bare. Regenerate headers from this exact
adapter; any source changes require a new hash and requalification.
