# RLN 0.13.0-beta.3 Upgrade Tracker

Status: implementation pushed and verified locally on macOS arm64; GitHub CI
qualification is in progress. Draft PR, not release approval.

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
| Dedicated upgrade branch | Done | `codex/rln-0.13.0-beta.3` |
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
| G1 | Existing colored-channel state can be refused by released 0.13; exact old-artifact migration qualification and operational drain/close procedure required | Blocked |
| G2 | Old password-encrypted mnemonic records are not automatically supported; distinguish WDK external-signer key-source records | Blocked |
| G3 | Full desktop/mobile build and runtime target matrix | Pending |
| G4 | Controlled two-node/regtest and operator-coordinated LSP asset flow | Regtest execution pending; operator LSP qualification blocked on coordination and deployed-build evidence |
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

- Baseline source/branch audit completed before implementation.
- Results below will distinguish mocked tests, linked host smoke, compile-only
  cross-builds, device tests and funded/network qualification.
- No funded transaction or production wallet has been used.
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
