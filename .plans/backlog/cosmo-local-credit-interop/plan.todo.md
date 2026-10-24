# Cosmo-Local Integration — work and decisions

**Feature Slug**: `cosmo-local-credit-interop`
**Linear Issue**: [RESR-73](https://linear.app/greenpill-dev-guild/issue/RESR-73) (parent-only mirror)
**Linear Project**: Cosmo-Local Integration
**Linear Source**: source:plans
**Stage**: `backlog`
**Status**: `CONTROLLED LIVE PILOT PREPARATION; LOCAL MEMBER PROOF; ONBOARDING INPUTS DEFERRED`
**Created**: 2026-08-25
**Last Updated**: `2026-10-23 Pacific`
**Companion documents**: [`brief.md`](./brief.md) · [`spec.md`](./spec.md) ·
[`tensions.md`](./tensions.md) · [`resources.md`](./resources.md) · [`eval.md`](./eval.md)

## Member and garden issuer pilot — accepted 23 October Pacific

The user requires member-owned service vouchers alongside garden vouchers in the same shared pool
and accepts steward-assisted onboarding. The member retains ownership and exact approval. This
section supersedes the two-issuer-only completion boundary; historical completed tasks below keep
their original proof scope. The user has dispatched implementation, with the bounded independent
execution-tooling checkpoint committed first, then M1–M8 in dependency order. Local implementation
and rehearsal proof are recorded below; no live member deployment is claimed.

| # | Locked decision | Implementation consequence |
|---|---|---|
| 1 | Individual issuance is in the pilot | Include a real member issuer, not only a fictional third token. Member roster and actual services remain to be confirmed. |
| 2 | Steward assistance; member ownership and approval | Retain steward-controlled publication/acceptance where compatible. Member controls token/reserve and approves exact obligations; pool stewardship is not issuer authority. |
| 3 | One shared Gnosis pool | Add admitted assets and their configuration; no pool per member or new general exchange engine. |
| 4 | Preserve existing lifecycle and independent G$ | Exact consent, escrow before acceptance, activation, immutable split and recovery; G$ remains on Celo. |
| 5 | No mandatory upgrade delay | Preserve authorization, Safe signatures, pause and exact-candidate controls. External audit and two-week soak remain outside hackathon prerequisites. |
| 6 | Existing branch and no new worktree | Preserve concurrent work; commit validated implementation in relevant local groupings when dispatched. |
| 7 | TAS impact-website example selected | Three distinct participant accounts and separate commitments share one brief. Two member-owned assets exchange in the same pool; peer-help and project delivery have distinct work and capacity budgets. |

### Dependency-ordered implementation checkpoints

Each row is a bounded checkpoint, split further when its owning package requires more than one
session. Start active implementation through the existing `linear-sync` workflow, respecting this
hub's `parent_only` and `preserve_existing` modes. This planning pass changes no Linear states.

| Step | Owning paths / work | Completion evidence |
|---|---|---|
| M1 | Define the labeled TAS rehearsal roster, independent deliverables and peer services; record confirmed versus unknown live units, capacities, token owner/reserve, source signer, upgrade/recovery controls and remedies | Fixture authority is explicit and cannot become live approval by default. Actual issuer acceptance remains required before live configuration; no private career notes or identities copied into public Git. |
| M2 | Contracts release tooling: add a strict member extension beside the authoritative unchanged v1 collective manifest and planner | Reject missing or mismatched authorities; deterministic inventory/nonce plans; member token initialization has no leftover deployer powers; existing collective manifests remain compatible. |
| M3 | Contracts authority proof: extend the existing `GnosisVoucherPilot` / journey fixture and owning source/escrow tests | Three distinct project participants; at least two member-owned service assets. Member signs issuer approval and reserve calls; wrong member/steward/Safe cannot substitute. Existing generic modules suffice or a specific failing case justifies a narrow source change. |
| M4 | Contracts configuration/execution: extend the existing release package and simulation at their current owners | Configure member authority under the required pause boundary, finite allowance, rate, fees, pool cap and inventory; idempotent recovery/adoption and exact readback include every added asset. |
| M5 | Shared issuer/route metadata and Indexer projections, in separate package checkpoints | Individual/collective issuer, service unit and approval provenance round-trip; replay and pending/failure states remain truthful. A token transfer is not delivery or fresh capacity. |
| M6 | Existing Admin onboarding and Client service journeys, with hooks in Shared | Steward prepares, member reviews/signs, administrator admits; member sees services they hold separately from services they owe. Labeled rendered proof plus authenticated signing proof for changed signing paths. |
| M7 | Connected TAS three-participant rehearsal with collective and two member assets in the same pool | Three separate commitments under one brief, distinct acceptance/evidence/outcomes; member A voucher → member B voucher → exact booking consent → escrow → acceptance/activation → immutable partial outcome → member reserve return/holder refund. Stale terms, shortages, wrong authority and retries cannot duplicate issuance/swap/payout or count peer-help capacity as project delivery. |
| M8 | Regenerate the affected deployment candidate, commit validated owned changes and execute the existing authorized release workflow | Exact new token/admin inventory, addresses/nonces, Safe calls, peers and caps; deployed readback and live smoke include the member issuer. Old two-issuer receipts certify only unchanged inputs. |

Before affected issuer-specific deployment/configuration, identify which plan bytes and predicted
addresses change. Preserve already deployed components and validated independent execution work;
do not replay broadcasts or restart the deployment by assumption. Existing account proof is scoped
to the selected profile and does not prove every new issuer's possession or approval. A broad
implementation gate or the old two-issuer rehearsal cannot close M1–M8 by itself.

Reuse boundaries: the current `VoucherEntitlementModule` owns source issuer binding and exact
reward approval; `GnosisVoucherAdapter` owns reserve authorization; service escrow owns issuer
approval and once-only transfers; `ServiceOffersLib` owns steward-controlled offer terms and
acceptance. Extend these owners only where a member-path test demonstrates a gap. The release
planner's fixed issuer list was the confirmed tooling gap. Member UI and Indexer wiring now have
focused and full selected local proof. No self-service issuer factory,
new team token, automatic project split or multi-issuer
escrow belongs to these checkpoints. The bounded TAS example is selected for implementation;
broader collaboration/project-platform features remain outside scope.

### Proof status for the amendment

Local proof at 24 October UTC: the [member rehearsal record](artifacts/member-issuer-local-proof-2026-10-24.json)
binds the frozen source hashes, 108 planner/readback cases, 37 CLI checks, twelve-deployment
preparation/adoption probes and the 21-case owning Gnosis suite. The selected critical local
checks pass, including all Shared projects, full Client/Admin/Agent suites and application builds.
Shared issuer/buyer behavior has 116 focused cases, Client has 24, Admin has 13, and the
Indexer suite has 366 passes with one existing pending case. These have different proof scopes;
they do not establish a live signing ceremony. The fictional
[M1 parameters](pilot-issuer-terms.md#fictional-rehearsal-parameters) and
[recommended member defaults](pilot-issuer-terms.md#recommended-defaults-for-hub-members) are explicit.
The user deferred participant accounts and accepted terms to later onboarding. They do not block
generalized implementation or independent deployment preparation. Live offer activation will
collect the relevant member's acceptance at that later boundary.

- [x] Record member issuance, assisted onboarding, ownership/approval and shared-pool decisions.
- [x] Select the TAS three-participant shared-brief example and two-member-asset exchange.
- [x] M1 labeled rehearsal terms and controls, plus recommended generalized defaults, prepared.
- [x] M2–M4 focused member deployment, authority, configuration and receipt-adoption proof complete.
- [x] Complete the full selected critical local aggregate in this signed implementation checkpoint.
- [ ] M5–M6 data/UI integration and signing proof complete.
- [x] M7 connected member/collective contract rehearsal complete with fictional participants and transport.
- [ ] Later onboarding: collect actual member terms/control acceptance and authenticated issuer proof.
- [ ] M8 affected candidate, deployed readback and live smoke complete.

Planning record: member and garden issuer amendment | Type: planning | Outcome: complete
Agent: Codex; model unknown | Coverage: this amendment only; runtime implementation remains open.

| Phase | Start → end (UTC, 24 October 2026) | Evidence |
|---|---|---|
| investigate | unknown → 00:13:14 | Current planner, authority, escrow and recognition code; existing handoff and accepted user decisions |
| implement (plan only) | 00:13:14 → 00:18:08 | Six canonical planning files updated; no runtime or deployment changes |
| verify/review | unknown → 00:18:08 | Plan-hub validator: 34 hubs; seven new local links/anchors resolve; prior lane/Linear/history state preserved; scoped diff check passes |

The scoped diagnose selector selected no automated runtime checks. No contract or browser proof
is claimed by this plan edit. Human corrections: 0 in this segment; attention: unknown.

## Earlier release preparation and dated evidence

**Current release decision, 22 October Pacific:** prepare the controlled live pilot and deployed
contracts for Saturday, 24 October; deck Saturday and participant testing Sunday/Monday.
External audit/audit intake is not a hackathon prerequisite. The user replaced the two-week
testnet wait with focused pre-deployment tests, deployment simulation and post-deployment smoke
checks. Preserve existing Safe controls, the newer zero-delay decision and all accepted voucher safeguards.
The [deployment package](handoffs/codex-live-pilot-deployment.md) owns the exact candidate,
network operations, configuration inputs, technical blockers and execution review. Keep the
current branch, signed commits and no-new-worktree constraint. The preparation chat owns Linear
release updates; this checkout owns the canonical Plan Hub changes.

- [x] Record the accepted audit exemption, testnet-duration substitution and live target.
- [x] Reconcile the released performance/Admin group and restore declared Docs dependencies;
  source `a6461989e` and evidence `f1ae06046` are signed locally with complete scoped proof.
- [x] Prove the native three-call candidate through nine isolated Gnosis execution/failure/retry
  cases at the same fictional address; distinguish legacy authority from credential cleanup.
  Actual-member signing/provider readiness and live migration remain open.
- [ ] Establish the exact configured account/EntryPoint/provider path and sponsorship or funding.
- [x] Record both issuers' selected services and accepted price/cap baseline, with draft operating terms in
  [working issuer terms](pilot-issuer-terms.md), including two GG vouchers per thirty-minute assistance session and Claude Team seat limits.
- [x] Reuse the existing GG Gnosis Safe at its current 2-of-5 for both network pool administration
  and GG issuer reserve; no separate pool Safe. Tech and Sun bootstrap remains 2-of-3.
- [x] Select fixed-two Tech and Sun steward signing, superseding the earlier majority policy;
  require two valid steward signatures regardless of roster size and block spending below two eligible signers.
- [ ] Bind Tech and Sun signer eligibility to active garden stewards; define recovery behavior
  and prove authenticated Arbitrum/Gnosis synchronization. Actual signer accounts and live
  automatic owner updates remain unconfirmed.
- [ ] Bind accepted terms to confirmed capacities/caps, reserves and accountable controls.
- [x] Implement offline production preflight, exact paused endpoint planning and isolated-fork
  simulation through `release vouchers`; every initialized endpoint proxy stays paused in rehearsal.
- [ ] Bind real endpoint inputs and complete the published CLC shared-pool deployment/configuration
  and live execution/readback path; the paused endpoint tool alone does not finish this boundary.
- [ ] Enumerate repository-owned deploy/initialize/upgrade operations and persisted manifests
  for Arbitrum modules and the shared Gnosis pool/integration; preserve independent Celo G$.
- [ ] Run focused pre-deployment tests and exact deployment simulation, including owner/chain
  rejection, peer/allowance isolation, pause and recovery/rollback.
- [ ] Review the concrete candidate before execution; verify deployed state and post-deployment
  smoke checks before declaring the live pilot ready.

**Current authorized continuation, 22 October:** review the Gnosis account/provider path and
continue member-signing proof, preserving the accepted address, voucher safeguards, concurrent
work and required signing. The [account/provider record](handoffs/codex-gnosis-account-provider-proof.md)
owns this bounded continuation. Eleven fictional Gnosis cases trace actual root-validator
dispatch, legacy-module rejection, signature binding, replay and repair; 45 Shared boundary tests
pass. This does not establish actual member possession, hosted provider acceptance or sponsorship.
Those proof results do not certify the remaining technical prerequisites. The newer live release
decision above supersedes the older local-only boundary.

- [x] Distinguish node RPC, exact account/EntryPoint bundler support and sponsorship.
- [x] Trace patched-root signing at the original fictional address after legacy uninstall.
- [ ] Resolve the same-address bootstrap/migration and exact hosted provider prerequisites.
  The 22 October [native batch review](handoffs/codex-gnosis-account-provider-proof.md#native-batch-candidate-review-22-october-pacific)
  finds that uninstall can ignore validator cleanup failure; offline encoding passes, but this
  candidate does not establish atomic credential cleanup or migration readiness.
- [ ] Prove actual member possession, browser signing, sponsorship and recovery.

The preceding source-size/Admin story blockers were repaired in signed local commits
`6168fca1d`, `38d93d03a` and `c40697f6e`; the
[blocker/readiness record](handoffs/codex-local-blockers-and-readiness.md) retains their exact scope.

**Earlier authorized slice, 22 October: local voucher pilot.** Implement the connected individual
request → usable voucher reward → optional single-pool exchange → existing service-redemption
journey. Voucher rewards lead; optional G$ retains independent accounting and recovery. Correct
voucher holdings redeem directly. One shared Gnosis SwapPool serves the pilot; Arbitrum garden
and protocol commitment pools remain separate. Future tokens/fiat are documented extension points,
not runtime scope. The [focused gap map](handoffs/codex-local-voucher-pilot.md) records ownership,
reuse, failure cases and proof limits before implementation. Use the existing branch/checkout,
preserve concurrent work and required signing, and commit validated owned work locally.

- [x] Inspect current implementation and reconcile this explicit pilot authority.
- [x] Prove an individual Request earns a whole redeemable voucher, with optional separate G$.
- [x] Prove direct redemption and actual pinned voucher A → B exchange in one pool, then redemption.
- [x] Connect the member rehearsal through one observed balance ledger; expose terms and shortages.
- [x] Prove independent failures/acks/retries and preserve consent, escrow and final-allocation guards.
- [x] Capture labeled rendered proof and all repository-selected checks, then signed local receipts.

All selected critical runtime suites pass. The pilot checkpoint's two contract-source lengths
and three missing concurrent Admin stories are repaired in the later bounded continuation.
Its selector passes 13/13 fresh, plus storage, production size and 57 pinned Gnosis cases.
This is working-tree evidence with pending concurrent Admin inputs; no clean whole-commit,
publication or release receipt is claimed. No baseline or release gate was waived.

- [x] Reconcile those two branch gates with exact ABI/layout, full selected and rendered proof.

Helper provenance, actual-member signing/provider/sponsorship/recovery, issuer approvals and live
readiness facts remain open. Earlier signed migration receipts are historical; refresh applicable
proof against current inputs and preserve the Shared manifest exports. Live deployment is the
selected outcome through the concrete reviewed package above. Git publication, merging, unrelated
external tracker writes and a new worktree remain outside this checkout's dispatch.

**Earlier member dispatch, 22 October UTC:** continue member signing and issuer readiness, with local signed
commits now requested. This supersedes the prior uncommitted-only instruction below; signing stays
required; the dedicated agent now supports scoped approved signing without key-file access.
The 145-path checkpoint is signed locally as `0f4e62bae`; the default sandbox socket remains blocked.
[The proof handoff](handoffs/codex-member-issuer-readiness.md) records matching fictional three-chain
derivation, a fresh absent Gnosis validator/deployment revert at block 48,879,904, and deliberate
app rejection. Six focused files pass 42 tests and the four-check selector passes fresh. Actual
member control, signing, sponsorship and recovery remain unproved. COM-46 was Todo at that read; it
is now In Progress without attached approval evidence, as the current refresh records. The user
confirmed no approved issuer evidence yet and asked to record the gaps. No broader lane is completed.

- [x] Recheck selected account dependencies, exact SDK configuration and pinned live RPC behavior.
- [x] Protect existing unsupported Gnosis auth/provider/delivery boundaries with characterization tests.
- [x] Assess each issuer independently and request only an approved private evidence reference.
- [ ] Resolve Gnosis account prerequisites through a separately authorized reviewed decision.
- [ ] Prove actual member ownership, signing, sponsorship and recovery through the supported path.
- [ ] Obtain exact versioned issuer terms/capacity/authority/approval evidence and human disposition.
- [ ] Attribute this local checkpoint to the user's required signed commit and fresh scoped receipts.

**Current member-signing continuation:** the gardener's address must remain the same across
Gnosis, Arbitrum and Celo. [Migration characterization](handoffs/codex-member-migration-characterization.md)
reproduces canonical missing-dependency creation inside a pinned read-only call and matching
three-chain derivation. Substituting the patched root in the initializer changes the address.
Helper source remains unverified on both queried explorers; its runtime identity and SDK encoder
do not prove migration safety. Four focused Shared files pass 36 characterization tests, including
patched-root refusal, wrong-chain rejection and cancellation/exact retry. No production auth,
dependency, sponsorship or deployment change is authorized by these observations.
The bounded source/test checkpoint is signed as `011d9b77d`; a fresh committed owner-adapter
run passes 16/16 with clean validated paths. The broader 36-test run remains working-tree evidence.

- [x] Reproduce complete canonical creation and same-address fixture derivation without deployment.
- [x] Separate historical creation inputs from active-root migration and characterize existing rejection.
- [x] Establish simulated failed-operation creation/rollback/retry boundaries at all three recorded pins.
- [ ] Establish exact helper source/build/security provenance; runtime identity is insufficient.
- [ ] Prove intended-member signing, active-root support, provider acceptance and recovery.

**22 October helper/failure continuation:** the [bounded proof handoff](handoffs/codex-helper-provenance-and-failure-safety.md)
records nine real Kernel 0.3.1/EntryPoint 0.7 fixture cases on each pinned Gnosis, Arbitrum and Celo
fork, with the same historical address and every outcome marked `migrationReady=false`.
Validation rejection rolls back initial creation; execution failure can preserve a legacy-root
account and consume its nonce. Root change alone leaves the old module/key installed. A separate
uninstall is a control experiment, not an adopted migration. Alchemy supplied Arbitrum archive
state through a read-only local bridge; cached Gnosis/Celo state and unsupported Gnosis historical
state-proof access are labeled. Complete helper creation/runtime identity is established, but
source/build/privilege/security provenance, real-member signing/provider/sponsorship/recovery
and issuer approval remain open. The nine-path source checkpoint is signed as `ea28e3b55`; its clean 27-case committed-source
run and the separate broader working-tree validation are recorded in the handoff. A later
unrelated Shared manifest export leaves the historical receipt unavailable for current reuse;
that change is preserved outside this proof checkpoint. Production policy, dependencies and every live/release
and unrelated lane blocker remain unchanged. No new product redesign is dispatched.

**Newer accepted continuation, 23:42 UTC:** reconcile the existing checkpoint separately for
escrow before activation, exact voucher consent before both core acceptance paths, and one
immutable final settlement split. Historical completed checkboxes below do not certify these
new requirements. The user signed the exact 71-path checkpoint as `e7cd49d6` and explicitly
dispatched this reconciliation, keeping all new changes local and uncommitted. Core/source/
destination safeguards and downstream Indexer, Shared and member migration are implemented.
Full consumer, critical contract and selected guardrail proof passes. The
[reconciliation handoff](handoffs/codex-voucher-reconciliation.md) owns the current proof and limits.

Current bounded safeguards reconciliation:

- [x] Exact earned/payment voucher consent at every core acceptance path, with permanent accepted facts.
- [x] Full escrow before acceptance and authenticated, immutable Activate/Abort convergence.
- [x] Holder freezes one final service/token allocation; independent fixed legs retain failure/retry evidence.
- [x] Typed Indexer, Shared and member migration; full consumer and labeled rendered proof.
- [x] Global guardrails and bounded build/storage wrapper regressions; historical failures retained.
- [x] Final gas repair and fresh mandatory contract, size/storage and pinned-fork verification.

This checklist does not complete the wider UI, state API, QA or live release lanes below.

**Dispatched:** 2026-10-21. The accepted [spec](spec.md) owns the earned-voucher slice.
Direct Gnosis purchases and the later service-access extension are separately dispatched below;
the later continuation dispatches local Indexer, Shared and member integration. Its earlier local
commit permission is superseded by the latest instruction to keep new work uncommitted. Live use
remains outside this implementation. PWA design
acceptance through 21 October belongs to its own hub and is preserved; this dispatch does not
implement it or clear its independent lane blockers. Linear is read-only in this task.

**Historical checkpoint evidence, before safeguards reconciliation:** all four formatting failures are resolved. Fresh pinned-Gnosis tests
pass 31/31 after the user enabled the Alchemy network. The approved lazy-fingerprint validator fix
passes 59 runner tests; a doctor test fixture is now isolated from developer secrets. All 399 harness
tests pass. Focused service proof passes 42 core, 35 personal-funding, 34 voucher unit and five
real-core voucher integration cases. Both final package phases pass 2,119 Solidity, three production
G$ gas, 31 CLI and 322 script tests. Size/storage, Gnosis 39/39, Celo 12/12, ABI regeneration,
lint, source structure, ontology and supply chain pass; forced consumer suites also passed.
The eight-pass critical run plus naming-only supply-chain follow-up provide component coverage,
not a single aggregate pass. All initial failures and corrections remain in
[the execution handoff](handoffs/codex-service-access-execution.md).
Unrelated blockers remain intact.

**Earlier planning amendment:** personal G$ service purchases across gardens and voucher redemption
were added to the architecture before runtime dispatch. That planning amendment alone did not
authorize implementation or certify behavior. The subsequent user request dispatched
the [service-access prompt](handoffs/codex-service-access.md), adding the
personal-purchase/redemption scope without superseding separately authorized direct Gnosis
purchase-swap work. First-slice evidence below remains evidence of that slice alone.

## First bounded contracts slice

- [x] Reconcile the shared checkout onto refreshed `origin/develop`, preserving all original changes;
   create `feature/cosmo-local-contracts` without worktree, stash, reset or commit.
- [x] Implement distinct v1 wire messages and community ownership with a mandatory 48-hour upgrade delay.
- [x] RED/GREEN the source terms, issuer approval, expected-revision consent/freeze and real recognition
   allocation. Preserve existing core and G$ behavior.
- [x] RED/GREEN reserve distribution, authentication, atomic transfers, replay, recoverable failure,
   pause, bounded issuer retry, durable results and independent acknowledgment retry.
- [x] Prove the selected GiftableToken at Gnosis block 48,848,261 with hand-written published interfaces;
   use fictional inventory and labeled mock transport. Recheck the Gnosis WebAuthn gap.
- [x] Run the validation selector and every applicable critical override; retain commands, working-tree
   evidence and limits in [the contracts handoff](handoffs/codex-contracts.md).
- [x] Leave uncommitted for testing. Do not mark the full voucher lifecycle or unrelated lanes complete.

Five selected critical checks passed fresh; 2,003 Solidity tests plus package script/CLI and
production G$ gas proof passed. Nine final pinned GiftableToken fork tests passed. The contracts
lane stays `in_progress`: this local slice has no commit-attributed validation receipt. Later
purchase and service slices have their own dispatch and proof below; release remains gated.
No unrelated manual lane blocker is cleared.

## Direct Gnosis purchase slice — separately dispatched

- [x] Check alignment with **Prepare Cosmo contracts prompt** and retain its newer personal G$
  planning amendment separately. Preserve the original earned-voucher code and evidence.
- [x] Identify and expose the existing bounded CLC purchase API through hand-written interfaces;
  record the financial behavior matrix in [the purchases handoff](handoffs/codex-contracts-purchases.md).
- [x] Prove named-learner delivery, caller funding, bounds, local prices/fees, curation, inventory,
  holding limits, governance and atomic repair with actual CLC implementations and labeled local accounts.
- [x] Run the selector, critical checks and available pinned conformance; retain permission/network
  blockers explicitly. Leave changes local and uncommitted, with no release or full-lifecycle claim.

The local artifact replay passes 22/22 purchase cases, including 32 conservation fuzz runs.
Default/full builds, lint and ABI checks passed. The package phases passed 2,003 Solidity, 3 G$
gas and 31 CLI tests; its initial script timeout is preserved, followed by an isolated 33/33
pass and a complete 319/319 script recheck without code or settings changes.
The later proof-closure continuation now passes all 22 purchase and nine reserve cases on the
pinned Gnosis fork, with runtime hashes independently checked. Formatting is fixed without JSON
value changes. The user-approved validator fix separates fresh execution from opt-in caching;
all five critical checks now pass fresh. Earlier failed commands remain in their original handoffs.
Full service and live-release claims remain independent.

## Service-access sequence — dispatched after proof closure

- [x] Close formatting with exact backups, JSON-value equality and selected guardrail proof.
- [x] Recheck baseline/source identities and alignment with the prompt-preparation session.
- [x] Close fresh pinned Gnosis conformance: all eight CLC runtimes match; 31 fork tests pass.
- [x] Complete full default-runner proof after the approved repair: 399 harness tests and five
  critical contract checks pass fresh, zero reused/unrun.

1. [x] Specify the exact additive ABI/storage/event changes for opted-in external Individual Offer
   consumers and personal funding. Prove the Garden A buyer / Garden B provider / Green Goods
   protocol-pool cases against real membership and settlement boundaries. Retain legacy behavior.
2. [x] Extend personal G$ funding through the buyer garden's existing Celo Safe: exact consent,
   deposit attribution, immutable custody and refund identities, consumed-funding enforcement,
   exclusive payment/refund and recovery. No new G$ bridge or custody vault.
3. [x] Implement voucher presentment/redemption against existing service promises: Gnosis escrow,
   explicit holder approval, partial units, return to issuer reserve, remedies and authenticated
   once-only results. Preserve the completed earned-distribution slice.
4. [ ] Project purchase, funding and redemption events in Indexer, then expose state/actions in
   Shared, then member journeys in client. This bounded local integration is now dispatched in
   [its own record](handoffs/codex-service-access-integration.md); broader steward/admin actions
   and external activation remain later work. A fixture result is not a signed live checkout.
5. [ ] Rehearse earning rewards from Garden A's course and accessing Green Goods AI membership
   through each payment route independently. Prove failures before any release decision.

Direct Gnosis purchase swaps remain a separately dispatched slice with pool-local pricing, minimum output
and deadline. WXDAI remains rehearsal-only; a swap receipt must not create another Arbitrum
entitlement. G$ purchases of vouchers and mixed-asset checkout are deferred.

## Ownership

[Cosmo-Local Integration](https://linear.app/greenpill-dev-guild/project/cosmo-local-integration-6273120022c7)
owns the two-issuer voucher integration, inherited operational evidence, hackathon package and
Q4 strategy content. Green Goods 2.1.0 owns PWA delivery, admin/PWA cohesion and public-site delivery.
RESR-73 is the architecture record; PRD-857 is the delivery parent. Existing Product slices provide
visibility while this hub retains design, dependencies and evidence. No automatic lane-state sync.

The completed Commitment Pooling project retains foundation history. Its active source hub remains
the authority for its unfinished evidence. [Project reconciliation](project-reconciliation.md)
records the complete move, separate backlogs and corrected dependencies.

## Corrected integration package — 20 October UTC

The [architecture alignment](architecture-alignment.md) starts from the user-provided protocol
resources and clarifies one commitment receiving vouchers and G$. It supersedes the several-G$
installments interpretation. Its older contract choices are superseded by the accepted 21 October spec.
The [corrected phased plan](commitment-upgrade-plan.md) maps contracts, data, Shared, apps,
deployment preparation and audit evidence. Its conditional estimates replace the wrong-scope forecast.

[PRD-1314](https://linear.app/green-goods/issue/PRD-1314) retains the roadmap and PRD-1315 the
implementation decision gate after RESR-73 research and Claude review. The original dispatch covered
the first contracts slice; the later local purchase and service-access dispatches are recorded above.
Existing child IDs remain unchanged. PRD-1323/1324 remain in Green Goods 2.1.0 for the linked-reward UI slice,
coordinated with PRD-1297/1299 and PRD-1261/1262. The
[Linear plan](https://linear.app/green-goods/document/hackathon-commitment-upgrade-plan-and-audit-readiness-7259011837e3)
mirrors this correction. Review instructions are in
[Claude's second-pass handoff](handoffs/claude-architecture-review.md).

## Sequence and completion evidence

- [x] Review the supplied v0.8 whitepaper against checkout `06a31dbf5`; retain the dated foundation
  test receipt and identify missing CLC behavior in [the review](whitepaper-v8-review.md).
- [x] Preserve completed RESR-74 due diligence and GROW-32 context in the new project. Their historical
  status does not certify current chain configuration or a new implementation.
- [x] Reconcile the current brief, architecture, tasks and evaluation; retire the August model.
- [x] **First contracts architecture:** accepted by the 21 October user dispatch; see spec.
- [ ] **RESR-73 / COM-46:** retain the broader lifecycle, actual issuer terms and live-use prerequisites;
  this contracts slice does not complete their research/community outcomes.
- [ ] **COM-46, by 21 October:** agree both issuers' service units, prices, available capacity,
  caps/limits, purchase and earning terms, partial delivery, repair and separate reporting consent.
- [ ] **PRD-1096, by 21 October:** prove the local fork loop, negative cases and account behavior.
  Mock message transport is labeled; it is not live cross-chain certification.
- [ ] **PRD-1097:** build the receipt-backed passport with real and rehearsal data distinguished.
- [ ] **PRD-1197, 22 October:** record human go/no-go, explicitly addressing every original gate.
  Depends on PRD-1096 and COM-46. No default substitution or implied funds authority.
- [ ] **PRD-1100, conditional:** perform only the specifically authorized live release after a go;
  defer/cancel with a reason on no-go, never mark an unperformed live pilot Done.
- [ ] **COM-28:** run the participant pilot after terms and rehearsal. Use the go-authorized live
  version or the labeled local version; capture consented participant language and repair findings.
- [ ] **RESR-93, in 2.1.0:** retain its accepted PWA design and independent execution evidence in its own hub. This can proceed
  independently of live CLC deployment and preserves the existing queue, draft and permission rules.
- [ ] **RESR-94 + MAR-32:** research and draft the diaspora pitch in parallel, using the
  [Claude Fable handover](handoffs/claude-fable-research-pitch.md). Update claims as implementation
  produces receipts; do not wait for a live launch to prepare the no-go story.

- [ ] **PRD-1260 + PRD-1261, in 2.1.0:** deliver the accepted garden-scoped Home/submission slice
  and a bounded paired member/steward design-cohesion slice after RESR-93. No live Gnosis dependency.
- [ ] **GROW-68 → PRD-1194:** approve the public October–December strategy, then deliver the stable
  public-site page and reviewed site updates in 2.1.0. MAR-34 reuses the same approved story.
- [ ] **PRD-1262:** record admitted versus deferred release scope and validate the included member
  and steward journeys. This is the explicit 2.1.0 QA milestone item, not an all-project completion gate.

## Event and remaining operations

GROW-43 owns event confirmation. Existing internal dates are the 16 October briefing, 20 October
conference, 24 October dry run, 27 October submission and 28 October pitch. The conservative
14:00 London submission target still needs official deadline/timezone confirmation. The deck aims
for eight to ten minutes pending the event's confirmed format.

Live Linear on 15 October marks PRD-731 release operations, PRD-732 first cycle and COM-36 season
setup Done; this is issue-state evidence, not a new deployment or CLC certification. PRD-732 and
COM-36 now live in the 2.0.0 release history. COM-11 settlement evidence and COM-3/15/35 onboarding
and workshop work remain separately tracked. COM-35 and COM-11 still need owner-confirmed dates.

PRD-727 documentation remains due 4 November and PRD-728 walkthroughs 18 November. These are follow-on
assets, distinct from the hackathon demo. PRD-651 is parked Backlog without a cycle or due date; the
active October authorization has moved to PRD-1197.

## Fiat stretch

Keep all delivery in [Garden Fiat Contributions](https://linear.app/greenpill-dev-guild/project/garden-fiat-contributions-3675da59ceb3).
Research RESR-82 first, then PRD-1031 scope. Qualify one donor market, payment method, chain, asset
and garden recipient; prove payment-to-donation reconciliation and recovery, all-in fees, identity
checks and sponsored-gas budget. Reown Starter plus Pimlico is the selected account direction;
the payment provider remains open. The diaspora story does not establish provider eligibility.

A stretch no-go leaves the core demo intact. Endowment deposits remain PRD-1039 follow-on work and
any real-money pilot remains gated by PRD-1038. No new execution deadline or spending approval was set.

## Decision record

| Decision, 21 October service-access amendment | Planned consequence |
|---|---|
| A gardener may personally buy opted-in offers across gardens and the Green Goods pool | Separate buyer/funder, buyer garden, provider garden and service recipient; do not require provider-garden membership |
| Keep G$ on Celo | Reuse the buyer garden's Celo Safe and existing payment/refund execution; no bridge or new Celo escrow |
| Preserve the earned slice; extend future purchase behavior at its owners | Narrow planned CommitmentPooling eligibility/terms and SettlementModule funding upgrades; Registry, Hats and provider roles unchanged |
| Provide voucher redemption alongside G$ purchase | Choose one route per service promise; holder-approved units return to issuer reserve, undelivered units follow remedy terms |
| Later service-access dispatch; local branch and no worktree | Implement the prepared contracts scope after proof closure; preserve uncommitted work and all live/Linear/release restrictions |

The 9 October user request authorizes the branch and project split, issue-gap cleanup, planning
reconciliation and the Claude Fable prompt. It does not authorize runtime edits or deployment.
September's issuer-service model supersedes August's weighted-contribution dispatch sequence.
The user's four-level capital narrative is the pitch direction; evidence and concrete funding
terms still determine which claims can be made. Lane and execution evidence objects remain unchanged.

## Dynamic Tech and Sun Safe: authorized implementation, 23 October UTC

Use the deployed Hats Signer Gate (HSG) v2.0.0 on Gnosis, a dedicated canonical Hats tree
controlled only by an immutable receiver, and an immutable Arbitrum publisher reading the
existing HatsModule steward role. Fixed ABSOLUTE min=2,target=2 supersedes majority signing.
GG keeps its existing 2-of-5 Safe for issuer reserve and network exchange administration.
No source account, signer identity, capacity or live deployment is invented.

Reuse: canonical IHats, CCIPReceiver/Client, existing HatsModule roles, CLI operation registry
and production/isolated-fork deployment conventions. VoucherEndpoint and GardenActionRouter
own different governance and account-action rules; neither should control this issuer Safe.
No dependency installation or replacement signature parser. HSG is the sole Safe module/guard,
with no subordinate modules or enabled delegatecall targets; lock config atomically.

| Transition / boundary | Required evidence |
|---|---|
| Steward/Owner grant; actual Steward revoke | Exact current steward role queued; non-steward roles unchanged |
| Hook or fee/send failure | Source role change persists; permissionless refresh/dispatch recovers |
| Valid authenticated delivery | Same garden/account, ordered revision; mirror eligibility then reconcile |
| Wrong router/selector/sender/domain/token payload | Reject without changing eligibility |
| Duplicate/stale or conflicting revision | Idempotent duplicate; stale ignored; conflict rejected |
| Revoke with failed Hats/Safe cleanup | Explicit eligibility false persists; old signer cannot spend |
| 0/1/2/3/4 valid stewards | Effective two throughout; fewer than two blocked; source grants recover |
| Safe/hat/admin/module escape | Locked HSG; Safe cannot rewrite owners/threshold/guard/modules/hat authority |
| Deployment review | Production bytecode, exact peers/nonces/dependency hashes/topHat expectation; no broadcast |

Role hooks queue changes and automatically dispatch from a native CCIP fee balance. Unknown
non-stewards and already-dispatched revisions cannot consume that fuel. Failure leaves a
permissionless refresh or caller-funded exact-fee dispatch retry; initial stewards need refresh.
Delivery is asynchronous, and direct external Hats eligibility changes require a refresh.
A source revocation is not a destination revocation until its authenticated update arrives.
Physical Safe threshold can be one below two owners; HSG must still reject spending.
Activation requires two confirmed valid steward accounts. Final signer names remain pending.

- [x] Implement observer, ordered publisher and Gnosis Hats/HSG receiver with direct behavioral proof.
- [x] Prove actual deployed HSG, Hats and Safe behavior on a pinned Gnosis fork.
- [x] Extend offline deployment tooling and record focused and complete critical checks.

## Live deployment package continuation, 23 October UTC

User authorizes continued deployment tooling and a reviewable live package. Tech and Sun signer
names and addresses remain deliberately deferred. No broadcast, activation, dependency install,
branch change or external tracker write is added by this preparation step.

Reuse the paused endpoint planner and steward Safe planner, the atomic JSON writer and committed
source guards, and the owned-fork harness. The missing capabilities are published CLC token/pool
deployment and the actual Pooling/Settlement source-upgrade preparation. Contract scripts own
these operations; tests must not import upstream CLC implementation source. Published interface
documentation and the already-pinned Gnosis runtime hashes own external compatibility.

- [x] Prepare two issuer tokens, their Safe-controlled upgrade timelocks and shared CLC pool
  dependencies with exact deployment plans and separate configuration/issuance drafts.
- [x] Prove those deployment boundaries and empty, unactivated readback on owned Gnosis forks;
  preserve the locked zero-signer Tech and Sun Safe until member confirmation.
- [x] Prepare true CommitmentPoolingModule and optional SettlementModule upgrades on owned
  Arbitrum forks; retain owners/state and paused end state, separating later peer pins/unpause.
- [x] Assemble the ordered operator package, public input inventory and exact remaining gates;
  distinguish native same-address fork proof from real member/provider/funding ceremonies.
- [x] Run direct RED/GREEN proof and the complete selected critical checks, then record the
  source/tree attribution and preserve all unrelated files and existing lane objects.

On 23 October, the user accepted ten starting units of each voucher and a twenty-unit pool holding
cap per asset. The earlier ten/ten draft left no incoming swap headroom and is superseded. The
twenty-unit issuance ceiling stays unchanged; the published GiftableToken does not itself implement
that business cap. Issuer acceptance, actual capacity and the other activation gates remain open.

Historical source review before the accepted zero-delay change found no intrinsic upgrade timer in HatsModule or CommitmentPoolingModule;
SettlementModule requires pause and immutable-route consistency, without a timer. VoucherEndpoint's
48-hour timer applies to later replacement of an existing endpoint implementation. Fresh proxy
initialization and owner unpause do not consume that delay. New CLC proxy upgrade timelocks use
the same issuer Safes, and their delay governs later upgrades rather than initial construction.

The [tooling evidence](artifacts/live-pilot-tooling-evidence-2026-10-23.json) records all eight
fresh selected checks, implementation/configuration hashes and owned-fork proof limits after the
accepted cap update. These completed preparation tasks do not complete the contracts lane or any
live gate. Same-address production bootstrap/native-gas signing work is the next priority, with the
actual public member account/login-method intake pending. The live deployment handoff records the
accepted Friday/Saturday checkpoints; this chat owns no Linear writes.
