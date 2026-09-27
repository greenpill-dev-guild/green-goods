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

## Unblock evidence

RED and GREEN recorded; the pairs approved by Afo; PR merged; sub-lane `completed`; Linear child
Done.

## Validation Receipt

Pending.
