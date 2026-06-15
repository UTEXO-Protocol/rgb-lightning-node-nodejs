# UTEXO local patches over `rgb-lightning-node` upstream

CI-only mirror of the patch series maintained in
[`@utexo/rgb-lightning-node-bare`][bare]. Both bindings consume the same
`rgb-lightning-node/bindings/c-ffi` crate, so the same patch is applied
before the static lib / napi addon is built.

The release workflow clones `rgb-lightning-node` at the pinned tag and runs
`git apply patches/c-ffi-utexo-patches-<tag>.patch` (fail fast on conflict)
before `napi build`. The patch adds the `rln_sdk_node_apay_new` and
`rln_sdk_node_vss_clear_fence` extern "C" wrappers that upstream hasn't
merged yet.

Keep this file in lock-step with the copy in the bare repo. When upstream
exposes both wrappers natively, delete the patch from both repos and drop
the `git apply` step from the workflow.

[bare]: https://github.com/UTEXO-Protocol/rgb-lightning-node-bare
