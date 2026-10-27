# Unreleased rgb-lib-bfa migration candidate

Candidate version: `0.2.0-bfa.1`. This branch has not been merged or published. Published beta.5 remains an independent baseline. The native graph is pinned in package.json, the exact maintained patch, Cargo locks and runtime contract; all generated binaries must match those identities.


## Strict gateway and proxy compatibility

Candidate `0.2.0-bfa.1` sends an empty JSON-RPC parameter array for EVM methods taking no arguments. Public-network startup requires an explicitly configured protocol-1.0 RGB proxy; the obsolete protocol-0.2 public fallback is removed. The local regtest proxy default remains supported and is validated by the same preflight.

| Source | Exact revision |
| --- | --- |
| RGB library | `abd41d3afff6d8fb11461e26e843301650e22df3` |
| LDK | `17f2fb56f8d96d0ec512c715d2ebc65f829eb2c2` |
| RLN | `89ebe9fdb1be94cbba0b2bd722cea9af297399f1` |
| Maintained adapter SHA-256 | `4a730e3036e1197b2d9cd2d2584de722745f35e74dd1707dfe9b08e251b8b12b` |

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


## Recoverable RGB output setup

The candidate adds `rgb-output-operations-v1`. Check the compiled capability and the complete API surface before using it; method names alone do not establish native support.

Persist a random `operation_id` containing 32–64 lowercase hexadecimal characters before calling `prepareCreateUtxos({ operation_id, up_to, num, size, fee_rate, skip_sync })`. Preparation reserves native inputs and returns the exact transaction ID, input outpoints, actual RGB output count and Bitcoin fee for review. The library may prepare fewer outputs than requested when funds do not cover the requested count and fee; always review the returned count and fee. No transaction is signed or broadcast during preparation.

`commitPreparedCreateUtxos({ operation_id })` commits only the persisted transaction. Retrying the same ID retains the same transaction and input ownership. `getCreateUtxosOperation({ operation_id })` and `listCreateUtxosOperations()` recover operation evidence after process loss; `listPendingVanillaTransactions()` reports native reservations. Never infer an operation's identity by comparing transaction histories.

| Status | Meaning and allowed action |
| --- | --- |
| `preparing` | Preparation was interrupted before a complete review record. Native recovery releases only an unambiguously owned, provably unbroadcast reservation. |
| `prepared` | Exact transaction ready for review. `can_commit` permits the reviewed transaction; only `can_cancel: true` proves safe cancellation. A restored snapshot may predate a broadcast, so restored preparations cannot be discarded merely because the snapshot says `prepared`. |
| `submitting` | The exact signed transaction is persisted and broadcast may have occurred. Retry commits only that same transaction; cancellation is refused. |
| `broadcast` | Native broadcast bookkeeping completed. Observe the exact transaction for confirmation. |
| `confirmed` | The exact transaction was observed confirmed. Reconcile again after a chain reorganization. |
| `cancelled` / `failed` | A terminal, provably unbroadcast operation. Its ID cannot be reused for different intent; prepare a fresh operation if needed. |

`cancelCreateUtxosPlan({ operation_id })` is permitted only when native `can_cancel` evidence proves it safe. Never derive this permission from `status` alone. A timeout, missing mempool transaction or elapsed time never authorizes clearing uncertain inputs. Existing usable RGB outputs and independently spendable native inputs do not require a blanket ban on new output setup. Native reservation and allocation checks remain authoritative.

The legacy one-shot `createUtxos()` remains available for compatibility. Applications needing review, interruption recovery and exact idempotent retries should use the prepared operation API. Host JavaScript tests are distinct from funded native and Android application qualification; retain the exact source and artifact receipts for each tested build.

## Final accepted graph and maintained-overlay qualification

The maintained overlay is rebased on RLN `89ebe9fdb1be94cbba0b2bd722cea9af297399f1`, RGB `abd41d3afff6d8fb11461e26e843301650e22df3` and the canonical merged LDK `17f2fb56f8d96d0ec512c715d2ebc65f829eb2c2`. LDK's earlier reviewed branch commit is not substituted for its merged identity. The inherited LDK legacy test-harness limitation remains separate.

All six newly reachable native funding/prepared-sweep mutation sites explicitly admit durable snapshot intent. Nonzero custom locktimes reject before mutation admission; prepared-sweep inspection remains read-only. The complete output-operation writer still spans native reservation and RLN journal writes. Its inner backend guards remain raw to avoid recursive barrier acquisition and incomplete snapshots. Full authenticated invoices, native prepared-sweep confirmation/receipt checks and uncancellable native session owners remain intact.

Final maintained library qualification passes 453 tests with no failures. Four entries are explicitly ignored in that default invocation: one subprocess helper and three owned funded fixtures. All three funded fixtures were separately executed and passed: watch-only output setup/recovery; independent funding despite a retained legacy reservation; and funding/protected-sweep snapshot admission in both paused and enabled automatic-backup modes. The latter checks actual fixed-zero funding, fee-input retry, prepare/cancel/recovery, stale snapshot rejection, handoff protection, zero-confirmation rejection, confirmed idempotent consumption and exact 100-unit self-receive. Upload failure never changes the financial result or invents a backup completion.

The full library run includes actual protobuf VSS client/server backup, reopen, fresh restore, legacy-record preservation, canceled-caller lock barriers, durable policy, native signer shutdown/reopen and BIP-322. The supplied 639-byte Dev-USDT public contract imports on native Signet with its exact asset identity, name, ticker and precision; importing it on a different native chain rejects. This metadata-only test creates no USDT allocation and is not a funded hosted-bridge acceptance claim. Only a confirmed cloud commit with matching content acknowledgement can clear pending state; local snapshot acknowledgement alone cannot.

Bare passes 112 installer/contract tests and Node passes 47 host contract tests; both TypeScript checks pass. These source/host scopes do not qualify an Android APK. Android ARM64 native artifact production and final consumer/application acceptance are recorded separately with exact source, adapter, lock, wrapper and binary identities. Other platform binaries and full distribution assembly remain deferred. Strict all-target publication gates remain unchanged; this candidate is not published.
