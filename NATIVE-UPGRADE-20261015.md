# Signer and session lifecycle repair: October 15, 2026

## Environment and erasure follow-up

Current implementations are Node `6079afea5859193dea39f390376219d8dbfef332`
(12 new terminated-worker regressions; production native ownership unchanged),
Bare `95e2c844dc2c76e3f83d6f1a0dcf76d74f17fef7`, Iris
`cef3e1ebfa5e4b2fafca574ea9796f559157d7c2` and unchanged WDK
`81182153193c9910e89a9d91b1d457e0725787aa`. Bare wrapper SHA-256 is
`ca3ac291fbb4af86fc0d091805f9f544031298f6ce94a66b99f8f1acd763d4f7`;
the 26-file `7f89dc51` overlay, RLN/LDK/rgb-lib and C-FFI lock are unchanged.

Bare fixes terminal signer ownership when a worker's external-object GC
finalizer does not run: same-environment nodes drain before signer revocation.
Its 100 local full-node terminations/201 OS checkpoints and separate 18 portable
worker cases pass. The replacement [seven-target Bare build](https://github.com/UTEXO-Protocol/rgb-lightning-node-bare/actions/runs/38718114135),
three Android staging checks, original-byte/provenance admission and isolated
complete assembled-package gate pass. All 14 original native files were imported
byte-for-byte through the standard installer and the repository gate passed;
the QA app retains separately archived local Apple bytes. These cache checks
are not Node runtime or funded app results.

Node's new contract CI passes. Its [current runtime rerun](https://github.com/UTEXO-Protocol/rgb-lightning-node-nodejs/actions/runs/38718172040)
is **4/5** completed passes with Darwin x64 still running at the recorded
`11:24 UTC` observation; the preceding five-target pass below is historical.

Subsequent fresh Iris controls confirmed app-owned Expo KV writer contention
(`SQLITE_BUSY`). Resource serialization, storage/key quiescence and shared journal
coordination now pass app regressions. The rebuilt iOS 27 Debug app passes cold
authorized-journal recovery and three normal CREATE → first authenticated
Settings erasures in one process, each `1/2/1` → `0/0/0`, with all four
databases/keys, native directory and journal absent and no retry/reload. Five
actual full Metro reloads pass on an unfunded wallet in PID `16174`, each
`1/2/1` → locked `0/0/0` → normally authenticated same-store `1/2/1`, without
injected methods, GC, restart or settling retry. Fresh BTC receipt of 2,000,000
sat and exactly one confirmed 10,000-sat payment pass, with a 2,845-sat fee and
1,987,155-sat change independently verified. Four 20,000-sat RGB outputs cost
5,665 sat. BFA 2 USDT in / 0.5 USDT out settles with a 5,100-sat return fee;
Iris 1.50 + holder 15.48 conserves the new 16.98-USDT baseline. An additional
full reload before holder ACK preserves the same pending anchor and one send
in PID `16174`, with locked `0/0/0` and normally reopened `1/2/1`, no resubmission.
Three funded manual cycles pass. Short background (5.355 s) stays active without
authentication; long background (40.422 s) reaches offscreen `0/0/0`, normally
reopening in PID `16174`. A funded cold restart enters PID `60403` locked at
`0/0/0` and normally reopens `1/2/1`, preserving balances. The independent ledger
conserves BTC/USDT: Iris 1,976,390 sat (1,901,490 vanilla + 74,900 colored),
holder 97,492 sat, external 10,000 sat and four fees 14,121 sat. Final refreshes
and all history filters retain four unique transactions without pending or
duplicate entries, matching the confirmed return anchor and 5,100-sat fee. See the [Iris follow-up](https://github.com/UTEXO-Protocol/utexo-mobile/blob/release/rln-0.15.0-beta.3/docs/engineering/lifecycle-recovery-validation-20261015.md)
for exact source/evidence and build-fixture limitations. All preceding counts
and artifacts below retain their historical scope; no production approval follows.

## Preceding native qualification

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
artifacts and native wallet path. That historical exception was not captured;
the subsequent confirmed cause and fixed erasure scope are recorded above.
The historical attempt is not a clean first-attempt pass. A separate interrupted Debug
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
security and distribution gates. The first erasure failure remains historical
evidence; follow-up recovery/first-erasure, five unfunded full Metro reloads and
fresh BTC/BFA roundtrips and an additional funded pre-ACK reload pass. Three
funded manual cycles, short/long background, funded cold restart and final
history/refresh checks also pass;
arbitrary crash recovery is not qualified by those scoped cases.

Iris stays on-chain only. Wallet migration is excluded because Iris has not
shipped; local simulator state may be reset. Balances, history and signer state
must persist across locks/restarts of the same test wallet. Channel, VSS failure
and other production/security gates remain separate. No merge, tag, package
publication or GitHub release is part of this change. October 14 results retain
their historical identities and cannot establish this repair's qualification.
