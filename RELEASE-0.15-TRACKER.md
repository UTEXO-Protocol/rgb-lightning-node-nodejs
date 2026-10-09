# RLN 0.15 release tracker

Candidate `0.2.0-beta.3`, branch `release/rln-0.15.0-beta.3`, based on
`release/rln-0.13.0-beta.3`. No npm publication or production approval.

## Merged External-Signer BFA Follow-up

The current source is RLN `a17b685615750536f0320db1cd3f3ba68a8f1c57`,
the exact PR #192 merge. LDK, rgb-lib and the approved C-FFI lock are unchanged.
Both unlock entrypoints accept optional `eth_rpc_url`; the new compiled
`external-signer-eth-rpc-v1` capability prevents confusing this source build with
the older release binary. External-signer burn remains unsupported.

Current BFA results, RN comparison and remaining gates are maintained in the
[WDK BFA report](https://github.com/UTEXO-Protocol/wdk-rgb-lightning/blob/release/rln-0.15.0-beta.3/BFA-QUALIFICATION.md).
The qualification below records the previous candidate, not a retest of every
platform or failure mode against this new source.

## October 9 Platform Qualification

Source remains the exact PR #192 merge above. No dependency revision, adapter,
wrapper or lockfile was changed for these builds. All results are local;
neither publication nor CI authentication is implied.

| Target | Build and runtime status |
| --- | --- |
| macOS arm64 | Release artifact verified; Node 22.23.0 native load, declarations, 19 unit tests, offline canaries and fresh offline packed installation passed |
| macOS x64 | New optimized artifact built with Rust 1.94.0; the same checks and fresh offline packed installation passed under Node 22.23.0 x64/Rosetta; deployment target macOS 13 |
| Linux arm64 GNU | Optimized build, provenance, types, 19 unit tests, native offline canaries, ELF checks and fresh offline packed installation passed on Ubuntu 22.04 / Node 22.23.0 |
| Linux x64 GNU | The same build/runtime/artifact and packed-install checks passed on Ubuntu 22.04 / Node 22.23.0 under Docker x64 emulation |
| Linux x64 musl | The same checks passed on Alpine 3.23 / musl 1.2.5-r21 / Node 24.18.1 under Docker x64 emulation |

Evidence is retained locally in `/tmp/iris-node-platform-evidence-20261009/`.
The offline lifecycle canary does not fully unlock a funded signer and must
not be read as resolving the separate same-process database-lock failure.
Fresh consumers on all five targets installed the same complete local archive
plus the lockfile-matching
public lossless-json tarball offline, with credential environment variables
removed and empty npm configuration. Postinstall verified the prebuild without
creating a source checkout or compiler target directory. Every consumer also
verified all five packed binaries and their manifests. The complete-artifact
gate passes. `complete-matrix.json` records the archive SHA-256 shared by all
five consumer results. No registry package, release tag or hosted artifact was
published. These runs do not cover every supported Node version or physical
x64 hardware.

Docker reported `OOMKilled: true` for both arm64 link attempts. The first
container limit was 6 GiB; the second was raised from 7 to 7.5 GiB with swap
headroom, but the Docker VM had only 8 GiB RAM and 1 GiB swap. Release LTO,
optimization and codegen settings were not weakened. Docker Desktop was
increased to 12 GiB and restarted. All 20 recorded
services were stopped cleanly and restored; no container or volume was deleted.
The engine reports 12,528,300,032 usable bytes and the serialized build
containers have an 11-GiB limit with swap headroom. The original regtest tip
remains unchanged. ARM64 linking completed successfully with the same source
and optimization settings. Both GNU targets pass runtime checks; their binaries
require OpenSSL 3 and glibc symbols through 2.34, and were tested against glibc
2.35. These floors describe the inspected local binaries, not future CI builds.
Earlier failure logs:
`/tmp/iris-node-linux-arm64-build-resume-20261009.log` and
`/tmp/iris-node-linux-arm64-link-retry-20261009.log`.

The musl artifact also requires OpenSSL 3 and libgcc, but no glibc symbols.
The initial local ELF audit incorrectly required GNU's `NODELETE` flag on musl.
That audit assumption was corrected without changing the binary: musl retains
libraries across `dlclose`, confirmed by its
[loader documentation](https://wiki.musl-libc.org/functional-differences-from-glibc.html#unloading-libraries)
and an isolated load/close/reopen probe in the tested runtime. Evidence:
`musl-dlclose.json`. All three Linux artifacts pass RELRO, immediate binding,
non-executable stack, absence of RPATH and N-API registration-export checks.

`ORG_READ_TOKEN` was provisioned on October 9. Attempt 2 of
[Node contract CI](https://github.com/UTEXO-Protocol/rgb-lightning-node-nodejs/actions/runs/37629617616),
[all five native runtime jobs](https://github.com/UTEXO-Protocol/rgb-lightning-node-nodejs/actions/runs/37629617639)
and [Bare contract CI](https://github.com/UTEXO-Protocol/rgb-lightning-node-bare/actions/runs/37629619939)
passed. The scoped source-access helper is active; source authentication is no
longer a gate. Bare's contract job covers a host debug build, not its mobile matrix.

Inspecting the downloaded Node CI artifacts found a compatibility regression:
the ARM64 GNU job built on Ubuntu 24.04 and requires `GLIBC_2.38`; loading it in
the supported Ubuntu 22.04 container fails. Do not publish that artifact.
Both GNU CI targets now build and run inside the same Ubuntu 22.04 container
recipe, independent of host runner version. A tested libc-symbol gate rejects
GNU artifacts requiring newer than 2.35 and musl artifacts referencing glibc.
The candidate workflow reuses this matrix instead of a separate build recipe.
Both replacement GNU jobs in
[runtime run 37926368735](https://github.com/UTEXO-Protocol/rgb-lightning-node-nodejs/actions/runs/37926368735)
pass and require glibc symbols through 2.34. The assembled CI package excludes
the rejected ARM64 artifact: macOS/musl inputs come from the earlier passing
run, both GNU inputs from the corrected jobs. Every input passes the same
native source/adapter/wrapper/lock identity checks. The new PR merge-ref tree
is identical to the release-branch fix.

The same assembled archive passes all five fresh offline consumers and native
canaries, with no credentials, compiler invocation or native source fetch.
All Linux ELF checks pass, including the Ubuntu 22.04 glibc floor, OpenSSL 3
dependencies, RELRO/NOW and non-executable stack. Evidence and input origins:
`/tmp/wdk-release-ci-20261009/node-verified/complete-matrix.json`.
The wrapper/installer suite now has 21 passing tests. The funded macOS ARM64
CI addon also passes both external-unlock entrypoints (12 cases), all four
non-BFA schemas, and BFA receive/send/balance/history/export/cold-restart checks.
Unlocked same-process reopen, pending witness balances and adversarial BFA
event selection still fail their acceptance tests. Production is not approved.

## Previous Candidate Qualification

- Pin RLN `e2b39d5ae8da74525eafb58bc39b9a614c756a73`, LDK
  `6d6d061f840264296e7de2b1c64dac6c0dd7eb26`, rgb-lib beta.42-bfa and its
  four BFA overrides. Source allowlists and locked builds verify the graph.
- Replace the import backport with an eight-file C-FFI adapter. Released imports
  remain; no RLN/rgb-lib/LDK/VLS behavior patch is added.
- Expose released consignment bytes/path. Preserve strict persistent signing,
  lossless JSON and explicit unsupported capability errors.
- Verify packed prebuild identity/checksums before reuse. Publication requires
  the complete release artifact matrix; no silent old-binary fallback.
- 18 wrapper/installer tests and declarations pass. Actual native identity,
  error/lifecycle and mainnet Lightning rejection canaries pass on macOS arm64.
- Funded WDK tests pass for NIA/IFA/CFA/UDA receive/send/balance/export,
  six-decimal IFA contract import/settlement and bounded disk-full recovery.

## Open gates

Source authentication and the hosted ARM64 compatibility regression are resolved
with verified replacement artifacts. Five-target offline packed installs pass;
license/notices review and the remaining
runtime/network/recovery qualifications are still publication gates.

Host debug and optimized builds, native canaries and fresh packed-consumer
installs pass. Both optimized runtimes also pass the funded four-schema/export
matrix. Bare's seven-target artifact gate and Iris's final three-ABI Android
APK/AAB/split packaging checks pass using Iris's byte-preserving staging.
This does not establish that the generic Bare post-link path is safe.
Release-app interaction and remaining
mobile/network/recovery qualification are still open. Historical 0.13 results
are not reused as passes.

Fresh native failures include unlocked same-process signer reopen, strict
outbound Lightning and mature BTC force-close sweeping. Node crash tests also
reproduce an orphaned BTC input reservation after send preparation: the coin
remains on-chain, but spendable balance is zero. No native state was reset.

Five RustSec lockfile findings remain. rkyv/rsa are absent from the selected
normal/build graph; legacy rustls-webpki 0.101.7 is active through minreq and
esplora-client. Security applicability/remediation review remains open. Production
npm audit passes; that does not qualify native dependencies.

The [WDK release tracker](https://github.com/UTEXO-Protocol/wdk-rgb-lightning/blob/release/rln-0.15.0-beta.3/RELEASE-0.15-TRACKER.md)
contains the full evidence, ownership, compatibility and remaining PR/issue list.
Mainnet Lightning, mainnet IFA and external-signer burn remain unsupported.
Iris, the WDK base upgrade, existing-wallet migration and physical devices are
outside this change. UPGRADE-TRACKER.md is historical 0.13 evidence.

Draft reviews: [WDK #45](https://github.com/UTEXO-Protocol/wdk-rgb-lightning/pull/45),
[Node #24](https://github.com/UTEXO-Protocol/rgb-lightning-node-nodejs/pull/24),
[Bare #22](https://github.com/UTEXO-Protocol/rgb-lightning-node-bare/pull/22).
WDK CI passes. Native CI logs confirm missing ORG_READ_TOKEN, not successful
cross-platform builds. Both local complete-artifact gates now pass: five Node
targets and seven Bare targets. No registry package or release tag was created.
