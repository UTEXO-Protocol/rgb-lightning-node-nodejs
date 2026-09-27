# Production RLN With Approved Imports

Only `release-import-adapter-v0.13.0-beta.3.patch` is active. It applies to
RLN `af03c7f1a65135a429f05a5820600338215954dc` and includes the rebased
[import PR #128](https://github.com/UTEXO-Protocol/rgb-lightning-node/pull/128)
at `5d5aa742984d52767e1055fed6aa154ad732d551` plus the existing C-FFI adapter.

The 23-file allowlist in `scripts/release-contract.js` includes the import SDK,
REST, UniFFI and C-FFI entrypoints and tests. The existing adapter forwards released
persistent signer/APay methods, invoice serialization and build identity, and fixes
the C-FFI lock/transaction-sync patch map. The root Cargo manifests/lock and released
RGB-lib and rust-lightning revisions are unchanged. There are no additional signer,
VSS, routing, synchronization or prepared-send behavior patches.

Contract import adds validated public metadata, not allocations. Transfer-consignment
import registers metadata for the native receive flow, not arbitrary spendable funds.
Both runtimes must use identical patch bytes. The native identity records both the
release base and import commit; changing sources requires new hashes and rebuilt artifacts.
