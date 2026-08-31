# Commitment Pooling - Claude QA Pass 1 Handoff

## Status

- Machine lane: qa_pass_1
- Owner: Claude (Wave 1 agent run) + Afolabi Aiyeloja (Wave 2 human run)
- Branch signal: test/commitment-pooling-qa-pass-1
- Current state: manually blocked. The gate needs settlement exit-proof evidence or an explicit
  proof-limit record, plus the D2 finish-or-cut decision for `ui_client`/`ui_admin`. Wave 1 may
  be dispatched **before** the gate clears as evidence-gathering (see § Wave structure); doing so
  does not advance the lane.
- Linear context: PRD-729 (QA pass 1 lane) under parent PRD-650. Register #37 reversed the
  earlier no-QA-child rule.

## Wave structure (2026-08-24)

QA Pass 1 runs as two ordered waves. The split exists so human QA time lands on a build whose
functional defects are already found and dispositioned.

- **Wave 1 — agent functional QA.** Dispatched via `../prompt-qa-functional.md`. Mode A
  (fixture & regression) runs unattended; Mode B (finalized 2026-08-24) is the **co-piloted
  production live loop** on the two sanctioned test gardens — the GG Community protocol pool and
  the Aiyeloja Family garden pool — over the `dev:prod:mirror` stack in Afo's default
  authenticated Brave, with Afo signing every wallet and passkey prompt under the prompt's
  friendly-window signing protocol (the agent drives everything else and never signs). Proves
  functionality: screens, states, acts, copy rules, offline queue behavior, regression classes,
  and mechanical accessibility/locale presence — each item at the strongest honest proof tier
  (LIVE / FIXTURE / STORYBOOK / SUITE / BLOCKED), with defects routed to owning lanes, never
  fixed in the QA lane. Output: `../reports/qa-functional-wave-1-<date>.md` plus an append-only
  summary under § Wave 1 runs below.
- **Experience audit — agent design pass feeding Wave 2.** Dispatched via
  `../prompt-qa-experience-audit.md` (added 2026-08-24): a read-only, no-signature audit of
  design-system conformance (review-checklist Lenses 1–5, interaction-patterns, token/anatomy
  rules) and experience quality (the `flow-audit-prompt.md` six-qualities method applied to the
  shipped surfaces). Runs unattended, before or alongside Wave 1. Output: ranked improvement
  backlog + a Wave 2 shortlist of judgment calls, in
  `../reports/qa-experience-audit-<date>.md`; summary appended under § Experience audit runs.
- **Wave 2 — human experience QA.** Afo, after Wave 1's defect list is dispositioned (fixed or
  explicitly accepted). Covers design patterns, user flows, UX judgment, locale tone, dark-mode
  and motion feel, and every real-device requirement — starting from the experience audit's
  backlog and shortlist rather than a blank page. Checklist in § Wave 2 walkthrough below.
- Wave outputs merge into one QA Pass 1 disposition (passes / visible defects / external
  blockers) that feeds PRD-727 docs polish and then QA Pass 2.

## Inputs

- GREEN contracts, indexer, shared, and runtime UI handoffs; post-QA documentation and
  walkthrough videos are intentionally excluded. As of 2026-08-24 the three D1 surfaces are
  merged to `develop` (#748 editorial UI, #749 client loop, #752 steward console; reviewed
  candidate `2cd115a1d`); `ui_client`/`ui_admin` remain `in_progress` pending the D2 decision.
- Verified `develop` source SHA. Staging is `staging.greengoods.app` /
  `staging-admin.greengoods.app`, but staging runs a separate passkey namespace (throwaway
  identities until PRD-832 lands) and the hosted Envio has no pooling schema (readiness review
  P1, introspected 2026-08-23) — so QA drives the local stack, and staging/hosted rows stay
  external blockers until those deployments happen.
- Settlement external-gate evidence or an explicit proof-limit record.
- Authenticated Brave access (Wave 1 rendered claims), real-device PWA access (Wave 2), and
  `../acceptance-matrix.md` (§1 state/copy, §3 public claims, §4 role/route journeys).

## Outputs

- Wave 1: tier-labeled coverage table over the acceptance anchors, severity-ordered defect list
  routed to owning lanes, external-blocker list, and Wave 2 handoff notes.
- Wave 2: human-flow QA record across member, gardener/provider, steward, evaluator, funder, and
  collaborator roles; design-lens findings; real-device evidence.
- Combined: confirmed pass / visible defect / external blocker separation. No implementation in
  the QA lane.

## Acceptance

Wave 1 proves (functional, agent-verifiable):

- Every in-scope loading, empty, offline, pending, waiting, declined, superseded, failed, retry,
  queued, dispatched, executed/acknowledgment-pending, delayed, Confirmed, and delivery-disabled
  state has an exit — settlement transport states at STORYBOOK/SUITE tier until their external
  gates clear, and member-facing copy never shows the internal state noun (matrix §1 `:34-45`,
  §3 forbidden wording).
- Offer receiver and Request creator confirmation are correct (direction-aware). The opted-in
  Green Goods protocol fallback rescues a small garden with no eligible ordinary/local confirmer;
  an unselected commitment never silently escalates; local fallback wins for a dual-role wallet;
  module ownership alone never confirms; every contributor is excluded from confirmation; and
  actor/path/reason are distinct in both admin and client history. (Rule-level proof is
  suite-tier in contracts/shared; Wave 1 proves the rendered provenance.)
- Batching starts disabled, uses a measured matching 0–24 limit on both chains, and retains a
  hard ceiling of 24; immutable failed batches, unbatched per-member recovery, same-key command
  retry, independent acknowledgment retry, and authenticated-only confirmation are visible and
  coherent — suite/Storybook tier plus the settlement proof-limit record.
- Public/editorial claims distinguish planned, dispatched, confirming, and confirmed behavior;
  the kept rate publishes only at its thresholds; no provider addresses or provider-level
  outcomes leak on public surfaces. Documentation mismatches become inputs to the PRD-727 polish
  lane.
- The demo/availability seams behave: without `mockPooling` the Pool tab is absent (not empty)
  and mutations are impossible; under `mockPooling` writes stay visibly queued and never send.
- Accessible names, focus order, touch targets, keyboard paths, reduced motion, and en/es/pt
  rendering are mechanically checked; measurements land in the report, judgment lands in Wave 2.
- The named regression set (React-Compiler interactivity class, address-casing, steward seating,
  paused-pool reason, row truncation, vocabulary, double-tap idempotency, paused-pool deep link,
  roster caps) does not reproduce.

Wave 2 proves (human judgment and device-bound):

- Member/client and admin flows read well end-to-end through authenticated Brave; installed
  PWA install/offline/restart/member-delivery behavior is exercised on a real device.
- Design-pattern, flow, and UX quality per the § Wave 2 walkthrough checklist.

## Wave 2 walkthrough (Afo)

Entry: Wave 1 report read; release-blockers and defects dispositioned; its Wave 2 notes plus the
experience audit's improvement backlog and shortlist in hand.

1. **Real-device pass (functional residue only a human can do).** Install the PWA through the
   tunnel QR (`bun run dev:tunnel`); airplane-mode capture of a commitment act + proof with
   media; kill/relaunch while offline; restore network and watch the queue drain; member
   delivery-disabled behavior; camera capture inside the proof composer.
2. **Journey walks (flow judgment).** Walk the state-reference frame groups as stories — "Your
   offer, start to finish", "Your request", "A service offer", "Recorded for you", "Money on its
   way", "How it ended", "Under steward review" — plus the steward run-the-season journey
   (setup → open → claims → confirm → pause/resume) and the public reader journey
   (`/gardens/:id` § 02 → `/impact`). Judge continuity, the relay between people, dead ends, and
   the emotional arc with `../flow-audit.md`'s vocabulary; note where a functional pass still
   reads wrong.
3. **Design lenses.** `.claude/skills/design/review-checklist.md`: client surfaces get Lenses
   1–4; admin surfaces add Lens 5 (interaction-patterns) — with Wave 1's measurements (tab-rail
   overflow, sm-button targets, `aria-describedby`, light-mode-only admin proof) as the starting
   hotspot list. Warm-garden-journal vs restrained-cockpit identity stays unmixed.
4. **Copy and locale tone.** Read the key screens in es and pt for tone, not just presence;
   final forbidden-wording read on public claims; glossary consistency (commitment never
   promise; steward for the on-chain operator role; assessment precedes work).
5. **Exit.** Append Wave 2 findings to the QA record, fold both waves into the QA Pass 1
   disposition, and route documentation mismatches to PRD-727.

## RED / GREEN or proof limit

- RED: a named role/state path fails its acceptance fixture, a required lane command fails, or
  rendered/authenticated evidence disagrees with the spec.
- GREEN: every in-scope role/state path has current evidence at its honest tier, all owning-lane
  commands pass, and defects are dispositioned without hiding external blockers.
- Proof limit: QA adds no product behavior. Missing hosted Envio schema, staging passkey
  namespace, live CCIP peers/fee reserves, Celo, Safe, AA, authenticated-browser, steward-fixture,
  or real-device paths are external blockers, never passes; record the exact unavailable evidence
  once. A lower proof tier is never reported as a higher one — fixture is not live, Storybook is
  not authenticated, suites are cited, not re-proven.

## Exact Bun commands

Run the targeted commands named in each GREEN handoff, then:

- bun run --filter @green-goods/contracts test
- bun run --filter @green-goods/indexer test
- bun run --filter @green-goods/shared typecheck
- bun run --filter @green-goods/client test
- bun run --filter @green-goods/admin test
- bun run docs:audit
- bun run lint:vocab
- bun run agentic:check
- bun run check:design-md
- bun run check:design-generated
- bun run check:design-tokens

(Wave 1's per-run baseline is the shared/client/admin/indexer suites plus lint:vocab; the full
list above binds the lane before it can turn GREEN.)

## Out of scope

- Fixing defects, changing specs, isolated Playwright/DevTools profiles as authenticated proof,
  manual settlement confirmation, garden-held member claims, broad ship-readiness claims, Linear
  issue creation, status.json edits from the QA lane, or committing the Mode B availability-ledger
  flip.

## Unblock evidence

- Required runtime implementation handoffs are GREEN; post-QA docs, walkthrough videos, and the
  independent September Community handoff are not QA Pass 1 dependencies. As of 2026-08-24 the D1
  surfaces are merged; the D2 finish-or-cut decision is the remaining `ui` question.
- Settlement gate record names official direct-lane availability, CCIP peers/fees, exact-net
  GoodDollar behavior, Safe/Zodiac bounds, AA, separate Arbitrum/Celo local/fork/testnet proof,
  and any proof limits. Celo Sepolia executor/Safe/roles/surrogate evidence is not CCIP endpoint
  evidence; a live endpoint claim requires a fresh official lane/router and still must not be
  reported as a direct Arbitrum Sepolia↔Celo Sepolia lifecycle.
- Authenticated Brave and real-device access are confirmed for their waves.
- QA result separates passes, defects, and external blockers with route/role/state evidence.

## 2026-07-28 amendment coverage

- Add acceptance proof for solo and team commitments, repeatable requirements beyond four in a
  benchmark-safe fixture, contributor add/remove/freeze, all-team confirmation exclusion, and
  contribution attribution. (Rule layer is suite-tier; Wave 1 proves the rendered roster,
  attribution, and exclusion surfaces.)
- Prove gardener recognition totals exactly, including exact-CID evidence de-duplication,
  explicit credited-contributor job replay, one countable credit per Work UID, fulfillment-gated
  eligibility, opened cycle policy or the immutable cycle-less default, roster freeze on Ready
  and direct dispute fulfillment, zero-eligible W26 inconsistent-state blocking with no lead or
  metadata fallback, and deterministic rounding; prove recognition-vector/hash binding,
  amount-derived payment weights, reasoned correction, no-child finalization, idempotent one-child
  preparation, all-retained zero-child completion, exact garden-retention conservation, stable
  parent pointers after cancellation, partial child failure/retry, and complete receipts. (Suite
  tier in contracts/indexer/shared; Wave 1 verifies the surfaced numbers and receipts agree with
  the suite fixtures where a UI renders them.)
- A passed commitment lifecycle does not waive settlement gates; runtime/deploy/broadcast remain
  blocked until their existing lane gates clear.

## Wave 1 runs

(Append-only. Each dispatched Wave 1 run adds a dated summary block here: mode, coverage counts
by tier, defect counts by severity, external blockers. Full reports live in
`../reports/qa-functional-wave-1-<date>.md`.)

### 2026-08-24 — Mode A on `origin/develop@3bfc85432750faa7aad693fea7a85f59a00fa327`

- The SHA above is the dispatch-pinned target. Another session fast-forwarded the shared checkout to `a5fe2c78b5f8ac66ec80ad68aa376ce882500cad` during the run; client fixture captures belong to the pinned target, while Storybook captures and a fresh passing shared/client/admin/indexer/vocabulary cross-check belong to that successor. The full report keeps those snapshots distinct.
- Coverage: 79 rows — LIVE 2, FIXTURE 29, STORYBOOK 7, SUITE 19, BLOCKED 3, NOT-RUN 19.
- Defects: release-blocker 0, defect 4, polish 3. Confirmed issues are fallback-provenance invalid DOM nesting/hydration errors, a failing PoolSetupFlow FirstRun story play check, contradictory proof summary copy in ConfirmSheet, recurring local Service Worker registration failure, sub-44px admin row actions, narrow-rail overflow, and singular-unit grammar.
- External blockers: the concurrent fast-forward prevented a single-snapshot rendered pass; hosted Envio has no pooling schema; the local deployed-contract mirror could not be restarted because the OrbStack Docker daemon socket was absent and an unowned/nonresponsive OrbStack listener held port 3008; staging passkeys use the separate namespace; settlement authorization is paused; the Brave extension could not complete a media-file chooser; real-device PWA evidence belongs to Wave 2.
- Authenticated Brave fixture interaction covered commitments 1001–1020, both composer directions, text-proof queueing, NotYours, confirmation/Not yet, withdrawal, claim queueing, drawer grouping, pooling-off, and en/es/pt presence. Protocol fixture 1021 and successful live admin routes were blocked by the mirror.
- Full report: `../reports/qa-functional-wave-1-2026-08-24.md`. Evidence: `../reports/evidence/qa-wave-1/`. No fixes, Linear records, branch changes, on-chain writes, signatures, commit, or lane-status changes were made.

## Experience audit runs

(Append-only. Each dispatched experience audit adds a dated summary block here: finding counts
by severity, the three highest-leverage changes, capture counts. Full reports live in
`../reports/qa-experience-audit-<date>.md`.)

### 2026-08-25 — full pass on `origin/develop@fc27a5b000fd8ab8674ac5a6dea159a0a602234b`

- Both halves audited across the scope grid: Phase 0 gates (all green except the pre-existing
  `check:browser-verification-policy` red inside `agentic:check`), 777 Storybook + 65 fixture +
  25 live captures across light/dark × 320/465/768/1280 × en/es/pt, a mechanical measurement
  pass (touch targets, radii, shadows, error association, tab-rail overflow, dark-token probes,
  locale clipping), and an interactive walk of the client fixture world, live steward console
  (light + dark), and editorial pages (en + es).
- Findings: **0 breaks-identity · 13 erodes-quality · 8 polish** (21-row ranked backlog), plus
  10 functional observations routed to their lanes (notable: the CommitmentDialogPanel Detail
  story crashes outside a Router; composer review still says "1 hours"; demo-gate gaps hide
  garden actions and the charter under fixtures).
- All 9 seeded leads dispositioned: tab-rail scroll and `aria-describedby` fixed at head
  (`1e34e39e2`); admin dark mode renders with correctly flipped tokens (blessing → Wave 2);
  32 px admin act targets confirmed and quantified; es/pt clip the composer's Next label and the
  garden tab labels at 320; every prototype flow-audit lead re-verified fixed in shipped code
  (seat model, single-act bar, no machine words, labeled steps, both doors gated).
- The three changes: (1) give pooling an arrival surface — no notification exists for taken-up /
  confirmed / resolved, so the product's highest moment lands silently; (2) name the people —
  requests never name the asker and hex strings sign the payoff; (3) scope the pool list to live
  rows. Wave 2 shortlist (8 questions) covers the es/pt "pool" noun, kept-moment ceremony,
  admin-dark blessing, casing-contract side, count-card grammar, pinned hero, NEEDS YOU
  intensity, and unnamed-confirmer fallback copy.
- Full report: `../reports/qa-experience-audit-2026-08-25.md`. Evidence:
  `../reports/evidence/qa-experience-audit/` (59 files; live captures with real fork records
  stay outside the repo per the privacy rule). No fixes, commits, Linear writes, signatures, or
  lane-status changes were made.

### 2026-08-25 — Wave 2 intake addendum (same run, same target SHA)

- Afo's first-read observations (11 items) were validated the same day and appended to the
  report as § 10 (AD-1…AD-11, backlog rows 22–31). All validated; notable measurements: the
  admin command palette resizes 362→158 px and drifts its input 100 px down while typing; the
  Hub stage config is Work→Assess→Certify→Confirm→History (decided: Confirm first, History
  gone); Community carries a fifth Pools tab (decided: fold into Coordination); the
  availability cast's "not on this chain yet" copy misattributes the deliberate ledger gate to
  the chain (18 pools are registered); the editorial § 02 panel and the five-stage cycle are
  superseded by decided directions (on-canvas grammar; four steps Needs · Commitment · Work ·
  Learnings — drafted copy in the report); image hover-zoom removal validated at 4 components;
  "Over time" is the drawer's history surface but does not read as one.
- Still read-only: no fixes, commits, or Linear writes.

### 2026-08-25 — fix pass 1 (Groups A–C built, D proposed)

- Scope-locked run on Afo's go: **24 fixed · 2 no-change-needed · 0 blocked** across the
  audit's decided backlog. Two independent PRs off develop, Afo merges: [#770]
  (`fix/pooling-experience-pass-1`, Groups A+B — expire confirm, Hub reordered to
  Confirm · Work · Assess · Certify with History retired, Community ▸ Pools folded into
  Coordination, pinned command palette, title-medium route headers, AddressDisplay + worded
  relationships, 44 px effective targets, asker named, pool liveness scope, evidence on the
  detail with count/row reconciliation down to the demo world, es/pt clipping, browser-QA
  phrases → `agentic:check` green) and [#771] (`feat/editorial-record-and-cycle`, Group C —
  § 02 on the canvas with `EditorialPanel` retired, the four-step Needs · Commitment · Work ·
  Learnings cycle with the § 10 draft as shipping copy, hover zoom gone at six sites, held
  empty/error space; supersessions recorded as uiux-spec Appendix G).
- No-change-needed with evidence: backlog 20 (TopNav already carries a 48 px effective target;
  no 40 px comparator exists) and 7a (the "Siguiente" clip was `tap-target-lg`'s ::after
  inflating scrollWidth by exactly the reported 8 px).
- Root causes fixed beneath findings: `AdminTextField` clobbered caller aria state (backlog
  18's real mechanism); hours/meals missing from the unit families (F10, all surfaces); the
  demo world hardcoded empty evidence attributions (F5's fixture half).
- Unplanned: develop's mid-pass seam commits left both merge refs red on inherited debt
  (banned `/i18n` barrel with no `formatCommitmentUnits` leaf; six newly-dead exports) —
  cleared on both branches; a shared-checkout branch switch and an untracked-file cleanup by
  concurrent sessions were absorbed (details in the fixes report § 5).
- Group D delivered as proposals only (arrival surface, client timeline, GG-name resolution,
  12/15/16 parked). Full record: `../reports/qa-experience-fixes-2026-08-25.md`; evidence:
  `../reports/evidence/qa-experience-fixes/` (26 captures + 2 measurement JSONs). No ledger
  flip, no on-chain writes, no Linear writes, no status.json edits.
