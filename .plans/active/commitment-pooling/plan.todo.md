# Commitment Pooling Plan

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Status**: `ACTIVE: local specification review complete; live mirror convergence required before implementation; value release, Safe authority, audit, canary, and external evidence remain blocked`
**Created**: `2026-07-03`
**Last Updated**: `2026-07-25`

Linear mirror: project [Commitment Pooling](https://linear.app/greenpill-dev-guild/project/commitment-pooling-4bc53572f354). Native phases: **Scope and Design** (2026-07-22), **Build** (2026-07-31), **Release** (2026-08-12), and **Follow On / Hardening** (2026-09-30). Operational checkpoints are separate: July dry run (2026-07-31) and Community plus settlement-evidence delivery (2026-09-30). **The full document map is the next section.** Community-specific diagrams, wireframes, journeys, and research operations live in `.plans/active/community-interface/`. The 2026-07-10/11 reconciliation, PRD-686/RESR-57 predicate, and null PRD-651/697 dates were live-verified historical state; current Linear convergence must be reread before any write. **Fourth-garden policy (Decision Log #29, 2026-07-18 — supersedes Decision Log #25 and Decision Log #27): no fourth garden is selected.** The slot is open, candidates are under consideration, and **no artifact names one**. The three named gardens cover all four action domains on their own. The earlier Decision Log #25→Decision Log #26→Decision Log #27 naming sequence is closed history; do not re-apply it.

> **Linear consolidation (2026-07-05).** To keep Linear minimal, the per-lane workstream issues were closed into a small set of parent **trackers**; **this plan is the lane-level execution truth**. Trackers: **PRD-650** August proof MVP (absorbs PRD-671→681), **PRD-686** G$ split-state settlement, **PRD-682** September community interface (absorbs PRD-683), **RESR-62** July dry run (absorbs RESR-63 + RESR-13; RESR-53 stays in Impact Framework). Needs-layer trackers **PRD-687** substrate (absorbs PRD-688/689/690) and **PRD-691** app (absorbs PRD-692/693/694) live in the **Community Needs & Signals** project. Kept as-is: **PRD-649** (architecture record), **PRD-651** (deferred transferable settlement vouchers), research records **RESR-57/58/64**, parked **PRD-695/696**, and the linked-research issues **RESR-15/RESR-4/PRD-275**. The per-lane `PRD-6xx` / `RESR-xx` IDs in the tables below are **historical labels** for the closed child issues — dispatch reads the lanes here and rolls up to the parent tracker, not to those closed IDs.
>
> **Canonical historical mapping (2026-07-20).** References to the retired identifiers resolve as **PRD-701 → COM-3** and **RESR-62 → COM-7**. Preserve the old identifiers inside frozen archives and dated history; use COM-3 and COM-7 for active instructions. **Extended 2026-07-24: PRD-735 → COM-11** (the settlement-evidence lane issue moved to the Community team; parent PRD-650, Follow On / Hardening milestone, and 2026-09-30 due date unchanged) — use COM-11 for active instructions (corrections-log §13).

## Document map

Every file in this hub, by role. **This list is the index — if you add a document here, add its row.**

| Document | Role | Authority |
|---|---|---|
| `plan.todo.md` | **This file.** Decisions, tracks, lane checklists, follow-ups. The hub entry point. | Lane-level execution truth |
| `contract-spec.md` | Pooling module + register: state machines, events, §6.1 permission matrix | **Contract-layer source of truth** |
| `settlement-spec.md` | G$ split-state settlement: Arbitrum CCIP command module, bounded Celo executor, acknowledgment, Safe authority, AA gate | **Settlement transport + execution source of truth** |
| `pilot-evidence-spec.md` | September pilot evaluation: claim hierarchy, baselines, metric registry, coercion/exposure/repair safeguards, circulation integrity, privacy, and reporting gates | **Pilot-evidence and outcome-claim source of truth; no implementation authority** |
| `../../backlog/commitment-credit-follow-on/spec.md` | Borrow-and-repay `CreditRegister` | Design only — **blocked follow-on**, not dispatchable |
| `uiux-spec.md` | Canonical cross-surface flows + §4 state tables + job kinds | UI/UX contract |
| `wireframes.md` | 23 CP frame headings across four surfaces (W1–W16, W13b, W21–W26; W6 is a retirement tombstone) | **Lo-fi structural truth** |
| `diagrams.md` | D1–D17 Mermaid execution reference (24 named sections rendering 35 Architecture Mermaid blocks; ERD, sequences, state machines, topology, accountability/recognition/payment, deployment, error taxonomy) | Flow truth |
| `prototypes.md` | 33 numbered storyboards / 38 source journeys (SB-1–33, including surface/task splits) + missing-frame index + action inventory | Fidelity-neutral walks — **adds no design authority** |
| `visual-assets.md` | Index of the audience graphics (SVG + 2x PNG) + style contract + regeneration | Asset index |
| `acceptance-matrix.md` | Exact copy / state / public-claim targets for handoffs and QA | Acceptance targets |
| `reports/corrections-log.md` | Claim-by-claim verification ledger (VERIFIED / CORRECTED / UNVERIFIABLE / SUPERSEDED) | **Correction record — §9 owns the fund-topology correction** |
| `external-brief.md` | Pointer to the canonical Google Doc plus the repo's implementation/evidence source map | **Pointer only — never a prose mirror** |
| `reports/audit-2026-07-20.md` | Original CP-AUD-001–021 dispatch-readiness audit | **IMMUTABLE INPUT — never edit** |
| `reports/audit-wave-1-2026-07-20.md` | Post-correction Wave 1 P0/P1 re-audit and lane-release record | Dated audit evidence |
| `reports/audit-final-2026-07-20.md` | Final CP-AUD-001–021 repository disposition and external blockers | Dated audit evidence |
| `reports/external-verification-2026-07-20.md` | Current GoodDollar/House of Alignment/token/market claim verification | Distribution gate |
| `reports/confidential-fourth-garden-signoff-2026-07-20.md` | Name-free human absence-attestation form | **Pending human sign-off; distribution blocker** |
| `reports/linear/linear-apply-pack.md` | Record of writes applied to Linear on 2026-07-11 | **ARCHIVE — do not execute or re-apply** |
| `reports/linear/linear-update-pack.md` | Earlier reconciliation pack, superseded | **ARCHIVE — do not execute or re-apply** |
| `status.json` | Machine state for the plan harness | Machine lanes |
| `handoffs/` | 15 dispatch files (13 agent + two human); `README.md` is the index, `human-release-ops.md` owns broadcast/cutover authorization, and `human-settlement-evidence.md` owns the September operational-assignment gate | Per-lane dispatch |

**Published artifacts** (rebuilt from this hub, same URLs on each rebuild):

- [Flow Prototypes](https://claude.ai/code/artifact/19c3dcad-ac1d-4398-bcd4-57d0c892be2c) — 36 review-visible guided flows + 24 hi-fi screens; the September Community source flow and wireframes remain hidden but validated (`prototypes-artifact.build.ts` + `hifi/`)
- [Visual Asset Gallery](https://claude.ai/code/artifact/007ef090-9e26-4b1d-898c-615155304d9d) — all assets rendered, four audience tabs: story · Architecture · Screens · Reference (`visual-assets-artifact.build.ts`)

**External-facing canonical home**: [Green Goods Commitment Pooling (Google Doc)](https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit). `external-brief.md` is a pointer and source map only; no repo file mirrors the external narrative.

## How to read decision citations

⚠️ **This hub has two independent decision lists, both numbered from 1.** A bare `#N` is therefore ambiguous in the range 1–29, and this has caused real mis-resolutions. Until a full renumber lands:

| List | Range | What it is |
|---|---|---|
| **Decision Log** (the table below) | 1–29 | Curated current-state decisions spanning the whole feature, newest last |
| **Full decision register** (further below) | 1–60 | The 2026-07-03 alignment session verbatim, plus dated addenda 28–60 |

- **`#30`–`#60` are unambiguous** — the Decision Log stops at 29, so those are always the register (`#34` alone is cited 71×).
- **`#29` became ambiguous on 2026-07-18** when the Decision Log gained its own `#29` (fourth garden not selected). Register `#29` is a different decision entirely. Always name the list for this number.
- **`#1`–`#28` must be resolved by reading both.** They diverge from `#8` onward: Decision Log `#17` = "app becomes multi-chain"; register `#17` = "clean room, GE paper only". Decision Log `#28` = the visual-asset audit; register `#28` = the needs-layer EAS schemas.
- **Sub-letters do not disambiguate** — both `#28` (Decision Log, a–f) and `#34` (register, a–h) carry them.
- **When writing a new citation, name the list**: "Decision Log #17" or "register #17", never a bare `#17`.

Known mis-resolutions fixed in place: `contract-spec.md` §Grassroots-Economics-grounding (was a bare `#17`, meant the register) and register `#36`'s reference to the lo-fi policy (means Decision Log `#13`, not register `#13`). A full renumber to distinct prefixes is a deferred follow-up — it would touch ~130 citations across files other agents hold.

## Decision Log

**Cite entries in this table as "Decision Log #N"** — see the disambiguation note above.

| # | Decision | Rationale |
|---|---|---|
| 1 | Commitments are module-native records, not EAS attestations; EAS gains exactly two schemas (assessment v3, community testimony) | EAS attestations are immutable one-shot records; commitment state changes constantly. User decision 2026-07-03, drawing on the Grassroots Economics structure. |
| 2 | `CommitmentPoolingModule` (control plane) + companion non-transferable ERC-1155-style `CommitmentRegister` (classes, balances, quotas), voucher-shaped from day one | Transferable settlement vouchers later wrap register classes 1:1 on the same poolId; no proof construct gets replaced. Supersedes PRD-649's single-artifact stance (user-approved). |
| 3 | Hybrid state weight: hard transitions on-chain (seed, offer/request, accept, evidence count, ReadyForConfirmation, Fulfilled, cancel/expire, dispute flag, cycle open/close/compost, pool pause); Draft and review-soft states derived | Full three-machine on-chain would be the heaviest contract in the repo; EAS is not indexed so events must carry everything the indexer needs. |
| 4 | EAS bridge: WorkApprovalResolver try/catch hook (GAP precedent) + operator `syncApprovedWork` fallback; approvals count only for pre-linked workUIDs | Automatic state without blocking attestations; operator-curated linkage is the trust model. |
| 5 | Protocol pool = root garden (tokenId 1) pool, poolType PROTOCOL, cross-garden claim reach | Reuses existing custody and hats; no new identity machinery. |
| 6 | Per-commitment claim mode (open vs approval-gated) set at seeding; declared reward carries an explicit rail. `ArbitrumExternal` uses operator-recorded `RewardPaid`; `CeloSettlement` uses the separate CCIP settlement module; `None` has zero reward fields. The core module never custodies funds and the two payout records are mutually exclusive. | Zero CookieJar contract changes in August; custody stays where it is. Rail discriminator clarified by review on 2026-07-23. |
| 7 | Lightweight evidence object (IPFS CID via module event) for SupportService/StewardCaptured; Offer recipient or Request creator confirms by default, named groups exclude the accepted provider, and “Not yet” raises a dispute; DomainImpact keeps full MDR | One direction-aware human loop for low-stakes mutual aid without provider self-confirmation; full approval rigor where impact is claimed. |
| 8 | v3 authorship split: baseline = evaluator or operator; delta/re-assessment = Evaluator Hat only; testimony = Community Hat only | Preserves analog capture while keeping the two-voice evaluation model clean. |
| 9 | Surfaces: PWA Garden tab + WalletDrawer pools panel; admin Garden workspace + Community workspace Pools mode + Hub queue; editorial GardenDialog + /impact; September `packages/community` as an independent PWA at `community.greengoods.app` (local port 3010) after shared runtime/auth/offline/shell foundations are extracted | Q&A decisions 9, 10, 21, 3; WalletDrawer already reserves the commitments tab and `/community` is the canonical admin operational workspace. |
| 10 | Clean room: Grassroots Economics paper + public docs only, never AGPL Sarafu source | RESR-57 D3 + non-AGPL constraint. |
| 11 | Seasons & Campaigns project converted in place; legacy season issues composted with pointer comments | Seasons and campaigns are cycle types inside the pool; separate project inverted the dependency. |
| 12 | Out of scope everywhere: bridged G$, bridge custody or unbounded value authority, a `packages/agent` settlement relayer/write path, Sarafu integration, transferable settlement vouchers / `settlementAdapter` activation, indexing Celo/G$ transfers, garden-to-garden federation, leaderboards, public credit scores | Supersedes the stale "no Celo/no G$" wording. Split-state G$ settlement is in August via PRD-686; these guardrails keep the settlement rail bounded. Optional later agent alerts are read-only and carry no settlement authority. |
| 13 | Design artifacts live in this folder: low-fi in-repo wireframes for all four surfaces (`wireframes.md`) + mermaid diagrams (`diagrams.md`) + the consolidated permission matrix (contract-spec §6.1); docs-site promotion rides PRD-727 at ship (historical label PRD-680) | User alignment 2026-07-04 (post-#619 audit): understand flows on screens before build; low fidelity on purpose; the docs site describes what is live. |
| 14 | G$ split-state settlement enters the **August release** through message-only CCIP: Arbitrum `SettlementModule` derives and dispatches the command; bounded Celo `CeloSettlementExecutor` executes as a Zodiac Roles member; an authenticated Celo → Arbitrum acknowledgment is the only path to `Confirmed`. Contract state is `Queued → Dispatched → Confirmed | Failed`; individual cancellation is limited to unbatched Queued or authenticated Failed items, while a Queued batch cancels atomically in full. The UI additionally derives distinct delivery-delayed and executed/ack-pending views without creating new mutable settlement states. No manual report or verification path exists. | User re-freeze 2026-07-23 after Chainlink Functions retirement; supersedes the 2026-07-10 receipt-verification transport while preserving split-state custody. |
| 15 | Fund topology: HoA stream → GG protocol Safe (Celo) → garden Celo Safes → members. One deterministic Safe mapping per garden, deployed on demand. Pilot recovery is exactly 2-of-3: protocol multisig, Dev Guild recovery multisig, and named garden recovery delegate; no owner is an executor. Green Goods queues only the derived ProtocolToGarden funding route; HoA → protocol Safe remains upstream context. | User-confirmed topology and settlement trust review through 2026-07-10; working-capital hop removed by user decision 2026-07-18 (corrections-log §9). |
| 16 | Members receive G$ at same-address smart accounts on Celo only after the AA/bundler/paymaster gate passes. If it fails, automated member delivery and member sends remain blocked while ProtocolToGarden funding may continue; no alternate member-claim path ships. | User decision 2026-07-10; settlement-spec §5. |
| 17 | The app becomes multi-chain this iteration: primary chain (`VITE_CHAIN_ID`) + settlement chain (Celo 42220). Status reads from the indexer and Safe balances use a second viem client; member balance/send surfaces ship only after `memberDeliveryEnabled` records the AA/paymaster gate. | User decisions through 2026-07-10; settlement-spec §5. |
| 18 | Borrow-and-repay becomes a blocked follow-on lane: `CreditRegister` is designed in `../../backlog/commitment-credit-follow-on/spec.md`, but it is not part of the August base MVP and is not dispatchable without an explicit unblock | User decision 2026-07-06; keeps GE mutual-credit design visible without expanding the hard August commitment. |
| 19 | `status.json` uses only plan-hub canonical machine lanes (`contracts`, `state_api`, `ui`, `qa_pass_1`, `qa_pass_2`); detailed workstreams remain as `execution_sub_lanes` and this checklist | Keeps `node scripts/harness/plan-hub.mjs validate`, `list`, and `record-tdd` usable without losing the Codex/Claude sub-lane breakdown. |
| 20 | ~~Linear sync is explicit parent-only for this hub (`linear.laneSyncMode = parent_only`)~~ **SUPERSEDED 2026-07-20 by register #37** — `laneSyncMode` is now `lane_issues` and each execution sub-lane carries a thin Linear issue. This entry is the Decision Log twin of register #31; both are superseded together. | Original rationale: preserved the low-noise Linear footprint and avoided using PRD-650 as fake lane issue IDs. The issue-cap constraint behind it lifted; the anti-duplication rule it protected survives as register #37's "lane bodies must not restate handoff scope". |
| 21 | Commitment domain scope is optional and multi-valued. DomainImpact uses repeatable `CommitmentRequirement { actionUID, requiredCount }` rows; actions may share a domain, while domains are derived tags rather than a positional uniqueness constraint. UID `0` is valid and array presence is the binding signal. The UI starts with four visible rows but can add more. A named `MAX_REQUIREMENTS` replaces the accidental four-domain cap; 16 is the provisional target and implementation must benchmark 8/16/24/32 before freezing it. `CommitmentCreated` emits every immutable requirement fact, and approval-gated claims use a commitment-keyed companion index for deterministic decline/accept/supersede handling. | User architecture amendment 2026-07-28. The old max-four rule came from coupling requirements to the four-value `Domain` taxonomy, not from a product or gas decision. |
| 22 | G$ reward commands derive garden/recipients/amounts from a frozen fulfilled-commitment payout plan. The funding route remains exactly ProtocolToGarden and independent from rewards; token, Safe, target, and calldata are never caller supplied. The provider garden Safe pays eligible contributors, with an explicit garden-retained amount and one child disbursement per non-zero contributor allocation. The versioned command/ack tuples remain frozen in `settlement-spec.md`; same-key retries are idempotent; acknowledgment retry is independent; only an authenticated success acknowledgment for the subject's current key/attempt produces `Confirmed`. Batch membership is immutable, the compile-time ceiling is 24, and the production limit remains measurement-gated; failed contributors reconcile independently. | User architecture amendment 2026-07-28. This preserves the bounded CCIP machinery while replacing the singular-beneficiary assumption with a garden-managed distribution plan. |
| 23 | Pilot focus cohort named: operational artifacts (RESR-58 scenarios, RESR-62 survey, July tracking doc, PRD-701 onboarding) carry only Tech and Sun Hub (Awka, Nigeria), Greenpill Cape Town (Muizenberg / Deep South Circles), AgroforestDAO / Redemption Hill (Bias Fortes, Brazil), plus one TBD mature MRV-adoption garden selected via parallel deep research; other synthesis gardens stay narrative context. RESR-58's document is garden-first (journeys as the coherence layer, mechanism scenarios as the normative appendix, new S11 institutional-partner and S12 MRV-adoption scenarios); UNICEF is modeled as an off-platform partner (exports + receipt-checked FundingAttribution, no account or confirmation role). Naming a candidate never presumes readiness. | User alignment Q&A 2026-07-10; RESR-53 was canceled 2026-07-06 and folded into RESR-62's unified instrument. |
| 24 | July operator cadence and settlement breadth aligned: PRD-701 moves to due 2026-07-30 (operator engagement lands with RESR-62's window; the 2026-07-31 dry-run milestone holds; the 07-16 Product-cycle boundary stays a cycle fact, with outreach expectations only). Every focus garden is G$-settlement-capable in August (one Celo Safe per garden, on demand); Tech and Sun Hub is the first-execution hypothesis and Pass-2 evidence orders the rollout — supersedes the derivative-level "single Pass-2-confirmed garden, sink-first" wording (the settlement lane was always per-garden; no gate, ABI, or acceptance change). TAS is the single Awka hub today (multi-hub stays roadmap/vision). UNICEF is a funded program for Greenpill Cape Town's waste work (partner stays off-platform; Pass 1 captures reporting cadence/deadline and funding path). | User alignment Q&A 2026-07-11 (plan-mode session); settlement-spec.md and codex-settlement handoff grep-verified free of single-garden assumptions. |
| 25 | Garden 4 selected: a candidate was chosen as the mature MRV-adoption anchor, owning the B4/S12 journey with the es locale proof riding B4. **Superseded by Decision Log `#29`; no selection was ever made, and the candidate is deliberately not named in any tracked artifact.** Slotted into RESR-58 Part A/B4 and the reward-path matrix, the July tracking rows, RESR-62/PRD-701/RESR-57 cohort lines, and the external-brief cohort. Pass 1 verifies the five selection criteria as evidence, not assumption. | User selection 2026-07-11 (read out in session; supersedes the deep-research TBD slot). |
| 26 | Fourth-garden hold: the #25 selection is NOT presented until first contact is made. All presentation-facing and operational artifacts (RESR-58 doc/issue, RESR-62, PRD-701, RESR-57, July tracking doc, external brief, rollout plan, research-plan) carry an anonymous "fourth garden — in outreach, named only once participation is confirmed" slot with the selection criteria retained; the outreach target's name lives only in this decision log and internal notes. The three named gardens alone cover all four action domains, so the four-domain claim stands. In the same pass, the RESR-58 document was reformatted (audience-entry table, TOC, terms box, role legend, per-journey template, S-style headings, bulleted Part D) and strengthened per the 25-finding audit — including new S13 (declared reward → RewardPaid, the only July reward rail) and S14 (protocol pool + cross-garden claim, the dry run's mechanism), "campaign cycle" disambiguation per contract-spec's own rule, and bidirectional B↔S cross-references. | User decisions 2026-07-11 (second plan-mode session): present only what is accurate; audit findings L1–L8 / C1–C8 / G1–G9. |
| 27 | **SUPERSEDED 2026-07-18 by Decision Log #29 (fourth garden NOT selected, slot open) — do not re-apply without a fresh owner decision; it has been reversed twice.** ~~Fourth-garden naming stands (supersedes #26's hold)~~: **the candidate** was named across coordination and presentation artifacts with the **"selection is not participation"** guardrail — no external claim stated it participates until its corrected mandate was confirmed (RESR-62 evidence; naming never presumes readiness). The live Linear r4 pass of 2026-07-11 afternoon (RESR-58 doc r4 + issue, RESR-62, survey + Pass-2 call docs, external brief, rollout plan, manually uploaded companion graphics) is the canonical presentation state; repo artifacts align to it, and the same-day "naming regression" classification is retracted. | User decision 2026-07-11 (confirmed during the commit/reconciliation session after evidence review of the r4 pass). |
| 28 | Visual-asset audit decisions: (a) per-action required counts — `requiredApprovedWorkCounts[]`/`approvedWorkCounts[]` positional with `requiredActionUIDs`, ReadyForConfirmation requires every requirement met, `approvedUnits = floor(targetUnits × Σ min(approved, required) / Σ required)`, `ApprovedWorkCounted` gains `requirementIndex`, indexer gains `CommitmentRequirement` (contract-spec amendment 2026-07-18); (b) fund topology corrected — HoA stream lands directly in the GG protocol Safe, single ProtocolToGarden route (#15 updated); (c) **Garden Steward** is the standardized CP role name (steward = operator/owner Hats; app-wide rename is a follow-up); (d) W22 batch operations move to a NEW deployer-gated admin **Operations** workspace (the former oracle treatment is superseded by CCIP command/ack health); (e) pool-surface history = per-view filter chips, no History stage; (f) W6 home summary card retired — WalletDrawer Commitments tab header is the only promises summary. | User visual-asset audit, three AskUserQuestion rounds, 2026-07-18 (corrections-log §9–10), presentation label reconciled 2026-07-23. |
| 29 | **Fourth garden is NOT selected — supersedes #25 and #27.** No candidate was ever selected — the earlier entries recorded an option under consideration, not a decision. The fourth slot is **open**. No artifact — repo, Linear, Google Doc, graphics, or presentation prose — names a fourth garden; all describe the slot as open with its selection criteria retained. Any candidate's identity lives in research-notes storage only — **this repository is public**. The three confirmed candidate gardens (Tech and Sun Hub, Greenpill Cape Town, AgroforestDAO / Redemption Hill) cover all four action domains on their own, so the four-domain claim stands without a fourth name. **Never re-introduce a fourth-garden name without an explicit new selection decision.** | User correction 2026-07-18, on review of the doc-consolidation pass; candidate name scrubbed from every tracked artifact 2026-07-19, after it was found stated in the same sentence as the rule forbidding it. |
| 30 | Every accepted commitment has one accountable `leadProvider` plus an explicit event-indexed contributor roster; a solo commitment is a team of one. Contributor policy is fixed at creation as Open or LeadManaged, optional requirement assignments are supported, and the roster freezes at ReadyForConfirmation. Only active contributors may link Work or receive evidence attribution. Every contributor is excluded from confirmation, while the register's open-commitment cap remains charged only to the lead provider. | User architecture amendment 2026-07-28. Accountability stays legible without erasing the group that actually completed the work. |
| 31 | Gardener-class Hypercert recognition is allocated equally across fulfilled commitments by default, then within each commitment uses a fixed 20% equal-participation floor plus 80% verified-contribution weight. Evidence and approved Work credit record only while the commitment is Accepted and unfrozen; Fulfilled is the additional recognition-eligibility gate. The cycle policy is fixed at open; `closeCycle` and `cancelCycle` require the cycle's O(1) live-commitment count to be zero so neither terminal cycle transition can strand a commitment or precede a recognition-changing transition. | User architecture amendment 2026-07-28, evidence lifecycle clarified 2026-07-29. Cross-commitment raw work units are heterogeneous, while the within-commitment split must still reward people who carried more of the work. |
| 32 | A commitment payout plan begins from the final Hypercert recognition weights, then permits steward edits with a required reason and an explicit `gardenRetainedAmount`. Recognition and payment remain distinct records and are shown side by side before dispatch. The invariant is `declared reward = retained amount + sum(non-zero contributor payouts)`. | User scope lock 2026-07-28. This is the approved default for the remaining allocation question, while preserving room for funding constraints and community judgment. |
| 33 | Contributor payout plans are explicitly finalized before any child preparation or dispatch. Finalization verifies the recognition and amount-derived payment vectors plus exact conservation, makes the plan immutable, and creates no child. A later idempotent per-contributor preparation materializes one Queued child from a frozen non-zero row. A zero-child all-retained plan completes at finalization without a self-transfer. Recipients must be frozen eligible contributors and their Celo accounts are derived, never typed as arbitrary addresses. Overall plan status includes unprepared rows plus child states; partial success is visible, failed contributors requeue independently, and child cancellation never clears the one-plan-per-commitment pointer. | Review closure 2026-07-28, child lifecycle clarified 2026-07-29. It preserves the bounded settlement state machine while preventing editable-draft or finalization-created orphan children. |
| 34 | The UI separates three relationships everywhere they matter: who is accountable, who contributed, and who is paid. Team membership, requirement credit, contribution evidence, recognition weights, payout edits, retention, partial settlement, and per-recipient receipts are first-class states across W2/W2a/W2b/W3/W4/W8/W10/W11/W21/W22/W23/W25/W26. | User architecture amendment 2026-07-28. A multi-person data model without visible composition and correction paths would reproduce the same singular-provider UX failure. |
| 35 | This amendment updates planning, diagrams, prototypes, ontology/docs, and tracker mirrors only. Product contracts, indexer, shared state, UI packages, deployment, broadcast, Safe authority, and value movement remain blocked behind their existing lanes and proof gates. | Scope boundary for the 2026-07-28 alignment pass. |
| 36 | Automatic Hypercert allocation has no unearned lead or metadata-only fallback. Ready transitions and direct Fulfilled dispute resolutions require an available recognition policy and at least one verified contributor; W26 blocks inconsistent legacy/indexed zero-eligible state pending governed correction. Commitment creation accepts only `actionUID`/`requiredCount` for DomainImpact; evidence jobs persist their explicit credited-contributor vector; each Work UID counts once; settlement creation binds the full recognition vector to its hash and derives payment weights from amounts. | Review closure 2026-07-28, tightened 2026-07-29. These constraints make the recognition and payout audit trail internally verifiable and keep caller-authored derived fields out of contract inputs. |

### Full decision register (2026-07-03 alignment session, entries 1–27; dated addenda 28–68)

**Cite entries in this list as "register #N"** — see the disambiguation note above. (The heading previously read "27 decisions", which stopped being true once the addenda were appended.)

1. Spec home: all artifacts in `.plans/active/commitment-pooling/`; no docs-site promotion.
2. Linear issue depth: workstream-sized issues, one per package workstream per track.
3. Community interface: NEW package `packages/community` (independent PWA at `community.greengoods.app`, local port 3010, three tabs, Passkey). It consumes extracted generic runtime/auth/offline/install/update/error/shell foundations while retaining its own routes, navigation, manifest, service-worker scope, telemetry identity, and copy.
4. Git ending: conventional commits on the session branch plus a PR to develop.
5. EAS bridge: WorkApprovalResolver hook (try/catch, non-blocking) plus operator `syncApprovedWork` fallback.
6. State weight: hybrid; hard transitions on-chain (seed, offer/request, accept, evidence count, ReadyForConfirmation, Fulfilled, cancel/expire, dispute flag, cycle open/close/compost, pool pause); Draft and review-soft states derived.
7. v3 authorship: baseline = evaluator or operator; delta/re-assessment = Evaluator Hat only; testimony = Community Hat only.
8. Protocol pool: the root garden's pool (tokenId 1), poolType PROTOCOL, cross-garden claim reach.
9. PWA placement: pool flows in the Garden tab; personal commitments + pending confirmations in the WalletDrawer pools tab; ~~Home gets at most a summary card~~ **superseded by Decision Log #28 and register #39: no active Home card; W6 only aliases W5 for compatibility.**
10. Admin placement: garden-pool flows in the Garden workspace; the protocol pool console lives under `/community`; Hub gains a confirmation queue. **Amended by Decision Log #28 and register #39: `/community/pools` shows Protocol plus the current garden only; all-garden oversight moved to deployer-gated Operations.** No top-level `/pools` workspace exists.
11. Seasons & Campaigns project: converted in place to "Green Goods Commitment Pooling" (supersedes the create-new-project instruction).
12. Legacy season issues: composted aggressively with pointer comments; RESR-13 to the July milestone; RESR-15/RESR-4/PRD-275 stay linked research; PRD-344/495/347 rehomed out.
13. Docs staleness: logged in corrections-log plus a Linear docs issue; no docs edits in the spec session.
14. Commitments are NOT EAS attestations; module-native records; EAS gains exactly two schemas (assessment v3, community testimony).
15. Voucher-shaped from day one: commitment units as non-transferable token-like accounting so transferable settlement vouchers attach 1:1 later.
16. Companion register contract: `CommitmentPoolingModule` (control plane) plus non-transferable ERC-1155-style `CommitmentRegister` (classes, balances, quotas), supersedes PRD-649's single-artifact stance.
17. Clean room: Grassroots Economics paper and public docs only; never the AGPL Sarafu source.
18. Rewards: declared reward reference includes `None | ArbitrumExternal | CeloSettlement`.
    External payout uses the operator-recorded `RewardPaid` event; Celo settlement uses only
    SettlementModule acknowledgment state. The module never custodies funds, the rails cannot
    both record one commitment, and CookieJar remains unchanged.
19. Claim mode per commitment: open-claim or approval-gated, set at seeding; protocol pool defaults approval-gated, garden campaigns default open-claim.
20. Meta evidence: lightweight evidence object (IPFS CID via module event, offline-queueable) for SupportService/StewardCaptured; direction-aware eligible-party confirmation is the review and Not yet raises a dispute; DomainImpact keeps the full MDR path.
21. Editorial: extend the GardenDialog with the pool story and add /impact aggregates; no new public routes.
22. August docs workstreams: glossary + architecture freshness plus operator and gardener guides; no Document B docs page; no spec promotion.
23. Linear tracking: August build workstreams now roll up to PRD-650 and the consolidated parent trackers; historical child issue IDs remain labels, not dispatch targets. PRD-649 closes when the contract spec merges; PRD-651 stays gated; July and September trackers sit flat with milestones.
24. Agent lanes pre-assigned at the execution-sub-lane level: Codex owns contracts, settlement, indexer, state-api, blocked credit follow-on, and final regression QA; Claude owns UI, editorial, docs, docs-guides, community, and first human-flow QA; July dry run stays human-owned.
25. July tracking: update the existing methodology survey (RESR-53, stays in Impact Framework) rather than duplicating; create scoping-survey and activations issues; lightweight tracking table in a project doc. — **Project-doc placement reversed 2026-07-20.** The doc sat empty for 16 days while its rows duplicated COM-7's readiness matrix; only the loop's column shape (requester → fulfiller → separate confirmer → reward rail) was unique to it. Folded into **COM-7 § Proto-commitment rehearsal** and the doc retired. The "don't duplicate" instinct in this entry was right — it just wasn't applied to the tracking table itself.
26. Schema registration timing: assessment v3 + testimony register as the FIRST PR chain of the August track so baselines exist before cycle 1 opens.
27. Hero moments: commitment Fulfilled and cycle close/compost, client PWA only.

**Addendum (2026-07-04 needs-layer alignment):**

28. Needs layer: EAS gains four additional schemas (Need, NeedSignal, NeedStatus, FundingAttribution), owned by the Community Needs & Signals project and specced in `.plans/active/community-interface/`. Amends the letter of #14's "exactly two schemas"; the spirit holds — commitments remain module-native, never EAS. The commitment record gains an additive `bytes32 needUID` (0 = none; see the contract-spec amendment note), specced before the August build so it ships in the initial deploy.
29. Credit follow-on: `CreditRegister` is tracked as `status.json.follow_on.credit_register`, depends on pooling + settlement interfaces, and must not be pulled into August implementation without a new scope lock.
30. Plan-hub compatibility: `status.json.lanes` is intentionally limited to canonical machine lanes. Use `record-tdd --lane contracts`, `--lane state-api`, or `--lane ui`; record sub-lane evidence in the named handoff before the machine lane turns GREEN.
31. Parent-only Linear sync: this active hub intentionally keeps one Linear parent mirror (`PRD-650`) and no per-machine-lane Linear issue mirrors. Do not add fake lane issue IDs; create lane issues only if Afo explicitly chooses to expand the Linear footprint. — **SUPERSEDED 2026-07-20 by register #37.** Afo made exactly the explicit choice this entry anticipated; lane issues now exist and are real, not fake.
32. Architecture closure (updated 2026-07-23): optional multi-domain Need/Commitment scope, complete creation events, direction-aware confirmation with provider exclusion, stored claim-request terms, pre-dispute restoration, one open Season plus concurrent Campaigns, provider/action-matched DomainImpact Work, reward-bound message-only CCIP settlement with authenticated command/acknowledgment, immutable 24-member batch cap, and exact pilot 2-of-3 Safe recovery are part of the initial implementation contract.
33. External alignment: the Google Doc is the single source of truth for external prose; `external-brief.md` is a pointer and engineering-source map only. Repo specs, evidence records, prototypes, and visual assets substantiate the narrative without mirroring it. GoodDollar settlement is on Celo, no G$ bridges to Arbitrum, and the designated Green Goods topology receives Foundation-funded House of Alignment pilot funds directly in the GG protocol Safe on Celo once partner mechanism/address evidence clears (funding correction confirmed 2026-07-21).
34. Product-review decisions (2026-07-11 storyboard review; storyboards + gap evidence in `prototypes.md`): (a) pool **open/close controls live on the admin Pool status card** (adopts MF-1; the open-cycle flow gains only a "pool is Ready — open it now?" guard prompt, closing the Ready→Open deadlock); (b) **members get a pre-acceptance withdraw** control on commitment detail (adopts MF-2a; the then-open steward-cancel placement is closed by register #51); (c) **`waiting_for_hat` covers the five pool job kinds in August** — pre-flight membership check before the first send attempt, no retries consumed, membership event resumes the jobs (adopts MF-5); (d) **expiry runs both paths, sequenced**: admin expiry queue + member "offer again" band ship in the August release (adopts MF-3/MF-4); a permissionless keeper cron is a post-release ops backstop, not part of the July build; (e) **pilot operators are the stewards and hold the settlement executor role** — never a Safe owner and never one of the 2-of-3 recovery owners (settlement-spec no-overlap check); W22 needs only a missing-role guard state, not a role-split UI; (f) **W21 + the `/community` Pools view gain a read-only member-delivery gate status row** (enabled/disabled · changed by · date · evidence ref); the owner-only flip stays ops; (g) **testimony is September-realized** (resolves MF-12; no August client frame; external copy must not imply August testimony); (h) the **dry run rehearses S13 with a real minimal Cookie Jar withdrawal**, payoutRef captured via `recordRewardPaid` (jar config + Gardener-Hat prerequisites per corrections-log H7).
35. Garden join-request queue (direction locked; canonical design: `../community-interface/join-queue-spec.md`): the **Community Needs & Signals** hub owns the small agent-backed request service, its personal-data rules, and RESR-64 operating gate. Commitment Pooling is only a consumer: a closed-garden request is signed by the passkey account and, after an operator uses the existing gardener-add path, observed membership is the `waiting_for_hat` flush event for the five pool job kinds. The API remains conveyance only; if unavailable, operators add addresses manually. No protocol admin key ever, and `openJoining` self-join remains unchanged.
36. Hi-fi prototype artifact (2026-07-18, Afo): the flow-prototypes artifact upgrades **in place** from lo-fi ASCII frames to high-fidelity Warm Earth screen renders with per-screen state matrices (Storybook-style state switcher) — full August scope (client PWA + admin + editorial), complete state coverage per uiux-spec §4–§7; September C-frames stay labeled lo-fi previews (they belong to the community-interface plan). Supersedes **Decision Log #13**'s lo-fi-on-purpose policy **for this artifact only** (not register #13, which is about docs staleness) — `wireframes.md` itself stays lo-fi and remains the structural truth; the artifact still adds no design authority beyond the specs and design-skill tokens it renders. Executes audit follow-up 5 (hi-fi pass over the revised pool surfaces). Build machinery decomposed into `hifi/` modules with state-aware validation: journey refs, hotspot-id integrity, per-state render checks, and banned-vocabulary / steward-rule / quiet-admin / chain-placement scans over rendered copy (hard-fail on hi-fi renders, warn-only on remaining ascii). Same entrypoint, same artifact URL, same citation discipline.
37. Thin lane mirror + four-phase milestones (2026-07-20, Afo): **supersedes register #31; dispatch state amended by register #39 and phase dates superseded by register #40.** Linear's issue cap was lifted, so the footprint constraint behind parent-only no longer applies. Each execution sub-lane now has a **thin** Linear issue: ~3 lines plus a handoff link. **Linear owns status, dates, assignee and dependencies; this hub owns content.** Lane bodies must not restate handoff scope — that is the drift failure parent-only was protecting against, and it stays banned. New lane issues (children of `PRD-650` unless noted): `contracts` PRD-721 · `indexer` PRD-722 · `state_api` PRD-723 · `ui_client` PRD-724 · `ui_admin` PRD-725 · `editorial` PRD-726 · `docs` PRD-727 · `docs_guides` PRD-728 · `qa_pass_1` PRD-729 · `qa_pass_2` PRD-730 · `release_ops` PRD-731 (no parent; Release milestone). This also reverses the "no QA child issue is created" rule in `claude-qa-pass-1.md` and `codex-qa-pass-2.md`. `settlement` keeps PRD-686, retitled to *settlement implementation* now that `release_ops` is separately tracked. Gap issues filed the same day: PRD-732 (cycle 1 opens — Track B step 8, previously untracked in any of issue/lane/handoff), PRD-733 (recovery multisig Celo address + HoA receiving evidence — release-blocking, audit follow-up #4), PRD-734 (G$-for-protocol-services with GoodDollar — audit follow-up #6). Historical date model recorded here was **Scope and Design** (2026-07-31) → **Build** (2026-08-12) → **Release** (undated) → **Follow On / Hardening** (2026-12-31); register #40 replaces it with the current dates, while register #39 keeps the July dry run separate rather than absorbed. **Dispatch-safety convention** (adopted from PRD-686's "Backlog coordination only. Remove all `agent:*` labels/delegation"): a lane issue carries an `agent:*` label **only while its lane is `ready`**. Register #39's Wave 1 freeze blocks Docs until source convergence; only independently re-audited lanes may regain a label.
38. Tiered broadcast (2026-07-20, Afo): **the audit / 48-hour-timelock / two-week-testnet gate applies to the value tier only.** `SettlementModule` and the per-garden Celo Safes keep it in full. The **pooling module, `CommitmentRegister` and the two EAS schemas broadcast to Arbitrum mainnet during Build**, under a narrower gate: full test suite, deploy dry-run, post-deploy verification, and a proven upgrade/rollback path. Basis: `human-release-ops.md` Phase 2 already separates "module/register deployment and upgrades" from "settlement deployment only when its gates pass", and the module **never holds funds** while the register is **non-transferable** — so the value-protecting gates protect nothing at this tier. Scope of the exception, stated narrowly: it changes *which artifacts* skip those three inputs. It does **not** relax Phase 3 post-broadcast checks, does not waive the Bun test/dry-run evidence, and grants **no agent broadcast authority** — Afo authorizes, as before. **If the pooling module ever gains custody or the register becomes transferable, this exception lapses** and those artifacts rejoin the value tier. Applied to the Release milestone and `human-release-ops.md` § Inputs the same day. Residual risk accepted knowingly: these are unaudited UUPS-upgradeable contracts on mainnet, so upgrade authority and access control carry the weight the audit would otherwise have carried.
39. Audit reconciliation scope lock (2026-07-20, Afo): execute CP-AUD-001–021 in two waves without product implementation or broadcast. Allocation is supplied only to `openCycle(cycleId, AllocationBps allocation)`; `seedCycle` has none. Baseline stays an app/shared/admin preflight, while the onchain Ready predicate remains charter plus a non-zero provider open-commitment cap. DomainImpact uses positional per-action arrays, `requirementIndex`, per-action progress, and the weighted per-commitment approved-unit formula. `/community/pools` is Protocol plus current garden; all-garden oversight and settlement operations stay deployer-gated Operations (the former batch/oracle label is superseded by register #46/#48's CCIP command/ack model). W6 is retired except for W6→W5 compatibility. Native phases are Scope and Design / Build / Release / Follow On-Hardening; July and September remain separately labeled operational checkpoints. Execution sub-lanes become first-class Linear mirrors, QA stays on canonical QA lanes, `release_ops` is parentless, and `agent:*` labels exist only for ready agent-owned lanes. A new human-owned blocked `settlement_evidence` lane is due September 30 under PRD-650 and receives no agent label until sources, privacy, thresholds, and package are locked. Public closure requires per-action Built/Planned roles, four phases plus checkpoints, September-only testimony, all six GE functions, 2× visual pairs, live Linear and Google Doc rereads, primary-source verification, and confidential human confirmation that the undisclosed fourth-garden candidate name is absent. Unavailable external access is a blocker, never convergence proof. This entry preserves register #38's narrow Build-tier broadcast exception and adds no implementation or broadcast authority.
40. Phase-date correction (2026-07-20, Afo): **supersedes only the phase dates in register #37 and the date-neutral wording in register #39.** Scope and Design closes with this reconciliation on **2026-07-20**; Build closes **2026-07-31** after the two-week implementation window; Release is **2026-08-12**; Follow On / Hardening remains **2026-12-31**. The July dry run (**2026-07-31**) and Community plus settlement-evidence delivery (**2026-09-30**) remain separately labeled operational checkpoints. The August 12 release target grants no agent or automatic broadcast authority, does not weaken register #38's tier-specific gates, and does not turn a blocked value-tier artifact into an authorized release.
41. Build-to-Release broadcast correction (2026-07-20, Afo): **supersedes register #38 only on calendar-phase timing and supersedes the Build-broadcast preservation clauses in registers #39-40.** Build closes **2026-07-31** with implementation, QA, full tests, dry-runs, post-deploy verification readiness, and upgrade/rollback proof; **nothing broadcasts during Build**. The pooling module, `CommitmentRegister`, and two EAS schemas retain register #38's narrower non-value-tier evidence gate because they are non-custodial/non-transferable, but any mainnet broadcast is a separately authorized **Release** action on or after **2026-08-12**. `SettlementModule` and per-garden Celo Safes retain the full value-tier gate. This timing correction grants no agent authority and leaves both tiers blocked until their own human authorization exists.
42. Broadcast tiering restored (2026-07-20, Afo): **supersedes register #41's “nothing broadcasts during Build” clause and restores register #38's July timing.** The non-value tier — `CommitmentPoolingModule`, non-transferable `CommitmentRegister`, and the two EAS schemas — broadcasts during Build by **2026-07-31** under its narrower gate: full tests, deploy dry-run, post-deploy verification, proven upgrade/rollback, and explicit human authorization. The value tier — `SettlementModule`, `CeloSettlementExecutor`, and per-garden Celo Safes — remains a separately authorized Release action on or after **2026-08-12** under the full audit, timelock, CCIP live-route and dual-chain evidence gate, Safe/Zodiac/AA review, rollback, and live-exit gate. No agent self-authorizes any broadcast; the non-value exception lapses if custody or transferability is introduced.
43. Scope and Design date correction (2026-07-20, Afo): **supersedes register #40 only for the Scope and Design date.** Scope and Design closes Wednesday, **2026-07-22**. Build remains **2026-07-31**, Release remains **2026-08-12**, Follow On / Hardening remains **2026-12-31**, and the July 31 and September 30 operational checkpoints remain separate from the four native phases.
44. Follow On / Hardening date correction (2026-07-21, Afo): **supersedes registers #40 and #43 only for the Follow On / Hardening date.** Follow On / Hardening closes **2026-09-30**, alongside but distinct from the Community plus settlement-evidence operational checkpoint. Scope and Design remains **2026-07-22**, Build remains **2026-07-31**, Release remains **2026-08-12**, and the July 31 dry run remains an operational checkpoint. Co-dated September closures are parallel evidence decisions, not a false sequential dependency and not implementation or broadcast authority.
45. Count-safe accounting and Architecture closure (2026-07-22, Afo): cross-commitment arithmetic uses counts; `promiseKeptRate = commitmentsFulfilled / commitmentsDue` is the sole cross-commitment percentage. Raw units remain per commitment and in `CommitmentUnitSummary` rows keyed by exact UTF-8 label bytes (`hours` and `Hours` differ). The register limit is a concurrent provider commitment-count cap, with one slot acquired at acceptance and released exactly once on fulfillment, accepted cancellation, or accepted expiry; disputes preserve slot state. NET-NEW interfaces are renamed directly with no compatibility aliases or migration. Architecture is self-contained with D7c Hypercert cut-over, D13b exact sensitive permissions, and D14 offline jobs; existing diagrams keep their numbers. Product code, SVGs, wireframes, publication, and Linear writes are outside this correction pass.
46. CCIP settlement re-freeze (2026-07-23, Afo): **supersedes the Functions/CRE receipt-verification architecture in register #32, Decision Log #14/#22, and every current lane handoff.** G$ remains canonical on Celo and never enters CCIP token transfer. Arbitrum sends the exact versioned command tuple; a bounded Celo `CeloSettlementExecutor` executes through Zodiac Roles as a member, never a Safe owner; Celo returns the exact versioned acknowledgment tuple. Same-key command retries cannot execute value twice, acknowledgment retry is independent, native ETH/CELO fee reserves are sponsored and monitored, and only an authenticated success acknowledgment for the subject's current key/attempt produces `Confirmed`. Envio indexes bounded executor events but not raw G$ transfers. **Register #53 supersedes this entry's former “no active Celo CCIP testnet” premise:** Celo Sepolia is active and the direct mainnet route is published in both directions, but the exact Arbitrum Sepolia↔Celo Sepolia pair is unavailable and Celo's current official support page lists CCIP only for mainnet; live Celo Sepolia CCIP endpoint proof is therefore conditional on a later official lane/router. This re-freeze defines future implementation and dry-run scope; it does not authorize code changes in the plan-only pass. A fresh lane dispatch is required before implementation. Safe authority, external audit, mainnet broadcasts, and value canaries remain human Release gates.
47. Pilot evidence boundary (2026-07-23, Afo; structural gate superseded by register #49): `pilot-evidence-spec.md` is the normative source for September evaluation questions, claim strength, baseline and metric-registry requirements, coercion/exposure/repair safeguards, circulation integrity, falsification, privacy tiers, and the evidence packet. It does not expand the settlement or Envio implementation boundary, set numeric thresholds, choose source systems, authorize participant-level tracking, or support causal livelihood/community-wide claims. The human-owned `settlement_evidence` lane and COM-11 (formerly PRD-735) remain blocked; register #49 narrows the remaining gate to the named operational assignments and garden-specific values required before outcome interpretation.
48. CCIP review reconciliation (2026-07-23, Afo): each settlement implementation accepts one immutable Chainlink CCIP router. Active/previous grace applies only to authenticated peers; router replacement requires pause, disposition of every old-router in-flight message, verified implementation upgrade, and explicit resume. Batch membership remains immutable with compile-time ceiling 24, but batching starts disabled and the production limit is set only after worst-case destination gas plus atomic Safe execution measurement. Authenticated, well-formed policy failures use the frozen bounded `FailureCode`; authentication, token-bearing, unsupported-version, and malformed messages revert without creating a result. Current route values are release evidence, never timeless constants: the verifier live-reads the official directory, rejects zero/mismatch, and persists source/date/block/code hash before dry-run or broadcast. Current prototypes must keep Queued, Dispatched, delayed, executed/ack-pending, Confirmed, and authenticated Failed distinct, and must present command/destination/ack IDs, Explorer links, and manual-execution guidance without inventing a manual delay mutation.
49. Pilot evidence structural decisions (2026-07-23, Afo): the September evaluation primarily decides continue/refine/pause/stop per existing garden, with trusted-partner validation secondary and no expansion decision. Each garden is its own cohort; reliable pre-pilot evidence is preferred and otherwise the first complete cycle becomes baseline. Claims use designated authoritative sources with unavailable-not-substituted missing data, one primary garden measure plus a small secondary set, a predeclared meaningful-change threshold, and an overriding safeguard key with no composite score. Qualitative evidence is optional, light-touch, independent, cross-role, and locally adapted. Ordinary repair may stay local, while coercion, retaliation, steward involvement, privacy, repeated burden, serious exposure, and appeals use a confidential independent path. Publication uses restricted safeguarding, trusted partner/research, and public tiers. The first cycle is a reproducible human-reviewed operational process, not a productized pipeline; Celo evidence gaps do not authorize estimates, Envio expansion, or participant tracking. Evidence preparation, garden-context review, safeguarding/privacy clearance, and publication decisions remain separate. COM-11 (formerly PRD-735) stays blocked only on named owners, exact source access, garden worksheets, numeric thresholds, collection/storage/retention details, response paths, reproducibility artifacts, and publication assignments.
50. CCIP implementation-contract closure (2026-07-23 review fix; **payer/recipient sentence superseded by registers #66–#67 on 2026-07-28**): the Arbitrum and Celo consumer interfaces, storage, events, indexed configuration facts, and UUPS/immutable-router rules are exact. Protocol garden and canonical G$ are write-once; Celo router upgrades preserve immutable G$; the Arbitrum source selector is immutable; all deployment selectors migrate to exact decimal strings; peer grace is same-selector/same-version only and unresolved retiring-peer commands keep the value lane paused; one optional dispatcher has dispatch/retry authority only; native ETH/CELO floors and low-balance state are observable. Execution keys domain-separate batch/disbursement IDs, commands snapshot their destination peer/version/gas/payload, acknowledgments bind to a known command message for that key, and Celo retries preserve the originating acknowledgment receiver/version. Batching can return to zero; Queued batches cancel only atomically in full; Failed members requeue unbatched or terminally cancel with origin preserved; direct Zodiac calls target canonical G$ with an exact `bytes32` role key and no self-call authority. The then-current payer assumption was that reward G$ came from the owning pool Safe and the provider Garden Safe was only a Garden-claim recipient; registers #66–#67 replace that clause with a separate ProtocolToGarden funding route plus provider-garden-funded contributor payout plans. Historical state outranks the delivery-availability gate. UI/visual propagation uses G$ metadata, immutable route snapshots, origin-specific cancellation copy, registration of already-deployed Release-gated Safes, exact retry names, and evidence-pending HoA topology. This remains a plan/docs/visual update only and grants no implementation, broadcast, Safe, value, or Linear mutation authority.
51. Final August placement closure (2026-07-23, Afo): the four remaining product placements are locked exactly where reviewed. MF-2b is the reason-required steward-cancel action in the W10 Accepted/evidence-in action row; MF-7 is the read-only commitment-context row in the existing Work Review step; MF-8 is the pre-claim personal/garden provider-context sheet opened from the protocol-pool card; MF-13 is the assessment picker on W10 commitment detail. The W10 Accepted/override states, W23 delivery-blocked state, W26 reconciliation report, and both origin-specific settlement-cancellation messages are realized, non-proposed states. No August screen/action remains amber-tagged or placement-blocked. This locks documentation, handoff, prototype, journey, and visual presentation only; product implementation still requires the separately dispatched UI lanes and their RED/GREEN/browser gates.
52. Final CCIP review closure (2026-07-23, approved-brief reconciliation): `packages/agent` has no settlement relayer, retry, acknowledgment, configuration, Safe, or value-write role; optional later alerts may read indexed health only. Sponsored source reserves and exact caller-funded Celo acknowledgment retries remove any caller-overpayment/push-refund path while preserving guarded excess withdrawal. The static settlement-state asset now shows both permitted cancellation origins—before dispatch and after authenticated failure—and says delay never unlocks cancellation. These are clarifications of the approved CCIP brief, not implementation or new authority.
53. Specification-first readiness corrections (2026-07-24, Afo scope lock): CCIP remains the
    sole settlement transport interface. The official Chainlink directory publishes the
    direct Arbitrum One↔Celo Mainnet route in both directions at v1.5.0; every dry-run and
    release must re-verify its routers, selectors, peers, code hashes, fees, and status. The
    exact Arbitrum Sepolia↔Celo Sepolia pair is not listed, so testnet proof combines
    Arbitrum endpoint-specific CCIP messages, dual-process local routers, and separate forks without
    claiming a faithful live cross-testnet lifecycle. Register #54 fixes the endpoint proof as
    an isolated Arbitrum Sepolia↔Ethereum Sepolia deployment; a two-hop relay remains
    unauthorized. Celo Sepolia (`11142220`) replaces Alfajores and is required for
    Safe/Zodiac/G$-surrogate rehearsal. The released Safe v1.4.1 registry covers both Sepolia
    chain IDs. Register #54 records the official Arbitrum Sepolia EAS/SchemaRegistry addresses;
    only Hats remains a version-pinned test deployment with chain-local code-hash proof, never a
    copied Ethereum Sepolia address. Celo's current official support page lists
    CCIP only for mainnet, so live Celo Sepolia CCIP endpoint proof is conditional on a later
    official lane/router publication. `AssessmentV3` is a schema
    name resolved through an in-place upgrade of the existing AssessmentResolver, not a new
    resolver/proxy. GoodDollar amounts are exact-net promises; receiver-pays fees fail closed,
    sender-paid fees count against gross-debit caps, and balance deltas prove receipt. Safe
    deployment uses an exact Safe v1.4.1 factory/singleton/initializer/salt recipe. One Zodiac
    Roles Modifier uses its native `WithinAllowance(allowanceKey)`; no separate Allowance
    Module exists. `UnitsCommitted`/`UnitsReleased`/`UnitsFulfilled` alone mutate indexed
    provider exposure. Exact-label hashing is
    `viem.keccak256(viem.stringToBytes(unitLabel))` without normalization. Implementation,
    Linear sync, broadcasts, and authority changes remain outside this documentation pass.
54. Independent readiness-audit closure (2026-07-24/25, Afo authorization): GardenToken appends
    after `openMinting` at slot 213 offset 2 and keeps its 37-slot gap; missing/different storage
    baselines fail closed behind one Bun wrapper, and compiler slot/offset output—not arithmetic—
    is the proof. The live Arbitrum Assessment v2 UID is zero and must be pinned from the verified
    artifact before v3 activation; the `421614` rehearsal deploys/pins current v2 before upgrading.
    Register unit events are self-describing with pool, cycle, and exact label; cycle zero creates
    no cycle summary. Official `421614` EAS/SchemaRegistry addresses replace test EAS, while Hats
    remains test-deployed. Immutable permission hashes exclude mutable caps/allowance balances.
    D7b uses the canonical settlement entities. Envio v2.32.12 uses unordered multichain mode,
    first-event metadata seeding, and Celo Sepolia RPC config. Endpoint proof is an ephemeral
    Arbitrum Sepolia↔Ethereum Sepolia deployment; Celo Sepolia independently proves
    executor/Safe/Roles/surrogate behavior. EntryPoint v0.7 is the AA target. Celo deployment uses
    an executor-only target, never the historical full-core `deploy:celo --update-schemas`.
    Local specification corrections are complete only after validation; live Linear and source-
    document convergence remains a separate blocked, human-authorized step.
55. Final documentation-review closure (2026-07-24, Afo authorization): the register-global
    `ModuleUpdated` event now has a complete, pool-less read model with explicit normalized
    old/new module fields and no accounting mutation. The indexer handoff covers pooling and
    `SettlementModule` on both Arbitrum production/rehearsal networks, and
    `CeloSettlementExecutor` on both Celo production/rehearsal networks with explicit
    `11142220` RPC configuration. D7b draws all seven canonical settlement entities, and
    `SettlementConfiguration.localContract` makes the verified-artifact seed schema-complete;
    remote identity means the exact CCIP selector. D9's sequence syntax is parser-safe.
    Documentation-only validation closes this correction; implementation, Linear/source
    convergence, dependency installation, codegen, deploy, broadcast, and authority changes
    remain separately gated.
56. Post-review specification closure (2026-07-24, Afo authorization; schema-deployment wording
    superseded by register #57): Commitment creation now
    rejects empty exact labels and zero targets; the register's mapped class value carries a
    `Registered -> Committed -> Released|Fulfilled` accounting state, and only full non-zero
    quota/live-balance mutations can change a provider count. This consumes no new top-level
    storage slot and removes the unsupported partial-fulfillment-readiness claim.
    `SettlementConfiguration` and its verified generated seed now carry `remoteEvmChainId`, so
    Celo routes, executions, Garden/account joins, and message directions never infer an EVM
    chain ID from a CCIP selector or local event context. AssessmentV3 is registered exactly
    once against the upgraded existing Assessment proxy and that returned UID is set. The
    prototype's theme control is outside the tablist, all declared tabs support
    ArrowLeft/ArrowRight/Home/End activation, and user navigation uses `pushState` with
    deduplicated `popstate`/`hashchange` replay. Documentation/prototype validation closes
    this correction; product code, Linear/source convergence, dependency installation, codegen,
    deploy, broadcast, and authority changes remain separately gated.
57. Contracts/planning review closure (2026-07-24, Afo authorization; AA and deployment-recovery
    wording superseded by register #58): the existing
    AssessmentResolver upgrades only through `upgrade.ts assessment-resolver`; the standalone
    schema target verifies the upgraded proxy and reconciles deterministic EAS UIDs without
    owning an upgrade. AssessmentV3 and Community Testimony registration recover cleanly from an
    on-chain-success/local-artifact-failure split by reusing only an exact existing record.
    `OpenCommitmentCapRequired(poolId)` is the exact module/register zero-cap error, with no event
    or storage mutation. D9 uses `ResultStatus.Success`, and provider-slot mutations are
    single-shot/state-guarded rather than idempotent. Its historical AA conclusion is superseded by
    register #58's chain-versus-account-version distinction and two-tier evidence gate.
    Concurrent prototype artifact counts and ARIA tab behavior are outside this contracts/plan
    correction. Product code, Linear/source convergence, dependency installation, codegen,
    deploy, broadcast, and authority changes remain separately gated.
58. Final contracts/readiness closure (2026-07-25, Afo authorization): Pimlico supports the
    production Kernel `0.3.1` account implementation on Arbitrum One and Celo Mainnet, but not on
    Celo Sepolia. Testnet mechanics therefore use one explicit Kernel `0.2.4` profile across
    Arbitrum Sepolia/Celo Sepolia and remain non-enabling; production keeps Kernel `0.3.1` and
    requires exact Arbitrum One/Celo Mainnet derivation/code/policy/passkey evidence plus a
    separately authorized included Celo Mainnet canonical-G$ first-use operation before
    `memberDeliveryEnabled`. The shared lane owns typed account profiles and both missing Sepolia
    Pimlico endpoints. Community Testimony has an explicit artifact-sourced
    `--finalize-community-testimony` phase with no module override. Resolver implementation/proxy
    CREATE2 prediction and exact onchain reconciliation recover deployment-success/local-artifact
    failure. Its NET-NEW resolver has no zero-UID wildcard: preparation one-way pins the
    deterministic UID while the module is zero; finalization reconciles the exact EAS record and
    activates the verified artifact-sourced module last. UID zero/conflict and module-before-UID
    reject, exact UID repeats are no-ops, and module-before-record recovery state fails closed.
    Assessment transaction plans require a live verified proxy owner on each chain and the complete
    upgrade/verification/schema-preparation/module-deploy/finalization sequence is chain-connected.
    The production contract verifier invokes Solhint through Bun so a clean PATH cannot bypass the
    gate. Product implementation, Linear/source convergence, dependency installation, codegen,
    deploy, broadcast, and authority changes remain separately gated.
59. Final recursive review closure (2026-07-25, Afo authorization): operational
    `CommitmentPoolingModule` schema checks have no zero bypass. The module initializes paused;
    six dependency setters and four non-zero, pairwise-distinct schema UIDs are pause-only,
    event-audited trust roots, and complete configuration is revalidated before unpause.
    `CommitmentRegister` permits one initial zero-to-module wiring and requires the current module
    paused for any later replacement. Named confirmer input is capped at 32 before any
    commitment/class mutation, bounding duplicate and provider-filter passes. Settlement source
    and executor proxies also initialize paused; source dependency changes emit old/new facts and
    both unpause paths fail closed on incomplete routing/policy configuration. The indexer consumes
    these configuration events without pool-zero or sender inference. Community Testimony
    preparation wording now permits only an empty or already-exact permissionless record while
    remaining inactive. Active lane references use PRD-721–728; PRD-671–681 remain historical
    labels only. Prototype history replay, direct listener argument semantics, tab-key history,
    visible-flow/admin counts, and drift assertions are corrected. Register bounds and archived
    supersession banners now point through this entry. Local validation and the final recursive
    review passed on 2026-07-25: Plan Hub validated all 39 feature hubs, the artifact built with
    zero warnings, all 20 Mermaid blocks parsed, the contract verifier passed 1,533 tests, and
    format, lint, JSON, player syntax, and diff checks passed. The local specification is ready;
    live Linear/source-document convergence remains a separate human-authorized write step before
    implementation dispatch.
60. Final interface, source-validation, and indexer-toolchain closure (2026-07-25, Afo
    authorization): the canonical `ICommitmentPoolingModule` exposes the `paused()` selector that
    `CommitmentRegister.setModule` calls for every post-wiring replacement, and the contracts
    handoff requires interface/implementation ABI proof. Both canonical Envio YAML blocks are
    parser-valid; Plan Hub now parses every fenced YAML block under `.plans` and rejects malformed
    source with an exact file and line. Generated Envio/ReScript setup uses the exact
    package-local Corepack pin `pnpm@10.33.2`, including the Docker image, while the monorepo root
    remains `bun@1.3.14`. This correction changes no contract/indexer product implementation,
    dependency version, generated artifact, or lockfile. No dependency installation, codegen,
    deploy, broadcast, authority mutation, Linear/source-document write, staging, commit, or push
    is authorized or performed by this entry.
61. Source-convergence decisions (2026-07-26, Afo authorization): the former unshipped
    captured-promise enum name is replaced everywhere in active planning, prototypes, and
    ontology with `StewardCaptured`, without a compatibility alias; human-facing prose uses
    “steward-recorded promise.” Corrected and merged PR #649 (`envio@3.2.1`) is a hard prerequisite
    for PRD-722. That correction removes package-local Envio skill copies and the unrelated shared
    passkey test, retains only migration-required indexer changes, and keeps root commands and the
    test plan Bun-first while allowing the generated workspace's pinned pnpm where Envio requires
    it. Historical v2 audit entries remain dated evidence rather than current implementation
    instructions.
62. Repeatable-requirement amendment (2026-07-28, Afo authorization): `Domain` is a reusable
    classification, not a cardinality limit. DomainImpact commitments carry repeatable
    `{ actionUID, requiredCount }` rows, may repeat domains, and derive their domain tags from
    ActionRegistry. The product begins with four visible rows and an Add requirement control.
    `MAX_REQUIREMENTS` is a named technical bound, provisionally 16; implementation benchmarks
    8/16/24/32 under worst-case create, approval-credit, readiness, and event/indexer payloads
    before the constant is frozen. This supersedes the unique-domain/max-four portions of
    Decision Log #21, register #32, register #39, and the 2026-07-09/18 amendments without
    changing the closed four-value action-domain vocabulary.
63. Group-commitment amendment (2026-07-28, Afo authorization): every accepted commitment has one
    accountable `leadProvider` and a bounded, event-indexed contributor roster. Solo is the
    one-member case. Contributor policy is immutable Open or LeadManaged; contributors may join
    or be added/removed before freeze, may be assigned to requirements, and must be active to
    link Work or receive evidence attribution. The roster freezes atomically on the transition
    to ReadyForConfirmation. Every frozen contributor is excluded from the confirmation set and
    fallback path; any roster change that makes the threshold unreachable fails before mutation.
    Only the lead provider consumes the register's concurrent commitment-count slot.
64. Recognition amendment (2026-07-28, Afo authorization): the cycle-open allocation policy now
    includes the gardener within-class rule. The gardeners class divides equally across fulfilled
    commitments by default because raw units across commitments are not comparable. Within a
    commitment, 20% is shared equally among eligible contributors and 80% follows verified
    contribution weights from approved linked Work plus evidence attribution on the Fulfilled commitment.
    Deterministic rounding follows highest weight then ascending address. The policy is frozen at
    cycle open, while cycle-less commitments use the immutable protocol 20/80 default. There is no
    automatic lead or metadata-only fallback: Ready and direct Fulfilled dispute resolution require
    non-zero pre-freeze verified credit, and W26 blocks any inconsistent legacy/indexed state.
65. Payout-plan amendment (2026-07-28, Afo authorization): a fulfilled CeloSettlement commitment
    receives a garden-managed payout plan. Its initial contributor weights copy the final
    Hypercert recognition weights. Plan creation asks CommitmentPooling to recompute the complete
    sorted recognition vector and hash from frozen on-chain credits and cycle policy. A
    provider-garden steward may atomically edit the complete amount vector before
    finalization; payment weights derive from amounts. The canonical full-reward integer
    base-unit allocation is rounding-equivalent to recognition and needs no reason; every
    noncanonical amount or retention divergence requires a visible reason. The plan carries an
    explicit `gardenRetainedAmount`; declared reward must
    equal retained plus all contributor payouts. Retention creates no self-transfer. Recipients
    are frozen eligible contributors whose Celo accounts are derived by the shared account
    profile.
66. Settlement reuse amendment (2026-07-28, Afo authorization): the provider garden Safe is the
    payer for contributor rewards, while ProtocolToGarden remains an independent top-up rail.
    Each non-zero payout becomes one ordinary bounded child disbursement; the payout plan's
    Pending/Partial/Complete/Failed view derives from finalization plus retention/conservation and
    child states and is never acknowledged as a separate cross-chain subject. Explicit
    finalization freezes the plan before dispatch; a finalized zero-child all-retained plan is
    Complete immediately without queue or CCIP. Child and batch cancellation never clear
    the stable one-plan-per-commitment pointer. Large teams split across measured batches;
    authenticated failures requeue per contributor. Envio indexes only protocol/executor events,
    not raw G$ transfers.
67. Alignment-pass boundary (2026-07-28, Afo authorization): amend the complete in-repo planning
    surface, hi-fi and lo-fi artifacts, ontology/docs, and thin tracker/source mirrors. Keep every
    runtime lane blocked and perform no contract, indexer, shared, client, admin, deployment,
    broadcast, Safe, authority, or value mutation. Subsequent dispatch follows the existing
    dependency and RED/GREEN gates against the amended source of truth.
68. Review-closure amendment (2026-07-28, Afo authorization to address the full review):
    commitment creation separates caller-authored requirement inputs from module-derived stored
    fields; evidence attribution gains a bounded commitment index; zero-eligible recognition
    blocks instead of falling back to the lead; payout plans verify the complete recognition
    vector/hash, derive payment weights from atomic amount vectors, explicitly finalize before
    dispatch, complete all-retained plans without CCIP, and preserve the parent pointer through
    every child/batch cancellation. The roster freeze remains atomic with every transition to
    ReadyForConfirmation and with a direct `Disputed -> Fulfilled` resolution. Repo truth is
    corrected before Google Doc and Linear mirrors.

**Final recursive certification clarification (2026-07-25; no new decision-register entry):**
the published `42161`↔`42220` production lane is the only required fully paired
`SettlementConfiguration`. Arbitrum Sepolia `421614` and Celo Sepolia `11142220` remain
independent, paused component rehearsals: their contract blocks and local configuration facts are
preserved, but `remoteEvmChainId` remains null, `peerConfigured` remains false, and handlers emit
no cross-chain relationship without a freshly published exact CCIP lane/router. The ephemeral
Arbitrum Sepolia↔Ethereum Sepolia endpoint proof remains runtime-only. This corrects the
pair-required wording in historical register entries 55–56 without rewriting their dated record
and creates no new product or architecture decision.

## Research / Plan Gate

- [x] Research evidence recorded: `reports/corrections-log.md` (every Document A repo claim verified, corrected, or superseded, with file paths)
- [x] Existing repo patterns identified: CookieJar.sol module template, badge-schemas standalone registration, greenWill/hypercerts handler patterns, SubmitWork analog capture, WalletDrawer pools tab
- [x] Human judgment points surfaced and decided: 27 alignment decisions (2026-07-03), approved Linear change set (2026-07-04), all 22 readiness findings scope-locked (2026-07-10), and the final four August UI placements locked by register #51 (2026-07-23)
- [x] Out of scope defined: no bridged G$, bridge custody/unbounded value authority, Sarafu integration, transferable settlement vouchers, indexed Celo/G$ transfers, garden-to-garden federation, leaderboards, or public credit scores; no commitment EAS schema; no claim flow in the community interface v1
- [x] Lightest honest validation chosen per lane (see Validation)
- [x] Design coverage audit completed 2026-07-10 (23 assets / 20 Mermaid blocks at that date); superseded by the 2026-07-25 architecture coherency pass — the inventory is now 29 assets rendering 32 Architecture Mermaid blocks, tracked in `diagrams.md` and `wireframes.md`, and every block must parse before implementation handoff.
- [x] Settlement scoping landed 2026-07-04: `settlement-spec.md` (SettlementModule, Safe topology, member receipt, multi-chain tiers, failure states) + diagrams D8–D10 + [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686)
- [x] Settlement transport re-frozen and corrected through 2026-07-24: commitment-bound
  message-only CCIP command; exact command/ack tuples and fee-aware failure codes; idempotent
  same-key command retries; independent acknowledgment retry; one immutable router per
  implementation with bounded peer grace and a drained upgrade cutover; bounded non-owner Celo
  executor; immutable batches with hard ceiling 24 and a measured configured limit; exact
  deterministic 2-of-3 Safe recipe; one Roles modifier with native allowance; exact-net G$
  semantics; published mainnet-route verification plus the exact testnet-pair limitation; and
  member delivery blocked unless AA proof passes.

## Requirements Coverage

The **Lane** column below names execution sub-lanes for planning clarity. The harness-facing machine lanes in `status.json` are only `contracts`, `state_api`, `ui`, `qa_pass_1`, and `qa_pass_2`.

| Requirement | Lane | Linear issue | Status |
|---|---|---|---|
| Assessment v3 schema via existing AssessmentResolver upgrade + NET-NEW community testimony resolver (first PR chain) | `contracts` | [PRD-721](https://linear.app/greenpill-dev-guild/issue/PRD-721) (historical PRD-671) | ⏳ |
| CommitmentPoolingModule + CommitmentRegister + GardenToken wiring + deploy | `contracts` | [PRD-721](https://linear.app/greenpill-dev-guild/issue/PRD-721) (historical PRD-672) | ⏳ |
| Indexer entities, handlers, four locked stats, bundleKind | `indexer` | [PRD-722](https://linear.app/greenpill-dev-guild/issue/PRD-722) (historical PRD-673) | ⏳ |
| Shared substrate: types, hooks, queryKeys.pools, five offline queue kinds, typed Kernel `0.2.4` testnet/`0.3.1` production account profiles and Sepolia Pimlico endpoints, AA-gated online wallet transfer, lightweight evidence, v3 workflow, settlement selectors | `state_api` | [PRD-723](https://linear.app/greenpill-dev-guild/issue/PRD-723) (historical PRD-674/679 shared half) | ⏳ |
| Client PWA: Garden tab pool flows, WalletDrawer panel, hero moments | `ui_client` | [PRD-724](https://linear.app/greenpill-dev-guild/issue/PRD-724) (historical PRD-675) | ⏳ |
| Admin: Garden workspace pool console (cycles, seeding, claims, analog capture, assessment v3) | `ui_admin` | [PRD-725](https://linear.app/greenpill-dev-guild/issue/PRD-725) (historical PRD-676) | ⏳ |
| Admin: Community workspace Pools mode + Hub confirmation queue | `ui_admin` | [PRD-725](https://linear.app/greenpill-dev-guild/issue/PRD-725) (historical PRD-677) | ⏳ |
| Editorial: GardenDialog pool story + /impact aggregates | `editorial` | [PRD-726](https://linear.app/greenpill-dev-guild/issue/PRD-726) (historical PRD-678) | ⏳ |
| Hypercert cut-over: fulfilled-commitment bundling + allocation presets (split ownership: shared metadata composer + selectors = `state_api`; `bundleKind`/`commitmentIds`/`needUIDs` entity fields = `indexer`; allocation step UI = `ui_admin`) | `state_api` + `indexer` + `ui_admin` | [PRD-722](https://linear.app/greenpill-dev-guild/issue/PRD-722), [PRD-723](https://linear.app/greenpill-dev-guild/issue/PRD-723), [PRD-725](https://linear.app/greenpill-dev-guild/issue/PRD-725) (historical PRD-679 split) | ⏳ |
| G$ split-state settlement: SettlementModule + Celo Safes + multi-chain app | `settlement` | [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686) | ⏳ |
| Post-QA documentation polish: glossary, architecture, data boundaries, rollout language, operator/gardener task guides, screenshots, and recovery states | `docs` | [PRD-727](https://linear.app/greenpill-dev-guild/issue/PRD-727) (historical PRD-680/681 scope consolidated after QA Pass 1) | ⏳ |
| Final client PWA, admin, and editorial walkthrough videos with captions/transcripts and source-SHA provenance | `walkthrough_videos` | [PRD-728](https://linear.app/greenpill-dev-guild/issue/PRD-728) (repurposed from the pre-QA docs-guides lane after QA Pass 2) | ⏳ |
| External brief, audience notes, GTM/community rollout, and factual review | `docs` + `july_dry_run` | [RESR-57](https://linear.app/greenpill-dev-guild/issue/RESR-57), [RESR-58](https://linear.app/greenpill-dev-guild/issue/RESR-58), [COM-3](https://linear.app/greenpill-dev-guild/issue/COM-3) | ⏳ |
| July: methodology/metrics pulse (proto-commitment #1; RESR-53 canceled 2026-07-06, folded into the unified instrument) | `july_dry_run` | [COM-7](https://linear.app/greenpill-dev-guild/issue/COM-7) (historical label: RESR-62) | ⏳ |
| July: commitment-scoping surveys + mandate artifacts (gates August seeding) | `july_dry_run` | [COM-7](https://linear.app/greenpill-dev-guild/issue/COM-7) (historical label: RESR-62) | ⏳ |
| July: activations + proto-commitment loops (TAS) | `july_dry_run` | [COM-7](https://linear.app/greenpill-dev-guild/issue/COM-7) (historical labels: RESR-62; canceled RESR-63) | ⏳ |
| July: pilot cohort readiness | `july_dry_run` | [COM-7](https://linear.app/greenpill-dev-guild/issue/COM-7) + [COM-3](https://linear.app/greenpill-dev-guild/issue/COM-3) (historical labels: RESR-62, PRD-701; canceled RESR-13) | ⏳ |
| September: independent packages/community PWA after shared-foundation extraction | `community` | [PRD-682](https://linear.app/greenpill-dev-guild/issue/PRD-682) | ⏳ |
| September: Community Need intake into the commitment-seeding gate | `ui_admin` | [PRD-691](https://linear.app/greenpill-dev-guild/issue/PRD-691) + Community admin handoff (historical label: canceled PRD-683) | ⏳ |
| September: settlement-capacity evidence definition and signed pilot packet | `settlement_evidence` | [COM-11](https://linear.app/greenpill-dev-guild/issue/COM-11) (historical label: PRD-735) | 🚧 operational-assignment-gated |
| Follow-on: borrow-and-repay `CreditRegister` + credit indexer/shared/admin/PWA surfaces | `credit_follow_on` | PRD-697 (Follow On / Hardening; parked) | 🚧 blocked |

Spine records (not work items): [PRD-649](https://linear.app/greenpill-dev-guild/issue/PRD-649) architecture record (closes when contract-spec merges), [PRD-650](https://linear.app/greenpill-dev-guild/issue/PRD-650) proof capability (parent of the August workstreams), [PRD-651](https://linear.app/greenpill-dev-guild/issue/PRD-651) deferred transferable settlement vouchers, [RESR-57](https://linear.app/greenpill-dev-guild/issue/RESR-57)/[RESR-58](https://linear.app/greenpill-dev-guild/issue/RESR-58) research framing. Linked research: RESR-15, RESR-4, PRD-275.

## Tracks and sequencing (live Linear cadence)

Scope and Design closes on 2026-07-22, and the implementation window closes with the Build phase on 2026-07-31. Research alignment runs through 2026-07-30; the July dry-run operational checkpoint is 2026-07-31. The non-value pooling/register/schema tier may broadcast during Build only after its artifact-specific evidence and human authorization are recorded. Release follows on 2026-08-12 for the user-facing rollout and separately gated value tier. On 2026-09-30, the Follow On / Hardening native phase and the Community plus settlement-evidence operational checkpoint close in parallel as distinct evidence decisions.

### Track A: July dry run (existing rails, no code)

Runs entirely in parallel with Track B. Tracks (a) methodology and (c) activations run in parallel; (b) scoping surveys gate August seeding.

Focus cohort (Decision Log #23, named 2026-07-10; readiness stays evidence-gated per the garden survey): Tech and Sun Hub (Awka, Nigeria), Greenpill Cape Town (Muizenberg / Deep South Circles), AgroforestDAO / Redemption Hill (Bias Fortes, Brazil), plus an **open fourth slot** for a mature MRV-adoption anchor — candidates under consideration, none selected (Decision Log #29, which supersedes Decision Log #25 and Decision Log #27). The three named gardens cover all four action domains on their own.

- [ ] (a) Methodology/metrics pulse fielded inside the unified RESR-62 two-pass instrument (RESR-53 canceled 2026-07-06 and folded in; the protocol-pool proto-commitment framing and the Cape Town UNICEF waste showcase carry over)
- [ ] (b) Scoping surveys and cohort-readiness evidence per focus garden; one mandate artifact each under COM-7 with COM-3 operator coordination (canceled RESR-13 is historical only)
- [ ] (c) Activations defined and run under RESR-62; at least one full proto-commitment loop per focus garden (canceled RESR-63 is historical only)
- [ ] Proto-commitment loop table maintained in **COM-7 § Proto-commitment rehearsal** — one row per focus garden plus a Garden-4 placeholder; rewards via Cookie Jar or treasury only (no G$ in the dry run). *(Was a standalone Linear project doc, "July dry run — proto-commitment tracking"; folded into COM-7 and retired 2026-07-20 — its mandate rows duplicated COM-7's own readiness matrix, and only the loop's column shape was unique.)*

### Track B: Approved convergence-to-release sequence

This order supersedes the earlier implementation-first list. The only parallel work before the
backend freezes is specification, diagram, journey, and prototype review; product UI implementation
does not begin against moving contracts or indexer queries.

1. [ ] **Envio foundation first:** correct and merge GitHub PR #649; prove Envio `3.2.1` generation, build, tests, migration/replay, block preservation, and root Bun-first workflow without package-local skill copies or unrelated shared changes.
2. [ ] **Clear the existing contract environment:** complete PRD-747 HatsModule Steward upgrade and PRD-748 live-hat relabel operation. PRD-575 GreenWill is deferred for separate Council Safe coordination and does not block Commitment Pooling. PRD-749's visible en/es/pt terminology sweep must be complete before product UI implementation.
3. [ ] **Final architecture fine-comb:** Afo reviews the diagrams and specifications under PRD-649; every correction is reconciled across contracts, events, indexer entities, state/API, handoffs, prototypes, the canonical Google Doc, and Linear. Freeze the ABI/event/schema/query boundaries before PRD-721 dispatch.
4. [ ] **Commitment Pooling backend build:** execute PRD-721's three contract PR chains, then PRD-722 against frozen events; PRD-723 may build interface-independent foundations in parallel but reaches GREEN only after generated indexer queries, Garden-ID replay/cutover, and settlement selectors are proven. UI work in this stage is review/prototype refinement only.
5. [ ] **Human-authorized core activation:** pass local/fork/testnet, storage, upgrade/rollback, deploy-dry-run, and post-deploy gates; broadcast the approved non-value module/register/schema tier; persist and verify artifacts; update Envio deployment configuration; deploy/reindex; and re-read live entities/queries. Value-bearing settlement remains behind its separate audit/timelock/Safe/CCIP/AA/canary authorization.
6. [ ] **Existing admin/UI foundation:** resolve PRD-737 and the explicitly scoped admin-console/output defects and polish against verified live backend data. Do not turn this into a redesign or absorb the new Commitment Pooling feature implementation.
7. [ ] **Runtime interface implementation:** build PRD-724 client PWA, PRD-725 admin, and PRD-726 editorial surfaces against the frozen ABI, generated queries, and verified deployment output; settlement-only slices wait for the value-tier selectors and evidence.
8. [ ] **Develop/staging integration:** merge completed lanes in dependency order onto `develop`, verify the exact staging deployment URLs and source SHA, run targeted lane proof plus the Repo Quick Gate, and begin broad QA only from the verified staging build.
9. [ ] **QA Pass 1 / deep QA (PRD-729):** run full human-flow, authenticated Brave, real-device PWA, offline/recovery, contract-indexer consistency, accessibility, locale, permissions, and regression review. Route defects back to their owning lanes and re-merge fixes to `develop`.
10. [ ] **Post-QA documentation polish (PRD-727):** after QA Pass 1, reconcile architecture/glossary/reference prose, operator and gardener task guides, screenshots, accessible names, recovery instructions, translations, and every planned/live claim against the QA-tested product.
11. [ ] **QA Pass 2 / release certification (PRD-730):** retest every QA1 correction and the polished documentation, run boundary checks and the full Ship Gate, and freeze the verified `develop` snapshot only when staging is green and no unaccepted release blocker remains.
12. [ ] **Walkthrough-video completion (PRD-728):** after QA Pass 2, record, edit, caption, transcribe, privacy-review, and replay the approved client PWA, admin, editorial, member, Garden Steward, evaluator, and operational walkthroughs against the final source SHA.
13. [ ] **Cycle 1 and separately authorized value operations:** open Cycle 1 from the approved mandate artifacts only when its readiness gate passes. Settlement broadcast/canary/exit proof remains human-owned and independently authorized; one Fulfilled commitment may read Confirmed only after the authenticated acknowledgment. Credit follow-on stays blocked unless explicitly unblocked after pooling and settlement interfaces freeze.

### Track C: September community interface

- [ ] PRD-682 shared-foundation extraction, then independent `packages/community` scaffold at `community.greengoods.app` / local port 3010 (after PRD-723 substrate; canonical artifacts in `.plans/active/community-interface/`)
- [ ] PRD-691 Community admin seeding intake after the Commitment Pooling admin and PRD-682 Community substrate are GREEN (canceled PRD-683 is historical only)

The Needs layer consumed by PRD-682 and PRD-691 (Need/NeedSignal/NeedStatus/FundingAttribution schemas, shared substrate, admin triage, funder lens) is planned and tracked separately in `.plans/active/community-interface/` and the **Community Needs & Signals** Linear project. Canceled PRD-683 remains historical traceability only; register #28 records the schema-count amendment.

## TDD / Proof Order

- [ ] Identify the behavior boundary for each implementation lane before editing code
- [ ] Write or select the minimal failing test/proof first
- [ ] Run the RED command and record evidence in the lane handoff
- [ ] Implement the smallest change that can satisfy the proof
- [ ] Run the GREEN command and record evidence in the lane handoff
- [ ] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd` for one canonical machine lane: `contracts`, `state-api`, or `ui`
- [ ] For `settlement`, `indexer`, docs, and other execution sub-lanes, record detailed RED/GREEN or proof-limit evidence in the sub-lane handoff before recording the aggregate machine-lane GREEN
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Lane Checklists

Machine-lane ownership mirrors `status.json`: Codex owns `contracts`, `state_api`, and `qa_pass_2`; Claude owns `ui` and `qa_pass_1`. The detailed execution sub-lanes below are dispatch labels and handoff buckets, not valid `plan-hub --lane` values. Per-issue dispatch stays with Afo.

### Contracts (`codex/contracts/commitment-pooling`): PRD-721 (historical labels PRD-671/672)

- [ ] Contract logic and tests per `contract-spec.md`; bun wrappers only, never raw forge
- [ ] Respect deployment ordering, fail-closed pre-change storage baselines, and upgrade safety
  (GardenToken slot 213 offset 2; gap remains 37)
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [x] Write `handoffs/codex-contracts.md`
- [ ] Planning readiness: the independently audited local specification is corrected; keep the
  lane blocked until live Linear/source-document convergence is completed and re-read.

### Settlement (`codex/settlement/commitment-pooling`): PRD-686

- [ ] `SettlementModule` + tests per `settlement-spec.md` §3; zero changes to the pooling module or register; bun wrappers only
- [ ] Build Arbitrum `SettlementModule` + Celo `CeloSettlementExecutor` against the exact command/ack tuples; reuse the existing `@chainlink/contracts-ccip` dependency and ENS sender/receiver authentication patterns
- [ ] Prove immutable batch membership, disabled/configured/hard-ceiling batch bounds, per-member failed-attempt recovery, idempotent same-key command retry, independent acknowledgment retry, one immutable router per implementation, bounded peer grace, paused/drained router cutover, zero CCIP token amounts, native-fee reserve monitoring, bounded Safe execution/failure codes, exact indexer entities/events, and AA-gated PWA member delivery
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [x] Write `handoffs/codex-settlement.md`
- [ ] Planning readiness: command/ack ABI, transport, idempotency, authority, event, exact-net
  fee, indexer, and dual-chain evidence gates passed the local independent correction review.
  Live Linear/source-document convergence remains required before implementation dispatch.

### Indexer (`codex/indexer/commitment-pooling`): PRD-722 (historical label PRD-673)

- [ ] Entities, handlers, stats per the spec's fenced definitions; Envio regeneration preserves all new blocks; Garden IDs are `chainId-address` after full replay/cutover; generic audit actor stays nullable unless explicit; `bun codegen` clean
- [ ] Record RED/GREEN proof (scripted event-sequence test) before marking complete
- [x] Write `handoffs/codex-indexer.md`
- [ ] Dispatch core indexing when pooling events freeze; hold only settlement handlers for settlement event freeze. Record snapshot, switch criterion, rollback package, and Afolabi Aiyeloja as accountable live-cutover owner
- [ ] Planning readiness: self-describing unit events, `421614` placement, canonical settlement
  ERD, Envio v2 multichain behavior, first-event seeds, and Celo RPC mode are frozen locally;
  mirror convergence and event freeze still gate dispatch.

### State / API (`codex/state-api/commitment-pooling`): PRD-723 (historical labels PRD-674/679 shared half)

- [ ] Hooks, stores, query keys, five offline queue kinds (`commitment`, `claim`, `evidence`, `workLink`, `confirmation`) plus an online-only wallet `transfer` capability that remains disabled unless the AA gate passes; hooks stay in shared
- [ ] Add explicit `421614`/`11142220` Pimlico endpoints and a typed account-profile registry:
      Kernel `0.2.4` on both testnets for same-address mechanics evidence, Kernel `0.3.1` on
      Arbitrum One/Celo Mainnet for production, fail-closed profile selection, and focused
      `settlement-aa-profile.test.ts` proof that testnet evidence cannot enable member delivery
- [ ] Dispatch core state/API after pooling interfaces and core indexer codegen/build; hold settlement selectors until settlement indexer GREEN. Do not record aggregate full `state-api` GREEN while the settlement phase is outstanding
- [ ] Record RED/GREEN proof before marking complete
- [ ] Write `handoffs/codex-state-api.md`

### Credit Follow-on (`codex/credit/commitment-pooling`): blocked; tracked as PRD-697 (Follow On / Hardening, parked — authorizes no implementation)

- [ ] Do not implement without an explicit unblock; `../../backlog/commitment-credit-follow-on/spec.md` is design truth only
- [ ] Depends on PRD-721/686 interface stability and the settlement-side loan-disbursement seam
- [ ] When unblocked: `CreditRegister` + indexer + shared `queryKeys.credit.*` + `credit` job kind + admin/PWA credit surfaces
- [ ] Write `../../backlog/commitment-credit-follow-on/handoffs/codex-contracts.md`

### UI Client (`claude/ui-client/commitment-pooling`): PRD-724 (historical label PRD-675)

- [ ] Client tasks only; i18n en/es/pt for every new string; hero moments per spec
- [ ] Record RED/GREEN proof or a proof-limit note
- [ ] Write `handoffs/claude-ui-client.md`

### UI Admin (`claude/ui-admin/commitment-pooling`): PRD-725 (historical labels PRD-676/677/679 admin half)

- [ ] Admin tasks only; AdminDialog anatomy (side sheets retired); i18n; Storybook coverage
- [ ] Canceled PRD-683 is not part of this executable lane; Community seeding intake is owned by PRD-691 and `.plans/active/community-interface/handoffs/claude-ui-admin.md`
- [ ] Record RED/GREEN proof or a proof-limit note
- [ ] Write `handoffs/claude-ui-admin.md`

### Editorial (`claude/editorial/commitment-pooling`): PRD-726 (historical label PRD-678)

- [ ] Public surfaces only; aggregate-only data; small-community thresholds
- [ ] Write `handoffs/claude-editorial.md`

### Post-QA documentation polish (`claude/docs/commitment-pooling`): PRD-727 (historical labels PRD-680/681)

- [ ] Start only after QA Pass 1; reconcile architecture, glossary, task guides, screenshots,
      accessible names, translations, recovery states, and planned/live claims
- [ ] Glossary anchors preserved; docs build and vocab lint green
- [ ] Write `handoffs/claude-docs.md`

### Walkthrough videos (`claude/walkthrough-videos/commitment-pooling`): PRD-728

- [ ] Start only after QA Pass 2 and PRD-727 completion
- [ ] Record final client PWA, admin, editorial, member, Garden Steward, evaluator, and operations
      walkthroughs with captions/transcripts, privacy review, source SHA, and final path replay
- [ ] Write `handoffs/claude-walkthrough-videos.md`

### QA Pass 1 (`claude/qa-pass-1/commitment-pooling`)

- [ ] Review UI behavior and user flows through the authenticated Brave QA profile
- [ ] Verify acceptance criteria against the specs; offline queue proof via mockAuth
- [ ] Confirm required execution sub-lane handoffs exist, including settlement exit-proof evidence or an explicit proof-limit note
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/commitment-pooling`)

- [ ] Review implementation edges and regressions per lane acceptance criteria
- [ ] Run targeted validation commands
- [ ] Write `handoffs/codex-qa-pass-2.md`

### Human release operations (`handoffs/human-release-ops.md`)

- [ ] Afolabi Aiyeloja records named owners for audit, GoodDollar, CCIP peers/fee reserves,
  protocol multisig/timelock, garden Safe recovery, the direct-lane + dual-chain testnet gate,
  Garden-ID replay/rollback, broadcast, and live Celo exit proof
- [ ] No implementation agent self-authorizes a broadcast or live cutover
- [ ] Post-broadcast and exit evidence stays blocked until every corresponding input and authorization is present

## Validation

Per the Validation Intent Ladder: lane work uses targeted proof; the coordinator runs the Repo Quick Gate at checkpoints; Ship Gate before merge/release.

- [ ] Lane-targeted: lane handoff Validation sections name the commands for each Afo-dispatched work unit
- [ ] Checkpoint: `node scripts/dev/ci-local.js --quick` after multi-lane merges
- [ ] Ship Gate before release: `bun format && bun lint && bun run test && bun build` + `bun run lint:vocab` + `bun run agentic:check` + `bun run check:design-md` + `bun run check:design-generated` + `bun run check:design-tokens` + `bun run --filter @green-goods/shared check:stories` and `check:story-quality` where Storybook-covered surfaces changed
- [ ] Full-local dogfood before cycle 1: `bun run dev` + `bun run dev:smoke:full`

## Follow-ups from the 2026-07-18 audit response (Linear MCP was unauthenticated this session — file these when it reconnects)

1. **App-wide Operator → Steward rename**: community glossary (`docs/docs/reference/glossary-community.md`), docs site, i18n keys ×3 locales, admin/client UI copy, vocab-lint update. CP specs/visuals already use steward (mapping note: steward = operator/owner Hats).
2. **PRD-727 docs-promotion appendix refresh** (historical PRD-680): diagrams.md §Appendix already lists the ship-time docs edits; re-check after the audit-response restructure (D6 acts, D13 matrix, CommitmentRequirement entity).
3. ~~**Linear re-apply pass**~~ — ✅ **DONE 2026-07-19.** The corrected wording was applied live to PRD-686, the project description, RESR-57, RESR-58 and the Pool Identity companion; the archived packs keep their original text as provenance (they are frozen records of what was applied on 2026-07-11, not current guidance). **Closed out 2026-07-22 (live re-read):** the canonical synthesis's two sentence-edits (see #9) are moot — Linear Doc 2 is archived and the corrected model is verified in the Google Doc. The G$-on-Arbitrum correction to PRD-649 + the Lifecycle companion (`reports/corrections-log.md` §9e) was verified **already clean** in live Linear: neither PRD-649's body nor the [Lifecycle And Aggregator Semantics](https://linear.app/greenpill-dev-guild/document/commitment-pooling-lifecycle-and-aggregator-semantics-bfdd633951d6) doc carries any "G$ on Arbitrum / partner-confirmed" claim (the word "Arbitrum" does not appear in either), and the [Pool Identity + Capability Architecture](https://linear.app/greenpill-dev-guild/document/commitment-pooling-pool-identity-capability-architecture-d6b7e5c22324) companion carries the corrected split-state topology explicitly. No Linear write was needed.
4. **Ops confirmation before the first garden Safe deploys**: designate the Dev Guild recovery multisig's concrete Celo address independently of the retired working-capital Safe, and record the HoA stream's receiving-address evidence (GG protocol Safe) in the settlement handoff (milestone M1, settlement-spec §8).
5. **Optional hi-fi design pass** (Stitch / Claude Design) over the revised client pool surfaces (W1/W2/W25) once these wireframes settle.
6. **Resolve the G$-for-protocol-services question** with GoodDollar (`reports/corrections-log.md` §9b): may Green Goods charge gardens G$ for protocol services, given the House of Alignment circulation mandate? Open external dependency; the corrected topology has no return leg.
7. **Linear archive candidates — only ONE of six is clean.** A 2026-07-18 pre-archive confirmation pass grep-proved each candidate against every repo spec and the canonical synthesis. **The specs carry the WHAT; these docs carry the WHY, and the WHY is almost never reproduced.**

   | Linear doc | Verdict | What is lost if archived as-is |
   |---|---|---|
   | ~~Supplemental Deep-Dive (`cbd5c9a2`)~~ | 🗑️ **DELETED 2026-07-19** | Nothing lost — every decision had a live repo cite. |
   | Circular G$ Economies (`6c7a2e4e`) | ✅ **EXTRACTED — safe to delete** | Metric formulas, the 5-condition healthy-season test, the settled-flow tagging dependency, sink ranking and comparables → `settlement-spec.md` §11. Finding: the doc has **no numeric targets**, only directional hedges. |
   | G$ Bridged vs. Split-State Settlement (`657f7233`) | ✅ **EXTRACTED — safe to delete** | Buy-pressure argument, bridge-risk evidence, market depth, bridging paths, scored comparison, exact addresses → `settlement-spec.md` §10. |
   | Architecture 3 Re-Score (`8243d7ef`) | ✅ **EXTRACTED — safe to delete** | Why Sarafu-on-Celo is an evolution not a replacement, plus its four named revisit gates → `settlement-spec.md` §10.3. Its "exit fee is 3% not 10%" correction is itself superseded by GIP-24 — recorded at §10.4. |
   | Protocol Architecture and Spec Direction (`41f5ada1`) | ✅ **EXTRACTED — safe to delete** | Lead-sync record → §9d; the G$-on-Arbitrum correction → §9e. Its stale-records list (GROW-6/5/8, PRD-473, PRD-649) was **verified already applied** — GROW-6 carries the correction dated 2026-07-03 — so it was an actioned list, not a pending to-do. |
   | ~~Research Pass 3 (`cca00039`)~~ | 🗑️ **DELETED 2026-07-19** | Its unique item (the G$-for-protocol-services question) was extracted to §9b first. |

   ⚠️ **Concurrency**: `cca00039` and `41f5ada1` were both modified 2026-07-19 ~03:14–03:17Z by another session — the same window as the survey documents. **Confirm that session is finished before archiving either.**

   **Never archive**: Garden Survey Pass 1 (`9a7fc705`), Garden Onboarding Call Pass 2 (`9fb02ee8`), July dry-run tracking (`d05eff0b`). Active and needed.

8. **Add Linear document URLs/IDs to every citing spec.** `settlement-spec.md:7` cites its decision basis by **bare multi-word title**, and no repo spec contains a single `linear.app/…/document/…` URL. Proved fragile today, independent of archiving: a multi-word Linear title search returns **empty even for a live document** ("Architecture 3 Re-Score Sarafu" → 0 results; "Sarafu" → found). Archived docs stay retrievable by stable ID, so citing the ID/URL fixes both problems at once.
9. **Linear docs 1, 2, 9, 10 — resolved to exact records and reconciled 2026-07-22 (live Linear + Google Doc re-read).** The four "ordinal" docs map to these Linear documents, **all now archived** (retired into the canonical Google Doc tabs — the stronger form of the "stub them" intent recorded below):

   | # | Title | ID | Archived | Was attached |
   |---|---|---|---|---|
   | 1 | [Commitment Pooling — External Documentation & Rollout Plan](https://linear.app/greenpill-dev-guild/document/commitment-pooling-external-documentation-and-rollout-plan-3864d8e05c4c) | `8a3f3dfa-a8a6-434a-8ef5-da7a9dc88566` | 2026-07-21 | RESR-57 |
   | 2 | [Commitment Pooling × Green Goods — Grassroots Economics Learnings, and the Full Flywheel We're Building](https://linear.app/greenpill-dev-guild/document/commitment-pooling-green-goods-grassroots-economics-learnings-and-the-d3939e890b14) (canonical synthesis) | `3e7c1fec-f0fa-471e-a216-f53e2e243bcc` | 2026-07-19 | project |
   | 9 | [Commitment Pooling — Use Cases & Domain Scenarios](https://linear.app/greenpill-dev-guild/document/commitment-pooling-use-cases-and-domain-scenarios-88ff9704a3bb) (retains Part D) | `1b41566e-9904-4d4b-a5f6-c525637b94b7` | 2026-07-21 | RESR-58 |
   | 10 | [Green Goods Commitment Pooling — External Brief](https://linear.app/greenpill-dev-guild/document/green-goods-commitment-pooling-external-brief-5fbafba95f91) | `d8115ef3-f425-486b-81ce-23b14d0a29f5` | 2026-07-21 | RESR-57 |

   **Reconciliation (2026-07-22):** because all four are archived, **no Linear write was applied** — archival already retires them as competing external-prose sources, and un-archiving to "stub" would re-create the very duplication the stub was meant to prevent. The **canonical Google Doc** now owns the external prose and was live-verified: no `working-capital` hop anywhere (0 doc-wide), canonical G$ on Celo with no Arbitrum-G$ rail, the direct HoA → GG protocol Safe → garden funding rendered in the tab-01 money map, and **no fourth-garden name** in prose, captions, or comments. Docs 1 & 10 keep their embedded Linear images (archived records untouched); Doc 9's Part D is intact in the archived record. Keeping the four archived is the recommendation; any further action on the archived records is **Afo's call**. The original two-edit intent for Doc 2 (canonical synthesis) is retained below for provenance — its substance is already reflected in the re-authored Google Doc tab 02 (verified 2026-07-22), so it is no longer an outstanding action:
   - **§2.7, rail 4** — replace `down through a Dev-Guild working-capital Safe and the GG protocol Safe to each garden's Safe` with `directly into the GG protocol Safe and from there to each garden's Safe`.
   - **Change Log, Pass-4 row V** — do **not** rewrite it (it is accurate as history). Append to the end of the row: `**Superseded 2026-07-18**: the working-capital hop was retired — the House of Alignment stream now lands directly in the GG protocol Safe. See reports/corrections-log.md §9.`

   These were hand edits by design (a 72k-character Linear document cannot be safely regenerated through the MCP write path). **Moot as of 2026-07-22:** Linear Doc 2 is archived, and Google Doc tab 02 — re-authored, not a mirror of Doc 2's `§2.7`/Change-Log structure — already states the corrected model. `working-capital` returns 0 doc-wide, and the tab-01 money map renders the direct HoA → GG protocol Safe → garden route with "No bridged G$, ever." No edit remains outstanding.

## Ontology sidecar gaps found by the 2026-07-26 visual alignment

The ontology foundation (PR #661) made `packages/shared/src/ontology/green-goods-ontology.json` repo
canon and encoded twelve commitment-pooling vocabularies as `status: "spec"`. Aligning the visual
artifacts against it confirmed every state/enum label in `diagrams.md` maps 1:1 onto a canonical
member, and that all four spec state machines render the sidecar's `on-chain` / `derived` /
`off-chain` storage flags correctly.

It also surfaced vocabularies these diagrams **must** draw that the sidecar does not yet carry.
Per the alignment contract these are flagged here rather than invented — each is already frozen in a
canonical spec, so the gap is sidecar coverage, not an undefined term:

| Vocabulary drawn | Layer and exact members | Frozen in | Drawn by |
|---|---|---|---|
| `DisbursementState` | Solidity `None, Queued, Dispatched, Confirmed, Failed, Cancelled`; GraphQL mirror `UNKNOWN, QUEUED, DISPATCHED, CONFIRMED, FAILED, CANCELLED` | `settlement-spec.md` §3.1.2 | D10, D10b, D7b |
| `FailureCode` | Solidity, 12 members `None` … `BalanceDeltaMismatch` | `settlement-spec.md` §3.1.2 | D16, D7b |
| `AcknowledgmentDeferralCode` | Solidity `None, QuoteFailed, FeeReserveLow, SendFailed` | `settlement-spec.md` §3.1.2 | D9.2, D16, D7b |
| `DisbursementKind` | Solidity `ContributorReward, Funding`; GraphQL `UNKNOWN, CONTRIBUTOR_REWARD, FUNDING` | `settlement-spec.md` §3.1.2 | D7b |
| `FundingRoute` | Solidity `None, ProtocolToGarden`; GraphQL `UNKNOWN, NONE, PROTOCOL_TO_GARDEN` | `settlement-spec.md` §3.1.2 | D7b, D8, D12 |
| `ResultStatus` / `SettlementExecutionStatus` | **two names, two layers**: Solidity `ResultStatus { None, Success, Failed }`, GraphQL `SettlementExecutionStatus { UNKNOWN, SUCCESS, FAILED }` | `settlement-spec.md` §3.1.2, §6 | D7b, D9.1 |
| `CommitmentClaimRequestState` | GraphQL `PENDING, ACCEPTED, DECLINED, SUPERSEDED` | `contract-spec.md` §8.2 | D11b, D7.2 |
| `CommitmentEventType` | GraphQL, 40+ members incl. `UNITS_COMMITTED`, `UNITS_RELEASED`, `UNITS_FULFILLED` | `contract-spec.md` §8.2 | D7.1 |
| `CommitmentUnitScope` | GraphQL `POOL, CYCLE` | `contract-spec.md` §8.2 | D7.2 |

Two further families are app-side and may not belong in the sidecar at all — recorded so the decision
is deliberate rather than an omission: the nine member-facing settlement states D10b derives
(`support-queued` … `support-cancelled-failed`, `uiux-spec.md` §5.9) and the offline job states D14
draws (`waiting_for_hat`, `Syncing`, `RetryableFailure`, `Exhausted`, `Discarded`); the sidecar's
`job-kind` covers job *kinds* (`work`, `approval`) but no job *state* vocabulary exists.

Conversely `accounting-state` (`Registered`, `Committed`, `Released`, `Fulfilled`) was in the sidecar
but surfaced in no visual; D6c's unit-and-slot ledger now names its members explicitly.

**Next step**: when the settlement and indexer enums land in Solidity/GraphQL, add them to the
sidecar with `planned_anchor` entries so `check:ontology`'s spec-arrival guard watches them the way
it watches the current twelve. `check:ontology` parses neither Markdown nor images, so `diagrams.md`
and the gallery remain the manual leg of that contract.

## Boundary

No implementation code starts from this plan without Afo dispatching the specific lane or handoff. G$ split-state settlement is Build-phase scope via [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686) (`settlement-spec.md`, Decision Log #14), targeting the 2026-08-12 Release. Implementation may begin only from its scoped handoff after the pooling reward/provider interface freezes; production Safe/Zodiac authority evidence, audit/timelock, native-fee policy, GoodDollar configuration, AA outcome, broadcasts, and canary remain human Release gates. The date waives no gate. Still out of scope for every lane: bridged G$ (never), arbitrary bridge-executor automation, a `packages/agent` settlement relayer/write path, bridge custody/unbounded value authority, Sarafu integration, transferable settlement vouchers and `settlementAdapter`/`settlementEnabled` activation (PRD-651), indexing raw Celo/G$ transfers, garden-to-garden federation, leaderboards, and public credit scores. Optional later agent alerts are read-only and hold no settlement authority. Borrow-and-repay `CreditRegister` is a blocked follow-on lane; no implementation without a new scope lock.
