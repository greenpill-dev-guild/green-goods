# Controlled live pilot deployment package

**Current target:** Saturday, 24 October 2026 Pacific. Deck Saturday; participant testing Sunday
and Monday, 25–26 October. This package is in preparation; no broadcast is claimed.

## Accepted release disposition

On 22 October Pacific, the human release owner selected live contract deployment for the
hackathon. External audit evidence and audit intake are outside this release's prerequisites.
The older two-week testnet waiting period is replaced by focused pre-deployment tests,
deployment simulation and post-deployment smoke checks. These decisions are resolved.

Existing Safe controls and implemented contract delays remain intact, including mandatory
48-hour upgrade scheduling where enforced. Preserve exact consent, escrow before activation,
and the holder-approved immutable delivered/refundable allocation. No waiver establishes an
endpoint, credential, signer, issuer approval, successful test or elapsed contract delay.

The repository's contracts CLI and phase-aware deployment workflow own simulation, execution,
artifact persistence and verification. Make the exact candidate reviewable before execution.
Keep Git signing and platform safeguards. Git publication, merging, new worktrees and unrelated
tracker writes are not added by this deployment dispatch. The preparation chat owns Linear updates.

## Selected boundaries

| Boundary | Required selection and present evidence |
|---|---|
| Arbitrum One, 42161 | Existing promises, consent/acceptance and voucher source integration; enumerate exact proxy upgrades, modules, peers and writer roles before simulation |
| Gnosis, 100 | One shared curated exchange pool; exact published token/pool/limiter/fee/index/quoter versions and integration endpoints must be pinned and verified |
| Celo, 42220 | Optional G$ remains independent; preserve current funds, routes and recovery without making a voucher receipt imply monetary settlement |
| Member identity | Preserve the same address across all three chains; canonical initializer changes that produce another address are not an accepted workaround |
| Authority | Record exact owner/admin/pause/recovery addresses and verify the owning workflow's Safe threshold/control policy; finite issuer allowances and pool administration grant no issuer minting or reserve authority |
| Issuer obligations | Tech and Sun and Green Goods each need versioned terms, service units, capacity, issuance/holding limits, reserve address, acceptance authority, presentment and remedy rules; issue status is not evidence of those facts |

## Current evidence and technical work

The reconciled application source is signed in `a6461989e`; its evidence is signed in
`f1ae06046`. All 31 selected automated runtime checks and the additional Storybook build pass
across their recorded runs. The Docs dependency and stale-projection blockers are resolved.
That evidence does not certify a new contract deployment or actual-member ceremony.

The same-address fixture uses Kernel 0.3.1 and EntryPoint 0.7. Eleven recorded Gnosis cases prove
patched-root dispatch, explicit removed-legacy rejection, signature binding and replay/retry
behavior at the original fictional address. The existing two-call native batch candidate is
insufficient to establish atomic credential cleanup: Kernel may disable a module while swallowing
its cleanup callback failure. Disabled authority and residual validator data require separate
observations. Helper runtime identity is recorded; source/build/privilege provenance is unresolved,
so that helper is not selected for deployment. Continue a source-backed native candidate proof
with actual execution, failure, retry and recovery before selecting migration operations.

A new isolated pinned-fork proof now passes nine cases for an ordered native candidate:
`changeRootValidator` self-call, explicit legacy `onUninstall` call from the account, then
`uninstallModule` self-call in default atomic batch mode. Direct cleanup must precede module
removal: the legacy callback rejects a second cleanup, which Kernel can ignore after the first
cleanup has already succeeded. Forced cleanup failure rolls back the migration; EntryPoint can
retain fresh account creation and consume the operation nonce. Next-nonce retry succeeds and
patched-root signing remains usable at the same fictional address. This selects no actual
member operation or hosted provider. Exact traces, dependency hashes and proof limits are in
the [native batch evidence](../artifacts/member-native-batch-execution-2026-10-22.json).

Published EntryPoint availability is distinct from acceptance of this exact account profile.
Configured hosted bundler/paymaster acceptance, actual member possession/ceremony, sponsorship
or selected funding, and recovery remain unproved. Do not invent or silently activate a provider.

Live COM-46 was In Progress when read on 22 October Pacific. Its description specifies required
issuer facts but contains no approved values or evidence references. The user confirmed these terms need to be defined, selected hub access and assisted sessions,
and added Claude access under a Green Goods team. The [working issuer terms](../pilot-issuer-terms.md)
now define proposed services, prices, capacities, supply/reserve/pool/allowance limits, booking,
partial delivery and remedies. The human release owner accepted the numeric baseline with assistance priced at two GG vouchers
per thirty minutes; actual
capacity, funded permitted Claude seats and public-safe control addresses remain unconfirmed.
Private issuer evidence and member identity data stay out of this public repository.

The current contracts CLI exposes pooling and settlement release operations but no voucher
deployment target. Confirm the full inventory and add the missing repository-owned deployment,
initialization, artifact and dependent-configuration path before claiming a runnable package.

## Deployment inventory inspected in source

| New implementation / proxy | Network / authenticated peer | Initialization and build dependencies |
|---|---|---|
| `VoucherEntitlementModule` | Arbitrum / Gnosis adapter | Constructor router; initializer owner, distinct guardian, remote selector/chain/peer, existing pooling and Hats modules. No external library links in the inspected default artifact. |
| `GnosisVoucherAdapter` | Gnosis / Arbitrum entitlement module | Constructor router; initializer owner, distinct guardian, source selector/chain/module. Each reserve must call `configureAsset` itself and separately approve a finite allowance. |
| `VoucherRedemptionModule` | Arbitrum / Gnosis escrow | Constructor router; initializer owner, distinct guardian, destination selector/chain/escrow and compatible pooling module. External links: `VoucherServiceConsentLib`, `VoucherServiceResultLib`. |
| `GnosisVoucherEscrow` | Gnosis / Arbitrum redemption module | Constructor router; initializer owner, distinct guardian, source selector/chain/module. External link: `VoucherRedemptionTransfers`. |

`VoucherEndpoint` and `VoucherRedemptionReceiver` are abstract bases, not extra deployable
proxies. Each endpoint initializes paused, and each implementation disables direct initialization.
Router and local chain are constructor immutables. Remote peers are pinned during initialization;
plan both chains' predicted addresses and exact initialization data together. No placeholder peer
or owner address is an executable candidate.

The existing pooling surface owns `pinEarnedVoucherModule` and `pinVoucherServiceSetupModule`;
both require the owner while paused. Compare its deployed implementation and the personal-G$
SettlementModule against the reviewed source before choosing exact upgrade operations, linked
libraries and schedule/execute phases. Preserve existing Celo settlement deployments and routes;
this inspection does not select an unnecessary Celo redeployment.

The four new implementations, three externally linked voucher libraries, proxy creation and
initializers, existing source-module upgrades/bindings, reserve-origin authorizations, published
CLC factory/configuration operations, and final unpause each need explicit transaction boundaries
and readback. The inspected default artifacts identify link requirements; they are not the final
production-profile bytecode manifest. The current general network manager and CLI have no Gnosis
release path, and the existing pooling release-stage schema covers Arbitrum/Celo only. Adding a
voucher command alone would therefore be insufficient. Those deployment-tooling changes and their
negative/simulation tests remain unfinished; no runnable release claim is made here.

## Safe selection: GG reuse accepted; new Safe governance proposed

On 22 October Pacific, the user selected reuse of the repository-named Green Goods Safe on
Gnosis: `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19`. The [read-only observation](../artifacts/green-goods-safe-gnosis-2026-10-22.json)
at block 48,895,536 records five owners, threshold two, reported version 1.5.0 and no enabled
modules. Keep its current owners/threshold. The user has not authorized a change to that Safe's
configuration, module set, allowances or custody through this selection. Refresh applicable
state and release verification before executing its transactions. Historical Arbitrum/Celo
owner lists and timelock dispositions remain historical inputs, not new pilot waivers.

Propose the following owner roles; actual people and public signing addresses remain open:

| Safe | Proposed owners | Proposed threshold |
|---|---|---|
| Tech and Sun reserve | Tech and Sun service lead, operations/finance steward, trusted backup chosen by Tech and Sun | 2-of-3 |
| Shared pool administration | Two independent Green Goods delegates and two independent Tech and Sun delegates | 3-of-4 |

Any three of two-plus-two delegates includes both organizations and tolerates one unavailable
signer. This is a flat Safe threshold, without introducing nested contract-owner signing or a
new signing module. A neutral-third 2-of-3 arrangement would allow either organization and the
third to act without the other organization's signature; do not describe that as requiring
both organizations. The shared administrator cannot mint or spend issuer reserves; reserve
allowances stay finite and reserve-origin authorization stays authoritative. Existing immediate
pause and delayed upgrade controls remain intact. See the [terms](../pilot-issuer-terms.md) for
full recommendation boundaries. No new Safe or transaction was created by this planning update.

## Execution review and proof to complete

- Pin the reviewed source revision, compiler/build inputs, runtime hashes, networks and exact
  ordered operations; separate new paused deployment, upgrade scheduling and value activation.
- Bind actual issuer terms/caps, token and shared-pool controls, both transport directions,
  finite allowances, owner/admin/writer/pause/recovery roles, member account and gas policy.
- Run focused tests and exact simulation for success, wrong chain/owner/peer, exhausted or
  revoked allowance, partial transport outcome, retry, pause and rollback. Preserve existing
  Celo behavior and every implemented consent/escrow/final-allocation control.
- Persist the exact manifest and simulation result for the human execution review. Missing
  inputs remain explicit blockers for the affected operation, rather than fabricated defaults.
- After execution, persist receipts and read back code, implementation, owner/Safe threshold,
  peers, roles, caps, allowances, pause state and dependent app/indexer configuration. Run the
  bounded smoke and recovery checks before declaring the controlled live pilot ready.

Historical audit/soak requirements remain in earlier evidence for provenance. They do not apply
as hackathon prerequisites under this dated release disposition. Unrelated lane completion
states and the hub's overall backlog state are preserved.

## Task and phase record

Task: Cosmo-Local Integration controlled live pilot | Type: feature/investigation | Outcome: partial.
Agent/model: Codex / model unknown | Coverage: current release-policy, issuer-term and native-proof segment.

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate / implement | Earlier start unknown → 2026-10-23 03:56:53 | Current release disposition reconciled; earlier lane states preserved. |
| Investigate / implement | 2026-10-23 04:03:50 → 04:15:37 | Services selected; proposed numeric baseline drafted; Claude pricing and named-seat constraints checked against official sources. |
| Verify | 2026-10-23 04:03:50 → 04:14:05 | Nine native local-fork cases pass; wrong-order candidate fails as expected. Earlier trace assertion included initialization/validation calls; corrected to identify migration selectors. |
| Verify / review | 2026-10-23 04:14:05 → 04:15:37 | Selected QA format/lint 2/2 fresh; 34 Plan Hubs validate; 87 local links resolve. All nine proof source hashes match and all 114 unrelated file hashes remain unchanged. Selector lint processes no files under this Plan Hub; the executed fork proof owns behavior evidence. |
| Implement / verify | 2026-10-23 04:18:01 → 04:19:01 | Accepted baseline recorded with two GG vouchers per thirty-minute session; revised service-budget arithmetic and selected formatting pass. Safe creation/reuse remains for discussion. |
| Investigate | 2026-10-23 04:19:01 → 04:20:38 | Safe discussion requested; existing GG address found in repository and inspected read-only on Gnosis. Exact calls and limits are linked above. Creation/reuse remains unselected. |

Human corrections: 0 in this segment; service additions are scope decisions. Human attention: unknown.
Rendered proof: none in this segment; no product UI changed. No live broadcast, purchase or external tracker write.

### Safe governance decision segment

Task: Cosmo-Local Integration controlled live pilot | Type: guidance | Outcome: partial.
Agent/model: Codex / model unknown | Coverage: GG Safe reuse and new Safe governance discussion.

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | Unknown → 2026-10-23 04:25:22 | Read current pilot terms, contracts threshold policy and official Safe guidance. |
| Implement / review | 2026-10-23 04:25:22 → 04:26:54 | Record accepted GG reuse; propose 2-of-3 Tech and Sun and 3-of-4 joint pool ownership. Named signers remain unselected; selected formatting passes, 34 Plan Hubs validate, links resolve and all 114 unrelated file hashes are preserved. |

Human corrections: 0 in this segment; attention: unknown. No Safe creation, configuration change,
transaction, external tracker write or new rendered proof in this guidance segment.
