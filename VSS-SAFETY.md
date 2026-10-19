# VSS safety policy

This maintained binding disables VSS until upstream backup security and recovery
defects are fixed. This is containment, not a replacement backup implementation.
It applies to every signer mode and network exposed by this binding.

```js
const info = getRuntimeInfo()
// info.capabilities includes 'vss-safety-policy-v1'
// info.vss_policy is frozen and exactly:
// {
//   supported: false,
//   code: 'ERR_VSS_UNSAFE_UPSTREAM',
//   reason: 'VSS is unavailable until upstream backup security and recovery defects are fixed.'
// }
```

Any non-null `vss_url` rejects `SdkNode.create()` and compatibility
`sdkInitialize()` before a native handle, runtime, storage or remote transport is
created. Empty, whitespace and malformed URLs are also rejected. The supplied URL
and credentials are not included in the bounded denial message. Omit this field
or pass `null` for normal local-only wallet operation; this does not claim cloud
protection or change existing wallet data.

`vssBackup()` and `vssClearFence()` remain exported but are unavailable. Their
native path returns `Rln(FailedVssInit): ERR_VSS_UNSAFE_UPSTREAM: ...` without
accessing a remote server or clearing a fence. JavaScript facade bypasses, direct
Bare/N-API entry points and shared C-FFI initialization follow the same native
policy. Raw malformed arguments can still return the existing input-validation
error; they never enable transport. There is no bypass flag, automatic takeover,
new scheduler or new credential/backup protocol.

The read-only policy metadata describes runtime availability. It is not a remote
health check, proof that an existing archive is current, or verification of a
restored wallet. Existing archives are not read, modified or deleted by this
policy. It does not make already uploaded backups safe.

The pinned upstream external-signer VSS identity derives authentication and
encryption credentials from public bootstrap metadata. Additional upstream gaps
include non-mainnet namespace collisions, incomplete automatic mutation hooks,
chunked replacement atomicity and restore/fence recovery. These require a reviewed
upstream security/recovery contract and fresh qualification before enabling VSS;
passing a reachable URL or successful small backup is insufficient. Source pins
and upstream repositories are unchanged.

Native C-FFI tests check all supported networks, raw instance/global entry points,
empty/malformed URLs, an unchanged existing directory and a nonexistent directory,
and zero accepted connections at a loopback trap. The normal host canary also
checks the compiled policy, direct native bypass refusal, omitted/null local
operation and backup/fence refusal. Existing local signer reopen and BIP-322
qualification remain separate regressions. Run the normal package tests after
building matching native artifacts; old binaries fail provenance admission.
