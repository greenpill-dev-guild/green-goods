# Review prompt — commitment pooling client UI, round 3 (PRD-724)

Paste this whole file as the opening message of a fresh session. It is self-contained.

> **Provenance.** Verified against the branch on 2026-08-19 by the session that wrote the code and
> both rounds of fixes. Round 2 corrected round 1 on its headline finding; round 1 corrected the
> author on seven. Assume this document is wrong somewhere too — if a number disagrees with the
> tree, the tree wins, and that disagreement is a finding.

---

## What this is

`feature/commitment-pooling-client-ui`, 18 commits from `develop` at `0b3fc16ba`.
79 files, +7,187/−521. Four member surfaces — W5 sheet, W1 pool tab, W2 detail, W3 composer — plus
the state layer beneath them.

**Two adversarial rounds have already run.** Their prompts are `review-prompt-client-ui.md` and
`-round2.md`; read what each found before reporting anything, because re-finding a fixed defect
costs the same as missing a live one.

- **Round 1** found nine. Seven fixed, one disputed, one recorded as a decision.
- **Round 2** checked the dispute, **retracted round 1's headline finding**, and found four real
  defects *in the round-1 fixes* plus two coverage gaps. All six addressed.

Fix commits since round 2: `694a20316`, `84a09bde8`.

Run `/review` on the branch, then apply `design/review-checklist.md` to the four client views.

---

## What has changed since round 2, and what to make of it

### The indexer now returns data

This is new and it changes what can be checked. `http://localhost:3006/v1/graphql` serves 18 gardens
and **18 CommitmentPools**, one per garden, every one `NOT_READY`. **Zero commitments.**

The availability ledger still reports `deployed-not-available` on 42161
(`ontology/agent-manifest.generated.json`), so `useCommitmentPoolingAvailability` returns
unavailable, every pooling read stays disabled, and the app renders the not-ready path.

Two things were verified in the running app that no earlier round could check:

- Gardens render from live data.
- Opening a garden that **does** have a pool (`0xFDa72CE1D75b735d6595E5814DDF23b97516caEf`, pool
  `42161-7`) shows **Work / Insights / Gardeners and no Pool tab.** The conditional tab and the
  availability gate are both doing their job rather than passing by accident.

**What to decide:** is that the right behaviour? A garden whose pool exists and is `NOT_READY` shows
no Pool tab at all, so a member is told nothing rather than "your stewards have not opened this
yet" — which is a state `PoolLifecycleNotice` implements and nothing can currently reach. The
author judged the tab-absent rule correct because it follows the drawn reference, but the two rules
interact in a way neither was designed for.

**Do not flip the ontology to make screens render.** Changing a CI-gated source of truth to suit a
demo is worse than the gap it hides. If you want the populated surfaces exercised, say so as a
finding about what is provable.

### A commit on this branch is not the author's

`6da0cbf24 chore(client): drop dead deps and dedupe viem across the workspace` — another session's
dependency work, committed onto this branch while round 2's fixes were in flight. It rewrites
`bun.lock` (−406 lines), `package.json` and `packages/client/package.json`.

It resolved the three `@wagmi/core` `BaseError` failures round 2 reported as blocking. **Treat it as
in scope**: it ships on this branch, nobody has reviewed it, and a viem dedupe under a wallet stack
is exactly the kind of change that is fine until it is not.

---

## Where to look

### 1. The round-2 fixes, as new code

`useCommitmentQueueState` (new, shared) replaced two pieces of local React state — a flag that never
cleared on success, and a monotonic failure counter mounted twice. It reads the queue on every
`job:added` / `job:completed` / `job:failed`.

Ask: it calls `jobQueueDB.getJobs` on every one of those events, for every mount. Home and the sheet
both mount the inbox and the detail screen mounts it again — is that three IndexedDB reads per event,
and does it matter? A failed read deliberately leaves the previous answer standing rather than
claiming nothing is queued; is that the right call, or does it strand a member whose queue read
fails once? And `commitmentIdOf` reads `payload.commitmentId` — confirm every job kind that names a
commitment actually carries it there.

The seat rung moved **after** the team, because `ConfirmLib.sol:122` reverts `SelfConfirmation` for
any active contributor before it asks about the confirmer list. Check that ordering against every
other consumer of seat, not just the action bar.

`commitmentNeedsSeat` now excludes elective acts (`withdraw`, `offerAgain`, `takeUp`,
`askToTakeUp`). Ask whether that list is right — is taking something up genuinely never "waiting on
you", including on an approval-gated claim you have already been invited to?

The metadata upload counts its own attempts and returns `identity-conflict` at five. Ask whether
`identity-conflict` is the honest status for "the gateway was down five times", given it is terminal
and its name means something else.

### 2. The new tests, for what they do not assert

20 rendered tests now mount W2 and W3, and 3 more cover metadata persistence with a real store.
Read them adversarially: a test that mounts a component and asserts the happy path can create more
confidence than it earns. `GardenCommitment.test.tsx` mocks `useCommitmentQueueState` wholesale, so
the wiring it was written to protect is itself stubbed.

### 3. What still has no rendered coverage

`CycleRail`, `PoolLifecycleNotice`, `CommitmentPeople`, `CommitmentProgress`, `WithdrawDialog`,
`CommitmentActionBar`. `PoolLifecycleNotice` is the one to weigh: it implements four pool lifecycle
states and, per the finding above, nothing can currently reach it.

### 4. Anything neither round has reached

Both rounds concentrated on seat, acts and the job queue. Less examined: the `W5` Over-time tab's
record aggregation, `groupByGarden`, the `presentation.ts` state vocabulary, `CycleRail`'s
season/campaign distinction, and every loading and empty rung on the pool tab.

---

## Do not spend the budget here

- **Round 1's nine and round 2's six** are listed in their prompts with what changed. Re-report one
  only if the fix is wrong.
- **`ACCEPTED` is unreachable** as a `derivedState`. Round 2 verified all three derivation paths and
  retracted the finding. The band and act tables answer for it anyway; `acts.ts` says why.
- **`PARTIALLY_APPROVED` offers `addProof` where the reference draws no bar.** Known, recorded in a
  comment with its reasoning.
- **Deliberately absent**: add-proof (W2a), link-work (WFLOW), DomainImpact commitments, the steward
  "To confirm" tab, W28–W31 exchange.
- **`--cyc` has no canonical token.** Seasons and campaigns differ by word and glyph. Do not propose
  a hex.

---

## Evidence

Every gate below was green on this tree at `84a09bde8`. Re-run rather than trust.

```
bun run lint && bun run test && bun run build
bun run lint:vocab && bun run check:design-md && bun run check:design-generated
bun run check:design-tokens && bun run check:source-structure
```

`bun run test` exit 0 across all packages — shared 320 files, client 89 files / 719 tests. **This is
the first round where the full suite has been green**; rounds 1 and 2 both ran against a broken
dependency tree.

126 commitment tests across 12 files. The two largest: `GardenCommitment.test.tsx` (11) and
`ComposeCommitment.test.tsx` (9), both new.

Known flake, not this branch: `packages/contracts/script/deploy/release.test.ts` times out at ~5.6s
against a 5s limit under load and passes alone (26/26). This branch has no commits in
`packages/contracts`.

Working tree carries two `packages/indexer/` files and an untracked
`.plans/backlog/client-structure-and-agent-guides/` from another session. Leave them.

**Browser QA is still not the authenticated Brave profile.** What was checked above used the in-app
browser with `?mockAuth=operator&presentation=pwa`. Per `CLAUDE.md` that cannot support an
authenticated verification claim, and none of the populated states — pool tab with commitments, W2
with a real commitment, W3 placing one — has been rendered by anyone.

---

## The two rules this work is judged against

1. **A screen must be honest about who is reading it.** No act belongs to a seat that cannot perform
   it, and no celebration belongs to someone who did not do the work.
2. **Simplifying may hide the machine, never a consequence.** What an act does to other people, what
   cannot be undone, and what did not happen during a failure all stay on screen.

Where the code breaks either, say so plainly and show the file and line.
