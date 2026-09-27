# Pooling Rehearsal Follow-ups — W3-F The inspector renders; people have names

## Lane

- Execution sub-lane: `w3f_inspector_story_and_names` (machine lane `ui`)
- Branch: `fix/inspector-story-and-names`, from a fresh `origin/develop` after W3-E merges
- Depends on: `w3e_account_sessions`
- Merge: `--merge` on green CI and resolved bot threads
- Class: routine (stories and presentation), unless the Hub row change touches its query
- Linear child: `status.json` → `execution_sub_lanes.w3f_inspector_story_and_names.linear.issue`

## Scope

N26 and N17. The client composite stories named in N26 land here if time allows before the cut;
otherwise they move to W4-3 and this handoff says so.

## What the code does today

- The commitment inspector's `Detail` story (`packages/admin/src/views/Garden/Pool/CommitmentDialog/`)
  renders the not-found cast on a running and on a fresh Storybook: its seeds no longer match the
  query keys the controller reads, and its play test expects the timeline's "Proof added" line.
- `CommitmentSummary.tsx` prints the creator and counterparty as truncated addresses joined by an
  arrow glyph; `CommitmentTimeline.tsx` prints each actor the same way; the Hub confirm queue's row
  subtitle is a truncated address. Every other pooling row names people through the shared address
  display; the § 4b audit's A9 fixed claimants only.
- No story renders the member's commitment screen or the app pool tab end to end; only their parts
  have stories.

## Steps

1. **Reseed the Detail story** against the controller's current keys (the seeds in
   `poolStoryControllers.ts` and `poolStoryCommitments.ts`) and make its play test part of the story
   gate, so the cast that closes a commitment for good can be reviewed rendered.
2. **Names, not addresses.** The summary line, the timeline and the Hub confirm row use the shared
   address display, and the summary line takes the pool row's grammar, "{provider} for {receiver}",
   in place of the arrow.
3. **Composite stories, time permitting.** One story each for the member commitment screen
   (`Client/Garden/Commitment`) and the app pool tab (`Client/Garden/Pool`) on the demo fixtures
   that already exist, seeded through their query keys.

## Tests (RED first)

- The Detail story's play test, red on the current seeds and green after.
- Snapshot or query tests for the three renamed places.

## Rendered proof

Storybook captures at 1280 of the inspector's Detail cast and the Hub confirm row, and at 375 of
the composite stories if they land. Label as Storybook.

## Validation

```bash
bun run --filter @green-goods/admin test -- src/views/Garden/Pool/CommitmentDialog src/views/Hub
bun run --cwd packages/admin typecheck -- --scope full
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path admin:src/views/Garden/Pool/CommitmentDialog
```

Run the story gate command the shared package declares for play tests.

## Out of scope

Copy and polish beyond the three places named (W4-3), and any change to who may confirm.

## Unblock evidence

RED and GREEN recorded; PR merged; sub-lane `completed`; Linear child Done; the composite stories'
fate written here.

## Validation Receipt

Pending.
