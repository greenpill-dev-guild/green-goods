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

## Implementation notes (2026-09-27)

- **The Detail story needed its cycle.** Its commitment and activity seeds match the keys the
  dialog controller reads, so a static build with network access renders the whole record. The
  story gate's browser refuses the network, though. The Detail commitment's cycle (12) was never
  seeded, and the controller counts a failed cycle read as a failed record, so the gate saw
  "Proof added" and then the error cast. Seeding the cycle fixes it. A static build with every
  outside request refused now renders the whole record without calling the indexer. The story
  carries the `storybook-ci` tag, so its play test runs in the story gate.
- **Names, not addresses.** `CommitmentPeople` (`views/Garden/Pool`) holds the pool row's rule, the
  provider for the receiver whichever side created the record, each named through the shared
  `AddressDisplay`. The provider is the lead provider once one is set: on a request taken up as a
  garden claim, the counterparty is the garden's account. A long actor name in the timeline
  truncates, whole in its title (review round 2). The pool row and the inspector's summary line both use it, and the summary's
  arrow is gone. The timeline names each actor and the Hub confirm row names who
  committed through `AddressDisplay`.
- **Composite stories move to W4-3.** The member commitment screen and the app pool tab stories
  did not fit before the cut.

## RED and GREEN evidence

RED at `c17a03b46` with the new tests: `CommitmentPeople.test.tsx` failed to import the new module,
and the Hub confirm test found no name for the lead provider. GREEN: the name tests and the
inspector, pool and Hub suites pass (75 tests in five files).

## Unblock evidence

The lane closes when RED and GREEN are recorded, the PR merges, the sub-lane is `completed`, the
Linear child is Done, and the composite stories' fate is written here (above: W4-3).

## Validation Receipt

- Tested implementation commit SHA: `8f9d4759f` (on `fix/inspector-story-and-names`)
- Run at (UTC): `2026-09-27T10:36:27Z` to `2026-09-27T10:43Z`, on `8f9d4759f` itself
- Exact command(s): in `packages/admin`, `bun run test --` over `CommitmentPeople`, `HubConfirm`, `CommitmentDialog` and `GardenPool`, then `CommitmentDialog` and `GardenPool` alone; `bun run --cwd packages/admin typecheck` and `-- --scope tests`; `bun --bun run oxlint packages/admin/src/views/Garden/Pool packages/admin/src/views/Hub --deny-warnings`; `bun run check --only design-tokens`; `bun run --filter @green-goods/shared check:stories`; `SOURCE_STRUCTURE_BASE_REF=origin/develop node scripts/quality/check-source-structure.js`; `bun run --filter @green-goods/shared build-storybook`, then the Detail story rendered from that build in headless Chromium with every non-local request refused
- Result: in the four-file run, two tests timed out at 10 seconds under a load average near 250. Both files passed alone (51 tests), and the name and Hub suites passed in the same run. Typechecks, oxlint, the design-token check, the story contract and source structure passed. Offline, the Detail story renders the whole record with "Proof added" and no indexer call. The story gate's own vitest browser runner cannot load modules through this worktree's linked dependencies, so PR CI's Storybook job runs it. The local pre-push gate was skipped at the owner's direction; PR CI runs the full suites.
- Validated paths: the non-plan paths `8f9d4759f` changes against the develop it merged (`303d114fd`)
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages` → empty
- Evidence-only diff command and result (if applicable): this handoff commit changes only plan files
- Rendered proof: Storybook, headless Chromium, at 1280 in light and dark, before (develop at `c17a03b46`) and after (this branch before the lead-provider change, which the `GardenClaim` story now shows): the inspector's Detail story, the summary line, the timeline, the Hub confirm queue, and the unchanged pool row. Sent to Afo as contact sheets.
