# Review prompt — commitment pooling client UI, round 5 (PRD-724)

Paste this whole file as the opening message of a fresh session. It is self-contained.

> **Provenance.** Written by the session that wrote the code and all four rounds of fixes. Rounds 1
> through 3 each found a live defect that broke one of this feature's two rules. Round 4 found none
> — only omissions and a regression in round 3's own fix. Read that as a signal about *this style of
> review* reaching its limit, not as evidence the branch is finished. If a number here disagrees
> with the tree, the tree wins.

---

## What this is

`feature/commitment-pooling-client-ui`, 24 commits from `develop` at `0b3fc16ba`.
92 files, +8,890/−694. Four member surfaces — W5 sheet, W1 pool tab, W2 detail, W3 composer — and
15 new or changed modules in `packages/shared/src/{hooks,modules}/commitment-pooling`.

Four adversarial rounds have run: `review-prompt-client-ui.md`, `-round2.md`, `-round3.md`,
`-round4.md`. **Read what each found before reporting**, and note that four of them corrected the
round before.

Fix commit since round 4: `c984ec5ef`.

---

## Change of approach: stop auditing the fixes

Rounds 2, 3 and 4 each found their best material *inside the previous round's repair*. That well is
close to dry, and the churn shows where it was:

```
3×  hooks/commitment-pooling/useCommitmentQueueState.ts
2×  modules/job-queue/job-executors.ts
2×  hooks/commitment-pooling/useCommitmentsInbox.ts
2×  views/Home/CommitmentsDrawer/grouping.ts
```

Four files rewritten repeatedly across four rounds, each time to close a specific finding, and
nobody has stepped back to read the result whole. **That is this round's first job.** Read those
four as if for the first time and ask whether the accumulated repairs still make one coherent
design, or four patches sharing a file. Specifically:

- `useCommitmentQueueState` has been a `useState` + effect, then a react-query key, and has grown
  four return values. Two of those (`isUnavailable`, `failedCommitmentIds`) were added in one round
  and only wired to a screen in the next. Is the shape right now, or is it accreting?
- Act resolution lives in `modules/commitment-pooling/acts.ts`, seat in `selectors.ts`, band copy in
  the client's `statusBand.ts`, and labels in `commitmentActions.ts`. That is four files to answer
  "what does this screen show this person". Justified, or a seam nobody owns?
- `job-executors.ts` and `job-queue/index.ts` pass a mutable `Job` between them. Two bugs came from
  that. The rule is now "the executor mutates in place" — is it written down anywhere a future
  change would find it?

## The second job: what has never been run

**No populated state has been rendered by anyone, in four rounds.** The indexer serves 18 gardens
and 18 pools, all `NOT_READY`, and **zero commitments**; the availability ledger reports
`deployed-not-available` on 42161, so every pooling read stays disabled and no Pool tab appears.
What has been seen in a browser is: gardens listing, W5's not-ready state, and a garden with a pool
showing no Pool tab.

Everything else — the pool tab with commitments, W2 with a real commitment, W3 placing one, the
metadata round-trip, the offline queue actually draining — has only ever been exercised by tests
written by the same session that wrote the code.

Six components have never been mounted by anything: `CycleRail`, `PoolLifecycleNotice`,
`CommitmentPeople`, `CommitmentProgress`, `WithdrawDialog`, `CommitmentActionBar`.
`presentation.ts` is imported by no test.

**Do not flip the ontology to make screens render.** If you can construct honest evidence another
way — fixture-driven mounts of those six, a Storybook pass, seeding the local indexer — that is
worth more this round than another logic audit. If you cannot, say plainly that the branch's visual
behaviour remains unverified, because four rounds of green tests have not changed that.

## The third job: the dependency commits

Two commits on this branch are not the author's and ship with it:

- `6da0cbf24` — forces `viem: 2.55.0` through root `overrides` across wagmi 2.19.5,
  `@wagmi/connectors`, `@reown/appkit-adapter-wagmi` and `@coinbase/wallet-sdk`. Round 3 confirmed
  it is legal against wagmi's `peer viem: 2.x` and flagged that `2.x` is exactly the range that
  hides breakage.
- `28b7ef7ee` — client dependency refresh. Round 4 verified the tailwindcss 4.2.4 → 4.3.3 bump by
  grepping the built bundle for real selectors, and found the new commitment utilities present.

Still unverified in both: `@reown/appkit` 1.8.23, `@sentry/react` 10.70.0, vite 8.1.4 → 8.2.1, and
the wallet stack generally. **No test exercises wallet signing**, and authenticated Brave QA is
blocked. These are security-sensitive surfaces per `CLAUDE.md`.

---

## Do not spend the budget here

- **The findings of rounds 1–4** are in their prompts with what changed. Re-report one only if the
  fix is wrong.
- **`ACCEPTED` is unreachable** as a `derivedState` (round 2 verified all three derivation paths).
- **`PARTIALLY_APPROVED` offers `addProof` where the reference draws no bar** — recorded in
  `acts.ts` with reasoning.
- **The seat rung order, `ELECTIVE`, the confirmers query's case handling, the terminal-status
  split, and event coverage for queue invalidation** were each verified correct in rounds 3 or 4.
- **Deliberately absent**: add-proof (W2a), link-work (WFLOW), DomainImpact commitments, the steward
  "To confirm" tab, W28–W31 exchange. **`--cyc` has no canonical token.**

---

## Evidence

Green on this tree at `c984ec5ef`. Re-run rather than trust.

```
bun run lint && bun run test && bun run build
bun run lint:vocab && bun run check:design-md && bun run check:design-generated
bun run check:design-tokens && bun run check:source-structure
```

`bun run test` exit 0 across every package — contracts 24, shared 320+, agent 25, client 90, admin
76. 139 commitment tests across 14 files.

Read those 139 adversarially. They were written by the author, and round 4 demonstrated the failure
mode: the write path was mocked in every test that depended on it, so a swap between two acts would
have left the whole suite green. Ask of each new test what it would still pass with broken.

`job-queue/index.ts` has a frozen line ceiling of 545 and sits at 542. Anything added there has to
come out somewhere.

Rounds 2 and 3 had their evidence disturbed by concurrent dependency work on this tree; round 4 did
not. If a package this branch does not touch comes back red, check `git status` and file mtimes
before concluding.

Known flake: `packages/contracts/script/deploy/release.test.ts` times out at ~5.6s against a 5s
limit under load and passes alone. No commits here touch `packages/contracts`.

---

## The two rules this work is judged against

1. **A screen must be honest about who is reading it.** No act belongs to a seat that cannot perform
   it, and no celebration belongs to someone who did not do the work.
2. **Simplifying may hide the machine, never a consequence.** What an act does to other people, what
   cannot be undone, and what did not happen during a failure all stay on screen.

Where the code breaks either, say so plainly and show the file and line. If it breaks neither and
you have looked hard, say that too — a fifth round that manufactures findings to justify itself is
worse than one that reports the branch is ready and names what remains unproven.
