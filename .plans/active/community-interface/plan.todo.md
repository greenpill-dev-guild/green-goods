# Community Needs Interface Plan

**Feature Slug**: `community-interface`
**Stage**: `active`
**Status**: `ACTIVE: all readiness corrections scope-locked 2026-07-10; implementation lanes are blocked only on named interfaces, aggregate proofs, external operations, authorization, or research gates; implementation not started`
**Created**: 2026-07-04
**Last Updated**: 2026-07-29

Linear mirror: project [Community Needs & Signals](https://linear.app/greenpill-dev-guild/project/community-needs-and-signals-083dd7e556c2). Milestones: Needs substrate (2026-08-31), September needs app (2026-09-30), Post-pilot hardening (2026-12-31). The Product Commitment Pooling cycle runs 2026-07-16 through 2026-07-30; Research alignment runs through 2026-07-30. Active September delivery tracker PRD-682 stays in [Commitment Pooling](https://linear.app/greenpill-dev-guild/project/commitment-pooling-4bc53572f354); canceled PRD-683 remains historical traceability only. Artifacts: `spec.md`, `corrections-log.md`, `diagrams.md`, `wireframes.md`, `journeys.md`, `research-plan.md`.

> **Linear consolidation (2026-07-05).** Per-lane workstream issues were closed into two parent **trackers**; **this plan is the lane-level execution truth**. Trackers: **PRD-687** needs substrate (absorbs historical PRD-688 indexer, PRD-689 paymaster, and PRD-690 shared) and **PRD-691** September needs app (absorbs historical PRD-692 funder lens, PRD-693 docs, and PRD-694 QA/dogfood). Kept as-is: parked hardening **PRD-695/696**, scoping record **RESR-64**, and active cross-project delivery tracker **PRD-682**. Canceled **PRD-683** remains historical only. Dispatch reads an active tracker plus this plan and its handoffs, never a closed child issue.
> **Plan-hub sync (2026-07-07).** `status.json` records **PRD-687** as the single `linear.parentIssue` because plan-hub supports one parent mirror in `parent_only` mode. **PRD-691** remains the active September needs app tracker in `consolidatedTrackers` and the table below; no lane-child issues should be recreated without explicit approval.

## Decision Log (locked 2026-07-04 through 2026-07-10, full rationale in spec.md §1)

| # | Decision |
|---|---|
| 1 | Vocabulary is **Need** (never "problem") in code and copy: schemas Need/NeedSignal/NeedStatus, field `needUID`, tab Needs, es Necesidades / pt Necessidades. |
| 2 | Community Needs & Signals is the build home; active delivery tracker PRD-682 stays in Commitment Pooling and canceled PRD-683 is historical only. PRD-687 blocking PRD-691 is the live cross-project execution relation. |
| 3 | Spec home is this hub; the commitment-pooling hub carries only the `needUID` amendment + §8 supersession note (+ decision-register addendum #28). |
| 4 | App IA: Needs / Create (center, voice-first) / Profile; pool story folds into the board header + detail threads; solution-proposal objects dropped. |
| 5 | Fund action: embedded donate + endowment (the /fund paths) in need context; `FundingAttribution` attestation in v1; funded-toward on detail only, never a sort key; no per-need escrow. |
| 6 | Voice: audio always as evidence; dictation + transcription on BOTH statement and outcome; local-first (feasibility spike), server transcribe-on-sync fallback via the agent package; never blocks submission. |
| 7 | Discovery: global read-only browse; my garden is the scoped default; signal rights same-garden only. |
| 8 | No claim flow in v1; the need→operator triage binding is first-class (time-sensitive triage, seed-from-signal). |
| 9 | A Need is a problem paired with a desired outcome; it has no kind. Request / Offer is commitment direction only. Domains are operator-applied, optional, and multi-valued; commitments use the same optional multi-domain shape, with action pairing required only for DomainImpact. |
| 10 | Join-request persistence is an explicit open decision. The member experience is designed, but PRD-691's membership-queue slice waits for privacy, retention, offline/recovery, deletion, and operator-handoff evidence. |
| 11 | `packages/community` is an independent PWA at `community.greengoods.app` / local 3010; a prerequisite shared-foundation lane extracts generic runtime/auth/offline/install/update/error/shell primitives for both client and Community without sharing routes, manifests, service-worker scope, telemetry identity, or copy. |
| 12 | PRD-758 is the Community Needs architecture gate for PRD-682. It must close before PRD-682 implementation, but it does not block PRD-721/722/723 or the core Commitment Pooling backend. |
| 12 | Need moderation and progress are separate axes; declined is author/operator-only, hidden is operator-only, merge redirects, acknowledgement with rationale reopens, and author retraction leaves a content-free lineage tombstone. |

Sub-decisions: Need/NeedSignal revocable (self-retraction/un-signal only); NeedStatus moderation 1 acknowledged / 2 merged / 3 hidden / 4 declined; progress open/committed/in-progress/addressed derives separately; `need`, `needSignal`, and `testimony` may wait in `waiting_for_hat`; NeedStatus/FundingAttribution stay online; FundingAttribution displays once per verified `(needUID, chainId, txHash, rail)`; Envio never indexes EAS.

## Research / Plan Gate

- [x] Research evidence recorded: `corrections-log.md` (every research-pass repo claim verified, corrected, or superseded, with file paths)
- [x] Existing repo patterns identified: IGardenAccessControl resolver gating, badge-schemas standalone registration, AudioRecorder/useAudioRecording + audioNotes IPFS path, agent transcription service, job-queue kind extension points, two-indexer read path
- [x] Human judgment points surfaced and decided: 12 locked decisions; join-request storage intentionally remains open with options and exit criteria rather than an assumed backend
- [x] Out of scope defined: claim flow, leaderboards/funding-ranked boards, per-need escrow, push notifications, settlement, eligibility module (parked), ActionSignalPool wiring
- [x] Lightest honest validation chosen per lane (see Validation)
- [x] UX/research artifacts landed: ERDs + sequences, low-fi screens, six personas, six role journeys, customer/community journey map, operator service blueprint, consent/readiness protocol, and Linear-aligned onboarding schedule

## Requirements Coverage

| Requirement | Lane | Active tracker | Historical child label | Status |
|---|---|---|---|---|
| Need/NeedSignal/NeedStatus/FundingAttribution schemas + resolvers + registration | `contracts` | [PRD-687](https://linear.app/greenpill-dev-guild/issue/PRD-687) | none (parent tracker) | ⏳ |
| needUID on commitment entities + need-keyed aggregates | `indexer` | [PRD-687](https://linear.app/greenpill-dev-guild/issue/PRD-687) | [PRD-688](https://linear.app/greenpill-dev-guild/issue/PRD-688) | ⏳ |
| Pimlico sponsorship policy for need/signal/testimony writes | `ops_paymaster` | [PRD-687](https://linear.app/greenpill-dev-guild/issue/PRD-687) | [PRD-689](https://linear.app/greenpill-dev-guild/issue/PRD-689) | ⏳ |
| Shared substrate: job kinds, needs hooks + derivation join, voice dictation & transcription | `state_api` | [PRD-687](https://linear.app/greenpill-dev-guild/issue/PRD-687) | [PRD-690](https://linear.app/greenpill-dev-guild/issue/PRD-690) | ⏳ |
| Shared foundations: runtime/auth/passkey/offline/install/update/error/shell extraction and client migration proof | `shared_foundation` | [PRD-682](https://linear.app/greenpill-dev-guild/issue/PRD-682) | none | MANUALLY BLOCKED on authorization, reviewer, and accepted RED characterization targets |
| Admin: need triage, moderation, gathering view; membership queue after persistence decision | `ui_admin` | [PRD-691](https://linear.app/greenpill-dev-guild/issue/PRD-691) | none (parent tracker) | ⏳ / decision gate |
| Funder lens: global needs gallery + donate/endowment embed + FundingAttribution | `funder_lens` | [PRD-691](https://linear.app/greenpill-dev-guild/issue/PRD-691) | [PRD-692](https://linear.app/greenpill-dev-guild/issue/PRD-692) | ⏳ |
| Docs: community guide + operator triage guide + glossary entries | `docs` | [PRD-691](https://linear.app/greenpill-dev-guild/issue/PRD-691) | [PRD-693](https://linear.app/greenpill-dev-guild/issue/PRD-693) | ⏳ |
| QA/dogfood: TAS pilot run, PostHog metrics readiness, offline proof | `qa_dogfood` | [PRD-691](https://linear.app/greenpill-dev-guild/issue/PRD-691) | [PRD-694](https://linear.app/greenpill-dev-guild/issue/PRD-694) | ⏳ |
| Hardening (parked): on-chain eligibility module | `hardening` | [PRD-695](https://linear.app/greenpill-dev-guild/issue/PRD-695) | none | 🅿️ |
| Hardening (parked): deeper on-chain funding attribution | `hardening` | [PRD-696](https://linear.app/greenpill-dev-guild/issue/PRD-696) | none | 🅿️ |

Commitment Pooling amendment history (2026-07-04): historical PRD-672 added `needUID`, historical PRD-673 persisted it, and historical PRD-679 added Hypercert lineage. Active PRD-682 owns the independent Community PWA delivery prerequisite. Canceled PRD-683 is traceability for the operator-seeding scope now owned by PRD-691 and `handoffs/claude-ui-admin.md`; none of the historical children are dispatch targets.

## Tracks and Sequencing

### Track R: Research and operator engagement (live cycles)

1. [ ] Through Product cycle end 2026-07-16: PRD-701 operator outreach is under way (contacts, consent script, facilitation kit in progress); the kickoff package and session slots land by PRD-701's due date 2026-07-30 (re-dated from 07-16 per commitment-pooling decision #24); no cohort is marked ready by invitation alone
2. [ ] Through Research cycle end 2026-07-30: RESR-62 runs two-pass sessions, returns mandate drafts for operator confirmation, tests problem/desired-outcome and multi-domain language, and keeps Request/Offer testing in the commitment section; RESR-64 evaluates join-request persistence options
3. [ ] July dry-run checkpoint 2026-07-31: confirmed mandates + readiness matrix with gaps; this is a go/no-go input, not a promise of complete onboarding
4. [ ] August/September milestones: operator implementation reviews and gathering rehearsal; post-pilot findings gate PRD-695/696

### Track S: Needs substrate (rides the August build)

1. [ ] Freeze the Commitment Pooling schema-registration helper/interface; the approved append-only `schemas.json` guidance amendment and Community contracts handoff are already present
2. [ ] PRD-687 exact schemas + resolvers + deploy target: kind-free Need schema, moderation/reopen, typed merge, funding chain/receipt contract; remains blocked only until step 1 clears
3. [ ] PRD-687 consolidated indexer slice: complete commitment creation fields + claim-request state; folds into the PRD-650 indexer lane without recreating closed child issues
4. [ ] Shared-foundation prerequisite: extract generic runtime/auth/offline/install/update/error/shell primitives; migrate client and prove no behavior change
5. [ ] PRD-687 consolidated shared slice: needs hooks, two-axis joined read, `need`/`needSignal`/`testimony`, waiting_for_hat recovery, funding verifier, voice spike
6. [ ] PRD-687 consolidated paymaster slice: policy + caps + burst test before first sponsored community write

### Track A: September needs app

7. [ ] PRD-682 scaffolds the independent Community PWA only after PRD-758 closes and shared-foundation, state/API, and paymaster proof are complete; PRD-691 admin `/community` triage/pools/evaluator consumes the same substrate. PRD-758 does not block the core Commitment Pooling backend. Membership queue remains gated
8. [ ] PRD-691 funder-lens sub-lane after the PRD-687 state/API aggregate and editorial grammar are GREEN (historical PRD-692 is not dispatchable)
9. [ ] PRD-691 admin seeding-gate intake after the Community state/API aggregate and Commitment Pooling admin substrate are GREEN (canceled PRD-683 is not dispatchable)
10. [ ] PRD-691 docs sub-lane after Community PWA, admin, and funder surfaces ship for screenshots (historical PRD-693 is not dispatchable)
11. [ ] PRD-691 QA/dogfood after Community PWA, admin, funder, state/API, and paymaster proof; end with the pilot readout in `handoffs/` (historical PRD-694 is not dispatchable)

### Track H: Post-pilot hardening (parked, evidence-gated)

- [ ] PRD-695 eligibility module — promotion gate: written evidence that off-chain batch-mint policy failed a real garden
- [ ] PRD-696 deeper funding attribution — promotion gate: the PRD-691 QA/dogfood readout (historical PRD-694 label) records volume, verification rate, and funder entry via Needs

## TDD / Proof Order

- [ ] Identify the behavior boundary for each implementation lane before editing code
- [ ] Write or select the minimal failing test/proof first; record RED/GREEN evidence in the lane handoff
- [ ] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Lane Checklists

Agent eligibility mirrors the CP convention: contracts / indexer / shared-foundation / state-api lanes Codex-eligible; UI, funder-lens, and docs lanes Claude-only; QA pass 1 Claude, QA pass 2 Codex. Per-issue dispatch stays with Afo.

### Contracts (`codex/contracts/community-interface`): PRD-687
- [ ] Schemas + resolvers + need-schemas.ts per `spec.md` §3; bun wrappers only, never raw forge
- [ ] Foundry tests per house resolver pattern; record RED/GREEN proof
- [ ] Write `handoffs/codex-contracts.md`

### Indexer (`codex/indexer/community-interface`): PRD-687 (historical label PRD-688)
- [ ] needUID + aggregates per `spec.md` §4; `bun codegen` clean; scripted event-sequence proof
- [ ] Write `handoffs/codex-indexer.md`

### State / API (`codex/state-api/community-interface`): PRD-687 (historical label PRD-690)
- [ ] After shared-foundation proof: kinds, two-axis joined read, funding verifier/export, voice capture per `spec.md`; hooks stay in shared; locale keys en/es/pt
- [ ] Voice feasibility spike verdict written back into `spec.md` §5
- [ ] Write `handoffs/codex-state-api.md`

### Ops / Paymaster (human owner; Claude support only after dispatch): PRD-687 (historical label PRD-689)
- [ ] Pimlico policy extension + caps + burst test; checklist in `handoffs/ops-paymaster.md`

### UI Admin (`claude/ui-admin/community-interface`): PRD-691 (canceled PRD-683 is historical only)
- [ ] Admin tasks only; AdminDialog anatomy; Storybook; `cockpit.community.*` i18n
- [ ] Do not implement join-request storage or membership queue until the research-plan decision exit criteria are satisfied
- [ ] Write `handoffs/claude-ui-admin.md`

### Funder Lens (`claude/funder-lens/community-interface`): PRD-691 (historical label PRD-692)
- [ ] Client public views only; editorial guardrails; `public.needs.*` i18n; route decision recorded (CP decision #21)
- [ ] Write `handoffs/claude-funder-lens.md`

### Shared Foundation + Community App (CP Track C): PRD-682
- [ ] Migrate client to extracted shared foundations with auth/offline/build proof before scaffolding Community
- [ ] Independent Community PWA: `community.greengoods.app`, local 3010, isolated manifest/service worker/telemetry/routes

### Docs (`claude/docs/community-interface`): PRD-691 (historical label PRD-693)
- [ ] Glossary anchors preserved; vocab lint green ("problem" absent from needs copy)
- [ ] Write `handoffs/claude-docs.md`

### QA / Dogfood (`claude/qa-dogfood/community-interface`): PRD-691 (historical label PRD-694)
- [ ] Authenticated Brave for admin proof; real device for the PWA loop; PostHog per-project event verification (switch-project first)
- [ ] Pilot readout in `handoffs/qa-dogfood-readout.md`

## Validation

Per the Validation Intent Ladder: lane work uses targeted proof; the coordinator runs the Repo Quick Gate at checkpoints; Ship Gate before merge/release.

- [ ] Lane-targeted: each `.plans` lane handoff names its exact commands; parent-only Linear trackers point to these handoffs rather than duplicating lane validation
- [ ] Checkpoint: `node scripts/dev/ci-local.js --quick` after multi-lane merges
- [ ] Ship Gate before release: `bun format && bun lint && bun run test && bun build` + `bun run lint:vocab` + `bun run check:design-tokens` + story gates where stories changed
- [ ] Dogfood: the PRD-691 QA/dogfood handoff runs the end-to-end loop on the fork, then staging (historical PRD-694 is not dispatchable)

## Boundary

No implementation code starts from this plan without per-issue dispatch. Out of scope for every lane: claim flow, leaderboards, funding-ranked ordering, per-need escrow, push notifications, Community-owned settlement or Celo/G$ transaction logic, ActionSignalPool wiring, EAS indexing in Envio, and public on-chain join requests. Read-only settlement context may appear only through correctly classified Commitment Pooling joined reads. The August MVP is never destabilized from this hub; its touchpoints are the dated `needUID`, domain/event, and indexer amendments recorded there.
