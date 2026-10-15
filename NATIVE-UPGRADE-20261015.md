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

The final canonical 26-file overlay is
`7f89dc518f8fe69dc6baf62c4ee96e9d5a25d6b6ae70ab529c7b4bcc65979c90`.
Focused native/C-FFI qualification passes 45 tests; Node unit checks pass 30.
Earlier locally built Darwin arm64 Node and Bare binaries each passed 123
lifecycle cycles (246 total), four failed-unlock rollback cases across both
runtimes and six additional early-host-free sessions. Those local binary
results retain their own artifact identities. Independent final native review
finds no actionable correctness issue in the reviewed overlay and wrappers.

The complete [five-target optimized Node runtime matrix](https://github.com/UTEXO-Protocol/rgb-lightning-node-nodejs/actions/runs/38698331825)
passed at source `2caa14962e6a7e10549c888880d46c85aee0b81d`. Darwin arm64/x64,
GNU Linux arm64/x64 and musl Linux x64 each executed the optimized native
identity, offline persistence/lifecycle, error and adapter tests on the actual
target runtime. GNU artifacts report a glibc 2.34 floor; musl was executed in
real musl userland. Every original ZIP passed its GitHub SHA-256 and exact
source, wrapper, recipe, lock, target and runtime-evidence admission checks.

All five addons and their original provenance sidecars were imported into the
repository's ignored caches using pure standard admission, atomic copies and
the standard installer per target. All 10 files match the admitted originals;
no build/fetch or identity-bearing source change was needed. Both the assembled
package and repository release-artifact gates pass. The companion
[seven-target Bare matrix](https://github.com/UTEXO-Protocol/rgb-lightning-node-bare/actions/runs/38698325319)
also passed at source `c56718bb340fc062b0e4075d91974f820deaf834`; all seven
static libraries/prebuilds and the manifest were imported through its standard
artifact installer with exact original hashes, and both release-artifact gates
pass. Original archives, sidecars and successful CI logs are retained. Bare
mobile CI establishes compilation/packaging; runtime and financial acceptance
remain separate. Artifact admission does not establish full release qualification.

The exact original CI Darwin artifacts also pass hosted tests on macOS 27.0.1:
Node 22.23.3 arm64, official Intel Node 22.23.3 under verified Rosetta translation,
and Bare 1.33.4 arm64. Each configuration passes its native canary, 20 fixed-port
lifecycle cycles, one additional early-host-free session with real signing,
and a clean packed WDK consumer's same-process reopen. Every closed checkpoint
has zero wallet/signer descriptors and listeners immediately, without settling
retries. These 60 CI-artifact cycles are additional to, and distinct from, the
246 earlier local binary cycles. Exact hashes and live OS mappings appear in
the `ci-node-arm64`, `ci-node-x64-rosetta` and `ci-bare-arm64` qualification
summaries under workspace evidence
`release-evidence/2026-10-15/signer-lifecycle-fix/`.

All three final iOS inputs, the full XCFramework and normal Iris worklet are
admitted. The existing iPhone 18 Pro iOS 27 simulator also passes standalone
native C-FFI CLI execution against the exact original simulator library
(`12052118b413f33eabee69d994e35657dcac01378106d01463840a8c5213ee19`):
18 lifecycle cycles, two forced-failure same-SDK retries and three additional
early-host-free sessions with real signing. All closed wallet/signer descriptor
and listener counts are zero. This Foundation-only executable's results are in
`ios27-native-cli/qualification-summary.json`; they do not establish Iris UI,
authentication, background, financial, physical-device or app-sandbox acceptance.

Debug and Release QA builds pass static provenance, iOS slice, scene manifest,
export and signature checks. Three standalone Release cold launches with Metro
stopped reach the normal locked screen. Subsequent normal OS authentication
reaches application UI with balances unavailable, Send Continue disabled and
native resources `0/0/0`, consistent with the unchanged production gateway
guard. This is scoped startup/authentication/fail-closed evidence; funded
Release and production-gateway behavior remain unqualified.

The normal on-chain Debug regtest scope on the existing iPhone 18 Pro/iOS 27
simulator now passes the following exact-artifact acceptance:

- Fresh BTC receipt of 2,000,000 sat and exactly one reviewed/native-authenticated
  10,000-sat send (2,845-sat fee), followed by four 20,000-sat RGB outputs
  (5,665-sat fee). Authentication-cancellation controls submit no payment/setup.
- One 2-USDT BFA receipt and one 0.5-USDT return both settle, leaving Iris
  1.50 USDT and the holder 16.98 USDT, preserving the 18.48-USDT test-pair total.
  The pending return survives manual lock/reopen before receiver ACK with the
  same anchor and exactly one pending entry; it settles only after ACK,
  broadcast and confirmation. Independent native/Esplora accounting verifies
  the result, fees, unspent outputs and absence of duplicate or mint/burn entries.
- Ten valid manual lock/reopen cycles release signer/wallet database/listener
  resources to `0/0/0` and reopen to `1/2/1` after normal authentication.
  Each valid cycle stays within its process; the ten cycles span a separately
  recorded cold restart. Funded cold authentication restores 1.50 settled USDT
  and 1,901,490 native vanilla sat.
- Actual device Home backgrounding passes a 10.59-second return without locking
  and three long returns (35.95, 35.67 and 35.60 seconds) that resume locked at
  `0/0/0`, then authenticate to `1/2/1` with funds preserved. Offscreen snapshots
  still show live resources; zero-resource claims apply to resumed locked
  checkpoints. The earlier AXe Home attempt did not background the app and is
  invalidated, not counted as a product background result.

This qualifies the P01 repair for these normal funded Debug simulator lifecycle
cases, in addition to the separately recorded host/native scopes. It is not
full Release, Android, physical-device, public Signet/mainnet, channel or general
crash/recovery qualification. The independent roundtrip and background records
are `bfa-setup/fresh-btc-bfa-roundtrip-ledger.json` and
`ios27/background-lifecycle-qualified.json` under the evidence directory above.

Two adverse observations remain explicit. The first normal erasure attempt
failed verified erasure after clean native shutdown; a normal Metro reload
resumed the already authorized journal and cleared the seed/journal, SQLCipher
artifacts and native wallet path. Its first-failure cause remains unresolved;
this is not a clean first-attempt erasure pass. A separate interrupted Debug
reload attempt retained one signer descriptor (`1/0/0`) until cold restart and
is excluded from the ten valid cycles. A successful retry does not relabel it.
Final UI history has exactly four BTC/BFA receipt/payment entries; the outgoing
BFA detail is Settled with 142/3 confirmations and the 5,100-sat fee. Two normal
refreshes preserve balances without duplicate entries. These financial results
are local Debug regtest; positive funded Release acceptance remains separate.
October 14 observations retain their original dated identities.

The explicitly user-authorized canonical local ownership overlay qualifies
P01 for the host/native and normal iOS 27 Debug regtest scopes above; an upstream
merge or process isolation is not a prerequisite. Android, positive funded
Release and public-deployment closure remain open, as do P02/P03/P04/P06,
security and distribution gates. The first erasure failure and interrupted
Debug reload remain unqualified boundaries.

Iris stays on-chain only. Wallet migration is excluded because Iris has not
shipped; local simulator state may be reset. Balances, history and signer state
must persist across locks/restarts of the same test wallet. Channel, VSS failure
and other production/security gates remain separate. No merge, tag, package
publication or GitHub release is part of this change. October 14 results retain
their historical identities and cannot establish this repair's qualification.
