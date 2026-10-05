# RLN 0.15 release tracker

Candidate `0.2.0-beta.2`, branch `release/rln-0.15.0-beta.3`, based on
`release/rln-0.13.0-beta.3`. No npm publication or production approval.

## Completed

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

Both native repositories need an `ORG_READ_TOKEN` Actions secret with read
access to the three private BFA repositories. No applicable secret was available
when checked. The scoped credential helper is implemented; no personal token
was copied to GitHub. Complete release builds, anonymous packed installs and
license/notices review remain publication gates.

Host debug and optimized builds, native canaries and fresh packed-consumer
installs pass. Both optimized runtimes also pass the funded four-schema/export
matrix. Fresh Android arm64 input checks pass, but bare-link 3.3.2/bare-lief
0.2.9 output fails 16-KiB RELRO alignment. Remaining 0.15 platform/runtime
qualification is open; historical 0.13 results are not reused as passes.

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
Mainnet Lightning, mainnet IFA and external-signer BFA/burn remain unsupported.
Iris, the WDK base upgrade, existing-wallet migration and physical devices are
outside this change. UPGRADE-TRACKER.md is historical 0.13 evidence.

Draft reviews: [WDK #45](https://github.com/UTEXO-Protocol/wdk-rgb-lightning/pull/45),
[Node #24](https://github.com/UTEXO-Protocol/rgb-lightning-node-nodejs/pull/24),
[Bare #22](https://github.com/UTEXO-Protocol/rgb-lightning-node-bare/pull/22).
WDK CI passes. Native CI logs confirm missing ORG_READ_TOKEN, not successful
cross-platform builds. Both complete-artifact publication gates reject the
currently incomplete matrices. No registry package or release tag was created.
