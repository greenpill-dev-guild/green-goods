# Commitment Pooling - Codex Indexer Handoff

## Status

- Machine lane: state_api
- Execution sub-lane: indexer
- Owner: Codex
- Branch signal: codex/indexer/commitment-pooling
- Current state: specification-ready, dependency-blocked; corrected-and-merged PR #649 and its
  Envio `3.2.1` proof come first, then core pooling indexing waits for implemented/frozen PRD-721
  events. Decision #44's event and read-model shapes are no longer an open architecture question.
  Settlement indexing separately waits for frozen settlement events.
- Linear context: PRD-722 (indexer lane) under parent PRD-650; PRD-673 is historical context

Concurrent agents share this repository. Stay inside this lane's named indexer/spec paths,
preserve unrelated working-tree changes, and do not switch the primary tree's branch.

## Inputs

- Exact event/config tables in contract-spec.md for the core phase; settlement-spec.md joins only in the settlement phase
- acceptance-matrix.md for indexed identity/status/public-state outputs
- Broadcast artifacts or zero-address pre-broadcast placeholders for Arbitrum One `42161`,
  Arbitrum Sepolia `421614`, Celo `42220`, and rehearsal-only Celo Sepolia `11142220`.
  Existing Ethereum Sepolia `11155111` blocks remain legacy-only and unchanged unless the
  pooling contracts are separately deployed there.
- Existing schema.graphql, config.yaml, generated operations, helpers, handlers, fixtures, Envio updater, and boundary checker
- Approved no-EAS/no-Celo-transfer indexing boundary

## Outputs

- Core phase: sixteen pooling entities — pool, cycle, immutable `CommitmentClass`, commitment,
  requirement, claim request, claim-request index, event, `NeedCommitmentIndex`,
  `CommitmentUnitSummary`, `CommitmentProviderExposure`, `CommitmentCounterIndex`,
  `CommitmentExchange`, `CommitmentSeries`, `CommitmentSeriesCycleSummary`, and
  `PoolMemberHistory` — with chainId and chain-scoped composite IDs for the new entities. Their
  Garden relationship fields deliberately retain the documented bare-address `Garden.id`
  compatibility contract. Ten auxiliary contributor/provenance/replay-coordination entities live
  in the same schema but stay outside this core-phase count, including
  `CommitmentContributorRequirementAssignment`,
  `CommitmentContributorRequirementIndex`, `CommitmentPendingLifecycleProjection`, and its
  commitment-keyed index. Pool and cycle each carry an independent nullable lifecycle
  `(blockNumber, logIndex)` cursor; pool charter and provider cap use their own cursor pairs.
  Sparse delivery is represented, never faked: Pool has `registrationSeen`, Cycle has `seedSeen`,
  Series and Commitment have `creationSeen`, claim rows have `requestSeen`, contributor rows have
  `additionSeen`, and Work attribution has `linkSeen`. Base-event-only facts and unrelated cursor
  pairs are nullable until their owning event arrives; ordinary queries exclude unseen
  placeholders while handlers may load them by ID.
  `Commitment.creationRequestKey` and `Commitment.creationPayloadHash` are both **emitted
  parameters of `CommitmentCreated`** (amendment 2026-08-05, contract-spec §6.1 "Creation payload
  hash (frozen preimage)"). Assign each verbatim from `event.params`. Never recompute the hash,
  never derive it, never leave it null on a seen creation, and never satisfy it with an RPC read —
  the no-RPC-backfill rule and this required field are consistent only because the event carries it.
  The commitment entity also carries creation key/hash, immutable acceptance position,
  `creationSeen`, `acceptanceSeen`, `frozenContributorCount`, nullable
  `memberHistoryOutcome`, `fulfilledParticipantHistoryApplied`, `counterCommitmentId`,
  `declaredUnitValue`/`declaredValueBasis`, independent value, consideration, confirmer-rule, and
  lifecycle cursor pairs, immutable `payerGarden`/`payerGardenId`, `protocolFallbackEnabled`, `fulfilledBy`, nullable
  `confirmationPath`, `fallbackReason`, and derived `fulfilledByFallback`. Contributor membership,
  requirement assignment, and Work link membership each own independent event-position cursors.
  `ConfirmerRuleSet` is the only authority for the opt-in. `CommitmentFulfilled` is the only
  authority for confirmation actor/path/reason; `DisputeResolved -> Fulfilled` leaves
  confirmation-only fields null. Creation events initialize independently mutable state only when
  its cursor is absent; every later projection applies only when its own cursor wins.
  Contract-spec §8.3's handler rules bind reverse-index append/idempotency, atomic-marker
  treatment, lifecycle projection, late-fact reconciliation, signed commutative register deltas,
  and deterministic relationship ordering.
- `ExchangeAccepted` creates one `CommitmentExchange` marker keyed
  `chainId-EXCHANGE-poolId-idA-idB`, using the event's non-indexed `poolId` without an RPC read or
  prior commitment row. Entity existence proves atomic acceptance. The two ordinary
  `CommitmentAccepted` events remain the only lifecycle, unit, provider-slot, and member-history
  inputs. The same transaction emits `ContributorAdded(A, A.creator)` and
  `ContributorAdded(B, B.creator)` to seed the two lead roster rows; `ExchangeAccepted` substitutes
  for neither contributor event and never applies any delta a third time. Pair status joins the
  two ordinary commitments and never mutates either after cancellation, expiry, dispute, or
  fulfillment. Each ordinary `CommitmentAccepted` handler attempts to mark its matching request
  Accepted when present, then independently loads the commitment's request index and marks every
  other still-Pending row Superseded. The sweep runs even when the accepted counterpart has no
  request row, so exchange acceptance clears pending requests for both A and B without a scan.
- `PoolMemberHistory` is public event-derived index data. The indexer does not claim row-level confidentiality; it exposes no public ranking or comparison query. Shared viewer-aware selectors own steward/self product disclosure, and editorial consumers receive aggregates only.
- Pool-less `ModuleUpdated`, pooling dependency/schema/pause events use the generic
  `CommitmentEvent.configurationKey/previousValue/newValue` audit fields, never a synthetic pool
  zero, and never mutate accounting entities.
- Settlement phase: Arbitrum settlement account/disbursement/batch/message entities; Celo `SettlementGardenRoute`, bounded `CeloSettlementExecutor` execution, and acknowledgment-message entities; and one chain-composite `SettlementConfiguration` singleton per source/executor chain carrying role, local contract/router, nullable remote selector, nullable verified `remoteEvmChainId`, nullable active/previous peer + expiry, protocol version, pause state, source/executor batch limit, executor transfer/aggregate/period caps, dispatcher where applicable, native-fee floor/balance/low state, peer readiness, and nullable source-only `gardenerDeliveryEnabled`. Null means the source fact is unknown/not configured and can never satisfy readiness; only explicit `true` enables gardener delivery.
- `CommitmentPayoutPlan` carries provider and payer relationships, immutable `payoutKind`, general
  payable/prepared/confirmed/failed/cancelled counters, and nullable beneficiary garden/Safe/child
  fields. `ContributorConsideration` buffers versioned contributor snapshots;
  `GardenBeneficiary` accepts no contributor rows and binds its one child directly from
  `DisbursementQueued`. Derive `CommitmentSettlementFlow` as `INTERNAL`,
  `PROTOCOL_TO_GARDEN`, `GARDEN_TO_PROTOCOL`, or reserved `GARDEN_TO_GARDEN` from immutable
  payer/provider plus write-once protocol garden; never infer it from recipient/source addresses.
  The fact describes intended settlement direction, not later Celo token circulation.
- Source `SettlementConfiguration` additionally persists the write-once protocol garden/canonical
  G$ plus event-owned Hats and CommitmentPoolingModule dependency addresses; handlers update those
  trust roots only from their exact old/new events.
- Exact pooling blocks for `CommitmentPoolingModule` and `CommitmentRegistry` on `42161` and
  `421614`; exact `SettlementModule` blocks on `42161` and `421614`; and exact
  `CeloSettlementExecutor` blocks on `42220` and rehearsal-only `11142220`. The `11142220`
  network uses explicit `rpc_config` rather than assumed HyperSync coverage. Every address is a
  deployment-artifact placeholder before broadcast and a verified persisted address afterward;
  handlers remain idempotent create-if-not-exists.
- Deployment-block configuration seeds generated from verified artifacts: every component carries
  role, local contract/router, and exact decimal-string local selector; only the verified
  production `42161`↔`42220` pair must carry the remote CCIP selector and paired remote EVM chain
  ID. Independent `421614`/`11142220` component rehearsals retain null `remoteEvmChainId`,
  `peerConfigured = false`, and no cross-chain relationship output unless a fresh official
  directory/API read publishes the exact lane/router. Mutable configuration remains event-owned,
  and any missing/rounded/mismatched required seed fails preservation.
- Corrected and merged PR #649 is a hard prerequisite. The lane targets Envio `3.2.1`, re-reads
  that version's config schema, and must not copy the v2-only `unordered_multichain_mode` flag.
  Root commands and the PR test plan remain Bun-first; generated Envio/ReScript internals may use
  the package-local pnpm pin where the tool requires it.
  Configuration rows seed from generated verified deployment constants on the first relevant
  protocol event; no imaginary deployment-block callback is assumed. Celo Sepolia uses
  `rpc_config` because HyperSync coverage is not assumed.
- The pooling ID namespace supports exactly one canonical UUPS
  `CommitmentPoolingModule` / `CommitmentRegistry` proxy pair per chain. Implementation upgrades
  keep those addresses. The updater and boundary checker reject a duplicate same-chain block or
  proxy replacement unless a separately approved migration introduces a versioned entity
  namespace and full replay. Saved Offer `moduleAddress` is a fail-closed client link key, not a
  multi-module indexing contract.
- Commitment-keyed request index that marks accept/decline/supersede without a database-wide scan.
  Each request row owns a lifecycle cursor. A late `ClaimRequested` delivered after a newer
  acceptance materializes as Accepted for the winning claimant or Superseded for every other
  claimant; after a newer cancellation/expiry it materializes Superseded. It can never revive an
  actionable Pending row behind the commitment result. `ClaimDeclined` also upserts the
  claimant-keyed row and request index when it arrives first: `requestSeen = false`, request-only
  payload null, state Declined, and the decline cursor/reason retained. An older Request later
  fills payload without revival; only a genuinely newer request may advance the cursor and return
  to Pending.
- Preserve `Garden.id` as the normalized bare GardenAccount address with explicit `chainId`.
  `gardenId`, `providerGardenId`, `payerGardenId`, and `gardenContextId` relationship helpers store that existing ID;
  every new Commitment Pooling entity retains its own chain-scoped composite ID. No Garden
  primary-key migration or mixed-ID compatibility layer is permitted.
- Nullable generic audit actor populated only from explicit event parameters, never transaction.from.
- Commitment read model persists provider, bare-address providerGarden relation, preDisputeState,
  nullable lifecycle cursor, positional requirement rows (`requirementIndex`, domain/action,
  required/approved counts), the per-commitment `approvedUnits` value emitted by the contract, and
  explicit `ConsiderationRail` plus derived consideration facts. `considerationRecipient` is the ArbitrumExternal
  `ConsiderationPaid` recipient only; a Celo beneficiary lives on the settlement `Disbursement`. Hypercert
  persists `bundleKind`, composite fulfilled-commitment relationships, ascending unique Need UIDs,
  legacy Work-bundle readability, and certificate-scoped
  `HypercertCommitmentContributorAllocation` rows; integer recognition units never live on or
  overwrite the commitment contributor.
- `CommitmentUnitSummary` is keyed by `chainId-scope-scopeId-unitLabelHash`, where the hash is computed from exact stored UTF-8 label bytes. POOL and CYCLE rows keep expected, approved, fulfilled, and open units only for that exact hash; `hours` and `Hours` never merge.
- `CommitmentProviderExposure` is keyed by chain, pool, and provider and stores only the current open commitment count.
- One replay-idempotent, cursor-ordered lifecycle helper applies every current-state pool/cycle,
  member-history, attribution-confirmation, Need-lineage, and `liveCommitmentCount` delta.
  A commitment placeholder has `creationSeen = false`. Accepted, Ready, confirmation, dispute, and
  terminal events that need immutable creation facts write one typed pending projection keyed by
  their audit event and return without consuming the lifecycle cursor or applying side effects.
  `CommitmentCreated` fills the facts, applies its base projection, and drains the explicit
  commitment-keyed pending IDs in block/log order within the same handler transaction.
  `CommitmentDisputed`, `CommitmentFulfilled`, `CommitmentCancelled`, `CommitmentExpired`, and
  terminal `DisputeResolved.finalState` all use that shared projection path. Expired-to-Disputed
  reverses the current Expired bucket and re-increments a cycle's live count;
  RestorePrevious-to-Expired or resolution-to-Cancelled applies exactly one final bucket and
  decrements once. Unit summaries and provider exposure remain owned only by their self-describing
  unit events.
- `CommitmentPool.liveCommitmentCount` mirrors every non-terminal commitment in the pool,
  including cycle-less rows, and follows the same reversible transition helper.
  `CommitmentPool.nonTerminalCycleCount` increments on seed and decrements once on cancel or
  compost. `PoolClosed` may project only when both are zero.
- Pool charter, provider cap, commitment consideration, contributor membership, contributor requirement
  assignment, and Work link lifecycle each compare an independent `(blockNumber, logIndex)`
  cursor. `CommitmentContributorIndex`, its requirement-assignment companion, request/evidence/
  Need/counter indexes, and every other set-like relationship array are de-duplicated and sorted
  deterministically; only pending lifecycle projections use event-position order.
- Terminal member history is a separate idempotent side projection so older acceptance and roster
  events can complete a newer terminal outcome. `CommitmentAccepted` always stores the immutable
  lead/receiver facts and sets `acceptanceSeen`, even when its lifecycle tuple is older than the
  current cursor. `ContributorRosterFrozen` stores the emitted exact roster count. The terminal
  projector and the Accepted, ContributorAdded/Removed, and roster-freeze handlers all call the
  same reconciler. A nullable `memberHistoryOutcome` owns the reversible lead bucket; Fulfilled
  participant history waits until acceptance is seen and the bounded contributor index contains
  the exact frozen active roster, then flips `fulfilledParticipantHistoryApplied` once.
- `CommitmentCycle.liveCommitmentCount` mirrors the on-chain close/cancel guard independently of
  provider-capacity exposure: non-zero-cycle `CommitmentCreated` increments it, every live-to-terminal
  Fulfilled/Cancelled/Expired transition decrements it, and the Expired dispute reopen/resolve pair
  re-increments/decrements it exactly once. Offered/Requested rows therefore block close in the
  indexed read model exactly as they do on-chain.
- Unit and exposure totals are unique-event signed commutative deltas, not last-delivered
  assignments. Commit/Release/Fulfill permutations converge to the same final counts and
  exact-label units; `updatedAt` is the maximum event position.
- Generated-config preservation changes and a regression fixture proving
  `CommitmentPoolingModule`, `CommitmentRegistry`, `SettlementModule`, and
  `CeloSettlementExecutor` blocks survive repeated artifact updates on every applicable
  production/component-rehearsal network without turning the two Sepolia components into a peer
  pair.
- Codegen/generated artifacts, handler tests, build proof, and query contract for shared.

## Acceptance

- Every new Commitment Pooling entity has `chainId` and a chain-scoped composite ID. The documented
  exception remains `Garden.id`, which is the normalized bare address and still carries `chainId`;
  Garden relationship helpers resolve to that existing ID without changing it.
- Celo routes, executions, Garden/account joins, and command/ack message directions require the
  verified configuration seed's non-null `remoteEvmChainId`; handlers fail closed when it is null
  and never translate selectors into EVM chain IDs or substitute the local Celo event chain.
- Full replay preserves existing raw-address Garden lookup compatibility while every new
  commitment/settlement row remains chain-distinct through its own ID and `chainId`.
- Handlers are idempotent, tolerate out-of-order events, update both sides of relationships, and
  never infer immutable creation facts from RPC. A lifecycle event delivered before
  `CommitmentCreated` remains pending and applies only after creation facts exist; the creation
  handler drains the typed queue atomically without a database scan or externally visible
  intermediate count.
- Pool and cycle lifecycle fixtures deliver Open/Pause/Resume/Close/Compost/Reopen and
  Open/Close/Compost/Cancel events in both orders, before and after `PoolRegistered` or
  `CycleSeeded`, with duplicates. Their independent cursor pairs make every permutation converge
  to the latest state, pause reason, open Season/Campaign relationships, and `updatedAt`. A
  reverse-delivered `CycleOpened` still fills its immutable allocation and recognition snapshots
  once without reopening a cycle whose newer lifecycle cursor already won.
- Lifecycle fixtures prove ordinary Fulfilled/Cancelled/Expired and every terminal
  `DisputeResolved` outcome share one projection path. They cover
  `Accepted -> Disputed -> Fulfilled`, `Ready -> Disputed -> Cancelled`,
  `Expired -> Disputed -> RestorePrevious(Expired)`, and
  `Expired -> Disputed -> Cancelled`, including duplicate delivery and every lifecycle sequence
  both before and after `CommitmentCreated`. Each fixture asserts that a pre-creation event does
  not consume the commitment lifecycle cursor or mutate state-derived counters, the creation drain
  marks each pending row applied once, and the final read model has one current member-history
  outcome, exact pool/cycle and series state counts, exact `liveCommitmentCount`, Fulfilled
  attribution/Need lineage, and no duplicated unit/exposure delta.
- Late-fact member-history fixtures cover Fulfilled before `CommitmentAccepted`, before
  `ContributorAdded`, before `ContributorRosterFrozen`, and with the roster-freeze event before
  its contributor rows; they also cover Cancelled/Expired before Accepted. Every permutation and
  duplicate delivery converges to one lead outcome, the exact frozen Fulfilled participant set,
  and no second history delta.
- Confirmation fixtures prove the complete `ConfirmerRuleSet` tuple is gated by its independent
  `(blockNumber, logIndex)` cursor. They cover creation→update, update→creation, duplicates, and
  opposing opt-in/opt-out updates delivered in either order; every order converges to the latest
  emitted threshold, confirmer list, and `protocolFallbackEnabled` value without changing
  `updatedAt` for an older event. `CommitmentFulfilled` persists its emitted confirmer and exact
  `ORDINARY` / `POOL_FALLBACK` / `PROTOCOL_FALLBACK` path; only the two fallback paths set
  `fulfilledByFallback`, only fallback paths retain a non-empty `fallbackReason`, and no handler
  classifies a caller from `transaction.from`. A terminal `DisputeResolved -> Fulfilled` keeps
  confirmation-only fields null. Reader copy can therefore distinguish “confirmed by Green Goods
  team — fallback” from a local garden fallback or ordinary counterparty confirmation.
- ApprovalGated claim acceptance consumes the stored request identity and supersedes only
  still-pending sibling requests through the companion index; Open acceptance has no request row
  and stores the emitted authenticated requester as the Garden Request lead. Reverse fixtures
  also deliver acceptance/cancellation/expiry before the older ClaimRequested row and prove the
  late row materializes Accepted or Superseded, never Pending. A separate decline-first fixture
  delivers `ClaimDeclined` before its older `ClaimRequested`, proves the terminal placeholder is
  indexed immediately, then proves the late payload fill leaves the row Declined; a newer
  post-decline Request is the only case that returns it to Pending.
- Evidence replay preserves every distinct attribution row but changes a contributor's
  `evidenceCredits` only on the first 0-to-1 transition. Multiple CIDs attributed to the same
  contributor never multiply recognition, while the first attribution to another contributor
  adds exactly one participation credit.
- A `COMMITMENT` ClaimStored replay upserts
  `HypercertCommitmentContributorAllocation` by
  `chainId-hypercertId-commitmentId-lowercaseContributor`. Reusing one fulfilled commitment in
  two Hypercerts produces distinct unit rows and never overwrites either certificate or the
  contributor's stable commitment-level `recognitionWeightBps`.
- Commitment cancellation/expiry supersede still-pending requests through the same companion index; no terminal commitment retains an actionable Pending row.
- Contributor fixtures reverse Add/Remove and assignment true/false events and prove independent
  latest-wins membership/assignment rows, deterministically sorted indexes, and an exact active
  frozen roster. Work fixtures reverse Link/Unlink separately from approval/reversal sequence and
  prove neither cursor suppresses the other.
- `ApprovedWorkCounted` and `ApprovedWorkReversed` update exactly the matching
  `requirementIndex`, replace that row's cumulative count, and store the event-emitted
  per-commitment `approvedUnits`. The count event adds `newlyApprovedUnits`; the reversal event
  subtracts `removedApprovedUnits` from only the matching exact-label pool/cycle summary.
  `UnitsReleased` and `UnitsFulfilled` update only that same label hash; cumulative event values
  are never summed or re-derived.
- `CommitmentAccepted` stores its immutable event position plus the canonical claimant/counterparty/provider/providerGarden and
  resolves claim-request rows, but it never mutates count exposure. `UnitsCommitted` is the
  sole increment for pool/cycle open counts and `CommitmentProviderExposure`; `UnitsReleased`
  and `UnitsFulfilled` are the sole decrements. Fulfillment, accepted cancellation, and
  accepted expiry therefore change exposure only through the emitted register event. Dispute
  entry/restoration emits no register delta and preserves the count. Replaying any event leaves
  summaries and exposure unchanged. All unit-event order permutations converge through signed
  commutative deltas rather than delivery-order assignment.
- Unit events are independently self-describing with `poolId`, `cycleId`, and exact
  `unitLabel`; an event arriving before `CommitmentCreated` still produces the final canonical
  IDs. `cycleId == 0` never creates or mutates a cycle summary.
- `ModuleUpdated` creates one pool-less `CommitmentEvent` with
  `eventType = MODULE_UPDATED`, `configurationKey = null`, the normalized old/new module
  addresses in generic `previousValue`/`newValue`, and null
  pool/cycle/commitment relationships. It mutates no accounting row, never invents pool `0`, and
  never infers an actor from `transaction.from`.
- Pool/cycle entities retain state counts and expose no raw-unit aggregate fields; no handler or query adds unlike label hashes.
- Queued, Dispatched, Celo executed/acknowledgment-pending, Confirmed, authenticated execution Failed, transport-delayed, same-key command retry, acknowledgment retry, and per-member recovery remain distinguishable.
- `DisbursementCancelled` persists whether an individual cancellation came from an unbatched Queued item or from an authenticated Failed result; a failed member is never made to look like a pre-dispatch withdrawal.
- `BatchCancelled(uint256 indexed batchId,address indexed actor,string reasonCID)` atomically marks the still-Queued batch and every immutable member Cancelled-from-Queued in one replay-idempotent handler. No indexed state can present a partially cancelled Queued batch.
- `SettlementExecutionStored` records the bounded Celo executor transaction, exact authenticated acknowledgment receiver, decoded `isBatch`, settlement ID, and attempt, and derives acknowledgment-pending without waiting for an Arbitrum join. `AcknowledgmentDeferred` stores the bounded quote/reserve/send deferral code; only Arbitrum `SettlementAcknowledged(success=true)` makes canonical state Confirmed.
- `AcknowledgmentSent(...,fee,reserveFunded)` decrements the indexed CELO reserve only when `reserveFunded == true`; an exact caller-funded retry creates its message row without reducing protocol reserves. Arbitrum command sends always reduce the source reserve by their emitted fee.
- Every command/ack message row is chain-composite and replay-idempotent. Source command rows preserve the snapshotted destination peer, gas, version, and payload hash; every acknowledgment's originating command ID joins to the same execution key even when it is an older retry ID delivered out of order. Duplicate/out-of-order messages never duplicate settlement execution or make a previous peer look authoritative for a new command. Message `fee` is nullable on receipt-only rows because the destination receipt event does not emit the source-chain fee.
- `isBatch` is preserved on every source message and Celo execution record and participates in the canonical execution-key domain. Same-numbered disbursement and batch subjects never join to one command/execution row, including under inverted cross-network replay order.
- The preservation fixture runs the updater twice and retains the exact pooling/register blocks
  on `42161`/`421614`, Arbitrum route/batch-limit/pause/dispatcher/reserve/cancellation
  signatures (including `BatchCancelled`) on `42161`/`421614`, and all fourteen Celo executor
  signatures (including `FeePolicyUpdated`) on `42220`/`11142220`; unknown EAS or raw Celo
  token blocks still fail.
- The same fixture seeds the full source/executor pairing only for production from verified
  deployment metadata. It preserves independent `421614` and `11142220` component rows with null
  remote EVM identity and non-ready peer state, and rejects a missing local contract or router,
  numeric/rounded selector, wrong deployment block, contract-block mismatch, or fabricated
  Sepolia pairing.
- Envio reads only Green Goods protocol events.
- Adding direct `viem@2.55.0` requires the repository owner's explicit dependency approval at
  implementation time. It matches the root pin; Envio's internal viem version is not imported
  or treated as the application hashing API.

## RED / GREEN

- RED: `test/commitmentPool.test.ts`, `test/settlement.test.ts`, and `test/gardenIdentityCompatibility.test.ts` are explicit to-be-created first-failing deliverables; focused handler/compatibility/preservation fixtures, including pool/cycle opposing-state reverse-delivery permutations, fail before schema, config, helper, and handler changes.
- GREEN: the same fixtures pass after codegen; generated operations expose every entity; setup-generated, boundary, tests, and build pass.
- Generated ReScript setup runs through the exact pnpm `10.33.2` Corepack pin declared by
  `packages/indexer/package.json`. The root monorepo remains `bun@1.3.14`; no generated-workspace
  command may walk up to or replace that root package-manager declaration.

## Exact Bun commands

- bun run --filter @green-goods/indexer codegen
- bun run --filter @green-goods/indexer setup-generated
- bun run --filter @green-goods/indexer check:indexing-boundary
- bun run --filter @green-goods/indexer test -- test/commitmentPool.test.ts
- bun run --filter @green-goods/indexer test -- test/settlement.test.ts
- bun run --filter @green-goods/indexer test -- test/gardenIdentityCompatibility.test.ts
- bun run --filter @green-goods/indexer build

The three named test files do not exist yet; they are intentional RED-first deliverables of this
lane and must be created before their commands can pass.

## Out of scope

- EAS attestation indexing, raw Celo/G$ transfer indexing, arbitrary Celo token ingestion, contract changes, UI, Sarafu ingestion, and credit/ranking entities.
- A Garden primary-key migration or mixed Garden-ID compatibility layer.

## Unblock evidence

- Corrected PR #649 is merged and its generation, build, tests, migration/replay, and block
  preservation proof pass before Commitment Pooling adds entities or handlers.
- Core dispatch then requires pooling event signatures frozen and identical between contract-spec and Envio config. Settlement handlers use the frozen Arbitrum command/ack and Celo executor signatures in settlement-spec; core GREEN must not be reported as full settlement GREEN.
- Garden identity compatibility proof, full new-schema replay procedure, pre-replay snapshot,
  switch criterion, rollback package, and accountable owner Afolabi Aiyeloja are named. The
  implementer produces the rehearsal; `human-release-ops.md` owns the authorized live cutover.
- Updater/boundary allowlist changes and preservation fixture are part of the lane.
- RED fixture evidence is recorded; final GREEN includes codegen, generated build, boundary check, targeted handlers, and package build.

## Binding architecture amendment — 2026-07-28

- Index `CommitmentRequirement`, `CommitmentContributor`, contributor indexes, and Work/evidence
  attribution without positional-domain assumptions. Maintain
  `CommitmentContributor.uncountedLinkedWorkCount` from WorkLinked, WorkUnlinked,
  ApprovedWorkCounted, and ApprovedWorkReversed. Track the emitted resolver-owned
  `latestDecisionSequence`, audit UID, and active-credit state from those explicit events; a
  reversal restores the uncounted-linked count and removes one
  contributor credit before freeze. The unlink handler resolves the contributor from the
  existing Work attribution row before removing it. `CommitmentEvidenceAttributionIndex` owns the
  stable IDs loaded on fulfillment; no handler scan is permitted. Evidence rows remain repeatable
  provenance, but the handler mirrors the 0-or-1 on-chain `evidenceCredits` value per contributor
  instead of incrementing it for every CID.
  `WorkUnlinked` remains valid whenever the durable attribution's current `creditActive` is false,
  including after `ApprovedWorkReversed`; a historical approval delivery marker is never used as
  current-credit state.
- Materialize the recognition inputs and deterministic gardener-share output: equal budget per
  fulfilled commitment, then the cycle's opened recognition policy or the immutable cycle-less
  20/80 default among eligible contributors. Only the frozen effective Work decision contributes.
  Expand each commitment's 10,000-bps vector into its integer unit budget using the canonical
  largest-fractional-remainder and ascending-address tie-break pass. Zero eligible contributors
  produce a blocking W26 inconsistent-state review item, never a lead fallback or metadata repair.
  Keep stable bps on `CommitmentContributor`, and persist each integer result on
  `HypercertCommitmentContributorAllocation` so every certificate owns an immutable allocation
  snapshot even when commitments are bundled again.
- Index `CommitmentPayoutPlan` and `ContributorPayout`; creation freezes the plan kind, payer,
  provider, and beneficiary fields. Draft events carry no child ID. A later
  `DisbursementQueued(kind=ContributorConsideration)` binds one prepared child to its stable
  contributor row; `GardenBeneficiary` binds the plan's one beneficiary child pointer.
  Buffer every version-tagged `ContributorPayoutSet` row by `(payoutPlanId,
  paymentSnapshotVersion)` and atomically publish a replacement only when the trailing
  `CommitmentPayoutSnapshotCommitted` row count and payment hash match; that event owns retention,
  contributor total, version, reason, and actor without an RPC read. Recompute the hash only from
  chain ID, plan ID, version, retention, contributor total, and the ordered immutable
  `{ contributor, recipient, recognitionWeightBps, paymentWeightBps, amount }` rows. Never hash
  disbursement IDs or child counters; there is no inclusion flag, because a row is payable
  exactly when its `amount > 0` (register #70). Keep payment weights
  amount-derived and derive parent status from finalization, general unprepared payable count, and
  child counters. A beneficiary plan has one payable row and cannot be Complete before its child
  is Confirmed. Acknowledgment/failure/requeue/cancel applies the same parent-counter update to
  both commitment-bound kinds and never clears their stable pointers. Do not infer payment from
  Hypercert weights or raw token transfers.
- Migration/replay fixtures must include solo lead, multi-person team, roster freeze at
  `ReadyForConfirmation`, every direct terminal `DisputeResolved` outcome, the exact reversible
  `Expired -> Disputed -> RestorePrevious/Cancelled` projection, duplicate/reverse lifecycle
  delivery with Accepted/Ready/terminal events arriving before creation and draining only after
  immutable facts exist, one-credit-per-Work replay, stale catch-up rejection before mutation, unlink after
  effective rejection, exact `liveCommitmentCount` including Offered/Requested,
  declared-value creation→update, update→creation, duplicate delivery, and two-update
  forward/reverse delivery with the same latest `(blockNumber, logIndex)` winner,
  one-evidence-participation-credit across multiple CIDs, the same commitment in two
  certificate-scoped allocation snapshots, opened
  cycle policy and cycle-less default, zero-eligible inconsistent-state blocking with no metadata
  repair, version-1 untouched-plan replay with the canonical immutable-row hash, a later complete
  version replacement, child preparation that leaves the hash unchanged, incomplete or
  mismatched snapshot rejection, reasoned payment correction, all-retained zero-child finalization,
  idempotent preparation, stable pointer after child/batch cancellation, duplicate-recipient batch
  rejection, partial payout, retry, and complete payout.

## Binding CommitmentSeries amendment — 2026-08-02

- Add `CommitmentSeries`, `CommitmentSeriesCycleSummary`, the nullable Commitment series
  relationship, series event handlers, and composite ID helpers exactly as specified in
  `standing-commitments-spec.md`.
- Give `CommitmentSeries` separate lifecycle and metadata cursor pairs. Lifecycle events compare
  only the lifecycle cursor; metadata events compare only the metadata cursor; creation fills
  immutable placeholder facts and initializes a mutable field only when that field has no later
  same-type cursor. One cross-type event may never suppress the other field's update.
- Reuse the cursor-ordered reversible lifecycle projection to maintain exact current state counts
  for the series and its non-zero-cycle summary, including dispute reopen/restore paths. Append a
  fulfilled cycle ID once. Cycle zero never creates a series-cycle row.
- Available count derives from current capacity-backed Offered instances. Do not add participant
  counts, rates, rankings, reliability fields, cross-pool groupings, or mixed-label unit sums.
- RED/GREEN includes inverted creation/lifecycle order, metadata-before-Rest,
  lifecycle-before-metadata, later-metadata-before-earlier-Rest, later-Resume-before-earlier-
  metadata, same-type stale/duplicate delivery, prospective metadata, mixed outcomes across
  cycles, exact replay convergence, duplicate/replacement same-chain pooling block rejection, and
  an exchange pair whose A and B each have pending requests but neither accepted counterpart has
  a request row; both indexes must converge with no Pending rows and no database scan.


## Audit note (2026-08-10, prototype-registry drift audit)

Two findings for this lane from the cross-stack audit:

1. **Dangling foreign keys already shipped**: `schema.graphql` carries
   `CommitmentPayoutPlan.commitmentEntityId: String!` and
   `Disbursement.commitmentEntityId: String` with no `Commitment` entity to
   join — the settlement half landed ahead of the pooling half. When this lane
   dispatches, the Commitment entity family must land with ids matching what
   the settlement handlers already write into those fields.
2. **`CLAUDE.md` boundary line updated 2026-08-10** to name settlement and
   (when this lane ships) commitment pooling as in-boundary; the enforceable
   boundary of record is `packages/indexer/scripts/check-indexing-boundary.mjs`.
