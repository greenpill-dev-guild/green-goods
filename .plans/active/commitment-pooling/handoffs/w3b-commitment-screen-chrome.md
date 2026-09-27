# Pooling Rehearsal Follow-ups — W3-B The commitment screen keeps its chrome

## Lane

- Execution sub-lane: `w3b_commitment_screen_chrome` (machine lane `ui`)
- Branch: `fix/commitment-screen-chrome`, from a fresh `origin/develop` after W3-H merges (§ 1 row 49)
- Depends on: `w3h_host_claim_context`
- Merge: after Afo's yes on rendered before-and-after pairs at 1280 and 375, light and dark
  (§ 1 row 47), then `--merge` on green CI and resolved bot threads
- Class: sensitive (client journeys)
- Linear child: `status.json` → `execution_sub_lanes.w3b_commitment_screen_chrome.linear.issue`

## Scope

N39, N40, N9, N10, N5 (the app row) and N23. The admin half of N5 lands in W3-C.

## What the code does today

- `packages/client/src/views/Home/Garden/Commitment/CommitmentDetailShell.tsx:28-41` lays the
  screen out as a flex column, `h-full min-h-0`, with `TopNav` static and the bar as the last child
  in normal flow, so both pin only when every ancestor hands down a bounded height. The garden route
  hides its own header on commitment routes (`Home/Garden/index.tsx:312-314`) and wraps the outlet
  in `h-full min-h-0 overflow-hidden` inside the app shell's scroll region. The work view fixes its
  chrome instead: `TopNav overlay` with `pt-20` content (`Home/Garden/Work.tsx:392-393`) and a
  `fixed left-0 right-0 bottom-0` bar with a reserved spacer (`Work.tsx:350-351`). `TopNav`
  is `relative` unless `overlay` (`components/Navigation/TopNav.tsx:176-178`). `Proof/ProofShell.tsx`
  and `Compose/ComposeShell.tsx` share the static frame.
- `Pool/PoolLifecycleNotice.tsx` draws two circle-check rows in the not-ready state that only a
  steward can act on, from the admin.
- `Pool/GardenPool.tsx` always renders `CycleRail` snap slides, even for one cycle, and prints the
  fixed `app.pool.charter` sentence under it, the same for every pool.
- `components/Features/Commitments/CommitmentRow.tsx` maps Offered and Requested to the same chip
  tone on purpose and prints the direction as a small grey word; the 3px direction edge from
  `uiux-spec.md` (2026-08-14 pool-tab polish, item e) was never built. Its "Needs you" and
  "Didn't send" markers are 10px uppercase.

## Steps

1. **Fixed chrome (N39, N40).** The three shells pass `overlay` to `TopNav`, pad their content
   `pt-20`, and render the bar `fixed left-0 right-0 bottom-0 z-sticky` in the work view's wrapper
   grammar with a spacer that reserves its height (`h-[calc(112px+env(safe-area-inset-bottom))]`
   for one button, 180px for two). Drop the `h-full min-h-0` dependency. The `CommitmentDetailState`
   casts keep the same frame.
2. **The member's readiness notice (N9).** In the not-ready cast a member sees one sentence,
   `app.pool.notReady.member` ("Your steward is setting this pool up."). A steward of the garden
   keeps the two rows as facts, with a closing line that the setup happens in the steward dashboard.
3. **One season, full width (N10).** One cycle renders as the same card at full width with no snap
   track; two or more render the rail. The fixed sentence becomes an info `IconButton` on the season
   card that opens an `AppSheet` with the pool's own agreement from `usePoolCharter`, falling back to
   the generic sentence only when the pool has no charter. This closes the generic-charter gap the
   rehearsal script already names.
4. **The direction edge (N5, app row).** `CommitmentRow` draws a 3px inset-start edge: offers in the
   primary green tone, requests in the sky tone from `pwaStatusStyles`; chips unchanged; the
   direction word stays for screen readers. Codify the rule as the next design-log row and reference
   it from the component.
5. **Markers (N23).** "Needs you" and "Didn't send" move to the 12px label size, sentence case,
   colour kept.
6. **Copy.** New keys in `en`, `es` and `pt`.

## Tests (RED first)

- A shell test asserting the bar and top nav are fixed (class and structure), for the detail, proof
  and compose shells.
- `PoolLifecycleNotice` test: member sees one sentence, steward sees the facts.
- `GardenPool` test: one cycle renders full width without the rail; two cycles render the rail.
- `CommitmentRow` test and stories: the edge per direction, the marker size.

## Rendered proof

Storybook at 375 and 1280, light and dark, before and after, for the commitment screen, the pool
tab with one season and with two, the readiness notice as member and as steward, and the row edge.
Mock-auth localhost for the fixed chrome on a real scroll. Send the pairs to Afo before merge.

## Validation

```bash
bun run --filter @green-goods/client test -- src/__tests__/views/GardenCommitment.test.tsx src/__tests__/views/GardenPool.test.tsx
bun run --cwd packages/client typecheck -- --scope full
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path client:src/__tests__/views/GardenCommitment.test.tsx
```

Add the pool tab and row test paths the implementation touches.

## Out of scope

The admin rows and tray (W3-C), membership and the queued act (W3-A), and any change to what the
pool tab lists.

## Implementation notes (2026-09-27)

- `FixedBar` (`views/Home/Garden/FixedBar.tsx`) fixes a bar in the work view's wrapper grammar and
  sizes its spacer from the bar's measured height (`useElementHeight`), holding the one-button
  height until the first measure. The measure replaces the handoff's 112px or 180px choice, because
  the proof and compose bars grow with a second row or a reason line. The three shells pass
  `overlay` to `TopNav`, pad their body `pt-20`, and render the bar through it.
- `PoolLifecycleNotice` takes `isSteward` from the pool controller's new `stewardsPool`.
- `CycleRail` renders one cycle as a full-width card and two or more as the rail. The info button
  is a sibling of each card, since a card is itself a button. The pool tab keeps the general
  sentence on the page only when there is no season to hang the agreement on, and the sheet says so
  when a pool's charter cannot be read.
- `CommitmentRow` keeps its visible direction word where the chip does not already say it, so the
  new edge never carries direction by colour alone (DL-052, codified in
  `.claude/skills/design/interaction-patterns.md` § 5).

## RED and GREEN evidence

RED at `7fdc87f78` with the new and changed tests, in `packages/client`,
`bun run test -- src/__tests__/views/GardenPool.test.tsx src/__tests__/views/CommitmentShells.test.tsx`:
eight failed, each as the gap predicts. The three shells' top nav and bar were not fixed, the
steward's checklist had no setup line, a member still read the checklist, one season still rode the
rail, the season card had no charter button, and the row had no direction edge and a 10px uppercase
marker. GREEN at `401547ade`: the pool tab, the shells, and the commitment, proof and compose view
suites pass.

## Unblock evidence

The lane closes when RED and GREEN are recorded, Afo approves the pairs, the PR merges, the sub-lane
is `completed`, and the Linear child is Done. As of 2026-09-27, RED and GREEN are recorded above, the
Storybook pairs are with Afo, and the PR is open.

## Validation Receipt

- Tested implementation commit SHA: `401547ade` (on `fix/commitment-screen-chrome`)
- Run at (UTC): `2026-09-27T07:52:40Z` to `2026-09-27T07:52:48Z`, after the checks below ran on the same tree before its commit
- Exact command(s): in `packages/client`, `bun run test -- src/__tests__/views/GardenPool.test.tsx src/__tests__/views/CommitmentShells.test.tsx src/__tests__/views/GardenCommitment.test.tsx src/__tests__/views/ProofComposer.test.tsx src/__tests__/views/ComposeCommitment.test.tsx` and `bun run typecheck -- --scope tests`. Before the commit, on the same tree: `bun run --cwd packages/shared test -- src/__tests__/hooks/client-ui`, `bun run --cwd packages/client typecheck`, `bun run --cwd packages/shared typecheck -- --scope full`, `bun --bun run oxlint packages/client/src packages/shared/src --deny-warnings`, `bun run check --only react-patterns`, `SOURCE_STRUCTURE_BASE_REF=origin/develop node scripts/quality/check-source-structure.js` and `node scripts/quality/check-guidance-links.mjs`
- Result: client 101 passed in 5 files; the client test typecheck exit 0; before the commit, shared client-ui hooks passed, the client and shared typechecks, oxlint and the controls check exit 0, and source structure and guidance links passed. The local pre-push gate was skipped at the owner's direction; PR CI runs the full suites.
- Validated paths: the 18 non-plan paths `401547ade` changes against `7fdc87f78`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- <the validated paths>` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code 401547ade -- <the validated paths>` → exit 0 before this handoff commit, which changes only `.plans`
- Rendered proof: Storybook, headless Chromium, built from `401547ade` (after) and from develop at `956a85121`, the same tree as `7fdc87f78` (before), at 375 and 1280 in light and dark: the row with its marker (`client-commitments-commitmentrow--provider-needs-you`, `--send-failed`, and the new `--request`), and the cycle rail with one cycle and with two (`client-commitments-cyclerail--unnamed-cycle`, `--season-and-campaign`, and the new `--one-season`). Sent to Afo as contact sheets. The readiness notice and the fixed chrome on a real scroll have no story; mock-auth localhost proof of those stays pending.
