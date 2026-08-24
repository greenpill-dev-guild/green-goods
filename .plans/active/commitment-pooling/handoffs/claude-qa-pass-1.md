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
- **Wave 2 — human experience QA.** Afo, after Wave 1's defect list is dispositioned (fixed or
  explicitly accepted). Covers design patterns, user flows, UX judgment, locale tone, dark-mode
  and motion feel, and every real-device requirement. Checklist in § Wave 2 walkthrough below.
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

Entry: Wave 1 report read; release-blockers and defects dispositioned; its Wave 2 notes in hand.

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
