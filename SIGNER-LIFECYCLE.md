# Explicit signer shutdown and owned sessions

Bare and Node use the same RLN `v0.17.0-beta.3` lifecycle overlay. The upstream
commit, overlay checksum and wrapper/build checksums are recorded in package
metadata, compiled runtime information and artifact provenance. This candidate
contains a native runtime repair; it is not plain upstream RLN.

Drain application operations, then use the following order for every signer:

```js
node.shutdown()
signer.shutdown()
signer.destroy()
```

All nodes sharing the signer must finish shutdown before revocation. Final
state persistence may still need the signer. `shutdown()` is explicit,
terminal and idempotent: it rejects new calls, waits for in-flight native
calls, revokes every outstanding clone and releases the backend, transport and
exclusive persistent VLS/redb lock. Poison recovery destroys private state
instead of silently skipping revocation.

`destroy()` and GC remain ownership-only operations. A host handle may be
released after attachment while the node retains its native clone. Such
release must not revoke a live node. Retain the handle when deterministic
explicit revocation is needed at shutdown.

WDK stops its node, revokes the signer and releases the handle, surfacing errors
and retaining the handles needed to retry failed teardown. Do not suppress a
shutdown failure or delete signer state to work around it.

The native patch also owns and drains session workers and connections, releases
the actual listener when configured with port zero, removes gossip-verifier
strong-reference cycles and cleans partial startup. Final persistence and
broadcast completions stay admitted until the background processor has exited.
Both `native-signer-shutdown-v1` and `owned-session-cleanup-v1` appear in compiled
capabilities. Complete overlay and wrapper hashes remain mandatory admission
checks.

Actual qualification must cover immediate same-store reopening in the same
process, stale clones, concurrent teardown, repeated sessions and operating-
system resources. Funded iOS 27 lock/unlock and BTC/BFA flows qualify Iris
separately; host canaries and compilation cannot substitute for them.

Iris stays on-chain only. No Lightning/channel, VSS failure-recovery or broader
production qualification is implied. Wallet migration is excluded because
Iris has not shipped; fresh local simulator state may be reset. Persistence
across the tested locks and restarts must still work without resetting that
test wallet. Source/artifact-specific results belong in the release tracker.
No merge or publication is part of this work.
