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
Terminal shutdown closes the metadata database pool on its owning runtime,
draining parked SQLx connection-return work before reporting completion.
Nonterminal REST wallet lock keeps its database available for the next unlock.
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

## Environment and erasure follow-up

Node `6079afea5859193dea39f390376219d8dbfef332` adds 12 terminated-worker
regressions; its production native ownership code and shared overlay are
unchanged. Bare `95e2c844dc2c76e3f83d6f1a0dcf76d74f17fef7` separately fixes
terminal signer ownership when an external-object GC finalizer does not run.
Iris `cef3e1ebfa5e4b2fafca574ea9796f559157d7c2` fixes app-owned shared-KV
SQLite contention and erasure quiescence; WDK `81182153193c9910e89a9d91b1d457e0725787aa`
is unchanged. Cold authorized-journal recovery and three first-attempt Settings
erasures pass on iOS 27. Five unfunded full Metro reloads pass in the same
process, with zero locked native resources and authenticated same-store reopen;
fresh BTC/BFA receive/send and another full reload before BFA ACK also pass.
Three funded manual cycles, short/long background and funded cold restart also
pass, as do final refresh/history checks; arbitrary crash recovery remains
unqualified. See the [dated follow-up](NATIVE-UPGRADE-20261015.md#environment-and-erasure-follow-up)
for exact qualification scopes; historical funded results retain their inputs.
