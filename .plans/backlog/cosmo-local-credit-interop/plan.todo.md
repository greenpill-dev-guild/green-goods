# Cosmo-Local Integration — work and decisions

**Feature Slug**: `cosmo-local-credit-interop`
**Linear Issue**: [RESR-73](https://linear.app/greenpill-dev-guild/issue/RESR-73) (parent-only mirror)
**Linear Project**: Cosmo-Local Integration
**Linear Source**: source:plans
**Stage**: `backlog`
**Status**: `LOCAL BRANCH GATES REPAIRED; MEMBER/ISSUER LIVE PROOF OPEN`
**Created**: 2026-08-25
**Last Updated**: `2026-10-22`
**Companion documents**: [`brief.md`](./brief.md) · [`spec.md`](./spec.md) ·
[`tensions.md`](./tensions.md) · [`resources.md`](./resources.md) · [`eval.md`](./eval.md)

**Current authorized continuation, 22 October:** review the Gnosis account/provider path and
continue member-signing proof, preserving the accepted address, voucher safeguards, concurrent
work and required signing. The [account/provider record](handoffs/codex-gnosis-account-provider-proof.md)
owns this bounded continuation. Eleven fictional Gnosis cases trace actual root-validator
dispatch, legacy-module rejection, signature binding, replay and repair; 45 Shared boundary tests
pass. This does not establish actual member possession, hosted provider acceptance or sponsorship.
Keep validated commits local and all live/manual gates open.

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
release gates remain open. Earlier signed migration receipts are historical; refresh applicable
proof against the current inputs and preserve the unrelated Shared manifest export. No push,
merge, production activation, live deployment, external tracker write or worktree is authorized.

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
