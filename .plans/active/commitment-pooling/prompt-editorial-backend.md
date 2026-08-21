# Codex dispatch — editorial commitment-pooling backend

Four backend deliverables that must land before any editorial UI is built. No UI work in this
task: no React components, no i18n keys, no changes under `packages/client/src/views/Public/`.

Read `.plans/active/commitment-pooling/uiux-spec.md` §7 (all four subsections) and §9 before
starting. §7.2 and §9 state the contracts you are implementing. Decision Log #161 and #162 in
`plan.todo.md` record why the scope is what it is; #162 supersedes #161 on the counter's scope.

## Why these four exist

The public site is about to publish a garden's commitment record — lifetime commitments made and
kept, a kept rate, the live cycle, and a list of finished seasons and campaigns — plus a
protocol-wide band on `/impact`. Four things it needs do not exist, and one thing that does exist
would leak provider addresses onto a signed-out page if reused.

---

## 1. Indexer — `distinctProviderCount` on `CommitmentPool`

**Problem.** §7.2 gates the public kept rate on "at least 5 due commitments and at least 3 distinct
providers". `CommitmentPool` has `commitmentsDue`; nothing counts distinct providers.
`CommitmentProviderExposure` is keyed `chainId-poolId-lowercaseProvider`, so counting its rows on a
public page would enumerate provider addresses — §7.4 forbids that outright.

**Deliverable.** A `distinctProviderCount: BigInt!` field on `type CommitmentPool` in
`packages/indexer/schema.graphql`, incremented the first time an exposure key is created for that
pool.

The write site already exists: `packages/indexer/src/handlers/commitment-pool-registry.ts`, in the
function that sets `CommitmentProviderExposure` (~line 128-140). It already reads
`const exposure = await context.CommitmentProviderExposure.get(exposureId)` before writing.
`exposure === undefined` is exactly the first-sight signal — increment the pool's counter in the
same block where you already update `CommitmentPool.openCommitmentCount`.

**It is monotonic. Do not decrement it.** The same handler runs for negative `countDelta`, and an
exposure row whose `openCommitmentCount` returns to zero does not mean the provider never
participated. The published figure is "how many distinct people have ever had exposure in this
pool", which is the correct denominator for a lifetime threshold. A decrementing counter would let
a rate flip back above threshold as people finish their commitments, which is the opposite of what
the rule protects.

Default existing/placeholder pools to `0n` wherever `CommitmentPool` is constructed, the same way
the other counters are seeded.

**Cover it in `packages/indexer/test/commitmentPool.test.ts`** (or the replay suite where the
existing counter tests live): first exposure for a provider increments; a second event for the same
provider does not; a different provider does; a decrement to zero does not reduce it; and replay of
the same events converges to the same value.

**Check first:** whether the hosted Envio indexer has already shipped PRD-722. Merge is not deploy
in this repo — a schema addition that is not deployed will read as missing at runtime. Report what
you find rather than assuming.

---

## 2. Shared — a public pool reader that carries no addresses

**Problem.** `packages/shared/src/hooks/public/` has eight hooks and none of them read pooling data.
The reader that does exist, `getCommitmentPoolDetail` in
`packages/shared/src/modules/commitment-pooling/data-pools.ts`, selects
`CommitmentProviderExposure { … provider … }`. Reusing it from the public site would put provider
addresses into a signed-out reader's network payload whether or not they are rendered.

**Deliverable.** A public reader and hook that select pool, cycle, and unit-summary fields only.

Return shape — everything §7.1 needs and nothing more:

- pool state, and the lifetime counters (`commitmentsOffered/Accepted/Fulfilled/Cancelled/Expired/Disputed/Due`, `openCommitmentCount`, `distinctProviderCount`)
- the open Season cycle if there is one, and any open Campaign cycles, each with type, window, state and per-cycle counts
- finished cycles (Reconciled and Composted; **never Cancelled** — §4.2 says aggregates count completed cycles only), newest first
- pool-scoped and cycle-scoped `CommitmentUnitSummary` rows, keeping each unit's own label and totals

Follow `usePublicGardenDetail` for the hook's shape, including its `partialData` /
`unavailableSources` contract: a failed read must be distinguishable from an empty garden, because
the page renders an em dash rather than a zero for anything it could not read. Test alongside the
existing suites in `packages/shared/src/__tests__/hooks/public/`.

**Add a test that asserts the query text contains no `CommitmentProviderExposure` selection and the
returned object carries no address-shaped field.** That regression is the entire point of this item.

---

## 3. Shared — the public rate threshold helper

**Problem.** `selectPromiseKeptRate` in
`packages/shared/src/modules/commitment-pooling/disclosure.ts` returns `{fulfilled, due}` whenever
`due > 0`. It applies no count gate and takes no provider input at all, so every caller would have
to re-implement §7.2 and they would drift.

**Deliverable.** A shared selector that takes fulfilled, due, and distinct-provider counts and
returns either a publishable rate or a counts-only shape, so the editorial section and the
WalletDrawer summary (§5.8) cannot disagree about the same rule.

Thresholds: `due >= 5 && distinctProviders >= 3`. Below either, return the counts-only shape — never
a percentage, and never a rate the caller could round up into one.

Keep `selectPromiseKeptRate` working for its existing in-garden callers, where gardeners see their
own full numbers; the gate belongs to the public path. Do not rename `promiseKeptRate` — the
vocabulary freeze covers rendered copy, not code identifiers.

---

## 4. Shared — a CCIP-confirmed settlement total

**Problem.** The `/impact` band publishes a "support arrived" figure. `Disbursement`,
`SettlementMessage` and `SettlementExecution` carry the lifecycle, but nothing returns an
acknowledged-only total.

**Deliverable.** A selector returning the confirmed total only — `DisbursementState.CONFIRMED` and
nothing else. `QUEUED`, `DISPATCHED`, `FAILED` and `CANCELLED` must be structurally unable to reach
it. Per `settlement-spec.md` §3.0, dispatched and Celo-executed/ack-pending are not arrival, and
publishing them as arrival is the specific failure this guards.

Add a test that a pool of disbursements in every state returns only the confirmed sum.

---

## Constraints

- **Never `bun test`** — use `bun run test`, which runs vitest with the right config.
- Indexer changes need `bun run codegen` before typecheck; its test script runs codegen itself.
- All React hooks live in `@green-goods/shared`. Import only from paths declared in
  `packages/shared/package.json#exports`; never `@green-goods/shared/src/**`.
- `Address` type, not `string`, for Ethereum addresses. `logger` from shared, not `console.log`.
- The indexer boundary is enforced by `packages/indexer/scripts/check-indexing-boundary.mjs`.
  Commitment pooling events are already inside it; do not widen it.
- `check:source-structure` caps new files at 350 lines and modified files at 500. Split before you
  hit it rather than asking for a ceiling.
- Do not install or upgrade any dependency.
- This repo runs concurrent agents. Stay inside `packages/indexer/**` and
  `packages/shared/src/modules/commitment-pooling/**`, `packages/shared/src/hooks/public/**`,
  `packages/shared/src/__tests__/**`. Surface unexpected working-tree state in your report instead
  of reverting it.

## Gates

```
bun run --filter @green-goods/indexer test
bun run --filter @green-goods/shared test
bun run --filter @green-goods/shared build
bun lint
bun run check:source-structure
```

## Report back

What you changed, the test output proving each of the four, whether PRD-722 is deployed on the
hosted indexer, and anything in §7 that turned out not to be buildable as written.
