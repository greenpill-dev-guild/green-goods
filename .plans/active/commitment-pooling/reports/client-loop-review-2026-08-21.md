# Client loop D1 review — 2026-08-21

Adversarial review of PR #749, branch `feature/commitment-pooling-client-loop` at `603163d7b`,
against `develop`. Base `bcf6adfc2`; 26 commits, 122 files, +12,987 / −956. The work itself is
recorded in `reports/client-loop-2026-08-21.md`; the dispatch is `prompt-client-loop.md`.

**Disposition: REQUEST_CHANGES.** Two confirmed defects block the merge. Nothing was changed by
this review — it is read-only, and the findings are recorded here to be addressed in a later
session.

Method: read every touched line on the critical surface (`modules/job-queue/**`), traced the
client acts against the Solidity that receives them, compared the seat selector rung-by-rung with
`CreditLib.isOrdinaryConfirmer`, diffed the source-structure split as normalized line multisets,
checked locale parity and plurals programmatically, grepped the built client bundle, and made one
read-only RPC call to the live Arbitrum module. No tests were added and no browser was driven, so
the offline and rendered claims below inherit the limits already recorded in the session report.

## Blocking

### B1 — the protocol-pool garden claim always reverts, and the context the contract allows is unreachable

`GardenCommitment.tsx:208` pins `gardenContext` to the garden in the route, and
`views/Home/Garden/index.tsx:170` only ever lists a pool under the garden that owns it. So the
protocol pool is reachable only under its host garden's route — which is exactly the context
`AcceptanceLib.sol:88` rejects with `GardenClaimMustBeExternal`.

Failure: a steward of `0xf401…8a858a` (host of the real protocol pool — `protocolPoolId()` reads
`1` on Arbitrum and pool 1's garden is that address) opens the pool from their garden page, taps
Take up on an OFFER, gets the context sheet (`GardenCommitment.tsx:299`, garden option enabled by
`:408`), chooses "For the garden". The local membership preflight passes, `claimCommitment` is
sent, the chain reverts, five attempts burn, and the row lands in "send that gave up". The steward
of some other garden X — the case the contract actually allows — can only reach that commitment by
hand-typing `/home/X/commitments/<id>`.

Same root, second failure: a member of X who is not a member of the host taps the personal door.
`gardenContext` is still the host, so `job-executor.ts:95` parks the claim on
`membership-unavailable` indefinitely. There is no Retry or Discard for it — those render only for
failed *creations* (`PendingCreationRow.tsx:89`) — while `AcceptanceLib.sol:96` would have accepted
`gardenContext = X`.

Third instance: the confirmation job carries the route garden too (`GardenCommitment.tsx:438`), so
a steward seated by the new rung 5 who confirms from a pool page under another garden stalls the
same way.

Fix shape: the garden on a claim or confirmation must come from the record or from the member's own
stewarded garden, never from the route. That likely also needs a way into the protocol pool that is
not "under its host".

### B2 — demo mode leaves the real write path open in dev builds with a real signer

`selectors.ts:16` returns `available` before any deployment or activation check. Everything
downstream trusts that answer and knows nothing about demo mode: `job-queue/index.ts:133` and
`useCommitmentMutations.ts:191` accept the act, and `job-executors.ts:426` sends it to the real
module address. `demo-mode.ts:57,64` deliberately supports a real wallet ("so the world still reads
sensibly for a real wallet in dev").

Failure: `bun run dev:prod` (or any dev build pointed at 42161) plus `?mockPooling=1` plus a real
connected signer. Composing into the fixture protocol pool sends `createCommitment` with
`poolId = 1` — the real protocol pool — to the live module. Today every such send reverts, because
`CreationLib.sol:72` requires `PoolState.Open` and pool 1 is `NotReady`; the visible cost is five
failed UserOp attempts and dead jobs in the member's real queue. The day pool 1 opens, a
demo-composed commitment from a host steward broadcasts for real.

Mock auth is currently the only thing keeping this theoretical: `DevAuthProvider` supplies
`smartAccountClient: null`, so `useTransactionSender` returns null and `processJob` skips at
`transaction_sender_unavailable`. That is a coincidence of the mock, not a guard.

Fix shape: either gate `isDemoPoolingActive()` on a mock identity being set, or refuse
`COMMITMENT_JOB_KINDS` in `processJob` while demo is on. The read side needs no change.

Production is clean, and this was checked rather than assumed: the built bundle (200 chunks,
built from this head) contains no `mockPooling`, no `greengoods_dev_mock_pooling`, and no fixture
string; Bun evaluates `import.meta.env.DEV` to `undefined` so the guard is falsy outside Vite; the
agent package imports neither the pooling module nor the queue; and every demo-backed read is keyed
under `commitment-pooling`, so `App.tsx:112` and its mirror do cover them all.

## Non-blocking

### N1 — `discardQueuedJob` can delete the record of a commitment that exists on chain

`job-recovery.ts:37` guards on `synced` alone. If the first send broadcasts but throws before
`index.ts:334` writes `submittedTxHash` (bundler timeout), and the RPC stays down for the four
remaining attempts so the recovery read never resolves, the job reads as failed. Discard then drops
the local record and the `clientCommitmentId` mapping, and the commitment surfaces later as an
orphan once indexed. Narrow, but the fix is one `readCommitmentId` before the delete.

### N2 — creator and counterparty are seated `confirmer` even when a named group excludes them

`selectors.ts:111-112` fire before the named-confirmer rung, while `CreditLib.sol:138` makes a named
group exclusive of everyone else. Offering Confirm to an excluded creator produces `NotConfirmer`
(`ConfirmLib.sol:127`). Pre-existing, and unreachable from the client today because the composer
cannot set a confirmer group (`step-advanced` is Decision 3, not built) — but it becomes reachable
the moment any surface calls `setConfirmerRule`. Rung 5 itself matches the contract exactly.

### N3 — To confirm lists rows the detail screen then refuses

`useCommitmentsToConfirm.ts:74,124` seat with `contributors: []` because the list query has no
roster. A steward who is also on the team therefore sees the row marked "needs you"; opening it
seats them `contributor` (correctly, since `ConfirmLib.sol:123` reverts `SelfConfirmation`) and
offers no act. Cosmetic, but it is the inbox promising something the detail withdraws.

### N4 — `retryQueuedJob` is a blind get-then-put outside the flush mutex

`job-recovery.ts:23` via `db.ts:277` writes the whole record back, so a concurrent
`submittedTxHash` write can be erased, or a job deleted at `index.ts:371` resurrected. Worst case is
one reverted attempt (`CommitmentCreationRequestConflict`) that then self-heals through the recovery
read — not a duplicate act, because Retry is only exposed for creation kinds and those have the
read. Worth a compare-and-set if the queue is touched again.

### N5 — `ENSSection.tsx:74` still reads `slugForm.watch("slug")`

The same React Compiler class of bug that `ee073089f` fixed across the composer: the compiler's memo
cannot observe react-hook-form's mutable read, and jsdom tests run without the compiler. Slug
availability may not update as the member types in the built client. Pre-existing and outside this
lane's paths; not verified in a browser.

## Gaps

- A creation whose transaction is dropped after `submitted` waits on `pending-first-send` forever
  (`job-executor.ts:43,68`, pre-existing at base). The new Retry/Discard controls do not reach it.
- Evidence, claim and confirmation jobs have no recovery read. A broadcast-then-throw re-sends,
  reverts (`ProofLib.sol:47` `EvidenceAlreadyAttached` for proof), and after five attempts a
  successful act reads as failed. Pre-existing; offline-composed evidence widens the window.
- The proof composer has no draft (`ProofComposer.tsx:79` mints `clientEvidenceId` per mount), so
  media picked offline dies with the PWA process. The commitment composer does have one.
- Partial media uploads restart from zero on each attempt. Content-addressed, so wasteful rather
  than wrong.
- `chipClass` now exists in both `ComposeHowMuch.tsx:21` and `ComposeActionRail.tsx:16`.
- The fixture world puts pool 1 on TAS HUB; on chain pool 1's garden is the Green Goods Community
  Garden. Harmless while demo is read-only, but it is the divergence that makes B2 easy to miss.

## What came back clean — do not re-run these

- **Production reachability of the demo world.** Bundle grep, guard evaluation under Bun, consumer
  survey, and the persisted-cache rules in both directions. The dev-side hole is B2; the shipped
  artifact is clean.
- **Evidence publishing and attempt counting.** CID written back to storage before the send, meta
  mutated rather than replaced so the counter survives the caller's rewrite, waiting versus terminal
  correctly distinguished, and the terminal path is `markJobTerminalFailed` plus event plus
  analytics — not log-only. The `"gardenAddress" in payload` fail-open is the documented
  pre-2026-08-21 compatibility rule, not an oversight.
- **Seat rung 5 against the contract.** Named group wins and excludes; contributors refused before
  the confirmer rungs; the rung fires only for `OFFER` + `counterpartyKind === "GARDEN"`. The
  identity mapping is exact: `useHasRole(…, "operator")` → `GardenAccount.isOperator` →
  `hats.isOperatorOf || isOwnerOf`, read from chain, which is the same predicate
  `CreditLib.isOrdinaryConfirmer` uses. The To-confirm tab reads the indexer's operators and owners
  and the detail re-checks on chain.
- **The `useWatch` migration.** No `form.watch` or `getValues()` remains in a render path in the
  client's pooling views; the only survivor is N5, elsewhere.
- **`8f9424a76` is behaviour-neutral.** Verified as normalized line multisets per group, with the
  residue read by hand: `ProofState`, `CommitmentDetailState` and `WorkFulfills` each reproduce the
  branch they replaced, including `{fulfills}` rendering bare where a ternary used to sit.
- **Copy, i18n and accessibility.** 304 en keys added, all mirrored in es and pt; six plural
  messages well-formed in all three locales; no banned vocabulary in any locale, including Spanish
  and Portuguese equivalents; every icon-only button carries a name; `tap-target-lg` pads to 44px;
  reduced motion is handled by the global rule in `utilities.css:544`.

## Not verified

No live authenticated proof, no real offline pass, no device pass — the limits already recorded in
the session report still hold. No tests were run for this review; the Ship Gate result quoted in the
session report was not re-executed.

## Merge conflict with develop

One file, one hunk: `packages/client/src/views/Home/Garden/Compose/ComposeCommitment.tsx`,
`beatCanAdvance`. develop's `7b3eb25b4` (strict story typechecks) and this branch's `22b2548ca`
fixed the same two lines differently. The two versions are semantically identical; develop's keeps
the `keyof CommitmentComposerValues` link between `BEAT_FIELDS` and the schema, so the resolution
takes develop's side verbatim. Everything else in the seven-commit gap auto-merges.

## Commands run

```
git merge-tree --write-tree --name-only HEAD origin/develop
grep -rl "mockPooling|greengoods_dev_mock_pooling|Compost delivery to the beds" packages/client/dist/
mise exec -- bun -e 'console.log(import.meta.env.DEV)'
node --input-type=module   # viem readContract getPool(1|2|3|101|102), protocolPoolId() on Arbitrum
node   # locale parity, plural syntax, banned vocabulary over the 304 added keys
```
