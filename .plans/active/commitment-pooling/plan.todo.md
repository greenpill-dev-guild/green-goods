# Commitment Pooling Plan

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Status**: `ACTIVE: all readiness findings scope-locked 2026-07-10; core contracts ready to dispatch; settlement and downstream lanes retain named gates`
**Created**: `2026-07-03`
**Last Updated**: `2026-07-18`

Linear mirror: project [Commitment Pooling](https://linear.app/greenpill-dev-guild/project/commitment-pooling-4bc53572f354). Milestones: July dry run (2026-07-31), August release (2026-08-31), September community interface (2026-09-30). Product implementation cadence: Q3 July — Commitment Pooling (2026-07-16 through 2026-07-30). Research alignment cadence: Q3 July — Methodologies & Commitments Alignment (through 2026-07-30). Specs in this folder: `corrections-log.md`, `contract-spec.md`, `uiux-spec.md`, `settlement-spec.md`, `credit-spec.md` (blocked follow-on), `diagrams.md`, `wireframes.md`, `acceptance-matrix.md`, `external-communications.md`, `external-brief.md` and its indexed companion graphics. `handoffs/human-release-ops.md` owns broadcast/cutover/live-exit authorization and evidence. `linear-update-pack.md` and `linear-apply-pack.md` are applied archives, not executable instructions. Community-specific diagrams, wireframes, journeys, and research operations live in `.plans/active/community-interface/`. The 2026-07-10/11 reconciliation, PRD-686/RESR-57 predicate, and null PRD-651/697 dates were live-verified. Fourth-garden naming policy resolved 2026-07-11 (decision #27): the live Linear r4 named-cohort state stands with the selection-is-not-participation guardrail, repo artifacts align to it, and the earlier same-day "naming regression" classification is retracted; the RESR-57 issue-body cohort line and PRD-686's release-ops boundary sentence were saved and live-re-read to close convergence.

> **Linear consolidation (2026-07-05).** To keep Linear minimal, the per-lane workstream issues were closed into a small set of parent **trackers**; **this plan is the lane-level execution truth**. Trackers: **PRD-650** August proof MVP (absorbs PRD-671→681), **PRD-686** G$ split-state settlement, **PRD-682** September community interface (absorbs PRD-683), **RESR-62** July dry run (absorbs RESR-63 + RESR-13; RESR-53 stays in Impact Framework). Needs-layer trackers **PRD-687** substrate (absorbs PRD-688/689/690) and **PRD-691** app (absorbs PRD-692/693/694) live in the **Community Needs & Signals** project. Kept as-is: **PRD-649** (architecture record), **PRD-651** (deferred transferable settlement vouchers), research records **RESR-57/58/64**, parked **PRD-695/696**, and the linked-research issues **RESR-15/RESR-4/PRD-275**. The per-lane `PRD-6xx` / `RESR-xx` IDs in the tables below are **historical labels** for the closed child issues — dispatch reads the lanes here and rolls up to the parent tracker, not to those closed IDs.

## Decision Log

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
| 18 | Borrow-and-repay becomes a blocked follow-on lane: `CreditRegister` is designed in `credit-spec.md`, but it is not part of the August base MVP and is not dispatchable without an explicit unblock | User decision 2026-07-06; keeps GE mutual-credit design visible without expanding the hard August commitment. |
| 19 | `status.json` uses only plan-hub canonical machine lanes (`contracts`, `state_api`, `ui`, `qa_pass_1`, `qa_pass_2`); detailed workstreams remain as `execution_sub_lanes` and this checklist | Keeps `node scripts/harness/plan-hub.mjs validate`, `list`, and `record-tdd` usable without losing the Codex/Claude sub-lane breakdown. |
| 20 | Linear sync is explicit parent-only for this hub (`linear.laneSyncMode = parent_only`) | Preserves the low-noise Linear footprint and avoids using PRD-650 as fake lane issue IDs; lane-level execution truth stays in `.plans` and handoffs. |
| 21 | Commitment domain scope is optional and multi-valued. `domains[]` + positional `requiredActionUIDs[]` replace singular domain/action fields; DomainImpact alone requires 1–4 registered action/domain pairs. UID `0` is valid; array presence is the binding signal. `CommitmentCreated` emits all immutable creation facts, and approval-gated claims use a commitment-keyed companion index for deterministic decline/accept/supersede handling. | User alignment + regression review 2026-07-09; aligns the spec with the live ActionRegistry allocator and Envio's current ID-first handler API. |
| 22 | G$ reward queues derive source/recipient/token/amount from the fulfilled commitment. The funding route is exactly ProtocolToGarden with no address/token overrides. Reports persist `reportedBy`; a mandatory Chainlink Functions callback checks finalized receipt/source/token/log coverage and is the only path to Verified or receipt-invalid Failed. Batches hold 1–24 immutable members and reconcile failed members individually. | User alignment + regression review through 2026-07-10; closes arbitrary routes, manual assertions, unbounded batches, and unrecoverable batch membership. |
| 23 | Pilot focus cohort named: operational artifacts (RESR-58 scenarios, RESR-62 survey, July tracking doc, PRD-701 onboarding) carry only Tech and Sun Hub (Awka, Nigeria), Greenpill Cape Town (Muizenberg / Deep South Circles), AgroforestDAO / Redemption Hill (Bias Fortes, Brazil), plus one TBD mature MRV-adoption garden selected via parallel deep research; other synthesis gardens stay narrative context. RESR-58's document is garden-first (journeys as the coherence layer, mechanism scenarios as the normative appendix, new S11 institutional-partner and S12 MRV-adoption scenarios); UNICEF is modeled as an off-platform partner (exports + receipt-checked FundingAttribution, no account or confirmation role). Naming a candidate never presumes readiness. | User alignment Q&A 2026-07-10; RESR-53 was canceled 2026-07-06 and folded into RESR-62's unified instrument. |
| 24 | July operator cadence and settlement breadth aligned: PRD-701 moves to due 2026-07-30 (operator engagement lands with RESR-62's window; the 2026-07-31 dry-run milestone holds; the 07-16 Product-cycle boundary stays a cycle fact, with outreach expectations only). Every focus garden is G$-settlement-capable in August (one Celo Safe per garden, on demand); Tech and Sun Hub is the first-execution hypothesis and Pass-2 evidence orders the rollout — supersedes the derivative-level "single Pass-2-confirmed garden, sink-first" wording (the settlement lane was always per-garden; no gate, ABI, or acceptance change). TAS is the single Awka hub today (multi-hub stays roadmap/vision). UNICEF is a funded program for Greenpill Cape Town's waste work (partner stays off-platform; Pass 1 captures reporting cadence/deadline and funding path). | User alignment Q&A 2026-07-11 (plan-mode session); settlement-spec.md and codex-settlement handoff grep-verified free of single-garden assumptions. |
| 25 | Garden 4 selected: **Barichara Regenerativa** (Barichara, Santander, Colombia; agroforestry; the mature MRV-adoption anchor — owns the B4/S12 journey, and the es locale proof rides B4). Slotted into RESR-58 Part A/B4 and the reward-path matrix, the July tracking rows, RESR-62/PRD-701/RESR-57 cohort lines, and the external-brief cohort. Pass 1 verifies the five selection criteria as evidence, not assumption. | User selection 2026-07-11 (read out in session; supersedes the deep-research TBD slot). |
| 26 | Fourth-garden hold: the #25 selection is NOT presented until first contact is made. All presentation-facing and operational artifacts (RESR-58 doc/issue, RESR-62, PRD-701, RESR-57, July tracking doc, external brief, rollout plan, research-plan) carry an anonymous "fourth garden — in outreach, named only once participation is confirmed" slot with the selection criteria retained; the outreach target's name lives only in this decision log and internal notes. The three named gardens alone cover all four action domains, so the four-domain claim stands. In the same pass, the RESR-58 document was reformatted (audience-entry table, TOC, terms box, role legend, per-journey template, S-style headings, bulleted Part D) and strengthened per the 25-finding audit — including new S13 (declared reward → RewardPaid, the only July reward rail) and S14 (protocol pool + cross-garden claim, the dry run's mechanism), "campaign cycle" disambiguation per contract-spec's own rule, and bidirectional B↔S cross-references. | User decisions 2026-07-11 (second plan-mode session): present only what is accurate; audit findings L1–L8 / C1–C8 / G1–G9. |
| 27 | Fourth-garden naming stands (supersedes #26's hold): **Barichara Regenerativa** is named across coordination and presentation artifacts with the **"selection is not participation"** guardrail — no external claim states Barichara participates until its corrected mandate is confirmed (RESR-62 evidence; naming never presumes readiness). The live Linear r4 pass of 2026-07-11 afternoon (RESR-58 doc r4 + issue, RESR-62, survey + Pass-2 call docs, external brief, rollout plan, manually uploaded companion graphics) is the canonical presentation state; repo artifacts align to it, and the same-day "naming regression" classification is retracted. | User decision 2026-07-11 (confirmed during the commit/reconciliation session after evidence review of the r4 pass). |
| 28 | Visual-asset audit decisions: (a) per-action required counts — `requiredApprovedWorkCounts[]`/`approvedWorkCounts[]` positional with `requiredActionUIDs`, ReadyForConfirmation requires every requirement met, `approvedUnits = floor(targetUnits × Σ min(approved, required) / Σ required)`, `ApprovedWorkCounted` gains `requirementIndex`, indexer gains `CommitmentRequirement` (contract-spec amendment 2026-07-18); (b) fund topology corrected — HoA stream lands directly in the GG protocol Safe, single ProtocolToGarden route (#15 updated); (c) **Garden Steward** is the standardized CP role name (steward = operator/owner Hats; app-wide rename is a follow-up); (d) W22 batch/oracle console moves to a NEW deployer-gated admin **Operations** workspace; (e) pool-surface history = per-view filter chips, no History stage; (f) W6 home summary card retired — WalletDrawer Commitments tab header is the only promises summary. | User visual-asset audit, three AskUserQuestion rounds, 2026-07-18 (corrections-log §9–10). |

### Full decision register (2026-07-03 alignment session, 27 decisions)

1. Spec home: all artifacts in `.plans/active/commitment-pooling/`; no docs-site promotion.
2. Linear issue depth: workstream-sized issues, one per package workstream per track.
3. Community interface: NEW package `packages/community` (independent PWA at `community.greengoods.app`, local port 3010, three tabs, Passkey). It consumes extracted generic runtime/auth/offline/install/update/error/shell foundations while retaining its own routes, navigation, manifest, service-worker scope, telemetry identity, and copy.
4. Git ending: conventional commits on the session branch plus a PR to develop.
5. EAS bridge: WorkApprovalResolver hook (try/catch, non-blocking) plus operator `syncApprovedWork` fallback.
6. State weight: hybrid; hard transitions on-chain (seed, offer/request, accept, evidence count, ReadyForConfirmation, Fulfilled, cancel/expire, dispute flag, cycle open/close/compost, pool pause); Draft and review-soft states derived.
7. v3 authorship: baseline = evaluator or operator; delta/re-assessment = Evaluator Hat only; testimony = Community Hat only.
8. Protocol pool: the root garden's pool (tokenId 1), poolType PROTOCOL, cross-garden claim reach.
9. PWA placement: pool flows in the Garden tab; personal commitments + pending confirmations in the WalletDrawer pools tab; Home gets at most a summary card.
10. Admin placement: garden-pool flows in the Garden workspace; the protocol pool console and cross-garden overview are a Pools mode under `/community`; Hub gains a confirmation queue. No top-level `/pools` workspace exists.
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
25. July tracking: update the existing methodology survey (RESR-53, stays in Impact Framework) rather than duplicating; create scoping-survey and activations issues; lightweight tracking table in a project doc.
26. Schema registration timing: assessment v3 + testimony register as the FIRST PR chain of the August track so baselines exist before cycle 1 opens.
27. Hero moments: commitment Fulfilled and cycle close/compost, client PWA only.

**Addendum (2026-07-04 needs-layer alignment):**

28. Needs layer: EAS gains four additional schemas (Need, NeedSignal, NeedStatus, FundingAttribution), owned by the Community Needs & Signals project and specced in `.plans/active/community-interface/`. Amends the letter of #14's "exactly two schemas"; the spirit holds — commitments remain module-native, never EAS. The commitment record gains an additive `bytes32 needUID` (0 = none; see the contract-spec amendment note), specced before the August build so it ships in the initial deploy.
29. Credit follow-on: `CreditRegister` is tracked as `status.json.follow_on.credit_register`, depends on pooling + settlement interfaces, and must not be pulled into August implementation without a new scope lock.
30. Plan-hub compatibility: `status.json.lanes` is intentionally limited to canonical machine lanes. Use `record-tdd --lane contracts`, `--lane state-api`, or `--lane ui`; record sub-lane evidence in the named handoff before the machine lane turns GREEN.
31. Parent-only Linear sync: this active hub intentionally keeps one Linear parent mirror (`PRD-650`) and no per-machine-lane Linear issue mirrors. Do not add fake lane issue IDs; create lane issues only if Afo explicitly chooses to expand the Linear footprint.
32. Architecture closure (updated 2026-07-10): optional multi-domain Need/Commitment scope, complete creation events, direction-aware confirmation with provider exclusion, stored claim-request terms, pre-dispute restoration, one open Season plus concurrent Campaigns, provider/action-matched DomainImpact Work, reward-bound G$ queue, mandatory Functions receipt verification, immutable 24-member batch cap, and exact pilot 2-of-3 Safe recovery are part of the initial implementation contract.
33. External alignment: the latest full synthesis is canonical. `external-communications.md` defines derivative audience materials and rollout; GoodDollar settlement is on Celo, no G$ bridges to Arbitrum, and House of Alignment funds flow directly to the GG protocol Safe on Celo (corrected 2026-07-18).
34. Product-review decisions (2026-07-11 storyboard review; storyboards + gap evidence in `prototypes.md`): (a) pool **open/close controls live on the admin Pool status card** (adopts MF-1; the open-cycle flow gains only a "pool is Ready — open it now?" guard prompt, closing the Ready→Open deadlock); (b) **members get a pre-acceptance withdraw** control on commitment detail (adopts MF-2a; steward-cancel placement remains open); (c) **`waiting_for_hat` covers the five pool job kinds in August** — pre-flight membership check before the first send attempt, no retries consumed, membership event resumes the jobs (adopts MF-5); (d) **expiry runs both paths, sequenced**: admin expiry queue + member "offer again" band ship in August (adopts MF-3/MF-4); a permissionless keeper cron is a post-launch ops backstop, not pre-08-31 build; (e) **pilot operators are the stewards and hold the settlement executor role** — never a Safe owner and never one of the 2-of-3 recovery owners (settlement-spec no-overlap check); W22 needs only a missing-role guard state, not a role-split UI; (f) **W21 + the `/community` Pools view gain a read-only member-delivery gate status row** (enabled/disabled · changed by · date · evidence ref); the owner-only flip stays ops; (g) **testimony is September-realized** (resolves MF-12; no August client frame; external copy must not imply August testimony); (h) the **dry run rehearses S13 with a real minimal Cookie Jar withdrawal**, payoutRef captured via `recordRewardPaid` (jar config + Gardener-Hat prerequisites per corrections-log H7).
35. Garden join-request queue (direction locked; canonical design: `../community-interface/join-queue-spec.md`): the **Community Needs & Signals** hub owns the small agent-backed request service, its personal-data rules, and RESR-64 operating gate. Commitment Pooling is only a consumer: a closed-garden request is signed by the passkey account and, after an operator uses the existing gardener-add path, observed membership is the `waiting_for_hat` flush event for the five pool job kinds. The API remains conveyance only; if unavailable, operators add addresses manually. No protocol admin key ever, and `openJoining` self-join remains unchanged.
36. Hi-fi prototype artifact (2026-07-18, Afo): the flow-prototypes artifact upgrades **in place** from lo-fi ASCII frames to high-fidelity Warm Earth screen renders with per-screen state matrices (Storybook-style state switcher) — full August scope (client PWA + admin + editorial), complete state coverage per uiux-spec §4–§7; September C-frames stay labeled lo-fi previews (they belong to the community-interface plan). Supersedes #13's lo-fi-on-purpose policy **for this artifact only** — `wireframes.md` itself stays lo-fi and remains the structural truth; the artifact still adds no design authority beyond the specs and design-skill tokens it renders. Executes audit follow-up 5 (hi-fi pass over the revised pool surfaces). Build machinery decomposed into `hifi/` modules with state-aware validation: journey refs, hotspot-id integrity, per-state render checks, and banned-vocabulary / steward-rule / quiet-admin / chain-placement scans over rendered copy (hard-fail on hi-fi renders, warn-only on remaining ascii). Same entrypoint, same artifact URL, same citation discipline.

## Research / Plan Gate

- [x] Research evidence recorded: `corrections-log.md` (every Document A repo claim verified, corrected, or superseded, with file paths)
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
| External brief, audience notes, GTM/community rollout, and factual review | `docs` + `july_dry_run` | [RESR-57](https://linear.app/greenpill-dev-guild/issue/RESR-57), [RESR-58](https://linear.app/greenpill-dev-guild/issue/RESR-58), [PRD-701](https://linear.app/greenpill-dev-guild/issue/PRD-701) | ⏳ |
| July: methodology/metrics pulse (proto-commitment #1; RESR-53 canceled 2026-07-06, folded into the unified instrument) | `july_dry_run` | [RESR-62](https://linear.app/greenpill-dev-guild/issue/RESR-62) | ⏳ |
| July: commitment-scoping surveys + mandate artifacts (gates August seeding) | `july_dry_run` | [RESR-62](https://linear.app/greenpill-dev-guild/issue/RESR-62) | ⏳ |
| July: activations + proto-commitment loops (TAS) | `july_dry_run` | [RESR-62](https://linear.app/greenpill-dev-guild/issue/RESR-62) (historical label: canceled RESR-63) | ⏳ |
| July: pilot cohort readiness | `july_dry_run` | [RESR-62](https://linear.app/greenpill-dev-guild/issue/RESR-62) + [PRD-701](https://linear.app/greenpill-dev-guild/issue/PRD-701) (historical label: canceled RESR-13) | ⏳ |
| September: independent packages/community PWA after shared-foundation extraction | `community` | [PRD-682](https://linear.app/greenpill-dev-guild/issue/PRD-682) | ⏳ |
| September: Community Need intake into the commitment-seeding gate | `ui_admin` | [PRD-691](https://linear.app/greenpill-dev-guild/issue/PRD-691) + Community admin handoff (historical label: canceled PRD-683) | ⏳ |
| Follow-on: borrow-and-repay `CreditRegister` + credit indexer/shared/admin/PWA surfaces | `credit_follow_on` | no tracker yet | 🚧 blocked |

Spine records (not work items): [PRD-649](https://linear.app/greenpill-dev-guild/issue/PRD-649) architecture record (closes when contract-spec merges), [PRD-650](https://linear.app/greenpill-dev-guild/issue/PRD-650) proof capability (parent of the August workstreams), [PRD-651](https://linear.app/greenpill-dev-guild/issue/PRD-651) deferred transferable settlement vouchers, [RESR-57](https://linear.app/greenpill-dev-guild/issue/RESR-57)/[RESR-58](https://linear.app/greenpill-dev-guild/issue/RESR-58) research framing. Linked research: RESR-15, RESR-4, PRD-275.

## Tracks and sequencing (live Linear cadence)

The next-week implementation kickoff is preparation and interface freeze inside the current Product cycle through 2026-07-16. The main Product implementation window is the named Commitment Pooling cycle, 2026-07-16 through 2026-07-30. Research alignment runs through 2026-07-30; the July dry-run milestone is 2026-07-31. August, September, and hardening retain their project milestone dates. These are checkpoints, not claims that every garden or surface completes together.

### Track A: July dry run (existing rails, no code)

Runs entirely in parallel with Track B. Tracks (a) methodology and (c) activations run in parallel; (b) scoping surveys gate August seeding.

Focus cohort (decision #23, named 2026-07-10; readiness stays evidence-gated per RESR-62): Tech and Sun Hub (Awka, Nigeria), Greenpill Cape Town (Muizenberg / Deep South Circles), AgroforestDAO / Redemption Hill (Bias Fortes, Brazil), and Barichara Regenerativa (Barichara, Santander, Colombia — the mature MRV-adoption anchor, selected 2026-07-11; decision #27: selection is not participation).

- [ ] (a) Methodology/metrics pulse fielded inside the unified RESR-62 two-pass instrument (RESR-53 canceled 2026-07-06 and folded in; the protocol-pool proto-commitment framing and the Cape Town UNICEF waste showcase carry over)
- [ ] (b) Scoping surveys and cohort-readiness evidence per focus garden; one mandate artifact each under RESR-62 with PRD-701 operator coordination (canceled RESR-13 is historical only)
- [ ] (c) Activations defined and run under RESR-62; at least one full proto-commitment loop per focus garden (canceled RESR-63 is historical only)
- [ ] Tracking table maintained in the Linear project doc "July dry run: proto-commitment tracking" with one row set per focus garden plus a Garden-4 placeholder; rewards via Cookie Jar or treasury only (no G$ in the dry run)

### Track B: August release build (the hard commitment)

Sequencing (dependency order is contracts -> indexer/shared -> client/admin/docs; PRD-673 freezes the entity/query contract early while PRD-674 builds only interface-independent shared foundations, and shared GREEN waits for indexer codegen/query proof):

1. [ ] PRD-671 schemas PR chain (independent; lands first so baselines exist before cycle 1)
2. [ ] PRD-672 module + register + wiring (parallel with PRD-671 after interface freeze)
3. [ ] PRD-673 indexer starts from PRD-672's frozen events, freezes entity/query ownership for PRD-674, adds Envio block-preservation proof, migrates Garden IDs to `chainId-address`, keeps audit actor nullable unless explicit, and completes codegen/build before downstream GREEN
4. [ ] PRD-674 shared substrate starts from PRD-672 interfaces in parallel where safe; final GREEN requires the PRD-673 generated entity/query contract and composite-ID cutover proof; blocks all app lanes
5. [ ] In parallel after PRD-674: PRD-675 client, PRD-676 admin Garden, PRD-677 admin Community Pools mode, PRD-678 editorial, PRD-679 Hypercert cut-over
6. [ ] PRD-680 docs (`docs`) can start any time; PRD-681 screenshot guides (`docs_guides`) stay blocked until client/admin settlement surfaces exist
7. [ ] Human-authorized release step (`handoffs/human-release-ops.md`): after implementation GREEN, audit, multisig/timelock, two-week testnet, and dry-run evidence, separately authorize GardenToken upgrade + module/register/schema broadcast; then verify artifact addresses, indexer config, schema UIDs, replay switch, and rollback
8. [ ] Cycle 1 opens: operator-curated seeding from the July mandate artifacts
9. [ ] PRD-686 settlement implementation (PR chain 2.5, due 2026-07-29): after PRD-672 interface freeze and the pre-dispatch external inputs, freeze exact events/storage, build deterministic 2-of-3 Safe tooling, scoped Roles + Allowance, immutable 1–24 batches, per-member reconciliation, pinned Functions v1.3 callback, and Reported/checking/Verified selectors. Generated storage/mock/dry-run evidence is an implementation output, not a circular dispatch prerequisite
10. [ ] Human-owned settlement exit proof (`handoffs/human-release-ops.md`): first real G$ reward derived from a Fulfilled commitment, queued on Arbitrum, executed from the registered provider-garden Safe on Celo, reported, verified by the current Functions callback against finalized receipt logs, and visible as “support arrived”; AA failure blocks this member leg but not the protocol → garden funding route
11. [ ] Credit follow-on remains blocked unless explicitly unblocked after pooling + settlement interfaces freeze

### Track C: September community interface

- [ ] PRD-682 shared-foundation extraction, then independent `packages/community` scaffold at `community.greengoods.app` / local port 3010 (after PRD-674 substrate; canonical artifacts in `.plans/active/community-interface/`)
- [ ] PRD-691 Community admin seeding intake after the Commitment Pooling admin and PRD-682 Community substrate are GREEN (canceled PRD-683 is historical only)

The Needs layer consumed by PRD-682 and PRD-691 (Need/NeedSignal/NeedStatus/FundingAttribution schemas, shared substrate, admin triage, funder lens) is planned and tracked separately in `.plans/active/community-interface/` and the **Community Needs & Signals** Linear project. Canceled PRD-683 remains historical traceability only; decision #28 records the schema-count amendment.

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

### Credit Follow-on (`codex/credit/commitment-pooling`): blocked, no tracker yet

- [ ] Do not implement without an explicit unblock; `credit-spec.md` is design truth only
- [ ] Depends on PRD-672/686 interface stability and the settlement-side loan-disbursement seam
- [ ] When unblocked: `CreditRegister` + indexer + shared `queryKeys.credit.*` + `credit` job kind + admin/PWA credit surfaces
- [ ] Write `handoffs/codex-credit-follow-on.md`

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
3. **Linear re-apply pass**: the applied packs (`linear-update-pack.md`, `linear-apply-pack.md`) mirror live Linear content (PRD-686 context, RESR-57/58, canonical synthesis derivatives) that still carries the working-capital topology and scalar counts — re-apply the corrected wording to Linear.
4. **Ops confirmation before the first garden Safe deploys**: designate the Dev Guild recovery multisig's concrete Celo address independently of the retired working-capital Safe, and record the HoA stream's receiving-address evidence (GG protocol Safe) in the settlement handoff (milestone M1, settlement-spec §8).
5. **Optional hi-fi design pass** (Stitch / Claude Design) over the revised client pool surfaces (W1/W2/W25) once these wireframes settle.

## Boundary

No implementation code starts from this plan without Afo dispatching the specific lane or handoff. G$ split-state settlement is IN scope for August via [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686) (`settlement-spec.md`, decision #14) but remains manually blocked on the pooling interface, mandatory Functions proof, GoodDollar/Safe configuration, and AA outcome. SettlementModule, per-garden Celo Safes, the ProtocolToGarden funding route, and oracle-backed status reads may proceed when their gates pass; commitment-reward delivery and member sends remain disabled unless the AA gate passes. Bridge-executor automation is stretch only. Still out of scope for every lane: bridged G$ (never), bridge custody/unbounded value authority, Sarafu integration, transferable settlement vouchers and `settlementAdapter`/`settlementEnabled` activation (PRD-651), indexing Celo/G$ transfers, garden-to-garden federation, leaderboards, and public credit scores. Borrow-and-repay `CreditRegister` is a blocked follow-on lane; no implementation without a new scope lock.
