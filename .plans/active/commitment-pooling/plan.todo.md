# Commitment Pooling Plan

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Status**: `ACTIVE: Pooling contracts and the complete pooling indexer read model are merged to develop. PRD-723 source implementation and local proof are complete. The hosted indexer still requires a manual Envio deploy, fresh full sync, and read-back before pooling queries become available; settlement/Celo selectors, client, admin, and editorial implementation remain gated. Celo Safe authority is frozen in the manifest and both fee reserves are funded; the ceremony is re-scoped to paused-safe-owned, so ownership transfer comes first, then the Safe-sent route, ping, and canary. Value release, audit, and external evidence remain separately blocked.`
**Created**: `2026-07-03`
**Last Updated**: `2026-08-16`

Linear mirror: project [Commitment Pooling](https://linear.app/greenpill-dev-guild/project/commitment-pooling-4bc53572f354). Native phases: **Scope and Design** (2026-07-22), **Build** (2026-07-31), **Release** (2026-08-12), and **Follow On / Hardening** (2026-09-30). Operational checkpoints are separate: July dry run (2026-07-31) and Community plus settlement-evidence delivery (2026-09-30). **The full document map is the next section.** Community-specific diagrams, wireframes, journeys, and research operations live in `.plans/active/community-interface/`. The 2026-07-10/11 reconciliation, PRD-686/RESR-57 predicate, and null PRD-651/697 dates were live-verified historical state; current Linear convergence must be reread before any write. **Fourth-garden policy (Decision Log #29, 2026-07-18 — supersedes Decision Log #25 and Decision Log #27): no fourth garden is selected.** The slot is open, candidates are under consideration, and **no artifact names one**. The three named gardens cover all four action domains on their own. The earlier Decision Log #25→Decision Log #26→Decision Log #27 naming sequence is closed history; do not re-apply it.

> **Linear consolidation (2026-07-05).** To keep Linear minimal, the per-lane workstream issues were closed into a small set of parent **trackers**; **this plan is the lane-level execution truth**. Trackers: **PRD-650** August proof MVP (absorbs PRD-671→681), **PRD-686** G$ split-state settlement, **PRD-682** September community interface (absorbs PRD-683), **RESR-62** July dry run (absorbs RESR-63 + RESR-13; RESR-53 stays in Impact Framework). Needs-layer trackers **PRD-687** substrate (absorbs PRD-688/689/690) and **PRD-691** app (absorbs PRD-692/693/694) live in the **Community Needs & Signals** project. Kept as-is: **PRD-649** (architecture record), **PRD-651** (transferable settlement-voucher implementation remains gated; the canonical design-only brief now lives at `exchange-architecture-brief.md`), research records **RESR-57/58/64**, parked **PRD-695/696**, and the linked-research issues **RESR-15/RESR-4/PRD-275**. The per-lane `PRD-6xx` / `RESR-xx` IDs in the tables below are **historical labels** for the closed child issues — dispatch reads the lanes here and rolls up to the parent tracker, not to those closed IDs.
>
> **Canonical historical mapping (2026-07-20).** References to the retired identifiers resolve as **PRD-701 → COM-3** and **RESR-62 → COM-7**. Preserve the old identifiers inside frozen archives and dated history; use COM-3 and COM-7 for active instructions. **Extended 2026-07-24: PRD-735 → COM-11** (the settlement-evidence lane issue moved to the Community team; parent PRD-650, Follow On / Hardening milestone, and 2026-09-30 due date unchanged) — use COM-11 for active instructions (corrections-log §13).

## Document map

Every file in this hub, by role — **181 files**: 36 at the hub root, 42 under `artifacts/`,
25 under `handoffs/`, 22 under `hifi/`, 20 under `operations/`, 35 under `reports/` (including
`reports/linear/`), and 1 under `evidence/`. Counts re-taken 2026-08-21; the previous 171 predated
the client-UI review prompts and the editorial dispatch prompt.
**This list is the index — if you add a document here, add its row.** Root files each get their own
row; the six subtrees get one row apiece naming their own in-tree index, because the row for a
subtree is only honest if that index actually enumerates the tree (this failed review on
2026-08-05: five root files had no row, three subtrees had no inventory at all, and the
`handoffs/` row pointed at a README that described source order rather than listing the files).

| Document | Role | Authority |
|---|---|---|
| `plan.todo.md` | **This file.** Decisions, tracks, lane checklists, follow-ups. The hub entry point. | Lane-level execution truth |
| `standing-commitments-spec.md` | Offer once or Offer over time → pool-scoped internal `CommitmentSeries` for the ongoing path → finite Offer instances → linked Story; honest availability, persistence, trust, succession, and artifact ownership | **Ongoing-Offer architecture source of truth** |
| `contract-spec.md` | Pooling module + register: state machines, events, §6.1 permission matrix | **Contract-layer source of truth** |
| `settlement-spec.md` | G$ split-state settlement: Arbitrum CCIP command module, bounded Celo executor, acknowledgment, Safe authority, AA gate | **Settlement transport + execution source of truth** |
| `erc6551-garden-safe-owner-spike.md` | Fork-only proof of a foreign-chain Garden ERC-6551 account as one threshold-2 Celo Safe owner alongside nested recovery Safes, plus the two production gates | **Spike evidence only; no production owner-set or deployment authority** |
| `exchange-architecture-brief.md` | Full follow-on architecture: three-identity compatibility boundary, versioned adapter/router, fulfilled then capacity backing, class/issuance/seed/exchange/redemption/repair, one-pool proof, Sarafu-pool hybrid, and federation gates | **Design only; implementation and activation remain gated** |
| `member-funded-claims-brief.md` | Option-B design for the circulation loop: member claim-requests on priced Offers, garden-Safe-held deposits, refund disbursements on terminal non-fulfillment, delta inventory + sizing | **Draft for discussion (2026-08-11); no decision registered, no code authorized** |
| `pilot-evidence-spec.md` | September pilot evaluation: claim hierarchy, baselines, metric registry, coercion/exposure/repair safeguards, circulation integrity, privacy, and reporting gates | **Pilot-evidence and outcome-claim source of truth; no implementation authority** |
| `../commitment-credit-follow-on/spec.md` | Borrow-and-repay `CreditRegistry` | **August-wave companion chain** (unblocked 2026-08-01, Decision Log #39); dispatch gates in its status.json |
| `uiux-spec.md` | Canonical cross-surface flows + §4 state tables + job kinds | UI/UX contract |
| `wireframes.md` | Existing CP frame headings across four surfaces; ongoing-Offer additions are pending the Claude Code artifact lane (W6 is a retirement tombstone) | **Lo-fi structural truth** |
| `diagrams.md` | D1–D29 Mermaid execution reference (29 named sections rendering 42 Architecture Mermaid blocks; current architecture plus the future identity boundary and staged single-pool-to-federation path) | Flow truth |
| `prototypes.md` | Numbered storyboards, guided-flow catalogue, missing-frame index, and action inventory; the ongoing-Offer journeys are realized and review-visible | Fidelity-neutral walks — **adds no design authority** |
| `prototypes-coverage.md` | Rendered-state / hotspot / scene coverage snapshot for the prototypes artifact; the closure validator pins its three counts | Generated coverage snapshot |
| `flow-audit.md` | Experience audit of the hi-fi prototypes read from the journeys outward: the action map, a walk of every flow, the relay between people, continuity, the emotional arc, and ranked findings | Review findings — **adds no design authority**; decisions land in `uiux-spec.md` and the Decision Log |
| `flow-audit-prompt.md` | The brief that produced `flow-audit.md`: what to audit for, the six qualities, and the hard limits on what an audit may propose | Audit method — reusable brief, not a spec |
| `review-prompt.md` | Grounded `/review` brief for PR #732: scoping notes where the skill's defaults miss, the batch plan, the ranked risk surface, the claims to disprove, and what could not be verified | Review method — reusable brief, not a spec |
| `review-prompt-client-ui.md` | First adversarial review brief for the PR #740 client slice (W1–W5); fixes landed in `dd12817ab` | Review method — dated brief, not a spec |
| `review-prompt-client-ui-round2.md` | Round-2 client UI review brief; fixes landed in `694a20316` | Review method — dated brief, not a spec |
| `review-prompt-client-ui-round3.md` | Round-3 client UI review brief; records the deliberately absent W2a / WFLOW / DomainImpact / To-confirm / W28–W31 scope; fixes in `f5e86ae37` | Review method — dated brief; the scope note is the honest record of what #740 left out |
| `review-prompt-client-ui-round4.md` | Round-4 client UI review brief; fixes in `c984ec5ef` | Review method — dated brief, not a spec |
| `review-prompt-client-ui-round5.md` | Round-5 client UI review brief; fixes in `5f0f99dee` | Review method — dated brief, not a spec |
| `prompt-editorial-backend.md` | Codex dispatch prompt for the editorial backend readers (merged as PR #745 / #746) | Dispatch prompt — historical once merged |
| `prompt-client-loop.md` | Claude Code dispatch prompt to finish the client PWA in a worktree: Phase 0 fixes, D1 close-the-loop (W2a, W4, DomainImpact rows, WFLOW, claims, W25), D2 Offer over time (W32, W34, W35); written from `reports/build-review-2026-08-21.md` | Dispatch prompt — re-verify its "Present state" before use |
| `reports/build-review-2026-08-21.md` | Layer-by-layer build review of the PRD-650 tree: status board, coverage tables, severity-ordered findings, tracking drift, ranked risks, next moves, and the commands run | Dated review evidence — findings carry file:line anchors as of `develop@665e8a573` |
| `prototypes-artifact.build.ts` | Generator for the Flow Prototypes artifact; reads the `hifi/` registry alone (the retired `prototypes.md` stays as history, register #96) | Generator — never hand-edit its output |
| `card-explorations.build.ts` | One-shot cycle/promise card study retained until the Components tab supersedes the review artifact | Design exploration — not canonical implementation truth |
| `visual-assets.md` | Index of the audience graphics (SVG + 2x PNG) + style contract + regeneration; the ongoing-Offer story and architecture assets are published | Asset index |
| `visual-assets-artifact.build.ts` | Generator for the Visual Asset Gallery: routes `diagrams.md` + the hand-drawn SVGs into three tabs (Screens tab retired 2026-08-11, register #98 — screens live in the Flow Prototypes artifact), derives every per-diagram colour/cardinality/arrow key, and enforces the section/block/key-count invariants | Generator — the gallery's build-time gate |
| `visual-assets-prerender.ts` | Freezes each gallery Mermaid block to inline light+dark SVG and writes the one publishable file; `--verify <file>` re-checks a candidate | Deploy step — **only its output may be published** |
| `session-state-admin-canvas.md` | Session-continuity handover for the admin-canvas work stream | Execution context — not canonical design or contract truth |
| `acceptance-matrix.md` | Exact copy / state / public-claim targets for handoffs and QA | Acceptance targets |
| `architecture-closure-matrices.md` | Complete event/replay, retry/idempotency, persistence-truth, and lifecycle/wind-down inventories | **Binding cross-lane closure contract** |
| `tsconfig.json` | Typecheck config for `hifi/**` — the only thing that reads these state unions. Nothing above `.plans/` typechecks: biome is scoped to `packages/**` plus md/json, oxlint to `packages/*/src`. Added 2026-08-19 after eight phantom state ids reached the tree | **Run before merge** — `node …/typescript/lib/tsc.js -p tsconfig.json` |
| `architecture-closure.validate.ts` | Machine gate for all 58 ABI-closed events, 28 entities, 86 module functions, seven enum vocabularies, eight sparse-event materialization cases, 62 executable calls, six jobs/persistence states, eight lifecycle subjects, and required source assertions | **Must pass before dispatch or merge** |
| `backfill-pools.ts` | Bun-wrapped, finalized-block pool-inventory and Safe-receipt verifier; fails closed on inventory/root drift and the frozen backfill-before-unpause ABI conflict | Phase A release tooling only; no broadcast authority |
| `reports/corrections-log.md` | Claim-by-claim verification ledger (VERIFIED / CORRECTED / UNVERIFIABLE / SUPERSEDED) | **Correction record — §9 owns the fund-topology correction** |
| `external-brief.md` | Pointer to the canonical Google Doc plus the repo's implementation/evidence source map | **Pointer only — never a prose mirror** |
| `reports/audit-2026-07-20.md` | Original CP-AUD-001–021 dispatch-readiness audit | **IMMUTABLE INPUT — never edit** |
| `reports/audit-wave-1-2026-07-20.md` | Post-correction Wave 1 P0/P1 re-audit and lane-release record | Dated audit evidence |
| `reports/audit-final-2026-07-20.md` | Final CP-AUD-001–021 repository disposition and external blockers | Dated audit evidence |
| `reports/erd-simplification-proposals.md` | Field-by-field pooling/settlement schema keep/merge/drop audit | Review proposal; only P6 is applied inline |
| `reports/exchange-wave-gdoc-checklist.md` | One human reconciliation pass for exchange-wave and held-over narrative deltas | Checklist only; no Google Doc prose mirror |
| `reports/standing-commitments-gdoc-checklist.md` | Exact August 2 canonical Google Doc edit/re-read checklist plus post-artifact image follow-up | Checklist only; no Google Doc prose mirror |
| `reports/external-verification-2026-07-20.md` | Current GoodDollar/House of Alignment/token/market claim verification | Distribution gate |
| `reports/confidential-fourth-garden-signoff-2026-07-20.md` | Name-free human absence-attestation form | **Pending human sign-off; distribution blocker** |
| `reports/linear/linear-apply-pack.md` | Applied 2026-07-11 history plus the appended, unapplied 2026-08-01 exchange-wave section | Preserve applied history; only the dated exchange-wave section is a ready-to-apply pack after live reread |
| `reports/linear/linear-update-pack.md` | Earlier reconciliation pack, superseded | **ARCHIVE — do not execute or re-apply** |
| `reports/codex-readiness-review-2026-08-05.md` | Codex implementation-readiness and gallery-correctness review; its P1/P2/P3 findings are closed in this hub | **IMMUTABLE INPUT — never edit** |
| `reports/eip170-size-wall-2026-08-08.md` | EIP-170 discovery (module was 2.30× the deploy limit), the deployed-library restructure, the `check:sizes` gate, verification evidence, deploy-ops follow-ups, and the compiler-research snapshot | Dated engineering record — binding rules live in `contract-spec.md` §6.1 |
| `reports/phase-a-release-engineering-review-2026-08-11.md` | Pinned Phase A batch ledger, adversarial release findings, validation receipts, predicted-identity boundary, and blocked verdict | **Immutable committed-range release review; grants no broadcast authority** |
| `reports/phase-a-release-scope-correction-2026-08-11.md` | Owner-approved Safe-policy/indexer-scope correction, one-password operator ceremony, fresh evidence, and remaining final-base blockers | **Dated correction record; grants no broadcast authority** |
| `reports/phase-a-ownership-deferral-2026-08-11.md` | Owner-approved paused/deployer-owned endpoint, current operator enforcement, and later ownership/backfill/unpause issue acceptance | **Dated correction record; grants no broadcast authority** |
| `status.json` | Machine state for the plan harness | Machine lanes |
| `handoffs/` (25 files) | Per-lane dispatch files. **`handoffs/README.md` § File index enumerates all 25**; `commitment-pooling-query-contract.md` owns the PRD-723 scope-lock proposal, `fable-phase-a-release-review.md` owns the final pre-Phase-B independent review prompt, `claude-full-pooling-visual-docs.md` owns the additive hand-drawn Story and canonical Google Doc pass, `human-release-ops.md` owns broadcast/cutover authorization, and `human-settlement-evidence.md` owns the September operational-assignment gate | Per-lane dispatch |
| `artifacts/visuals/` (42 files) | The 21 hand-crafted SVG assets and their 2x PNG upload companions. **`visual-assets.md` is the per-asset index** — it names every file, its Google Doc placement, and what it must show. Nothing here is generated by a build script; each pair is authored | Published audience graphics |
| `hifi/` (22 files) | Executable hi-fi screen registry consumed by `prototypes-artifact.build.ts`: `screens/{client,client-wallet,admin,settlement,exchange,funding,public,index}.ts` plus `journeys.ts`, `validate.ts`, `types.ts`, `fixtures.ts`, `tokens.ts`, `player.ts`, `html.ts`, `ascii.ts`, `icons.ts`, `kit.ts`, `legacy.ts`, `components.ts`, `frames.ts`, and the generated `state-reference.gen.ts`. The closure validator asserts directly against `screens/client.ts`, `screens/admin.ts`, `screens/settlement.ts`, `journeys.ts`, `types.ts`, and `validate.ts` | **Executable state/journey truth for the prototypes** |
| `operations/` (20 files) | Live-chain operational evidence, one directory per operation. `steward-hat-relabel/` holds the PRD-748 Steward relabel: `README.md` (its own index), the `prepare.ts` / `relabel.ts` / `refresh-direct-plan.ts` scripts, dated `preflight-*` / `steward-upgrade-baseline-*` / `direct-admin-plan-*` / `execution-partitions-*` JSON captures keyed by chain and block, plus `preflight-findings.md`, `upgrade-plan-review.md`, and `post-execution-evidence.md` | **Dated operational evidence — captures are immutable** |
| `evidence/` (1 file) | Pinned external-dependency capture: `celo-zodiac-roles-mastercopies-2026-08-18.json` records the Zodiac Roles v2 mastercopy addresses the Celo settlement authority is pinned to. Added by PR #727, outside the prototype lane | **Dated external pin — immutable capture** |

**Published artifacts** (rebuilt from this hub, same URLs on each rebuild):

- [Flow Prototypes](https://claude.ai/code/artifact/19c3dcad-ac1d-4398-bcd4-57d0c892be2c) — 56 review-visible guided flows + 37 presentation-visible hi-fi screens (per the prototypes-coverage.md build snapshot, which stays authoritative as the registry grows; the build checks that number on every run since 2026-08-19); the one September Community source flow and wireframes remain hidden but validated (`prototypes-artifact.build.ts` + `hifi/`)
- [Visual Asset Gallery](https://claude.ai/code/artifact/007ef090-9e26-4b1d-898c-615155304d9d) — all assets rendered, three audience tabs: story · Architecture · Reference (`visual-assets-artifact.build.ts`; Screens tab retired 2026-08-11 per register #98, screens live in the Flow Prototypes artifact below)

**External-facing canonical home**: [Green Goods Commitment Pooling (Google Doc)](https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit). `external-brief.md` is a pointer and source map only; no repo file mirrors the external narrative.

## How to read decision citations

⚠️ **This hub has two independent decision lists, both numbered from 1.** A bare `#N` is therefore ambiguous in the range 1–68, and this has caused real mis-resolutions. Until a full renumber lands:

| List | Range | What it is |
|---|---|---|
| **Decision Log** (the table below) | 1–68 | Curated current-state decisions spanning the whole feature, newest last |
| **Full decision register** (further below) | 1–160 | The 2026-07-03 alignment session verbatim, plus dated addenda 28–160 |

- **Every `#1`–`#68` citation is potentially ambiguous** because both lists now occupy that range. Always write “Decision Log #N” or “register #N”.
- **`#69`–`#160` are unambiguous register numbers**, but naming the list is still preferred.
- **`#39`–`#40` became ambiguous on 2026-08-01**, when the Decision Log gained its CPP-alignment scope lock and staged-product narrative while the full register already carried different entries at those numbers. Name the list explicitly for both.
- **`#30`–`#38` became ambiguous on 2026-07-28 and 2026-07-30**, when the Decision Log grew its own entries 30–36 (the group-commitment/recognition/payout amendments), 37 (protocol-pool settlement parity), and 38 (pre-build review closure). The guidance here previously said `#30`–`#60` were always the register, which stopped being true the moment Decision Log `#30` was written; **`#34` is the worst case — it is cited ~71× and now resolves to two different decisions.** Every bare `#30`–`#38` citation predating 2026-07-28 means the register; name the list explicitly from now on.
- **`#29` became ambiguous on 2026-07-18** when the Decision Log gained its own `#29` (fourth garden not selected). Register `#29` is a different decision entirely. Always name the list for this number.
- **`#1`–`#68` must be resolved by reading both.** They diverge from `#8` onward: Decision Log `#17` = "app becomes multi-chain"; register `#17` = "clean room, GE paper only". Decision Log `#28` = the visual-asset audit; register `#28` = the needs-layer EAS schemas.
- **Sub-letters do not disambiguate** — both `#28` (Decision Log, a–f) and `#34` (register, a–h) carry them.
- **When writing a new citation, name the list**: "Decision Log #17" or "register #17", never a bare `#17`.

Known mis-resolutions fixed in place: `contract-spec.md` §Grassroots-Economics-grounding (was a bare `#17`, meant the register) and register `#36`'s reference to the lo-fi policy (means Decision Log `#13`, not register `#13`). A full renumber to distinct prefixes is a deferred follow-up — it would touch ~130 citations across files other agents hold.

## Decision Log

**Cite entries in this table as "Decision Log #N"** — see the disambiguation note above.

| # | Decision | Rationale |
|---|---|---|
| 1 | Commitments are module-native records, not EAS attestations; EAS gains exactly two schemas (assessment v3, community testimony) | EAS attestations are immutable one-shot records; commitment state changes constantly. User decision 2026-07-03, drawing on the Grassroots Economics structure. |
| 2 | `CommitmentPoolingModule` (control plane) + companion non-transferable ERC-1155-style `CommitmentRegistry` (classes, balances, quotas), voucher-shaped from day one | Compatibility-amended by Decision Log #51/register #86: a later adapter consumes eligible fulfillment facts on the same `poolId` while issuing a separate `voucherClassId`; it never wraps the registry class as the same identity, and no proof construct gets replaced. Supersedes PRD-649's single-artifact stance (user-approved). |
| 3 | Hybrid state weight: hard transitions on-chain (seed, offer/request, accept, evidence count, ReadyForConfirmation, Fulfilled, cancel/expire, dispute flag, cycle open/close/compost, pool pause); Draft and review-soft states derived | Full three-machine on-chain would be the heaviest contract in the repo; EAS is not indexed so events must carry everything the indexer needs. |
| 4 | EAS bridge: WorkApprovalResolver try/catch hook (GAP precedent) + steward `syncWorkDecisions` fallback; pooling maintains a bounded enumerable active Work set, catch-up proves supplied decisions are current, and every readiness/direct-fulfillment freeze proves the complete set matches the resolver; inactive rejected Work may be unlinked despite historical approval delivery | Automatic state without blocking decision attestations; omitting stale Work A while syncing Work B cannot freeze credit, and reversible pre-freeze credit preserves the live Work correction model. |
| 5 | Protocol pool = root garden (tokenId 0) pool, poolType PROTOCOL, cross-garden claim reach | Reuses existing custody and hats; no new identity machinery. |
| 6 | Per-commitment claim mode (open vs approval-gated) set at seeding; declared reward carries an explicit rail. `ArbitrumExternal` uses operator-recorded `ConsiderationPaid`; `CeloSettlement` stores zero source/token sentinels and lets the separate SettlementModule derive its configured canonical G$; `None` has zero reward fields. The core module never custodies funds and the two payout records are mutually exclusive. | Zero CookieJar contract changes in August; custody stays where it is. Rail discriminator clarified by review on 2026-07-23. |
| 7 | Lightweight evidence object (IPFS CID via module event) for SupportService/StewardCaptured; Offer recipient or Request creator confirms by default, named groups exclude the lead provider, and “Not yet” raises a dispute; DomainImpact keeps full MDR | One direction-aware human loop for low-stakes mutual aid without contributor self-confirmation; full approval rigor where impact is claimed. |
| 8 | v3 authorship split: baseline = evaluator or operator; delta/re-assessment = Evaluator Hat only; testimony = Community Hat only | Preserves analog capture while keeping the two-voice evaluation model clean. |
| 9 | Surfaces: PWA Garden tab + WalletDrawer pools panel; admin Garden workspace + Community workspace Pools mode + Hub queue; editorial GardenDialog + /impact; September `packages/community` as an independent PWA at `community.greengoods.app` (local port 3010) after shared runtime/auth/offline/shell foundations are extracted | Q&A decisions 9, 10, 21, 3; WalletDrawer already reserves the commitments tab and `/community` is the canonical admin operational workspace. |
| 10 | Clean room: Grassroots Economics paper + public docs only, never AGPL Sarafu source | RESR-57 D3 + non-AGPL constraint. |
| 11 | Seasons & Campaigns project converted in place; legacy season issues composted with pointer comments | Seasons and campaigns are cycle types inside the pool; separate project inverted the dependency. |
| 12 | Out of scope everywhere: bridged G$, bridge custody or unbounded value authority, a `packages/agent` settlement relayer/write path, Sarafu integration, transferable settlement vouchers / `settlementAdapter` activation, indexing Celo/G$ transfers, garden-to-garden federation, leaderboards, public credit scores | Supersedes the stale "no Celo/no G$" wording. Split-state G$ settlement is in August via PRD-686; these guardrails keep the settlement rail bounded. Optional later agent alerts are read-only and carry no settlement authority. |
| 13 | Design artifacts live in this folder: low-fi in-repo wireframes for all four surfaces (`wireframes.md`) + mermaid diagrams (`diagrams.md`) + the consolidated permission matrix (contract-spec §6.1); docs-site promotion rides PRD-727 at ship (historical label PRD-680) | User alignment 2026-07-04 (post-#619 audit): understand flows on screens before build; low fidelity on purpose; the docs site describes what is live. |
| 14 | G$ split-state settlement enters the **August release** through message-only CCIP: Arbitrum `SettlementModule` derives and dispatches the command; bounded Celo `CeloSettlementExecutor` executes as a Zodiac Roles member; an authenticated Celo → Arbitrum acknowledgment is the only path to `Confirmed`. Contract state is `Queued → Dispatched → Confirmed | Failed`; individual cancellation is limited to unbatched Queued or authenticated Failed items, while a Queued batch cancels atomically in full. The UI additionally derives distinct delivery-delayed and executed/ack-pending views without creating new mutable settlement states. No manual report or verification path exists. | User re-freeze 2026-07-23 after Chainlink Functions retirement; supersedes the 2026-07-10 receipt-verification transport while preserving split-state custody. |
| 15 | Fund topology: HoA stream → GG protocol Safe (Celo) → garden Celo Safes → gardeners. One deterministic Safe mapping per garden, deployed on demand. Pilot recovery is exactly 2-of-3: protocol multisig, Dev Guild recovery multisig, and named garden recovery delegate; no owner is an executor. Green Goods queues only the derived ProtocolToGarden funding route; HoA → protocol Safe remains upstream context. | User-confirmed topology and settlement trust review through 2026-07-10; working-capital hop removed by user decision 2026-07-18 (corrections-log §9). |
| 16 | Gardeners receive G$ at same-address smart accounts on Celo only after the AA/bundler/paymaster gate passes. If it fails, automated gardener delivery and gardener sends remain blocked while ProtocolToGarden funding may continue; no alternate gardener-claim path ships. | User decision 2026-07-10; settlement-spec §5. |
| 17 | The app becomes multi-chain this iteration: primary chain (`VITE_CHAIN_ID`) + settlement chain (Celo 42220). Status reads from the indexer and Safe balances use a second viem client; gardener balance/send surfaces ship only after `gardenerDeliveryEnabled` records the AA/paymaster gate. | User decisions through 2026-07-10; settlement-spec §5. |
| 18 | Borrow-and-repay becomes a blocked follow-on lane: `CreditRegister` is designed in `../commitment-credit-follow-on/spec.md`, but it is not part of the August base MVP and is not dispatchable without an explicit unblock. **SUPERSEDED 2026-08-01 by Decision Log #39**: explicitly unblocked into the August wave; dispatch gates remain. | User decision 2026-07-06; keeps GE mutual-credit design visible without expanding the hard August commitment. |
| 19 | `status.json` uses only plan-hub canonical machine lanes (`contracts`, `state_api`, `ui`, `qa_pass_1`, `qa_pass_2`); detailed workstreams remain as `execution_sub_lanes` and this checklist | Keeps `node scripts/harness/plan-hub.mjs validate`, `list`, and `record-tdd` usable without losing the Codex/Claude sub-lane breakdown. |
| 20 | ~~Linear sync is explicit parent-only for this hub (`linear.laneSyncMode = parent_only`)~~ **SUPERSEDED 2026-07-20 by register #37** — `laneSyncMode` is now `lane_issues` and each execution sub-lane carries a thin Linear issue. This entry is the Decision Log twin of register #31; both are superseded together. | Original rationale: preserved the low-noise Linear footprint and avoided using PRD-650 as fake lane issue IDs. The issue-cap constraint behind it lifted; the anti-duplication rule it protected survives as register #37's "lane bodies must not restate handoff scope". |
| 21 | Commitment domain scope is optional and multi-valued. DomainImpact uses repeatable `CommitmentRequirement { actionUID, requiredCount }` rows; actions may share a domain, while domains are derived tags rather than a positional uniqueness constraint. UID `0` is valid and array presence is the binding signal. The UI starts with four visible rows but can add more. A named `MAX_REQUIREMENTS` replaces the accidental four-domain cap; 16 is the provisional target and implementation must benchmark 8/16/24/32 before freezing it. `CommitmentCreated` emits every immutable requirement fact, and approval-gated claims use a commitment-keyed companion index for deterministic decline/accept/supersede handling. | User architecture amendment 2026-07-28. The old max-four rule came from coupling requirements to the four-value `Domain` taxonomy, not from a product or gas decision. |
| 22 | G$ reward commands derive garden/recipients/amounts from a frozen fulfilled-commitment payout plan. The funding route remains exactly ProtocolToGarden and independent from rewards; token, Safe, target, and calldata are never caller supplied. The payer garden Safe pays eligible contributors (amended by Decision Log #56: the payer is the asking side, which equals the provider for garden-internal commitments and differs in the protocol pool), with an explicit garden-retained amount and one child disbursement per non-zero contributor allocation. The versioned command/ack tuples remain frozen in `settlement-spec.md`; same-key retries are idempotent; acknowledgment retry is independent; only an authenticated success acknowledgment for the subject's current key/attempt produces `Confirmed`. Batch membership is immutable, the compile-time ceiling is 24, and the production limit remains measurement-gated; failed contributors reconcile independently. | User architecture amendment 2026-07-28. This preserves the bounded CCIP machinery while replacing the singular-beneficiary assumption with a garden-managed distribution plan. |
| 23 | Pilot focus cohort named: operational artifacts (RESR-58 scenarios, RESR-62 survey, July tracking doc, PRD-701 onboarding) carry only Tech and Sun Hub (Awka, Nigeria), Greenpill Cape Town (Muizenberg / Deep South Circles), AgroforestDAO / Redemption Hill (Bias Fortes, Brazil), plus one TBD mature MRV-adoption garden selected via parallel deep research; other synthesis gardens stay narrative context. RESR-58's document is garden-first (journeys as the coherence layer, mechanism scenarios as the normative appendix, new S11 institutional-partner and S12 MRV-adoption scenarios); UNICEF is modeled as an off-platform partner (exports + receipt-checked FundingAttribution, no account or confirmation role). Naming a candidate never presumes readiness. | User alignment Q&A 2026-07-10; RESR-53 was canceled 2026-07-06 and folded into RESR-62's unified instrument. |
| 24 | July operator cadence and settlement breadth aligned: PRD-701 moves to due 2026-07-30 (operator engagement lands with RESR-62's window; the 2026-07-31 dry-run milestone holds; the 07-16 Product-cycle boundary stays a cycle fact, with outreach expectations only). Every focus garden is G$-settlement-capable in August (one Celo Safe per garden, on demand); Tech and Sun Hub is the first-execution hypothesis and Pass-2 evidence orders the rollout — supersedes the derivative-level "single Pass-2-confirmed garden, sink-first" wording (the settlement lane was always per-garden; no gate, ABI, or acceptance change). TAS is the single Awka hub today (multi-hub stays roadmap/vision). UNICEF is a funded program for Greenpill Cape Town's waste work (partner stays off-platform; Pass 1 captures reporting cadence/deadline and funding path). | User alignment Q&A 2026-07-11 (plan-mode session); settlement-spec.md and codex-settlement handoff grep-verified free of single-garden assumptions. |
| 25 | Garden 4 selected: a candidate was chosen as the mature MRV-adoption anchor, owning the B4/S12 journey with the es locale proof riding B4. **Superseded by Decision Log `#29`; no selection was ever made, and the candidate is deliberately not named in any tracked artifact.** Slotted into RESR-58 Part A/B4 and the reward-path matrix, the July tracking rows, RESR-62/PRD-701/RESR-57 cohort lines, and the external-brief cohort. Pass 1 verifies the five selection criteria as evidence, not assumption. | User selection 2026-07-11 (read out in session; supersedes the deep-research TBD slot). |
| 26 | Fourth-garden hold: the #25 selection is NOT presented until first contact is made. All presentation-facing and operational artifacts (RESR-58 doc/issue, RESR-62, PRD-701, RESR-57, July tracking doc, external brief, rollout plan, research-plan) carry an anonymous "fourth garden — in outreach, named only once participation is confirmed" slot with the selection criteria retained; the outreach target's name lives only in this decision log and internal notes. The three named gardens alone cover all four action domains, so the four-domain claim stands. In the same pass, the RESR-58 document was reformatted (audience-entry table, TOC, terms box, role legend, per-journey template, S-style headings, bulleted Part D) and strengthened per the 25-finding audit — including new S13 (declared reward → ConsiderationPaid, the only July reward rail) and S14 (protocol pool + cross-garden claim, the dry run's mechanism), "campaign cycle" disambiguation per contract-spec's own rule, and bidirectional B↔S cross-references. | User decisions 2026-07-11 (second plan-mode session): present only what is accurate; audit findings L1–L8 / C1–C8 / G1–G9. |
| 27 | **SUPERSEDED 2026-07-18 by Decision Log #29 (fourth garden NOT selected, slot open) — do not re-apply without a fresh owner decision; it has been reversed twice.** ~~Fourth-garden naming stands (supersedes #26's hold)~~: **the candidate** was named across coordination and presentation artifacts with the **"selection is not participation"** guardrail — no external claim stated it participates until its corrected mandate was confirmed (RESR-62 evidence; naming never presumes readiness). The live Linear r4 pass of 2026-07-11 afternoon (RESR-58 doc r4 + issue, RESR-62, survey + Pass-2 call docs, external brief, rollout plan, manually uploaded companion graphics) is the canonical presentation state; repo artifacts align to it, and the same-day "naming regression" classification is retracted. | User decision 2026-07-11 (confirmed during the commit/reconciliation session after evidence review of the r4 pass). |
| 28 | Visual-asset audit decisions: (a) per-action required counts — `requiredApprovedWorkCounts[]`/`approvedWorkCounts[]` positional with `requiredActionUIDs`, ReadyForConfirmation requires every requirement met, `approvedUnits = floor(targetUnits × Σ min(approved, required) / Σ required)`, `ApprovedWorkCounted` gains `requirementIndex`, indexer gains `CommitmentRequirement` (contract-spec amendment 2026-07-18); (b) fund topology corrected — HoA stream lands directly in the GG protocol Safe, single ProtocolToGarden route (#15 updated); (c) **Garden Steward** is the standardized CP role name (steward = operator/owner Hats; app-wide rename is a follow-up); (d) W22 batch operations move to a NEW admin **Operations** workspace (initially deployer-gated; authorization superseded by Decision Log #37) and the former oracle treatment is superseded by CCIP command/ack health; (e) pool-surface history = per-view filter chips, no History stage; (f) W6 home summary card retired — WalletDrawer Commitments tab header is the only promises summary. | User visual-asset audit, three AskUserQuestion rounds, 2026-07-18 (corrections-log §9–10), presentation label reconciled 2026-07-23. |
| 29 | **Fourth garden is NOT selected — supersedes #25 and #27.** No candidate was ever selected — the earlier entries recorded an option under consideration, not a decision. The fourth slot is **open**. No artifact — repo, Linear, Google Doc, graphics, or presentation prose — names a fourth garden; all describe the slot as open with its selection criteria retained. Any candidate's identity lives in research-notes storage only — **this repository is public**. The three confirmed candidate gardens (Tech and Sun Hub, Greenpill Cape Town, AgroforestDAO / Redemption Hill) cover all four action domains on their own, so the four-domain claim stands without a fourth name. **Never re-introduce a fourth-garden name without an explicit new selection decision.** | User correction 2026-07-18, on review of the doc-consolidation pass; candidate name scrubbed from every tracked artifact 2026-07-19, after it was found stated in the same sentence as the rule forbidding it. |
| 30 | Every accepted commitment has one accountable `leadProvider` plus an explicit event-indexed contributor roster; a solo commitment is a team of one. Contributor policy is fixed at creation as Open or LeadManaged, optional requirement assignments are supported, and the roster freezes at ReadyForConfirmation. Only active contributors may link Work or receive evidence attribution. Every contributor is excluded from confirmation, while the register's open-commitment cap remains charged only to the lead provider. | User architecture amendment 2026-07-28. Accountability stays legible without erasing the group that actually completed the work. |
| 31 | Gardener-class Hypercert recognition is allocated equally across fulfilled commitments by default, then within each commitment uses the immutable cycle-open `RecognitionPolicy`; 20% equal participation plus 80% verified contribution is the protocol default, not a fixed invariant. Approved Work remains the reviewed repeatable quantity signal; repeatable evidence remains provenance but contributes at most one participation credit per contributor. Commitment-level bps remain stable, while integer units are persisted per Hypercert + commitment + contributor. The exact `liveCommitmentCount`, including Offered/Requested rows, is indexed for close preflight. The shared composer used by every route accepts only an exact on-chain Reconciled cycle, so `closeCycle` locks the fulfilled set before any certificate can mint; compost follows mint. | User architecture amendment 2026-07-28, recognition integrity clarified 2026-07-29. Cross-commitment raw work units are heterogeneous, and no alternate creation route may certify an open set. |
| 32 | A commitment payout plan begins from the final Hypercert recognition weights, then permits steward edits with a required reason and an explicit `gardenRetainedAmount`. Recognition and payment remain distinct records and are shown side by side before dispatch. The invariant is `declared reward = retained amount + sum(non-zero contributor payouts)`. | User scope lock 2026-07-28. This is the approved default for the remaining allocation question, while preserving room for funding constraints and community judgment. |
| 33 | Contributor payout plans are explicitly finalized before any child preparation or dispatch. Finalization verifies the recognition and amount-derived payment vectors plus exact conservation, makes the plan immutable, and creates no child. A later idempotent per-contributor preparation materializes one Queued child from a frozen non-zero row. A zero-child all-retained plan completes at finalization without a self-transfer. Recipients must be frozen eligible contributors and their Celo accounts are derived, never typed as arbitrary addresses. Overall plan status includes unprepared rows plus child states; partial success is visible, failed contributors requeue independently, and child cancellation never clears the one-plan-per-commitment pointer. | Review closure 2026-07-28, child lifecycle clarified 2026-07-29. It preserves the bounded settlement state machine while preventing editable-draft or finalization-created orphan children. |
| 34 | The UI separates three relationships everywhere they matter: who is accountable, who contributed, and who is paid. Team membership, requirement credit, contribution evidence, recognition weights, payout edits, retention, partial settlement, and per-recipient receipts are first-class states across W2/W2a/W2b/W3/W4/W8/W10/W11/W21/W22/W23/W25/W26. | User architecture amendment 2026-07-28. A multi-person data model without visible composition and correction paths would reproduce the same singular-provider UX failure. |
| 35 | This amendment updates planning, diagrams, prototypes, ontology/docs, and tracker mirrors only. Product contracts, indexer, shared state, UI packages, deployment, broadcast, Safe authority, and value movement remain blocked behind their existing lanes and proof gates. | Scope boundary for the 2026-07-28 alignment pass. |
| 36 | Automatic Hypercert allocation has no unearned lead or metadata-only fallback. Ready transitions and direct Fulfilled dispute resolutions require an available recognition policy and at least one verified contributor; W26 blocks inconsistent legacy/indexed zero-eligible state pending governed correction. Commitment creation accepts only `actionUID`/`requiredCount` for DomainImpact; evidence jobs persist their explicit credited-contributor vector while each contributor receives at most one evidence-derived recognition credit; each Work UID counts once; Garden claims reject both a creator claimant and creator requester; settlement creation binds the full recognition vector to its hash and derives payment weights from amounts. | Review closure 2026-07-28, tightened 2026-07-29. These constraints make the recognition and payout audit trail internally verifiable and keep caller-authored derived fields out of contract inputs. |
| 37 | **Protocol-pool settlement parity with an explicit treasury-funding exception.** The protocol pool is the root garden's ordinary commitment pool: Garden and Individual claims use the same claim → accept → work/evidence → confirmation → Fulfilled lifecycle, and a fulfilled `CeloSettlement` commitment proceeds through the same provider-garden payout-plan primitives as every other pool. The app exposes create/edit/finalize/prepare actions from canonical indexed state; there is no sixth offline settlement job and no second reward approval after fulfillment. `queueFunding(garden, amount)` remains in the initial version only for discretionary, non-commitment garden seeds/top-ups. Operations access is capability-gated by any of `isDeployer`, `canQueueFunding`, or `canOperateSettlement`, while the form itself requires current protocol-steward or SettlementModule-owner authority; deployer alone cannot submit. A successful submission emits a typed `Funding` / `ProtocolToGarden` Queued row with no commitment ID. | User alignment in PRD-759 and explicit 2026-07-30 merge lock preserving develop's payout-plan architecture. This reuses the existing pool, plan, and disbursement primitives without adding per-device coordination or granting an agent/keeper value authority. |
| 38 | Pre-build review closure: gardeners may create cycle-less commitments (the Open-cycle rule binds only when `cycleId != 0`); Garden-claimed commitments are confirmed by the claiming garden's resolved operator/owner Hat wearers, never by the GardenAccount through ERC-6551 `execute`; deployer-EOA ownership of the three live proxies is knowingly accepted for the non-custodial/non-transferable tier, extending register #38's residual-risk acceptance to ownership and waiving the `AGENTS.md` 3-of-5 rule for that tier alone; and the 2026-07-31 Build close is recorded as known drift for Afo to re-date in Linear rather than silently corrected in this mirror. | User decisions 2026-07-30, taken on a four-lane pre-dispatch review that found one compile-blocking interface defect and twenty-nine further specification and artifact gaps. The value tier keeps every ownership, audit, timelock, and canary gate in full. |
| 39 | **CPP-alignment additions (pre-build; standing clause amended by Decision Log #46–#48).** Two additive commitment-record fields land in the initial deploy: `declaredUnitValue`/`declaredValueBasis` and `counterCommitmentId`. The `CreditRegistry` borrow-and-repay chain is unblocked into the same August wave under its own gates. `PoolMemberHistory` remains pool participation history, while the former app-only “counts-only standing” conclusion is superseded by module-native `CommitmentSeries`. Rotation and reserve/redemption framing remain app/read-model work. Transferable vouchers, relative-pricing enforcement, protocol-consumed standing, and succession stay excluded. | User decisions 2026-08-01, amended by the 2026-08-02 recurring-commitment scope lock; registers #71–#73 and #81–#83. |
| 40 | **Commitment Pooling is built in stages; "commitment coordination" names its first layer, not a product rename.** External and implementation-facing narratives distinguish current/planned/evidence-gated horizons. The August contract scope now includes the series amendment in `standing-commitments-spec.md`; the former “counts-only standing with no additional Solidity” statement is superseded. Rotation and reserve framing remain app/read-model work; succession, garden-to-garden routing, transferable vouchers/exchange execution, and relative-pricing enforcement remain later seams. | User scope clarification 2026-08-01, amended by the 2026-08-02 recurring-Offer and Offer-only vocabulary locks. Prevents honest staged delivery from being misread as either a reduced product or a claim that later mechanics already ship. Register #74 as amended by #81–#85. |
| 41 | **Atomic bilateral paired acceptance joins the August contract scope.** `acceptExchange(B)` resolves one-way counterpart A, permits only Offer×Offer / Offered×Offered / Individual×Individual pairs with distinct creators, and lets A's creator atomically accept both sides. Ordinary per-side cycle and identity predicates remain, and both exact full reservations must still belong to their creators. Under the 2026-08-02 capacity correction both Offer classes/slots are already committed from creation, so the two ordinary acceptance events, two creator-lead `ContributorAdded` events, and one exchange marker succeed or revert together with no second registry commit or provider-cap headroom check. Cap headroom applies only to a new reservation. After acceptance, neither lifecycle transitions the other. | Afo decision 2026-08-01, accounting effects amended by the 2026-08-02 standing lock. Exact semantics are in `contract-spec.md` and `standing-commitments-spec.md`. Register #75 as amended by #82. |
| 42 | **PRD-651 gains a canonical design-only exchange-architecture brief.** `exchange-architecture-brief.md` specifies the ladder from reference record to bilateral acceptance to later voucher wrap, quoter, limiter, and venue, including the Sarafu-pool hybrid fork and evidence/partner/audit/legal gates. `settlementAdapter` and `settlementEnabled` activation remain gated and outside August scope. | Afo decision 2026-08-01. The brief makes the reserved architecture reviewable without dispatching it. Register #76. |
| 43 | **The August app lane gains an exchange-pair flow, an Offer-template library, and a noun-reduction/plain-language pass.** The work reuses shipped primitives, adds no chain state beyond the already-approved exchange fields/function, introduces no new module calls beyond creation plus `acceptExchange`, and keeps templates as content/config only. | Afo decision 2026-08-01. Canonical UX is `uiux-spec.md` Appendix E with W28–W31 and planned journeys SB-35/SB-36. Register #77. Aug 12 remains a stretch date and every evidence/authorization gate binds unchanged. |
| 44 | **Selected protocol-team confirmation fallback (pre-build).** A commitment may explicitly set `protocolFallbackEnabled` at creation or through the pre-acceptance `setConfirmerRule`. The module stores one write-once `protocolPoolId` from the existing root/community garden's `PoolType.Protocol` registration and resolves its current steward/owner Hats dynamically; no address is hardcoded. Ordinary named/default reachability is evaluated first, but an explicitly selected protocol path satisfies structural reachability when the small garden otherwise has no eligible confirmer. `confirmFulfillmentAsFallback` checks current local-garden Hats first (`PoolFallback`), then selected current protocol-garden Hats (`ProtocolFallback`); module ownership alone is not confirmer authority. Mandatory reason and absolute contributor exclusion remain. `CommitmentFulfilled` emits confirmer plus `ConfirmationPath`, and surfaces render protocol provenance as "confirmed by Green Goods team — fallback". | Afo decision 2026-08-02, refined in the implementation-readiness follow-up. Motivation is the pilot's small, newly established gardens, where one person often both seeds a commitment and works it, leaving nobody eligible to confirm inside that garden. Exact ABI/storage/reachability semantics are in `contract-spec.md` amendment 2026-08-02. Register #79. This closes the architecture question before Solidity exists; dispatch, deploy, and broadcast remain separately gated. |
| 45 | **The G$ circulation model has an explicit return leg: gardens spend earned G$ on Green Goods team services.** G$ a garden earns by keeping protocol-pool commitments is what it then spends on support sessions, onboarding, and workshops from the Green Goods team, closing the loop the corrected funding topology (`reports/corrections-log.md` §9) left open above garden Safes. `synthesis-circular-gd` draws the arc as a first-class leg and marks local merchant/store routes as unmodeled. **Both halves now settled** — the external question (whether charging gardens for protocol services is compatible with the House of Alignment circulation mandate) was confirmed by GoodDollar on 2026-08-08: they want to see circulation. The "awaiting confirmation" label is retired everywhere. Decision Log #56 additionally makes this leg a modelled, indexed path rather than a circulation-model claim. | Afo decision 2026-08-02, from the visual-gallery review. Supersedes the "no modelled return leg" status of §9b's topology note without closing §9b's external half. No contract, state, or settlement interface depends on the answer; distribution scaling and partner-facing claims do. |
| 46 | **The recurring identity is a module-native, pool-scoped `CommitmentSeries`.** An Offer used over time in one pool has direct-holder authorship, prospective metadata, Active/Resting/Retired lifecycle, and linked ordinary Offer instances. `0` remains the Offer-once sentinel. Reusable signed offchain Offer metadata may seed separate series in multiple pools, but no cross-pool merge or initial succession mutation exists. | Afo scope lock 2026-08-02, vocabulary amended by Decision Log #50. An inferred indexer grouping cannot validate authorship or create a durable protocol identity; saved Offer metadata itself does not become a public onchain obligation. Register #81 and `standing-commitments-spec.md`. |
| 47 | **Availability must reserve real capacity.** Offer creation registers and commits its full class quota against the creator, so every displayed Offered place already consumes one provider slot. Offer claim/acceptance and `acceptExchange` never recommit. Requests reserve only at acceptance. Unaccepted Offer cancel/expiry releases; unaccepted Request cancel/expiry has no registry effect. | Afo scope lock 2026-08-02. This prevents two visible places from competing for one remaining slot only when claimed. One place is one pre-created instance, not a claim-spawned record. Register #82. |
| 48 | **Compounding trust is exact Story, not reputation scoring.** Series and per-cycle rows expose linked instance counts and fulfilled-cycle IDs. “Kept N times across M cycles” is allowed; participant counts require separately labelled evidence. Reusable Offer metadata is signed offchain and private by default. No score, rate, rank, cross-pool reputation, protocol permission input, or automatic renewal exists. | Afo scope lock 2026-08-02, vocabulary amended by Decision Log #50. Repetition should build dependable social memory while keeping burden, privacy, and context visible. Register #83. |
| 49 | **Codex owns architecture/document/Linear convergence; Claude Code owns canonical prototype and gallery conformity.** Claude updates the source storyboards, hi-fi states, and visual assets against the locked model; it may not redefine series authority, capacity, persistence, visibility, or succession. Backend implementation remains contracts → indexer → shared state/API; runtime UI follows the canonical artifact gate. | Afo scope lock and agent split 2026-08-02. It preserves one architecture source while using the strongest artifact workflow for visual coherence. Register #84. |
| 50 | **Offer is the only product/domain noun for what a person provides.** The interface presents **Offer once** and **Offer over time** as two ways of using an Offer. `Practice` is removed as a defined object. `CommitmentSeries` remains internal durable identity for the ongoing path; finite pre-created places, exact Story, Ask me again next cycle, and Rest/Resume/Retire remain unchanged. “I’m learning this” is outside the initial Commitment Pooling Offer flow. | Afo vocabulary scope lock 2026-08-02. This reduces conceptual load without changing the approved Solidity, event, indexer, capacity, Story, or lifecycle architecture. Register #85 and `standing-commitments-spec.md`. |
| 51 | **Full-pool adaptability is frozen through three distinct identities.** Initial `classId == commitmentId` remains the immutable non-transferable promise-instance accounting identity; `commitmentSeriesId` remains the pool-scoped ongoing Offer identity; a future adapter-owned `voucherClassId` is a separate issuer instrument. References may connect them, but no holder transfer, confirmation authority, contributor record, recognition, or Story crosses with a voucher. This requires no new initial ABI, event, or storage member. | Afo architecture-closure direction 2026-08-03. It preserves the implementation-ready base while preventing a later voucher layer from forcing a registry migration or silently tokenizing promises. Register #86. |
| 52 | **The reserved `settlementAdapter` is a future versioned adapter/router seam.** Fulfilled-backed issuance is the first activatable mode and must prevent double consumption. Reserved-capacity backing remains disabled until separate consent, issuance, exposure, default, repair, legal, audit, liquidity, and authorization gates close. | Afo architecture-closure direction 2026-08-03. It makes the existing one-address Pool storage adaptable without binding it to one token implementation or treating `committedOf` as mint authority. Register #87. |
| 53 | **Full Commitment Pooling grows through explicit capability gates:** initial coordination → compatibility freeze → field evidence → fulfilled-backed voucher/redemption → one bounded pool with seed/exchange/redeem/repair → separately gated capacity backing and/or federation. G$ commitment support remains a separate rail and is never called voucher redemption by implication. | Afo architecture-closure direction 2026-08-03. One useful base can ship without pretending that later custody and exchange already exist; completing one stage authorizes none of the next. Register #88. |
| 54 | **Living delivery ownership is split at the media boundary.** Codex owns plan/spec, Linear, Mermaid Architecture/Reference, and final cross-source review. Claude Code owns hand-drawn Story SVG/PNG pairs and the canonical Google Doc prose/image pass. Google Doc edits are additive and must preserve its six-tab structure, plain voice, built/planned discipline, citations, and current review polish. This supersedes Decision Log #49/register #84's living Google Doc ownership without rewriting their dated history. | Afo delivery direction 2026-08-03. It protects concurrent artifact/document polish and uses the appropriate tool for each visual surface. Register #89. |
| 55 | **`CommitmentPoolingModule` behavior lives in deployed external libraries, gated by `check:sizes`.** The monolithically-assembled module measured 56,601 deployed bytes — 2.30× the 24,576-byte EIP-170 limit Arbitrum enforces — and was undeployable; no test or CI signal could see it. Behavior now runs in DELEGATECALLed libraries under `src/lib/CommitmentPooling/` beside the package's other libraries, with the module side collapsed to a six-link shell chain in `src/modules/CommitmentPooling/` (module: 21,198 bytes), and the frozen 38-entry + `__gap[12]` layout, the 86-function interface ABI, and every event byte-identical. Binding pattern rules: `contract-spec.md` §6.1 "Deployed-library architecture"; evidence: `reports/eip170-size-wall-2026-08-08.md`. Every future selector lands its weight in a library. | Afo direction 2026-08-08 after the size wall surfaced in architecture review. Verified same day: size gate green, 1,799 package tests, 36 Arbitrum fork-rehearsal tests, storage baselines unchanged. |

| 56 | **The settlement payer is the asking side, not the providing side.** A new immutable `payerGarden` records which garden's Celo Safe owes the declared consideration: a Request stores `pools[poolId].garden` at creation (the pool that made the ask), an Offer stores the claiming `gardenContext` at acceptance (the party receiving the service). `providerGarden` keeps its existing meaning — EAS recipient scope and provider-role/roster boundary — and is no longer the payer. Settlement derives `source`/`executorGarden` from `settlementAccounts[payerGarden]`, and payout-plan authority moves to the payer garden's steward, because no garden may spend a Safe it does not steward. The legacy `DeclaredReward` struct becomes `DeclaredConsideration` with direction implied by `payerGarden`; `amount == 0` means the commitment is free. Garden-internal Requests and Offers resolve `payerGarden == providerGarden`, so single-garden pools are behaviourally unchanged. This deliberately excepts the Decision Log #51 / PRD-796 "every event byte-identical" freeze; the exception is scoped to `CommitmentAccepted` **and** `CommitmentCreated` each gaining one trailing `payerGarden` argument, the consideration rename, and the new `ExchangeConsiderationUnsupported` error. **Amended after Codex review 2026-08-08**: `CommitmentCreated` was initially left unchanged on the reasoning that a Request's payer is derivable from `poolId`; review showed reverse delivery may project a commitment before `PoolRegistered`, and `CommitmentPool` carries no bounded reverse index to backfill from, so a reverse-delivered Request could strand a null payer permanently. The field is now emitted. The same review closed a second gap: `acceptExchange` derives one `gardenContext` for both sides, so a priced Offer×Offer pair would record a single garden — in the protocol pool, the protocol Safe — as payer for a two-person trade. Paired acceptance is therefore **barter-only**, enforced before either side mutates. **Amended after Codex round 2 (2026-08-08):** the "no new `DisbursementKind`" call was wrong and is withdrawn. Paying a garden Safe has no implementable path through the contributor machinery — plan creation allocates the whole amount across contributor rows, `prepareContributorPayout` only materializes a `ContributorConsideration` for a roster member, and a 100%-retained plan produces no payable row and completes locally, leaving the money in the payer Safe. `Funding` is deliberately not commitment-bound and `ContributorConsideration` cannot honestly classify a garden Safe. Settlement therefore gains `DisbursementKind.GardenBeneficiary` plus `prepareGardenBeneficiaryPayout(planId)`, with beneficiary-account rechecks at batch and dispatch and no `gardenerDeliveryEnabled` gate (that flag governs individual accounts, not Safes). No new `FundingRoute` member: flow direction stays derived from `payerGarden` vs `providerGarden`, which the disbursement already carries. **Retention is likewise constrained**: `gardenRetainedAmount` must be zero whenever `payerGarden != providerGarden` or the plan carries a beneficiary row, because otherwise a protocol Request would let the protocol withhold part of what it commissioned and a protocol Offer would let the paying garden withhold part of what it owes the provider's contributors. It keeps its original meaning only for garden-internal commitments. | Afo decision 2026-08-08. The protocol pool is the first pool whose asker and doer are different accounts; the provider-pays binding (Decision Log #44's lifecycle reuse, recorded in PRD-759) silently inverted both intended protocol-pool flows — the protocol asking gardens for events/surveys, and gardens spending earned G$ on Green Goods services. Supersedes the payer half of PRD-759 without rewriting its dated record, and closes the external half of Decision Log #45: GoodDollar confirmed they want to see circulation. Register #90. |

| 57 | **Who receives a commitment payout follows who claimed it.** The protocol pool asks for two kinds of thing and `claimType` separates them: garden-scoped work — running an event, a garden-scoped survey — is claimed by the **garden** through `ClaimType.Garden` (steward-only and protocol-pool-only), while individual work is claimed by a **gardener** through `ClaimType.Individual`. Settlement's recipient derivation follows that split (and **the claim that Garden claims were already protocol-only was false** — a garden pool's claim branch never inspected `kind`, so any member could make one and the claimant resolved to that pool's own garden, collapsing payer, provider, and recipient onto one account; creation and acceptance now both reject it with `GardenClaimRequiresProtocolPool`): a Request claimed by a garden pays exactly one recipient, that garden's registered Celo Safe; a Request claimed by an individual pays contributor accounts; an Offer always pays contributors, because its claimant is the payer and paying them would be a self-transfer. The record already carried the derivation inputs; the pooling module additionally rejects a protocol garden claiming itself through `GardenClaimMustBeExternal` (Decision #58). | Afo clarification 2026-08-08, after the payer correction exposed a loop that did not close. I had assumed protocol Requests were always gardener-claimed, which meant garden Safes could never accumulate G$ from fulfilling them and could only be funded by discretionary `ProtocolToGarden` seeding — so the intended circulation depended on a subsidy rather than on earning. Garden-scoped Requests being garden-claimed closes the loop without any new transfer leg, and retires the commitment-bound retention transfer floated as an alternative. The full declared amount goes to that garden Safe; retention remains only for garden-internal contributor plans. Register #91. |
| 58 | **Payout shape is immutable and every commitment-bound child shares one lifecycle.** Plan creation derives exactly one of `ContributorConsideration` or `GardenBeneficiary`. The beneficiary shape freezes the active external garden's registered Celo Safe, full declared amount, and one payable child; it has no contributor rows, cannot be edited into another shape, never uses `gardenRetainedAmount`, and cannot complete before authenticated child confirmation. Contributor retention survives only when payer and provider are the same garden. Missing/zero payer identity fails closed. Creation, finalization, first preparation, batch creation, and initial dispatch recheck the payer account; beneficiary shape additionally rechecks its receiving garden account and frozen Safe. A protocol garden may not institutionally claim its own Garden-scoped Request. Envio derives `CommitmentSettlementFlow`; actual Celo circulation remains outside its Arbitrum boundary. | Codex adversarial review round 3, accepted 2026-08-08. The prior prose added a beneficiary kind without adding fields, selectors, general counters, conservation, or status semantics, so a green validator could still describe an unpayable plan. `ContributorReward` becomes undeployed ordinal-zero `ContributorConsideration`; human copy is unchanged. Register #92 and PRD-800. |
| 59 | **The settlement contracts emit their own deployment identity.** `initialize()` on both `SettlementModule` and `CeloSettlementExecutor` emits the CCIP router, the local chain selector, and the remote EVM chain ID — immutables that were previously knowable only from the constructor. The indexer stops gating entity creation on configuration it has no source for. | Afo decision 2026-08-09, on the pre-merge review's Critical finding. `remoteEvmChainId`, `localChainSelector`, and `localRouter` had no writer anywhere in the indexer, so `SettlementMessage`, `SettlementExecution`, and `SettlementGardenRoute` could never be created in production and `peerConfigured` was permanently false — masked because the tests hand-seed those fields. Neither `CcipRouteUpdated` nor `SourcePeerUpdated` carries an EVM chain ID and the router is emitted nowhere, so the alternative was a static deployment map inside the indexer, whose failure mode is silent and stale. The contracts are undeployed, so the ABI addition is free now and impossible later. A scoped extension of the PRD-796 freeze exception. |
| 60 | **An acknowledgment must satisfy the live route, and a stranded subject has an owner-only exit.** Acknowledgment authentication additionally requires the snapshotted executor to still be the active peer, or the previous peer inside its unexpired grace window, per `settlement-spec.md` §3.1.3. Because that strands any command genuinely in flight at a zero-grace cutover — `requeue` requires `Failed` and `cancelDisbursement` accepts only `Queued|Failed`, so a `Dispatched` child would be unrecoverable — the module also gains a bounded owner-only path to mark such a subject `Failed` once the grace window has expired, emitting its own event. | Afo decision 2026-08-09, on the pre-merge review's M1. Authentication ran only against the `CommandRecord` snapshot, so a drained cutover — the strongest revocation the source offers — left the retired executor able to mark its in-flight commands `Confirmed` with no G$ moved. Closing that alone would have traded a security hole for a liveness hole, so the exit path is part of the same decision rather than a follow-up. |
| 61 | **Committing a garden to pay for an Offer requires a steward once the Offer is priced.** Claiming an Offer with a `gardenContext` requires `isGardenSteward` when the declared consideration is non-zero, and continues to require only `isGardenMember` when it is free. The ApprovalGated path re-checks the claimant's membership in `gardenContext` at final acceptance. | Afo decision 2026-08-09, on the pre-merge review's M4. The Garden-claim branch already required a steward while the Individual branch required only membership, so any gardener could bind their garden as the immutable `payerGarden` of a priced protocol Offer without any steward acting. No funds moved — the payer garden's own steward still has to create the payout plan — but the garden carried an unauthorized obligation record and reserved provider capacity. Pricing is the line because free peer-to-peer Offers are the common pilot case and should stay frictionless. This changes an expectation pinned in `CommitmentPoolingPayer.t.sol`. |
| 62 | **Protocol Safe policy is threshold >= 2 with at least 3 owners; the exact live 2-of-6 set is approved for this release.** The release manifest must freeze and the verifier must reread the complete owner set and threshold. Garden settlement recovery remains its separate exact 2-of-3 policy. Production indexer deployment is removed from this contracts release lane: PRD-722 receives only the verified contract address/start-block artifact diff and owns configuration, reindex, cutover, rollback, and read-back. | Afo decision 2026-08-11. This resolves the living 3-of-5 guide conflict without weakening exact-set verification, and prevents the old hosted indexer from being silently treated as part of the contracts ceremony. Fable review was already dispatched against `de7863391`; any later candidate requires a refreshed exact-range disposition. No broadcast or hosted deployment is authorized. |
| 64 | **Prototype UI reuses the shipping app's components and rhythms — never a parallel pattern.** Wizards render the real FormProgress chrome with back buttons; evidence is an MDR variant of Submit Work; the kind choice is equal cards; the promise detail carries people + team above the fold and one bar-held primary; ongoing is an inline expansion of the composer, not a detour; exchange is parked until it gets its own design session; "Request" is the single asking word; stewards declare G$ support in a real wizard step on the phone. | Afo's iteration-2 review, 2026-08-11: the correction pass fixed structure but not look-and-feel — flows still invented patterns the app already solves (dots vs FormProgress, sheet evidence vs MDR, X-only headers), the ongoing entry stayed invisible, and steward G$ had no phone surface at all. Register #102. |
| 65 | **PRD-722 indexes the deployed 58-event surface into 28 new records.** The old 54-event/26-record wording predates four member-funding events and `CommitmentFunding`. A twenty-eighth bounded `CommitmentFundingIndex` is required because `DisbursementQueued(kind=Refund)` emits `commitmentId` and the contributor/funder but not `fundingId`; it is the event-owned `(chain, commitment, funder)` join that lets Refund-before-pledge and pledge-before-Refund delivery converge without RPC reads or database scans. | Frozen-ABI reconciliation on 2026-08-13 against live PR #705 head `9948bd7507ac00d0b07f4efd30f6001dd92d84ab`. The extra record is a read-model necessity, not a contract or product-scope expansion. |
| 63 | **The client prototype catalog is a two-tier product: canonical journeys plus an exhaustive state library.** Seventeen client journeys each start at a drawn home surface, one person, one sitting; every offline/failure/cycle-state variant stays reviewable in the Screen library. The composer is entry-fixed with a details capture, and the ongoing and exchange paths folded in as choices; evidence and work capture share the shipping Submit-Work interaction; the work↔promise bridge is drawn in both directions; browse cards carry the D5 contract. Two new validator rules (entry-surface, one-row bars) keep both regressions impossible. | Afo decisions D1–D10, 2026-08-11 interactive plan session, after the deep client-PWA audit found the registry's state-coverage instrument being presented as UX journeys: wizard repetition across eight flows, mid-app starts, promise/offer vocabulary drift, unused MDR patterns, and a work-link mis-wired to the admin console. Register #101; admin findings recorded, not fixed, in `reports/admin-prototype-follow-up-2026-08-11.md`. |
| 66 | **The admin prototype set follows the shipping console contract, and four product framings are locked.** (1) View actions in the right-aligned header row with one fixed primary, consequential acts in `AdminDialog`, mobile = the same set on the `FabButton` speed dial with dialogs presenting as sheets — drawn by the restructured W7, the W7M phone set, and journey sb60. (2) Steward vocabulary: the two doors "Start a season" / "Start a campaign" replace "Open cycle"/"Seed a cycle"; pool lifecycle demotes to a Pool settings dialog; Season and Campaign render as peers everywhere ("cycle" stays docs-side umbrella vocabulary). (3) Season↔campaign attribution stays exclusive per the single `cycleId` binding; season reporting may add a clearly-labeled time-window roll-up of overlapping campaigns at the read layer only. (4) Assessments present timing-first ("For [cycle / this garden overall] · at the start / at the close") with wire kind + `baselineUID` derived and the existing schema untouched. Supporting fixes shipped in the same wave: the W11 recognition detour keeps its rail (new RAIL validator rule), W26 joins the flow-dialog shell and sb9c splits at act seams (sb9c/sb9d/sb9e), HUBWORK draws the complete approve/reject arc, W14 renders all three steps, W9 gains the steward-fallback confirmation path + not-a-member empty state + who's-who block (sb8b), and admin PWA echoes trim to the consequence-only rule. | Afo's admin prototype review, aligned interactively 2026-08-16. Of the 2026-08-11 admin follow-up findings this closes 3 (the sb9c split) and moves 5's substance (view-level acts no longer stack in content; dialog footers are the kit's right-aligned row) — a dialog action-row validator rule, plus findings 1, 2, 4, 6, and 7, remain open for the next admin pass. The four framings were explicit user decisions; the conformance work implements the already-locked AdminViewActions / AdminDialog / FabButton contracts. uiux-spec §6 addendum 2026-08-16 carries the full text; contract-spec §12 gains the address-less-member open question surfaced by the device-free walk. |
| 67 | **The admin design contract is codified and binding, and round 2 re-lands the prototypes under it.** The design skill gains `admin-ux-brief.md` (Afo's canonical brief: NN/g heuristics, GOV.UK, USWDS, Laws of UX, web.dev responsive, Refactoring UI — principles extracted, branding never copied) and `interaction-patterns.md` (the codified contract, each rule cited to shipped code: end-aligned action clusters everywhere; ONE stable view action set across tabs with availability-by-disabling; dialog taxonomy with NO shell change mid-flow; flows enter from drawn console homes; single-column MainSheet with the two-column workspace-tab split where earned; row anatomy who·what·state-chips·meta·one-act with banners teaching once; compose only from the shipped palette). review-checklist Lens 5 makes the contract a mandatory pass before any admin round publishes. Four product answers locked: Garden header = shipped trio + Seed, stable everywhere; pool tab = left objects / right rail (container card · quick actions · activity), pool stays a managed container distinct from cycles; start-season/campaign = one three-step flow shell; assessments stay Hub/evaluator-side for v1 (sb57 retired, state library-only). | Afo's second admin review 2026-08-16 — round 1 was validator-green yet violated the contract (left-aligned card actions, tab-varying header actions against garden.utils.ts's tab-ignoring stable set, details-dialog→wizard shell hop, mid-dialog journey entries) because the guidance stack encoded visual identity but not the interaction layer, and nothing gated design quality. uiux-spec §6 admin round 2 addendum (i)–(o) carries the full text. |
| 68 | **The commitment view knows who is looking at it, and four seats are enough because creator is not one.** Direction already names the creator: on an Offer they are the provider, on a Request the confirmer. So seat decides the person of every sentence while phase decides the affordances, and the five parallel derivations of "where does this stand" collapse into one declared lifecycle. Where a stage genuinely needs two seats drawn, it gets a second state, following `W4@provider-view`. | Afo's call in an interactive plan session, 2026-08-18, after `flow-audit.md` found the provider's own flow ending on the confirmer's screen with a button they cannot press, a member's request wearing another commitment's identity, and two membership tests naming states that have never existed. Applying the axis rigorously surfaced three further seat gaps that reassignment could not close, and Afo chose to close all three rather than ship the model with documented exceptions. `uiux-spec.md` C.54 and C.55 carry the full text; register #157 and #158. |

### Full decision register (2026-07-03 alignment session, entries 1–27; dated addenda 28–160)

**Cite entries in this list as "register #N"** — see the disambiguation note above. (The heading previously read "27 decisions", which stopped being true once the addenda were appended.)

1. Spec home: all artifacts in `.plans/active/commitment-pooling/`; no docs-site promotion.
2. Linear issue depth: workstream-sized issues, one per package workstream per track.
3. Community interface: NEW package `packages/community` (independent PWA at `community.greengoods.app`, local port 3010, three tabs, Passkey). It consumes extracted generic runtime/auth/offline/install/update/error/shell foundations while retaining its own routes, navigation, manifest, service-worker scope, telemetry identity, and copy.
4. Git ending: conventional commits on the session branch plus a PR to develop.
5. EAS bridge: WorkApprovalResolver approval/rejection hook (try/catch, non-blocking) plus steward `syncWorkDecisions` fallback.
6. State weight: hybrid; hard transitions on-chain (seed, offer/request, accept, evidence count, ReadyForConfirmation, Fulfilled, cancel/expire, dispute flag, cycle open/close/compost, pool pause); Draft and review-soft states derived.
7. v3 authorship: baseline = evaluator or operator; delta/re-assessment = Evaluator Hat only; testimony = Community Hat only.
8. Protocol pool: the root garden's pool (tokenId 0), poolType PROTOCOL, cross-garden claim reach.
9. PWA placement: pool flows in the Garden tab; personal commitments + pending confirmations in the WalletDrawer pools tab; ~~Home gets at most a summary card~~ **superseded by Decision Log #28 and register #39: no active Home card; W6 only aliases W5 for compatibility.**
10. Admin placement: garden-pool flows in the Garden workspace; the protocol pool console lives under `/community`; Hub gains a confirmation queue. **Amended by Decision Log #28, register #39, and Decision Log #37: `/community/pools` shows Protocol plus the current garden only; all-garden oversight moved to capability-gated Operations, with each write independently authorized.** No top-level `/pools` workspace exists.
11. Seasons & Campaigns project: converted in place to "Green Goods Commitment Pooling" (supersedes the create-new-project instruction).
12. Legacy season issues: composted aggressively with pointer comments; RESR-13 to the July milestone; RESR-15/RESR-4/PRD-275 stay linked research; PRD-344/495/347 rehomed out.
13. Docs staleness: logged in corrections-log plus a Linear docs issue; no docs edits in the spec session.
14. Commitments are NOT EAS attestations; module-native records; EAS gains exactly two schemas (assessment v3, community testimony).
15. Voucher-shaped from day one: commitment units remain non-transferable promise accounting. Compatibility amendment register #86 requires any later transferable voucher to use a separate `voucherClassId` and consume eligible fulfillment facts without becoming or transferring the registry class.
16. Companion register contract: `CommitmentPoolingModule` (control plane) plus non-transferable ERC-1155-style `CommitmentRegister` (classes, balances, quotas), supersedes PRD-649's single-artifact stance.
17. Clean room: Grassroots Economics paper and public docs only; never the AGPL Sarafu source.
18. Considerations: declared consideration reference includes `None | ArbitrumExternal | CeloSettlement`.
    External payout uses the operator-recorded `ConsiderationPaid` event; Celo settlement uses only
    SettlementModule acknowledgment state. The module never custodies funds, the rails cannot
    both record one commitment, and CookieJar remains unchanged.
19. Claim mode per commitment: open-claim or approval-gated, set at seeding; protocol pool defaults approval-gated, garden campaigns default open-claim.
20. Meta evidence: lightweight evidence object (IPFS CID via module event, offline-queueable) for SupportService/StewardCaptured; direction-aware eligible-party confirmation is the review and Not yet raises a dispute; DomainImpact keeps the full MDR path.
21. Editorial: extend the GardenDialog with the pool story and add /impact aggregates; no new public routes.
22. August docs workstreams: glossary + architecture freshness plus operator and gardener guides; no Document B docs page; no spec promotion.
23. Linear tracking: August build workstreams now roll up to PRD-650 and the consolidated parent trackers; historical child issue IDs remain labels, not dispatch targets. PRD-649 closes when the contract spec merges; PRD-651 stays gated; July and September trackers sit flat with milestones.
24. Agent lanes pre-assigned at the execution-sub-lane level: Codex owns contracts, settlement, indexer, state-api, blocked credit follow-on, and final regression QA; Claude owns UI, editorial, docs, docs-guides, community, and first human-flow QA; July dry run stays human-owned. (The credit follow-on was unblocked into the August wave on 2026-08-01 — Decision Log #39 / register #73.)
25. July tracking: update the existing methodology survey (RESR-53, stays in Impact Framework) rather than duplicating; create scoping-survey and activations issues; lightweight tracking table in a project doc. — **Project-doc placement reversed 2026-07-20.** The doc sat empty for 16 days while its rows duplicated COM-7's readiness matrix; only the loop's column shape (requester → fulfiller → separate confirmer → reward rail) was unique to it. Folded into **COM-7 § Proto-commitment rehearsal** and the doc retired. The "don't duplicate" instinct in this entry was right — it just wasn't applied to the tracking table itself.
26. Schema registration timing: assessment v3 + testimony register as the FIRST PR chain of the August track so baselines exist before cycle 1 opens.
27. Hero moments: commitment Fulfilled and cycle close/compost, client PWA only.

**Addendum (2026-07-04 needs-layer alignment):**

28. Needs layer: EAS gains four additional schemas (Need, NeedSignal, NeedStatus, FundingAttribution), owned by the Community Needs & Signals project and specced in `.plans/active/community-interface/`. Amends the letter of #14's "exactly two schemas"; the spirit holds — commitments remain module-native, never EAS. The commitment record gains an additive `bytes32 needUID` (0 = none; see the contract-spec amendment note), specced before the August build so it ships in the initial deploy.
29. Credit follow-on: `CreditRegister` is tracked as `status.json.follow_on.credit_register`, depends on pooling + settlement interfaces, and must not be pulled into August implementation without a new scope lock. (That scope lock was granted 2026-08-01 — Decision Log #39 / register #73; the dependency and dispatch gates stand.)
30. Plan-hub compatibility: `status.json.lanes` is intentionally limited to canonical machine lanes. Use `record-tdd --lane contracts`, `--lane state-api`, or `--lane ui`; record sub-lane evidence in the named handoff before the machine lane turns GREEN.
31. Parent-only Linear sync: this active hub intentionally keeps one Linear parent mirror (`PRD-650`) and no per-machine-lane Linear issue mirrors. Do not add fake lane issue IDs; create lane issues only if Afo explicitly chooses to expand the Linear footprint. — **SUPERSEDED 2026-07-20 by register #37.** Afo made exactly the explicit choice this entry anticipated; lane issues now exist and are real, not fake.
32. Architecture closure (updated 2026-07-23): optional multi-domain Need/Commitment scope, complete creation events, direction-aware confirmation with provider exclusion, stored claim-request terms, pre-dispute restoration, one open Season plus concurrent Campaigns, provider/action-matched DomainImpact Work, reward-bound message-only CCIP settlement with authenticated command/acknowledgment, immutable 24-entry batch cap, and exact pilot 2-of-3 Safe recovery are part of the initial implementation contract.
33. External alignment: the Google Doc is the single source of truth for external prose; `external-brief.md` is a pointer and engineering-source map only. Repo specs, evidence records, prototypes, and visual assets substantiate the narrative without mirroring it. GoodDollar settlement is on Celo and no G$ bridges to Arbitrum. The confirmed Foundation-funded House of Alignment arrangement provides Green Goods with **$800 per month, paid in G$, for July through September 2026 — $2,400 total** — directly into the designated GG protocol Safe on Celo. This upstream agreement is not an onward-distribution claim, and no transaction-level G$ count may replace or redefine the agreed dollar-denominated schedule (funding correction confirmed 2026-08-04).
34. Product-review decisions (2026-07-11 storyboard review; storyboards + gap evidence in `prototypes.md`; job-kind count amended by Decision Log #49): (a) pool **open/close controls live on the admin Pool status card** (adopts MF-1; the open-cycle flow gains only a "pool is Ready — open it now?" guard prompt, closing the Ready→Open deadlock); (b) **members get a pre-acceptance withdraw** control on commitment detail (adopts MF-2a; the then-open steward-cancel placement is closed by register #51); (c) **`waiting_for_hat` covers the six pool job kinds in August** — pre-flight membership check before the first send attempt, no retries consumed, membership event resumes the jobs (adopts MF-5); (d) **expiry runs both paths, sequenced**: `W7@due-live` submits the permissionless August `expireCommitment` action, success routes to the post-expiry queue, and the member "offer again" band follows (adopts MF-3/MF-4); failure keeps the row live, while a keeper cron is only a post-release ops backstop; (e) **pilot operators are the stewards and hold the settlement executor role** — never a Safe owner and never one of the 2-of-3 recovery owners (settlement-spec no-overlap check); W22 needs only a missing-role guard state, not a role-split UI; (f) **W21 + the `/community` Pools view gain a read-only member-delivery gate status row** (enabled/disabled · changed by · date · evidence ref); the owner-only flip stays ops; (g) **testimony is September-realized** (resolves MF-12; no August client frame; external copy must not imply August testimony); (h) the **dry run rehearses S13 with a real minimal Cookie Jar withdrawal**, payoutRef captured via `recordConsiderationPaid` (jar config + Gardener-Hat prerequisites per corrections-log H7).
35. Garden join-request queue (direction locked; canonical design: `../community-interface/join-queue-spec.md`; job-kind count amended by Decision Log #49): the **Community Needs & Signals** hub owns the small agent-backed request service, its personal-data rules, and RESR-64 operating gate. Commitment Pooling is only a consumer: a closed-garden request is signed by the passkey account and, after an operator uses the existing gardener-add path, observed membership is the `waiting_for_hat` flush event for the six pool job kinds. The API remains conveyance only; if unavailable, operators add addresses manually. No protocol admin key ever, and `openJoining` self-join remains unchanged.
36. Hi-fi prototype artifact (2026-07-18, Afo): the flow-prototypes artifact upgrades **in place** from lo-fi ASCII frames to high-fidelity Warm Earth screen renders with per-screen state matrices (Storybook-style state switcher) — full August scope (client PWA + admin + editorial), complete state coverage per uiux-spec §4–§7; September C-frames stay labeled lo-fi previews (they belong to the community-interface plan). Supersedes **Decision Log #13**'s lo-fi-on-purpose policy **for this artifact only** (not register #13, which is about docs staleness) — `wireframes.md` itself stays lo-fi and remains the structural truth; the artifact still adds no design authority beyond the specs and design-skill tokens it renders. Executes audit follow-up 5 (hi-fi pass over the revised pool surfaces). Build machinery decomposed into `hifi/` modules with state-aware validation: journey refs, hotspot-id integrity, per-state render checks, and banned-vocabulary / steward-rule / quiet-admin / chain-placement scans over rendered copy (hard-fail on hi-fi renders, warn-only on remaining ascii). Same entrypoint, same artifact URL, same citation discipline.
37. Thin lane mirror + four-phase milestones (2026-07-20, Afo): **supersedes register #31; dispatch state amended by register #39 and phase dates superseded by register #40.** Linear's issue cap was lifted, so the footprint constraint behind parent-only no longer applies. Each execution sub-lane now has a **thin** Linear issue: ~3 lines plus a handoff link. **Linear owns status, dates, assignee and dependencies; this hub owns content.** Lane bodies must not restate handoff scope — that is the drift failure parent-only was protecting against, and it stays banned. New lane issues (children of `PRD-650` unless noted): `contracts` PRD-721 · `indexer` PRD-722 · `state_api` PRD-723 · `ui_client` PRD-724 · `ui_admin` PRD-725 · `editorial` PRD-726 · `docs` PRD-727 · `docs_guides` PRD-728 · `qa_pass_1` PRD-729 · `qa_pass_2` PRD-730 · `release_ops` PRD-731 (no parent; Release milestone). This also reverses the "no QA child issue is created" rule in `claude-qa-pass-1.md` and `codex-qa-pass-2.md`. `settlement` keeps PRD-686, retitled to *settlement implementation* now that `release_ops` is separately tracked. Gap issues filed the same day: PRD-732 (cycle 1 opens — Track B step 8, previously untracked in any of issue/lane/handoff), PRD-733 (recovery multisig Celo address + HoA receiving evidence — release-blocking, audit follow-up #4), PRD-734 (G$-for-protocol-services with GoodDollar — audit follow-up #6). Historical date model recorded here was **Scope and Design** (2026-07-31) → **Build** (2026-08-12) → **Release** (undated) → **Follow On / Hardening** (2026-12-31); register #40 replaces it with the current dates, while register #39 keeps the July dry run separate rather than absorbed. **Dispatch-safety convention** (adopted from PRD-686's "Backlog coordination only. Remove all `agent:*` labels/delegation"): a lane issue carries an `agent:*` label **only while its lane is `ready`**. Register #39's Wave 1 freeze blocks Docs until source convergence; only independently re-audited lanes may regain a label.
38. Tiered broadcast (2026-07-20, Afo): **the audit / 48-hour-timelock / two-week-testnet gate applies to the value tier only.** `SettlementModule` and the per-garden Celo Safes keep it in full. The **pooling module, `CommitmentRegister` and the two EAS schemas broadcast to Arbitrum mainnet during Build**, under a narrower gate: full test suite, deploy dry-run, post-deploy verification, and a proven upgrade/rollback path. Basis: `human-release-ops.md` Phase 2 already separates "module/register deployment and upgrades" from "settlement deployment only when its gates pass", and the module **never holds funds** while the register is **non-transferable** — so the value-protecting gates protect nothing at this tier. Scope of the exception, stated narrowly: it changes *which artifacts* skip those three inputs. It does **not** relax Phase 3 post-broadcast checks, does not waive the Bun test/dry-run evidence, and grants **no agent broadcast authority** — Afo authorizes, as before. **If the pooling module ever gains custody or the register becomes transferable, this exception lapses** and those artifacts rejoin the value tier. Applied to the Release milestone and `human-release-ops.md` § Inputs the same day. Residual risk accepted knowingly: these are unaudited UUPS-upgradeable contracts on mainnet, so upgrade authority and access control carry the weight the audit would otherwise have carried.
39. Audit reconciliation scope lock (2026-07-20, Afo): execute CP-AUD-001–021 in two waves without product implementation or broadcast. Allocation is supplied only to `openCycle(cycleId, AllocationBps allocation)`; `seedCycle` has none. Baseline stays an app/shared/admin preflight, while the onchain Ready predicate remains charter plus a non-zero provider open-commitment cap. DomainImpact uses positional per-action arrays, `requirementIndex`, per-action progress, and the weighted per-commitment approved-unit formula. `/community/pools` is Protocol plus current garden; all-garden oversight and settlement operations moved to Operations (the original deployer-only route gate is superseded by Decision Log #37; the former batch/oracle label is superseded by register #46/#48's CCIP command/ack model). W6 is retired except for W6→W5 compatibility. Native phases are Scope and Design / Build / Release / Follow On-Hardening; July and September remain separately labeled operational checkpoints. Execution sub-lanes become first-class Linear mirrors, QA stays on canonical QA lanes, `release_ops` is parentless, and `agent:*` labels exist only for ready agent-owned lanes. A new human-owned blocked `settlement_evidence` lane is due September 30 under PRD-650 and receives no agent label until sources, privacy, thresholds, and package are locked. Public closure requires per-action Built/Planned roles, four phases plus checkpoints, September-only testimony, all six GE functions, 2× visual pairs, live Linear and Google Doc rereads, primary-source verification, and confidential human confirmation that the undisclosed fourth-garden candidate name is absent. Unavailable external access is a blocker, never convergence proof. This entry preserves register #38's narrow Build-tier broadcast exception and adds no implementation or broadcast authority.
40. Phase-date correction (2026-07-20, Afo): **supersedes only the phase dates in register #37 and the date-neutral wording in register #39.** Scope and Design closes with this reconciliation on **2026-07-20**; Build closes **2026-07-31** after the two-week implementation window; Release is **2026-08-12**; Follow On / Hardening remains **2026-12-31**. The July dry run (**2026-07-31**) and Community plus settlement-evidence delivery (**2026-09-30**) remain separately labeled operational checkpoints. The August 12 release target grants no agent or automatic broadcast authority, does not weaken register #38's tier-specific gates, and does not turn a blocked value-tier artifact into an authorized release.
41. Build-to-Release broadcast correction (2026-07-20, Afo): **supersedes register #38 only on calendar-phase timing and supersedes the Build-broadcast preservation clauses in registers #39-40.** Build closes **2026-07-31** with implementation, QA, full tests, dry-runs, post-deploy verification readiness, and upgrade/rollback proof; **nothing broadcasts during Build**. The pooling module, `CommitmentRegister`, and two EAS schemas retain register #38's narrower non-value-tier evidence gate because they are non-custodial/non-transferable, but any mainnet broadcast is a separately authorized **Release** action on or after **2026-08-12**. `SettlementModule` and per-garden Celo Safes retain the full value-tier gate. This timing correction grants no agent authority and leaves both tiers blocked until their own human authorization exists.
42. Broadcast tiering restored (2026-07-20, Afo): **supersedes register #41's “nothing broadcasts during Build” clause and restores register #38's July timing.** The non-value tier — `CommitmentPoolingModule`, non-transferable `CommitmentRegister`, and the two EAS schemas — broadcasts during Build by **2026-07-31** under its narrower gate: full tests, deploy dry-run, post-deploy verification, proven upgrade/rollback, and explicit human authorization. The value tier — `SettlementModule`, `CeloSettlementExecutor`, and per-garden Celo Safes — remains a separately authorized Release action on or after **2026-08-12** under the full audit, timelock, CCIP live-route and dual-chain evidence gate, Safe/Zodiac/AA review, rollback, and live-exit gate. No agent self-authorizes any broadcast; the non-value exception lapses if custody or transferability is introduced.
43. Scope and Design date correction (2026-07-20, Afo): **supersedes register #40 only for the Scope and Design date.** Scope and Design closes Wednesday, **2026-07-22**. Build remains **2026-07-31**, Release remains **2026-08-12**, Follow On / Hardening remains **2026-12-31**, and the July 31 and September 30 operational checkpoints remain separate from the four native phases.
44. Follow On / Hardening date correction (2026-07-21, Afo): **supersedes registers #40 and #43 only for the Follow On / Hardening date.** Follow On / Hardening closes **2026-09-30**, alongside but distinct from the Community plus settlement-evidence operational checkpoint. Scope and Design remains **2026-07-22**, Build remains **2026-07-31**, Release remains **2026-08-12**, and the July 31 dry run remains an operational checkpoint. Co-dated September closures are parallel evidence decisions, not a false sequential dependency and not implementation or broadcast authority.
45. Count-safe accounting and Architecture closure (2026-07-22, Afo): cross-commitment arithmetic uses counts; `promiseKeptRate = commitmentsFulfilled / commitmentsDue` is the sole cross-commitment percentage. Raw units remain per commitment and in `CommitmentUnitSummary` rows keyed by exact UTF-8 label bytes (`hours` and `Hours` differ). The register limit is a concurrent provider commitment-count cap, with one slot acquired at acceptance and released exactly once on fulfillment, accepted cancellation, or accepted expiry; disputes preserve slot state. NET-NEW interfaces are renamed directly with no compatibility aliases or migration. Architecture is self-contained with D16 Hypercert cut-over, permission table exact sensitive permissions, and D7 offline jobs; existing diagrams keep their numbers. Product code, SVGs, wireframes, publication, and Linear writes are outside this correction pass.
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
    D20 uses the canonical settlement entities. Envio v2.32.12 uses unordered multichain mode,
    first-event metadata seeding, and Celo Sepolia RPC config. Endpoint proof is an ephemeral
    Arbitrum Sepolia↔Ethereum Sepolia deployment; Celo Sepolia independently proves
    executor/Safe/Roles/surrogate behavior. EntryPoint v0.7 is the AA target. Celo deployment uses
    an executor-only target, never the historical full-core `deploy:celo --update-schemas`.
    Local specification corrections are complete only after validation; live Linear and source-
    document convergence remains a separate blocked, human-authorized step.
    *(Dated entry, preserved verbatim. Superseded on one point: the `Envio v2.32.12` reference
    above is the version that was current on 2026-07-24. The indexer now pins Envio `3.2.1`
    via merged PR #649 (`8fd89e660` on `develop`); read the Indexer lane checklist, not this
    line, for the version an implementer should target.)*
55. Final documentation-review closure (2026-07-24, Afo authorization): the register-global
    `ModuleUpdated` event now has a complete, pool-less read model with explicit normalized
    old/new module fields and no accounting mutation. The indexer handoff covers pooling and
    `SettlementModule` on both Arbitrum production/rehearsal networks, and
    `CeloSettlementExecutor` on both Celo production/rehearsal networks with explicit
    `11142220` RPC configuration. D20 draws all seven canonical settlement entities, and
    `SettlementConfiguration.localContract` makes the verified-artifact seed schema-complete;
    remote identity means the exact CCIP selector. D21's sequence syntax is parser-safe.
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
    or storage mutation. D21 uses `ResultStatus.Success`, and provider-slot mutations are
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
    `gardenerDeliveryEnabled`. The shared lane owns typed account profiles and both missing Sepolia
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
    one-contributor case. Contributor policy is immutable Open or LeadManaged; contributors may join
    or be added/removed before freeze, may be assigned to requirements, and must be active to
    link Work or receive evidence attribution. The roster freezes atomically on the transition
    to ReadyForConfirmation. Every frozen contributor is excluded from the confirmation set and
    fallback path; any roster change that makes the threshold unreachable fails before mutation.
    Only the lead provider consumes the register's concurrent commitment-count slot.
64. Recognition amendment (2026-07-28, Afo authorization): the cycle-open allocation policy now
    includes the gardener within-class rule. The gardeners class divides equally across fulfilled
    commitments by default because raw units across commitments are not comparable. Within a
    commitment, the immutable `RecognitionPolicy` determines the equal and verified components;
    20/80 is the protocol default, not a fixed cycle invariant. The equal component assigns its
    remainder by ascending lowercase address, then the verified component independently assigns
    its remainder by descending fractional remainder and ascending lowercase address; the two
    row results are added only after both exact passes. The policy is frozen at
    cycle open, while cycle-less commitments use the immutable protocol 20/80 preset for
    recognition and payout defaults only. Because they have no six-role `CycleOpened` allocation,
    cycle-less commitments are ineligible for COMMITMENT-bundle Hypercert minting and the UI must
    disable them before composition. There is no automatic lead or metadata-only fallback: Ready
    and direct Fulfilled dispute resolution require non-zero pre-freeze verified credit, and W26
    blocks any inconsistent legacy/indexed state.
65. Payout-plan amendment (2026-07-28, Afo authorization): a fulfilled CeloSettlement commitment
    receives a garden-managed payout plan. Its initial contributor weights copy the final
    Hypercert recognition weights. Plan creation asks CommitmentPooling to recompute the complete
    sorted recognition vector and hash from frozen on-chain credits and cycle policy. A
    provider-garden steward may atomically edit the complete amount vector before
    finalization; the plan persists the immutable ascending contributor order, and creation plus
    each edit emits version-tagged complete rows followed by one summary/hash commit marker.
    Payment weights derive from amounts. The canonical full-reward integer
    base-unit allocation is rounding-equivalent to recognition and needs no reason; every
    noncanonical amount or retention divergence requires a visible reason. The plan carries an
    explicit `gardenRetainedAmount`; declared reward must
    equal retained plus all contributor payouts. Retention creates no self-transfer. Recipients
    are frozen eligible contributors whose Celo accounts are derived by the shared account
    profile. The provider-garden settlement account must remain Active for edit, finalization,
    first preparation, ContributorConsideration batching, and initial dispatch. *(Superseded by
    register #90: the payer-garden settlement account holds this requirement; provider = payer
    only for garden-internal commitments.)*
66. Settlement reuse amendment (2026-07-28, Afo authorization): the provider garden Safe is the
    payer for contributor rewards, while ProtocolToGarden remains an independent top-up rail.
    *(Payer half superseded by register #90, 2026-08-08: the payer garden Safe — the asking
    side — pays.)*
    Protocol Safe to garden Safe value is always `Funding` created through `queueFunding`, never a
    garden-beneficiary commitment reward.
    Each non-zero payout becomes one ordinary bounded child disbursement; the payout plan's
    Pending/Partial/Complete/Failed view derives from finalization plus retention/conservation and
    child states and is never acknowledged as a separate cross-chain subject. Explicit
    finalization freezes the plan before dispatch; a finalized zero-child all-retained plan is
    Complete immediately without queue or CCIP. Child and batch cancellation never clear
    the stable one-plan-per-commitment pointer. Large teams split across measured batches, but
    `createBatch` rejects duplicate derived recipients before any fee or dispatch;
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
69. Protocol-pool funding amendment (2026-07-30, Afo authorization): preserve the provider-garden
    payout-plan architecture as the earned-support path for protocol-pool commitments. Fulfillment
    unlocks the ordinary indexed plan actions; it does not create a browser-local settlement job
    or call `queueDisbursement(commitmentId)`. Keep `queueFunding(garden, amount)` as the separate,
    explicit, authority-gated treasury seed/top-up action. Operations route visibility derives
    from deployer, funding, or settlement capability, while the funding submit control requires
    protocol-steward or SettlementModule-owner authority and produces only an emitted
    Funding/ProtocolToGarden Queued row with no commitment identity. No agent or keeper receives
    write or value authority.
70. Final pre-build review closure (2026-07-30, Afo authorization): four parallel read-only
    reviews — contract spec, settlement spec, visual assets, and repo gates — ran before PRD-721
    dispatch and found thirty corrections in all: one compile-blocking interface defect plus
    twenty-nine further specification and artifact gaps, split sixteen in the contract spec (the
    blocker among them), seven in settlement, and seven in the visual assets — all now corrected
    in repo truth. `ContributorRosterFrozen` was declared as both an event and an error, so the canonical
    `ICommitmentPoolingModule` could not compile; the event name stands and the error becomes
    `RosterAlreadyFrozen`. Members may create cycle-less commitments, so the Open-cycle
    requirement binds only when `cycleId != 0`, while cycle-less commitments keep the immutable
    20/80 preset and their COMMITMENT-bundle ineligibility. Garden-claimed commitments are
    confirmed directly by the claiming garden's resolved operator/owner Hat wearers and never by
    the GardenAccount through ERC-6551 `execute`; frozen-contributor exclusion and
    confirmer-threshold reachability are unchanged. Deployer-EOA ownership of GardenToken,
    WorkApprovalResolver, and AssessmentResolver is knowingly accepted for the
    non-custodial/non-transferable tier as an explicit extension of register #38, waiving
    `packages/contracts/AGENTS.md`'s 3-of-5 rule for that tier alone while the value tier binds in
    full — a single EOA key can upgrade those proxies to arbitrary code, and its compromise or
    loss is unrecoverable. `contract-spec.md` §6.1 now owns the recognition-snapshot preimage
    `keccak256(abi.encode(block.chainid, commitmentId, recognitionEntries))`, which
    `settlement-spec.md` and the contracts handoff restate rather than author.
    WorkApprovalResolver's post-upgrade layout is 2+48 → 5+45. The mandatory `--sender`/live
    `owner()` upgrade gate, the badge-schema chain
    map, the release-gate posture, the named MAX-bound benchmark harness, and the dual-chain
    courier process and fixture are itemized as net-new lane deliverables instead of being assumed
    to exist. **Superseded 2026-08-06:** the `421614` network record and artifact path are
    withdrawn as deliverables; the pooling rehearsal is an Arbitrum One fork
    (`bun run contracts:pooling:rehearse:arbitrum-fork`) because Hats has no Arbitrum Sepolia
    deployment. See `contract-spec.md` §7.3, amendment 2026-08-06. The ephemeral Arbitrum Sepolia↔Ethereum Sepolia endpoint proof is release-ops
    evidence and never gates settlement lane GREEN, which covers proof-ladder rungs 1–3 only.
    `ContributorPayout.included` is dropped because payability is exactly `amount > 0`. Phase
    dates are unchanged: the 2026-07-31 Build close is recorded as known drift because the
    register #62 dependency chain cannot complete by then, Linear owns the dates, and this mirror
    follows only after Afo re-dates there. Chain-verified in the same pass: the live Arbitrum
    AssessmentResolver returns `schemaUID() == 0` while the artifact holds the pinnable v2 UID,
    GardenToken appends at slot 213 offset 2 with its 37-slot gap intact, and all three live
    proxies share the deployer-EOA owner. No product implementation, dependency install, codegen,
    deploy, broadcast, authority mutation, Linear/source-document write, staging, commit, or push
    is authorized by this entry.

71. Declared valuation record (2026-08-01, Afo decision — Grassroots Economics review response,
    Will Ruddick feedback session): the commitment record gains `declaredUnitValue` +
    `declaredValueBasis` as an optional, records-only valuation term (pre-acceptance
    steward-adjustable via `setDeclaredValue`, `ValueDeclared` event, pair rule
    `InvalidValueDeclaration`, valid with `ConsiderationRail.None`). This realizes the GE "valuing"
    primitive as data while relative-pricing execution stays reserved for the transferable-voucher
    layer. The register #58-era count-safe lock stands: no protocol arithmetic consumes it, and
    cross-commitment value aggregation exists only per exact basis as read-model informational
    sums. Contract-spec amendment 2026-08-01 (1) / decision 16 owns the exact semantics.
72. Counter-commitment exchange reference (2026-08-01, Afo decision, same session):
    `counterCommitmentId` (0 = none) records "made in exchange for" against an existing same-pool
    commitment — creation-time existence/same-pool/non-self validation, immutable, strictly
    one-way, no lifecycle coupling ever (needUID discipline). Realizes the GE "exchange" step as a
    social record; atomic swaps and transferable exchange stay with the reserved voucher layer.
    Contract-spec amendment 2026-08-01 (2) / decision 17 owns the exact semantics.
73. August-wave scope expansion and CPP-alignment posture (2026-08-01, Afo decision, same
    session): (a) the `CreditRegister` borrow-and-repay chain is promoted from blocked follow-on
    into this build wave (hub moved backlog → active) with zero pooling-module/register changes;
    its dispatch still gates on in-code pooling/settlement interface freeze, spec revalidation,
    and legal/operations review, and its G$ leg locks settlement seam (a)
    (`DisbursementKind.LoanPrincipal`) since both modules now build in one wave. (b) App-lane
    reciprocity work joins the wave with no Solidity: the `PoolMemberHistory` standing read model
    (counts only, steward + self visibility, never a score or leaderboard), a rotation Campaign
    template (ROLA-shaped turns derived from indexed history), and reserve/redemption framing
    (pool ↔ settlement-account linkage in read model and diagrams). (c) Explicitly still excluded:
    transferable vouchers, swap execution, relative-pricing enforcement, protocol-consumed
    standing, and any per-person score. (d) The Aug 12 release target is held as a stretch date at
    Afo's direction; every safety, evidence, and authorization gate binds unchanged and Linear
    owns any re-dating. No broadcast, deploy, or authority mutation is authorized by this entry.
74. Staged Commitment Pooling narrative and roadmap boundary (2026-08-01, Afo decision): Green
    Goods is building **Commitment Pooling** in iterative, evidence-led stages. "Commitment
    coordination" is the name of the first functional layer, never a replacement product name.
    External and internal narrative surfaces must distinguish: current August contract scope;
    August app-roadmap additions that are approved but not yet implemented or drawn in hi-fi
    (counts-only standing, rotation, reserve framing); and later roadmap capabilities
    (garden-to-garden routing, transferable vouchers/exchange execution, relative-pricing
    enforcement, and any protocol-consumed standing). The current `CreditRegister` is an August
    companion behind the three gates in register #73, not a deferred follow-on. Roadmap links must
    show that later capabilities extend the same reserved fields and records without claiming they
    ship now. All no-custody, no-lifecycle-coupling, count-safe, privacy, and anti-ranking locks
    continue unchanged. (Same-day follow-up: bilateral atomic `acceptExchange` joined the August
    contract scope via Decision Log #41 / register #75; multilateral and transferable exchange
    execution remain later-roadmap.)
75. Bilateral exchange acceptance and exact freeze re-closure (2026-08-01, Afo decision — second
    same-day amendment): PRD-649 reopens for exactly one additive function,
    `acceptExchange(uint256 exchangeCommitmentId)`, and re-closes through the synchronized
    contract, indexer, state/API, UX, diagram, acceptance, handoff, and machine-state amendments.
    The argument is B, whose immutable `counterCommitmentId` names existing same-pool A; only A's
    creator calls. B creation plus A creator's call provides bilateral creator consent, valid for
    both claim modes without operator consultation. Offer×Offer, Offered×Offered,
    Individual×Individual, distinct creators, every ordinary per-side cycle/identity predicate,
    both existing exact full reservations, two ordinary acceptance events, two creator-lead
    `ContributorAdded` events, and one marker event are atomic. No registry recommit, new provider
    slot, or provider-cap headroom check occurs. Later lifecycles and exact-label units remain
    independent. No new
    storage or state-machine member; multilateral and transferable exchange remain reserved.
    The Aug 12 target remains a stretch date, every gate binds unchanged, and this entry authorizes
    no implementation dispatch, deploy, broadcast, or authority mutation. The same amendment set
    records the living-text naming alignment (`CommitmentRegister` → `CommitmentRegistry`,
    `ICommitmentRegister` → `ICommitmentRegistry`, `CreditRegister` → `CreditRegistry`,
    `CommunityTestimonyResolver` → `TestimonyResolver`); dated history retains the originally
    recorded names.
76. PRD-651 exchange-architecture brief (2026-08-01, Afo decision):
    `exchange-architecture-brief.md` is the canonical design-only description of fulfilled-only
    voucher wrap, basis-exact quoter, class/holding limiter, pool venue/vault, Sarafu-pool hybrid,
    settlement-rail generality, evidence gates, and the 2026-08-19 GE conversation questions.
    PRD-651 remains gated for implementation. No `settlementAdapter` or `settlementEnabled`
    activation, custody, venue integration, dependency install, deployment, broadcast, partner
    commitment, or external write is authorized by this entry.
77. Exchange-wave app complexity and plain-language scope (2026-08-01, Afo decision): the August
    app lane gains the exchange-pair creation/detail/feed/acceptance states in `uiux-spec.md`
    Appendix E.1, a practice-first template library in E.2, and the noun-reduction/first-exposure
    rules in E.3. Templates are content/config only and prefill existing primitives; exchange uses
    `counterCommitmentId` plus the one new `acceptExchange` call. No Solidity beyond register #75,
    no new chain state, no ranking or per-person score, and no custody follow. The Aug 12 target
    remains a stretch date, all lane and human authorization gates bind unchanged, and this entry
    authorizes no implementation dispatch or external write.
78. Focused implementation-readiness correction (2026-08-02, Afo authorization; supersedes only
    the living requirements that conflicted with package contracts, while preserving the dated
    wording of registers #38 and #70): `Garden.id` remains the normalized bare GardenAccount
    address with explicit `chainId`, and every new Commitment Pooling entity owns its own
    chain-scoped composite ID. One cursor-ordered lifecycle projection helper handles ordinary
    terminal events and terminal `DisputeResolved.finalState`, including reversible
    `Expired -> Disputed -> RestorePrevious/Cancelled` current-outcome and live-count deltas,
    Fulfilled attribution confirmation, and Need lineage. `CommitmentExchange.acceptorA/B` are
    crossed claimants only; each Offer creator remains its own lead/provider. The prior pooling-tier
    ownership waiver is withdrawn: the repository's external-audit, protocol 3-of-5 Safe,
    48-hour mainnet timelock, two-week testnet-operation, and tested-rollback requirements block
    every pooling-tier mainnet upgrade, deployment, activation, and unpause. This correction
    authorizes plan reconciliation only, not product-package implementation, broadcast, authority
    transfer, publication, or external write.
79. Selected protocol-team confirmation fallback (2026-08-02, Afo decision): an explicit
    pre-acceptance `protocolFallbackEnabled` selection may satisfy structural confirmer
    reachability when the ordinary named/direction-aware path is impossible. The module resolves
    current steward/owner Hats from its write-once registered protocol pool, never from a hardcoded
    address or module ownership. Local authority wins classification for a dual-role caller;
    contributor exclusion and a public reason remain absolute. `ConfirmationPath` distinguishes
    `Ordinary`, `PoolFallback`, and `ProtocolFallback`. No silent fallback is inferred.
80. G$ service return leg (2026-08-02, Afo decision): gardens may use G$ earned through
    protocol-pool commitments for Green Goods team support sessions, onboarding, and workshops,
    closing the internal circulation drawing. Compatibility with the external House of Alignment
    mandate remains awaiting GoodDollar confirmation and must be labelled that way. No contract or
    settlement interface depends on the answer.
81. Ongoing-Offer authority (2026-08-02, Afo scope lock; vocabulary amended by register #85):
    a pool-scoped, module-owned `CommitmentSeries` is the internal durable identity of an Offer
    used over time. A non-zero instance reference must resolve to an
    Active same-pool series whose current holder is the direct Individual Offer creator. Series
    metadata is prospective. Initial lifecycle is Active/Resting/Retired; the struct separates
    `createdBy` and `currentHolder`, but no initial mutation changes holder. Offer once uses
    `commitmentSeriesId == 0`.
82. Honest availability and Offer capacity (2026-08-02, Afo scope lock): each available place is
    one already-created Offer instance. Offer creation registers the class and immediately commits
    its full quota against the creator, reserving one provider slot through Offered and Accepted.
    Offer acceptance and atomic exchange revalidate but do not recommit. Requests remain
    Registered until a provider accepts. Unaccepted Offer cancel/expiry releases exactly once;
    unaccepted Request cancel/expiry does nothing. `Committed` means provider capacity reserved,
    not claimant accepted.
83. Story, persistence, trust, and consent (2026-08-02, Afo scope lock): the indexer projects one
    `CommitmentSeries` plus per-cycle summaries with exact current outcome counts and unique
    fulfilled-cycle IDs. “Kept N times across M cycles” is allowed; no score, rate, rank, inferred
    participant count, cross-pool merge, protocol permission input, or public personal history
    follows. Reusable saved Offer metadata is signed offchain and private by default; local-only
    storage is permitted only for unsaved drafts. Next-cycle default is Ask me again. Succession
    verbs remain consent-gated follow-on work; initial scope includes only rest/resume/retire.
84. Delivery ownership and artifact gate (2026-08-02, Afo scope lock): Codex owns the canonical
    architecture/specification, plan, Google Doc, Linear reconciliation, and final cross-source
    review. Claude Code owns the canonical prototype, source storyboards, hi-fi screens, and visual
    asset gallery pass. Claude consumes `standing-commitments-spec.md` and may not redefine series
    authority, capacity, persistence, visibility, or succession. Backend order remains contracts
    → indexer → shared state/API; runtime surfaces follow the corrected artifact readiness gate.
85. Offer-only product vocabulary (2026-08-02, Afo scope lock): remove `Practice` as a defined
    product/domain noun. One-time and ongoing behavior are **Offer once** and **Offer over time**.
    `CommitmentSeries` remains the internal durable pool-scoped identity for the ongoing path.
    Finite pre-created capacity-backed places, exact Story, Ask me again next cycle, and
    Rest/Resume/Retire are unchanged. Saved Offer metadata may be signed offchain and private by
    default, but it is not another product object. “I’m learning this” is outside the initial
    Commitment Pooling Offer flow.
86. Full-pool identity compatibility (2026-08-03, Afo architecture closure): preserve three
    separate identities. Initial registry `classId == commitmentId` is one immutable
    non-transferable promise instance; `commitmentSeriesId` is one pool-scoped Offer used over
    time; a later adapter-owned `voucherClassId` is one transferable issuer instrument. A voucher
    may reference series and fulfilled instances but never transfers the promise, holder,
    confirmation authority, contributors, recognition, or Story. No initial ABI/event/storage
    addition is required.
87. Adapter and backing compatibility (2026-08-03, Afo architecture closure): the Pool's one
    reserved `settlementAdapter` address is interpreted as a future versioned adapter/router.
    Fulfilled backing is the first activatable mode and consumes exact fulfillment facts once.
    Reserved-capacity backing remains disabled until a separate scope locks consent, issuance,
    supply/exposure, default, expiry, repair, liquidity, legal, audit, and authorization rules.
88. Staged full-pool path (2026-08-03, Afo architecture closure): initial commitment coordination
    remains useful on its own. Promotion order is compatibility freeze → field evidence →
    fulfilled-backed voucher/redemption → one bounded pool proving seed, exchange in/out,
    redemption, and repair → separately gated capacity backing and/or federation. G$ support and
    voucher redemption remain different rails. No stage automatically authorizes the next.
89. Living narrative/artifact ownership (2026-08-03, Afo direction): Codex owns plan/spec, Linear,
    Mermaid Architecture/Reference, and final cross-source review. Claude Code owns hand-drawn
    Story SVG/PNG pairs and the canonical Google Doc prose/image pass. External edits are additive
    and preserve the current six-tab structure, plain commitment-first voice, built/planned claim
    discipline, citations, and reviewed polish. This supersedes register #84's living Google Doc
    ownership without rewriting that dated record.
90. Payer identity (2026-08-08, Afo decision): settlement follows the ask, not the delivery. The
    commitment stores an immutable `payerGarden` beside `providerGarden` — `pools[poolId].garden`
    for a Request at creation, the claiming `gardenContext` for an Offer at acceptance. The payer
    garden's registered Celo Safe is the settlement source and its steward holds payout-plan
    authority; `providerGarden` remains EAS recipient scope and the roster/provider-role boundary
    only. `DeclaredConsideration` replaces the legacy `DeclaredReward`, direction implied by `payerGarden`,
    with `amount == 0` meaning free. Flow direction stays derived rather than caller-authored: no
    new `FundingRoute` member; the indexer derives a named `CommitmentSettlementFlow` from
    `payerGarden`, `providerGarden`, and the protocol garden. Garden-internal commitments resolve both addresses to the
    same garden, so existing single-garden behaviour is unchanged. Scoped exception to register
    #86's byte-identical event freeze: both `CommitmentAccepted` and `CommitmentCreated` gain a
    trailing `payerGarden`; the consideration rename and payer/claim errors land; the undeployed
    settlement surface gains `GardenBeneficiary` and renames ordinal zero to
    `ContributorConsideration`. Verified 2026-08-08: top-level storage
    layout identical across all 46 entries with every `__gap` untouched, module 21,198 → 21,205
    bytes, and Offer acceptance costs a measured 20,352 additional gas for the new cold SSTORE.

91. Payout recipient (2026-08-08, Afo clarification): who receives follows who claimed. A Request
    claimed through `ClaimType.Garden` — the steward-only protocol-pool path, now additionally
    required to target a garden other than the protocol garden — pays exactly one recipient, the claiming garden's active registered Celo
    Safe, because the garden took the commitment on as an institution and earns it as one; internal
    distribution is the garden's own business. A Request claimed through `ClaimType.Individual`
    pays the frozen eligible contributors' own Celo accounts. An Offer always pays contributors,
    since its claimant is the payer. This closes the circulation loop by earning rather than by
    subsidy: gardens accumulate G$ from garden-scoped protocol Requests and spend it on protocol
    Offers. The beneficiary receives the full declared amount; `gardenRetainedAmount` is zero for
    beneficiary and every cross-garden plan, and remains available only to garden-internal contributor plans. The
    Arbitrum GardenAccount remains attribution only; recipients are Celo Safes or Celo accounts.

92. Immutable payout shape and derived flow (2026-08-08, Codex adversarial review accepted): plan
    creation derives either `ContributorConsideration` or `GardenBeneficiary` and stores that kind
    immutably. Beneficiary shape freezes the active external garden's registered Celo Safe, carries
    the full declared amount, has no contributor rows or retention, exposes
    `prepareGardenBeneficiaryPayout`, and cannot complete without its one child's authenticated
    success acknowledgment. Contributor edits cannot cross the shape boundary. General plan
    counters, status, acknowledgment, cancellation, and requeue apply to every commitment-bound
    child. Zero payer fails closed; payer and beneficiary accounts are rechecked at each new value
    authorization boundary. A protocol garden cannot claim its own institutional Request.
    `CommitmentSettlementFlow` is derived in the read model while later Celo token circulation
    remains an external observation problem. Tracked in PRD-800.

93. Prototype catalog restructure (2026-08-10, Afo review round): flows are self-contained to one
    person's action to completion. A "Meanwhile" echo is a read-only consequence — the build now
    rejects any echo carrying an advancing control — and the moment another role must act, the
    flow ends at a waiting state with an end-of-flow handoff link. Split-outs: sb42 confirm
    (from sb1), sb43 request-provider (from sb2), sb44 captured-member (from sb8), sb45 team
    formation (from sb33), sb46 garden-claim acceptance (from sb13), sb47 not-yet resolution
    (from sb5), sb48 protocol-wide impact (from sb15); sb29's recipient scenes became read-only
    beats. Every flow carries a `chapter` (lifecycle-ordered card clusters per surface tab; the
    Green Goods operations chapter renders collapsed) and `roles` acting-role tags that replace
    the redundant surface badge. Chapter and role vocabularies are renameable data in
    `hifi/types.ts` — the build asserts referential integrity only, never names or counts, so
    real garden vocabulary can reshape them without touching the validator.
94. Green Goods fallback pilot default ON (2026-08-10, Afo decision; supersedes the 2026-08-02
    off-by-default confirmation-path closure's default, not its guard): creation surfaces (W3
    client wizard, W8 seed console) write `protocolFallbackEnabled = true` by default, shown on
    review and switchable off per promise from the wizard's Advanced detour. The runtime posture
    is unchanged and remains the safety argument: the fallback stays usable only while the
    ordinary named/default path is unreachable after contributor exclusion, always records a
    reason, requires current protocol-pool Hats at signing, and never permits a contributor to
    confirm. The queue builder still round-trips the explicit boolean without inference. The
    default-path wizard drops the separate Who-confirms step (4 steps for garden work, 3 for
    service/requests); named groups, contributor policy, and assessment move to Advanced.

95. Tap-first input modality (2026-08-10, Afo direction "click-based flow where possible with
    minimal data input"): the principle is *type only what only you can know* — names, stories,
    and free-form reasons stay human; everything derivable arrives as a tap with a typed escape.
    Applied across the prototypes: every reason-taking dialog (not-yet, withdraw, decline,
    pause/cancel season, steward cancel/override/dispute/resolution, both fallback confirms,
    settlement cancels) leads with common-reason chips that fill the still-required reason field;
    the creation wizards pick unit and amount from chips with a custom escape and default due to
    the cycle end via radio on every path (fixing the service path's raw-text date); evidence
    credits contributors by roster chips instead of a typed list; W11 opens with the standard
    split applied and edits as the exception; W21 payout edits are recognition-prefilled
    corrections; W23 send offers recent recipients and amount presets. The contract surface is
    unchanged — reason fields remain (REASON_CONFIRMS still enforces them) and chips only fill
    them. Measured baseline before this pass: 74% of 198 acting scenes tap-only, 23/50 flows
    zero-typing; the pass converts the reason family and wizard unit/amount/due to tap-default.

96. Coverage closure round (2026-08-10, Afo approvals on all six review questions): (a) request
    creation is a real three-step wizard (`W3@request-what/request-howmuch/request-variant`)
    rather than a compressed review screen; (b) every W3 wizard state adopts the fixed Submit
    Work chrome — close + progress header and bottom action bar are fixed frame, only the form
    scrolls (matches §5.4's cited TopNav + FormProgress pattern); (c) echo-trim assessment
    adopted: an echo stays only where the member-visible consequence is the act's point — the
    multi-checkpoint member peeks in sb9a/sb9c/sb10 became branch links to the screen library;
    (d) protocol-pool coverage completed: sb49 seeds protocol asks/offers to gardens from the
    Community workspace (`W12@seed-protocol`), closing the rail seed → claim (sb13) → accept
    (sb46) → pay (sb19); (e) the admin "Decide & review" chapter split into Decide on promises /
    Work review / Assessments, sb4b split at its actor seam (steward approves work; evaluator
    attests and attaches in sb50), and sb22 regrew into Record the pool's baseline ending at the
    readiness checklist; (f) the artifact's Implementation reference tab is generated from the
    executable registry on every build (flow/screen indexes with calls, cites, walked-by),
    retiring the drifted hand-written prototypes.md rendering — the file stays in the repo as
    historical source material.

97. Full-coverage round (2026-08-10 night, Afo approvals via plan-mode questions): (a) DomainImpact
    Requests are drawable — the request wizard gains the Garden work kind with action requirements
    (`W3@request-anchors`/`request-work-review`), `W2` gains the request-work cast, and sb51 walks
    ask → work approvals → ready-to-confirm; (b) W12's Protocol pool tab is ruled the
    protocol-steward operations home — uiux §6.8 amended (garden stewards claim via client W25/sb13,
    never a duplicated admin pane) and W12 gains the register #34f read-only delivery-gate status
    row; (c) campaign-request cast gains its guided walk (sb52); (d) Ongoing Offers gain read-only
    admin series context (`W7@series-view`) per the acceptance-matrix admin column; (e)
    `MAX_CONFIRMERS` renders on both creation surfaces and `W26` names the cycle-less
    certificate-ineligible row; (f) the exchange wave graduates into the hi-fi registry — W28–W31
    drawn with recovery states, `acceptExchange` added to the prototype ContractCall union and
    validator CALL_RULES (the same-day contracts audit verified it shipped and tested on-chain),
    and sb35/sb36 walk bilateral pair acceptance and template-first creation; multilateral and
    transferable exchange stay design-only. Audit records: indexer dangling-FK and agent-store
    findings appended to their handoffs, this file's status header re-synced to status.json, and
    CLAUDE.md's indexer-boundary line corrected to defer to check-indexing-boundary.mjs.
    (g) PR #697 review round (2026-08-10, delegated design calls): the garden-work ask is its own
    four-step cast from the first screen (`W3@request-work-what`/`request-work-howmuch` — the dot
    row changes only at the explicit Garden-work choice, never silently between steps, and the
    drawn fiction never flips), request reviews reach the same
    Advanced detour as offers so the register #94 per-promise fallback opt-out holds for every
    direction, the W2 request-work cast draws its work/evidence/people disclosures, and
    `acceptExchange` routes through `W30@submitting` — Matched renders only from confirmed
    `ExchangeAccepted`, never optimistically.
98. Visual Asset Gallery Screens tab retired (2026-08-11, Afo decision after drift analysis): the
    gallery no longer renders `wireframes.md`, leaving screens exactly one published surface — the
    Flow Prototypes artifact generated from the validated `hifi/` registry. Rationale: the low-fi
    mirror kept drifting from the registry (the 2026-07-27 audit found 4 of 25 frames matching;
    every later wireframe wave reopened the reconciliation debt), and the two published screen
    surfaces diverged faster than manual reconciliation closed them. The gallery drops to three
    tabs (The story · Architecture · Reference) and 42 Mermaid blocks — the cross-surface flow map
    retired with the tab since D1 carries the surface topology in richer form — and now links the
    Flow Prototypes artifact from the masthead subtitle and the Go deeper list, with build
    assertions keeping both links present and the tab from reappearing. The Reference tab's "Do
    the wireframes mirror our UI prototypes?" finding records the closure. `wireframes.md` carries
    a design-history status header — the same standing register #96 gave the retired
    `prototypes.md`; its per-frame `#screens/SCREEN@state` deep links are dated to the 2026-07-27
    reconciliation, not maintained. No repo consumer outside the plan hub referenced the tab, and
    no published deep-link fragments into the gallery exist, so no anchor aliases were needed.
99. The current contract ceremony stops paused and deployment-sender owned (2026-08-11, Afo
    decision). It does not transfer any Arbitrum or Celo proxy to the protocol Safe, execute the
    approved 18-garden/root-token-0 backfill, or unpause core. Those operations move together to a
    separately reviewed Product issue, which must prove the paused-registration increment, exact
    Safe owners/threshold on each target chain, one verified transfer boundary at a time, every
    backfill receipt/checkpoint, and a separate unpause authorization. The protocol Safe remains
    the approved future owner. This change does not invent an EOA backfill path: ownership and
    backfill commands are absent from the current one-password operator, current ownership
    broadcast fails closed in the manifest, and post-deploy owner verification stays in
    `deployment` phase. The pending paused-registration increment no longer blocks a paused
    deployment candidate, but remains mandatory before the later backfill issue can execute.
100. Pool-pause scope is creation-side by design (2026-08-11, Afo decision from the
    architecture-tab ↔ contracts audit): the shipped `PoolState.Paused` gates only creation-side
    writes (`createCommitment`, series creation, cycle seed/open); claims, acceptance, Ready
    submission, confirmation, and exchange remain callable on a paused pool, and the module-level
    `setPaused` is the emergency freeze. The five documents that described pool pause as blocking
    claims/Ready/confirm were corrected to the code posture in the same pass (D8, contract-spec
    §5.2/§6.2 prose, acceptance-matrix, uiux-spec, closure-matrices LC-01). A fuller claim/confirm
    pool freeze is a deliberate post-deploy upgrade candidate — not a defect — to be scheduled
    with the first pooling-tier upgrade window if operations wants it. Tracked as PRD-813.

101. Client prototype correction pass (2026-08-11, Afo decisions D1–D10 in the interactive
    plan session; the written contracts are the uiux-spec Appendix B addenda and the
    contract-spec commitment-metadata schema addendum): the client catalog is two-tier — 17
    canonical journeys, each starting at a drawn home surface (W1 pool tab / W5 wallet drawer /
    WFLOW Garden tab; validator-enforced) with every offline/failure/cycle-state variant kept in
    the Screen library; retired flow hashes (sb3a/7/16/26/28/30/36/38–41/44/52) follow the #sb9
    precedent. The composer is entry-fixed — no in-form Direction control — with kind words, an
    optional Add-details capture (photo / voice note / written note / links → commitment-metadata
    JSON v1 → `metadataCID`; app-layer only, write-once, evidence is the post-creation channel),
    How-often Just once / Ongoing (W33 retired into composer states `ongoing-terms`/
    `ongoing-review` running one ordered `createCommitmentSeries` + place-creation queue
    sequence), the exchange row as a labeled step-2 detour, sectioned Submit-Work review anatomy
    with per-section edit links, and a real review step for requests. Evidence capture is
    MDR-parity (camera / gallery / voice note from the fixed bar, link/note kinds, multi-item,
    contributor chips kept). The work↔promise bridge is drawn in both directions: WFLOW is the
    real four-step Submit Work flow plus the "Fulfills a promise" picker, and `w2.link-work`
    targets a client work-picker instead of the admin console. Cards follow the D5 contract
    (creator by-line, real progress only, one context action or one reason line, roster
    indicator; ongoing places carry an Ongoing chip + places-left). "Things I can offer" gained
    its drawn wallet entry; W31 is titled "Start from a template"; sb27 is a take-up journey with
    steward-only season/campaign copy on the no-season state; action bars are kit-enforced
    one-row with a validator check; the player restores catalog scroll on flow exit. "Promise"
    names the record; offer/ask name the acts. Admin-console findings are recorded in
    `reports/admin-prototype-follow-up-2026-08-11.md`, deliberately unfixed this pass. No runtime
    package, contract, ABI, indexer, or Linear change.

102. Iteration 2 on the client prototypes (2026-08-11 evening, Afo's artifact review + three
    locked Q&A rounds; supersedes register #101's exchange, ongoing-detour, and ask-naming
    placements): wizards wear the real Submit Work chrome (FormProgress numbered circles, close
    on step 1 / back after, one-row fixed bar); the kind choice is equal 2-up cards and choice
    rows are equal-height. Ongoing folds INLINE into the composer — the amount step expands and
    the review gains a Places section; the separate Ongoing chapter and detour states retire.
    **Exchange is parked**: no client journey walks it and the composer/template entries are
    removed; W28–W30 remain Screen-library reference pending a dedicated design session.
    "Request" is the one asking word ("Make a request" entry, Requests chapter), and the drawn
    request walk is the steward cast with a real Support step — declaring G$ on the phone with
    existing declared-consideration semantics, gardeners skipping the step. Evidence is a true
    MDR variant (media → details → review with cast-preserving review variants and a tap-to-add
    capture area). The promise detail gains the E5 anatomy — people row + team strip above the
    fold, the one contextual primary in a fixed bottom bar (inline duplicates stripped). The
    confirm walk ends once on the promise (duplicate kept-screen and the editorial echo
    removed); the team journey enters through the promise detail and the new "Add people to
    your team" walks the lead's roster add; the protocol journey runs claim → work → confirmed
    → support arrived in one arc; change-of-plans splits into Withdraw an offer / Offer it
    again; the campaign take-up journey folds into Help-with-what-was-requested branches. The
    review catalog lays chapters two-up. 17 client journeys; build 39 screens / 414 states /
    592 hotspots / 45 flows / 283 scenes, 0 warnings; artifact republished (share pin re-pinned
    manually). No runtime package, contract, ABI, indexer, or Linear change.

103. The `commitment-pooling-settlement-credit-v1` candidate is deliberately reopened for one
    coherent ABI increment (2026-08-11, Afo decision). The increment contains exactly three
    changes: member-funded priced-Offer claims with garden-Safe custody and mechanically eligible
    refunds under `member-funded-claims-brief.md` Option B; `PoolState.Paused` as the full per-pool
    freeze for claim, decline, acceptance, exchange, Ready submission/override, and both
    confirmation paths; and authority-preserving `registerPool` backfill while the module is
    paused. This supersedes register #100's creation-side pool-pause posture. The frozen candidate
    is reopened only for these three changes, then receives new interface/storage/event closure,
    tests, release identities, and a fresh committed-range review before re-freeze. Specification,
    closure matrices, ontology, Linear tracking, diagrams, prototypes, and the circulation
    document must close and pass their gates before implementation begins; Afo reviews those
    Phase 1–3 surfaces at the explicit pre-code checkpoint. Register #102 was already committed to
    the client-prototype iteration before this dispatch, so this decision uses the next available
    number rather than rewriting decision history.

104. Narrow specification re-closure after the Phase 4 adversarial review (2026-08-11, Afo
    authorization; amends register #103 without widening its product scope): `FundingWithdrawn`
    becomes the fourth funding event so the later event-derived read model can distinguish a
    nothing-owed `Pledged -> Withdrawn` transition from an unchanged pledge. The member-funding
    ERC-7201 namespace appends `consumedFundingOfCommitment` as declaration six; consumption sets
    that pointer once, and payout completion closes funding locally from it without an external
    Commitment Pooling read on the fixed-gas authenticated acknowledgment path. The proposed
    configured batch limit must be measured against the 300,000 source-receiver budget with the
    worst case of distinct funded plans; a lower measured limit is required if 24 does not fit.
    The unchanged paused-registration authority risk is explicitly accepted: a current root-garden
    steward can register the root as Garden before the module owner registers the Protocol pool,
    consume the root's one-pool slot, and block later Protocol registration. The reviewed backfill
    must reject that shape and execute the owner-only exact-root Protocol registration first, but
    this increment adds no new authority guard. These two spec corrections and the recorded risk
    acceptance reclose and receive Afo review before their Phase 4 implementation changes; no
    other ABI, storage, authority, release-lane blocker, or application/indexer scope rides this
    amendment.

105. Internal committed-range review substitution confirmed for the member-funded increment
    (2026-08-12, Afo confirmation): the August 10 decision to use an internal committed-range
    review instead of an external vendor audit extends to the reopened member-funded release
    increment pinned at
    `21454603967370e98a61df70d399cfa7c11ce63d..50a2c29d3d9f08ed97d9b0e8b8de95d07f6fcb63`
    and reviewed in `reports/member-funded-release-rereview-2026-08-12.md`. This closes only the
    explicit audit-disposition confirmation requested by that report. It does not authorize a
    deployment, broadcast, Safe transaction, value movement, canary, unpause, cap increase, or
    indexer activation; it does not close the protocol-Safe transfer, AssessmentResolver v3 Phase
    B, final `destinationGasLimit`, or value-authority blockers; and it does not extend the pinned
    range to later build/test optimization commits.

106. Protocol ownership transfer is deferred beyond this release, while the paused pool backfill
    remains in the current release (2026-08-12, Afo decision; supersedes register #99 only where it
    coupled ownership transfer and backfill into one later ceremony). The frozen deployment sender
    remains the temporary `CommitmentPoolingModule` owner and may execute the exact reviewed
    Arbitrum registration sequence directly: owner-only Protocol registration for the canonical
    root token 0 first, followed by the other seventeen Garden registrations, with the module
    paused throughout. The deployer path must use one password entry, one resumable command,
    one direct zero-value transaction per boundary, fresh nonce checks, contiguous receipt-backed
    checkpoints, finalized inventory and implementation checks, and the same root-first plan
    reconstruction used by the Safe path. It must stop after registration boundary 18. Unpause is
    a separate command that is unavailable until all eighteen receipts and pool IDs verify. This
    decision grants no agent broadcast, ownership transfer, peer wiring, Safe/Zodiac value
    authority, value movement, message-only ping, canary, cap increase, or indexer activation.
    The protocol Safe remains the approved later owner, and its transfer receives its own future
    review and authorization rather than blocking this release's paused registration backfill.

107. The Garden ERC-6551 account may replace the named Garden recovery delegate in the future
    Celo Garden Safe owner set only after a bounded fork spike (2026-08-12, Afo authorization).
    The spike is specified in `erc6551-garden-safe-owner-spike.md` and must separate deterministic
    address derivation, code deployment, foreign-account execution, source authentication, Safe
    threshold behavior, replay safety, and recovery. The production owner set does not change in
    this decision. The current three-recovery-owner design remains canonical unless the exact
    same-address implementation and a Garden-bound cross-chain executor both pass their gates.
    The spike may add plan evidence and fork tests only; it authorizes no production Safe/Zodiac
    transaction, trusted-executor mutation, value authority, value movement, peer wiring, canary,
    settlement ABI/storage change, or ownership transfer.

108. Garden Safe addresses may be bootstrapped before the final Garden-controlled owner is ready
    (2026-08-12, Afo authorization; temporary exception to register #107's unchanged deployment
    owner set, without authorizing value). Each participating Garden Safe starts as exactly
    1-of-2: the frozen deployment EOA plus the existing Celo Garden recovery Safe at
    `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C`, live-verified as a module-free 2-of-3 Safe.
    Bootstrap Safes must remain empty and have no guard, module, Zodiac role, executor authority,
    G$, or other value. A resumable Bun-wrapped script derives all eighteen addresses from the
    reviewed Garden inventory, deploys them through the pinned Safe v1.4.1 factory/singleton, and
    later replaces the deployment EOA with an exact reviewed per-Garden owner through one
    `swapOwner` Safe transaction per Garden. Every replacement owner must be unique to one Garden.
    The bootstrap must have nonce zero and the swapped state nonce one; the swap must verify the
    predecessor, nonce, owner set, threshold, zero balance, and zero modules before execution and reread the resulting owner
    set afterward. After all eighteen swaps verify, the durable deployment artifact must replace
    the temporary EOA owner policy with the final per-Garden owner sets and retain both deployment
    and swap receipt evidence. Bootstrap or swap completion does not activate settlement: the
    canonical final owner threshold, Garden-bound authentication, Roles permissions, caps, peer wiring, funding,
    and value canary remain separate review and authorization gates. No broadcast is authorized by
    this planning decision alone. **Evidence clarification (2026-08-14):** generic EVM token
    holdings cannot be enumerated from a Safe address. The script proves and records only zero
    native balance, zero canonical G$ balance, no modules, and no guard; it explicitly records
    arbitrary ERC-20/ERC-721/ERC-1155 inventory as not enumerated and must not describe that
    bounded check as proof that the Safe contains no other assets. Any later value-authority
    activation requires its own reviewed asset-inventory evidence.

109. Mainnet release gates are risk-tiered rather than one all-or-nothing checklist (2026-08-14,
    Afo decision; supersedes register #78 only as the living activation rule and preserves its
    historical record). Every boundary retains the common test, explicit-human-authorization,
    selected-review, receipt/post-state, and tested-rollback floor. A paused deployment with no
    peer, role, allowance, custody, transfer, or value authority is tier 1. A non-custodial,
    non-transferable coordination activation with every value dependency paused or disabled is
    tier 2; temporary ownership is permitted only with explicit accountable-owner risk acceptance,
    exact current and rollback-owner verification, emergency pause, and no unresolved
    Critical/High finding in the selected committed-range review. Custody, transferability, peer
    wiring, allowances, value movement, or any exercise of protocol upgrade/administrative
    authority other than emergency pause is tier 3 and
    requires the protocol Safe threshold/owner policy plus the external-audit, timelock, and soak
    defaults. A human release owner may replace or waive an audit, timelock, or soak default only
    through an explicit dated, release-scoped disposition that names substitute evidence. No
    agent, passing test, or deployment artifact grants a waiver. Per-garden Celo settlement Safes
    and settlement value authority are always tier 3. The current pooling activation is accepted
    only as tier 2 while the deployment-sender owner key is passively retained under the explicit
    temporary-owner risk acceptance and SettlementModule, CeloSettlementExecutor, peer wiring,
    Safe/Zodiac value authority, and value movement remain paused or disabled. The retained owner
    may emergency-pause Pooling, but any upgrade or other administrative mutation requires a new
    tier-3 gate.

110. Completed release ceremonies are retired rather than kept as replayable batch broadcasts
    (2026-08-14, Afo quickest-safe-route authorization). The finished core deployment, root-first
    18-pool backfill, and separate Pooling unpause orchestrators plus their placeholder authorization
    files are removed; their receipt artifacts, recovery entrypoints, and read-only verifiers remain.
    The remaining credential operator is limited to one explicitly selected Garden Safe bootstrap
    or owner-swap boundary per password session. Each invocation verifies the complete checkpoint
    prefix, exact receipt block, live dependency identities, and the independently read exact
    module-free 2-of-3 recovery Safe before accepting the step. No peer wiring, Safe/Zodiac value
    authority, ownership transfer, or value movement is added by this retirement.

111. The deployed Celo executor's initialized source peer is a completed tier-3 configuration
    boundary (2026-08-14 classification correction). Its initializer pinned the nonzero Arbitrum
    selector and SettlementModule address, and the release verifier requires that exact peer, so
    current-state documents must not describe peer wiring as pending or disabled. This correction
    does not reclassify the separately authorized Commitment Pooling unpause, which remains tier 2.
    SettlementModule and CeloSettlementExecutor remain paused; Safe/Zodiac value authority, ping,
    canary, caps, and value movement remain blocked behind their own tier-3 authorization and
    evidence. The owner-confirmed internal committed-range review substitution applies to this
    release increment, while no agent or artifact waives any still-open ownership or value-
    activation gate.

112. Exact same-address GardenAccounts and direct final Garden Safe ownership replace the
    temporary deployment-EOA bootstrap as the living path (2026-08-14, Afo decision; supersedes
    register #108 and the fallback owner set in #107 without rewriting their historical record).
    Before any Garden Safe deploys, the implementation must reproduce the reviewed Arbitrum
    GardenAccount implementation and every immutable dependency at the same Celo addresses,
    create and initialize each ERC-6551 account atomically from the immutable `(42161, Arbitrum
    GardenToken, tokenId)` tuple, and prove a dedicated authenticated Garden-bound relay. The
    relay binds the source chain/router/sender, Garden/token/account, destination Safe, exact Safe
    call and operation, nonce/action ID, deadline, replay state, and honest pre-finalization
    cancellation; it never reuses the Settlement executor and cannot satisfy Safe threshold two
    alone. Each new Garden Safe is predicted and deployed directly with the exact GardenAccount,
    Green Goods protocol recovery Safe `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19`, and Greenpill
    Dev Guild recovery Safe `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C` at threshold two. No deployment EOA,
    threshold-one state, `swapOwner`, or `changeThreshold` ceremony remains in the accepted path.
    The active implementation truth is
    `../celo-garden-account-safe-ownership/`. Its proof authorizes no contract deployment,
    guardian mutation, Safe creation, role/allowance/peer configuration, value movement, canary,
    or other broadcast; every live boundary remains separately human-authorized.

113. Source-model coherence pass on the pool prototypes (2026-08-16, Afo direction; adds to the
    locked UX record without superseding any entry). Reviewed the specs against Will Ruddick /
    Grassroots Economics' Chama-pool model. The values translated; the central object did not —
    every pool surface described how the pool was *configured* and none described what it *held*.
    Four additions ship, recorded in `uiux-spec.md` C.6: a **holdings block** on `W7`/`W12`/`W1`
    rendering exact-label unit groups plus the reserve, never summed and never converted (D.1
    binds; two existing cross-basis sums were removed); a **Seeded state** on `W7` with opening as
    the event; a **"who's in this pool" roster** on `W7` and `W1` under unchanged D.3 privacy; and
    **frame grouping** of the state switcher (`W2` 75→11, `W1` 33→9, `W7` 31→8) that merges
    presentations while leaving the §17 coverage ledger and every default state untouched.
    Contract finding that shaped the second item: `createCommitment` rejects any cycle that is not
    `Open` (`CreationChecksLib.sol:72`), so a Seeded cycle holds no promises from anyone — the
    "members fill the pool during the seeded window" reading is not implementable, and the pool
    fills at opening instead. Naming defect recorded, not fixed: the `support-` state prefix
    covers both a service offer's lifecycle and the G$ transport chain.

114. PARKED 2026-08-17 (Afo: "park it for now and we stabilize and polish the UI") — reciprocity
    from the claim side (2026-08-16, register #103). The proposal stands as written and needs no
    rework when picked up; it is parked because it is the only new capability while every other
    lane stabilises, not because anything in it was found wanting. Register #102(d) parked exchange until it got its own design session; this is a proposal
    for that session, narrower than what was parked. Taking up someone's offer would, in the same
    skippable step, ask what you can bring and create your offer as part of the claim — so no
    double coincidence of wants is needed. It requires **no contract change**: E.1's picker and
    `validateCounterCommitment` already implement the pair, and this adds only the claim-side
    entry over the same two calls. The design content is ordering — `CreationChecksLib.sol:137`
    requires the counter offer to still be `Offered`, so `createCommitment(B, counter = A)` must
    be enqueued **before** `claimCommitment(A)` and the queue must hold that order across retries.
    Vocabulary ("in exchange for"), the banned-token scan, decision 17 lifecycle independence, and
    the steward-consent exclusion all bind unchanged. Nothing is drawn as shipped design; no
    screen implements it. Full text: `uiux-spec.md` C.7.

115. Creation runs Submit Work's four beats, and the wallet's "Things I can offer" splits by
    what its halves are (2026-08-16, round 12, Afo's four calls). **(a)** `W3` runs What · How
    much · Details · Review on every path. Scope becomes ONE step-1 field on every path
    ("Where it runs") — it had been `field("Season")` on step 1 for garden work,
    `field("Campaign")` on step 2 for a service and `field("Scope")` on step 2 for ongoing.
    **(b)** The protection step folds into step 2, retiring `step-anchors`, `request-anchors`,
    `request-variant` and `request-variant-steward` — proof rows and who-can-take-it were the same
    step-3 slot in different clothes, and both answer step 2's question. **(c)** Details becomes a
    real numbered step on all five paths, from one shared body that is the shipped media step
    verbatim; it had been an unnumbered detour drawn with `w3Head(…, 0)`, so the progress bar lit
    step 1 while the member was on it. **(d)** How often moves to step 1 beside the kind cards —
    at the bottom of step 2 the fork was found only after everything was filled in for a one-off.
    **(e)** Every review follows `views/Garden/Review.tsx` LITERALLY (Afo's call over the
    tappable-rows option): FormInfo over one flat card, one hot row for the Advanced detour
    mirroring `wflow.fulfills`, thirteen `w3.edit-*` links retired, back arrow as the edit path.
    Step 1 goes from seven blocks to three. **(f)** In the wallet, the private saved draft becomes
    a tool row above the ledger and the ongoing Offer's parent moves into its own garden's
    section — the fourth section card was a category error beside three gardens, held one nav row
    instead of content, sat outside the scope chips' jurisdiction, and merged a thing that is not
    on chain with one that is. Raised, NOT acted on: a garden-work promise is still quantified
    twice (`6 hours` and `Prune × 2 · Plant × 12`), which folding proof into step 2 makes more
    visible. Full text: `uiux-spec.md` C.10 and C.11.

116. Three wizards, one grammar (2026-08-17, round 13, Afo's calls). The client has
    exactly three wizards — `WFLOW` (work submission, 4 steps), `W3` (creation, 4),
    `W2a` (evidence, 3); everything else is a tap or a read. **(a)** The steward
    ask's Support step folds into step 2 beside the amount and who-can-take-it,
    retiring `request-support` and taking the last five-step path down to four, so
    creation is four beats everywhere without exception. **(b)** Evidence STAYS at
    three steps (Afo's call): work submission's step 1 picks an action and a garden,
    and evidence arrives from a promise that already fixed both, so a fourth step
    would confirm a choice already made. **(c)** What evidence owed was grammar, not
    step count — its review became one flat card led by the promise being proved
    (it drew three carded sections and never named its subject); note and link
    stopped being step-2 form fields and became items in the step-1 list, so
    everything attached composes into one set ("buttons everywhere"); step 2 is
    renamed "Who helped" for the single question it now asks; queued and failed
    stopped rendering the review step's progress bar; and the capture step gained
    its offline banner. **(d)** The work flow's "2 of 1 needed" chip reads
    "2 added · 1 needed". Creation and evidence now share one `captureBody` and one
    `captureBar`. STILL OPEN, deliberately: proving with work ends in one act,
    proving a service in two (`Attach evidence`, then `Send for confirmation`) —
    the cause is that a service has no approver to advance it, so the provider must
    declare it done. Whether that declaration belongs at the end of the evidence
    wizard is undecided. Full text: `uiux-spec.md` C.12.

117. The record is a Commitment, amending §3 (2026-08-17, Afo: "we say promises but we
    should be saying commitment to be consistent in our framing"). §3 had locked
    "promise" as the community-facing record name; the canonical glossary lists
    `Commitment` as the entity with audiences admin · client · community · docs, so the
    client was carrying a second name for the same thing inside a feature called
    commitment pooling. Swept everywhere: 843 replacements plus five builder renames;
    zero "promise" left in rendered artifact text. §3's OTHER half is unamended — the
    acts stay direction verbs, and no surface may read "Create a commitment". The verb
    is "commit": three rendered strings needed the verb form, which a blind noun sweep
    mangles into "nobody can commitment". NOT touched: `promiseKeptRate` (a contract and
    indexer field name) and the hotspot ids / state keys containing the old word, which
    are deep-link addresses, not copy. Surfaced a latent bug: the Appendix D.1 tripwire
    guarded "promised units", a phrasing no surface had ever rendered, so the rule was
    blind from the day it was written; it now guards the invariant's two real shapes and
    no longer fires on a single commitment's own reserved units. ALSO SETTLED this round:
    the shipped work-submission flow does NOT change (Afo) — a commitment needing work
    actions runs it as designed with the commitment chosen at the start, and
    evidence-based submission not tied to an action is free to differ; the four proposed
    alignment fixes are therefore dropped. Full text: `uiux-spec.md` C.13.

118. Team is one surface (2026-08-17, round 15, Afo's six calls). Policy, invites and
    roster were split between creation's Advanced detour and `W2b`, which never
    referenced each other. One screen now, two lifecycle states matching the contract:
    policy is immutable once accepted, and a roster exists only after acceptance.
    `W3@step-invite` retires; creation reaches team from one row. **(a)** Adding people
    is a SHEET over the team surface, built from the shipped garden Gardeners item
    (Gardeners.tsx:74) — avatar, name, subline, joined line, badge; scroll and tap to
    select. New kit builder `memberRow`. **(b)** Names first, wallet address only when
    nothing better is on file, in monospace — the same resolution order the shipped
    component already uses. **(c)** The kind gate was a defect: every contributor action
    declared `kind: "DomainImpact"`, so a service commitment could pick a team policy and
    then had nowhere to manage it, against contract-spec's "every accepted commitment
    stores … an event-indexed contributor roster". add/remove/join/leave now work on
    every accepted commitment; only `setContributorRequirement` stays garden-work-only,
    since requirement rows exist nowhere else. **(d)** Recognition states the POLICY and
    never a per-person split — the old preview ranked teammates by percentage on a member
    surface, against D.3's copy rule and the round-7 no-per-person-rates rule. **(e)**
    `W2b` gained FormInfo step cards and a fixed action bar; it was the last client screen
    without them. Full text: `uiux-spec.md` C.14.

119. The review IS a WorkView, correcting C.10 and C.12 (2026-08-17, round 16, Afo's
    review feedback). Both earlier rounds described `views/Garden/Review.tsx` as "FormInfo
    over ONE flat card of rows" and built eleven reviews on that. It renders `<WorkView>`
    (Review.tsx:192) — FormInfo, an h6 per section, and ONE FormCard per detail
    (WorkView.tsx:140-176, FormCard.tsx:19). New kit builder `formCard`. Reviewing a
    commitment and reading one afterwards are now the same anatomy. Landing with it:
    **(a)** team moves from the Advanced detour to the details step — who is on this is a
    detail like the photos are; **(b)** the action picker becomes the `selCard` rail the
    Submit Work intro uses, instead of a 2×2 grid that caps at four; **(c)** counts anchor
    at each card's foot over a fixed two-line description box, so a wrapping description
    no longer misaligns the quantities (verified: five cards, one wrapping, all counts at
    the same offset); **(d)** every adder moves into the fixed bar — link and note had been
    labelled buttons in the content while camera/gallery/mic were pinned, two rows of
    adders for one kind of act. ALSO FOUND: `W2`'s `chips` — kind, state and impact
    domains — was computed on every render and never rendered, so the commitment view
    showed none of them; the gallery coverage gate caught it when `domainRow` lost its only
    other consumer. Full text: `uiux-spec.md` C.15.

120. A season is a place you can go (2026-08-17, round 17, Afo). New screen `W1C`:
    a cycle's details on top, then Commitments / People / Insights. Cycle cards in the
    carousel become doors; ended cycles trail the live ones so swiping right walks back
    through the garden's memory, with an All-seasons card after them. `W1@cycle-summary`
    RETIRES into it — a finished season had been a MODE of the pool tab, so a garden's
    memory was a state of the current screen rather than somewhere to navigate; the MF10
    alias and sb9c's branch repoint to `W1C@season-ended`. The pool tab keeps its scope
    (live cycles) and widens its list to every commitment belonging to them whatever state
    it reached, and keeps the filter row it already had rather than gaining a second axis
    (Afo: "we have a filter selection on the title level we should use that"). People
    names who took part and their role — what D.3 permits — while each person's own
    kept/lapsed record stays between them and their stewards. Insights leads with the
    assessments bracketing the cycle and the shift between them, naming the markers that
    moved and the one that did not, then aggregate figures per unit basis, never
    per-person (Afo: core metrics and the assessments, without leaning on the people
    aspects). STILL TO DO: the admin equivalent, which Afo approved in the same round.
    Full text: `uiux-spec.md` C.16.

121. The console's cycle view (2026-08-17, round 18, closing decision 120's "still to
    do"). `W7C` gives a steward the same three questions `W1C` gives a gardener, in the
    console dialect: two-column workspace split with the cycle's holdings and acts in the
    right rail, Title Case AdminCard heads, dotted status chips, no hero. The season card's
    header is a door (`objectCard` gains `hotId`); its header acts keep acting in place.
    `Close Season…` and `Start Campaign` are reachable from the cycle they act on rather
    than from the pool tab two levels up. ONE deliberate divergence from the client view,
    and it is D.3 working as written: the console's People tab adds a Pool History card
    ("4 kept · 1 lapsed · 2 received · carrying 1 open") that the client's does not —
    counts only, never a percentage or a grade or a ranking, visible to a steward or to
    that member themself, never published. Full text: `uiux-spec.md` C.17.

122. The details step, and one section-title style (2026-08-17, round 19, Afo). **(a)** The
    dashed tap-to-add surface retires — a second way to do what the fixed bar already does,
    sitting where the attached items should be. **(b)** The step becomes Team over Media:
    an empty team is a full-width button, a populated one a carousel with the add demoted
    to a plus in the section title, so the roster can never push the media list off the
    step. New builders `memberTile` / `memberTrail`. **(c)** The primary loses its label to
    an icon — five adders plus a word squeezed it to nothing — keeping its end position and
    accent. **(d)** ONE section-title style across the client: the early steps used `.t-sec`
    at 16.5px sentence case while later steps and every read surface used `.h6s`, the 11px
    uppercase label mirroring WorkView's `<h6>`. The shipped component decides it; `.t-sec`
    takes the `.h6s` metric inside the client dialect. Verified across all four creation
    steps at 11px / uppercase / 600. Admin keeps its own `.t-sec`, a genuine card heading
    there. Full text: `uiux-spec.md` C.18.

123. Submit Work, drawn as it actually is (2026-08-17, round 20, Afo). The prototype's
    WFLOW is a drawing of the SHIPPED flow and was wrong in three places; the flow does not
    change, its drawing does. **(a)** Media mirrors Media.tsx:500-556 — FormInfo, a
    self-start count badge, the Needed and Optional pill groups the chosen action declares,
    then image TILES with audio notes beneath. The dashed capture card over a row list
    existed nowhere in the shipped step. **(b)** Details mirrors Details.tsx:113-180 —
    FormInfo, Time Spent, then THE INPUTS THE CHOSEN ACTION DECLARES, then feedback. The
    "Fulfills a commitment" row asked a question the intro had already settled and pushed
    the step's real content out of view; it retires, and `WFLOW@fulfills-pick` and
    `WFLOW@details-linked` retire with it — a picker for a settled choice, and a twin
    distinguished only by carrying it. **(c)** Review was the last review still drawing a
    flat card of rows; it takes the WorkView anatomy from C.15, keeping the fulfills line as
    one FormCard, because stating what was chosen differs from asking again. Full text:
    `uiux-spec.md` C.19.

124. The commitment's identity card (2026-08-17, round 21, Afo's four calls). The top of
    the commitment view was four bare canvas rows with ad-hoc padding and no grouping; it
    is ONE card now — the card tapped in the pool, expanded. Terms stay in Details rather
    than repeating (Afo: "we don't want to repeat too much information"); what the card
    carries is where this stands and what has been done. THE SUBSTANTIVE PART: the progress
    block makes the two readiness paths legible. `attachEvidence` has NO kind gate, so a
    garden-work commitment can hold evidence and credit contributors with it — but
    `submitForConfirmation` REJECTS DomainImpact, so that evidence never advances readiness;
    only approved work reaching every requirement count does. A service is the opposite: no
    requirement rows, evidence IS its path. The block says this structurally — requirement
    counts carry bars, everything below the hairline carries none, and the absence of a bar
    is the signal. The explainer appears only where both are present. Browse views omit the
    block. This also settles the band: progress is structural and lives in the card, the
    band keeps what is transient. ALSO FIXED: round 15's `memberRow` took the `.mrow` class
    `meter` already used, so every meter caption had been rendering inside a bordered card
    since then. Full text: `uiux-spec.md` C.20.

125. Actions by state and by seat (2026-08-17, round 22, Afo's four calls). Measured
    first: 22 of 75 W2 states carried an action, 53 were read surfaces. Roles FLIP between
    directions — on an Offer the creator provides and the taker-up confirms; on a Request
    the creator confirms and the taker-up provides — so the seats are provider and
    confirmer, never "creator". **(a)** Garden work takes BOTH `Submit work` (primary) and
    `Add evidence` (secondary) in one row, since attachEvidence has no kind gate; the
    weighting carries what the progress block establishes. **(b)** `W2@contributor` gives a
    non-lead teammate a seat for the first time. CORRECTED against the contract in the same
    round (Afo asked the right question): `linkWork` admits an active contributor as caller
    AND verifies the Work attester is one, so a contributor's own approved work counts
    toward the requirement rows — they get `Submit work` as well as `Add evidence`. The rule
    is that a contributor does everything the provider does EXCEPT send and confirm. **(c)** `W2@active-waiting` splits the active stage by viewer the way
    `ready` already did; a confirmer had been offered the provider's button. **(d)**
    `Send for confirmation` gains a confirmation step naming its consequence:
    submitForConfirmation freezes the contributor roster and credit accounting, so nobody
    can join and no further evidence counts after it. **(e)** How a commitment can end is now a term in Details, changing with the state:
    withdraw while nobody has taken it up, a steward cancels it afterwards — so the provider
    learns where the exit is without being handed a control they do not have.
    Full text: `uiux-spec.md` C.21.

126. Four open items closed (2026-08-17, Afo's calls on the outstanding list).
    **(a) Two-send: KEEP TWO, make the pending act unmissable.** The asymmetry is
    structural — garden work has approvers, a service does not — so the fix is signal, not
    surgery: sending names the roster freeze it causes, and the evidence-attached states now
    read "Not sent yet — this is waiting on you." **(b) Double quantification: they are two
    different questions and now say so.** `unitLabel`/`targetUnits` is what is put in and
    what the pool counts; requirement rows are what stewards approve. Naming fixed, not
    structure — the rows are titled "What has to be approved" and state outright that they
    are a different measure. **(c) unitLabel: NO contract work** (Afo); the guard moves to
    the render, where it has to be anyway since a direct writer can store any length —
    `unitLabel(raw)` truncates past 24 and keeps the full text in `title`, independent of
    the composer so a future contract bound needs no code change. Drawn in `W1C` with a long
    fixture plus three gallery specimens. **(d) C.7 claim-side reciprocity: PARKED** while
    the UI stabilises; the proposal stands as written and needs no rework. Full text:
    `uiux-spec.md` C.10, C.12, C.21, C.22 and the C.7 parking note.
127. A person is a photograph, and so is a photo (2026-08-17, round 23, Afo). Two
    surfaces drew a *description of* a thing where the thing belongs. **(a) The team card
    was a CSS collision, not a taste call.** `memberTile` and `mediaStrip` both emitted
    `class="mtile"`; `.hf.s-client .mtile` outweighs `.hf .mtile`, so every member card on a
    client screen rendered at the media tile's 60×78 with its name and account boxes
    computing to 2px — "just one letter". Media's class is `.mthumb` now and the two no
    longer share a selector. **(b) The carousel stays; the card grows up.** Option C:
    GardenMemberItem's layout at 216px — photo, name, account, role — remove control
    absolutely placed with the text column padded to clear it, the same move shipped makes
    with `pr-14`. Registered-date dropped (a team being assembled, not a membership record);
    role kept, because exactly one member is the accountable `leadProvider` and this is the
    last cheap moment to change which. **(c) Avatars are photographs** —
    `member.avatar || ensAvatar || /images/avatar.png`, never an initial; the letter discs
    had no shipped analog. **(d) Media stays ONE list** (Afo, against the shipped two-zone
    grid) **with the picture on the photo rows** — 44px, the shipped minimum touch target,
    tappable into `ImagePreviewDialog`. Read-only strips carry real thumbnails everywhere;
    non-image kinds keep a dashed tile with their kind as a glyph, since WorkView's media
    section only ever holds images. The preview is a **dialog, not a route**: it renders the
    state underneath verbatim and adds an overlay, counts photos only (`photoOnlyData`), and
    draws an arrow only where there is a neighbour. Full text: `uiux-spec.md` C.23.
128. The three Offer flows (2026-08-17, round 24, Afo's eight-item review). **(a) Cycles
    had no tag on the client and the WRONG one in admin** — `chip("Campaign", "request")`
    used the Request tone exactly, so a campaign tag and a request tag were the same colour,
    while the client carried the cycle as prose in the meta line. New tone pair, one hue at
    two weights: season filled, campaign outlined. Its own card slot, not one of the three
    tag places. **(b) Who confirms moved into step 3**, which now asks who confirms · team ·
    media; the review follows it, under a rule worth keeping — the review reads in the order
    you filled it in. Team appears in a review for the first time. **(c) Five queued outcomes
    had five compositions**; they are one screen now, the pool tab with your new card at the
    top, and the banner is gone everywhere rather than added everywhere (the Queued chip, the
    status-bar glyph and the card note already said it). **(d) Pickers are controls** —
    `.ch`'s box reset defeats the 44px minimum, right for a label and an a11y defect for the
    how-much step's pickers; `pickRow` is the control form. **(e) "Places" is retired** — a
    second name for a thing that already had one (`standing-commitments-spec.md:224`), absent
    from the glossary and the contract, and introduced before it was defined. State keys and
    hotspot ids keep it, as deep-link addresses. **(f) An ongoing offer lives with the season
    with NO contract change**: `CommitmentSeries` has no `cycleId`, but every `Commitment` it
    opens does, so the season is a true statement about all of them. The Things-I-can-offer
    entry — the one path that never picked a cycle — now enters at step 1. **(g) W34 is a
    commitment view**: W2's identity card, carrying the cycle, then the completion picture,
    then sections. Full text: `uiux-spec.md` C.24.
129. Value over time, and the denominator rule (2026-08-17, round 26, Afo). Asked what Maria
    is making: "one thing she's able to offer multiple times, and the key reason is how do we
    show the value of a commitment over time." **The two units are different objects** — a
    commitment is the unit of accountability and ends; an ongoing offer is the unit of value,
    and its worth is the pattern no single commitment can express. **The public record is
    numerator-only**, and that is a rule rather than a style: D.3 forbids per-person rates and
    what enables them is a denominator, so "12 sessions given" is publishable where "4 kept ·
    1 lapsed" is not. Accepted cost: twelve of twelve and twelve of thirty look the same in
    public. Pool-level aggregates ("22 of 26 kept" on a cycle) are untouched. **Caught in my
    own work**: W34's identity card carried a per-person denominator with a progress bar,
    added one round earlier; removed. **The record leads W34 and rides the pool card**, since
    the card is where the decision happens. **`W3@repeat-noticed`** lets a repeat become a
    practice from here on, and says plainly that past one-offs cannot be gathered up, because
    commitmentSeriesId is set at creation and commitments are immutable. Full text:
    `uiux-spec.md` C.26 (and C.25 for the offer-flow corrections).
130. Stopping is one act (2026-08-17, round 27, Afo: "they just stop, make rest and retire
    one control for now"). Sixteen W34 states served a two-verb lifecycle nobody uses; four
    remain, and the screen fell from 35 states to 23. **The control calls
    `restCommitmentSeries`, not `retireCommitmentSeries`** — stopping should destroy nothing,
    which matters more since decision 129 put the record at the centre of the screen, because
    retiring would force anyone returning next season to start a new series with an empty
    one. `retireCommitmentSeries` stays in the contract, unused by the UI, so a terminal state
    is not foreclosed. Facts still say `Resting`: the on-chain state is unchanged, only the
    vocabulary and the control count collapsed. Also caught: the stopped chip read "Withdrawn"
    (the identity card had no branch for the new word), and four states carried two buttons to
    the same story. Full text: `uiux-spec.md` C.27.
131. The lead is already on the team (2026-08-17, round 28, Afo). **`leadProvider` is the
    offer creator** and solo is a one-contributor roster, so the team is never empty and the
    "Nobody yet" state was wrong. It opens with your card marked Lead; you cannot remove
    yourself. Helper line cut to one fact about the act: "Anyone you add can add evidence and
    submit work." **Who confirms names the act** — "Whoever you help says it was done" — since
    "the person you help" described a category and never said what confirming does.
    **Reviews gate on reading**: the act arrives disabled with its reason and enables at the
    end of the scroll, drawn as two states because the artifact is static. **The ongoing view
    extends the offer view** rather than being a second product: the commitment view's anatomy
    plus what only a repeating offer has — the record, what is open now, how it repeats, and
    who has taken it up. Also: CLAUDE.md gained an Output Style section (answer first, plain
    language, no em-dashes where a full stop works). Full text: `uiux-spec.md` C.28.
132. Section labels are headings (2026-08-17, round 29, Afo). Measured first: client section
    titles were already uniform at 11px uppercase grey across ten screens, so the reported
    inconsistency was actually the step card's heading sitting above them. Sections take the
    heading style — 15px, 650, sentence case, ink. **Deliberate divergence from shipped**:
    WorkView uses an h6 and Media.tsx uses text-xs uppercase, which is what round 19 unified
    down to, so the pooling flows read differently from the shipped work flow until shipped
    follows. Full text: `uiux-spec.md` C.29.
133. Four corrections (2026-08-17, round 30, Afo). **The repeat explainer button is gone** —
    it was a prototype navigation affordance dressed as product copy; the title field carries
    the hotspot, since the composer recognises the title itself. **One plus on the team**: the
    section title keeps it, the rail's Add tile goes. **Client button labels are Title Case**,
    153 of them, with small words lower unless they lead or close; admin already used Title
    Case acts. **The ongoing view is a full-screen read surface** with no bottom nav and a
    fixed bar carrying the primary act, with Edit Details and Stop Offering in the secondary
    row. Full text: `uiux-spec.md` C.30.
134. Units, one number, and a real extension (2026-08-17, round 31, Afo). **Garden work is
    always hours** — requirements carry what is done and which domains, unitLabel carries how
    much of you went in, and unit groups are keccak256 buckets that never sum, so a free
    choice fragments what the pool holds. Services keep six chips: hours, sessions, rides,
    meals, repairs, other. **One number, not two**: "How much in each" and "How many to open
    now" asked about a structure the user had not been shown, so the composer asks only how
    big one is and opening more happens on the offer screen. **"Whoever takes it up confirms
    it"** — the old line read badly and Afo's proposed fix would have meant self-confirmation,
    which the contract forbids. **The ongoing view actually extends the commitment view now**:
    ongoing blocks first, then Garden, Media, Details, People, Timeline in the commitment
    view's own order. Three defects of mine fixed: heading margin stacked on flex gap (18px),
    the action bar's secondary row was never a row (primary wrapped at 70px), and a solo team
    card did not fill the width. Full text: `uiux-spec.md` C.31.
135. The em-dash sweep, finished (2026-08-17, round 32). Roughly 160 more strings across
    `client.ts`, `client-wallet.ts` and `kit.ts`, on top of the offer flows' 35. Rule: a full
    stop where an independent clause follows, a comma where a trailing phrase does, applied by
    pattern and read back, since the two are not mechanically separable. One hand correction
    where a proper noun opened the second clause. Keeps its dash: photo names ("North beds —
    before" names a variant), screen-library state labels (the prototype's index), and
    prototype documentation (a different register from the UI). Verified by walking 22 client
    states and reading the rendered text: zero in product copy. Full text: `uiux-spec.md` C.32.
136. The request-flow pass (2026-08-17, round 33). Walked all eleven request states. **A
    garden-work ask still picked a unit** while the equivalent offer path was fixed to hours in
    decision 134; same commitment kind, same counting. **Every review said "What you're
    committing to"** — on a request you are asking, so `w3Review` gained `asking`. **The details
    step contradicted its own review**: the decision-135 sweep set the confirm default
    everywhere, so a request said "Whoever takes it up confirms it" while its review said "You,
    because it was your request"; it now reads "You confirm it, because you asked". Two of the
    three were mine, from applying offer-shaped changes globally. **A request has no team** (Afo): the section claimed you would add
    evidence and submit work, which is what the counterparty does. The three request details
    steps are Who confirms and Media, and the ask composer is now shorter than the offer
    composer, which is honest. Full text: `uiux-spec.md` C.33.
137. The request-flow second pass (2026-08-17, round 34, Afo). **The review is one card
    shape** — it had three, and everything is a FormCard now except Media, which holds a
    thumbnail strip rather than a value. Two cards had also shared an icon. **Amount pickers
    fill the row** at six options rather than four. **The claim-mode options are the same
    length**, so the two cards stop being different heights, and *neighbor* became
    *neighbour*. **The steward G$ banner is gone**, since the review states those terms where
    someone is actually checking them. **An open request is the pool tab**: the scene had no
    header, no filters, one card and a screen-level "I can help", the one act on a browse
    surface in the feature; taking it up happens in the commitment. Held for discussion: what
    "Open More" means on the ongoing offer. Full text: `uiux-spec.md` C.34.
138. Offer another (2026-08-17, round 35, Afo). "Open More" borrowed **open** from the
    retired places vocabulary and hid what the act does. `CommitmentSeries` is never takeable;
    only the `Commitment` rows it produces are, so making another is `createCommitment` again
    with the same terms. The label is **Offer Another**, or **Offer One** when nothing is open.
    **Open survives as an adjective** — a takeable commitment is open, so "Open now" and "2
    open" stay — while every use of open as the VERB became offer, including W35's title.
    Full text: `uiux-spec.md` C.35.
139. The admin-console pass (2026-08-17, round 36, Afo). Walked all twelve console screens.
    **Admin was already clean on the two things the client kept failing**: one section-title
    metric (13.5px/700) and Title Case acts throughout. What it carried was stale vocabulary in
    three layers. **Verb breakage from the promise→commitment rename** — "before neighbors can
    commitment", "nobody can commitment yet", "a season it can commitment into"; that sweep was
    recorded as fixed and was only fixed in the client. **"Places" survived here** after the
    client retired it, so W7's ongoing rows said "3 places made"; they now say "3 offered", and
    the resting row says stopped. **"neighbor" against the client's "neighbour"**, 23 across the
    console, kit, gallery, journeys, editorial and lo-fi frames; `poolHoldings` defaulted to the
    American spelling so the holdings block rendered it in both dialects. **71 em-dashes**
    rewritten by C.32's rule. Verified across twelve screens: zero of each. Full text:
    `uiux-spec.md` C.36.
140. The retired-vocabulary gate (2026-08-17, round 37, Afo). Every vocabulary decision in
    this feature leaked a dialect, and the promise→commitment one was **recorded as done**
    while broken copy stood in the console for three weeks. `RETIRED_VOCABULARY` in
    `validate.ts` guards the retired SENSE rather than the word, so "in place" and "an open
    request" stay legal; each entry names the decision that retired it. It runs on rendered
    states, the gallery, journeys and hotspot notes, and errors everywhere including ascii. A
    companion `DASH` rule keeps em-dashes out of product copy, with journey and hotspot prose
    exempt per C.32 and named exceptions listed rather than matched. **First run found 338**,
    including thirteen leaks no manual pass had reached and two forms my sweeps had
    structurally missed (dashes before a digit or a quote). Reports per occurrence, not per
    surface. Verified by reintroducing three retired words and watching the build fail. Full
    text: `uiux-spec.md` C.37.
141. Proof, equal halves, one radius (2026-08-17, round 38, Afo). **Evidence becomes proof**
    in gardener-facing copy: the word borrows from legal register and implies you are answering
    a doubt. `attachEvidence`/`EvidenceAttached` stay as contract identifiers, and the gate
    learned it as a PRODUCT-COPY-ONLY entry so hotspot notes naming the call do not trip. The
    sweep also nearly renamed 104 hotspot ids, state ids and journey targets, which are
    deep-link addresses; the build's own rules caught every one. **Two acts in a bar are equal
    halves** (`barPair`, 16 bars, 131/124 → 174/174). **A review is one radius**: 24px is the
    browse-card radius and a review is a list of facts, so the stack is 14px through a `.revw`
    wrapper rather than a global change. **Work can be untied at review** from the Fulfills row.
    Recorded as contract facts, not choices: Take This Up is separate because `claimCommitment`
    is what records the provider and reserves a one-person offer, and proof asks who helped
    because `creditedContributors` is an argument to the call. Push-back accepted: Submit Work's
    media step already mirrors Media.tsx; it is the POOLING proof step that differs. Full text:
    `uiux-spec.md` C.38.
142. The composer and the read surface are different (2026-08-17, round 39, Afo: "we are not
    using a grid"). **`Media.tsx:690` is `flex flex-col gap-3`** and only grids at `md:`, which
    a 390px phone never reaches, so a gardener sees full-width photos at aspect-4/3, stacked,
    with the remove control pinned over the image. **`WorkView.tsx:102` is a different
    component**: a Carousel of max-w-40 aspect-3/4 rounded-2xl items. I had built ONE builder
    for both and got both wrong at 60×78 with a 10px radius. New `mediaStack` for the three
    composer steps (358×269, 4:3); `mediaStrip` corrected to the read metric (150×200, 3:4,
    16px). My C.25 note claiming the step already mirrored the shipped file was wrong, and so
    was the round-23 work under it. Lesson: two surfaces showing the same object are not
    necessarily the same component, and "mirrors the shipped step" needs the file open rather
    than a memory of having read it. Full text: `uiux-spec.md` C.39.
143. Commitments get their own sheet (2026-08-17, round 40, Afo). The wallet's other two tabs
    are BALANCES — one fungible number each, no lifecycle — while a commitment is a relationship
    that needs scopes, per-garden grouping, an attention count and retry/discard recovery, so W5
    was a screen wearing a tab. It becomes its own `ModalDrawer` opened from a fourth Home header
    control, the only badged one: `WalletDrawer/Icon.tsx` carries no count, so four things needing
    an act from you were invisible until you opened the drawer. Cheap because the shipping
    Commitments tab is a `ComingSoonStub`. Its three tabs are the three OBJECTS a member holds,
    not three filters over one: Commitments (the ledger, scope chips still inside it), Ongoing
    (`CommitmentSeries`), Saved (private details). Making the scopes the tabs was rejected —
    round 10 settled that scopes filter one list rather than drawing copies of part of it. Both
    round-12 workarounds retire (the tool row above the ledger, the series parent parked in a
    garden section), and W32 drops to the saving flow it always was, 16 states to 8, with eight
    state aliases keeping old deep links alive. Full text: `uiux-spec.md` C.40.

144. Recovery per tab, and the badge sum rule (2026-08-17, round 41, Afo). Round 40's aliases
    pointed W32's loading/read-error at `W5@loading`/`W5@read-error`, which compute tab 0, so a
    saved-details deep link read "Couldn't load your commitments" over the ledger. Each tab now
    carries its own recovery in its own words. Badges follow ONE rule: a pill counts what needs
    an act on that tab, the header control carries their sum, and no pill ever counts inventory
    (Lens 1.5). Full text: `uiux-spec.md` C.41.
145. The tense split, and the steward's third tab (2026-08-17, round 42, Afo: "A and B titles
    are repeating the name of the sheet"). The wallet's own rule is that the container word
    never repeats an object word — "Wallet" holds Cookies · Tokens — and round 40 broke it. No
    synonym fixed it, because the truthful name for that content WAS "Commitments"; the fix was
    to change what the tab holds. Split by tense: **Live** (still moving) · **Over time**
    (settled and standing) · **To confirm** (steward Hats only). Kept leaving Live collapsed the
    lifecycle chips, and the freed row took `All · Offers · Requests` — the pool tab's own words
    (client.ts:644), so direction landed at chip level where a confirmation duty's direction
    cannot scatter it. Over time stops being a list and opens with your record. The steward tab
    holds ONLY authority confirmations — garden claims where the garden is the counterparty and
    its Hat wearers are the ordinary confirmers (CS:1421), plus reasoned fallbacks — which were
    never in the personal ledger, so nothing duplicates and round 10 stands. Saved details left
    the sheet for composer step 1: input material, not a record, which is why no name ever fit.
    Full text: `uiux-spec.md` C.42.

146. The sheet is four regions (2026-08-17, round 43, Afo: "the whole tabs right now are
    scrolling when they should be fixed"). One root cause under three complaints: the shipped
    ModalDrawer is a four-part panel — fixed header, fixed tabs, one scrolling content region,
    fixed footer at h-modal 85dvh — and the prototype had collapsed it into two, passing the
    subtitle and rail as part of the scroller's content. `sheetOver` now takes sub/tabs/footer/
    close. Verified: body 585px clipped to 542px with the rail moving 0px, both sheets at 574px.
    The rail also adopts the shipped anatomy (full-width segments + 2px indicator) over pills.
    Full text: `uiux-spec.md` C.43.
147. A hero is a moment, not a state (2026-08-17, round 43, Afo). Measured at 390px, W2's
    identity card ran 272→1318px and the status band sat at 1318px — two screens below the fold
    on EVERY state. Status moved above the identity card (272px), and `fulfilled` draws a
    compact kept row while `W4@confirmed` keeps the celebration, because that is when it
    happens. Full text: `uiux-spec.md` C.44.
148. Every act in the bar, and the sheet's two answers (2026-08-17, round 43, Afo). W2b rendered
    "Add People" twice from the same hotspot plus two more acts embedded in the roster card, a
    drift back from round 19; all three moved to the bar in round 31's .fbrow shape. "Save and
    Go Back" named navigation, not the act. And the confirmation sheets ask a question, so their
    buttons are its two answers: "Tell the Stewards Why" named the next screen and became
    "Not Yet", which three of five states and the admin Hub already used. Full text:
    `uiux-spec.md` C.45.

149. The identity card carries no title (2026-08-17, round 44, Afo). The commitment view printed
    its name twice, once in `hdr` and once as the card's `.idt`; W34 hardcoded the same literal
    in both places. The shipped surface settles which one goes: WorkView's FormInfo title is
    never the work's name but a state phrase — "Work Approved", "Evaluate Work", "Saved on your
    device" (WorkViewSection.tsx:197-246) — so identity belongs to the header and the first card
    says where the thing stands, which is what round 43's status move had already set up. The
    chips lead the card now. `title` stays optional for a surface with no header of its own.
    Full text: `uiux-spec.md` C.46.

150. Search in the team picker (2026-08-17, round 45, Afo). I had flagged this as invention
    because `Gardeners.tsx` has no search; it is not, because `RecipientPicker.tsx` is a person
    picker in the wallet drawer that has one. The control mirrors its plain full-width input,
    with a leading glyph added since that picker doubles as a paste-an-address field and ours
    only searches. It matches NAMES, which RecipientPicker cannot: it notes at :54 that
    resolving every member across every garden is too costly, and this is one garden's roster
    already rendering those names. Address matching stays, since a member with no name on file
    IS an address. The field rides the sheet's fixed chrome (new `chrome` slot) rather than the
    scroller, per round 43's rule. Three casts: full roster, 2 of 23 matching, no match — the
    last naming the real remedy and dropping the footer. Full text: `uiux-spec.md` C.47.

151. The admin-console structural review (2026-08-18, round 46, Afo). Round 36 swept admin for
    vocabulary; this ran the lenses that found the client's defects. Most of it held — admin
    dialogs already have the four-region anatomy the client sheet lacked, with zero duplicate
    titles, zero empty footers and zero stranded inline actions, and W10 is the strongest screen
    in the prototype. Four fixes: the route header and tab rail pin as ONE band (the header was
    sticky, the rail was not, so 300px of scroll took the stage navigation off screen while
    shipped pins it at Hub/index.tsx:102); W13's rows gained the confirm / Not yet actions §6.9
    specifies, both opening dialogs because each takes a mandatory reason, with the disputed row
    carrying Resolve instead since a frozen commitment is not confirmable; nine recovery states
    across W13/W12/HUBWORK/W24, which had none, so a failed read rendered as an empty queue; and
    the two casing outliers moved to Title Case, leaving the sentence-case question (Lens 4.15)
    recorded and deferred. Separately "Rest the cycle" became "Compost", the contract's own word
    (compostCycle, CS:206), with a second gate rule guarding rest as a lifecycle verb. Full text:
    `uiux-spec.md` C.48.

152. The assessment review (2026-08-18, round 47, Afo). The timing-first rebuild holds — step 1
    derives the wire kind from attribution plus history rather than asking for it. Three gaps
    closed. §6.6 keeps assessment a DIRECT attest with no offline queue, which makes failure the
    only thing that can happen to it, and it was the only creation flow in the prototype with no
    failure cast: `W14@attest-failed` keeps the entered values and says there is no queue holding
    the attempt, and `W14@offline` says so at step 1 rather than after three steps of work,
    because this form is not a draft. And no assessment could be READ anywhere across 44 screens
    — the Assess stage listed rows that did not open, and writing a delta meant comparing against
    a baseline you could not open. `W14@record` is the read view, an AdminDialog per the cockpit's
    detail-flow rule, reached from the Assess row, the delta comparison, and W10's attach picker,
    offering "Write a Re-assessment" since reading a baseline and writing its delta belong
    together. Found while building it: w14's return named the two states allowed to set their own
    advance, so any state added later silently rendered "Continue" and dropped its own button.
    Left open and recorded: the duplicate-baseline rule and the Evaluator-hat gate are prose, not
    states. Full text: `uiux-spec.md` C.49.

153. The two assessment rules, drawn (2026-08-18, round 48, Afo). C.49 left both as prose.
    `W14@duplicate` stops claiming a kind ("Records as: Nothing yet"), names the collision, and
    shows the existing record as a row that OPENS — the C.49 read view is what makes §6.6's
    "points duplicates at the existing record" mean anything — with no Continue, since there is
    nothing to record, and a remedy that leads into the delta path because measuring the same
    domain again is what a re-assessment is for. `W14@no-hat` renders "At the close" DISABLED
    rather than hidden: §6.6 says delta "renders only for Evaluator-hat holders", but that was
    written when a steward picked the KIND, and the flow is timing-first now, so hiding a timing
    choice for an authorship reason would remove a legitimate option and teach nothing. The
    option carries its reason, a banner names which hat the reader holds, and a Who-can row names
    the evaluator. New kit affordance: `radio()` takes `disabled` per option. Full text:
    `uiux-spec.md` C.50.

154. The run-the-season review (2026-08-18, round 49, Afo). The best-built area in the
    prototype: three things I went looking for were not there — W11's gates already disable
    Continue on both blocked states, reason capture matches the contract signatures exactly
    (pausePool takes a reasonCID, closePool and compostPool do not), and W26's paused variants
    each carry what staying paused means rather than duplicating. What was missing is per-step
    FAILURE. Closing a season is closeCycle then an irreversible certificate mint then
    compostCycle; opening one is openPool then openCycle; first-run setup submits six writes in
    order. None had a failure cast, though W21 beside them has two. Five states now name exactly
    what landed and what did not, and each retry repeats only the unlanded call, because a retry
    that re-ran the earlier writes would revert or double-record. w11Facts was corrected with
    them: it declared every setup-* state pool NotReady, which stops being true once five writes
    land. Two round-46 leftovers fixed — the close wizard's step said Compost while its button
    said "Archive Season", and the paused twin's label still read "Rest the cycle" because the
    rename matched only the unpaused string and state labels are exempt from the vocabulary gate.
    Plus W7@read-error, since the garden's main read surface had loading but no error while its
    own child carried both. Full text: `uiux-spec.md` C.51.

155. The Green Goods operations review (2026-08-18, round 50, Afo). The money path holds its own
    invariants better than anything else in the prototype: requeue is gated on an authenticated
    failure, delivery-delayed refuses to be one, acknowledgment-pending states that a late ack
    never re-invokes the Safe route, and outcome states that duplicate terminal acks never mutate
    settled source state. What did not exist anywhere in 44 screens is the OTHER road to Failed:
    the owner-only failStrandedSubject disposition (FailureCode.SourceStranded), which Decision
    Log #60 added precisely because requeue needs Failed and cancelDisbursement takes only
    Queued|Failed, so a Dispatched child is otherwise unrecoverable. The prototype had drawn that
    decision's security half and not its liveness half. W24 gains the arc, as a CHOICE rather than
    an outcome — extend the bounded grace after re-verification, or escalate — because grace is a
    liveness window and the module never acts merely because it elapsed. Two build catches worth
    keeping: the CONFIRM allow-list rejected the reason field I first drew, which surfaced a spec
    gap (failStrandedSubject is named in §3.1.2 and the FailureCode enum but is absent from that
    spec's own permission matrix, so its signature is unsettled and the artifact draws it bare and
    says so); and CALL_RULES had no entry, so the validator crashed rather than waving it through.
    Left open and recorded: W21 and W22 still have no loading or read-error, and W37 has no
    recovery while its client twin W36 has all three. Full text: `uiux-spec.md` C.52.

156. Recovery on the money surfaces (2026-08-18, round 51, Afo). The three C.52 left open. W21's
    settlement queue and W22's transport console had no read casts, and W37 had none while its
    client twin W36 carried all three for the same object. Seven states close them, and every
    admin read surface now has its casts. Each is worded for what a misread would cost: W21 says
    nothing was queued, dispatched, cancelled or paid while it was unreachable; W22 — the one
    where a steward learns whether a command is in flight — says an unreadable console means
    neither "nothing dispatched" nor "failed", and warns against requeueing or cancelling from it,
    since a new attempt is legal only after an authenticated failure acknowledgment the screen
    cannot currently show; W37 says any pledge, deposit or refund already recorded is safe. Facts
    stay undefined on every read cast, because a screen drawing no record asserts no lifecycle
    position. Two vocabulary catches from hotspot prose: "owed" is banned and "operator" is the
    retired word from the steward rename. Full text: `uiux-spec.md` C.53.

157. The commitment view learns who is looking at it (2026-08-18, round 52, acting on
    `flow-audit.md`). W2 knew the KIND of commitment it was rendering and never the SEAT of the
    person reading it, so every viewer-dependent thing on the screen was derived from the state id
    and drifted. A member's own request wore the offer's title, chip, unit, domain, people row and
    completed-work bars, because `requested` was missing from `W2_REQUEST` and `w2Cast`'s silent
    `: "offer"` fallthrough hid it. Two membership tests named ids that have never existed —
    `browse-requested-steward` and `ready-pending` — and neither typechecked nor failed, because
    nothing above `.plans/` runs tsc; they simply drew the wrong screen. Four seats
    (provider · confirmer · contributor · bystander) are enough because CREATOR IS NOT ONE:
    direction already names the creator, so the withdraw affordance gates on phase and seat only
    decides the person of the sentence. Five parallel derivations of "where does this stand"
    collapse into one `W2_PHASE`, which fixes five states that reported Accepted while being
    Active, Fulfilled or ReadyForConfirmation. Four states are added where the audit found seat
    gaps rather than copy problems: `ready-provider` (the provider's flow ended on the confirmer's
    screen, Confirm button and all), `support-accepted-confirmer`, `accepted-joinable`, and
    `fulfilled-confirmer`. Three build-time guards through a new `HifiDef.errors` channel make the
    class of bug impossible: set members must be real states, every state must declare cast,
    lifecycle and seat, and every action bar must name the seat its act belongs to. Both were
    tested by breaking them. Also closed the six pre-existing `architecture-closure.validate.ts`
    failures, one of which was an assertion checking for the word *promises* that the vocabulary
    sweep had retired everywhere else. Build 44 screens / 517 states / 730 hotspots / 53 flows /
    317 scenes, 0 warnings; closure validator green. No runtime package, contract, ABI, indexer or
    Linear change. Full text: `uiux-spec.md` C.54.

158. The ceremony, the sheet, and three ways in (2026-08-18, round 53, acting on `flow-audit.md`).
    Nine hero moments in 513 states, six of them on the confirmer's sheet and three on edge casts,
    so the person who did six hours of pruning got a grey band while the person who tapped Confirm
    got a halo every time. Fixing the destination lie unlocked it: all six `w4.done-*` hotspots
    said "Back to the pool" and went to the commitment detail, which is the only reason
    `W2@fulfilled` had been kept quiet. Seven provider states now name what is true rather than a
    counter going up; W4 keeps its hero and says something different. The settled band stopped
    re-firing a celebration on someone who had it days ago. The missing anticipation-to-ownership
    beat cost one band and one early return: `W2@accepted` leads with "João took this up" and no
    longer says four different things about when it is. W5 gained the two rows it never had —
    money in flight and under steward review — which is where `sb11`, `sb53` and `sb5` were
    handing off into nothing; and the wallet became reachable at all, since W23's five hotspots all
    originated inside W23. Two chapters bookend a catalog that began at "Make an offer" and ended
    at "Change of plans", so nobody arrived and nobody left: three flows added, none needing a new
    screen. The sentence explaining what a commitment IS reached 1 of 33 pool states while the
    steward's console carried it daily; it is the commitments list's subtitle now. Withdrawing a
    request had a drawn button and the offer's sheet behind it. Every machine word left the client
    surface: on-chain, fulfillment, indexed, transaction and threshold to zero, syncs from
    nineteen, roster from fifteen, cycle from four. Afo's call on the steward roster went against
    the recommendation: keep the counts, delete the disclaimer. Build 44 screens / 519 states /
    736 hotspots / 56 flows / 329 scenes, 0 warnings; closure validator green. No runtime package,
    contract, ABI, indexer or Linear change. Full text: `uiux-spec.md` C.55.

159. What the review caught that the gates did not (2026-08-19, round 54, acting on the CodeRabbit
    review of PR #732). Four findings were real and one was the same bug seen twice. `W26@close-failed`
    declared the cycle `Reconciled` while its own banner read "it is still open, no bundle was
    locked" — and nothing caught it, because the retry that repeats `closeCycle` declared no call,
    so the validator never looked. Declaring it makes the build fail from `Reconciled`, which is
    the proof the fact was wrong rather than the rule. Two more hotspots repeated a contract call
    their non-retry twins declare (`w26.compost-retry`, `w24.strand-requeue`), and the stranded
    subject's cancel routed to the Queued-cancel confirm when a stranded subject is already Failed;
    it goes to the failed-delivery close now. The screen registry was the wider lesson: its
    aggregate totals agreed with the build while 19 of 39 rows were wrong in both directions and
    three screens had no row at all, because a total stays right when two rows drift opposite ways.
    Rows are regenerated from the build and checked per row on every build, including the missing-row
    case. `groupStates` floated every ungrouped state ahead of every frame on an `indexOf` miss,
    which would change a screen's default; no screen mixes grouped and ungrouped states today, so
    it was latent, and it is keyed in declaration order now. The design contract contradicted itself
    on whether a count that navigates is a button: it is a stat by chrome and a control by
    semantics, and says so in one bullet instead of two that disagreed. The document map claimed
    164 files across five subtrees; there are 170 across six, and `evidence/` had never been named.
    Register 158's receipt of 519 states is superseded, not wrong when written: the two retired
    WFLOW states left in `a6082a860`. Build 44 screens / 517 states / 736 hotspots / 56 flows /
    329 scenes, 0 warnings and no coverage drift; closure validator green. One `.claude/` design-skill
    file changed. No runtime package, contract, ABI, indexer or Linear change.

160. The class the guards did not close (2026-08-19, round 55, acting on the production-readiness
    review of PR #732). Round 52 named the bug class exactly — an id that names a state which does
    not exist, typechecking nowhere and simply drawing the wrong screen — fixed the two instances it
    tripped over, and built three guards for W2. It never swept for siblings. There were eight more.
    `W3` carried a whole "Add G$ support" step, head and actions and all, for a state retired when
    that step folded into step 2; `W7` listed `funded-claim` and `paused-season-menu` in three
    tables apiece and neither has ever existed; `W7_DESC` promised every state a description and
    omitted two; `W1` still grouped `cycle-summary`, retired into the season view; `W32`'s facts
    tested a state that moved to `W5`; and a second `state === "empty"` arm shadowed the first, so
    the pool's empty screen drew a bare card with no pool summary while the version matching every
    sibling sat unreachable below it. None of this was visible because nothing above `.plans/`
    typechecks: biome is scoped to `packages/**` plus md and json, oxlint to `packages/*/src`. The
    hub has its own `tsconfig.json` now, and the set-membership check that was W2's alone is W1's,
    W7's and W34's too — a `Set<string>` defeats the compiler, so the runtime guard is what catches
    those.
    Two seat errors survived their own fix. `sb42` — "Confirm a commitment kept", persona the
    recipient — still ended on `W2@fulfilled`, the provider's screen, which greets its reader with
    "You did the work"; the confirmer's own view had been drawn in round 52 and nothing pointed at
    it. And the disputed family was seated provider on the strength of one steward echo, when
    raising a review is the confirmer's act and all three ordinary routes in arrive from that seat.
    The destination guard could not have caught the first: it skipped every scene with no control,
    48 of 273 transitions, which is exactly where `sb42` went stale after `w4.done` was repointed.
    It covers them now, with the twenty existing crossings named in a list that should only shrink.
    Coverage-doc drift printed a warning after the exit gate and then reported "warnings: 0",
    wrote the artifact and exited 0 — the two signals anyone checks both said clean. Drift fails
    the build now, and the artifact is written only once every gate has passed.
    Three findings were the reviewer's error, recorded because the reasoning is worth keeping:
    `support-evidence-queued` sits at Accepted correctly, though not for the reason its comment
    gives — the rule is that a queued transition preserves phase, not that a service has no
    approved work; `w10.dispute-confirm` targets the offer cast correctly, because `w10Facts` draws
    `raise-dispute` as DomainImpact while the override and cancel states draw SupportService; and
    `withdraw-confirm` does render its consequence sheet over a scrim.
    Terminal commitments offered an editable team: `w2RosterFrozen` answers a contract question, and
    Cancelled and Expired never fire `ContributorRosterFrozen`, so both fell through to "add, remove
    and assign contributors" on a commitment that had ended, which `addContributor` forbids outside
    Accepted (CS:1411). Proof was seat-dependent — the provider saw the photos on `active` while the
    confirmer and a contributor, reading the same commitment at the same phase with the same
    requirement totals, saw none, and `contributor`'s band promised "your proof credits you" above
    nothing. `support-offered` named João as the one who could act while offering the act to its
    reader. And the machine-word sweep was an event rather than a rule: the plural `cycles` survived
    on `W34` in three strings and `W15` still told the public that commitments come "from this
    cycle". All nine words are pinned to the rendered member surface now, the gallery exempt because
    it documents the kit. `hifi/validate.ts` exits non-zero when run directly instead of printing
    nothing and exiting 0, which is how PRD-760's closing checklist named a command that could not
    fail. Build 44 screens / 517 states / 736 hotspots / 56 flows / 329 scenes, 0 warnings and no
    coverage drift; closure validator green; typecheck clean. No runtime package, contract, ABI,
    indexer or Linear change.

161. The editorial surface, made buildable (2026-08-19, Afo authorization). Three decisions, taken
    before any commitment-pooling copy goes onto the public site.
    **Public copy says commitment, not promise.** This was not a new freeze — `hifi/validate.ts`
    already fails the prototype build on `/\bpromis(?:e|es|ed|ing)\b/i` (C.14), and `uiux-spec` §7
    had simply never been swept. It is swept now. `promiseKeptRate` survives as a code identifier
    because the gate reads rendered copy, not field names. The rest of `uiux-spec` still carries the
    old vocabulary in §4–§6 and needs its own pass; that is a known debt, not an oversight.
    **§7.2's threshold gets a cycle-scoped indexer counter rather than a weaker rule.** The rule
    reads "at least 5 due commitments and at least 3 distinct providers", and half of it was not
    derivable: `selectPromiseKeptRate` applies no gate at all, and nothing in the indexer schema
    counts distinct providers. The available per-provider entity, `CommitmentProviderExposure`, is
    keyed by address — counting its rows would enumerate providers on a public page, which §7.4
    forbids outright. Since the threshold is stated per cycle, the cycle-scoped counter is the one
    required, and it needs a new per-(cycle, provider) sentinel entity because none exists. Check
    whether the hosted Envio indexer has already shipped PRD-722 before starting; merge is not deploy.
    **`/gardens/:id` became a page before the commitments section lands, as its own change.** The
    route had been rendering a Radix modal since it was switched inside an unrelated homepage-polish
    commit — never an IA decision, and `DESIGN.browser.md` had described a page the whole time, as
    did the W15 prototype frame. Inserting a fourth section into that modal would have pushed a
    hand-indexed close ladder past its never-used `:nth-last-child(n+7)` tier, deepened a nested
    scroll container holding an editorial long-read, and left the reader with no footer. Two defects
    were fixed rather than inherited: field-note photos, carried on `PublicFieldNote.media` and
    discarded by every render, now lead the section; and a failed EAS read, previously swallowed to
    an empty list and published as `0`, now reports through `partialData` / `unavailableSources` and
    renders an em dash. Every section always renders, which is what gives the commitments section a
    defined pre-launch home at `§ 02` and keeps the ordinals stable between gardens. Not in scope
    and recorded as follow-ups: per-route meta (`react-helmet-async` is wired but only Login uses
    it, so every shared garden link previews as the generic site card), the Operator → Steward
    rename (PRD-746–751; 71 catalogue keys still say Operator), and chain-aware easscan links.

162. The garden's commitments section is a record, not a cycle report (2026-08-20, Afo). §7.1 had
    scoped the section to the active cycle, which §4.1's own Editorial column already contradicted
    — it keeps aggregates through Paused ("aggregates stay"), Closed ("aggregate story remains")
    and Composted ("past-cycles aggregate"). Cycle scoping also had no answer for two states the
    model permits: a garden between cycles, and §4.2's legal combination of one open Season with
    zero or more open Campaigns competing for a single slot. The section now publishes the
    garden's record across seasons and campaigns — lifetime made and kept with the one sanctioned
    rate, the live cycle as the current chapter when there is one, and finished seasons and
    campaigns as rows beneath. A funder reads what a garden has kept over years rather than where
    it happens to be this month, and the quiet stretches stop being holes.
    **This downgrades an indexer prerequisite.** Decision #161 required a cycle-scoped
    distinct-provider counter and priced it at a new per-(cycle, provider) sentinel entity, because
    the threshold read per-cycle. With the published rate at pool lifetime, the gate reads lifetime
    providers and the counter is the one #161 had already costed as nearly free: a
    `distinctProviderCount` on `CommitmentPool`, incremented on first sight of a
    `CommitmentProviderExposure` key, publishing a number and never a list. Per-cycle rows stay
    counts-only, which §7.1 already required, so this surface never needs a per-cycle rate.
    **Three gaps found in the same review and recorded rather than carried.** No public pooling
    reader exists, and `getCommitmentPoolDetail` selects provider addresses, so reusing it would
    breach §7.4 on a signed-out page. The `/impact` band's CCIP-confirmed G$ tile has no selector
    that returns an acknowledged-only total. And the five-node pipeline shares `EVIDENCE_KIND_LABELS`
    with the `§ 03` evidence ledger, so adding stages naively would put commitment records — which
    name people — into a public ledger; the pipeline's node kinds and the ledger's record kinds get
    split instead. Not in scope and still owed: the promise→commitment sweep across `uiux-spec`
    §4–§6 and `prototypes.md` (223 occurrences, entangled with `promiseKeptRate` and `promiseSlide`
    identifiers that must not be renamed).

**Final recursive certification clarification (2026-07-25; no new decision-register entry):**
the published `42161`↔`42220` production lane is the only required fully paired
`SettlementConfiguration`. Arbitrum Sepolia `421614` and Celo Sepolia `11142220` remain
independent, paused component rehearsals *(dated context — the 2026-08-06/2026-08-10 decisions
withdrew the `421614` network records and dropped the Celo Sepolia Safe/Zodiac rehearsal)*: their contract blocks and local configuration facts are
preserved, but `remoteEvmChainId` remains null, `peerConfigured` remains false, and handlers emit
no cross-chain relationship without a freshly published exact CCIP lane/router. The ephemeral
Arbitrum Sepolia↔Ethereum Sepolia endpoint proof remains runtime-only. This corrects the
pair-required wording in historical register entries 55–56 without rewriting their dated record
and creates no new product or architecture decision.

## Research / Plan Gate

- [x] Research evidence recorded: `reports/corrections-log.md` (every Document A repo claim verified, corrected, or superseded, with file paths)
- [x] Existing repo patterns identified: CookieJar.sol module template, badge-schemas standalone registration, greenWill/hypercerts handler patterns, SubmitWork analog capture, WalletDrawer pools tab
- [x] Human judgment points surfaced and decided: 27 alignment decisions (2026-07-03), approved Linear change set (2026-07-04), all 22 readiness findings scope-locked (2026-07-10), and the final four August UI placements locked by register #51 (2026-07-23)
- [x] Out of scope defined: no bridged G$, bridge custody/unbounded value authority, Sarafu integration, transferable-voucher **implementation/activation**, indexed Celo/G$ transfers, garden-to-garden federation implementation, leaderboards, or public credit scores; no commitment EAS schema; no claim flow in the community interface v1. The future compatibility architecture is specified now so the base implementation does not close the later path.
- [x] Lightest honest validation chosen per lane (see Validation)
- [x] Design coverage audit completed 2026-07-10 (23 assets / 20 Mermaid blocks at that date); superseded by the 2026-07-25 architecture coherency pass — the inventory is now 29 assets rendering 32 Architecture Mermaid blocks, tracked in `diagrams.md` and `wireframes.md`, and every block must parse before implementation handoff.
- [x] Settlement scoping landed 2026-07-04: `settlement-spec.md` (SettlementModule, Safe topology, gardener receipt, multi-chain tiers, failure states) + diagrams D18–D23 + [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686)
- [x] Settlement transport re-frozen and corrected through 2026-07-24: commitment-bound
  message-only CCIP command; exact command/ack tuples and fee-aware failure codes; idempotent
  same-key command retries; independent acknowledgment retry; one immutable router per
  implementation with bounded peer grace and a drained upgrade cutover; bounded non-owner Celo
  executor; immutable batches with hard ceiling 24 and a measured configured limit; exact
  deterministic 2-of-3 Safe recipe; one Roles modifier with native allowance; exact-net G$
  semantics; published mainnet-route verification plus the exact testnet-pair limitation; and
  gardener delivery blocked unless AA proof passes.

## Requirements Coverage

The **Lane** column below names execution sub-lanes for planning clarity. The harness-facing machine lanes in `status.json` are only `contracts`, `state_api`, `ui`, `qa_pass_1`, and `qa_pass_2`.

| Requirement | Lane | Linear issue | Status |
|---|---|---|---|
| Final pre-code full-pool compatibility freeze: three identities, versioned adapter/router, fulfilled-first backing, one-pool proof gate, and G$/redemption separation | `contracts` + `docs` | [PRD-796](https://linear.app/greenpill-dev-guild/issue/PRD-796) | 🚧 In Review · blocks PRD-721 without changing initial ABI/storage |
| Assessment v3 schema via existing AssessmentResolver upgrade + NET-NEW community testimony resolver (first PR chain) | `contracts` | [PRD-721](https://linear.app/greenpill-dev-guild/issue/PRD-721) (historical PRD-671) | ⏳ |
| CommitmentPoolingModule + CommitmentRegistry + GardenToken wiring + deploy | `contracts` | [PRD-721](https://linear.app/greenpill-dev-guild/issue/PRD-721) (historical PRD-672) | ⏳ |
| Module-native `CommitmentSeries`, validated instance reference, direct-holder lifecycle, and honest Offer-capacity reservation | `contracts` | [PRD-788](https://linear.app/greenpill-dev-guild/issue/PRD-788) + [PRD-721](https://linear.app/greenpill-dev-guild/issue/PRD-721) | 🚧 architecture convergence |
| Atomic bilateral Offer×Offer acceptance through `acceptExchange` with two ordinary acceptances, two already-reserved classes/slots, no second registry commit, and one marker event | `contracts` | [PRD-721](https://linear.app/greenpill-dev-guild/issue/PRD-721) + [PRD-649](https://linear.app/greenpill-dev-guild/issue/PRD-649) | ⏳ |
| Indexer entities, handlers, four locked stats, bundleKind | `indexer` | [PRD-722](https://linear.app/greenpill-dev-guild/issue/PRD-722) (historical PRD-673) | ✅ source complete; hosted deployment/read-back remains human-owned |
| Series entities, per-cycle summaries, cursor-ordered Story counts, and nullable Commitment relationship | `indexer` | [PRD-788](https://linear.app/greenpill-dev-guild/issue/PRD-788) + [PRD-722](https://linear.app/greenpill-dev-guild/issue/PRD-722) | ✅ source complete |
| Shared substrate: types, hooks, queryKeys.pools, six offline queue kinds including `commitmentSeries`, signed saved-Offer persistence, typed Kernel `0.2.4` testnet/`0.3.1` production account profiles and Sepolia Pimlico endpoints, AA-gated online wallet transfer, lightweight evidence, v3 workflow, settlement selectors | `state_api` | [PRD-723](https://linear.app/greenpill-dev-guild/issue/PRD-723) (historical PRD-674/679 shared half) | ✅ source complete; capability ledger remains fail-closed pending hosted read-back |
| Client PWA: Garden tab pool flows, WalletDrawer panel, hero moments | `ui_client` | [PRD-724](https://linear.app/greenpill-dev-guild/issue/PRD-724) (historical PRD-675) | ⏳ |
| Client PWA: exchange-pair picker/detail/feed/confirmation states, Offer-first template picker, and plain-language first-exposure copy (`uiux-spec.md` Appendix E; W28–W31) | `ui_client` | [PRD-724](https://linear.app/greenpill-dev-guild/issue/PRD-724) + [PRD-650](https://linear.app/greenpill-dev-guild/issue/PRD-650) | ⏳ |
| Canonical Offer once/over-time prototype and visual-gallery pass: saved Offer metadata, finite availability, claim, Story, ask-again, rest/resume/retire, later-succession preview | `ui_client` + `ui_admin` + `editorial` | [PRD-789](https://linear.app/greenpill-dev-guild/issue/PRD-789) (Claude Code) | ✅ corrected, verified, and published 2026-08-02 |
| Admin: Garden workspace pool console (cycles, seeding, claims, analog capture, assessment v3) | `ui_admin` | [PRD-725](https://linear.app/greenpill-dev-guild/issue/PRD-725) (historical PRD-676) | ⏳ |
| Admin: Community workspace Pools mode + Hub confirmation queue | `ui_admin` | [PRD-725](https://linear.app/greenpill-dev-guild/issue/PRD-725) (historical PRD-677) | ⏳ |
| Editorial: GardenDialog pool story + /impact aggregates | `editorial` | [PRD-726](https://linear.app/greenpill-dev-guild/issue/PRD-726) (historical PRD-678) | ⏳ |
| Hypercert cut-over: fulfilled-commitment bundling + allocation presets (split ownership: shared metadata composer + selectors = `state_api`; `bundleKind`/`commitmentIds`/`needUIDs` entity fields = `indexer`; allocation step UI = `ui_admin`) | `state_api` + `indexer` + `ui_admin` | [PRD-722](https://linear.app/greenpill-dev-guild/issue/PRD-722), [PRD-723](https://linear.app/greenpill-dev-guild/issue/PRD-723), [PRD-725](https://linear.app/greenpill-dev-guild/issue/PRD-725) (historical PRD-679 split) | 🚧 backend complete; admin UI pending |
| G$ split-state settlement: SettlementModule + Celo Safes + multi-chain app | `settlement` | [PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686) | ⏳ |
| Exact same-address GardenAccount deployment, dedicated Garden-bound relay, and direct final 2-of-3 Celo Garden Safes | `contracts` + `release_ops` | [PRD-821](https://linear.app/greenpill-dev-guild/issue/PRD-821/give-each-celo-garden-safe-its-exact-arbitrum-gardenaccount-owner) | 🚧 active plan; exact bytecode/dependency and PRD-733 recovery-owner gates open |
| Post-QA documentation polish: glossary, architecture, data boundaries, rollout language, operator/gardener task guides, screenshots, and recovery states | `docs` | [PRD-727](https://linear.app/greenpill-dev-guild/issue/PRD-727) (historical PRD-680/681 scope consolidated after QA Pass 1) | ⏳ |
| Design-only PRD-651 exchange architecture brief and later evidence/partner-gate reconciliation | `docs` | [PRD-651](https://linear.app/greenpill-dev-guild/issue/PRD-651) | design exists · implementation gated |
| Additive full-pool Story images and six-tab Google Doc reconciliation after PRD-796 review | `docs` | [PRD-796](https://linear.app/greenpill-dev-guild/issue/PRD-796) + [PRD-727](https://linear.app/greenpill-dev-guild/issue/PRD-727) | ✅ Google Doc prose accepted + re-read 2026-08-04 · gallery republication and image placement remain manual |
| Final client PWA, admin, and editorial walkthrough videos with captions/transcripts and source-SHA provenance | `walkthrough_videos` | [PRD-728](https://linear.app/greenpill-dev-guild/issue/PRD-728) (repurposed from the pre-QA docs-guides lane after QA Pass 2) | ⏳ |
| External brief, audience notes, GTM/community rollout, and factual review | `docs` + `july_dry_run` | [RESR-57](https://linear.app/greenpill-dev-guild/issue/RESR-57), [RESR-58](https://linear.app/greenpill-dev-guild/issue/RESR-58), [COM-3](https://linear.app/greenpill-dev-guild/issue/COM-3) | ⏳ |
| July: methodology/metrics pulse (proto-commitment #1; RESR-53 canceled 2026-07-06, folded into the unified instrument) | `july_dry_run` | [COM-7](https://linear.app/greenpill-dev-guild/issue/COM-7) (historical label: RESR-62) | ⏳ |
| July: commitment-scoping surveys + mandate artifacts (gates August seeding) | `july_dry_run` | [COM-7](https://linear.app/greenpill-dev-guild/issue/COM-7) (historical label: RESR-62) | ⏳ |
| July: activations + proto-commitment loops (TAS) | `july_dry_run` | [COM-7](https://linear.app/greenpill-dev-guild/issue/COM-7) (historical labels: RESR-62; canceled RESR-63) | ⏳ |
| July: pilot cohort readiness | `july_dry_run` | [COM-7](https://linear.app/greenpill-dev-guild/issue/COM-7) + [COM-3](https://linear.app/greenpill-dev-guild/issue/COM-3) (historical labels: RESR-62, PRD-701; canceled RESR-13) | ⏳ |
| September: independent packages/community PWA after shared-foundation extraction | `community` | [PRD-682](https://linear.app/greenpill-dev-guild/issue/PRD-682) | ⏳ |
| September: Need intake into the commitment-seeding gate | `ui_admin` | [PRD-691](https://linear.app/greenpill-dev-guild/issue/PRD-691) + Community admin handoff (historical label: canceled PRD-683) | ⏳ |
| September: settlement-capacity evidence definition and signed pilot packet | `settlement_evidence` | [COM-11](https://linear.app/greenpill-dev-guild/issue/COM-11) (historical label: PRD-735) | 🚧 operational-assignment-gated |
| August companion: borrow-and-repay `CreditRegistry` + credit indexer/shared/admin/PWA surfaces | `credit_follow_on` | PRD-697 (Todo; unblocked into the August wave by register #73) | 🚧 dispatch-gated on in-code interface freeze, spec revalidation, and human legal/operations review |

Spine records (not work items): [PRD-649](https://linear.app/greenpill-dev-guild/issue/PRD-649) architecture record (reopened for one additive exchange function and re-closed by register #75), [PRD-650](https://linear.app/greenpill-dev-guild/issue/PRD-650) proof capability (parent of the August workstreams), [PRD-796](https://linear.app/greenpill-dev-guild/issue/PRD-796) final pre-code full-pool compatibility review, [PRD-651](https://linear.app/greenpill-dev-guild/issue/PRD-651) design-only exchange, redemption, and federation architecture at `exchange-architecture-brief.md` with implementation and `settlementAdapter`/`settlementEnabled` activation still gated, [RESR-57](https://linear.app/greenpill-dev-guild/issue/RESR-57)/[RESR-58](https://linear.app/greenpill-dev-guild/issue/RESR-58) research framing. Linked research: RESR-15, RESR-4, PRD-275.

## Tracks and sequencing (live Linear cadence)

Scope and Design closes on 2026-07-22, and the implementation window closes with the Build phase on 2026-07-31. ⚠️ **The 2026-07-31 Build close is known drift as of register #70 (2026-07-30)**: the register #62 dependency chain — PRD-762, then PRD-757/759, then the PRD-649 freeze, then PRD-721 → PRD-722 → PRD-723 — cannot complete by that date, and contracts, indexer, and state/API are all still unstarted. Linear owns the phase dates, so Afo re-dates there first and this hub follows; the dates below are reproduced as-is until then and grant no authority either way. Research alignment runs through 2026-07-30; the July dry-run operational checkpoint is 2026-07-31. The non-value pooling/register/schema tier may broadcast during Build only after its artifact-specific evidence and human authorization are recorded. Release follows on 2026-08-12 for the user-facing rollout and separately gated value tier. On 2026-09-30, the Follow On / Hardening native phase and the Community plus settlement-evidence operational checkpoint close in parallel as distinct evidence decisions.

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

1. [x] **Envio foundation first:** correct and merge GitHub PR #649; prove Envio `3.2.1` generation, build, tests, migration/replay, block preservation, and root Bun-first workflow without package-local skill copies or unrelated shared changes. *(Landed on `develop` as `8fd89e660`, 2026-07-28; `packages/indexer` pins `envio: 3.2.1`. The wider `envio-hyperindex-v3-migration` hub remains `in_progress` for its own later lanes, but this gate is satisfied.)*
2. [x] **Close the Steward and app-profile prerequisites:** complete PRD-747 HatsModule Steward upgrade and PRD-748 live-hat relabel branch review/merge hygiene, then complete PRD-762's signed app-avatar API path (agent persistence and public read/mutation routes, shared hooks, and client Profile controls) before backend dispatch. PRD-762 requires no Commitment Pooling contract change, indexer work, or deployment broadcast. PRD-749's visible en/es/pt terminology sweep must be complete before product UI implementation. *(PRD-747/748 are merged to `develop`; PRD-762 is Done in live Linear and no longer blocks PRD-721. PRD-749 remains a later product-UI gate, not a PRD-721 backend prerequisite.)*
3. [x] **Close the architecture decisions:** complete PRD-757 contributor-share review and PRD-759 protocol-pool funding review. Both must close before PRD-649. *(Both are cleared in live Linear; merged PR #669 preserves PRD-759's provider-garden payout-plan architecture and authority-gated discretionary funding exception.)*
4. [x] **Freeze the implementation architecture and Offer vocabulary:** reconcile registers
   #81–#85 across
   `standing-commitments-spec.md`, contracts/events, indexer entities, shared state/API, acceptance,
   ontology, handoffs, the canonical Google Doc, and live Linear. *(Closed 2026-08-02 as
   [PRD-788](https://linear.app/greenpill-dev-guild/issue/PRD-788): both edited Google Doc tabs
   survived reload; all-tab stale-term searches were zero; Linear and repo sources were re-read;
   plan, ontology, JSON, and diff guards passed.)* Claude Code completed the corrected canonical
   prototype and gallery through
   [PRD-789](https://linear.app/greenpill-dev-guild/issue/PRD-789) without redefining the frozen
   model; Codex independently approved the published artifacts on 2026-08-02. PRD-721 remains Todo
   and manually undispatched until the corrected sources merge to `develop` and Afo explicitly
   starts contract implementation.
5. [x] **Build the contracts backend first (PRD-721):** execute the three contract PR chains against the frozen PRD-649 architecture. No client, admin, or editorial implementation begins in this stage. *(Merged through PR #705.)*
6. [x] **Build the indexer backend second (PRD-722):** implement and prove the indexed read model against PRD-721's frozen events, including generation, replay/cutover, block preservation, and query-boundary evidence. *(Merged through PR #706; the 2026-08-16 pre-deploy gap-closure pass corrected the read model before its first hosted pooling sync. Manual Envio deployment and live read-back remain human-owned.)*
7. [x] **Build the state/API backend third (PRD-723):** complete the shared state/API layer against the proven PRD-721 contracts and PRD-722 generated queries. *(Source implementation and local proof completed 2026-08-16. Runtime availability remains fail-closed until the human-owned hosted Envio deployment/full-sync/read-back; production Saved Offers require root-environment configuration.)*
8. [ ] **Human-authorized core activation:** pass local/fork, storage, deploy-dry-run, and post-deploy
   gates plus the risk tier in register #109. The non-value module/register/schema tier may activate
   as tier 2 only while it remains non-custodial and non-transferable, every value dependency is
   paused or disabled, temporary ownership and rollback authority are explicitly accepted and
   verified, emergency pause remains available, the selected review has no unresolved
   Critical/High finding, and rollback is tested. PRD-722 separately owns the resulting indexer
   address/start-block change, hosted deployment/reindex, cutover/rollback, and live entity/query
   read-back. Protocol authority and value-bearing settlement remain tier 3 and retain their
   Safe, CCIP/AA, canary, and applicable audit/timelock/soak gates.
9. [ ] **Existing admin foundation:** resolve PRD-737 and the explicitly scoped admin-console/output defects against verified live backend data. Do not turn this into a redesign or absorb new Commitment Pooling feature implementation.
10. [ ] **Complete prototype readiness:** PRD-789 is closed after correction, independent review,
    publication, and canonical-URL verification. Close the remaining PRD-760 fixture/chrome
    defects, then revalidate both artifact surfaces against the proven ABI/generated queries before
    client, admin, or editorial implementation begins.
11. [ ] **Implement runtime interfaces:** build PRD-724 client PWA, PRD-725 admin, and PRD-726 editorial surfaces only after PRD-723 and PRD-760 close, using the frozen ABI, generated queries, and verified deployment output.
12. [ ] **Develop/staging integration:** merge completed lanes in dependency order onto `develop`, verify the exact staging deployment URLs and source SHA, run targeted lane proof plus the Repo Quick Gate, and begin broad QA only from the verified staging build.
13. [ ] **QA Pass 1 / deep QA (PRD-729):** run full human-flow, authenticated Brave, real-device PWA, offline/recovery, contract-indexer consistency, accessibility, locale, permissions, and regression review. Route defects back to their owning lanes and re-merge fixes to `develop`.
14. [ ] **Post-QA documentation polish (PRD-727):** after QA Pass 1, reconcile architecture/glossary/reference prose, operator and gardener task guides, screenshots, accessible names, recovery instructions, translations, and every planned/live claim against the QA-tested product.
15. [ ] **QA Pass 2 / release certification (PRD-730):** retest every QA1 correction and the polished documentation, run boundary checks and the full Ship Gate, and freeze the verified `develop` snapshot only when staging is green and no unaccepted release blocker remains.
16. [ ] **Walkthrough-video completion (PRD-728):** after QA Pass 2, record, edit, caption, transcribe, privacy-review, and replay the approved client PWA, admin, editorial, gardener, Garden Steward, evaluator, and operational walkthroughs against the final source SHA.
17. [ ] **Cycle 1 and separately authorized value operations:** open Cycle 1 from the approved mandate artifacts only when its readiness gate passes. Settlement broadcast/canary/exit proof remains human-owned and independently authorized; one Fulfilled commitment may read Confirmed only after the authenticated acknowledgment. The `CreditRegistry` remains an August-wave companion, but its contracts lane cannot dispatch until the in-code pooling/settlement interface freeze, spec revalidation, and human legal/operations review gates all clear.

PRD-758 is a parallel Community Needs & Signals architecture gate. It blocks PRD-682 only and is
not part of the Commitment Pooling backend critical path.

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

### Contracts (`feature/commitment-pooling-contracts`): PRD-721 (historical labels PRD-671/672)

- [ ] Implement register #103's full pool-pause freeze and paused `registerPool` path, as amended
  by register #104's accepted root-registration residual, without
  gating evidence/linkage, roster wind-down, cancellation/expiry/dispute recovery, or the
  non-blocking Work-decision hook
- [ ] Contract logic and tests per `contract-spec.md`; bun wrappers only, never raw forge
- [ ] Implement `CommitmentSeries` exactly per `standing-commitments-spec.md`: storage, errors,
  events, direct-holder Active/Resting/Retired lifecycle, validated Offer-only instance reference,
  and no initial succession mutation
- [ ] Correct register coupling so Offer creation reserves capacity, Offer acceptance/exchange do
  not recommit, Request acceptance reserves once, and direction/state-specific terminal paths
  release exactly once
- [ ] Implement and prove `acceptExchange` exactly per `contract-spec.md` amendment 2026-08-01
  as amended 2026-08-02: Offer×Offer only, A-creator caller, creator consent for both claim modes,
  atomic two-side predicates/events, already-reserved classes/slots, and no post-acceptance coupling
- [ ] Respect deployment ordering, fail-closed pre-change storage baselines, and upgrade safety
  (GardenToken slot 213 offset 2; gap remains 37)
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [x] Write `handoffs/codex-contracts.md`
- [ ] Planning readiness: the independently audited specification, source-document convergence,
  Offer-vocabulary correction, and artifact publication gates are complete. Keep the lane blocked
  until the corrected sources merge to `develop` and Afo explicitly dispatches PRD-721.

### Settlement (`codex/settlement/commitment-pooling`): PRD-686

- [x] Track the current-release member-funded increment in
  [PRD-814](https://linear.app/greenpill-dev-guild/issue/PRD-814), parented to the live
  [PRD-650](https://linear.app/greenpill-dev-guild/issue/PRD-650) roadmap and related to the
  in-progress pool-freeze issue
  [PRD-813](https://linear.app/greenpill-dev-guild/issue/PRD-813)
- [ ] Implement register #103's member-funded claim records, steward-confirmed deposits,
  acceptance consumption, one persistent refund child, failed-refund requeue, and ordinal-safe
  `DisbursementKind.Refund` through the existing command/acknowledgment rail, as amended by
  register #104's `FundingWithdrawn` event, sixth local closure pointer, and measured source-ack
  gas proof
- [ ] `SettlementModule` + tests per `settlement-spec.md` §3; zero changes to the pooling module or register; bun wrappers only
- [ ] Build Arbitrum `SettlementModule` + Celo `CeloSettlementExecutor` against the exact command/ack tuples; reuse the existing `@chainlink/contracts-ccip` dependency and ENS sender/receiver authentication patterns
- [ ] Prove immutable batch membership, disabled/configured/hard-ceiling batch bounds, per-member failed-attempt recovery, idempotent same-key command retry, independent acknowledgment retry, one immutable router per implementation, bounded peer grace, paused/drained router cutover, zero CCIP token amounts, native-fee reserve monitoring, bounded Safe execution/failure codes, exact indexer entities/events, and AA-gated PWA member delivery
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [x] Write `handoffs/codex-settlement.md`
- [ ] Planning readiness: command/ack ABI, transport, idempotency, authority, event, exact-net
  fee, indexer, and dual-chain evidence gates passed the local independent correction review.
  Live Linear/source-document convergence remains required before implementation dispatch.

### Indexer (`feature/commitment-pooling-indexer`): PRD-722 (historical label PRD-673)

- [x] Entities, handlers, stats per the spec's fenced definitions; Envio regeneration preserves all new blocks; the existing normalized bare-address `Garden.id` and its foreign keys remain unchanged while new pooling entities use their own chain-scoped composite IDs; generic audit actor stays nullable unless explicit; `bun codegen` clean
- [x] Add `CommitmentSeries` and `CommitmentSeriesCycleSummary`, nullable Commitment relationships,
  independent latest-wins pool/cycle/series/commitment lifecycle cursors, an independent latest-wins
  `ConfirmerRuleSet` block/log cursor, exact fulfilled-cycle IDs, and reverse-delivery replay
  fixtures; derive no score, rate, rank, participant count, or cross-pool grouping
- [x] Implement all 28 consumer-contract entities and their independent replay policies, plus the handler-internal per-cycle commitment index: pool charter/cap,
  reward, acceptance, claim row, contributor membership/assignment, Work link, deterministic
  relationship arrays, and signed commutative register deltas. Add reverse-delivery fixtures for
  every Matrix A row and all eight Matrix A3 sparse-event cases. Use `registrationSeen`,
  `seedSeen`, both `creationSeen` flags, `requestSeen`, `additionSeen`, and `linkSeen` with nullable
  base-only facts and independent nullable series cursors. Include ClaimDeclined-before-
  ClaimRequested, proving the older request fills payload without reviving Pending.
- [x] Record RED/GREEN proof (scripted event-sequence test) before marking complete
- [x] Write `handoffs/codex-indexer.md`
- [x] Dispatch core indexing when pooling events freeze; hold only settlement handlers for settlement event freeze. Record snapshot, switch criterion, rollback package, and Afolabi Aiyeloja as accountable live-cutover owner. *(Source implementation is complete; manual hosted deployment, fresh sync, and live read-back remain with the accountable human owner.)*
- [x] Rehearsal target settled 2026-08-06: Arbitrum One fork, not `421614`. Hats has no Arbitrum
      Sepolia deployment; `test/fork/ArbitrumCommitmentPooling.t.sol` runs the full runbook against
      live Hats/EAS/WorkApprovalResolver and passes 7/7.
- [x] Planning readiness: self-describing unit events, `421614` placement (since withdrawn 2026-08-06 — Arbitrum One fork rehearsal), canonical settlement
  ERD, the Envio `3.2.1` multichain/replay behavior proven by merged PR #649 (`8fd89e660` on
  `develop`), first-event seeds, and Celo RPC mode are frozen locally;
  mirror convergence and event freeze were satisfied for source implementation. Hosted Envio activation remains a separate manual release step.

### State / API (`feature/commitment-pooling-api-modules`): PRD-723 (historical labels PRD-674/679 shared half)

- [x] Hooks, stores, query keys, six offline queue kinds (`commitmentSeries`, `commitment`, `claim`, `evidence`, `workLink`, `confirmation`) plus an online-only wallet `transfer` capability that remains disabled unless the AA gate passes; hooks stay in shared
- [x] Add signed offchain saved-Offer persistence, private-by-default use/linking, stable
  `clientSeriesId` dependency materialization, series mutations/selectors, and truthful Story/
  availability derivations. Implement `LOCAL_DRAFT`, `SAVING_REMOTE`, `SAVED_REMOTE`,
  `SAVE_FAILED`, `OFFLINE_LOCAL`, and `VERSION_CONFLICT`; only confirmed remote persistence may
  claim Saved.
- [x] Add `clientCommitmentId` + creator-scoped creation-key recovery for every ordinary
  Commitment/place and caller-scoped operation-key recovery for Work links. Same-button retry
  reuses the same key and validates the complete immutable payload before binding.
- [x] Add typed exchange-pair state, `CommitmentExchange` queries, `acceptExchange` mutation,
  proposed/matched/counterpart-lapsed derivation, and template/config types without adding an
  offline job kind or a new persistence system
- [x] Add explicit `421614`/`11142220` Pimlico endpoints and a typed account-profile registry:
      Kernel `0.2.4` on both testnets for same-address mechanics evidence, Kernel `0.3.1` on
      Arbitrum One/Celo Mainnet for production, fail-closed profile selection, and focused
      `settlement-aa-profile.test.ts` proof that testnet evidence cannot enable gardener delivery
- [x] Dispatch core state/API after pooling interfaces and core indexer codegen/build; settlement selectors followed only after the settlement interfaces and indexer lane were GREEN
- [x] Record RED/GREEN proof before marking complete; branch-base absence and the 2026-08-16 focused validation receipt are recorded in `status.json` and `handoffs/codex-state-api.md`
- [x] Write `handoffs/codex-state-api.md` and the first-deliverable entity/query contract in `handoffs/commitment-pooling-query-contract.md`

### Credit (`codex/credit/commitment-pooling`): UNBLOCKED into the August wave (register #73; PRD-697 moved to Todo with the dispatch gates recorded, 2026-08-01)

- [x] Explicit unblock recorded (2026-08-01, Afo — register #73); hub promoted to `../commitment-credit-follow-on/`
- [ ] Dispatch gate: pooling + settlement interfaces frozen **in code** (chains 2/2.5 merged), then revalidate every path `../commitment-credit-follow-on/spec.md` cites against the implemented interfaces
- [ ] Dispatch gate: legal/operations review of the interest-free, records-only lending posture (human-owned; start immediately, runs in parallel with the pooling build)
- [ ] Settlement seam locked: **(a)** `DisbursementKind.LoanPrincipal` (settlement-spec 2026-08-01 amendment); coordinate with the settlement lane before the credit G$ leg dispatches
- [ ] Then: `CreditRegistry` + indexer + shared `queryKeys.credit.*` + `credit` job kind + admin/PWA credit surfaces (spec §8 order)
- [ ] Write `../commitment-credit-follow-on/handoffs/codex-contracts.md`

### UI Client (`feature/commitment-pooling-client-ui`): PRD-724 (historical label PRD-675)

- [ ] Client tasks only; i18n en/es/pt for every new string; hero moments per spec
- [ ] Implement `uiux-spec.md` Appendix F only after the backend contract/query gates and remaining
  PRD-760 prototype-readiness gate close. PRD-789 is approved canonical reference for Things I can
  offer, Offer once/Offer over time, garden selection for the ongoing path, finite Add places,
  claim one pre-created instance, Story, ask-again, rest/resume/retire, and persistence explanation
- [ ] W32 exposes saving/failure/offline/conflict truth and SB-38 never labels a no-signal draft
  Saved. W35 retries the exact failed place with its persisted creation key and cannot duplicate
  capacity.
- [ ] Implement `uiux-spec.md` Appendix E.1–E.3 on the existing creation/detail/feed/sheet
  primitives: exchange pair states, Offer-template entry, and plain-language first exposure;
  W28–W31 are drawn in `hifi/screens/exchange.ts` and `sb35`/`sb36` are validated journeys
  (register #97f) — implement from the registry, not the retired lo-fi frames
- [ ] Record RED/GREEN proof or a proof-limit note
- [ ] Write `handoffs/claude-ui-client.md`

### UI Admin (`feature/commitment-pooling-admin-ui`): PRD-725 (historical labels PRD-676/677/679 admin half)

- [ ] Admin tasks only; AdminDialog anatomy (side sheets retired); i18n; Storybook coverage
- [ ] Add viewer-authorized series grouping and Story context without steward mutation of another
  person's holder metadata or lifecycle; keep person-level Story off editorial/public surfaces
- [ ] Gate `closePool` on indexed zero pool live commitments and zero non-terminal cycles; non-zero
  states link to safe commitment/cycle wind-down and expose no close call.
- [ ] Implement `W7@due-live` with the shared permissionless `expireCommitment` mutation. Only
  indexed success routes to `W7@expiry-queue`; failure preserves the live row. Add the
  Offered/Requested-only `W10@edit-declared-value` shared mutation path.
- [ ] Mirror only the steward-facing exchange pair/status/feed, Offer-template, and first-exposure
  copy requirements in `uiux-spec.md` Appendix E; reuse the named primitives and flag gaps in §9
- [ ] Canceled PRD-683 is not part of this executable lane; Community seeding intake is owned by PRD-691 and `.plans/active/community-interface/handoffs/claude-ui-admin.md`
- [ ] Record RED/GREEN proof or a proof-limit note
- [ ] Write `handoffs/claude-ui-admin.md`

### Editorial (`feature/commitment-pooling-editorial`): PRD-726 (historical label PRD-678)

- [ ] Public surfaces only; aggregate-only data; small-community thresholds
- [ ] Ongoing-Offer copy remains pool-level and evidence-labelled; no personal saved Offer
  metadata, series Story, inferred participants, reliability language, or cross-pool identity
- [ ] Write `handoffs/claude-editorial.md`

### Post-QA documentation polish (`docs/commitment-pooling`): PRD-727 (historical labels PRD-680/681)

- [ ] Start only after QA Pass 1; reconcile architecture, glossary, task guides, screenshots,
      accessible names, translations, recovery states, and planned/live claims
- [ ] Reconcile the design-only PRD-651 brief and exchange ladder without presenting voucher,
  quoter, limiter, venue, or `settlementAdapter` activation as implemented
- [ ] Glossary anchors preserved; docs build and vocab lint green
- [ ] Write `handoffs/claude-docs.md`

### Walkthrough videos (`docs/commitment-pooling-walkthrough-videos`): PRD-728

- [ ] Start only after QA Pass 2 and PRD-727 completion
- [ ] Record final client PWA, admin, editorial, gardener, Garden Steward, evaluator, and operations
      walkthroughs with captions/transcripts, privacy review, source SHA, and final path replay
- [ ] Write `handoffs/claude-walkthrough-videos.md`

### QA Pass 1 (`test/commitment-pooling-qa-pass-1`)

- [ ] Review UI behavior and user flows through the authenticated Brave QA profile
- [ ] Verify acceptance criteria against the specs; offline queue proof via mockAuth
- [ ] Confirm required execution sub-lane handoffs exist, including settlement exit-proof evidence or an explicit proof-limit note
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`test/commitment-pooling-qa-pass-2`)

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
- [ ] Ship Gate before release: `bun format && bun lint && bun run test && bun run build` + `bun run lint:vocab` + `bun run agentic:check` + `bun run check:design-md` + `bun run check:design-generated` + `bun run check:design-tokens` + `bun run --filter @green-goods/shared check:stories` and `check:story-quality` where Storybook-covered surfaces changed
- [ ] Full-local dogfood before cycle 1: `bun run dev` + `bun run dev:smoke:full`

## Follow-ups from the 2026-07-18 audit response (Linear MCP was unauthenticated this session — file these when it reconnects)

- [ ] **Post-release source-layout cleanup:** move the shared, internal-pure
  `SettlementMessageCodec` from `packages/contracts/src/libraries/` into the canonical
  `packages/contracts/src/lib/Settlement/` tree. Do this only after the current release freeze:
  the source-unit path participates in compiler metadata and can change the bytecode identities of
  every inlining consumer, so the move requires a fresh full build, CREATE2 manifest, and release
  review rather than being folded into this re-freeze as cosmetic churn.

1. **App-wide Operator → Steward rename**: community glossary (`docs/docs/reference/glossary-community.md`), docs site, i18n keys ×3 locales, admin/client UI copy, vocab-lint update. CP specs/visuals already use steward (mapping note: steward = operator/owner Hats).
2. **PRD-727 docs-promotion appendix refresh** (historical PRD-680): diagrams.md §Appendix already lists the ship-time docs edits; re-check after the audit-response restructure (D10 acts, D4 matrix, CommitmentRequirement entity).
3. ~~**Linear re-apply pass**~~ — ✅ **DONE 2026-07-19.** The corrected wording was applied live to PRD-686, the project description, RESR-57, RESR-58 and the Pool Identity companion; the archived packs keep their original text as provenance (they are frozen records of what was applied on 2026-07-11, not current guidance). **Closed out 2026-07-22 (live re-read):** the canonical synthesis's two sentence-edits (see #9) are moot — Linear Doc 2 is archived and the corrected model is verified in the Google Doc. The G$-on-Arbitrum correction to PRD-649 + the Lifecycle companion (`reports/corrections-log.md` §9e) was verified **already clean** in live Linear: neither PRD-649's body nor the [Lifecycle And Aggregator Semantics](https://linear.app/greenpill-dev-guild/document/commitment-pooling-lifecycle-and-aggregator-semantics-bfdd633951d6) doc carries any "G$ on Arbitrum / partner-confirmed" claim (the word "Arbitrum" does not appear in either), and the [Pool Identity + Capability Architecture](https://linear.app/greenpill-dev-guild/document/commitment-pooling-pool-identity-capability-architecture-d6b7e5c22324) companion carries the corrected split-state topology explicitly. No Linear write was needed.
4. **Ops confirmation before the first garden Safe deploys**: the Dev Guild recovery multisig is
   now designated as `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C`, independently of the
   retired working-capital Safe. Live Celo Safe-state/EIP-1271 proof and the HoA stream's
   receiving-address evidence for the GG protocol Safe remain open (milestone M1,
   settlement-spec §8).
5. **Optional hi-fi design pass** (Stitch / Claude Design) over the revised client pool surfaces (W1/W2/W25) once these wireframes settle.
6. **~~Confirm the G$-for-protocol-services return leg with GoodDollar~~ — CLOSED 2026-08-08.** GoodDollar confirmed the arrangement and said they want to see circulation, closing the external half of Decision Log #45; the internal half was already settled. The "awaiting confirmation" label is retired from `settlement-spec.md` §11.10, the conflicts note, the gallery, and partner-facing claim rules. Decision Log #56 goes further and makes the leg a modelled, indexed path: a garden claiming a protocol-pool Offer records itself as `payerGarden`, so its payment is an ordinary commitment-bound `ContributorConsideration` from its own Safe. What still gates partner claims is evidence that circulation happened (`pilot-evidence-spec.md`), not the mandate reading.
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

## Ontology sidecar coverage — closed 2026-08-02

The ontology foundation (PR #661) remains repo canon at
`packages/shared/src/ontology/green-goods-ontology.json`. This pass added the eleven frozen
vocabularies that were previously present only in the commitment and settlement specs:
`ConfirmationPath`, `DisbursementState`, `DisbursementKind` (including the ABI-reserved
`LoanPrincipal` member), `FundingRoute`, `FailureCode`, `ResultStatus`,
`AcknowledgmentDeferralCode`, `SettlementExecutionStatus`, `CommitmentClaimRequestState`,
`CommitmentEventType`, and `CommitmentUnitScope`. Each is `status: "spec"` with a
`planned_anchor`, so the spec-arrival guard fails when its Solidity or GraphQL symbol lands until
the sidecar is converted to live representations.

The commitment state machine also carries Decision #44's structural reachability rule and exact
`Ordinary` / `PoolFallback` / `ProtocolFallback` provenance. The sidecar now contains 42
vocabularies and 26 planned anchors; `diagrams.md` and the gallery remain the manual visual
leg because `check:ontology` intentionally parses neither Markdown nor images.

Two app-only families remain deliberately outside the domain sidecar: the gardener-facing
settlement copy states D23 derives (`support-queued` … `support-cancelled-failed`) and the offline
job runner's operational states (`waiting_for_hat`, `Syncing`, `RetryableFailure`, `Exhausted`,
`Discarded`). The sidecar models the contract/indexer facts from which those interface states
derive; it does not make transient presentation/runtime states protocol vocabulary.

The five read-model arrivals that do not yet have implementations are watched explicitly in
`pattern_watches`: `CommitmentProviderExposure`, exact-label `CommitmentUnitSummary`,
`promiseKeptRate` (`commitmentsFulfilled / commitmentsDue`), `CommitmentSeries`, and
`CommitmentSeriesCycleSummary`. If any symbol appears in
`packages/indexer/schema.graphql`, `check:ontology` requires the same implementation change to add
its canonical entity or metric mapping. These are watched implementation obligations, no longer
silent coverage gaps.

## Boundary

No implementation code starts from this plan without Afo dispatching the specific lane or handoff.
Before PRD-721 may be dispatched, [PRD-796](https://linear.app/greenpill-dev-guild/issue/PRD-796)
must accept the compatibility closure in Decision Log #51–#54/register #86–#89 after confirming
that the contract, series, exchange, evidence, closure-matrix, Mermaid, status, handoff, and Linear
sources agree. This gate changes no initial ABI/storage and adds no voucher work to PRD-721.

The executable order is:

1. review and merge this compatibility freeze;
2. run PRD-721 for the non-transferable base exactly as frozen;
3. implement indexer then shared state/API against the proven ABI and generated queries;
4. run the existing artifact/runtime/release gates for commitment coordination;
5. collect the pilot evidence required by `pilot-evidence-spec.md`;
6. scope a fulfilled-backed voucher/redemption layer only if evidence supports it;
7. prove seed, exchange in/out, redemption, liquidity, and repair in one bounded pool; and
8. consider capacity-backed issuance or federation only through new, separate scope locks.

Mainnet release boundaries follow register #109's risk tiers. Paused/no-authority deployment is
tier 1; non-custodial and non-transferable pooling coordination may activate as tier 2 only while
all value dependencies remain paused or disabled and its explicit ownership, review, emergency-
pause, receipt/post-state, and rollback evidence stays valid. Protocol authority, custody,
transferability, peer wiring, allowances, and value movement are tier 3 and require the Safe plus
applicable audit/timelock/soak gates or an explicit dated human disposition naming substitute
evidence. G$ split-state settlement is Build-phase scope via
[PRD-686](https://linear.app/greenpill-dev-guild/issue/PRD-686) (`settlement-spec.md`, Decision
Log #14), targeting the 2026-08-12 Release. Implementation may begin only from its scoped handoff
after the pooling reward/provider interface freezes; production Safe/Zodiac authority evidence,
native-fee policy, GoodDollar configuration, AA outcome, broadcasts, and canary add
settlement-specific human Release gates. The date waives no gate.

Still out of scope for every current implementation lane: bridged G$ (never), arbitrary
bridge-executor automation, a `packages/agent` settlement relayer/write path, bridge
custody/unbounded value authority, Sarafu integration, transferable-voucher implementation and
`settlementAdapter`/`settlementEnabled` activation (PRD-651), indexing raw Celo/G$ transfers,
garden-to-garden federation implementation, leaderboards, and public credit scores. PRD-651's
canonical design-only brief at `exchange-architecture-brief.md` freezes adaptability but softens
no implementation or activation gate. Optional later agent alerts are read-only and hold no
settlement authority. Borrow-and-repay `CreditRegistry` is an active August-wave companion lane
under the 2026-08-01 scope lock; its contracts lane remains manually blocked until the in-code
pooling/settlement interface freeze, spec revalidation, and human legal/operations review gates
all clear.
