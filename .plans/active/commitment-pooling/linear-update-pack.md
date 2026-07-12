# ARCHIVE — Commitment Pooling + Community Needs Linear Reconciliation Pack

**Prepared**: 2026-07-10  
**Execution truth**: `.plans/active/commitment-pooling/` and `.plans/active/community-interface/`  
**Mirror policy**: `parent_only`; no new issues; canceled lane children stay historical and non-dispatchable  
**Status**: fully applied and superseded by the 2026-07-11 live reconciliation; **do not execute or re-apply this pack**  
**Historical apply order**: local specs/status → handoffs → visuals/public copy → projects/milestones → issues → documents → live re-read

## Source hierarchy

1. Repo plan hubs are implementation truth.
2. The canonical synthesis remains linked as the long-form rationale.
3. Linear is a concise roadmap and coordination mirror; it never makes a lane ready on its own.

## Locked coordination envelope

- Commitments are module-native records on Arbitrum; EAS holds the four Community schemas plus assessment/testimony attestations.
- Direction-aware fulfillment confirmation means an Offer recipient confirms and a Request creator confirms. The accepted provider cannot confirm through an ordinary or fallback path.
- Approval-gated claim requests store claimant, kind, provider garden, timestamp, and active state. Acceptance consumes those terms; decline affects one request; the commitment-keyed index marks competing pending requests superseded.
- A pool may have one open Season plus concurrent Campaigns. Disputes store the previous state and use `RestorePrevious`; an expired commitment cannot become Fulfilled.
- Every Envio entity carries `chainId` and a composite ID. `Garden.id` migrates to `chainId-address`; generic audit actor is nullable and comes only from an explicit event field.
- Green Goods models `WorkingCapitalToProtocol` and `ProtocolToGarden`; House of Alignment → working capital remains upstream.
- Settlement batches persist 1–24 immutable member IDs. A failed batch is reconciled per member.
- A report persists `reportedBy` and a Celo transaction hash but is not receipt proof. Chainlink Functions is the only verification path. Infrastructure failures remain `Reported`; a finalized invalid receipt becomes `Failed`; only a valid current request callback becomes `Verified`.
- Each garden Safe uses exactly 2-of-3 recovery owners: protocol recovery multisig, Dev Guild/working-capital recovery multisig, and one named garden recovery delegate. Executors are bounded Roles members and cannot be owners.
- Failure of the Celo AA/paymaster round trip leaves Safe-to-Safe funding available but keeps automated member delivery disabled; there is no substitute member-claim route.
- Community is an independent PWA at `community.greengoods.app` (local port 3010) after a shared-foundation extraction. Needs/Create/Profile stay there; pools and evaluator tools live in admin `/community`; funder discovery stays in existing client public surfaces.
- Join-request persistence remains blocked on RESR-64 through 2026-08-12. Public on-chain requests, Linear-as-queue, and implicit localStorage are excluded.

## Project and milestone mirrors

| Record | Date | Required mirror |
|---|---:|---|
| Commitment Pooling project | 2026-09-30 | Arbitrum proof, Functions-verified Celo settlement, independent Community delivery boundary, and `.plans` source hierarchy |
| July dry run | 2026-07-31 | confirmed mandates or explicit incomplete/unavailable status; no deployment claim |
| August release | 2026-08-31 | corrected contract/indexer interfaces; Functions oracle gate; exact Safe ownership; AA-gated member delivery |
| September community interface | 2026-09-30 | independent Community PWA plus admin `/community` and existing public-client funder surfaces |
| Community Needs & Signals project | 2026-12-31 | four-schema demand layer, two-axis Need state, shared foundation, decision-gated membership queue |
| Needs substrate | 2026-08-31 | exact schemas/resolvers, joined-read boundary, shared foundation, offline jobs, funding/export contracts |
| September needs app | 2026-09-30 | Community PWA, operator/evaluator admin, funder public surfaces, accessibility/locales/QA |
| Post-pilot hardening | 2026-12-31 | evidence-only promote/defer review for PRD-695/696 |

## Issue reconciliation matrix

| Issue | Live action | Dispatch rule |
|---|---|---|
| RESR-57 | Replace receipt language with Functions-only verification; retain synthesis link and audience deliverables | Research coordination, not implementation dispatch |
| RESR-58 | Add direction-aware confirmation, stored claims, provider-garden Work, oracle/retry scenarios | Research coordination |
| RESR-62 | Link the replaced two-pass mandate survey and readiness evidence | Human research lane |
| RESR-64 | Freeze engagement-model decision evidence and 2026-08-12 join-persistence gate; link new document | Human decision lane |
| PRD-649 | Mirror exact architecture contract across contracts/indexer/deployment while retaining one `package:contracts` label | Architecture coordination |
| PRD-650 | Apply the Commitment Pooling parent-only mirror | Parent record; contracts handoff is the only ready implementation unit |
| PRD-686 | Rewrite to mandatory Functions settlement, immutable max-24 batches, exact Safe recovery, and AA member gate; retain 2026-07-29; remove agent dispatch | Blocked until named settlement evidence exists |
| PRD-701 | Align operator onboarding with corrected mandates, implementation review, and gathering rehearsal | Human/operator lane |
| PRD-687 | Keep Community parent-only mirror; exact four-schema/shared-foundation envelope | Parent record; no direct dispatch |
| PRD-691 | Remove agent dispatch; mirror independent Community/admin/public-client scopes; preserve block by PRD-687 | Blocked application tracker |
| PRD-695 / PRD-696 | Keep Backlog, no agent dispatch, no cycle or due date | Evidence-gated parked records |
| PRD-682 | Rewrite as independent Community PWA plus prerequisite shared extraction; remove agent dispatch | Blocked until shared/state/ops gates pass |
| PRD-683 | Replace historical body with canonical supersession note; remove agent dispatch | Canceled historical record |
| PRD-651 / PRD-697 | Park in Backlog, remove cycle/due/agent dispatch, retain evidence-gated follow-on context | Non-dispatchable follow-ons |
| PRD-671–681, PRD-688–690, PRD-692–694, RESR-63, RESR-13 | Replace bodies with concise canonical supersession notes and remove `agent:*` labels | Canceled historical records; detail lives in plan-hub handoffs |

All issue label sets use only `protocol:*`, `package:*`, `activity:*`, `source:*`, `agent:*`, and `funding:*`; no issue receives more than one `package:*` label. Consolidated cross-package scope is stated in the body rather than by stacking package labels.

## Document reconciliation

1. Preserve and link the canonical synthesis.
2. Replace **Garden Mandate Survey** with the current two-pass instrument from Community `research-plan.md`, including consent, confirmed/incomplete cohort state, direction/confirmation rules, operator capacity, G$ relevance, implementation review, and gathering rehearsal.
3. Create **Community Needs & Signals — Engagement Model** under RESR-64 from the Community spec, visuals, journeys, research plan, join option matrix, and decision evidence.
4. Refresh the RESR-57 research memo with built/planned/reported/oracle-verified/evidence-gated classifications.
5. Refresh the RESR-58 use-case document with direction, claim, provider-garden, settlement-oracle, offline, funding, evaluator, and funder failure/recovery scenarios.

## Live pre-write evidence

The 2026-07-10 refresh found the projects and dates intact, PRD-687 still blocking PRD-691, and PRD-695/696 already parked. Stale coordination remained in the Commitment Pooling August milestone, RESR-57, PRD-650, PRD-686, PRD-682, PRD-683, PRD-651/697, the canceled lane children, and the two required document writes. This pack supersedes the July 9 credit snapshot; each write must be attempted against current live state.

## Post-write verification checklist

- Re-read both projects and every active milestone.
- Re-read every issue in the matrix, including relations, labels, state, priority, due date, cycle, project, assignee/delegate, and documents.
- Confirm PRD-687 still blocks PRD-691.
- Confirm parent-only records and parked/canceled records have no agent dispatch.
- Confirm every issue has at most one `package:*` label.
- Re-read every changed document and confirm the canonical synthesis is still linked.
- If Linear reports exhausted write credits, record that exact rejected action once and stop all retries for it.

## Applied result

Applied and live-re-read on **2026-07-10**:

- 2 projects and all 6 active milestones carry the corrected architecture, placement, dates, and gates;
- 16 core/parked trackers plus 19 referenced canceled children were normalized without creating an issue;
- PRD-650 and PRD-687 preserve `parent_only`; PRD-687 still blocks PRD-691;
- PRD-686, PRD-682, PRD-691, PRD-695, and PRD-696 have no agent label or delegation;
- all canceled children have concise supersession notes and no agent label;
- every inspected issue uses canonical label families and at most one `package:*` label;
- the Garden Mandate Survey, RESR-57 memo, and RESR-58 scenario document were replaced; the RESR-64 engagement-model document was created and is linked;
- the canonical synthesis remains linked from the projects, RESR-57, the memo, the scenario document, and the engagement model;
- no Linear write was credit-rejected.

**Historical snapshot (2026-07-10):** PRD-651 and PRD-697 were correctly Backlog, Low priority, cycle-free, and non-dispatchable but still showed due date **2026-07-29** because the then-connected schema could not express `null`. Both dates were later cleared in the Linear UI and live-re-read as `null` on 2026-07-11; no action remains.

### Final-audit credit blocker

After the technical cross-read corrected the settlement receipt predicate, one final PRD-686 description refinement was rejected by a temporary usage limit and was not retried. **Resolved 2026-07-11:** PRD-686 and the RESR-57 rollout mirror now carry the exact rule that successful Safe/module execution is required, canonical-G$ `Transfer.from` equals the stored Safe, the recipient/amount multiset matches exactly, and outer `transaction.from` may be the scoped Zodiac executor. No wording action remains.

### 2026-07-10 follow-up — RESR-57 external-brief session

Production decisions locked with Afo: English-first brief, shareable doc/PDF venue through the July 31 dry run (docs-site later), precise funding provenance including the ~$800/month figure, a one-line design-only borrow-and-repay mention with a matching guardrail, a settlement-authority line pointing derivatives at `settlement-spec.md`, and narrow+reroute ownership (evaluator architecture note → PRD-649/docs lane; operator onboarding guide → PRD-701; interim 2026-07-16 target for the operator-facing subset).

Repo-side applied: `external-communications.md` gained the settlement-authority line, a documentation-set ownership map (plus a member one-pager artifact), and three new claims guardrails (borrow-and-repay design-only; citation hygiene against the four unsourceable claims; precise Good Labs/GIP-26/$800-month provenance). `external-brief.md` (v1 draft, English) was created and passes the banned-vocabulary check.

**Historical snapshot:** the connector was unavailable during this session, so the pending writes were staged in `linear-apply-pack.md`. They were subsequently applied and live-reconciled on 2026-07-11, including the predicate wording and PRD-651/697 due-date clears. Do not apply from either archived pack.
