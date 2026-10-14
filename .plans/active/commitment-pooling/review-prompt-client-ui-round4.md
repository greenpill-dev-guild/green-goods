# Review prompt — commitment pooling client UI, round 4 (PRD-724)

Paste this whole file as the opening message of a fresh session. It is self-contained.

> **Provenance.** Written by the session that wrote the code and all three rounds of fixes. Round 1
> corrected the author on seven things; round 2 retracted round 1's headline and found four defects
> *in its fixes*; round 3 found that round 2's fix did not work. Every round has found something in
> the previous round's repair. Assume this document is wrong somewhere. If a number disagrees with
> the tree, the tree wins.

---

## What this is

`feature/commitment-pooling-client-ui`, 22 commits from `develop` at `0b3fc16ba`.
89 files, +8,506/−694. Four member surfaces — W5 sheet, W1 pool tab, W2 detail, W3 composer — and
the state layer beneath them.

Three adversarial rounds have run. Their prompts are `review-prompt-client-ui.md`, `-round2.md` and
`-round3.md`. **Read what each found before reporting anything.**

Fix commits since round 3: `f5e86ae37`.

Run `/review` on the branch, then apply `design/review-checklist.md` to the four client views.

---

## The pattern worth attacking

One class of bug has now appeared twice, in the same file, a round apart:

- **Round 1** — the published CID was held in memory only; `markJobFailed` re-reads from storage, so
  it was discarded.
- **Round 3** — the fix for round 2's unbounded wait wrote `metadataAttempts` through a fresh object
  without mutating `job.meta`; `processJob` then wrote the job it still held over the top, so the
  counter was erased on every attempt and the ceiling could never fire.

Both are the same mistake: **something changed in memory, persisted separately, and then clobbered
by a caller writing a stale object.** `job-executors.ts` and `job-queue/index.ts` pass a mutable
`Job` between them with no rule about who owns it.

Round 3's fix mutates `job.meta` the way the success path mutates `payload`. That works. **Go
looking for the third instance** — every place either file spreads `{...job}` or `{...job.meta}` and
writes, and every value expected to survive between an executor return and the next attempt.

---

## The seam that hid it, and still has no test

`useCommitmentQueueState` is now load-bearing for two things: whether the action bar offers an act
at all, and the failed-send count on W5. **It has no test.** The only references to it in any test
file are mocks — `GardenCommitment.test.tsx:86` stubs it, so the tests written to protect the
`hasPendingJob` branch cannot see whether the real hook produces or clears that set.

The same is true of `useCommitmentJobs` (the entire write path) and `useCommitmentMetadata`. All
three are mocked everywhere and tested nowhere.

Round 3 rewrote `useCommitmentQueueState` onto a shared react-query key so Home, the sheet and the
detail screen stop scanning the queue separately. Worth checking directly:

- `staleTime: Infinity` with invalidation on `job:added` / `job:completed` / `job:failed`. Is any
  queue mutation missing from that list — does a job going terminal always emit one of the three?
- `isUnavailable` is `Boolean(viewer) && query.isError`. On a first failed read the data is
  `undefined`, so `pendingCommitmentIds` is empty and `failedCount` is 0. Does any consumer act on
  `isUnavailable`, or does a failed read still read as "nothing queued" at the surfaces?
- The query key is `["greengoods","commitment-pooling","queue", viewer]`. Nothing invalidates it on
  sign-out.

---

## Other places to look

### The terminal-status split

A gateway outage now returns `status: "unavailable"` and lands as `unavailable:metadata-unavailable`
rather than `identity_conflict:…`. Both terminal paths were collapsed into one branch in
`job-queue/index.ts` to stay under that file's frozen line ceiling. Check the collapse did not
change behaviour for real identity conflicts, and that nothing downstream matches on the old prefix.

### The confirmers query

`getCommitments` now selects `{ confirmers: { _contains: [$account] } }`. The operator was verified
against the live indexer, which returns an empty set because there are no commitments. **It has
never matched a row.** Check the semantics: `confirmers` is `[String!]!` and addresses are stored
lowercased — does `_contains` do what a case-mismatched viewer address would need?

### What the indexer now makes checkable

`http://localhost:3006/v1/graphql` serves 18 gardens and 18 CommitmentPools, one per garden, all
`NOT_READY`, **zero commitments**. The availability ledger still says `deployed-not-available` on
42161, so every pooling read stays disabled and no garden shows a Pool tab regardless of pool state.

Round 3 corrected an earlier prompt on this: `hasPool` keys on pool *existence*, not state, so the
tab rule and the lifecycle rule never meet. `PoolLifecycleNotice` implements four states and is
unreachable today for exactly one reason — the gate. **Do not flip the ontology to make screens
render.**

### Still no rendered coverage

`CycleRail`, `PoolLifecycleNotice`, `CommitmentPeople`, `CommitmentProgress`, `WithdrawDialog`,
`CommitmentActionBar` — none is mounted by any test. Nor are `grouping.ts` or `presentation.ts`
imported by one, though `grouping.ts` was changed this round to key on the garden address after two
gardens sharing a name were found to merge.

---

## Do not spend the budget here

- **The findings of rounds 1–3** are in their prompts with what changed. Re-report one only if the
  fix is wrong.
- **`ACCEPTED` is unreachable** as a `derivedState`. Round 2 verified all three derivation paths.
- **`PARTIALLY_APPROVED` offers `addProof` where the reference draws no bar.** Recorded in `acts.ts`
  with its reasoning.
- **`ELECTIVE` and the seat rung order** were both verified correct in round 3 against
  `ConfirmLib.sol:122` and `selectConfirmationEligibility`.
- **Deliberately absent**: add-proof (W2a), link-work (WFLOW), DomainImpact commitments, the steward
  "To confirm" tab, W28–W31 exchange.
- **`--cyc` has no canonical token.** Seasons and campaigns differ by word and glyph.

---

## Evidence

Green on this tree at `f5e86ae37`. Re-run rather than trust.

```
bun run lint && bun run test && bun run build
bun run lint:vocab && bun run check:design-md && bun run check:design-generated
bun run check:design-tokens && bun run check:source-structure
```

`bun run test` exit 0 across every package — contracts 24, shared 320, agent 25, client 89, admin 76.
129 commitment tests across 12 files.

`check:source-structure` is worth knowing about: `job-queue/index.ts` has a frozen ceiling of 545
lines and sat at 547 after this round's change. It was brought to 542 by collapsing two branches,
not by raising the ceiling. If you propose anything that adds lines there, it has to come out
somewhere.

**Two dependency commits on this branch are not the author's**: `6da0cbf24` (viem dedupe into root
`overrides`) and `28b7ef7ee` (client dependency refresh). Round 3 reviewed the first and flagged
that `viem: 2.55.0` is forced across wagmi, `@wagmi/connectors`, `@reown/appkit-adapter-wagmi` and
`@coinbase/wallet-sdk`, with no test exercising wallet signing. **`28b7ef7ee` has not been reviewed
by anyone.** Both are security-sensitive surfaces per `CLAUDE.md`.

Three consecutive rounds have had their test evidence disturbed by concurrent dependency work on
this tree — a `@wagmi/core` skew in round 2, a React 19.2.7/19.2.8 skew in round 3. If the suite is
red on a package this branch does not touch, check `git status` and mtimes before concluding.

Known flake: `packages/contracts/script/deploy/release.test.ts` times out at ~5.6s against a 5s
limit under load, passes alone. No commits here touch `packages/contracts`.

**Browser QA is still not the authenticated Brave profile.** What has been checked used the in-app
browser with `?mockAuth=operator&presentation=pwa`: gardens render, and a garden with a pool shows
no Pool tab. No populated state — pool tab with commitments, W2 with a real commitment, W3 placing
one — has been rendered by anyone.

---

## The two rules this work is judged against

1. **A screen must be honest about who is reading it.** No act belongs to a seat that cannot perform
   it, and no celebration belongs to someone who did not do the work.
2. **Simplifying may hide the machine, never a consequence.** What an act does to other people, what
   cannot be undone, and what did not happen during a failure all stay on screen.

Where the code breaks either, say so plainly and show the file and line.
