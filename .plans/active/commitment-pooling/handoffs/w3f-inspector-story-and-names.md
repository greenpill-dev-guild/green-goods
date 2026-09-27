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

- **The Detail story needed no reseed.** At develop (`c17a03b46`) its seeds match the keys the
  dialog controller reads (`commitmentPoolingKeys.commitment` and `.activity` with the same
  filters), and a static Storybook build renders the whole record, "Proof added" included. The
  not-found cast did not reproduce on a fresh build. The story now carries the `storybook-ci` tag,
  so its play test runs in the story gate. The gate's browser runner cannot load modules through a
  worktree with linked dependencies, so PR CI's Storybook job is the gate's first run of it.
- **Names, not addresses.** `CommitmentPeople` (`views/Garden/Pool`) holds the pool row's rule, the
  provider for the receiver whichever side created the record, each named through the shared
  `AddressDisplay`. The pool row and the inspector's summary line both use it, and the summary's
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

- Tested implementation commit SHA: `defbcde8e` (on `fix/inspector-story-and-names`)
- Run at (UTC): `2026-09-27T09:12Z` to `2026-09-27T09:28:04Z`, on the same tree just before its commit
- Exact command(s): in `packages/admin`, `bun run test --` over `CommitmentPeople`, `HubConfirm`, `CommitmentDialog`, `GardenPool` and `HubDetail`; `bun run --cwd packages/admin typecheck` and `-- --scope tests`; `bun --bun run oxlint packages/admin/src/views/Garden/Pool packages/admin/src/views/Hub --deny-warnings`; `bun run check --only design-tokens`; `SOURCE_STRUCTURE_BASE_REF=origin/develop node scripts/quality/check-source-structure.js`; `bun run --filter @green-goods/shared build-storybook` before and after the change
- Result: 75 tests in five files passed, and the two name suites (14 tests) passed again after the Hub row's address guard; typechecks, oxlint, the design-token check and source structure passed. The story gate's browser runner cannot load modules through this worktree's linked dependencies, so the Detail story's play test first runs in PR CI's Storybook job. The local pre-push gate was skipped at the owner's direction; PR CI runs the full suites.
- Validated paths: the non-plan paths `defbcde8e` changes against `c17a03b46`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages` → empty
- Evidence-only diff command and result (if applicable): this handoff commit changes only plan files
- Rendered proof: Storybook, headless Chromium, at 1280 in light and dark, before (a static build of develop at `c17a03b46`) and after (a static build of this branch made before a type-only guard on the Hub row's address, which renders the same): `admin-pool-commitmentdialogpanel--detail`, `admin-pool-commitmentsummary--proof-in`, `admin-pool-commitmenttimeline--recorded`, `admin-hub-hubconfirmqueue--queue`, and `admin-pool-poolcommitmentscard--open`, which is unchanged. Sent to Afo as contact sheets.
