# Unreleased rgb-lib-bfa migration candidate

Candidate version: `0.2.0-bfa.1`. This branch has not been merged or published. Published beta.5 remains an independent baseline. The native graph is pinned in package.json, the exact maintained patch, Cargo locks and runtime contract; all generated binaries must match those identities.


## Strict gateway and proxy compatibility

Candidate `0.2.0-bfa.1` sends an empty JSON-RPC parameter array for EVM methods taking no arguments. Public-network startup requires an explicitly configured protocol-1.0 RGB proxy; the obsolete protocol-0.2 public fallback is removed. The local regtest proxy default remains supported and is validated by the same preflight.

| Source | Exact revision |
| --- | --- |
| RGB library | `89c37086a68ef792da75c62bce59b58b1d7952a0` |
| LDK | `bbe68189872c26088e351d034b05c58769cb996a` |
| RLN | `d10d679f0dd73246f6b475a44bdf13edd5f9b2a4` |
| Maintained adapter SHA-256 | `db4511e71a1c770def1aeeb5f1ab5e72e07fdd228627d6d744dce56b4b3bdcfe` |

This graph requires fresh native builds and separately frozen candidate archives. Previous `0.2.0-bfa.0` artifacts and qualification records retain their original identities and do not qualify this candidate.

The candidate adds `SdkNode.sendRgbInvoice` for protocol-1.0 proxy transfers. Pass the complete invoice without reconstructing its recipient keys or encryption fields:

```js
await node.sendRgbInvoice({
  invoice,
  asset_id: assetId,
  amount: '1000000',
  witness_data: null,
  donation: false,
  fee_rate: '2',
  min_confirmations: 1
})
```

Use canonical decimal strings when values may exceed JavaScript's safe integer range. Witness invoices additionally need their explicit Bitcoin output amount; proxy witness blinding is derived by the library and must not be supplied. An acknowledged proxy send needs at least 15 minutes remaining; wallet UI uses a 16-minute preflight margin. Decode returns additive `public_key` and `encryption`, with legacy `proxy_recipient_id` nullable. The old recipient-group boundary cannot invent missing proxy authentication data.

Iris remains on-chain only. Signer shutdown, retained-clone revocation, owned task/listener cleanup, native external signing, BIP-322, recovery access and the durable default-on VSS policy are preserved in the maintained adapter. VSS manifest v2 uses immutable generation keys and confirms the canonical remote commit before acknowledging a content-bound snapshot; interrupted/uncertain outcomes retain pending state. Fresh migration test stores are required; this branch does not claim old manifest format migration.

The new library does not provide old IFA linking, deferred consume for channel sweeps or explicit final-zero-locktime channel funding construction. **This candidate cannot open ordinary locally funded BTC or RGB Lightning channels.** The colored open preflight and funding event pass `Some(0)` to the guarded RGB builder; the vanilla funding event calls the guarded Bitcoin funding builder. Colored virtual funding is also blocked. These are terminal funding failures before signing, not merely a restriction on optional user-selected locktimes. Peer-funded incoming channels, existing-channel payments and uncolored synthetic virtual channels are separate paths and remain unqualified.

Ordinary on-chain BTC and complete-invoice RGB transfers use separate supported builders. Restoring channel funding requires a library-owned funding API that sets final zero locktime before persisting txid-bound reservations and RGB consignments, including matching dry-run/end/abort behavior. Removing the guard or editing the returned PSBT is unsafe. This migration leaves that work explicit rather than claiming generic Lightning parity. The external-signer VSS public-bootstrap limitation is unchanged and must not be worked around by supplying a seed to RGB.

The supplied Signet public contract is **Bridged USDT / BUSDT / 6**, asset `rgb:OG9No4hZ-UrxoWmR-09ohtOk-ppxBN7h-g~KkQro-ncKc9A4`, SHA-256 `dfb49261fed5ad3dd237dd3a03913793b76fe70e486372bbeb0769b82158a895`. Native import validates it and creates no balance. Funded regtest tests must use a fresh local BFA contract with its own identity.

Native artifact rebuild, all-target package admission, actual consumers and funded/device/bridge tests are separate acceptance gates. Keep the normal strict source, wrapper, lock, distribution and binary identity checks enabled. The candidate CI workflow builds artifacts without publication. No hosted dev bridge operations are authorized for these automated tests.
