# Commitment Pooling Shared Query Contract

## Status and scope lock

- Deliverable: PRD-723 entity/query contract and selector inventory
- Status: **ACCEPTED AND IMPLEMENTED IN SOURCE — hosted availability remains human-gated**
- Source snapshot: pooling contracts and indexer source are merged; the pre-deploy indexer gap
  closure is present on `feature/commitment-pooling-api-modules`
- Runtime availability: pooling contracts are deployed on Arbitrum One, but the hosted Envio
  indexer has not shipped the pooling schema. Sepolia has no pooling contracts.
- The user accepted this contract by directing completion of the remaining phases. Shared core,
  Saved Offer persistence, and the settlement extension are implemented on the named branch. This
  acceptance does not authorize the manual hosted indexer deploy, contract broadcast, Safe/value
  mutation, or live Celo canary.

The settlement contract lane is GREEN and its indexer entities are present, so the previously
deferred settlement reads are included in this source implementation. Runtime reads still fail
closed until the hosted Envio schema is manually deployed, fully synced, and read back.

## Decisions this contract locks

1. Shared code queries only public read entities. It never queries
   `CommitmentPendingLifecycleProjection`, `CommitmentPendingLifecycleProjectionIndex`, or the
   handler-internal `CommitmentCycleCommitmentIndex` introduced by the pre-deploy scale fix.
2. Every ordinary list excludes out-of-order placeholders with the entity's seen flag. A direct
   lookup may observe a placeholder only inside a typed loading/recovery result; it never returns
   one as ordinary domain data.
3. `Garden.id` remains a bare lowercase address. Pooling IDs remain chain-scoped composites. No
   shared adapter normalizes one scheme into the other.
4. Capability gating reads the ontology projections ledger through the public ontology seam. It
   does not add an `isCommitmentPoolingDeployed` boolean or infer availability from a contract
   address alone.
5. Commitment detail joins membership through `CommitmentContributorIndex`; reverse account
   lookup filters seen active `CommitmentContributor` rows. The removed commitment-level
   contributor array is not restored.
6. Exact `unitLabelHash` and exact `declaredValueBasis` values define aggregation groups. No
   selector trims, folds case, normalizes Unicode, or sums across groups.
7. Raw `PoolMemberHistory` rows stay behind the viewer-aware shared selector. Client and admin
   consume no raw query, entity type, or adapter.
8. The six offline job kinds remain `commitmentSeries`, `commitment`, `claim`, `evidence`,
   `workLink`, and `confirmation`. Exchange acceptance, settlement, and ProtocolToGarden funding
   remain online authority-gated mutations.

## Availability contract

The projections ledger now distinguishes an Arbitrum deployment from Sepolia through chain-scoped
maturity exposed by the existing ontology query seam. Implemented shape:

```ts
type OntologyChainCapability = Pick<
  OntologyCapability,
  "deployment" | "activation" | "integration" | "availability" | "evidence" | "verified_at"
>;

interface OntologyCapability {
  // existing fields remain
  chains?: Readonly<Record<string, OntologyChainCapability>>;
}
```

`useCommitmentPoolingAvailability({ chainId })` resolves the selected chain through
`getOntologyChainMaturity("entity:commitment-pool", chainId)` and returns:

```ts
type CommitmentPoolingAvailability =
  | { status: "available"; capability: OntologyChainCapability }
  | { status: "unavailable"; reason: "not-deployed" | "not-activated" | "not-integrated"; capability: OntologyChainCapability }
  | { status: "unknown-chain" };
```

Initial ledger truth is:

| Chain | Deployment truth | Query availability |
|---|---|---|
| Arbitrum One `42161` | contracts deployed and active | `deployed-not-available` until hosted Envio schema/full-sync read-back and shared integration proof |
| Sepolia `11155111` | pooling contracts absent | unavailable with reason `not-deployed` |

Only human-owned hosted deploy evidence plus live query read-back may move Arbitrum to
`available`. A merge, contract address, local codegen, or local build is insufficient.

## Seen-flag policy

| Entity | Required ordinary-read predicate | Meaning when false |
|---|---|---|
| `CommitmentPool` | `registrationSeen == true` | update-before-registration placeholder |
| `CommitmentCycle` | `seedSeen == true` | lifecycle-before-seed placeholder |
| `CommitmentSeries` | `creationSeen == true` | update-before-create placeholder |
| `Commitment` | `creationSeen == true` | update-before-create placeholder |
| `CommitmentRequirement` | `creationSeen == true` | decision-before-create placeholder |
| `CommitmentClaimRequest` | `requestSeen == true` | decline/resolution-before-request placeholder |
| `CommitmentContributor` | `additionSeen == true` | remove/decision-before-add placeholder |
| `CommitmentWorkAttribution` | `linkSeen == true` | unlink/decision-before-link placeholder |

Assignments, evidence attributions, exchanges, summaries, history, allocations, and audit rows
are created by their own base events and need no extra seen predicate.

## Surface-to-entity contract

### Availability and pool directory

`useCommitmentPoolingAvailability({ chainId })`

- Backing source: ontology query seam and chain-scoped capability ledger only.
- No GraphQL request runs unless status is `available`.

`useCommitmentPools({ chainId, garden? })`

- `CommitmentPool`: `id`, `chainId`, `poolId`, `garden`, `gardenId`, `poolType`, `state`,
  `charterCID`, open season/campaign ID pairs, provider cap, live/non-terminal/open counts,
  lifetime state counts, exact `commitmentsDue`, `createdAt`, `updatedAt`.
- Predicate: `registrationSeen == true`; optional `garden` filter uses the lowercase bare address.
- `promiseKeptRate` returns `null` when `commitmentsDue == 0`, otherwise the exact rational
  `{ fulfilled: commitmentsFulfilled, due: commitmentsDue }`. Presentation code may format it;
  the selector stores no float.

`useCommitmentPool({ chainId, poolId })`

- Same pool fields plus pool-scoped `CommitmentUnitSummary` rows and
  `CommitmentProviderExposure` rows.
- Unit fields: `scope`, `scopeId`, `unitLabel`, `unitLabelHash`, `expectedUnits`, `approvedUnits`,
  `fulfilledUnits`, `openUnits`.
- Exposure fields: `provider`, `openCommitmentCount`.
- Unit summaries group by exact `unitLabelHash`; values from different hashes never combine.

### Cycle overview and detail

`useCommitmentCycles({ chainId, poolId, cycleType?, state? })`

- `CommitmentCycle`: identity/relationship fields, `cycleType`, `state`, time window,
  `metadataCID`, immutable allocation BPS fields, live/state/open/due counts, timestamps.
- Predicate: `seedSeen == true`.

`useCommitmentCycle({ chainId, cycleId })`

- The cycle row, exact-label cycle `CommitmentUnitSummary` rows, and
  `CommitmentSeriesCycleSummary` rows (`seriesId`, instance/state counts).
- Commitment previews are a separate paginated query filtered by `cycleId` and
  `creationSeen == true`; shared never reads the handler-internal per-cycle index.

### Commitment lists and detail

`useCommitments({ chainId, poolId?, cycleId?, seriesId?, account?, state? })`

- `Commitment`: identity, relationship IDs, direction/kind/on-chain state, creator/recorder,
  lead/counterparty and garden roles, claim terms, unit/value facts, counts, due date, metadata,
  assessment/need/counter references, consideration facts, confirmation provenance, lifecycle
  timestamps, and exact `createdAt`/`updatedAt`.
- Predicate: `creationSeen == true`.
- Account filtering performs the reverse lookup through active `CommitmentContributor` rows with
  `additionSeen == true`; commitment detail joins its contributor IDs through
  `CommitmentContributorIndex`. Neither path reads a commitment-level contributor array.

`useCommitment({ chainId, commitmentId })`

- Base: one seen `Commitment`.
- Requirements: `CommitmentRequirement` rows with `creationSeen == true`; fields are
  `requirementIndex`, `domain`, `actionUID`, `requiredCount`, `approvedCount`.
- Contributors: `CommitmentContributorIndex.contributorEntityIds`, then seen contributor rows;
  fields include active/lead status, credits, uncounted Work, requirement indexes, recognition
  weight, membership provenance and timestamps.
- Assignments: `CommitmentContributorRequirementIndex.assignmentEntityIds`, then
  `CommitmentContributorRequirementAssignment` fields `contributor`, `requirementIndex`,
  `assigned`, and lifecycle cursor.
- Work: `CommitmentWorkAttribution` filtered by `linkSeen == true`; fields include work UID,
  contributor, requirement, linked/credit state, operation key, decision provenance, and
  timestamps.
- Evidence: `CommitmentEvidenceAttributionIndex.attributionEntityIds`, then attribution fields
  `cid`, contributor, attacher, confirmed, and timestamps.
- Claims: `CommitmentClaimRequestIndex.requestIds`, then rows filtered by `requestSeen == true`;
  fields include claimant/requestedBy, claim type, optional garden context, state, reason,
  resolution code, and timestamps.
- Counterpart: `CommitmentCounterIndex.referencingCommitmentEntityIds` plus the direct
  `counterCommitmentEntityId`; every returned commitment must pass `creationSeen == true`.

### Derived commitment state

Shared exposes on-chain state separately as `onchainState` and a presentation state as
`derivedState`. Implemented precedence, highest first:

1. On-chain terminal/dispute states remain authoritative: `DISPUTED`, `CANCELLED`, `EXPIRED`.
2. `RECONCILED`: on-chain `FULFILLED` and a non-zero parent cycle is `RECONCILED` or
   `COMPOSTED`.
3. `FULFILLED` and `READY_FOR_CONFIRMATION` remain their on-chain meanings.
4. `PARTIALLY_APPROVED`: on-chain `ACCEPTED`, at least one requirement/unit is approved, and the
   commitment is not ready.
5. `EVIDENCE_SUBMITTED`: on-chain `ACCEPTED`, evidence exists, and no partial-approval predicate
   wins.
6. `ACTIVE`: on-chain `ACCEPTED` with neither derived progress state.
7. `OFFERED` and `REQUESTED` remain on-chain states. `DRAFT` is local-only and is never derived
   from an unseen indexer placeholder.

This precedence is part of the requested scope lock; Phase 2 tests must pin overlaps such as
evidence plus partial approval and fulfillment before cycle reconciliation.

### Claims, exchanges, and activity

`useCommitmentClaimRequests({ chainId, commitmentId, state? })`

- Uses `CommitmentClaimRequestIndex`, filters every row by `requestSeen == true`, and preserves
  the indexer's on-chain-newer decline/accept/supersession result without reconstructing it.

`useCommitmentExchange({ chainId, poolId, commitmentIdA, commitmentIdB })`

- `CommitmentExchange`: ordered A/B identity, both relationship IDs, both acceptors, transaction
  hash, and accepted timestamp.
- Pair previews also load both seen commitment rows and classify proposed/matched/counterpart-
  lapsed without changing the event-owned exchange result.

`useCommitmentActivity({ chainId, poolId?, cycleId?, commitmentId?, limit, offset? })`

- `CommitmentEvent`: relationship IDs, `eventType`, explicit actor, configuration values, units,
  data, transaction hash, and timestamp.
- This audit entity is suitable for activity feeds, not current-state reconstruction.
- Pagination uses a non-negative GraphQL offset over deterministic `timestamp DESC, id DESC`
  ordering; this source contract does not claim an opaque cursor implementation.

### Series, Need lineage, and Hypercert bundles

`useCommitmentSeries({ chainId, poolId?, holder?, state? })`

- `CommitmentSeries` filtered by `creationSeen == true`; returns identity, pool/holder,
  lifecycle/metadata, instance/state counts, fulfilled cycle IDs, and timestamps.
- `useCommitmentSeriesCycleSummaries` joins `CommitmentSeriesCycleSummary` for cycle storytelling.

`useNeedCommitments({ chainId, needUID })`

- `NeedCommitmentIndex`: commitment, fulfilled commitment, cycle, and Hypercert relationship IDs.
- Every loaded commitment/cycle/series row must pass its own seen predicate.

`useCommitmentHypercertBundle({ chainId, hypercertId })`

- Existing `Hypercert`: `bundleKind`, `commitmentIds`, `commitmentEntityIds`, `needUIDs`, metadata
  reconciliation status, and existing Hypercert display fields.
- `HypercertCommitmentContributorAllocation`: commitment/contributor relationship IDs,
  `recognitionWeightBps`, `commitmentGardenersClassUnits`, `recognitionUnits`.
- Parser rule remains case-sensitive: only literal `"COMMITMENT"` selects the commitment bundle;
  absent/other values remain `WORK_LEGACY`.
- When `metadataReconciliationRequired == true`, the hook returns a typed `metadata-pending`
  result and does not expose the stored `WORK_LEGACY` fallback as a canonical bundle
  classification. The fallback keeps the row processable; the marker preserves the distinction
  between a verified legacy bundle and unresolved metadata.

### Participation disclosure

`usePoolMemberHistory({ chainId, poolId, account, viewer })`

- Backing entity: one `PoolMemberHistory` ID from `getPoolMemberHistoryId`.
- Returned fields only for a visible result: account and the eight integer event counts plus
  `updatedAt`.
- Result is exactly `visible | hidden | unauthenticated`.
- Self is visible. Otherwise visibility requires the viewer's **current** Hats-derived steward
  capability for that pool. A former steward is `hidden`. Query errors and unresolved authority
  fail closed to `hidden` for an authenticated non-self viewer.

`usePoolParticipationSummary({ chainId, poolId })`

- Uses only pool-level counts and the rational `promiseKeptRate` output.
- Returns no account, member row, score, rank, per-person comparison, cross-pool merge, or value
  sum spanning distinct exact `declaredValueBasis` strings.

### Declared-value summaries

`selectDeclaredValueSummaries(commitments)` groups only seen commitments by the exact
`declaredValueBasis` string and omits undeclared pairs. Within one group it may compute
`declaredUnitValue * targetUnits` as an informational integer sum. It never converts, merges, or
compares labels and never emits a cross-basis total.

## Settlement extension after settlement GREEN

The settlement lane is GREEN, so the shared extension implements these reads without adding them
to the offline queue:

| Selector | Backing entities/fields |
|---|---|
| `useCommitmentFunding` | `CommitmentFunding` plus `CommitmentFundingIndex`; pledge/deposit/consume/withdraw/refund identity, amounts, state, and timestamps |
| `useSettlementSubject` | `Disbursement` or `SettlementBatch` joined to exact command, acknowledgment, and Celo execution by message ID and execution key |
| `useCommitmentPayoutPlan` | `CommitmentPayoutPlan`, indexed `ContributorPayout` rows, and child `Disbursement` rows |
| `useSettlementConfigurations` | source/executor router, selector, peer/grace, protocol version, caps, fee policy/reserve, dispatcher, pause, and delivery facts |
| `useSettlementAccount` | source `SettlementAccount` and Celo `SettlementGardenRoute` joined by source chain and bare-address Garden identity |
| online mutations | funding, payout plan editing/finalization/preparation, dispatch/retry/requeue/cancel, account/recovery configuration, and separately gated wallet transfer |

Raw G$ transfers remain outside the indexer boundary. `useSettlementWalletTransfer` is an online
ERC-20 action and is unavailable unless the nullable indexed delivery flag is explicitly true and
the separately recorded Kernel 0.3.1 mainnet evidence gate is true. It is never an offline job.

Core selectors expose the on-chain `considerationRail` and Arbitrum-external
`ConsiderationPaid` facts already on `Commitment`. The settlement extension owns
`CELO_SETTLEMENT` delivery state and never fabricates it from the core row alone.

## Canonical IDs

Phase 2 reuses these exact helper names and formulas from `contract-spec.md` §8.3:

`getCommitmentPoolId`, `getCommitmentCycleId`, `getCommitmentId`,
`getCommitmentSeriesId`, `getCommitmentSeriesCycleSummaryId`,
`getCommitmentContributorId`, `getCommitmentWorkAttributionId`,
`getCommitmentEvidenceAttributionId`, `getCommitmentEvidenceAttributionIndexId`,
`getCommitmentClaimRequestId`, `getCommitmentUnitSummaryId`,
`getCommitmentProviderExposureId`, `getNeedCommitmentIndexId`,
`getCommitmentCounterIndexId`, `getCommitmentExchangeId`, `getPoolMemberHistoryId`, and
`getCommitmentEventId`.

Pending-projection and cycle-index IDs remain indexer-internal. Shared owns its own exported
helpers with the same names/formulas; it does not import indexer handler files.

## Query-key inventory

Add one centralized `queryKeys.commitmentPooling` family:

```text
all(chainId)
availability(chainId)
pools(chainId, garden?)
pool(chainId, poolId)
cycles(chainId, poolId, filters)
cycle(chainId, cycleId)
commitments(chainId, filters)
commitment(chainId, commitmentId)
requirements(chainId, commitmentId)
contributors(chainId, commitmentId)
claims(chainId, commitmentId, state?)
seriesList(chainId, filters)
series(chainId, seriesId)
need(chainId, needUID)
exchange(chainId, poolId, commitmentIdA, commitmentIdB)
hypercertBundle(chainId, hypercertId)
funding(chainId, commitmentId, funder?)
settlementConfiguration(chainId)
settlementAccount(chainId, garden)
settlementSubject(chainId, isBatch, subjectId)
payoutPlan(chainId, payoutPlanId)
memberHistory(chainId, poolId, account, viewer)
participationSummary(chainId, poolId)
activity(chainId, filters)
```

Every address component is normalized through the existing `Address` discipline before key
construction. Invalidation targets the event-owned parent IDs and never flushes unrelated chains.

## Phase 2 implementation result

1. Chain-scoped maturity is implemented in the projections-ledger types/data/generator and exposed
   through the ontology query seam.
2. The requested enums are mirrored exactly in shared and have executable `shared` ontology representations:
   `FundingState`, `DisbursementKind` with `REFUND` last, `HypercertBundleKind`,
   `CommitmentSettlementFlow`, `CommitmentOnchainState`, `CommitmentKind`,
   `CommitmentClaimRequestState`, `CommitmentUnitScope`, `CommitmentSeriesState`,
   `CommitmentConsiderationRail`, and `CommitmentConfirmationPath`.
3. Canonical ID helpers, GraphQL adapters, centralized query keys, and pure selectors are implemented
   before and beneath the React hooks.
4. Shared hooks cover the agreed core and settlement surfaces, including disclosure and
   client/admin raw-entity boundary tests.
5. All six job payloads, restart-safe identity recovery, Saved Offer persistence, and online-only
   mutation paths are implemented. No seventh offline job was introduced.

Source GREEN includes seen-flag fixtures, exact-label/value-basis grouping, derived-state
precedence, member-history disclosure, and the client/admin raw-entity boundary test. Runtime
availability remains a separate human release gate: deploy the hosted schema through Envio,
complete its fresh full sync, read back the agreed entities/queries, then update the chain-scoped
capability ledger from `deployed-not-available` to `available` with that evidence.
