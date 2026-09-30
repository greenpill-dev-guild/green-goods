# Pre-merge review — settlement contracts, payer rule, indexer read model

Date: 2026-08-09
Reviewed: `feature/build-commitment-pooling-contracts` at `d12b8a24b`, merging to `develop`
Method: two independent adversarial passes (settlement contracts; payer rule + indexer), each
finding verified against the source before it was recorded here. Claims the reviews made that did
not survive verification are not listed.

**Disposition: merged.** The value-moving contracts reviewed clean at Critical/High. Every finding
below is pre-deploy — no settlement address is registered in `packages/indexer/config.yaml`, and the
`indexer` and `state_api` lanes remain blocked in `status.json`, so nothing on `develop` claims this
read model works yet. The findings are recorded here because they are latent, not absent: the
indexer ones bite on the first Sepolia rehearsal, and C1 needs an architecture decision before that.

## Contracts — clean at Critical/High

No path was found that moves value without steward/owner authority, pays more than `declaredAmount`,
double-pays a subject, or confirms a payment the executor did not make (except M1 below). Verified
holding: router authentication through both proxies; execution-key agreement between the two chains
including the `isBatch` domain separator; no key reuse and no second payment authority; duplicate and
stale acknowledgment handling; value conservation at edit and finalize, including the forced-zero
retention for cross-garden plans (the round-2 "100%-retained plan strands funds" bug is genuinely
closed); recognition weights recomputed on chain rather than trusted from the caller; bounded
executor authority with no caller-controlled target, selector, token, or calldata; net-amount fee
semantics; upgrade guards on both contracts with immutable pinning; and storage declared only in the
two `Storage.sol` contracts, both covered by committed baselines and the `check-storage-layout.sh`
gate.

### M1 — a retired executor keeps acknowledgment authority over its in-flight commands
`src/lib/Settlement/AcknowledgmentLib.sol:46-56`

Acknowledgments authenticate only against the snapshotted `CommandRecord`, never against the live
`_ccipRoute`. `settlement-spec.md` §3.1.3 requires the snapshotted executor to still be the active or
unexpired previous peer. After a drained cutover to a replacement executor
(`previousPeerGraceSeconds = 0`, the strongest revocation the source offers), the retired executor
can still send `success: true` for any command dispatched to it and not yet acknowledged: the child
goes `Confirmed`, `confirmedPayoutCount` increments, and the plan reads `Complete` with no G$ moved.

**Fix before value release**, not before merge — it requires a compromised or malfunctioning retired
executor, and no value has been released. Add the live-peer check to the acknowledgment path.

### M2 — the Arbitrum account registry does not enforce the 1:1 Safe↔garden mapping
`src/lib/Settlement/ConfigurationLib.sol:97-148` (the Celo side does, `CeloSettlement/Admin.sol:28-29`)

A steward can register another garden's Celo Safe as their own settlement account. `queueFunding`
then sends to that Safe while every event, indexer row, and operator view records the wrong garden.
Not theft — the recipient must still be an executor-owner-registered Safe — but the accounting record
is wrong, and registration is write-once, so it is unrecoverable.

### M3 — write-once registration sits at steward tier with no owner correction path
`src/modules/Settlement/Base.sol:97-100`, `src/lib/Settlement/ConfigurationLib.sol:119-121`

One steward can permanently burn their garden's settlement-account slot with a wrong Safe address,
including against the owner's wishes. Per `settlement-spec.md` §4 the repair is a new executor proxy
plus bounded peer migration. Decide before mainnet whether registration should be owner-only, or
whether an owner correction path should exist while the account has never been used as a plan source.

### Lows worth a pass before deploy
Inverted error name on the executor pause guard (`CeloSettlement/Execution.sol:80` reverts
`ExecutorMustBePaused` when it *is* paused — behavior correct, name misleads incident triage); wrong
error on the batched-dispatch path (`LifecycleLib.sol:123-125`); `queueFunding` reusing
`InvalidPayoutVector` for target validation; `NotSettlementSteward` unreachable for a Hats-unconfigured
garden; `gardenerDeliveryEnabled` not stopping already-queued children (`setPaused` is the real kill
switch — document in the runbook); batch atomicity grief-able by one hostile recipient through a G$
receive hook, since canonical G$ is a SuperToken (fails closed, but prefer unbatched contributor
fan-out until measured); and `_ccipReceive` on Arbitrum lacking `nonReentrant` (traced harmless,
add for defense in depth).

## Payer / recipient rule — enforced in code

All six rules of registers #90/#91 are enforced, not merely asserted in tests, across all eight
`pool × direction × claimType` cells. `payerGarden` has exactly two writers; a Request's payer can
never be zero because `pool.garden` is write-once and non-zero; the recipient discriminator is
consistent in both places that need it; `acceptExchange`'s barter-only check genuinely precedes any
mutation; and the zero-payer hazard is blocked both explicitly and structurally.

### M4 — a non-steward garden member can bind their garden as payer for a priced protocol Offer
`src/lib/CommitmentPooling/AcceptanceLib.sol:48-50`, payer stored at `:117-119`

The Garden-claim branch immediately above requires `isGardenSteward`; the Individual branch requires
only `isGardenMember`. So any gardener can claim a priced protocol-pool Offer with
`gardenContext = their garden`, making that garden the immutable on-chain payer of the obligation
without any steward of that garden acting. The ApprovalGated path widens it: `acceptClaim` never
re-checks the claimant's membership in `gardenContext`.

No funds move without a steward — `PlanLib.sol:100` requires the payer garden's own steward to create
the payout plan, and `:97-99` rejects a zero payer. This is obligation-record integrity.

**This one needs an owner decision, not a default fix**: should claiming a priced Offer on a garden's
behalf require that garden's steward, matching the Garden-claim branch? The branch's own test encodes
the current behavior (`CommitmentPoolingPayer.t.sol:38`, `:103-108`), so changing it changes a pinned
expectation.

## Indexer read model — one Critical and four High, all pre-deploy

### C1 — `remoteEvmChainId`, `localChainSelector`, and `localRouter` have no writer
Declared `schema.graphql:111-114`; every occurrence in `src/` is a read, a gate, or an
`existing?.` self-reference.

Four entity types are gated on `remoteEvmChainId !== undefined` and therefore never materialize in
production: `SettlementMessage` (`settlement-commands.ts:79`, `settlement-acknowledgments.ts:48,165`),
`SettlementExecution` (`settlement-executor-executions.ts:17`), `SettlementGardenRoute`
(`settlement-executor-configuration.ts:59`), and `peerConfigured` stays permanently false
(`settlement-source-configuration.ts:102-107`). Masked because `test/settlement-lifecycle.test.ts:38-56`
hand-seeds these fields, so the passing indexer suite never exercises the production write path.

**Not a mechanical fix, and the reason it is called out rather than patched**: neither
`CcipRouteUpdated` nor `SourcePeerUpdated` carries an EVM chain ID, and the CCIP router address is an
implementation immutable that no event emits at all. Populating these needs a decision:

1. **Emit them** — add the EVM chain ID and router to the route/peer events. Correct and
   self-describing, but another scoped exception to the ABI freeze.
2. **Static deploy config in the indexer** — a chainId → `{ localChainSelector, localRouter }` map plus
   a selector → EVM chain ID map, seeded from `deployments/networks.json`. No ABI change, but the
   indexer then carries deployment truth that must be kept in step by hand.

Option 1 is the better fit for a contract that is not yet deployed; option 2 is the only one available
once it is.

### H1 — every settlement → `Garden` join key is dead
Settlement writes nine `*GardenId` fields through `normalizeAddress` (lowercase); `Garden.id` is
written raw at `garden.ts:24,56` and `hatsModule.ts:16`, and Envio decodes address params through
viem `getAddress` (`node_modules/envio/src/Address.res:11`), so `Garden.id` is checksummed. The fields
are plain `String!` rather than Envio relations, so nothing fails at index time — a client resolving
`plan.payerGardenId → Garden(id:)` silently gets null. `test/settlement.test.ts:152` asserts the
lowercase value and never joins.

Fix on the settlement side. `Garden.id`'s bare-address form is a documented public-query-surface
exception (`.claude/rules/indexer.md`) and must not be migrated.

### H2 — `contributorEntityId` is a bare address against a composite `Gardener.id`
`settlement-disbursements.ts:47`, `settlement-snapshots.ts:105` write a bare lowercase address;
`Gardener.id` is `${chainId}-${normalizeAddress(account)}` (`hatsModule.ts:66,156`). The join never
resolves, and it breaks the composite-ID rule — `Garden.id` is the only documented exception.

### H3 — three handlers bail before writing `SettlementSubjectState`
`settlement-disbursements.ts:126` and `:178`, `settlement-batches.ts:102` return early on a missing
row, skipping the subject write that exists a few lines below. The correct pattern is right there in
the siblings (`settlement-acknowledgments.ts:32`, `settlement-commands.ts:61` write it
unconditionally first, and the create handlers replay it). Under reverse delivery — a cancel arriving
before the `DisbursementQueued` that creates the row — the row is later created `QUEUED` with nothing
to reconcile from, and the plan reports `PENDING` forever.

### H4 — `CommitmentPayoutPlanFinalized` bails with no reconciler
`settlement-payout-plans.ts:134`. Permanently loses `finalized`, `payablePayoutCount`, both totals,
both snapshot hashes, and `finalizedAt`. Because `payoutStatus()` short-circuits on `!finalized` and
creation hardcodes `finalized: false`, the plan is stuck at `DRAFT` forever.

### Mediums
`SettlementConfiguration` keyed by chainId alone, so an executor-config event on a chain that also
hosts the source wipes `pendingPayoutPlanEntityIds` with a bare `[]` (`settlement-projections.ts:262`,
unlike the `existing?.… ?? []` used everywhere around it) — and the lifecycle test already runs both
lanes on one chain; `Disbursement.settlementFlow` never backfilled when the protocol-garden fact
arrives late; `sourceConfiguration()` called with the payout plan's token in the `gDollarToken` slot
(`settlement-payout-plans.ts:105-111`), reachable exactly in the pre-`FundingConfigurationLocked`
window the pending queue exists for; and six more bail-on-missing update handlers, of which
`SettlementAccountStatusChanged` (a dropped deactivation leaves a funds-routing account showing
active) and `AcknowledgmentSent` (skips the fee-reserve decrement, so `feeReserveLow` stops firing)
are the two that matter.

## What was verified clean, stated plainly

Event signature fidelity: 28 `SettlementModule` + 14 executor entries in `config.yaml`, matching the
interfaces exactly, every event registered and each with exactly one handler; the only deltas are
ABI-identical enum→`uint8` widenings. Counter arithmetic across confirm / fail / requeue / cancel and
batch fan-out, traced against the contract's own state guards — no double-count, no negative drift,
idempotent under acknowledgment redelivery. The `settlementFlow` truth table and its late-protocol-garden
backfill. The hand-rolled `log4` for `CommitmentCreated` — 24 non-indexed params in exact order, 27
topic types against 27 declared params, correct length-and-offset stripping.

## Suggested order

1. Decide C1's mechanism (emit vs static config) — it blocks the Sepolia rehearsal's read model.
2. Fix H1–H4 and the indexer Mediums in one pass; add a test that does not hand-seed config.
3. Decide M4 (steward vs member authority for claiming a priced Offer) and M1's live-peer check
   before any value release.
