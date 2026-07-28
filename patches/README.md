# UTEXO local patches over `rgb-lightning-node` upstream

CI-only mirror of the optional patch series maintained in
[`@utexo/rgb-lightning-node-bare`][bare]. Both bindings consume the same
`rgb-lightning-node/bindings/c-ffi` crate, so the same patch is applied
before the static lib / napi addon is built.

The release workflow clones `rgb-lightning-node` at the pinned tag and applies
`patches/c-ffi-utexo-patches-<tag>.patch` before `napi build` when that file
exists and is non-empty. Current tags build directly from upstream.

Keep overlays in lock-step with the copy in the bare repo. Tags without a
matching file are built directly from upstream.

[bare]: https://github.com/UTEXO-Protocol/rgb-lightning-node-bare

## c-ffi-utexo-patches-v0.10.0-beta.3.patch

Adds versioned dual-keychain synchronization, bounded decimal-safe wallet
snapshots, explicit Lightning routing-fee caps, and persisted actual routing
fees to the pinned v0.10 native source. It preserves complete Lightning
invoice decode metadata and stable tagged RGB assignments across C-FFI, and
also adds deterministic BTC/RGB prepare-and-commit plans, BTC plan
cancellation, and pending vanilla transaction inspection.
The same overlay permits a replacement trusted virtual channel only after the
previous native session reaches its terminal abandoned state.

Adds the versioned wallet synchronization and exact snapshot contract used by
WDK portfolio refreshes. Routine synchronization FullSyncs both Vanilla and
Colored keychains, recovery synchronization FullScans both keychains, and the
snapshot serializes all monetary values as bounded decimal strings. Keep this
file byte-identical to the Bare binding's overlay.

## c-ffi-utexo-patches-v0.9.0-beta.3.patch

Adds the versioned wallet synchronization and exact snapshot contract used by
WDK portfolio refreshes. Routine synchronization FullSyncs both Vanilla and
Colored keychains, recovery synchronization FullScans both keychains, and the
snapshot serializes all monetary values as bounded decimal strings. Keep this
file byte-identical to the bare binding's overlay.

## c-ffi-utexo-patches-v0.6.0-beta.1.patch

Intentionally empty. The apay_new / vss_clear_fence / vss_backup / hodl
c-ffi wrappers this series used to add were merged upstream into
rgb-lightning-node (PRs #62/#63/#66) and ship in tag v0.6.0-beta.1, so no
overlay is needed. The release workflow skips applying an empty patch.
