# VSS backup integration

VSS is enabled in this maintained binding. Configure `vss_url` when creating the
node, initialize its normal signer, then unlock it. Omitting the URL or passing
`null` keeps a local-only wallet. An empty or malformed URL is an error rather
than a request to silently disable backups.

Use `https://vss-server.utexo.com/vss` for the hosted Utexo service. HTTPS is
required except for loopback HTTP or an explicitly authorized private HTTP
endpoint (`vss_allow_http: true`). Credentials, query strings, fragments,
whitespace and unsupported schemes are rejected before storage is opened; errors
do not echo the supplied URL. Leave `vss_allow_empty_restore` false unless the
caller explicitly intends to initialize a genuinely new remote namespace.

```js
const info = getRuntimeInfo()
// capabilities: 'vss-backup-v1', 'vss-backup-info-v1'
// frozen vss_policy: { supported: true, code: null, reason: null }

const checkpoint = node.vssBackup() // { version }
const status = node.vssBackupInfo()
// { backup_exists, version, backup_required, last_auto_backup_failed }
```

Both methods require an unlocked node configured for VSS. `vssBackup()` waits
for the native RGB snapshot upload and returns the server version.
`vssBackupInfo()` queries the real remote RGB snapshot and local dirty/error
state without uploading, restoring or clearing ownership. A missing remote
snapshot returns `backup_exists: false` and `version: null`; failure to read the
service throws rather than inventing a successful backup. Versions beyond
JavaScript's safe integer range are exact decimal strings. The status surface
reports whether an automatic-backup error exists; it does not expose arbitrary
native error text, paths, credentials, or a fabricated backup timestamp.

The native library retains its automatic mutation hooks. Hosts may serialize
additional explicit checkpoints after successful wallet changes and before
normal shutdown, without changing transaction success into backup success. A
successful RGB snapshot is not proof of full Lightning recovery or of every
other persistence stream. The runtime capability states that the API is
available, not that a server is healthy or a particular backup is current.

`vssClearFence({ password })` is an explicit recovery action on a locked node.
Only use it after verifying that the previous writer has stopped. This binding
never clears a foreign fence automatically, changes retryable upload failures
into success, or deletes a remote namespace. Local wallet erasure does not
promise remote archive erasure; `vssDeleteAll` remains unavailable.

## External signer boundary

The pinned upstream release supports external-signer VSS operationally, but its
VSS authentication/encryption identity is derived from the public bootstrap
metadata (node ID, both account xpubs, fingerprint, protocol version). The
existing SDK configuration, unlock request and external signer protocol provide
no input for a separate private VSS derivation. The external-mode fence-clear
path similarly reconstructs that identity from `key_source.json`, instead of
validating a mnemonic password. This binding does not invent a new identity,
use an internal mnemonic fallback, or upload the wallet seed to work around
that upstream external-signer limitation. Adding private signer-derived VSS
credentials requires a coordinated upstream signer/SDK contract.

The build preserves the exact RLN, LDK and rgb-lib pins, native signer/session
cleanup and BIP-322 support. Admission tests cover valid configuration, native
facade bypasses, malformed/insecure configuration and untouched existing data;
real disposable-wallet qualification is recorded separately from these tests.

## Preparing an existing cloud archive

`prepareVssRestore()` runs on an initialized, locked external-signer node before
any address load or unlock. It reads an existing positive remote archive version,
downloads through rgb-lib's public VSS transport/decryption client, validates the
complete wallet identity and configured network, and extracts only canonical
entries below the expected fingerprint into a private staging directory. It
requires the remote manifest version to remain unchanged across the download.
The adapter does not use the convenience `restore_from_vss` extractor, whose
server fingerprint/plaintext rename handling does not provide this containment.

A missing archive returns `{ restored: false, status: 'not_found', network,
node_id, master_fingerprint, version: null }`. This path neither unlocks nor
creates a cloud snapshot. Successful preparation returns the same bounded
identity fields with `restored: true`, `status: 'restored'` and the downloaded
version. Existing unmarked local wallet directories are never overwritten.

The archive is atomically promoted with no-replace semantics. A bounded, locally
HMAC-authenticated receipt is placed inside the staged wallet before promotion;
its random private key remains outside the archived fingerprint directory.
The receipt binds the destination, endpoint, signer identity, network, manifest
identity and downloaded version. Receipts arriving inside cloud archives are
discarded and replaced after an actual validated download. A later process can
resume an interrupted preparation only by validating this local receipt and key.
This is local crash-recovery provenance, not remote attestation or a repair of the
upstream external-signer backup credential protocol.

`vssRestoreInfo()` returns `null` or the successful receipt's six public fields
plus `unlocked`. That flag becomes true only when the current native node is
actually unlocked and the normal SDK consistency check has consumed its restore
marker. A prepared archive alone is not a verified wallet. Restoring an archive
also does not establish a full-chain recovery scan or complete Lightning recovery.

Local admission limits are 128 MiB compressed, 512 MiB expanded, 25,000 entries
and a maximum 2,000:1 per-entry expansion ratio. Traversals, noncanonical paths,
duplicates, symlinks, special files and foreign identity/network manifests fail
before extraction. The existing public SDK may allocate network response/chunk
buffers before the adapter can check compressed size; these are extraction and
local admission limits, **not an HTTP response memory bound**. Official sanitized
plaintext backups lack the required full wallet identity and fail closed. The
client's `with_encryption(true)` is not proof that a server's manifest claimed
encryption; this adapter does not invent that guarantee.
