# Review prompt — commitment pooling client UI (PRD-724)

Paste this whole file as the opening message of a fresh session. It is self-contained.

> **Provenance.** Every claim below was verified against the branch on 2026-08-19 by the session
> that wrote the code. That is exactly why it needs an adversarial reader: the author's account of
> their own work is the least trustworthy part of this document. If a number here disagrees with
> the tree, the tree wins and the disagreement is itself a finding.

---

## What this is

Ten commits on `feature/commitment-pooling-client-ui`, branched from `develop` at `0b3fc16ba`.
67 files, +5,645/−115. Shared +2,087 across 25 files; client +3,538 across 41.

It turns the merged hi-fi prototypes into four member surfaces, plus the state layer they needed:

| Surface | Where |
|---|---|
| **W5** commitments sheet | `packages/client/src/views/Home/CommitmentsDrawer/` |
| **W1** garden pool tab | `packages/client/src/views/Home/Garden/Pool/` |
| **W2** commitment detail | `packages/client/src/views/Home/Garden/Commitment/` |
| **W3** composer | `packages/client/src/views/Home/Garden/Compose/` |

Run `/review` on the branch. Then load the `design` skill and apply `design/review-checklist.md` to
the visual surfaces — all four are new client views, so that is the all-four-lenses case, not the
quick pass.

---

## Review these five, in this order

The ranking is by where the author expects to be wrong, not by size.

### 1. The metadata / creation-hash interaction — the riskiest thing here

`packages/shared/src/modules/job-queue/job-executors.ts` → `publishPendingCommitmentMetadata`.

Composing a commitment works offline, so the member's title travels inside the job and the executor
uploads it at send time. That upload runs **before** the recovery read, because `metadataCID` is
inside `hashCommitmentCreationPayload` (`job-identity.ts:240`) and the executor compares that hash
against what the contract stored.

**The load-bearing assumption: uploading identical bytes returns an identical CID.** If Pinata ever
returns a different CID for the same content — different chunker, different CID version, wrapping
directory, a gateway quirk — then every retry hashes differently, the recovery check reports
`identity-conflict`, and a member's commitment silently never sends.

Try to break it. Read `modules/data/ipfs/upload.ts` and `pinata.ts` and decide whether that
assumption actually holds. If it does not, this is the highest-severity finding on the branch.
Also ask what happens when the upload itself fails: does the job retry cleanly, or burn an attempt?

### 2. Seat resolution against all 82 drawn states

`views/Home/Garden/Commitment/commitmentActions.ts` and `statusBand.ts`, against
`.plans/active/commitment-pooling/handoffs/commitment-view-state-reference.md`.

The author derived act and band from the three axes (cast, phase, seat) rather than transcribing
the 82 states. Walk the reference table and find where a derived rule disagrees with a drawn state
— particularly the `bar` column, which names the seat whose act sits in the bottom bar, and the
blanks, which are deliberate "this seat has nothing to do here" answers rather than omissions.

**One correction in this branch needs checking, not trusting.** `handoffs/codex-state-api.md:449`
left open what `counterparty` holds on a Request. The author read `AcceptanceLib.sol:146,172-174`,
concluded the contract stores the *taker* there on both directions, and added a creator-by-direction
rung to `selectCommitmentSeat` so the asker on an accepted Request reads as `confirmer` rather than
falling through to `bystander`. Verify that reading against the contract. If it is wrong, the seat
axis is wrong everywhere.

### 3. The claim payload

`views/Home/Garden/Commitment/GardenCommitment.tsx`, the `takeUp` / `askToTakeUp` branch.

Two bugs were already found and fixed here — `kind` was `ClaimType.Garden` when a member claiming
as themselves is `Individual`, and a person's address was being passed as `gardenContext`. Where
there were two there may be more. Check the `ApprovalGated` path especially: it shares one button
with the open path, and `selectClaimPreflight` in `modules/commitment-pooling/selectors.ts` has five
blockers this screen does not consult.

### 4. New member copy, with no automated gate

216 new keys in `packages/shared/src/i18n/{en,es,pt}.json`.

`bun run lint:vocab` enforces only eight growth-hacking terms. The pooling ban list lives in
`.plans/active/commitment-pooling/hifi/validate.ts:481-565` and guards the **prototype**, not the
app, so nothing in CI would catch a banned word here. Read the new strings against that list:
`cycle`/`cycles` (say season or campaign), `evidence` (say proof), `operator` (say steward),
`dispute` ("under review by stewards" is the member ceiling), `promise` as the record noun,
`roster`, `threshold`, `on-chain`, `indexed`, `transaction`, `attestation`, plus em-dashes.

Then check the harder question the linter could never answer: **does each band say the true thing to
the seat reading it?** The band lookup is keyed on seat first and falls back to a neutral fact rather
than another seat's sentence, precisely because the audit found six defects of that shape.

### 5. Offline and query-scope edges

`useCommitments({account: undefined})` silently returned every commitment on the chain — an absent
account removes the filter rather than narrowing it. That is fixed with an `enabled` gate. **Look
for the same shape elsewhere** in `modules/commitment-pooling/data-*.ts`.

Then: what do these surfaces do on a failed send, an `offline_job_identity_conflict`, and a stale
retry? The composer's `clientCommitmentId` is generated with `Math.random()` in a `useMemo` keyed on
the garden address — decide whether that is stable enough to be the thing a creation key is derived
from across a remount.

---

## Do not spend the budget here

These are known and deliberate. Reporting them is not a finding.

- **Nothing has been rendered against real data.** The local indexer is down and pooling is
  `deployed-not-available` on Arbitrum, so only the unavailable path has been seen in a browser.
  Browser QA is recorded as BLOCKED, not passing.
- **Deliberately absent**: add-proof (W2a) and link-work (WFLOW) — the act bar routes back instead;
  DomainImpact commitments (the composer creates service commitments only); the steward "To confirm"
  tab, which needs a garden-account-scoped query that does not exist; W28–W31 exchange, which is
  parked.
- **The `--cyc` cycle identity colour has no canonical token.** The rail deliberately ships on
  existing roles and distinguishes seasons from campaigns by word and glyph. Do not propose a hex.
- **Two i18n gate allowlist entries** in `__tests__/i18n/locale-coverage.test.ts`: placeholder-only
  values, and "Pool" as a product noun the team already writes untranslated. Both are heuristic
  blind spots. Argue if you disagree, but they are known.

---

## Evidence to re-run, not to trust

The author reports all of these green. Re-run them.

```
bun run lint && bun run test && bun run build
bun run lint:vocab && bun run check:design-md && bun run check:design-generated
bun run check:design-tokens && bun run check:source-structure
```

New tests, 86 across 7 files — check what they *do not* cover as carefully as what they do:

| File | Tests |
|---|---|
| `shared/__tests__/commitment-seat-and-scope.test.ts` | 15 |
| `shared/__tests__/commitment-composer.test.ts` | 14 |
| `shared/__tests__/commitment-metadata.test.ts` | 9 |
| `shared/__tests__/commitments-inbox.test.tsx` | 7 |
| `client/__tests__/views/commitmentActions.test.ts` | 18 |
| `client/__tests__/views/CommitmentsDrawer.test.tsx` | 12 |
| `client/__tests__/views/GardenPool.test.tsx` | 11 |

One flake seen under full-suite load: `hooks/ens/useENSClaim.test.ts` "reads fee and calls claimName
with value". Passes in isolation, unrelated to this branch. If you see it, it is not a finding.

---

## The two rules this work is meant to hold

Judge it against these, because they are what the prototypes exist to enforce.

1. **A screen must be honest about who is reading it.** No act belongs to a seat that cannot perform
   it, and no celebration belongs to someone who did not do the work.
2. **Simplifying may hide the machine, never a consequence.** What an act does to other people, what
   cannot be undone, and what did not happen during a failure all stay on screen.

Where the code breaks either, say so plainly and show the file and line.
