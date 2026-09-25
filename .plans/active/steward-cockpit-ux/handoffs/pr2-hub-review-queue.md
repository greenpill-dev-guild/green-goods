# Steward Cockpit UX Fixes — PR2 Hub

## Lane

- Execution sub-lane: `pr2_hub_review_queue` (machine lane `ui`; also touches `state_api`)
- Branch: `fix/hub-review-and-queue-health`, from a fresh `origin/develop` after PR1 merges
- Depends on: `pr1_actions_crash`
- Merge: the implementing agent merges with `--merge` once CI Gate is green and bot reviews are
  resolved
- Critical gate: this PR touches `packages/shared/src/hooks/garden/`, `hooks/assessment/`, and
  `modules/work/`, so the push plan runs the selector's critical override (shared typecheck plus
  the shared, client, admin, and agent suites). Run it when machine load is low.

## Scope

D2, D3, D5 (DEC-B), D8 (assessment title), D12, D13, D14 (review time), D23 (DEC-E), D28, D29,
D30 (review and assessment copy), D31 (Hub copy), D35. Codify DL-044, DL-047, DL-048.

## Steps

### 1. Work titles, repeats, dates (D2, D28, D29)

- Add a display-only `toWorkDisplayTitle(title, fallback)` to
  `packages/shared/src/utils/work/workTitles.ts`. It strips every trailing generated
  ` - <ISO timestamp>` group (hosted data has titles like
  `Maintenance Activity - 2026-03-19T23:56:54.981Z - 2026-03-19T23:56:55.093Z`) and returns the
  fallback when nothing is left or the rest is a placeholder (`isPlaceholderWorkTitle`). Leave
  `stripGeneratedWorkTitleTimestamp`, `resolveKnownWorkTitle`, and `resolveWorkSubmissionTitle`
  unchanged; submission paths depend on them.
- Use it for every displayed work title: `packages/admin/src/views/Hub/components/HubWorkCard.tsx`
  (~163), `HubSheetDescriptor.tsx` (~110, the dialog title),
  `packages/shared/src/hooks/garden/useGardenDerivedState.ts` (~286, activity and notifications),
  and `packages/admin/src/components/Hypercerts/Steps/AttestationSelector.tsx`. Keep the raw title
  in a `title` attribute. Hide placeholder action names ("Action N") rather than showing them.
- `packages/admin/src/views/Garden/WorkDetail/index.tsx` (~193): the topline keeps the status chip
  only; the dialog title already names the work.
- `WorkDetail/SubmissionDetails.tsx` (~62): date without seconds or time zone.
- `components/Layout/AdminNotificationPanel.tsx` (~93): one date per row (relative under a week,
  then the calendar date), not a relative age beside a date.
- Test: `packages/shared/src/__tests__/utils/workTitles.test.ts`, a table for
  `toWorkDisplayTitle` (one stamp, two stamps, none, only stamps → fallback, a title with its own
  dash, a placeholder → fallback).

### 2. Reject needs a reason (D3, DEC-G, DL-048)

- `packages/admin/src/views/Garden/WorkDetail/ReviewForm.tsx` (~386): Reject opens
  `AdminReasonDialog` (`variant="danger"`) instead of submitting. Copy (en; add es and pt):
  - title "Reject Work"; target line "<work title> · <gardener display name>"
  - description "The gardener sees your reason. Rejected work does not count toward <garden>'s
    record."
  - reason label "Why are you rejecting this?"; placeholder "What was missing or wrong, in your
    own words."
  - suggestions "Photos don't show the work", "Details are missing", "Wrong action chosen"
  - confirm "Reject Work"
- On confirm, submit the rejection with `feedback` set to the reason. Approval keeps the optional
  Feedback field.
- Add an optional `initialReason` prop to `packages/admin/src/components/AdminReasonDialog.tsx`
  (applied when the dialog opens) so text already typed in Feedback carries into the reason.
- The client already requires feedback to reject (`useWorkApprovalActions.ts:137`); this is
  parity, not a new rule.
- Test: update `packages/admin/src/__tests__/components/ReviewForm.test.tsx` (Reject opens the
  dialog; confirm is disabled until a reason; the rejection carries it). Extend
  `AdminReasonDialog.test.tsx` for `initialReason` only if the review test does not already prove
  it.

### 3. Confidence with nothing chosen (D13, D12)

- `packages/shared/src/components/Form/ConfidenceSelector.tsx`: when `required`, omit the None
  option, select nothing until the steward chooses, give the first chip `tabIndex=0` when nothing
  is selected, and show the hint only after a choice. The client review sheet
  (`packages/client/src/views/Home/Garden/Work.tsx`) passes `required` too and inherits the fix;
  PR CI runs the client suite.
- `ReviewForm.tsx` (~60, ~67, ~365): drop the warning box shown on open; show a quiet line
  "Choose a confidence level to approve." under the selector while Approve is disabled.
- `packages/admin/src/components/Hypercerts/HypercertWizard/index.tsx` (~39): show "Select at least
  one attestation to continue" only after Next is pressed with nothing selected.

### 4. Queue health and review time (D5, DEC-B, DL-044)

- `packages/shared/src/types/domain.ts`: add optional `reviewedAt?: number` (seconds) to `Work`.
- `packages/shared/src/modules/work/local-status-overlay.ts` `resolveGardenWorkRows` (~195): carry
  `approval.createdAt` onto decided indexed rows as `reviewedAt` instead of dropping it; saved rows
  keep theirs; overlay decisions made on this device leave it unset.
- Add a pure `summarizeReviewQueue(works, now)` to `packages/shared/src/utils/garden-detail.ts`
  returning: pending count, count waiting over 7 days, oldest pending time, last review time
  (known or unknown), `stalled`, and median submission-to-decision latency. Rule: `stalled` when
  the oldest pending work is 7+ days old and no known review landed in the last 7 days; a garden
  that has never reviewed anything counts as stalled; unknown review times never count as
  stalled.
- `packages/shared/src/hooks/garden/useGardenDerivedState.ts`: build the work badge, health, and
  alerts from it. Critical: "No reviews in 7 days, and N works are waiting." Needs Attention:
  "N works have waited over a week." Delete `pendingCriticalCount` and `pendingWarningCount` and
  every consumer (`useHubWorkbenchController`, `packages/admin/src/views/Hub/index.tsx`).
- `packages/shared/src/hooks/admin-ui/hub/hub.utils.ts` `buildHubHeaderStats`: one plain-ink stat,
  "N waiting over a week" (ICU plural; no critical tone).
- `packages/admin/src/views/Hub/components/HubWorkQueue.tsx` (~50): delete `isOverdue`; cards show
  neutral "Pending" with a relative age ("submitted 6 months ago").
- `packages/admin/src/views/Garden/components/OverviewTab.tsx` (~211): Median Review Time shows
  latency in days, or weeks past 14 days (new ICU plural keys replacing
  `app.garden.detail.metric.hoursValue`).
- Tests: a table for `summarizeReviewQueue` in `packages/shared/src/__tests__/utils/`; update
  `__tests__/hooks/admin-ui/header-stats.test.ts`, `__tests__/hooks/garden/useGardenDerivedState.test.ts`,
  `__tests__/modules/local-status-overlay.test.ts`, `packages/admin/src/views/Garden/components/OverviewTab.test.tsx`,
  and `packages/admin/src/views/Garden/garden-domain-ui.test.tsx`.

### 5. Assessment language (D23, DEC-E, D8, D28, DL-047)

Copy (en; es and pt in the same change):

| Where | Today | New |
|---|---|---|
| Step 2 title (`app.admin.assessment.create.stepStrategy.title`) | Strategy Kernel | Challenge & Goals |
| Step 2 helper (`...stepStrategy.description`) | Diagnosis, outcomes, and complexity | The challenge, what you'll measure, and how predictable the work is |
| Step 3 title (`...stepActionsHarvest.title`) | Actions & Harvest | Actions & Reporting Period |
| Field (`...strategyKernel.diagnosisLabel`) | Diagnosis | The challenge |
| Field helper (`...strategyKernel.diagnosisHelp`) | Root-cause analysis of the challenge being addressed. | What problem is this work addressing, and why does it exist? (the diagnosis) |
| Section (`...strategyKernel.smartOutcomesTitle`) | SMART Outcomes | What You'll Measure |
| Section helper (`...smartOutcomesDescription`) | Define measurable targets… | Each target needs a metric and a number (SMART outcomes) |
| Section (`...strategyKernel.cynefinTitle`) | Cynefin Phase | How Predictable Is This Work? |
| Section helper (`...cynefinDescription`) | Classify the complexity of the operating environment. | Pick the closest fit (Cynefin) |
| Section (`...domainAction.actionsTitle`) | Coherent Actions | Which Actions Count |
| Helpers (`...sdgHarvest.reportingStartHelp`, `...EndHelp`) | …harvest window. | …reporting period. |
| Dialog description (`cockpit.assessment.createDescription`) | Capture the context, strategy kernel, and harvest window for a new assessment. | Describe the work, its goals, and the period it covers. |
| Dialog title (`cockpit.assessment.createTitle`) | Submit Assessment | Create Assessment (the final button stays "Submit Assessment") |

- `packages/shared/src/hooks/assessment/useCreateAssessmentForm.ts` (~158): no default domain; the
  schema still requires one, and its error shows after Next.
- `packages/admin/src/components/Assessment/CreateAssessmentSteps/DomainContextStep.tsx` (~54) and
  `StrategyKernelStep.tsx` (~259): when no domain is chosen, use neutral helper text instead of the
  Solar guidance fallback.
- `StrategyKernelStep.tsx` (~329): drop the section title that repeats the step title
  (`...strategyKernel.sectionTitle`) and its description.
- Update the comment in `packages/admin/src/views/Hub/CreateAssessment.tsx` (~38).
- Tests: `packages/admin/src/__tests__/components/AssessmentStrategyKernelStep.test.tsx`,
  `packages/shared/src/__tests__/hooks/assessment/useCreateAssessmentForm.test.ts`.

### 6. Certify polish (D35, D31)

- `AttestationSelector.tsx` (~307): no "Select" badge on unselected cards; keep Selected and
  Bundled.
- `packages/admin/src/views/Hub/components/HubCertificationInspector.tsx`: plain-language copy in
  place of "This bundle is ready for the minting flow. Open the hypercert form…".

## Stories

ReviewForm (reason dialog open, submitting, failed), ConfidenceSelector (required, nothing
chosen), HubWorkQueue (ages, no alarm), OverviewTab (stalled vs needs attention), Create Assessment
step 1 with no domain.

## QA Catalog

Update ADM-012 and every admin case that names Overdue, 72 hours, None confidence, or the old step
titles. Add new IDs from ADM-177 for "rejecting work asks for a reason" and "a stalled queue reads
Critical". Then `node packages/qa/build.mjs`,
`node scripts/quality/check-qa-id-ledger.mjs --base origin/develop`, and
`node scripts/docs/generate.mjs`.

## Design Docs

Codify and flip to `codified`: DL-044 (interaction-patterns § 5, status and counts), DL-047 (the
voice guidance in root `DESIGN.md` or `language.md`), DL-048 (interaction-patterns § 2,
confirmations).

## Validation

```bash
bun run --filter @green-goods/shared test -- src/__tests__/utils/workTitles.test.ts src/__tests__/hooks/admin-ui/header-stats.test.ts src/__tests__/hooks/garden/useGardenDerivedState.test.ts src/__tests__/modules/local-status-overlay.test.ts src/__tests__/hooks/assessment/useCreateAssessmentForm.test.ts
bun run --filter @green-goods/admin test -- src/__tests__/components/ReviewForm.test.tsx src/views/Garden/components/OverviewTab.test.tsx src/views/Garden/garden-domain-ui.test.tsx src/__tests__/components/AssessmentStrategyKernelStep.test.tsx
bun run --filter @green-goods/shared test -- i18n/locale-coverage
bun run --filter @green-goods/shared typecheck
bun run --filter @green-goods/admin typecheck
bun run check --plan -- --intent push
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path shared:src/__tests__/utils/workTitles.test.ts
```

## Rendered Proof

Mock-auth localhost at 1280 and 375: the Hub queue (neutral cards, header count), a review dialog
(title without stamps, Reject reason dialog), Garden Health (stalled vs needs attention, review
time in days), and Create Assessment steps 1 and 2. Label engine and session in the PR.

Recorded 2026-09-25 (engine: Claude Browser pane, Chromium; session: mock-auth localhost,
`?mockAuth=deployer`, admin dev server reading the hosted indexer `e6edffd`, Green Goods Community
Garden):

- Hub queue at 1280 and 375: cards read "Maintenance Activity", "Survival Check", and "Planting
  Event" without their stamps, each a neutral Pending with "submitted 6 months ago"; the header
  reads "5 waiting over a week" in plain ink.
- Review dialog at 1280: titled "Maintenance Activity"; the topline carries only Pending;
  Submitted reads "Mar 19, 2026, 4:57 PM"; Low, Medium, and High with none chosen and the quiet
  "Choose a confidence level to approve." (no warning box). Reject opened Reject Work, targeted
  "Maintenance Activity · 0x68...207", with the typed feedback carried into the reason and the
  three suggestions; nothing was sent.
- Garden Health at 1280 and 375: Critical, "No reviews in 7 days, and 6 works are waiting.",
  Median review time "14 weeks"; activity rows older than a week read their calendar date.
- Create Assessment at 1280: titled Create Assessment with "Describe the work, its goals, and the
  period it covers."; step 1 has no domain chosen and no Solar placeholders, and Next showed
  "Choose a domain" beside the other required fields; step 2 reads "The challenge" with "(the
  diagnosis)", "What You'll Measure", and "How Predictable Is This Work?" with Agroforestry
  examples once that domain was chosen.

## TDD Proof

- RED, each before its change (`bun run --filter @green-goods/<pkg> test -- <file>`):
  `workTitles.test.ts` 7 failed (`toWorkDisplayTitle` missing); `garden-detail.test.ts` 8 failed
  (`summarizeReviewQueue` missing); `local-status-overlay.test.ts` 1 failed (the indexed
  decision's time came back `undefined`); `ReviewForm.test.tsx` 1 failed (Reject sent at once, no
  Reject Work dialog); `ConfidenceSelector.test.tsx` 1 failed (None still offered);
  `useCreateAssessmentForm.test.ts` 1 failed (the default domain was 0, Solar).
- GREEN: the same files pass after each change; see the receipt for the final run.
- After review (RED on the code before each fix): `garden-detail` 1 failed (a partial page proved
  a stall), `AssessmentDomainContextStep` 1 failed (a restored retired domain raised no message),
  `CreateHypercertDialog` 1 failed (stale restored picks blocked Next silently), and the old stamp
  pattern took 1,258 ms on 50,000 spaces against the new test's 250 ms bound. Second round: `useWorks`
  2 failed (no signal that an approval read failed). Third round: the cached-status `useWorks` test failed (a failed read of a cached row left the flag false), `AssessmentDomainContextStep` 2 failed (a single-domain garden came preselected; an undocumented restored domain stayed), and `CreateHypercertDialog` 1 failed (Next stayed pressable while attestations loaded). Fourth round: `useWorkApproval` 2 and `useBatchWorkApproval` 1 failed (a decision's feedback never reached the local overlay), `store-transitions` 1 failed (a new domain kept the old one's actions and metrics), `wizard-transitions` 1 failed (choosing only a domain read as pristine), and `AssessmentDomainContextStep` 1 failed (clearing an undocumented domain kept its actions). Fifth round: `useCreateAssessmentController` 1 failed (a restored undocumented domain was submitted from the last step), and `useWorkApproval` 1 and `useBatchWorkApproval` 1 failed (an empty new feedback left an older reason on the work). Sixth round: `useGardenDetailData.fallback` 2 failed (a failed or paused refresh still counted as complete queue evidence). Seventh round: client `WorkViewSection` 1 failed (the work detail never showed the review's feedback), `CreateHypercertDialog` 1 failed (Next stayed disabled over loaded attestations after a failed refresh), and `ConfidenceSelector` 1 failed (the first arrow chose Low instead of moving to Medium). Eighth round: `local-status-overlay` 1 failed (a lapsed local rejection kept its feedback), client `WorkViewSection` 1 failed (feedback showed on pending work), `useWorks` 1 and `useGardenDetailData.fallback` 1 failed (a restored read counted as complete), and `useCreateAssessmentController` 1 failed (Submit went ahead without the garden's domains). Ninth round: `useCreateAssessmentController` 1 failed (a retired domain on the last step was left for schema validation to reject).
- Proof limit: none. Tests that only moved with the new behaviour (header stats, derived state,
  Overview, Hub card, Hub detail, attestation selector, assessment steps and dialog, hypercert
  wizard) are updated or added beside them.

## Validation Receipt

- Tested implementation commit SHA: `114e7d93beb3add5444188dae3f5b663d011de8d` (after every review round so far; the receipts on
  `ecfccdda7`, `ff2bb49a5`, `97f880177`, `6298d269a`, `ae95cd08a`, `3be7b872a`, `325cc3af3`, `d7794223e`, and `bdb0a6151` are superseded)
- Run at (UTC): push gate `2026-09-25T11:49:43Z` to `2026-09-25T11:52:59Z`
- Exact command(s): `PATH="$PWD/node_modules/.bin:$PATH" node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path shared:src/__tests__/hooks/work/useWorks.test.ts`
- Result: push gate exit 0 on the critical plan, 28 automated checks passed (shared 5790, client 1399, admin 989, and agent 316 tests passing, with docs-authority, staged-modules, source-structure, design-guardrails, ontology, agent-guidance, qa-id-ledger, supply-chain, story-quality, and agent-tools-test);
  browser-proof stays the manual proof recorded under Rendered Proof
- Validated paths: `packages/shared/src`, `packages/admin/src`, `packages/client/src`, `packages/qa/locales`, `scripts/data`, `scripts/quality`, `docs/docs`, `.claude/skills`, `DESIGN.md`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/shared/src packages/admin/src packages/client/src packages/qa/locales scripts/data scripts/quality docs/docs .claude/skills DESIGN.md` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code 114e7d93beb3add5444188dae3f5b663d011de8d..HEAD -- packages/shared/src packages/admin/src packages/client/src packages/qa/locales scripts/data scripts/quality docs/docs .claude/skills DESIGN.md` → empty (exit 0); the receipt commit changes only `.plans/`
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- packages/shared/src packages/admin/src packages/client/src packages/qa/locales scripts/data scripts/quality docs/docs .claude/skills DESIGN.md` → empty

## Risks / Blockers

- Critical gates flake under load (10-second timeouts in unrelated files); rerun the file alone
  before suspecting the diff.
- The client review sheet changes with the shared selector.
- Rows restored from cache lack `reviewedAt` until the next indexer read; the stall rule treats
  them as unknown, not stalled.
