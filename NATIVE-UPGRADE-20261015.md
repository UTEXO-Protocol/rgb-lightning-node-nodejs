# Signer and session lifecycle repair: October 15, 2026

This unpublished `0.2.0-beta.4` candidate uses RLN `v0.17.0-beta.3`
(`ecc69f20308231400561f6f060fea88acfa40cc4`), LDK
`79b9eb5166546c62692d3a672986f385c7fe047d` and rgb-lib
`v0.3.0-beta.50-bfa` (`1b951af0c8233308c919975552487be19ad2a930`).
The dependency graph remains unchanged. The previous C adapter is superseded
by the identical Bare/Node lifecycle overlay: its complete checksum is in
package metadata and compiled runtime provenance. Old artifacts are rejected.

See [SIGNER-LIFECYCLE.md](SIGNER-LIFECYCLE.md) for explicit revocation versus
ordinary handle disposal and the required node/signer teardown order. The
native repair owns session and connection workers, removes strong verifier
cycles, releases ephemeral listeners, drains final broadcasts and persistence,
serializes terminal shutdown and cleans partial startup. Errors now reach the
host, and final build admission verifies exact native source without silently
applying a patch after compilation.

Implementation and focused tests are complete; fresh artifact and funded mobile
qualification are in progress. All five Node targets require rebuilt optimized
artifacts and their original sidecars; runtime execution is distinct from a
cross-build. Repeated actual same-process reopening must also pass without
explicit revocation, proving the ownership repair. Resource observations,
concurrency tests and iOS 27 BTC/BFA flows qualify separate boundaries.

Iris stays on-chain only. Wallet migration is excluded because Iris has not
shipped; local simulator state may be reset. Balances, history and signer state
must persist across locks/restarts of the same test wallet. Channel, VSS failure
and other production/security gates remain separate. No merge, tag, package
publication or GitHub release is part of this change. October 14 results retain
their historical identities and cannot establish this repair's qualification.
