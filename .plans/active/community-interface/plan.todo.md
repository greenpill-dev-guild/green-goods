# Community Needs Interface Plan

**Feature Slug**: `community-interface`
**Stage**: `active`
**Status**: `ACTIVE: spec aligned 2026-07-04; Linear consolidated to parent trackers 2026-07-05; implementation not started`
**Created**: 2026-07-04
**Last Updated**: 2026-07-05

Linear mirror: project [Community Signals & Engagement](https://linear.app/greenpill-dev-guild/project/community-signals-and-engagement-083dd7e556c2) (graduated from scoping-only to build home 2026-07-04). Milestones: Needs substrate (rides August, 2026-08-31), September needs app (2026-09-30), Post-pilot hardening (2026-12-31). The September app delivery records (PRD-682/683) stay in [Green Goods Commitment Pooling](https://linear.app/greenpill-dev-guild/project/green-goods-commitment-pooling-4bc53572f354), amended 2026-07-04. Specs in this folder: `spec.md`, `corrections-log.md`.

> **Linear consolidation (2026-07-05).** Per-lane workstream issues were closed into two parent **trackers**; **this plan is the lane-level execution truth**. Trackers: **PRD-687** needs substrate (absorbs PRD-688 indexer, PRD-689 paymaster, PRD-690 shared) and **PRD-691** September needs app (absorbs PRD-692 funder lens, PRD-693 docs, PRD-694 QA/dogfood). Kept as-is: parked hardening **PRD-695/696** and scoping record **RESR-64**; the September delivery records **PRD-682/683** in Commitment Pooling now roll up under that project's **PRD-682** tracker. The per-lane `PRD-6xx` IDs in the tables below are **historical labels** for the closed child issues.

## Decision Log (locked 2026-07-04, full rationale in spec.md §1)

| # | Decision |
|---|---|
| 1 | Vocabulary is **Need** (never "problem") in code and copy: schemas Need/NeedSignal/NeedStatus, field `needUID`, tab Needs, es Necesidades / pt Necessidades. |
| 2 | Community Signals & Engagement is the build home; PRD-682/683 stay in Commitment Pooling, amended in place; cross-project blocked-by relations wire the dependency. |
| 3 | Spec home is this hub; the commitment-pooling hub carries only the `needUID` amendment + §8 supersession note (+ decision-register addendum #28). |
| 4 | App IA: Needs / Create (center, voice-first) / Profile; pool story folds into the board header + detail threads; solution-proposal objects dropped. |
| 5 | Fund action: embedded donate + endowment (the /fund paths) in need context; `FundingAttribution` attestation in v1; funded-toward on detail only, never a sort key; no per-need escrow. |
| 6 | Voice: audio always as evidence; dictation + transcription on BOTH statement and outcome; local-first (feasibility spike), server transcribe-on-sync fallback via the agent package; never blocks submission. |
| 7 | Discovery: global read-only browse; my garden is the scoped default; signal rights same-garden only. |
| 8 | No claim flow in v1; the need→operator triage binding is first-class (urgent alerts, triage queue, seed-from-signal). |

Sub-decisions: Need/NeedSignal revocable (self-retraction/un-signal only — EAS revocation is attester-only); NeedStatus enum 1 acknowledged / 2 merged / 3 hidden / 4 declined; FundingAttribution hat-free, spam-guarded at read time; status derivation is an app-side join (Envio never indexes EAS).

## Research / Plan Gate

- [x] Research evidence recorded: `corrections-log.md` (every research-pass repo claim verified, corrected, or superseded, with file paths)
- [x] Existing repo patterns identified: IGardenAccessControl resolver gating, badge-schemas standalone registration, AudioRecorder/useAudioRecording + audioNotes IPFS path, agent transcription service, job-queue kind extension points, two-indexer read path
- [x] Human judgment points surfaced and decided: 8 locked decisions + walk-through of the research pass's four open questions (2026-07-04 session)
- [x] Out of scope defined: claim flow, leaderboards/funding-ranked boards, per-need escrow, push notifications, settlement, eligibility module (parked), ActionSignalPool wiring
- [x] Lightest honest validation chosen per lane (see Validation)

## Requirements Coverage

| Requirement | Lane | Linear issue | Status |
|---|---|---|---|
| Need/NeedSignal/NeedStatus/FundingAttribution schemas + resolvers + registration | `contracts` | [PRD-687](https://linear.app/greenpill-dev-guild/issue/PRD-687) | ⏳ |
| needUID on commitment entities + need-keyed aggregates | `indexer` | [PRD-688](https://linear.app/greenpill-dev-guild/issue/PRD-688) | ⏳ |
| Pimlico sponsorship policy for need/signal/testimony writes | `ops_paymaster` | [PRD-689](https://linear.app/greenpill-dev-guild/issue/PRD-689) | ⏳ |
| Shared substrate: job kinds, needs hooks + derivation join, voice dictation & transcription | `state_api` | [PRD-690](https://linear.app/greenpill-dev-guild/issue/PRD-690) | ⏳ |
| Admin: need triage, moderation, batch-mint console, gathering view | `ui_admin` | [PRD-691](https://linear.app/greenpill-dev-guild/issue/PRD-691) | ⏳ |
| Funder lens: global needs gallery + donate/endowment embed + FundingAttribution | `funder_lens` | [PRD-692](https://linear.app/greenpill-dev-guild/issue/PRD-692) | ⏳ |
| Docs: community guide + operator triage guide + glossary entries | `docs` | [PRD-693](https://linear.app/greenpill-dev-guild/issue/PRD-693) | ⏳ |
| QA/dogfood: TAS pilot run, PostHog metrics readiness, offline proof | `qa_dogfood` | [PRD-694](https://linear.app/greenpill-dev-guild/issue/PRD-694) | ⏳ |
| Hardening (parked): on-chain eligibility module | `hardening` | [PRD-695](https://linear.app/greenpill-dev-guild/issue/PRD-695) | 🅿️ |
| Hardening (parked): deeper on-chain funding attribution | `hardening` | [PRD-696](https://linear.app/greenpill-dev-guild/issue/PRD-696) | 🅿️ |

Amended in place in Commitment Pooling (2026-07-04): [PRD-672](https://linear.app/greenpill-dev-guild/issue/PRD-672) (`needUID` additive field), [PRD-673](https://linear.app/greenpill-dev-guild/issue/PRD-673) (persist needUID; PRD-688 folds in if unstarted), [PRD-679](https://linear.app/greenpill-dev-guild/issue/PRD-679) (Hypercert lists needUIDs), [PRD-682](https://linear.app/greenpill-dev-guild/issue/PRD-682) (IA, signal layer, creation flow, discovery; blocked by PRD-690), [PRD-683](https://linear.app/greenpill-dev-guild/issue/PRD-683) (horizon routing, traceability; blocked by PRD-691).

## Tracks and Sequencing

### Track S: Needs substrate (rides the August build)

1. [ ] Amendments already landed in specs: `needUID` in the CP contract-spec (2026-07-04) — the August PRD-672/673 builds carry it with zero extra sequencing
2. [ ] PRD-687 schemas + resolvers (starts after the PRD-671 chain merges; registration broadcast follows the August gated-broadcast conventions)
3. [ ] PRD-688 indexer (after PRD-672/673 event signatures exist; folds into PRD-673 if that lane is unstarted)
4. [ ] PRD-690 shared substrate (after PRD-674 interfaces + PRD-687 schema UIDs; the voice feasibility spike can start immediately — it has no dependencies)
5. [ ] PRD-689 paymaster policy (after PRD-687 registration; must be live + burst-tested before the first sponsored community write, gates PRD-694)

### Track A: September needs app

6. [ ] PRD-682 (CP) community app consumes PRD-690; PRD-691 admin triage consumes PRD-690 + PRD-676 — these two run in parallel
7. [ ] PRD-692 funder lens (after PRD-690 + PRD-678 editorial grammar)
8. [ ] PRD-683 (CP) seeding-gate intake (after PRD-676 + PRD-691)
9. [ ] PRD-693 docs (after PRD-691 + PRD-682 ship surfaces for screenshots)
10. [ ] PRD-694 QA/dogfood (after PRD-682/689/691/692; ends with the pilot readout in `handoffs/`)

### Track H: Post-pilot hardening (parked, evidence-gated)

- [ ] PRD-695 eligibility module — promotion gate: written evidence that off-chain batch-mint policy failed a real garden
- [ ] PRD-696 deeper funding attribution — promotion gate: PRD-694 readout (volume, verification rate, funder entry via needs)

## TDD / Proof Order

- [ ] Identify the behavior boundary for each implementation lane before editing code
- [ ] Write or select the minimal failing test/proof first; record RED/GREEN evidence in the lane handoff
- [ ] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Lane Checklists

Agent eligibility mirrors the CP convention: contracts / indexer / state-api lanes Codex-eligible; UI, funder-lens, and docs lanes Claude-only; QA pass split Codex → Claude. Per-issue dispatch stays with Afo.

### Contracts (`codex/contracts/community-interface`): PRD-687
- [ ] Schemas + resolvers + need-schemas.ts per `spec.md` §3; bun wrappers only, never raw forge
- [ ] Foundry tests per house resolver pattern; record RED/GREEN proof
- [ ] Write `handoffs/codex-contracts.md`

### Indexer (`codex/indexer/community-interface`): PRD-688
- [ ] needUID + aggregates per `spec.md` §4; `bun codegen` clean; scripted event-sequence proof
- [ ] Write `handoffs/codex-indexer.md`

### State / API (`codex/state-api/community-interface`): PRD-690
- [ ] Kinds, hooks, derivation join, voice capture per `spec.md` §4–5; hooks stay in shared; locale keys en/es/pt
- [ ] Voice feasibility spike verdict written back into `spec.md` §5
- [ ] Write `handoffs/codex-state-api.md`

### Ops / Paymaster (`human+claude`): PRD-689
- [ ] Pimlico policy extension + caps + burst test; checklist in `handoffs/ops-paymaster.md`

### UI Admin (`claude/ui-admin/community-interface`): PRD-691 (+ PRD-683 in CP)
- [ ] Admin tasks only; AdminDialog anatomy; Storybook; `cockpit.community.*` i18n
- [ ] Write `handoffs/claude-ui-admin.md`

### Funder Lens (`claude/funder-lens/community-interface`): PRD-692
- [ ] Client public views only; editorial guardrails; `public.needs.*` i18n; route decision recorded (CP decision #21)
- [ ] Write `handoffs/claude-funder-lens.md`

### Community App (CP Track C): PRD-682 — built under the CP hub's community lane, consuming this hub's substrate

### Docs (`claude/docs/community-interface`): PRD-693
- [ ] Glossary anchors preserved; vocab lint green ("problem" absent from needs copy)
- [ ] Write `handoffs/claude-docs.md`

### QA / Dogfood (`claude/qa-dogfood/community-interface`): PRD-694
- [ ] Authenticated Brave for admin proof; real device for the PWA loop; PostHog per-project event verification (switch-project first)
- [ ] Pilot readout in `handoffs/qa-dogfood-readout.md`

## Validation

Per the Validation Intent Ladder: lane work uses targeted proof; the coordinator runs the Repo Quick Gate at checkpoints; Ship Gate before merge/release.

- [ ] Lane-targeted: per-issue Validation sections (each Linear issue body names its commands)
- [ ] Checkpoint: `node scripts/dev/ci-local.js --quick` after multi-lane merges
- [ ] Ship Gate before release: `bun format && bun lint && bun run test && bun build` + `bun run lint:vocab` + `bun run check:design-tokens` + story gates where stories changed
- [ ] Dogfood: PRD-694's end-to-end loop on the fork, then staging

## Boundary

No implementation code starts from this plan without per-issue dispatch. Out of scope for every lane: claim flow, leaderboards, funding-ranked ordering, per-need escrow, push notifications, settlement, Celo/G$, ActionSignalPool wiring, EAS indexing in Envio. The August MVP (commitment-pooling hub) is never destabilized from this hub — its only touchpoints are the dated amendments recorded there.
