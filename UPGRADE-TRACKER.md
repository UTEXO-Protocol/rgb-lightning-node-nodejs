# RLN 0.13.0-beta.3 Upgrade Tracker

## Approved Import Extension (2026-09-27)

This candidate is RLN `v0.13.0-beta.3` (`af03c7f1a65135a429f05a5820600338215954dc`)
plus the narrowly scoped [RLN import PR #128](https://github.com/UTEXO-Protocol/rgb-lightning-node/pull/128)
at `5d5aa742984d52767e1055fed6aa154ad732d551`. It is not an unmodified upstream release.
The released RGB-lib revision, root Cargo lockfile and rust-lightning gitlink are unchanged.
Contract import validates public metadata and grants no balance. Transfer-consignment import
registers metadata only; it does not replace the normal RGB receive/settlement protocol.

Current checks: funded Rust SDK NIA/IFA import, idempotence, identity rejection, zero balance
before receipt, named IFA invoice, real transfer and allocation-preserving reimport passed.
Node host debug build, 14 wrapper/installer tests, native lifecycle canary and types passed.
Bare host debug build, 37 wrapper/installer tests and native lifecycle canary passed.
WDK: 706 tests, types, lint and package verification passed. Fresh-wallet IFA import
and actual named-invoice receipt/send settled on both Node and Bare 1.32.0. Both
started with zero imported balance, received 250000 units, sent 100000 units and
preserved the resulting 150000/100000 balances across reimport. Node also repeated
NIA/IFA/CFA/UDA receipt and two-sided transfer settlement. These are regtest fixtures,
not production USDT. Mobile release artifact requalification and final Iris integration
are in progress; historical artifact/runtime passes below do not qualify
this new import patch. No physical-device tests, publication or production approval.
The existing signer-reopen, reorg/recovery, VSS and deployment gates remain separate.


## 2026-09-26 On-Chain Binding Follow-Up

- Forward the released `pending_blinded` count through C-FFI and public types.
  The adapter advertises `pending-blinded-v1`; its SHA-256 is
  `4a4272cb616ceb2f21e01677a24fe7b246c233408c22e6a103bd2db1cea30c94`.
  No native wallet, signer, channel or dependency behavior changed.
- Thirteen JS/installer tests and declarations pass. Optimized macOS arm64
  rebuild and native offline ABI/lifecycle canary pass.
- WDK funded strict-regtest address-policy fixture passes on the rebuilt addon:
  blinded reservation counts 1/2 persist through restart, native non-reuse keeps
  setup outputs separate from unpaid witness scripts, and explicitly allocated
  and rotated BTC addresses remain discoverable after a process restart.
- This is not same-process unlocked signer recreation evidence. The retained
  signer database lock remains an upstream lifecycle blocker. Physical device
  runs are excluded. Other platforms must rerun CI for the updated identity.
- Coordinated adoption tracker:
  https://github.com/UTEXO-Protocol/wdk-rgb-lightning/blob/release/rln-0.13.0-beta.3/RELEASE-ADOPTION-TRACKER.md
- Updated native matrix run 36228166056 passed all five targets at `549c428`:
  macOS arm64/x64, Linux glibc arm64/x64, and Linux musl x64. This is optimized
  offline runtime/ABI/package execution, not funded networking on every target.
- Extended strict funded fixture `wdk-rln-address-policy-ScQkKP` passed seven
  checks, including actual settlement of witness invoices created before,
  between and after UTXO setup, then persistence after process restart.
- Disk-full fixture `wdk-rln-storage-0DGXfK` passed on the updated host adapter:
  bounded 128-MiB volume, independent ENOSPC proof, cold restart without state
  replacement, reconciled funds and an independently confirmed subsequent send.
- CI branch filter now follows the existing `release/rln-0.13.0-beta.3` branch.
- Updated strict interrupted-send fixture `wdk-rln-interrupted-BzwkU1` passes
  at 0/20/100-ms dispatch-relative timings, including an actual unacknowledged
  interruption. Recovery does not automatically resend. This is not proof of
  interruption at every native database-commit boundary.

Status: 2026-09-24 local released-runtime qualification completed within the
recorded scope, with unresolved strict-signer and same-process reopen blockers.
Draft PR, not release approval. CI applies only to its reported commit.

## Scope

- Target RLN `af03c7f1a65135a429f05a5820600338215954dc` (v0.13.0-beta.3).
- Target rust-lightning submodule `38d73bc918f27956590585d2bb83c86f059679b0`.
- Target RGB-lib v0.3.0-beta.34 and Rust 1.94.0.
- Candidate package line: `0.2.0-beta.1`; no npm publication in this task.
- Start from main. Do not merge dev/iris-wallet wholesale.
- No upstream wallet, channel, signer-policy, VSS or routing behavior patches.

## Implementation

| Work | Status | Required Evidence |
| --- | --- | --- |
| Dedicated upgrade branch | Done | `release/rln-0.13.0-beta.3` |
| Released native graph and bounded C-FFI adapter | Implemented | Eight binding/build files only; locked debug and optimized host builds passed |
| Wrapper types, unsupported capability rejection, exact numbers | Verified locally | 12 JS/installer tests and declaration checks pass |
| Source install/provenance/artifact workflow | Verified on host | Exact graph, adapter, lock, wrapper, target and artifact identity; final packed Node/WDK source install passed |
| Unit/type/lint/package checks | Verified locally | Type checks, 12 JS tests, Rust formatting and packed consumer passed |
| Linked native/runtime conformance | Partial | Optimized macOS arm64 offline canary passed; other targets/network remain gates |
| Final diff review | In progress | Release graph, adapter equality, lifecycle and packaging reviewed; external maintainer review required |
| Cross-repository draft PR links | Done | Links below |

## Explicit Release Gates

| ID | Gate | Status |
| --- | --- | --- |
| G1 | Existing colored-channel migration | Out of scope: owner confirmed no live wallets on 2026-09-24; fresh wallets only, no migration compatibility promise |
| G2 | Old password-encrypted mnemonic migration | Out of scope under the same owner decision; no reset or stale-state rollback workaround |
| G3 | Full desktop/mobile build and runtime target matrix | Pending |
| G4 | Controlled two-node/regtest and operator-coordinated LSP asset flow | Real local Node/Bare flows executed; strict outgoing signer and same-process reopen blockers remain. Deployed Signet/mainnet LSP qualification is separate |
| G5 | Integrator zero-channel report root cause | Unproven: deployed build IDs and server provisioning logs required |
| G6 | Current app depends on excluded overlay features | Separate adoption gate; do not change app pins |
| G7 | Candidate publication, promotion and merge | Not authorized by this draft-PR task |
| G8 | GitHub OAuth credential lacked workflow scope | Resolved: user refreshed authorization; implementation through 875cff3 pushed successfully on 2026-09-23. Draft #22 contains the implementation and CI has started. No safeguards removed |

Excluded capabilities: coherent wallet snapshot/FullSync, native operation registry,
prepared-send plans and inventories, address receipts, RLN import APIs, VSS delete-all
and native routing fee caps. Persistent signer and address-attested APay forwarding
are allowed only because their underlying behavior is already released.

No automatic wallet reset, seed-only recreation, stale-state rollback, implicit
virtual-channel trust change, or replacement of an unsupported safety guarantee with
a weaker implementation.

## Verification Log

### 2026-09-24 Local Follow-Up

- Fixed normal node-info failure on u64::MAX: exact response integer tokens now
  become decimal strings outside the safe range; unsafe numeric inputs still fail.
  Pinned lossless-json 4.3.1 and rebuilt optimized native artifacts.
- Real strict Node/Bare on-chain NIA/IFA/CFA/UDA receipts and witness transfers pass
  with two-sided settlement and reconciled balances.
- Separately labelled permissive regtest diagnostics pass standard BTC/RGB
  Lightning, keysend, HODL, hard process restart, post-restart payment and channel
  closes. These do not qualify strict signing or mainnet.
- Node/Bare IFA LSP diagnostics pass real standard-channel provisioning, signed
  APay registration/proof/payment/claim and both bridge directions. On-chain
  delivery was checked independently of Lightning success.
- Strict outbound payments still stall awaiting signer; incoming LSP funding and
  proof verification succeed. No signer policy was weakened.
- Same-process persistent signer recreation fails after actual unlock, even for
  an unfunded Node wallet. Both wrappers free their node/signer handles. Released
  announcement-task retention is a leading upstream lifetime explanation; no
  upstream patch or database-lock bypass was added.
- VSS is disabled in this profile; upstream VSS repair is outside this task.
  Existing-wallet migration is excluded by owner decision, not a remaining gate.
- Full commands, run IDs, limitations and upstream evidence:
  [WDK qualification](https://github.com/UTEXO-Protocol/wdk-rgb-lightning/blob/codex/rln-0.13.0-beta.3/tests/regtest/QUALIFICATION.md).

### Earlier Implementation Evidence

- Baseline source/branch audit completed before implementation.
- Results below will distinguish mocked tests, linked host smoke, compile-only
  cross-builds, device tests and funded/network qualification.
- Only disposable local regtest wallets were funded. No real-network funds or production wallets were used.
- `npm run check:types`: pass. `npm run test:unit`: 12 passed.
- `npm run build`: optimized macOS arm64 build passed in 19m44s.
- `npm test`: real optimized addon identity, offline init, error paths, disposal,
  persistent signer restart/permissions and unsupported-capability checks passed.
- Two C-FFI Rust adapter tests passed on the debug build.
- Upstream release has an unused `stats` warning in rust-lightning; no behavior
  patch was added. Explicit Apple C/C++ deployment flags fixed the mixed-floor warning.
- `npm audit`: zero vulnerabilities after a targeted js-yaml lock update.
- Source builds are intentional, not prebuilt/no-Rust installs. Candidate workflow
  actions are SHA-pinned; no publish, tag-write or release-write permissions.

## Coordinated Drafts

Latest verification: final optimized rebuild (11m09s), all 12 JS/installer tests
and native offline init/error/disposal/persistent-signer-reopen canary passed.
Two Rust adapter tests and declaration checks passed. Clean packed Node/WDK
source installation and final tarball retest passed (92 packages, nine-minute
source/dependency-cache-assisted install). These are host,
offline results, not mobile, network, VSS failure or migration qualification.

The Bare graph failed when sharing Node's Cargo target, then passed unchanged
using a dedicated Bare target. Keep caches isolated per package/source checkout;
the precise Cargo invalidation cause is not established. No upstream workaround.

- [Node #22](https://github.com/UTEXO-Protocol/rgb-lightning-node-nodejs/pull/22)
- [Bare #20](https://github.com/UTEXO-Protocol/rgb-lightning-node-bare/pull/20)
- [WDK #43](https://github.com/UTEXO-Protocol/wdk-rgb-lightning/pull/43)
