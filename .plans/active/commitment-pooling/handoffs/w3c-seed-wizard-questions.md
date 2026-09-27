# Pooling Rehearsal Follow-ups — W3-C The seed wizard asks what a steward can answer

## Lane

- Execution sub-lane: `w3c_seed_wizard_questions` (machine lane `ui`)
- Branch: `fix/seed-wizard-questions`, from a fresh `origin/develop` after W3-B merges
- Depends on: `w3b_commitment_screen_chrome`
- Merge: after Afo's yes on rendered before-and-after pairs at 1280 and 375, light and dark
  (§ 1 row 47), then `--merge` on green CI and resolved bot threads
- Class: sensitive (admin workflow state)
- Linear child: `status.json` → `execution_sub_lanes.w3c_seed_wizard_questions.linear.issue`

## Scope

N8, N4, N12, N6, N11, N5 (admin rows and the tray) and N30. The What step (N3) waits for W4-1.

## What the code does today

- `packages/admin/src/views/Garden/Pool/Seed/SeedRewardSection.tsx` is a collapsed details block
  titled "Advanced: declared reward" on the Proof step; `SeedStepReview.tsx` repeats the label.
- `Seed/seedStepModel.ts` (`STEP_FIELDS.howMuch`) requires unit, target and due days for every
  kind; the member composer sets the unit to hours itself for garden work and says so.
- The wizard's unit field has only a placeholder; the app composer offers unit, count and day chips
  with a free field under each.
- `components/Layout/ActionFlowStepper.tsx` marks a step complete only when the current step number
  is greater than it; `SetupFlow/index.tsx` and `Seed/index.tsx` never move past the last step when
  the run completes, so the last step never shows a check.
- `components/AdminTextField.tsx` draws the filled variant's active indicator as a sibling below
  the container (one pixel at rest, two on focus): measured 101px at rest, 102px focused, and the
  element below moves.
- `PoolCommitmentsCard.tsx` rows and `Seed/SeedTrayList.tsx` draw no direction edge.
- `SetupFlow/SetupFlowFooter.tsx` and `Seed/SeedFlowFooter.tsx` disable Next with no reason line;
  the app composer's bar says why.

## Steps

1. **A reward question (N8).** The Proof step asks "Does this come with a reward?" with No and Yes;
   Yes reveals the existing rail choices. The review row is named Reward.
2. **Garden work in hours (N4).** For the garden-work kind the unit is fixed to hours and shown as
   the fact "Counted in hours"; the step asks only how many and the due days. The step model stops
   requiring a unit for that kind; the payload still carries `hours`.
3. **Chips (N12).** Unit, count and day suggestions on `AdminFilterChip` or `AdminChoiceGroup`,
   the same lists as the app composer (hours, sessions, rides, meals, repairs; common counts;
   common day spans), with the free field kept.
4. **The rail ends done (N6).** When a setup or seeding run completes, the flow hands the stepper a
   current step one past the end (or a `complete` flag) so every step shows a check, in
   `SetupFlow/index.tsx` and `Seed/index.tsx`.
5. **A field that keeps its height (N11).** Draw the active indicator inside the container,
   absolutely positioned at its bottom edge, or reserve two pixels at rest, in
   `AdminTextField.tsx` and its rules in `admin-m3-components.css`. Measure before and after.
6. **The direction edge (N5, admin).** The same 3px inset-start edge as the app row, on the pool
   rows and the tray rows, through `poolPresentation.ts`; chips unchanged.
7. **A reason under Next (N30).** The setup and seed footers print one line saying why Next is off,
   the way the app composer's bar does.
8. **Copy.** New keys in `en`, `es` and `pt`; Title Case acts; no `--m3-*` raw colours or raw type
   sizes (the token ratchet from #910 fails them).

## Tests (RED first)

- `seedStepModel` table test: garden work needs no unit and defaults to hours; the other kinds
  still need one; the reward question maps to the rail choices.
- `ActionFlowStepper` test: the done state marks every step complete.
- `AdminTextField` test asserting the indicator sits inside the container; the pixel measurement
  goes in the PR body from a rendered story.
- Footer tests: a disabled Next carries its reason line.
- Stories for each seed and setup step at 1280 and 375.

## Rendered proof

Storybook, before and after, 1280 and 375, light and dark, for the Proof step, the How Much step
for garden work and for a service, the stepper's done state, the settings dialog's field on focus,
and a pool row of each direction. Send the pairs to Afo before merge.

## Validation

```bash
bun run --filter @green-goods/admin test -- src/views/Garden/Pool/Seed
bun run --cwd packages/admin typecheck -- --scope full
bun run check --only design-tokens
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path admin:src/views/Garden/Pool/Seed
```

Adjust the test paths to the files the implementation touches.

## Out of scope

The What step's taxonomy (W4-1), the action rail (W4-2), any change to the writes the setup
sequence sends, and the app composer.

## Implementation notes (2026-09-27)

- The reward question is read from the rail the draft holds (`rewardAnswerOf`), and an answer sets
  it (`railForRewardAnswer`): No means none, Yes keeps a chosen rail or starts on the external one,
  which every garden can use. The rail choices under Yes drop None.
- Choosing garden work sets the unit to hours in `SeedStepWhat`, as the member composer does, and
  `stepFieldsFor` stops the How Much step asking it; the schema and the payload are unchanged.
- The chip lists moved from the member composer into
  `packages/shared/src/modules/commitment-pooling/metadata.ts`, beside the unit's limit, and both
  composers read them there. Each chip group is labelled "Suggestions for" its field.
- `ActionFlowStepper` and `ActionFlowShell` take `complete`. The setup flow passes its finished run,
  and the seed flow a pass with no row left unsent. A done run offers no jump back.
- The filled field's indicator now sits inside its container, so its height no longer changes on
  focus. `AdminSelect` and `AdminTextArea` share that anatomy.
- `directionEdgeClass` in `poolPresentation.ts` gives pool and tray rows the app row's edge.
- The setup model's `stepBlockedReason` names the first thing a step still needs, and
  `isStepValid` follows from it; offline says to connect. The seed model's `seedBlockedReason`
  names why Seed is off. Both footers print the reason where their progress sits.

## RED and GREEN evidence

RED at `c17a03b46` with the new and changed tests, in `packages/admin`, `bun run test --` over
`seedStepModel`, `SeedStepHowMuch`, `ActionFlowStepper`, `AdminTextField`, the new `FlowFooters`
and `poolPresentation` tests: ten failed, each as the gap predicts. The step model had no unit rule
for garden work, no reward mapping and no seed reason; How Much had no chips and no hours fact; the
stepper had no done state; the indicator sat outside the container; neither footer said why; the
setup model had no reasons; and the rows had no edge. GREEN at `5070ad612`: those suites and the
seed and setup flow suites pass. The seed flow's tests now answer the reward question before
reaching a rail.

## Unblock evidence

The lane closes when RED and GREEN are recorded, Afo approves the pairs, the PR merges, the sub-lane
is `completed`, and the Linear child is Done. As of 2026-09-27 all of these hold: Afo approved the
pairs, #927 merged as `127ae1376`, the sub-lane is `completed`, and PRD-992 is Done. The focused
field was measured at 1280 from static Storybook builds in headless Chromium: before the change the
filled field's container grew from 41px to 42px on focus, and on develop it stays at 40px, so nothing
below it moves.

## Validation Receipt

- Tested implementation commit SHA: `5070ad612` (on `fix/seed-wizard-questions`)
- Run at (UTC): `2026-09-27T08:22:49Z` to `2026-09-27T08:26:47Z`, with the targeted suites, typechecks and checks run on the same tree just before its commit
- Exact command(s): in `packages/admin`, `bun run test`, then `bun run test -- src/__tests__/components/CreateAssessmentDialog.test.tsx src/__tests__/views/CommitmentDialog.test.tsx`; before the commit, `bun run test --` over the eight seed, setup, stepper, field, footer and row suites, `bun run --cwd packages/admin typecheck` and `-- --scope tests`, `bun run --cwd packages/client typecheck`, `bun run --cwd packages/shared typecheck -- --scope full`, `bun --bun run oxlint packages/admin/src packages/client/src packages/shared/src --deny-warnings`, `bun run check --only design-tokens`, `bun run check --only react-patterns` and `SOURCE_STRUCTURE_BASE_REF=origin/develop node scripts/quality/check-source-structure.js`
- Result: admin 1,058 passed of 1,061 in the full run; the three that timed out at 10 seconds under a load average near 46 passed alone (35 tests in their two files). `SubmitWork.submit.test.tsx` cannot load its module mocks in a worktree with linked dependencies, W3-B's as well, and passes on an installed tree (19 tests); PR CI runs it. The eight targeted suites passed 93 tests; every typecheck, oxlint, the design-token and controls checks, and source structure passed. The local pre-push gate was skipped at the owner's direction; PR CI runs the full suites.
- Validated paths: the non-plan paths `5070ad612` changes against `c17a03b46`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- <the validated paths>` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code 5070ad612 -- <the validated paths>` → exit 0 before the story commit, which changes only stories, and this handoff commit
- Rendered proof: Storybook, headless Chromium, built from this branch (after) and from develop at `956a85121`, the same tree as `7fdc87f78`, whose admin is unchanged since (before), at 375 and 1280 in light and dark: `admin-pool-seedstepproof--ordinary-rule`, `admin-pool-seedrewardsection--no-reward` and `--external-payout`, `admin-pool-seedstephowmuch--kept-by-proof` and `--garden-work`, `admin-shell-actionflowstepper--completed` and the new `--run-done`, `admin-primitives-admintextfield--state-catalog`, `admin-pool-poolcommitmentscard--open`, `admin-pool-seedtraylist--three-rows-one-not-sent`, `admin-pool-setupflowfooter--incomplete`, and the new `admin-pool-seedflowfooter--pool-not-open`. Sent to Afo as contact sheets. Focus measurement, 2026-09-27 at 10:45Z: headless Chromium (Playwright) at 1280 × 900 with outside network refused, on `admin-primitives-admintextfield--filled`, reading the field container's height before and after focusing its input. In a static build of develop at `c17a03b46`, before this lane, the container grew from 41px to 42px; in a static build of `8f9d4759f`, whose `AdminTextField.tsx` matches `127ae1376`, it stays at 40px.
