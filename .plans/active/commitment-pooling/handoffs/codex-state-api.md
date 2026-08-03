# Commitment Pooling - Codex State/API Handoff

## Status

- Machine lane: state_api
- Execution sub-lane: state_api
- Owner: Codex
- Branch signal: codex/state-api/commitment-pooling
- Current state: two-phase — core waits for core indexer GREEN; settlement selectors wait for settlement indexer GREEN
- Linear context: PRD-723 (state/API lane) under parent PRD-650

Concurrent agents share this repository. Stay inside this lane's named shared/state paths,
preserve unrelated working-tree changes, and do not switch the primary tree's branch.

## Inputs

- Frozen pooling ABI/events for the core phase; frozen CCIP command/ack and Celo executor ABI/events for the settlement phase
- The 2026-08-01 CPP-alignment amendment (contract-spec decisions 16–17): commitment types carry `counterCommitmentId` and `declaredUnitValue`/`declaredValueBasis`; selectors add the `CommitmentCounterIndex` pair view and the counts-only `PoolMemberHistory` standing read (never a score, percentage, or ranking; value sums only per exact basis). Raw history rows derive from public events and are not confidential. The shared selector requires viewer account plus current pool-steward capability and returns a participant row only for that steward or the member themself; client/admin code must not bind raw history entities, and editorial selectors expose aggregates only.
- GREEN core indexer codegen/build and agreed entity/query contract; settlement entities join only for the settlement phase
- acceptance-matrix.md for shared identity, status, copy, and final-proof contracts
- Existing bare-address `Garden.id` query compatibility plus chain-scoped IDs for every new
  Commitment Pooling entity
- Existing shared queryKeys, mutation-error, IndexedDB job, wallet/passkey, and chain-registry patterns

## Outputs

- Core shared domain types, centralized query keys, EAS/Envio adapters, hooks, selectors, mutation hooks, and invalidation rules, including missing-evidence and Assessment v3 readiness outputs.
- Exchange state/API adds the creation `counterCommitmentId` selector, pair lookup/feed,
  proposed/matched/counterpart-lapsed derivation, and online `acceptExchange` mutation. It exposes
  `CommitmentExchange` as the atomic marker while preserving ordinary commitment queries and
  independent lifecycle invalidation on each side.
- Six offline job kinds: `commitmentSeries`, `commitment`, `claim`, `evidence`, `workLink`, and
  `confirmation`.
- Settlement and ProtocolToGarden funding remain online authority-gated mutations; neither is a
  seventh offline job, per-device attempt, or background queue.
- `commitmentSeries` carries `{ clientSeriesId, poolId, gardenAddress, metadataCID }`.
  `clientSeriesId` is the stable local deduplication and dependency key: an exact retry reuses the
  same queued series record, while a dependent `commitment` job waits without consuming retries
  until the indexed receipt supplies the onchain series ID. Discarding a failed series job leaves
  dependent drafts recoverable and visibly waiting.
- Ordinary Commitment job payloads mirror the full ABI: creation includes cycle, direction, claim type/mode, repeatable
  `{ actionUID, requiredCount }` requirements, contributor policy/roster facts, need, reward
  rail/source/token/amount, evidence, timing, and the explicit `protocolFallbackEnabled`
  selection. DomainImpact creation never accepts caller-authored
  domain tags; the contract derives them from ActionRegistry, while evidence-only types preserve
  their optional validated tags. Evidence jobs serialize the explicit non-empty bounded
  `creditedContributors` address vector and retry with the same vector; claim preserves
  kind/garden context; confirmation is the submit-or-confirm union. Accept/decline, contributor changes, roster freeze,
  assessment attach, Ready submission, and override remain explicit online mutations.
- Online-only Celo wallet transfer action; it never enters the offline queue.
- Explicit Pimlico endpoints for `421614` and `11142220`, plus one typed account-profile registry:
  Kernel `0.2.4` on both testnets for same-address mechanics evidence and Kernel `0.3.1` on
  Arbitrum One/Celo Mainnet for production. Account derivation accepts an explicit profile and
  asserts matching EntryPoint/factory/implementation/initializer/passkey/salt; it never silently
  falls back, infers a version from chain support, or mixes profile components.
- `gardenerDeliveryEnabled` is false for every testnet-profile result. On the nullable indexed
  source field, `null` means unknown/not configured and fails closed exactly like `false`; only an
  explicit `true` may satisfy the delivery selector. Production enablement consumes only the
  separately recorded Kernel `0.3.1` mainnet evidence gate; testnet sponsorship or provider-list
  presence cannot enable the production action.
- Stored claim-request terms and Pending/Accepted/Declined/Superseded selectors.
- Direction-aware confirmation eligibility with every frozen team member excluded. Creation and
  pre-acceptance confirmer-rule selectors expose the Green Goods team fallback as an explicit
  choice, never a default; Ready eligibility accepts it as the structural path only when indexed
  `protocolFallbackEnabled` is true. Confirmation provenance exposes `fulfilledBy`,
  `confirmationPath`, and `fallbackReason` so local garden fallback, protocol fallback, and
  ordinary confirmation never collapse into one boolean.
- Pool/cycle/commitment/dispute recovery selectors.
- Per-action progress exposes `approvedCount / requiredCount`, the registry-derived domain tag,
  credited contributors, and canonical per-commitment `approvedUnits`; one `requirementIndex` can
  credit only its matching registered action requirement.
- Pool/cycle selectors expose state counts, accepted-only `openCommitmentCount`, exact on-chain
  `liveCommitmentCount`, and exact-label `CommitmentUnitSummary` groups. W26 uses
  `liveCommitmentCount` for close/cancel preflight because it includes Offered/Requested rows.
  Terminal `DisputeResolved` outcomes arrive already projected through the indexer's canonical
  lifecycle helper, including Expired dispute reopen/restore/cancel behavior; shared selectors do
  not reconstruct or double-apply those deltas.
  `promiseKeptRate = commitmentsFulfilled / commitmentsDue` is the sole cross-commitment
  percentage; no selector sums unlike unit-label hashes or exposes a synthetic active-progress
  percentage.
- Hypercert metadata composer plus `bundleKind`, fulfilled `commitmentIds`, ascending unique
  `needUIDs`, certificate-scoped contributor allocation rows, and the immutable six-field
  allocation snapshot accepted atomically by `openCycle`
  (never `seedCycle`). Legacy `WORK_LEGACY` bundles remain readable; new commitment bundles
  require fulfilled lineage from one non-zero cycle whose current on-chain state is exactly
  Reconciled. The shared composer used by W26 and `/hub/certify/create` rejects cycle zero and
  every other state before allowlist or metadata construction.
- Settlement precedence and states: Confirmed, Cancelled-from-Queued, Cancelled-from-Failed, authenticated execution Failed, Celo executed/acknowledgment-pending, Dispatched, derived delivery-delayed, Queued, then member-delivery-disabled only when no disbursement exists; `isBatch` remains an explicit command/key domain fact; source/executor pause, matching batch limits, executor caps, native-fee-low, and source-chain-linked Celo Safe/role/peer readiness remain separate capabilities.
- Separate mutations for same-key command retry, stored acknowledgment retry, a new logical attempt after authenticated failure, unbatched-Queued or Failed individual cancellation, and atomic whole-batch cancellation while Queued. Timeout alone never exposes cancellation or new-attempt actions, and a Queued batch member never exposes an individual cancel mutation.
- **Operations capability selectors (this lane owns them; register #69).** `canQueueFunding`
  resolves current protocol-steward authority or `SettlementModule.owner()`; `canOperateSettlement`
  resolves the dispatch/retry/requeue/cancel/configure capabilities the settlement writes already
  check. Both are typed, fail-closed shared selectors — an unresolved or errored read is `false`,
  never an optimistic `true`. `showOperations = isDeployer || canQueueFunding || canOperateSettlement`
  is route visibility only and confers no write authority; the admin lane consumes these rather than
  re-deriving them from `isDeployer`. Deployer status alone can never satisfy `canQueueFunding`, and
  a focused test proves a deployer-only account renders the funding-unavailable state instead of a
  submittable form.
- Exported shared API with no client/admin hooks.

## Acceptance

- All hooks live in @green-goods/shared and use centralized queryKeys.
- Mutations use the shared error pattern and event-driven invalidation.
- All six offline jobs survive restart and dedupe correctly. Tests prove stable
  `clientSeriesId` retry identity, receipt-derived onchain-series materialization, dependent
  Commitment waiting with no retry consumption, and recoverable dependent drafts after a failed or
  discarded series job. No path enqueues an online G$ transfer.
- Request creation/acceptance/decline/supersession and direction-aware confirmation render from canonical stored/indexed data. A small-garden fixture with every local confirmer on the contributor roster blocks when protocol fallback is unselected, becomes Ready when it was selected pre-acceptance, and renders “confirmed by Green Goods team — fallback” only from `PROTOCOL_FALLBACK` provenance. Local fallback and ordinary confirmation use distinct labels, and a contributor is disabled on every path.
- Garden requests expose both canonical GardenAccount claimant and requestedBy operator;
  Individual requests expose the same address for both. Runtime claim type cannot diverge from
  the stored creation type. Claim preflight disables a creator-operated Garden request, and the
  mutation maps the on-chain acceptance-time requester recheck to the same self-claim error.
- Ready selectors expose the onchain charter/provider-open-commitment-cap predicate separately from the current, non-revoked Baseline app preflight, plus evidence, per-action Work approval, and assessment blockers, without treating sentinel `None`/`UNKNOWN` values as renderable identities.
- Ready selectors expose the non-zero verified-contributor gate and either the selected cycle's
  already-opened recognition policy or the immutable cycle-less 20/80 default. Direct
  `Disputed -> Fulfilled` resolution exposes the same gates and frozen-roster outcome.
- Roster mutation selectors expose uncounted linked Work separately from approved Work/evidence
  credit. Leave/remove remains disabled until all three are zero; unlink is available only to the
  steward while the commitment is Accepted, unfrozen, and current Work credit is inactive,
  including after a newer rejection reverses a historical approval.
- Evidence selectors expose every attribution row but treat `evidenceCredits` as a 0-or-1
  participation signal per contributor. Hypercert selectors join integer recognition units
  through `(hypercertId, commitmentId, contributor)` and never read them from or write them onto
  the commitment contributor row.
- The shared payment snapshot helper ABI-encodes chain ID, plan ID, version, retention,
  contributor total, and ordered
  `{ contributor, recipient, recognitionWeightBps, paymentWeightBps, amount }` rows exactly.
  It accepts no child IDs or lifecycle fields, so preparation cannot change the hash.
- Exact label bytes determine unit-summary identity: `hours` and `Hours` render as separate groups. Event replay cannot change any selector result.
- Settlement selectors never merge Queued with Dispatched, never merge derived delay with authenticated failure, never present Dispatched or executed/acknowledgment-pending as arrived, preserve the command's destination-peer/version/payload snapshot and cancellation origin, expose a single atomic cancellation affordance for a Queued batch and none for its members, never hide historical settlement state when member delivery is later disabled, and never offer a new member-delivery action unless `gardenerDeliveryEnabled === true`; both `null` and `false` fail closed.
- Reward selectors enforce the declared rail: `ArbitrumExternal` can surface only core
  `RewardPaid`; `CeloSettlement` can surface only SettlementModule state; `None` has neither.
- Acknowledgment reads preserve the exact originating command-message relationship and stored
  return receiver/version; an older retry ID delivered out of order can join only to its own
  execution key and never to another settlement.
- Garden queries preserve the existing normalized bare-address `Garden.id` contract and include
  `chainId` in query keys/filters where chain identity matters. Commitment Pooling entity queries
  use their own chain-scoped composite IDs; no selector synthesizes a composite Garden primary key.
- Account-profile tests prove that `421614` and `11142220` use the explicit Kernel `0.2.4`
  test profile, `42161` and `42220` retain Kernel `0.3.1`, both members of a profile derive the
  same counterfactual address, unsupported/mixed profiles fail closed, and testnet evidence never
  changes `gardenerDeliveryEnabled`.
- New user-visible shared strings have en/es/pt messages and accessible status announcements.

## RED / GREEN

- RED: add focused shared selector, hook, mutation, query-key, and job tests, including
  `commitmentSeries` payload round-trip, stable deduplication, dependency waiting, receipt
  materialization, and failure/discard recovery; capture expected failures before implementation.
- GREEN: run the same files after implementation with all six offline kinds and the online-only
  transfer exclusion passing, then shared typecheck and story checks for any changed shared
  component.

## Exact Bun commands

The four named shared test files do not exist yet; they are intentional to-be-created RED-first deliverables of this lane.

- bun run --filter @green-goods/shared test -- src/__tests__/commitment-pooling.test.ts
- bun run --filter @green-goods/shared test -- src/__tests__/commitment-jobs.test.ts
- bun run --filter @green-goods/shared test -- src/__tests__/settlement-selectors.test.ts
- bun run --filter @green-goods/shared test -- src/__tests__/settlement-aa-profile.test.ts
- bun run --filter @green-goods/shared typecheck
- bun run --filter @green-goods/shared check:stories
- bun run --filter @green-goods/shared check:story-quality

## Out of scope

- Hooks in client/admin, package-level env files, contract or indexer changes, raw Celo/G$ indexing,
  an offline G$ transfer job, live sponsored UserOperations, the Celo Mainnet canonical-G$ canary,
  manual settlement confirmation, garden-custody claims, credit, rankings, and transferable
  vouchers. Live AA/canary evidence is owned by release operations.

## Unblock evidence

- Core dispatch requires frozen pooling interfaces plus core indexer entity/query/codegen/build proof. Settlement selector work remains blocked until the settlement interfaces and settlement indexer phase are GREEN.
- Composite Garden replay proof is required before switching shared reads, but the live cutover itself is owned by `human-release-ops.md`.
- Manual status.json gate is explicitly cleared.
- RED proof is recorded before shared implementation; final GREEN includes targeted tests and typecheck.

## Binding architecture amendment — 2026-07-28

- Shared types/selectors must expose `leadProvider`, contributor policy/roster/freeze state,
  repeatable requirement inputs versus derived stored fields, the evidence attribution index,
  one-credit-per-Work state, 0-or-1 evidence participation credit, opened cycle policy or
  cycle-less default, zero-eligible inconsistent-state blocking, certificate-scoped Hypercert
  contributor units, recognition/payment snapshot hashes, garden retention, parent
  finalization, stable plan pointer, and contributor child status.
- Mutations cover online-only roster management before the ReadyForConfirmation freeze, atomic
  full-vector payout saves, explicit payout-plan finalization, idempotent per-contributor
  preparation, and child dispatch/recovery through the existing job queue. There is no
  metadata-only recognition-repair mutation. Hooks remain in `@green-goods/shared`.
- Keep recognition and payment as separate read models. Payment weights derive from amounts and may default from recognition, but a receipt is shown only from authenticated settlement confirmation. An all-retained finalized plan completes without creating a child receipt.

## Binding ongoing-Offer amendment — 2026-08-02

- Add the sixth pooling job kind, `commitmentSeries`, plus stable `clientSeriesId` dependency
  resolution. A dependent Commitment waits without consuming retry budget until the series receipt
  supplies its onchain ID; failure/discard leaves the dependent draft recoverable.
- Add canonical series types, query keys, hooks, lifecycle mutations, Story selectors, and
  capacity-backed availability. Hooks remain in `@green-goods/shared`.
- Reusable Offer metadata is signed offchain and private by default. Only an unsaved Offer draft
  may be local-only. Choosing Offer over time and linking it to a pool series is explicit and
  never merges series across pools. Offer once keeps `commitmentSeriesId == 0`.
- No selector computes a personal/series score, rate, rank, inferred participant count, automatic
  renewal, or protocol permission from Story history.
