# Gnosis account/provider review and root signing proof

Eleven Gnosis root-signing boundary cases and 45 Shared boundary tests pass. The traces
identify the patched validator actually authorizing local operations at the original
fictional address. Actual member signing and hosted provider readiness remain unproved.

This continuation starts at signed checkpoint `c40697f6e`. It reviews the existing
Kernel 0.3.1 / EntryPoint 0.7 account path without activating production Gnosis auth,
changing the accepted member address, selecting a new provider, or deploying anything.
The prompt-preparation chat confirms no newer accepted provider or architecture choice.

## Bounded plan and inventory

1. Recheck the selected account's Gnosis dependencies through the approved Alchemy app.
   Separate node RPC from exact account/EntryPoint bundler and sponsorship support.
2. Trace the validator actually called by local signed operations after a controlled root
   change. Test patched-root operation, legacy-module removal, explicit legacy selection,
   signature binding and replay on the existing pinned Gnosis fork.
3. Run focused proof and the repository validation selector, then commit only owned proof
   and handoff paths with signing required. Preserve unrelated changes and live gates.

The existing `proofs/member-migration/fixture.mjs` owns the isolated Anvil fixture,
synthetic WebAuthn owner, canonical legacy initializer and real EntryPoint submission.
The new root-signing runner consumes it without changing production account/provider
interfaces. Installed permissionless owns nonce encoding; the verified Kernel compiler
input explains root-mode dispatch. Existing Shared account-profile, provider and passkey
adapter tests protect the current production rejection of chain 100.

## Findings

**Established: root signing differs from explicit module selection.** Installed permissionless
0.2.57 encodes mode/type `0x0000` in its user-operation nonce. Kernel 0.3.1 substitutes the active
root validator in that mode. Its embedded legacy-address bytes select a nonce sequence, not
legacy-validator authority. Real EntryPoint call traces show `0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69`
returning successful validation after the controlled root change and after legacy uninstall.
The patched-client root nonce uses another sequence and also succeeds at the original address
`0x9546b80b2faf5d5a9905c752d26b60296d6bc305`.

**Established: rejection and repair.** Explicit module mode `0x0001` selects the removed legacy
validator, which returns validation failure. Kernel rejects with `InvalidValidator()` inside
EntryPoint `AA23 reverted`. Identical operation replay gives `AA25 invalid account nonce`.
Wrong chain, wrong sender-account signature and changed payload each give `AA24 signature error`
through the patched validator. Every rejection preserves observed account/module/key/nonce state.
A corrected patched signature succeeds with the unconsumed nonce. Legacy module/key removal
survives all these operations. This is not a complete permission inventory or migration approval.

**Established: current production boundaries remain closed.** Chain 100 has no production
settlement account profile or Pimlico client mapping. Existing passkey-adapter construction rejects
it. A policy identifier alone establishes neither support nor sponsorship. The profile assertion
by itself does not reject an unknown chain; downstream supported-chain/client construction supplies
the rejection. No production auth, dependency, initializer, address or provider mapping changed.

**Established: node reads are available; deployment prerequisites are unresolved.** Fresh read-only
Alchemy observations use Gnosis 100 block **48,892,415 (`0x2ea09ff`)**, hash
`0xe420e6be6351e11cb1326fa62eb9271e33ca6fffb0cc2719c9e6747f21fb1b36`.
The selected legacy validator and fictional account both have empty code. The canonical factory's
address view returns the original address; direct factory and meta-factory simulations both revert.
The connector omits revert data, so these reads establish no decoded cause or successful deployment.

**Published provider evidence:** [Pimlico's Gnosis matrix](https://docs.pimlico.io/guides/supported-chains#gnosis),
checked 22 October, lists EntryPoint 0.7 bundler/paymaster support but marks Kernel 0.3.1 unsupported.
[Alchemy's Wallet API matrix](https://www.alchemy.com/docs/wallets/supported-chains) omits Gnosis.
The selected Alchemy connector's `supportedEntryPoints` call returns an unsupported-method error
on `gnosis-mainnet`. This limited probe is not a test of every canonical ERC-4337 endpoint or custom
provider arrangement. Successful node RPC cannot certify the selected account, paymaster policy,
sponsorship or recovery. No new provider is selected.

[ZeroDev's current passkey example](https://docs.zerodev.app/onboarding/passkeys/overview) names
Kernel `V3_3` and `V0_0_3_PATCHED`. That example does not certify this selected 0.3.1 profile,
the historical initializer or the unverified migration helper. No SDK upgrade or profile change follows.

## Proof and provenance

The [evidence artifact](../artifacts/member-gnosis-account-provider-proof-2026-10-22.json) retains
fresh node/provider responses, eleven local cases, validator-call traces, exact source/dependency
hashes, configuration and proof limits. The new
[runner](../proofs/member-migration/root-signing-proof.mjs) reuses the unchanged failure fixture.
Canonical legacy creation and the controlled existing-Kernel root-change/uninstall steps execute
only on its owned loopback Anvil node. They are not an adopted migration or the unverified helper.

Local execution is pinned separately to Gnosis 100 block **48,888,476 (`0x2e9fa9c`)**, hash
`0x11a68d53c3dc81c412402cc1393e379358763ede55ab53fe0a9e361b21878867`, Anvil 1.7.1/Bpo1.
The upstream block was rechecked through Alchemy. Most dependency state comes from the genuine
historical Foundry cache; eighteen missing storage reads were supplied through the read-only
Alchemy queue. This is not fresh independent full-state authentication or a cold-cache recipe.
Earlier complete runtime provenance remains in the helper/failure handoff. No CLC source was read.

The owner uses public P-256 scalar 1 and synthetic `greengoods.test` WebAuthn responses. No actual
member credential, browser ceremony, private key, root secret file, live funds, hosted bundler or
paymaster is involved. A public Anvil EOA submits to the real forked EntryPoint. Signatures are
omitted from recorded operations. Rendered evidence: **none**; prior fictional Storybook evidence
does not prove member signing. No helper execution, certification or production migration is claimed.

## Commands and attribution

Run from the repository root. The temporary wrapper changes to that root before invoking the
Plan Hub runner so the repository-pinned Anvil resolves. It has no dependencies. The session-operated
read-only bridge is a disposable copy of the existing gateway with a separate queue directory;
no credential-bearing RPC URL or API key is extracted. Its loopback endpoint is not the signing node.

```sh
bun --no-env-file run --cwd /private/tmp/green-goods-root-signing-20261022/wrapper test --guards
MEMBER_MIGRATION_RPC_URL=http://127.0.0.1:62297/ PATH=/private/tmp/green-goods-local-integration-20261021/bin:$PATH bun --no-env-file run --cwd /private/tmp/green-goods-root-signing-20261022/wrapper test
PATH=/private/tmp/green-goods-local-integration-20261021/bin:$PATH bun --no-env-file run --cwd packages/shared test -- src/__tests__/settlement-aa-profile.test.ts src/__tests__/config/pimlico.test.ts src/__tests__/workflows/auth-passkey-adapters.test.ts src/__tests__/workflows/authPasskeyOwner.test.ts src/__tests__/modules/agent-reporting/owner-validator.test.ts src/__tests__/service-access-voucher-recovery.test.ts
node scripts/harness/plan-hub.mjs validate --feature cosmo-local-credit-interop
```

Signed source checkpoint: **`b569e613e107ddb64cf2f442ead38f6f21ff93a2`**, signature **G**.
Both committed blobs match the reviewed and validated hashes; the index is empty afterward.

Results: nonce/confinement guards pass; **11/11** local cases; **45/45** Shared tests in six files
(1.79 seconds); Plan Hub validation passes for all 34 hubs. The selected QA checks are `format`
and `lint`, selected by automatic hygiene; there is no new mandatory production critical override.
The final exact seven-path selector/execution passes **2/2 fresh**, 0 reused/unrun. Format
processes two JSON files and lint processes zero files under the existing policy; neither replaces
the executable proof. All **42** local links resolve, all lane objects remain unchanged and all
**222** pre-existing dirty/untracked file hashes are preserved. Logs and consistency proof remain under
`/private/tmp/green-goods-root-signing-20261022/`. No receipt reuse or protected environment
fingerprint read is used. Existing production critical receipts retain their preceding dated scope.

The repository ignores Plan Hub `.mjs` files in Biome. Explicit included-JavaScript stdin checking
with `--write` produces byte-identical source; selector hygiene alone is not meaningful script proof.
Initial excluded `.mjs` stdin attempts and the temporary wrapper's first Anvil resolution failure
(exit 127 outside the repo) are retained. Neither is a product RED/GREEN claim. Call traces correct
the earlier evidence interpretation; the old failure matrix is preserved as historical evidence.

Proof ran in the working tree at `c40697f6e` with exact input hashes. The unrelated Shared manifest
export is dirty and preserved; no clean whole-commit execution receipt is claimed. The signed
`b569e613e` checkpoint attributes the unchanged owned proof/evidence blobs, not the unrelated manifest.
No push, deployment, provider activation or external tracker write occurred.

## Remaining gate and next bounded work

Resolve an approved same-address bootstrap/migration path with exact source/build/security and
privilege provenance, then obtain support for that exact Kernel/EntryPoint/validator combination,
configured sponsorship and recovery. Only then can an authenticated actual-member ceremony prove
possession and signing. Replacing the initializer's validator or changing account type is not an
accepted address-preserving fallback. A community Safe remains a distinct custody model.

Helper provenance, actual member possession, browser ceremony, hosted provider acceptance,
sponsorship, recovery and COM-46 issuer approval remain open. COM-46's last recorded read is
In Progress with no approved evidence supplied; no newer issuer approval is asserted here.
Contracts remain in progress; broader UI/state API/manual/release blockers and overall backlog
are preserved. The prompt-preparation chat receives the root-mode clarification and these limits.

## Native batch candidate review, 22 October Pacific

The two-call native Kernel candidate is insufficient to guarantee atomic credential cleanup.
This is a source review and offline encoding result, not an executed or approved migration.
The [review artifact](../artifacts/member-native-batch-review-2026-10-22.json) records exact
source hashes, source locations, the encoded mode and current primary provider references.

All 23 Kernel source hashes and the complete compiler-input hash match the earlier verified
rebuild. Kernel's existing `execute` can call its own `changeRootValidator` followed by
`uninstallModule`; the entrypoint/self/root-hook guards still own authority. The installed
permissionless 0.2.57 encoder produces default batch mode `0x0100`, which propagates subcall
reverts. Its misleading `revertOnError=true` option instead produces Kernel TRY mode `0x0101`,
which records failed subcalls and continues. Inspect bytes rather than inferring semantics
from that option name.

There is a separate failure boundary inside uninstall: `_uninstallValidation` clears the
module's validation hook, then ignores `ModuleLib.uninstallModule`'s boolean result.
`ModuleLib` emits `ModuleUninstallResult` when the validator's `onUninstall` fails, without
propagating that failure. **Inference from source:** even default batch mode can finish with
the legacy module disabled but its validator-local owner key uncleared. This does not
establish remaining signing authority; it does disprove an unconditional cleanup guarantee.
A candidate needs explicit, exact postconditions and their failure proof before adoption.
No replacement helper, account initializer, validator deployment or production policy was added.

Four checks in the [offline runner](../proofs/member-migration/native-batch-encoding-proof.mjs)
cover the actual installed encoder's default mode, ordered zero-value account self-calls and
fixture owner data, TRY-mode distinction, and empty-call rejection. They use no signer, RPC
or account deployment. They prove encoding, not EVM rollback, authorization, replay, retry,
recovery, credential possession or provider acceptance. The existing execution proofs retain
their dated scope: account creation and nonce consumption can survive an execution failure.
The first offline attempt exposed a mixed-case hex assertion in this fixture; its corrected
byte-equivalent comparison passes. This is no product RED/GREEN claim.

Primary documentation rechecked on 22 October Pacific still lists Gnosis EntryPoint 0.7
bundler/paymaster support and marks Kernel 0.3.1 unsupported in
[Pimlico's account matrix](https://docs.pimlico.io/guides/supported-chains#gnosis).
[Alchemy's Wallet API matrix](https://www.alchemy.com/docs/wallets/supported-chains) still
omits Gnosis. No hosted endpoint or sponsorship policy was tested. These references clear
no account, provider, recovery, actual-member, issuer or live gate.

The replacement continuation preserves the preceding platform error: content was flagged
for possible cybersecurity risk without identifying a specific unsafe operation. It grants
no authority to circumvent a safety decision, alter permissions or disable safeguards.
Action-specific rejections remain binding. Private chat identifiers and transcripts stay
outside repository artifacts.

Task record: Cosmo-Local account/provider proof | Type: investigation/proof | Outcome: partial
Agent/model: Codex / exact model unknown | Coverage: this continuation only

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| investigate | unknown → 2026-10-22 23:57:12 | First observed clock 23:55:25; source and primary provider review |
| implement | after 23:57:12 → unknown | Bounded local proof runner; production interfaces unchanged |
| verify | 2026-10-23 00:00:22 → 00:08:40 | Eleven cases, 45 tests, 2/2 fresh selector checks, links and lane/preservation checks pass |
| review | 2026-10-23 00:05:35 → 00:09:40 | Evidence correction, exact staged/committed proof blobs and signature G verified |
| publish (local only) | unknown → 2026-10-23 00:09:40 | Signed proof checkpoint `b569e613e`; plan/evidence handoff checkpoint follows |

Human corrections: 0 observed in this segment; attention: unknown.

Exact selector argv (the Bun shim is first on PATH as in the commands above):

```sh
bun --no-env-file run check --plan -- --intent qa --changed .plans/backlog/cosmo-local-credit-interop/proofs/member-migration/root-signing-proof.mjs,.plans/backlog/cosmo-local-credit-interop/artifacts/member-gnosis-account-provider-proof-2026-10-22.json,.plans/backlog/cosmo-local-credit-interop/handoffs/codex-gnosis-account-provider-proof.md,.plans/backlog/cosmo-local-credit-interop/handoffs/codex-helper-provenance-and-failure-safety.md,.plans/backlog/cosmo-local-credit-interop/plan.todo.md,.plans/backlog/cosmo-local-credit-interop/eval.md,.plans/backlog/cosmo-local-credit-interop/status.json --json
bun --no-env-file run check -- --intent qa --changed .plans/backlog/cosmo-local-credit-interop/proofs/member-migration/root-signing-proof.mjs,.plans/backlog/cosmo-local-credit-interop/artifacts/member-gnosis-account-provider-proof-2026-10-22.json,.plans/backlog/cosmo-local-credit-interop/handoffs/codex-gnosis-account-provider-proof.md,.plans/backlog/cosmo-local-credit-interop/handoffs/codex-helper-provenance-and-failure-safety.md,.plans/backlog/cosmo-local-credit-interop/plan.todo.md,.plans/backlog/cosmo-local-credit-interop/eval.md,.plans/backlog/cosmo-local-credit-interop/status.json
```
