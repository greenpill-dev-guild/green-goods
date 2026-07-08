# Commitment Pooling Plan

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Status**: `ACTIVE: plan approved, spec in progress, settlement scope reconciled (2026-07-06), implementation not started`
**Created**: `2026-07-03`
**Last Updated**: `2026-07-06`

Linear mirror: project [Green Goods Commitment Pooling](https://linear.app/greenpill-dev-guild/project/green-goods-commitment-pooling-4bc53572f354) (converted in place from Seasons & Campaigns). Milestones: July dry run (2026-07-31), August release (2026-08-31, hard commitment), September community interface (2026-09-30). Specs in this folder: `corrections-log.md`, `contract-spec.md`, `uiux-spec.md`, `settlement-spec.md` (G$ split-state settlement, August), `credit-spec.md` (blocked borrow-and-repay follow-on), plus design artifacts `diagrams.md` (topology, sequences, state machines, indexer ERD delta, settlement D8–D10) and `wireframes.md` (low-fi, all four surfaces).

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
| 7 | Lightweight evidence object (IPFS CID via module event) for SupportService/OperatorCaptured; counterparty confirmation is the review; DomainImpact keeps full MDR | One human loop for low-stakes mutual aid; full approval rigor where impact is claimed. |
| 8 | v3 authorship split: baseline = evaluator or operator; delta/re-assessment = Evaluator Hat only; testimony = Community Hat only | Preserves analog capture while keeping the two-voice evaluation model clean. |
| 9 | Surfaces: PWA Garden tab + WalletDrawer pools panel; admin Garden workspace + NEW Pools workspace + Hub queue; editorial GardenDialog + /impact; September packages/community | Q&A decisions 9, 10, 21, 3; WalletDrawer already reserves the commitments tab. |
| 10 | Clean room: Grassroots Economics paper + public docs only, never AGPL Sarafu source | RESR-57 D3 + non-AGPL constraint. |
| 11 | Seasons & Campaigns project converted in place; legacy season issues composted with pointer comments | Seasons and campaigns are cycle types inside the pool; separate project inverted the dependency. |
| 12 | Out of scope everywhere: bridged G$, bridge custody or unbounded value authority, Sarafu integration, transferable settlement vouchers / `settlementAdapter` activation, indexing Celo/G$ transfers, garden-to-garden federation, leaderboards, public credit scores | Supersedes the stale "no Celo/no G$" wording. Split-state G$ settlement is in August via PRD-686; these guardrails keep the settlement rail bounded. |
| 13 | Design artifacts live in this folder: low-fi in-repo wireframes for all four surfaces (`wireframes.md`) + mermaid diagrams (`diagrams.md`) + the consolidated permission matrix (contract-spec §6.1); docs-site promotion rides PRD-680 at ship | User alignment 2026-07-04 (post-#619 audit): understand flows on screens before build; low fidelity on purpose; the docs site describes what is live. |
| 14 | G$ split-state settlement enters the **August release**: NET-NEW `SettlementModule` on Arbitrum (garden-account-anchored authorization, disbursement queue, `Queued → Executing → Settled / Failed → requeue / Cancelled` states, Celo execution refs) + Celo Safes executing via Zodiac-scoped signers ([PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686), `settlement-spec.md`). Base MVP is operator-executed; bridge-executor automation is an August stretch, else post-August. Still out: bridged G$ (never), bridge custody/unbounded value authority, Sarafu integration (deferred hybrid), transferable settlement vouchers (PRD-651) | User decisions 2026-07-04 and 2026-07-06: Architecture 2 formalized on-chain; permissions stay on Arbitrum where Hats lives; a failed Celo leg never un-confirms a promise; automation may be attempted as stretch but must not block the base settlement proof. |
| 15 | Fund topology: HoA stream → Dev Guild Working Capital Safe → GG protocol Safe (settlement account of the protocol pool) → garden Celo Safes → members. **One Safe per garden, 1:1, owned by the garden account, for every garden in the protocol** — deployed on demand (deterministic script, batch-capable for the 13 live gardens, or admin "Set up settlement account" trigger), never launch-blocking. Funding hops recorded as Funding disbursements; `registerSettlementAccount` is the canonical garden↔Safe mapping | User-confirmed HoA disbursement path + 1:1 correction, 2026-07-04. |
| 16 | Members receive G$ at same-address smart accounts on Celo; week-1 AA verification spike (factory + bundler + paymaster on 42220); named fallback = garden-custody accounting (counsel flag only if activated) | User decision 2026-07-04; settlement-spec §5. |
| 17 | The app becomes multi-chain this iteration: primary chain (`VITE_CHAIN_ID`) + settlement chain (Celo 42220). Status reads from the indexer, balance reads via a second viem client, member sends with sponsored gas; CLAUDE.md Single-Chain principle amendment rides the implementation PR | User decision 2026-07-04; settlement-spec §5. |
| 18 | Borrow-and-repay becomes a blocked follow-on lane: `CreditRegister` is designed in `credit-spec.md`, but it is not part of the August base MVP and is not dispatchable without an explicit unblock | User decision 2026-07-06; keeps GE mutual-credit design visible without expanding the hard August commitment. |
| 19 | `status.json` uses only plan-hub canonical machine lanes (`contracts`, `state_api`, `ui`, `qa_pass_1`, `qa_pass_2`); detailed workstreams remain as `execution_sub_lanes` and this checklist | Keeps `node scripts/harness/plan-hub.mjs validate`, `list`, and `record-tdd` usable without losing the Codex/Claude sub-lane breakdown. |
| 20 | Linear sync is explicit parent-only for this hub (`linear.laneSyncMode = parent_only`) | Preserves the low-noise Linear footprint and avoids using PRD-650 as fake lane issue IDs; lane-level execution truth stays in `.plans` and handoffs. |

### Full decision register (2026-07-03 alignment session, 27 decisions)

1. Spec home: all artifacts in `.plans/active/commitment-pooling/`; no docs-site promotion.
2. Linear issue depth: workstream-sized issues, one per package workstream per track.
3. Community interface: NEW package `packages/community` (own PWA, three tabs, Passkey, consumes shared).
4. Git ending: conventional commits on the session branch plus a PR to develop.
5. EAS bridge: WorkApprovalResolver hook (try/catch, non-blocking) plus operator `syncApprovedWork` fallback.
6. State weight: hybrid; hard transitions on-chain (seed, offer/request, accept, evidence count, ReadyForConfirmation, Fulfilled, cancel/expire, dispute flag, cycle open/close/compost, pool pause); Draft and review-soft states derived.
7. v3 authorship: baseline = evaluator or operator; delta/re-assessment = Evaluator Hat only; testimony = Community Hat only.
8. Protocol pool: the root garden's pool (tokenId 1), poolType PROTOCOL, cross-garden claim reach.
9. PWA placement: pool flows in the Garden tab; personal commitments + pending confirmations in the WalletDrawer pools tab; Home gets at most a summary card.
10. Admin placement: garden-pool flows in the Garden workspace; NEW Pools workspace for the protocol pool console and cross-garden overview; Hub gains a confirmation queue.
11. Seasons & Campaigns project: converted in place to "Green Goods Commitment Pooling" (supersedes the create-new-project instruction).
12. Legacy season issues: composted aggressively with pointer comments; RESR-13 to the July milestone; RESR-15/RESR-4/PRD-275 stay linked research; PRD-344/495/347 rehomed out.
13. Docs staleness: logged in corrections-log plus a Linear docs issue; no docs edits in the spec session.
14. Commitments are NOT EAS attestations; module-native records; EAS gains exactly two schemas (assessment v3, community testimony).
15. Voucher-shaped from day one: commitment units as non-transferable token-like accounting so transferable settlement vouchers attach 1:1 later.
16. Companion register contract: `CommitmentPoolingModule` (control plane) plus non-transferable ERC-1155-style `CommitmentRegister` (classes, balances, quotas), supersedes PRD-649's single-artifact stance.
17. Clean room: Grassroots Economics paper and public docs only; never the AGPL Sarafu source.
18. Rewards: declared reward reference plus operator-executed payout plus rewardPaid event; the module never custodies funds; zero CookieJar changes.
19. Claim mode per commitment: open-claim or approval-gated, set at seeding; protocol pool defaults approval-gated, garden campaigns default open-claim.
20. Meta evidence: lightweight evidence object (IPFS CID via module event, offline-queueable) for SupportService/OperatorCaptured; counterparty confirmation IS the review; DomainImpact keeps the full MDR path.
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

## Research / Plan Gate

- [x] Research evidence recorded: `corrections-log.md` (every Document A repo claim verified, corrected, or superseded, with file paths)
- [x] Existing repo patterns identified: CookieJar.sol module template, badge-schemas standalone registration, greenWill/hypercerts handler patterns, SubmitWork analog capture, WalletDrawer pools tab
- [x] Human judgment points surfaced and decided: 27 alignment decisions (2026-07-03) + approved Linear change set (2026-07-04)
- [x] Out of scope defined: no bridged G$, bridge custody/unbounded value authority, Sarafu integration, transferable settlement vouchers, indexed Celo/G$ transfers, garden-to-garden federation, leaderboards, or public credit scores; no commitment EAS schema; no claim flow in the community interface v1
- [x] Lightest honest validation chosen per lane (see Validation)
- [x] Design artifacts landed 2026-07-04: permission matrix (contract-spec §6.1 gating table), `diagrams.md` (7 mermaid diagrams, all validated), `wireframes.md` (20 low-fi frames, four surfaces + cross-surface flow map)
- [x] Settlement scoping landed 2026-07-04: `settlement-spec.md` (SettlementModule, Safe topology, member receipt, multi-chain tiers, failure states) + diagrams D8–D10 + [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686)

## Requirements Coverage

The **Lane** column below names execution sub-lanes for planning clarity. The harness-facing machine lanes in `status.json` are only `contracts`, `state_api`, `ui`, `qa_pass_1`, and `qa_pass_2`.

| Requirement | Lane | Linear issue | Status |
|---|---|---|---|
| Assessment v3 + community testimony schemas + resolvers (first PR chain) | `contracts` | [PRD-671](https://linear.app/greenpill-dev-guild/issue/PRD-671) | ⏳ |
| CommitmentPoolingModule + CommitmentRegister + GardenToken wiring + deploy | `contracts` | [PRD-672](https://linear.app/greenpill-dev-guild/issue/PRD-672) | ⏳ |
| Indexer entities, handlers, four locked stats, bundleKind | `indexer` | [PRD-673](https://linear.app/greenpill-dev-guild/issue/PRD-673) | ⏳ |
| Shared substrate: types, hooks, queryKeys.pools, five offline queue kinds + online wallet transfer, lightweight evidence, v3 workflow, settlement selectors | `state_api` | [PRD-674](https://linear.app/greenpill-dev-guild/issue/PRD-674) | ⏳ |
| Client PWA: Garden tab pool flows, WalletDrawer panel, hero moments | `ui_client` | [PRD-675](https://linear.app/greenpill-dev-guild/issue/PRD-675) | ⏳ |
| Admin: Garden workspace pool console (cycles, seeding, claims, analog capture, assessment v3) | `ui_admin` | [PRD-676](https://linear.app/greenpill-dev-guild/issue/PRD-676) | ⏳ |
| Admin: Pools workspace + Hub confirmation queue | `ui_admin` | [PRD-677](https://linear.app/greenpill-dev-guild/issue/PRD-677) | ⏳ |
| Editorial: GardenDialog pool story + /impact aggregates | `editorial` | [PRD-678](https://linear.app/greenpill-dev-guild/issue/PRD-678) | ⏳ |
| Hypercert cut-over: fulfilled-commitment bundling + allocation presets | `state_api` + `ui_admin` | [PRD-679](https://linear.app/greenpill-dev-guild/issue/PRD-679) | ⏳ |
| G$ split-state settlement: SettlementModule + Celo Safes + multi-chain app | `settlement` | [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686) | ⏳ |
| Docs: glossary + architecture freshness | `docs` | [PRD-680](https://linear.app/greenpill-dev-guild/issue/PRD-680) | ⏳ |
| Docs: operator seeding guide + gardener promises guide | `docs_guides` | [PRD-681](https://linear.app/greenpill-dev-guild/issue/PRD-681) | ⏳ |
| July: methodology survey (proto-commitment #1) | `july_dry_run` | [RESR-53](https://linear.app/greenpill-dev-guild/issue/RESR-53) (homed in Impact Framework, linked) | ⏳ |
| July: commitment-scoping surveys + mandate artifacts (gates August seeding) | `july_dry_run` | [RESR-62](https://linear.app/greenpill-dev-guild/issue/RESR-62) | ⏳ |
| July: activations + proto-commitment loops (TAS) | `july_dry_run` | [RESR-63](https://linear.app/greenpill-dev-guild/issue/RESR-63) | ⏳ |
| July: pilot cohort readiness | `july_dry_run` | [RESR-13](https://linear.app/greenpill-dev-guild/issue/RESR-13) | ⏳ |
| September: packages/community scaffold (view, signal, confirm) | `community` | [PRD-682](https://linear.app/greenpill-dev-guild/issue/PRD-682) | ⏳ |
| September: community signals intake into the cycle-2 seeding gate | `ui_admin` | [PRD-683](https://linear.app/greenpill-dev-guild/issue/PRD-683) | ⏳ |
| Follow-on: borrow-and-repay `CreditRegister` + credit indexer/shared/admin/PWA surfaces | `credit_follow_on` | no tracker yet | 🚧 blocked |

Spine records (not work items): [PRD-649](https://linear.app/greenpill-dev-guild/issue/PRD-649) architecture record (closes when contract-spec merges), [PRD-650](https://linear.app/greenpill-dev-guild/issue/PRD-650) proof capability (parent of the August workstreams), [PRD-651](https://linear.app/greenpill-dev-guild/issue/PRD-651) deferred transferable settlement vouchers, [RESR-57](https://linear.app/greenpill-dev-guild/issue/RESR-57)/[RESR-58](https://linear.app/greenpill-dev-guild/issue/RESR-58) research framing. Linked research: RESR-15, RESR-4, PRD-275.

## Tracks and Sequencing (no week-by-week dates)

### Track A: July dry run (existing rails, no code)

Runs entirely in parallel with Track B. Tracks (a) methodology and (c) activations run in parallel; (b) scoping surveys gate August seeding.

- [ ] (a) Methodology survey fielded and confirmed (RESR-53; first protocol-pool proto-commitment)
- [ ] (b) Scoping surveys per cohort garden; one mandate artifact each (RESR-62); cohort per RESR-13
- [ ] (c) Activations defined and run; at least one full proto-commitment loop per focus garden (RESR-63)
- [ ] Tracking table maintained in the Linear project doc "July dry run: proto-commitment tracking"; rewards via Cookie Jar or treasury

### Track B: August release build (the hard commitment)

Sequencing (repo build order remains contracts -> shared -> indexer -> apps; PRD-673 schema/entity contract and PRD-674 shared substrate coordinate after PRD-672 interface freeze):

1. [ ] PRD-671 schemas PR chain (independent; lands first so baselines exist before cycle 1)
2. [ ] PRD-672 module + register + wiring (parallel with PRD-671 after interface freeze)
3. [ ] PRD-674 shared substrate (starts from PRD-672 interfaces; final GREEN requires the agreed PRD-673 entity/query contract; blocks all app lanes)
4. [ ] PRD-673 indexer (starts from PRD-672's event signatures; freezes the entity/query contract early for PRD-674; zero-address placeholders pre-broadcast; codegen/build before QA)
5. [ ] In parallel after PRD-674: PRD-675 client, PRD-676 admin Garden, PRD-677 admin Pools, PRD-678 editorial, PRD-679 Hypercert cut-over
6. [ ] PRD-680 docs (`docs`) can start any time; PRD-681 screenshot guides (`docs_guides`) stay blocked until client/admin settlement surfaces exist
7. [ ] Gated broadcast step: GardenToken upgrade + module/register deploy + schema registrations on Arbitrum One (post-broadcast blockers: artifact addresses, indexer config, schema UIDs)
8. [ ] Cycle 1 opens: operator-curated seeding from the July mandate artifacts
9. [ ] PRD-686 settlement (PR chain 2.5): starts after PRD-672's interface freeze (the module only reads the pooling module), runs parallel with PRD-673/674. Week-1 gates: Celo AA spike + GoodDollar written confirmations. Celo Safe tooling runs alongside (deterministic deploy-then-register script + admin trigger; one Safe per garden 1:1, on-demand rollout; Zodiac Roles + Allowance config, executor keys); SettlementModule deploy + protocol-pool settlement-account registration join the gated broadcast step. Bridge-executor automation is an August stretch, else post-August, and does not block the base settlement exit proof
10. [ ] Settlement exit proof: first real G$ disbursement end to end — queued on Arbitrum, executed from a garden Celo Safe, `recordSettled(celoTxHash)`, status visible in the PWA reward row
11. [ ] Credit follow-on remains blocked unless explicitly unblocked after pooling + settlement interfaces freeze

### Track C: September community interface

- [ ] PRD-682 packages/community scaffold (after PRD-674 substrate; wireframes in `uiux-spec.md`, amended 2026-07-04)
- [ ] PRD-683 signals intake into the seeding console (after PRD-676/682)

The needs layer PRD-682/683 consume (Need/NeedSignal/NeedStatus/FundingAttribution schemas, shared substrate, admin triage, funder lens) is planned and tracked separately: hub `.plans/active/community-interface/`, Linear project **Community Needs & Signals**. PRD-682/683 bodies amended 2026-07-04 to reference it; decision #28 records the schema-count amendment.

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

### Settlement (`codex/settlement/commitment-pooling`): PRD-686

- [ ] `SettlementModule` + tests per `settlement-spec.md` §3; zero changes to the pooling module or register; bun wrappers only
- [ ] Week-1 gate outcomes recorded in the handoff: Celo AA spike (same-address accounts + paymaster on 42220) and GoodDollar written confirmations
- [ ] Bridge-executor automation may be attempted as an August stretch if the base path is stable; it is not required for the base exit proof
- [ ] Indexer settlement entities per settlement-spec §6; shared multi-chain substrate per §5 coordinated with the state-api lane; admin/PWA surface increments coordinated with the ui lanes
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/codex-settlement.md`

### Indexer (`codex/indexer/commitment-pooling`): PRD-673

- [ ] Entities, handlers, stats per the spec's fenced definitions; `bun codegen` clean
- [ ] Record RED/GREEN proof (scripted event-sequence test) before marking complete
- [ ] Write `handoffs/codex-indexer.md`

### State / API (`codex/state-api/commitment-pooling`): PRD-674, PRD-679 (shared half)

- [ ] Hooks, stores, query keys, six August action/job kinds: five offline queue kinds (`commitment`, `claim`, `evidence`, `workLink`, `confirmation`) plus online-only wallet `transfer`; hooks stay in shared
- [ ] Keep the machine `state_api` lane manually blocked until PRD-672 contract interfaces and the PRD-673 entity/query contract are recorded; do not record aggregate `state-api` GREEN until indexer codegen/build evidence is recorded in `handoffs/codex-indexer.md`
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

### UI Admin (`claude/ui-admin/commitment-pooling`): PRD-676, PRD-677, PRD-679 (admin half), PRD-683

- [ ] Admin tasks only; AdminDialog anatomy (side sheets retired); i18n; Storybook coverage
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

## Validation

Per the Validation Intent Ladder: lane work uses targeted proof; the coordinator runs the Repo Quick Gate at checkpoints; Ship Gate before merge/release.

- [ ] Lane-targeted: lane handoff Validation sections name the commands for each Afo-dispatched work unit
- [ ] Checkpoint: `node scripts/dev/ci-local.js --quick` after multi-lane merges
- [ ] Ship Gate before release: `bun format && bun lint && bun run test && bun build` + `bun run lint:vocab` + `bun run check:design-tokens` + `bun run --filter @green-goods/shared check:stories` where stories changed
- [ ] Full-local dogfood before cycle 1: `bun run dev` + `bun run dev:smoke:full`

## Boundary

No implementation code starts from this plan without Afo dispatching the specific lane or handoff. G$ split-state settlement is IN scope for August via [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686) (`settlement-spec.md`, decision #14): SettlementModule, per-garden Celo Safes, operator-executed G$ settlement, settlement status reads, and member G$ sends. Bridge-executor automation is an August stretch, else post-August, and must not block the base MVP. Still out of scope for every lane: bridged G$ (never), bridge custody/unbounded value authority, Sarafu integration (deferred hybrid experiment), transferable settlement vouchers and `settlementAdapter`/`settlementEnabled` activation (PRD-651), indexing Celo/G$ transfers, garden-to-garden federation, leaderboards, and public credit scores. Borrow-and-repay `CreditRegister` is a blocked follow-on lane; no implementation without a new scope lock.
