# Commitment Pooling Plan

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Status**: `ACTIVE: repository CP-AUD-001–021 corrections complete; contracts independently ready; live Linear/Google Doc/artifact/partner/human gates keep final convergence blocked`
**Created**: `2026-07-03`
**Last Updated**: `2026-07-21`

Linear mirror: project [Commitment Pooling](https://linear.app/greenpill-dev-guild/project/commitment-pooling-4bc53572f354). Native phases: **Scope and Design** (2026-07-22), **Build** (2026-07-31), **Release** (2026-08-12), and **Follow On / Hardening** (2026-09-30). Operational checkpoints are separate: July dry run (2026-07-31) and Community plus settlement-evidence delivery (2026-09-30). **The full document map is the next section.** Community-specific diagrams, wireframes, journeys, and research operations live in `.plans/active/community-interface/`. The 2026-07-10/11 reconciliation, PRD-686/RESR-57 predicate, and null PRD-651/697 dates were live-verified historical state; current Linear convergence must be reread before any write. **Fourth-garden policy (Decision Log #29, 2026-07-18 — supersedes Decision Log #25 and Decision Log #27): no fourth garden is selected.** The slot is open, candidates are under consideration, and **no artifact names one**. The three named gardens cover all four action domains on their own. The earlier Decision Log #25→Decision Log #26→Decision Log #27 naming sequence is closed history; do not re-apply it.

> **Linear consolidation (2026-07-05).** To keep Linear minimal, the per-lane workstream issues were closed into a small set of parent **trackers**; **this plan is the lane-level execution truth**. Trackers: **PRD-650** August proof MVP (absorbs PRD-671→681), **PRD-686** G$ split-state settlement, **PRD-682** September community interface (absorbs PRD-683), **RESR-62** July dry run (absorbs RESR-63 + RESR-13; RESR-53 stays in Impact Framework). Needs-layer trackers **PRD-687** substrate (absorbs PRD-688/689/690) and **PRD-691** app (absorbs PRD-692/693/694) live in the **Community Needs & Signals** project. Kept as-is: **PRD-649** (architecture record), **PRD-651** (deferred transferable settlement vouchers), research records **RESR-57/58/64**, parked **PRD-695/696**, and the linked-research issues **RESR-15/RESR-4/PRD-275**. The per-lane `PRD-6xx` / `RESR-xx` IDs in the tables below are **historical labels** for the closed child issues — dispatch reads the lanes here and rolls up to the parent tracker, not to those closed IDs.

> **Canonical historical mapping (2026-07-20).** References to the retired identifiers resolve as **PRD-701 → COM-3** and **RESR-62 → COM-7**. Preserve the old identifiers inside frozen archives and dated history; use COM-3 and COM-7 for active instructions.

## Document map

Every file in this hub, by role. **This list is the index — if you add a document here, add its row.**

| Document | Role | Authority |
|---|---|---|
| `plan.todo.md` | **This file.** Decisions, tracks, lane checklists, follow-ups. The hub entry point. | Lane-level execution truth |
| `contract-spec.md` | Pooling module + register: state machines, events, §6.1 permission matrix | **Contract-layer source of truth** |
| `settlement-spec.md` | G$ split-state settlement: SettlementModule, Celo Safes, oracle, AA gate | **Settlement + verification source of truth** |
| `../../backlog/commitment-credit-follow-on/spec.md` | Borrow-and-repay `CreditRegister` | Design only — **blocked follow-on**, not dispatchable |
| `uiux-spec.md` | Canonical cross-surface flows + §4 state tables + job kinds | UI/UX contract |
| `wireframes.md` | 23 CP frame headings across four surfaces (W1–W16, W13b, W21–W26; W6 is a retirement tombstone) | **Lo-fi structural truth** |
| `diagrams.md` | D1–D13 mermaid execution reference (ERD, sequences, state machines, topology) | Flow truth |
| `prototypes.md` | 14 storyboards (SB-1–14) + missing-frame index + action inventory | Fidelity-neutral walks — **adds no design authority** |
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
| `handoffs/` | 15 dispatch files (13 agent + two human); `README.md` is the index, `human-release-ops.md` owns broadcast/cutover authorization, and `human-settlement-evidence.md` owns the September evidence-definition gate | Per-lane dispatch |

**Published artifacts** (rebuilt from this hub, same URLs on each rebuild):

- [Flow Prototypes](https://claude.ai/code/artifact/19c3dcad-ac1d-4398-bcd4-57d0c892be2c) — hi-fi interactive screens, 14 walkable journeys (`prototypes-artifact.build.ts` + `hifi/`)
- [Visual Asset Gallery](https://claude.ai/code/artifact/007ef090-9e26-4b1d-898c-615155304d9d) — all assets rendered, three audience tabs (`visual-assets-artifact.build.ts`)

**External-facing canonical home**: [Green Goods Commitment Pooling (Google Doc)](https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit). `external-brief.md` is a pointer and source map only; no repo file mirrors the external narrative.

## How to read decision citations

⚠️ **This hub has two independent decision lists, both numbered from 1.** A bare `#N` is therefore ambiguous in the range 1–29, and this has caused real mis-resolutions. Until a full renumber lands:

| List | Range | What it is |
|---|---|---|
| **Decision Log** (the table below) | 1–29 | Curated current-state decisions spanning the whole feature, newest last |
| **Full decision register** (further below) | 1–36 | The 2026-07-03 alignment session verbatim, plus dated addenda 28–36 |

- **`#30`–`#36` are unambiguous** — the Decision Log stops at 29, so those are always the register (`#34` alone is cited 71×).
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
| 6 | Per-commitment claim mode (open vs approval-gated) set at seeding; declared reward + operator-executed payout + rewardPaid event; module never custodies funds | Zero CookieJar contract changes in August; custody stays where it is. |
| 7 | Lightweight evidence object (IPFS CID via module event) for SupportService/OperatorCaptured; Offer recipient or Request creator confirms by default, named groups exclude the accepted provider, and “Not yet” raises a dispute; DomainImpact keeps full MDR | One direction-aware human loop for low-stakes mutual aid without provider self-confirmation; full approval rigor where impact is claimed. |
| 8 | v3 authorship split: baseline = evaluator or operator; delta/re-assessment = Evaluator Hat only; testimony = Community Hat only | Preserves analog capture while keeping the two-voice evaluation model clean. |
| 9 | Surfaces: PWA Garden tab + WalletDrawer pools panel; admin Garden workspace + Community workspace Pools mode + Hub queue; editorial GardenDialog + /impact; September `packages/community` as an independent PWA at `community.greengoods.app` (local port 3010) after shared runtime/auth/offline/shell foundations are extracted | Q&A decisions 9, 10, 21, 3; WalletDrawer already reserves the commitments tab and `/community` is the canonical admin operational workspace. |
| 10 | Clean room: Grassroots Economics paper + public docs only, never AGPL Sarafu source | RESR-57 D3 + non-AGPL constraint. |
| 11 | Seasons & Campaigns project converted in place; legacy season issues composted with pointer comments | Seasons and campaigns are cycle types inside the pool; separate project inverted the dependency. |
| 12 | Out of scope everywhere: bridged G$, bridge custody or unbounded value authority, Sarafu integration, transferable settlement vouchers / `settlementAdapter` activation, indexing Celo/G$ transfers, garden-to-garden federation, leaderboards, public credit scores | Supersedes the stale "no Celo/no G$" wording. Split-state G$ settlement is in August via PRD-686; these guardrails keep the settlement rail bounded. |
| 13 | Design artifacts live in this folder: low-fi in-repo wireframes for all four surfaces (`wireframes.md`) + mermaid diagrams (`diagrams.md`) + the consolidated permission matrix (contract-spec §6.1); docs-site promotion rides PRD-680 at ship | User alignment 2026-07-04 (post-#619 audit): understand flows on screens before build; low fidelity on purpose; the docs site describes what is live. |
| 14 | G$ split-state settlement enters the **August release**: NET-NEW `SettlementModule` on Arbitrum with a reward-bound queue and `Queued → Executing → Reported → Verified` plus failure/retry/cancel states; Celo Safes execute through Zodiac-scoped Roles members ([PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686), `settlement-spec.md`). Chainlink Functions is the only receipt-verification path; “checking receipt” is derived while a request is active. No manual fallback exists. | User decisions through the 2026-07-10 readiness scope lock. |
| 15 | Fund topology: HoA stream → GG protocol Safe (Celo) → garden Celo Safes → members. One deterministic Safe mapping per garden, deployed on demand. Pilot recovery is exactly 2-of-3: protocol multisig, Dev Guild recovery multisig, and named garden recovery delegate; no owner is an executor. Green Goods queues only the derived ProtocolToGarden funding route; HoA → protocol Safe remains upstream context. | User-confirmed topology and settlement trust review through 2026-07-10; working-capital hop removed by user decision 2026-07-18 (corrections-log §9). |
| 16 | Members receive G$ at same-address smart accounts on Celo only after the AA/bundler/paymaster gate passes. If it fails, automated member delivery and member sends remain blocked while ProtocolToGarden funding may continue; no alternate member-claim path ships. | User decision 2026-07-10; settlement-spec §5. |
| 17 | The app becomes multi-chain this iteration: primary chain (`VITE_CHAIN_ID`) + settlement chain (Celo 42220). Status reads from the indexer and Safe balances use a second viem client; member balance/send surfaces ship only after `memberDeliveryEnabled` records the AA/paymaster gate. | User decisions through 2026-07-10; settlement-spec §5. |
| 18 | Borrow-and-repay becomes a blocked follow-on lane: `CreditRegister` is designed in `../../backlog/commitment-credit-follow-on/spec.md`, but it is not part of the August base MVP and is not dispatchable without an explicit unblock | User decision 2026-07-06; keeps GE mutual-credit design visible without expanding the hard August commitment. |
| 19 | `status.json` uses only plan-hub canonical machine lanes (`contracts`, `state_api`, `ui`, `qa_pass_1`, `qa_pass_2`); detailed workstreams remain as `execution_sub_lanes` and this checklist | Keeps `node scripts/harness/plan-hub.mjs validate`, `list`, and `record-tdd` usable without losing the Codex/Claude sub-lane breakdown. |
| 20 | ~~Linear sync is explicit parent-only for this hub (`linear.laneSyncMode = parent_only`)~~ **SUPERSEDED 2026-07-20 by register #37** — `laneSyncMode` is now `lane_issues` and each execution sub-lane carries a thin Linear issue. This entry is the Decision Log twin of register #31; both are superseded together. | Original rationale: preserved the low-noise Linear footprint and avoided using PRD-650 as fake lane issue IDs. The issue-cap constraint behind it lifted; the anti-duplication rule it protected survives as register #37's "lane bodies must not restate handoff scope". |
| 21 | Commitment domain scope is optional and multi-valued. `domains[]` + positional `requiredActionUIDs[]` replace singular domain/action fields; DomainImpact alone requires 1–4 registered action/domain pairs. UID `0` is valid; array presence is the binding signal. `CommitmentCreated` emits all immutable creation facts, and approval-gated claims use a commitment-keyed companion index for deterministic decline/accept/supersede handling. | User alignment + regression review 2026-07-09; aligns the spec with the live ActionRegistry allocator and Envio's current ID-first handler API. |
| 22 | G$ reward queues derive source/recipient/token/amount from the fulfilled commitment. The funding route is exactly ProtocolToGarden with no address/token overrides. Reports persist `reportedBy`; a mandatory Chainlink Functions callback checks finalized receipt/source/token/log coverage and is the only path to Verified or receipt-invalid Failed. Batches hold 1–24 immutable members and reconcile failed members individually. | User alignment + regression review through 2026-07-10; closes arbitrary routes, manual assertions, unbounded batches, and unrecoverable batch membership. |
| 23 | Pilot focus cohort named: operational artifacts (RESR-58 scenarios, RESR-62 survey, July tracking doc, PRD-701 onboarding) carry only Tech and Sun Hub (Awka, Nigeria), Greenpill Cape Town (Muizenberg / Deep South Circles), AgroforestDAO / Redemption Hill (Bias Fortes, Brazil), plus one TBD mature MRV-adoption garden selected via parallel deep research; other synthesis gardens stay narrative context. RESR-58's document is garden-first (journeys as the coherence layer, mechanism scenarios as the normative appendix, new S11 institutional-partner and S12 MRV-adoption scenarios); UNICEF is modeled as an off-platform partner (exports + receipt-checked FundingAttribution, no account or confirmation role). Naming a candidate never presumes readiness. | User alignment Q&A 2026-07-10; RESR-53 was canceled 2026-07-06 and folded into RESR-62's unified instrument. |
| 24 | July operator cadence and settlement breadth aligned: PRD-701 moves to due 2026-07-30 (operator engagement lands with RESR-62's window; the 2026-07-31 dry-run milestone holds; the 07-16 Product-cycle boundary stays a cycle fact, with outreach expectations only). Every focus garden is G$-settlement-capable in August (one Celo Safe per garden, on demand); Tech and Sun Hub is the first-execution hypothesis and Pass-2 evidence orders the rollout — supersedes the derivative-level "single Pass-2-confirmed garden, sink-first" wording (the settlement lane was always per-garden; no gate, ABI, or acceptance change). TAS is the single Awka hub today (multi-hub stays roadmap/vision). UNICEF is a funded program for Greenpill Cape Town's waste work (partner stays off-platform; Pass 1 captures reporting cadence/deadline and funding path). | User alignment Q&A 2026-07-11 (plan-mode session); settlement-spec.md and codex-settlement handoff grep-verified free of single-garden assumptions. |
| 25 | Garden 4 selected: a candidate was chosen as the mature MRV-adoption anchor, owning the B4/S12 journey with the es locale proof riding B4. **Superseded by Decision Log `#29`; no selection was ever made, and the candidate is deliberately not named in any tracked artifact.** Slotted into RESR-58 Part A/B4 and the reward-path matrix, the July tracking rows, RESR-62/PRD-701/RESR-57 cohort lines, and the external-brief cohort. Pass 1 verifies the five selection criteria as evidence, not assumption. | User selection 2026-07-11 (read out in session; supersedes the deep-research TBD slot). |
| 26 | Fourth-garden hold: the #25 selection is NOT presented until first contact is made. All presentation-facing and operational artifacts (RESR-58 doc/issue, RESR-62, PRD-701, RESR-57, July tracking doc, external brief, rollout plan, research-plan) carry an anonymous "fourth garden — in outreach, named only once participation is confirmed" slot with the selection criteria retained; the outreach target's name lives only in this decision log and internal notes. The three named gardens alone cover all four action domains, so the four-domain claim stands. In the same pass, the RESR-58 document was reformatted (audience-entry table, TOC, terms box, role legend, per-journey template, S-style headings, bulleted Part D) and strengthened per the 25-finding audit — including new S13 (declared reward → RewardPaid, the only July reward rail) and S14 (protocol pool + cross-garden claim, the dry run's mechanism), "campaign cycle" disambiguation per contract-spec's own rule, and bidirectional B↔S cross-references. | User decisions 2026-07-11 (second plan-mode session): present only what is accurate; audit findings L1–L8 / C1–C8 / G1–G9. |
| 27 | **SUPERSEDED 2026-07-18 by Decision Log #29 (fourth garden NOT selected, slot open) — do not re-apply without a fresh owner decision; it has been reversed twice.** ~~Fourth-garden naming stands (supersedes #26's hold)~~: **the candidate** was named across coordination and presentation artifacts with the **"selection is not participation"** guardrail — no external claim stated it participates until its corrected mandate was confirmed (RESR-62 evidence; naming never presumes readiness). The live Linear r4 pass of 2026-07-11 afternoon (RESR-58 doc r4 + issue, RESR-62, survey + Pass-2 call docs, external brief, rollout plan, manually uploaded companion graphics) is the canonical presentation state; repo artifacts align to it, and the same-day "naming regression" classification is retracted. | User decision 2026-07-11 (confirmed during the commit/reconciliation session after evidence review of the r4 pass). |
| 28 | Visual-asset audit decisions: (a) per-action required counts — `requiredApprovedWorkCounts[]`/`approvedWorkCounts[]` positional with `requiredActionUIDs`, ReadyForConfirmation requires every requirement met, `approvedUnits = floor(targetUnits × Σ min(approved, required) / Σ required)`, `ApprovedWorkCounted` gains `requirementIndex`, indexer gains `CommitmentRequirement` (contract-spec amendment 2026-07-18); (b) fund topology corrected — HoA stream lands directly in the GG protocol Safe, single ProtocolToGarden route (#15 updated); (c) **Garden Steward** is the standardized CP role name (steward = operator/owner Hats; app-wide rename is a follow-up); (d) W22 batch/oracle console moves to a NEW deployer-gated admin **Operations** workspace; (e) pool-surface history = per-view filter chips, no History stage; (f) W6 home summary card retired — WalletDrawer Commitments tab header is the only promises summary. | User visual-asset audit, three AskUserQuestion rounds, 2026-07-18 (corrections-log §9–10). |
| 29 | **Fourth garden is NOT selected — supersedes #25 and #27.** No candidate was ever selected — the earlier entries recorded an option under consideration, not a decision. The fourth slot is **open**. No artifact — repo, Linear, Google Doc, graphics, or presentation prose — names a fourth garden; all describe the slot as open with its selection criteria retained. Any candidate's identity lives in research-notes storage only — **this repository is public**. The three confirmed candidate gardens (Tech and Sun Hub, Greenpill Cape Town, AgroforestDAO / Redemption Hill) cover all four action domains on their own, so the four-domain claim stands without a fourth name. **Never re-introduce a fourth-garden name without an explicit new selection decision.** | User correction 2026-07-18, on review of the doc-consolidation pass; candidate name scrubbed from every tracked artifact 2026-07-19, after it was found stated in the same sentence as the rule forbidding it. |

### Full decision register (2026-07-03 alignment session, entries 1–27; dated addenda 28–39)

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
18. Rewards: declared reward reference plus operator-executed payout plus rewardPaid event; the module never custodies funds; zero CookieJar changes.
19. Claim mode per commitment: open-claim or approval-gated, set at seeding; protocol pool defaults approval-gated, garden campaigns default open-claim.
20. Meta evidence: lightweight evidence object (IPFS CID via module event, offline-queueable) for SupportService/OperatorCaptured; direction-aware eligible-party confirmation is the review and Not yet raises a dispute; DomainImpact keeps the full MDR path.
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
32. Architecture closure (updated 2026-07-10): optional multi-domain Need/Commitment scope, complete creation events, direction-aware confirmation with provider exclusion, stored claim-request terms, pre-dispute restoration, one open Season plus concurrent Campaigns, provider/action-matched DomainImpact Work, reward-bound G$ queue, mandatory Functions receipt verification, immutable 24-member batch cap, and exact pilot 2-of-3 Safe recovery are part of the initial implementation contract.
33. External alignment: the Google Doc is the single source of truth for external prose; `external-brief.md` is a pointer and engineering-source map only. Repo specs, evidence records, prototypes, and visual assets substantiate the narrative without mirroring it. GoodDollar settlement is on Celo, no G$ bridges to Arbitrum, and the designated Green Goods topology receives Foundation-funded House of Alignment pilot funds directly in the GG protocol Safe on Celo once partner mechanism/address evidence clears (funding correction confirmed 2026-07-21).
34. Product-review decisions (2026-07-11 storyboard review; storyboards + gap evidence in `prototypes.md`): (a) pool **open/close controls live on the admin Pool status card** (adopts MF-1; the open-cycle flow gains only a "pool is Ready — open it now?" guard prompt, closing the Ready→Open deadlock); (b) **members get a pre-acceptance withdraw** control on commitment detail (adopts MF-2a; steward-cancel placement remains open); (c) **`waiting_for_hat` covers the five pool job kinds in August** — pre-flight membership check before the first send attempt, no retries consumed, membership event resumes the jobs (adopts MF-5); (d) **expiry runs both paths, sequenced**: admin expiry queue + member "offer again" band ship in the August release (adopts MF-3/MF-4); a permissionless keeper cron is a post-release ops backstop, not part of the July build; (e) **pilot operators are the stewards and hold the settlement executor role** — never a Safe owner and never one of the 2-of-3 recovery owners (settlement-spec no-overlap check); W22 needs only a missing-role guard state, not a role-split UI; (f) **W21 + the `/community` Pools view gain a read-only member-delivery gate status row** (enabled/disabled · changed by · date · evidence ref); the owner-only flip stays ops; (g) **testimony is September-realized** (resolves MF-12; no August client frame; external copy must not imply August testimony); (h) the **dry run rehearses S13 with a real minimal Cookie Jar withdrawal**, payoutRef captured via `recordRewardPaid` (jar config + Gardener-Hat prerequisites per corrections-log H7).
35. Garden join-request queue (direction locked; canonical design: `../community-interface/join-queue-spec.md`): the **Community Needs & Signals** hub owns the small agent-backed request service, its personal-data rules, and RESR-64 operating gate. Commitment Pooling is only a consumer: a closed-garden request is signed by the passkey account and, after an operator uses the existing gardener-add path, observed membership is the `waiting_for_hat` flush event for the five pool job kinds. The API remains conveyance only; if unavailable, operators add addresses manually. No protocol admin key ever, and `openJoining` self-join remains unchanged.
36. Hi-fi prototype artifact (2026-07-18, Afo): the flow-prototypes artifact upgrades **in place** from lo-fi ASCII frames to high-fidelity Warm Earth screen renders with per-screen state matrices (Storybook-style state switcher) — full August scope (client PWA + admin + editorial), complete state coverage per uiux-spec §4–§7; September C-frames stay labeled lo-fi previews (they belong to the community-interface plan). Supersedes **Decision Log #13**'s lo-fi-on-purpose policy **for this artifact only** (not register #13, which is about docs staleness) — `wireframes.md` itself stays lo-fi and remains the structural truth; the artifact still adds no design authority beyond the specs and design-skill tokens it renders. Executes audit follow-up 5 (hi-fi pass over the revised pool surfaces). Build machinery decomposed into `hifi/` modules with state-aware validation: journey refs, hotspot-id integrity, per-state render checks, and banned-vocabulary / steward-rule / quiet-admin / chain-placement scans over rendered copy (hard-fail on hi-fi renders, warn-only on remaining ascii). Same entrypoint, same artifact URL, same citation discipline.
37. Thin lane mirror + four-phase milestones (2026-07-20, Afo): **supersedes register #31; dispatch state amended by register #39 and phase dates superseded by register #40.** Linear's issue cap was lifted, so the footprint constraint behind parent-only no longer applies. Each execution sub-lane now has a **thin** Linear issue: ~3 lines plus a handoff link. **Linear owns status, dates, assignee and dependencies; this hub owns content.** Lane bodies must not restate handoff scope — that is the drift failure parent-only was protecting against, and it stays banned. New lane issues (children of `PRD-650` unless noted): `contracts` PRD-721 · `indexer` PRD-722 · `state_api` PRD-723 · `ui_client` PRD-724 · `ui_admin` PRD-725 · `editorial` PRD-726 · `docs` PRD-727 · `docs_guides` PRD-728 · `qa_pass_1` PRD-729 · `qa_pass_2` PRD-730 · `release_ops` PRD-731 (no parent; Release milestone). This also reverses the "no QA child issue is created" rule in `claude-qa-pass-1.md` and `codex-qa-pass-2.md`. `settlement` keeps PRD-686, retitled to *settlement implementation* now that `release_ops` is separately tracked. Gap issues filed the same day: PRD-732 (cycle 1 opens — Track B step 8, previously untracked in any of issue/lane/handoff), PRD-733 (recovery multisig Celo address + HoA receiving evidence — release-blocking, audit follow-up #4), PRD-734 (G$-for-protocol-services with GoodDollar — audit follow-up #6). Historical date model recorded here was **Scope and Design** (2026-07-31) → **Build** (2026-08-12) → **Release** (undated) → **Follow On / Hardening** (2026-12-31); register #40 replaces it with the current dates, while register #39 keeps the July dry run separate rather than absorbed. **Dispatch-safety convention** (adopted from PRD-686's "Backlog coordination only. Remove all `agent:*` labels/delegation"): a lane issue carries an `agent:*` label **only while its lane is `ready`**. Register #39's Wave 1 freeze blocks Docs until source convergence; only independently re-audited lanes may regain a label.
38. Tiered broadcast (2026-07-20, Afo): **the audit / 48-hour-timelock / two-week-testnet gate applies to the value tier only.** `SettlementModule` and the per-garden Celo Safes keep it in full. The **pooling module, `CommitmentRegister` and the two EAS schemas broadcast to Arbitrum mainnet during Build**, under a narrower gate: full test suite, deploy dry-run, post-deploy verification, and a proven upgrade/rollback path. Basis: `human-release-ops.md` Phase 2 already separates "module/register deployment and upgrades" from "settlement deployment only when its gates pass", and the module **never holds funds** while the register is **non-transferable** — so the value-protecting gates protect nothing at this tier. Scope of the exception, stated narrowly: it changes *which artifacts* skip those three inputs. It does **not** relax Phase 3 post-broadcast checks, does not waive the Bun test/dry-run evidence, and grants **no agent broadcast authority** — Afo authorizes, as before. **If the pooling module ever gains custody or the register becomes transferable, this exception lapses** and those artifacts rejoin the value tier. Applied to the Release milestone and `human-release-ops.md` § Inputs the same day. Residual risk accepted knowingly: these are unaudited UUPS-upgradeable contracts on mainnet, so upgrade authority and access control carry the weight the audit would otherwise have carried.
39. Audit reconciliation scope lock (2026-07-20, Afo): execute CP-AUD-001–021 in two waves without product implementation or broadcast. Allocation is supplied only to `openCycle(cycleId, AllocationBps allocation)`; `seedCycle` has none. Baseline stays an app/shared/admin preflight, while the onchain Ready predicate remains charter plus non-zero exposure cap. DomainImpact uses positional per-action arrays, `requirementIndex`, per-action progress, and the weighted approved-unit formula. `/community/pools` is Protocol plus current garden; all-garden oversight and batch/oracle operations stay deployer-gated Operations. W6 is retired except for W6→W5 compatibility. Native phases are Scope and Design / Build / Release / Follow On-Hardening; July and September remain separately labeled operational checkpoints. Execution sub-lanes become first-class Linear mirrors, QA stays on canonical QA lanes, `release_ops` is parentless, and `agent:*` labels exist only for ready agent-owned lanes. A new human-owned blocked `settlement_evidence` lane is due September 30 under PRD-650 and receives no agent label until sources, privacy, thresholds, and package are locked. Public closure requires per-action Built/Planned roles, four phases plus checkpoints, September-only testimony, all six GE functions, 2× visual pairs, live Linear and Google Doc rereads, primary-source verification, and confidential human confirmation that the undisclosed fourth-garden candidate name is absent. Unavailable external access is a blocker, never convergence proof. This entry preserves register #38's narrow Build-tier broadcast exception and adds no implementation or broadcast authority.
40. Phase-date correction (2026-07-20, Afo): **supersedes only the phase dates in register #37 and the date-neutral wording in register #39.** Scope and Design closes with this reconciliation on **2026-07-20**; Build closes **2026-07-31** after the two-week implementation window; Release is **2026-08-12**; Follow On / Hardening remains **2026-12-31**. The July dry run (**2026-07-31**) and Community plus settlement-evidence delivery (**2026-09-30**) remain separately labeled operational checkpoints. The August 12 release target grants no agent or automatic broadcast authority, does not weaken register #38's tier-specific gates, and does not turn a blocked value-tier artifact into an authorized release.
41. Build-to-Release broadcast correction (2026-07-20, Afo): **supersedes register #38 only on calendar-phase timing and supersedes the Build-broadcast preservation clauses in registers #39-40.** Build closes **2026-07-31** with implementation, QA, full tests, dry-runs, post-deploy verification readiness, and upgrade/rollback proof; **nothing broadcasts during Build**. The pooling module, `CommitmentRegister`, and two EAS schemas retain register #38's narrower non-value-tier evidence gate because they are non-custodial/non-transferable, but any mainnet broadcast is a separately authorized **Release** action on or after **2026-08-12**. `SettlementModule` and per-garden Celo Safes retain the full value-tier gate. This timing correction grants no agent authority and leaves both tiers blocked until their own human authorization exists.
42. Broadcast tiering restored (2026-07-20, Afo): **supersedes register #41's “nothing broadcasts during Build” clause and restores register #38's July timing.** The non-value tier — `CommitmentPoolingModule`, non-transferable `CommitmentRegister`, and the two EAS schemas — broadcasts during Build by **2026-07-31** under its narrower gate: full tests, deploy dry-run, post-deploy verification, proven upgrade/rollback, and explicit human authorization. The value tier — `SettlementModule` and per-garden Celo Safes — remains a separately authorized Release action on or after **2026-08-12** under the full audit, timelock, testnet, Safe/Functions/AA, rollback, and live-exit gate. No agent self-authorizes any broadcast; the non-value exception lapses if custody or transferability is introduced.
43. Scope and Design date correction (2026-07-20, Afo): **supersedes register #40 only for the Scope and Design date.** Scope and Design closes Wednesday, **2026-07-22**. Build remains **2026-07-31**, Release remains **2026-08-12**, Follow On / Hardening remains **2026-12-31**, and the July 31 and September 30 operational checkpoints remain separate from the four native phases.
44. Follow On / Hardening date correction (2026-07-21, Afo): **supersedes registers #40 and #43 only for the Follow On / Hardening date.** Follow On / Hardening closes **2026-09-30**, alongside but distinct from the Community plus settlement-evidence operational checkpoint. Scope and Design remains **2026-07-22**, Build remains **2026-07-31**, Release remains **2026-08-12**, and the July 31 dry run remains an operational checkpoint. Co-dated September closures are parallel evidence decisions, not a false sequential dependency and not implementation or broadcast authority.

## Research / Plan Gate

- [x] Research evidence recorded: `reports/corrections-log.md` (every Document A repo claim verified, corrected, or superseded, with file paths)
- [x] Existing repo patterns identified: CookieJar.sol module template, badge-schemas standalone registration, greenWill/hypercerts handler patterns, SubmitWork analog capture, WalletDrawer pools tab
- [x] Human judgment points surfaced and decided: 27 alignment decisions (2026-07-03), approved Linear change set (2026-07-04), and all 22 readiness findings scope-locked (2026-07-10)
- [x] Out of scope defined: no bridged G$, bridge custody/unbounded value authority, Sarafu integration, transferable settlement vouchers, indexed Celo/G$ transfers, garden-to-garden federation, leaderboards, or public credit scores; no commitment EAS schema; no claim flow in the community interface v1
- [x] Lightest honest validation chosen per lane (see Validation)
- [x] Design coverage audit completed 2026-07-10; the corrected 20-asset matrix and semantic updates are tracked in `diagrams.md` and `wireframes.md` and must parse before implementation handoff.
- [x] Settlement scoping landed 2026-07-04: `settlement-spec.md` (SettlementModule, Safe topology, member receipt, multi-chain tiers, failure states) + diagrams D8–D10 + [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686)
- [x] Settlement trust model tightened 2026-07-10: commitment-bound rewards; two derived funding routes; persisted reporter; mandatory Functions-only Reported → Verified transition; 1–24 immutable batches with per-member recovery; non-owner scoped executors; exact pilot 2-of-3 recovery; member delivery blocked unless AA proof passes.

## Requirements Coverage

The **Lane** column below names execution sub-lanes for planning clarity. The harness-facing machine lanes in `status.json` are only `contracts`, `state_api`, `ui`, `qa_pass_1`, and `qa_pass_2`.

| Requirement | Lane | Linear issue | Status |
|---|---|---|---|
| Assessment v3 + community testimony schemas + resolvers (first PR chain) | `contracts` | [PRD-671](https://linear.app/greenpill-dev-guild/issue/PRD-671) | ⏳ |
| CommitmentPoolingModule + CommitmentRegister + GardenToken wiring + deploy | `contracts` | [PRD-672](https://linear.app/greenpill-dev-guild/issue/PRD-672) | ⏳ |
| Indexer entities, handlers, four locked stats, bundleKind | `indexer` | [PRD-673](https://linear.app/greenpill-dev-guild/issue/PRD-673) | ⏳ |
| Shared substrate: types, hooks, queryKeys.pools, five offline queue kinds, AA-gated online wallet transfer, lightweight evidence, v3 workflow, settlement selectors | `state_api` | [PRD-674](https://linear.app/greenpill-dev-guild/issue/PRD-674) | ⏳ |
| Client PWA: Garden tab pool flows, WalletDrawer panel, hero moments | `ui_client` | [PRD-675](https://linear.app/greenpill-dev-guild/issue/PRD-675) | ⏳ |
| Admin: Garden workspace pool console (cycles, seeding, claims, analog capture, assessment v3) | `ui_admin` | [PRD-676](https://linear.app/greenpill-dev-guild/issue/PRD-676) | ⏳ |
| Admin: Community workspace Pools mode + Hub confirmation queue | `ui_admin` | [PRD-677](https://linear.app/greenpill-dev-guild/issue/PRD-677) | ⏳ |
| Editorial: GardenDialog pool story + /impact aggregates | `editorial` | [PRD-678](https://linear.app/greenpill-dev-guild/issue/PRD-678) | ⏳ |
| Hypercert cut-over: fulfilled-commitment bundling + allocation presets (split ownership: shared metadata composer + selectors = `state_api`; `bundleKind`/`commitmentIds`/`needUIDs` entity fields = `indexer`; allocation step UI = `ui_admin`) | `state_api` + `ui_admin` | [PRD-679](https://linear.app/greenpill-dev-guild/issue/PRD-679) | ⏳ |
| G$ split-state settlement: SettlementModule + Celo Safes + multi-chain app | `settlement` | [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686) | ⏳ |
| Docs: glossary + architecture freshness | `docs` | [PRD-680](https://linear.app/greenpill-dev-guild/issue/PRD-680) | ⏳ |
| Docs: operator seeding guide + gardener promises guide | `docs_guides` | [PRD-681](https://linear.app/greenpill-dev-guild/issue/PRD-681) | ⏳ |
| External brief, audience notes, GTM/community rollout, and factual review | `docs` + `july_dry_run` | [RESR-57](https://linear.app/greenpill-dev-guild/issue/RESR-57), [RESR-58](https://linear.app/greenpill-dev-guild/issue/RESR-58), [COM-3](https://linear.app/greenpill-dev-guild/issue/COM-3) | ⏳ |
| July: methodology/metrics pulse (proto-commitment #1; RESR-53 canceled 2026-07-06, folded into the unified instrument) | `july_dry_run` | [RESR-62](https://linear.app/greenpill-dev-guild/issue/RESR-62) | ⏳ |
| July: commitment-scoping surveys + mandate artifacts (gates August seeding) | `july_dry_run` | [RESR-62](https://linear.app/greenpill-dev-guild/issue/RESR-62) | ⏳ |
| July: activations + proto-commitment loops (TAS) | `july_dry_run` | [RESR-62](https://linear.app/greenpill-dev-guild/issue/RESR-62) (historical label: canceled RESR-63) | ⏳ |
| July: pilot cohort readiness | `july_dry_run` | [COM-7](https://linear.app/greenpill-dev-guild/issue/COM-7) + [COM-3](https://linear.app/greenpill-dev-guild/issue/COM-3) (historical labels: RESR-62, PRD-701; canceled RESR-13) | ⏳ |
| September: independent packages/community PWA after shared-foundation extraction | `community` | [PRD-682](https://linear.app/greenpill-dev-guild/issue/PRD-682) | ⏳ |
| September: Community Need intake into the commitment-seeding gate | `ui_admin` | [PRD-691](https://linear.app/greenpill-dev-guild/issue/PRD-691) + Community admin handoff (historical label: canceled PRD-683) | ⏳ |
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

### Track B: Build phase (the hard implementation commitment)

Sequencing (dependency order is contracts -> indexer/shared -> client/admin/docs; PRD-673 freezes the entity/query contract early while PRD-674 builds only interface-independent shared foundations, and shared GREEN waits for indexer codegen/query proof):

1. [ ] PRD-671 schemas PR chain (independent; lands first so baselines exist before cycle 1)
2. [ ] PRD-672 module + register + wiring (parallel with PRD-671 after interface freeze)
3. [ ] PRD-673 indexer starts from PRD-672's frozen events, freezes entity/query ownership for PRD-674, adds Envio block-preservation proof, migrates Garden IDs to `chainId-address`, keeps audit actor nullable unless explicit, and completes codegen/build before downstream GREEN
4. [ ] PRD-674 shared substrate starts from PRD-672 interfaces in parallel where safe; final GREEN requires the PRD-673 generated entity/query contract and composite-ID cutover proof; blocks all app lanes
5. [ ] In parallel after PRD-674: PRD-675 client, PRD-676 admin Garden, PRD-677 admin Community Pools mode, PRD-678 editorial, PRD-679 Hypercert cut-over
6. [ ] PRD-680 docs (`docs`) can start any time; PRD-681 screenshot guides (`docs_guides`) stay blocked until client/admin settlement surfaces exist
7. [ ] Human-authorized tiered broadcast step (`handoffs/human-release-ops.md`): by July 31, the pooling module/register/two schemas complete full tests, dry-runs, post-deploy verification, and upgrade/rollback proof, then broadcast during Build only with explicit human authorization under the narrower non-custodial/non-transferable gate. SettlementModule/Safes remain blocked until the August 12 Release phase and their audit, timelock, two-week testnet, Safe/Functions/AA evidence, live value proof, and separate authorization are complete. Verify artifact addresses, indexer config, schema UIDs, replay switch, and rollback for every authorized tier
8. [ ] Cycle 1 opens: operator-curated seeding from the July mandate artifacts
9. [ ] PRD-686 settlement implementation (PR chain 2.5, due 2026-07-29): after PRD-672 interface freeze and the pre-dispatch external inputs, freeze exact events/storage, build deterministic 2-of-3 Safe tooling, scoped Roles + Allowance, immutable 1–24 batches, per-member reconciliation, pinned Functions v1.3 callback, and Reported/checking/Verified selectors. Generated storage/mock/dry-run evidence is an implementation output, not a circular dispatch prerequisite
10. [ ] Human-owned settlement exit proof (`handoffs/human-release-ops.md`): first real G$ reward derived from a Fulfilled commitment, queued on Arbitrum, executed from the registered provider-garden Safe on Celo, reported, verified by the current Functions callback against finalized receipt logs, and visible as “support arrived”; AA failure blocks this member leg but not the protocol → garden funding route
11. [ ] Credit follow-on remains blocked unless explicitly unblocked after pooling + settlement interfaces freeze

### Track C: September community interface

- [ ] PRD-682 shared-foundation extraction, then independent `packages/community` scaffold at `community.greengoods.app` / local port 3010 (after PRD-674 substrate; canonical artifacts in `.plans/active/community-interface/`)
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

### Contracts (`codex/contracts/commitment-pooling`): PRD-671, PRD-672

- [ ] Contract logic and tests per `contract-spec.md`; bun wrappers only, never raw forge
- [ ] Respect deployment ordering, storage-layout baselines, and upgrade safety (GardenToken gap 37 to 36)
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/codex-contracts.md`
- [x] Planning readiness: exact handoff present; this is the only core implementation sub-lane marked Ready in `status.json`

### Settlement (`codex/settlement/commitment-pooling`): PRD-686

- [ ] `SettlementModule` + tests per `settlement-spec.md` §3; zero changes to the pooling module or register; bun wrappers only
- [ ] Pre-dispatch inputs recorded in the handoff: Functions router/subscription/DON/callback gas/direct `@chainlink/contracts@1.5.0` v1.3 import/secrets reference + finalized receipt fixture; Celo AA outcome; GoodDollar written confirmations; exact 2-of-3 Safe owner roles and scoped non-owner Roles/Allowance selectors/caps
- [ ] Bridge-executor automation may be attempted as an August stretch if the base path is stable; it is not required for the base exit proof
- [ ] Immutable 1–24 batches, per-member failed-attempt recovery, Functions-only verification, exact indexer entities/events, shared multi-chain selectors, admin execution/checking states, and AA-gated PWA member delivery per settlement-spec
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/codex-settlement.md`
- [ ] Keep settlement manually blocked until the frozen interface and pre-dispatch Functions, GoodDollar, Safe, receipt-fixture, and AA-outcome inputs are recorded. Implementation GREEN produces storage/mock/dry-run proof; live broadcast/exit proof remains human-owned. No manual oracle substitute

### Indexer (`codex/indexer/commitment-pooling`): PRD-673

- [ ] Entities, handlers, stats per the spec's fenced definitions; Envio regeneration preserves all new blocks; Garden IDs are `chainId-address` after full replay/cutover; generic audit actor stays nullable unless explicit; `bun codegen` clean
- [ ] Record RED/GREEN proof (scripted event-sequence test) before marking complete
- [ ] Write `handoffs/codex-indexer.md`
- [ ] Dispatch core indexing when pooling events freeze; hold only settlement handlers for settlement event freeze. Record snapshot, switch criterion, rollback package, and Afolabi Aiyeloja as accountable live-cutover owner

### State / API (`codex/state-api/commitment-pooling`): PRD-674, PRD-679 (shared half)

- [ ] Hooks, stores, query keys, five offline queue kinds (`commitment`, `claim`, `evidence`, `workLink`, `confirmation`) plus an online-only wallet `transfer` capability that remains disabled unless the AA gate passes; hooks stay in shared
- [ ] Dispatch core state/API after pooling interfaces and core indexer codegen/build; hold settlement selectors until settlement indexer GREEN. Do not record aggregate full `state-api` GREEN while the settlement phase is outstanding
- [ ] Record RED/GREEN proof before marking complete
- [ ] Write `handoffs/codex-state-api.md`

### Credit Follow-on (`codex/credit/commitment-pooling`): blocked; tracked as PRD-697 (Follow On / Hardening, parked — authorizes no implementation)

- [ ] Do not implement without an explicit unblock; `../../backlog/commitment-credit-follow-on/spec.md` is design truth only
- [ ] Depends on PRD-672/686 interface stability and the settlement-side loan-disbursement seam
- [ ] When unblocked: `CreditRegister` + indexer + shared `queryKeys.credit.*` + `credit` job kind + admin/PWA credit surfaces
- [ ] Write `../../backlog/commitment-credit-follow-on/handoffs/codex-contracts.md`

### UI Client (`claude/ui-client/commitment-pooling`): PRD-675

- [ ] Client tasks only; i18n en/es/pt for every new string; hero moments per spec
- [ ] Record RED/GREEN proof or a proof-limit note
- [ ] Write `handoffs/claude-ui-client.md`

### UI Admin (`claude/ui-admin/commitment-pooling`): historical labels PRD-676, PRD-677, and PRD-679 (admin half)

- [ ] Admin tasks only; AdminDialog anatomy (side sheets retired); i18n; Storybook coverage
- [ ] Canceled PRD-683 is not part of this executable lane; Community seeding intake is owned by PRD-691 and `.plans/active/community-interface/handoffs/claude-ui-admin.md`
- [ ] Record RED/GREEN proof or a proof-limit note
- [ ] Write `handoffs/claude-ui-admin.md`

### Editorial (`claude/editorial/commitment-pooling`): PRD-678

- [ ] Public surfaces only; aggregate-only data; small-community thresholds
- [ ] Write `handoffs/claude-editorial.md`

### Docs glossary + architecture freshness (`claude/docs/commitment-pooling`): PRD-680

- [ ] Glossary anchors preserved; vocab lint green
- [ ] Write `handoffs/claude-docs.md`

### Docs operator/gardener guides (`claude/docs-guides/commitment-pooling`): PRD-681

- [ ] Wait for shipped client/admin settlement surfaces before screenshot capture
- [ ] Write `handoffs/claude-docs-guides.md`

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

- [ ] Afolabi Aiyeloja records named owners for audit, GoodDollar, Functions, protocol multisig/timelock, garden Safe recovery, two-week testnet operation, Garden-ID replay/rollback, broadcast, and live Celo exit proof
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
2. **PRD-680 docs-promotion appendix refresh**: diagrams.md §Appendix already lists the ship-time docs edits; re-check after the audit-response restructure (D6 acts, D13 matrix, CommitmentRequirement entity).
3. ~~**Linear re-apply pass**~~ — ✅ **DONE 2026-07-19.** The corrected wording was applied live to PRD-686, the project description, RESR-57, RESR-58 and the Pool Identity companion; the archived packs keep their original text as provenance (they are frozen records of what was applied on 2026-07-11, not current guidance). Still outstanding on the Linear side: the canonical synthesis's two sentence-edits (see #9) and the G$-on-Arbitrum correction to PRD-649 + the Lifecycle companion (`reports/corrections-log.md` §9e).
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
9. **Linear docs 1, 2, 9, 10 still need their corrections applied.** Docs 1 and 10 carry **embedded Linear-hosted images** that a wholesale content replacement would delete — now that their Google Doc tabs exist, stub them instead. Doc 9 must keep Part D. **Doc 2 (canonical synthesis, 72k chars) needs exactly two edits**, and the same two apply to Google Doc tab 02:
   - **§2.7, rail 4** — replace `down through a Dev-Guild working-capital Safe and the GG protocol Safe to each garden's Safe` with `directly into the GG protocol Safe and from there to each garden's Safe`.
   - **Change Log, Pass-4 row V** — do **not** rewrite it (it is accurate as history). Append to the end of the row: `**Superseded 2026-07-18**: the working-capital hop was retired — the House of Alignment stream now lands directly in the GG protocol Safe. See reports/corrections-log.md §9.`

   These are hand edits by design: a 72k-character document cannot be safely regenerated through the MCP write path, and a two-sentence change in an editor carries none of that risk.

## Boundary

No implementation code starts from this plan without Afo dispatching the specific lane or handoff. G$ split-state settlement is Build-phase scope via [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686) (`settlement-spec.md`, Decision Log #14), targeting the 2026-08-12 Release, and remains manually blocked on the pooling interface, mandatory Functions proof, GoodDollar/Safe configuration, and AA outcome. The date waives no gate. SettlementModule, per-garden Celo Safes, the ProtocolToGarden funding route, and oracle-backed status reads may proceed when their gates pass; commitment-reward delivery and member sends remain disabled unless the AA gate passes. Bridge-executor automation belongs to Follow On / Hardening only. Still out of scope for every lane: bridged G$ (never), bridge custody/unbounded value authority, Sarafu integration, transferable settlement vouchers and `settlementAdapter`/`settlementEnabled` activation (PRD-651), indexing Celo/G$ transfers, garden-to-garden federation, leaderboards, and public credit scores. Borrow-and-repay `CreditRegister` is a blocked follow-on lane; no implementation without a new scope lock.
