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

## Unblock evidence

RED and GREEN recorded; the pairs approved by Afo; PR merged; sub-lane `completed`; Linear child
Done.

## Validation Receipt

Pending.
