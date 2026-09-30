# Review prompt — commitment pooling client UI, round 2 (PRD-724)

Paste this whole file as the opening message of a fresh session. It is self-contained.

> **Provenance.** Verified against the branch on 2026-08-19 by the session that wrote both the code
> and the round-1 fixes. That is the reason for a second reader: an author who has just been told
> they were wrong about seven things is exactly the person most likely to have over-corrected. If a
> number here disagrees with the tree, the tree wins and the disagreement is itself a finding.

---

## What this is

`feature/commitment-pooling-client-ui`, 14 commits from `develop` at `0b3fc16ba`.
71 files, +6,196/−115. Four member surfaces (W5 sheet, W1 pool tab, W2 detail, W3 composer) plus
the state layer beneath them.

**Round 1 already happened.** Its prompt is `review-prompt-client-ui.md`; it found nine issues.
Seven were fixed, one was disputed, one was left as a recorded decision. The three commits since:

```
9a9ecc908 fix(client): release the act guard when an enqueue never lands
cd05ccd42 chore(docs): refresh the PWA token audit after the review fixes
dd12817ab fix: address the client UI adversarial review
```

Run `/review` on the branch, then apply `design/review-checklist.md` to the four client views.

---

## Start here: check the dispute

Round 1's headline finding was that the provider gets no action bar for the whole `ACCEPTED`
phase while the band tells them to add proof — called "provable in five lines".

**The author rejected it**, on the grounds that `deriveCommitmentState`
(`modules/commitment-pooling/selectors.ts`) never returns `ACCEPTED` — it collapses to `ACTIVE`,
`EVIDENCE_SUBMITTED` or `PARTIALLY_APPROVED` — so a provider on an accepted commitment already got
`addProof` and the matching `provider:ACTIVE` band.

Decide who was right. If the author is wrong, a real bug was talked away, and that is the most
serious thing on this branch. Things worth checking that neither round examined:

- `mapCommitmentsWithCycleState` overwrites `derivedState` a third time. Can that path produce
  `ACCEPTED`?
- `CommitmentReadModel.derivedState` is typed `CommitmentDerivedState`, which *includes* `ACCEPTED`.
  Is there any construction path — a test fixture, a mock, an optimistic update, a hand-built object
  in a view — that sets it directly rather than through the deriver?
- The author added `ACCEPTED` to `IN_PROGRESS` anyway. Does that change behaviour anywhere, or is it
  genuinely inert?

---

## Then review the fixes as new code

Each of these is code written *in response to* a finding, and none of it existed when round 1 read
the branch. Fixes are where over-correction lives.

### 1. Metadata publishing — `modules/job-queue/job-executors.ts`

`publishPendingCommitmentMetadata` now persists the CID with `jobQueueDB.updateJob` immediately
after upload, and returns `{status: "waiting", reason: "metadata-unpublished"}` instead of throwing.

Ask: does `updateJob({...job, payload})` actually write what the next attempt reads, given
`markJobFailed` re-reads from IndexedDB? Can a `waiting` return loop forever if the gateway is
permanently down — is there any ceiling on `waiting`, and should there be? Does the early return
skip anything the old path did? And check the five new tests in
`__tests__/commitment-metadata-publish.test.ts` for what they mock away rather than what they assert.

### 2. One act table — `modules/commitment-pooling/acts.ts` (new, 116 lines)

Act resolution moved out of the client so the detail bar and the inbox's "needs you" count ask one
question. `selectCommitmentActKind` is the domain rule; the client keeps only labels.

Ask: does the move change any answer the client previously gave? `canJoinTeam` stayed in the client
with its own `JOINABLE` set — is that now a fourth encoding of the same idea? And the inbox's
`needsYou` previously excluded settled commitments *before* asking; confirm that ordering survived.

### 3. Named confirmers — `selectCommitmentSeat`

A rung was added: anyone in `commitment.confirmers` seats as `confirmer`. It sits after
`counterparty` and before `contributors`.

Ask: is that the right position? A named confirmer who is also on the team now reads `confirmer`
rather than `contributor` — is that correct, and does it agree with `selectConfirmationEligibility`,
which excludes every contributor from every confirmation path? Those two could now disagree about
the same person.

### 4. The act guard — `GardenCommitment.tsx`

`hasPendingJob` is now wired through a `runAct` helper that marks the act taken before the enqueue
and clears it on rejection. The clearing was itself a self-found defect: the first version never
released, leaving a member with no action bar and no way back.

Ask: is `queuedAct` reset when the commitment's data refetches and the phase moves on? It is local
state keyed to nothing. What happens when a member queues a Confirm, the job syncs, and the screen
re-renders with a new phase — do they see the right thing, or a bar that is still suppressed?

### 5. Failed sends — `useCommitmentsInbox` + `LiveTab`

A `job:failed` subscription counts terminally failed commitment work, surfaced as an Alert on the
Live tab only.

Ask: the count only ever increments, and only while the hook is mounted. A member who was not
looking at the sheet when the job died sees nothing; one who reopens the sheet sees zero again. Is a
counter the right shape at all, or should this read the queue? And why Live only — the pool tab and
the detail screen have the same blind spot.

### 6. Composer — `ComposeCommitment.tsx`, `ComposeWhat.tsx`

Beat gating now derives from the zod schema via `safeParse` + issue paths; a description input was
added; `crypto.randomUUID` replaced `Math.random`; a rejected enqueue no longer double-reports.

Ask: `beatCanAdvance` runs `safeParse` on the whole form on every render and filters issues by
`issue.path[0]`. Is that correct for every field, and what does it do on a nested or refined issue
with an empty path? The zod messages are still never rendered — the member is blocked by a disabled
button with no reason given. Is that acceptable, or is finding 8 only half fixed?

---

## The gap neither round has covered

**W2 and W3 have no component tests.** `GardenCommitment.tsx` (342 lines) and
`ComposeCommitment.tsx` (214 lines) — the two largest surfaces, both carrying mutations — have zero
rendered coverage. Their pure logic is well covered; the components are not. Nor are `CycleRail`,
`PoolLifecycleNotice`, `CommitmentPeople`, `CommitmentProgress`, `WithdrawDialog`, or
`CommitmentActionBar`.

98 commitment tests exist across 9 files, and none of them mounts either screen. Judge whether the
tested surface is the one that can actually break.

---

## Do not spend the budget here

- **Nothing has rendered against real data.** The local indexer is down and pooling is
  `deployed-not-available` on Arbitrum. Only the unavailable path has been seen in a browser; QA is
  recorded BLOCKED, not passing.
- **Deliberately absent**: add-proof (W2a) and link-work (WFLOW); DomainImpact commitments; the
  steward "To confirm" tab; W28–W31 exchange (parked).
- **`--cyc` has no canonical token.** The rail distinguishes seasons from campaigns by word and
  glyph. Do not propose a hex.
- **`PARTIALLY_APPROVED` offers `addProof` where the reference draws no bar.** Known, recorded in a
  comment in `acts.ts` with the reasoning. Argue it if you disagree — but it is not undiscovered.
- **Round 1's seven fixed findings** are listed above with what changed. Re-report one only if the
  fix is wrong, not because the original was right.

---

## Evidence to re-run, not to trust

```
bun run lint && bun run test && bun run build
bun run lint:vocab && bun run check:design-md && bun run check:design-generated
bun run check:design-tokens && bun run check:source-structure
```

| Suite | Tests |
|---|---|
| `client/__tests__/views/commitmentActions.test.ts` | 18 |
| `shared/__tests__/commitment-seat-and-scope.test.ts` | 18 |
| `shared/__tests__/commitment-composer.test.ts` | 14 |
| `client/__tests__/views/CommitmentsDrawer.test.tsx` | 12 |
| `client/__tests__/views/GardenPool.test.tsx` | 11 |
| `shared/__tests__/commitment-metadata.test.ts` | 9 |
| `shared/__tests__/commitments-inbox.test.tsx` | 7 |
| `shared/__tests__/commitment-metadata-publish.test.ts` | 5 |
| `shared/__tests__/commitment-acts.test.ts` | 4 |

**Two known flakes, neither on this branch.** `packages/contracts/script/deploy/release.test.ts`
times out at ~5.6s against a 5s limit under load and passes in isolation (26/26); this branch has
zero commits in `packages/contracts`. `hooks/ens/useENSClaim.test.ts` has also been seen failing
under full-suite load and passing alone.

**The working tree is not clean, and not from this branch.** Another session is mid-dependency
work: `bun.lock`, `knip.ts`, and four `package.json` files are modified, plus two
`packages/indexer/` files and an untracked `.plans/backlog/client-structure-and-agent-guides/`.
Leave them alone; if a failure traces to them, that is a finding about that work, not this.

---

## The two rules this work is judged against

1. **A screen must be honest about who is reading it.** No act belongs to a seat that cannot perform
   it, and no celebration belongs to someone who did not do the work.
2. **Simplifying may hide the machine, never a consequence.** What an act does to other people, what
   cannot be undone, and what did not happen during a failure all stay on screen.

Where the code breaks either, say so plainly and show the file and line.
