# Commitment Pooling - Codex State/API Handoff

## Status

- Machine lane: state_api
- Execution sub-lane: state_api
- Owner: Codex
- Branch signal: codex/state-api/commitment-pooling
- Current state: two-phase — core waits for core indexer GREEN; settlement selectors wait for settlement indexer GREEN
- Linear context: PRD-723 (state/API lane) under parent PRD-650

## Inputs

- Frozen pooling ABI/events for the core phase; frozen CCIP command/ack and Celo executor ABI/events for the settlement phase
- GREEN core indexer codegen/build and agreed entity/query contract; settlement entities join only for the settlement phase
- acceptance-matrix.md for shared identity, status, copy, and final-proof contracts
- Composite Garden-ID query cutover
- Existing shared queryKeys, mutation-error, IndexedDB job, wallet/passkey, and chain-registry patterns

## Outputs

- Core shared domain types, centralized query keys, EAS/Envio adapters, hooks, selectors, mutation hooks, and invalidation rules, including missing-evidence and Assessment v3 readiness outputs.
- Six offline job kinds: five member-created field kinds (`commitment`, `claim`, `evidence`,
  `workLink`, `confirmation`) plus the system-created `settlement` follow-up.
- Job payloads mirror the full ABI: creation includes cycle, direction, claim type/mode, positional `domains[]` / `requiredActionUIDs[]` / `requiredApprovedWorkCounts[]`, need, reward rail/source/token/amount, evidence and timing; claim preserves kind/garden context; confirmation is the submit-or-confirm union. Accept/decline, assessment attach, Ready submission, and override remain explicit online mutations.
- Online-only Celo wallet transfer action; it never enters the offline queue.
- The app creates `settlement { commitmentId, gardenAddress }` only after the indexer exposes an
  eligible Fulfilled `CeloSettlement` commitment without a live disbursement. Its executor
  permissionlessly calls `queueDisbursement(commitmentId)`, treats that commitment's exact existing
  live pointer as idempotent success, and never mutates or rolls back Fulfilled on exhaustion.
- Explicit Pimlico endpoints for `421614` and `11142220`, plus one typed account-profile registry:
  Kernel `0.2.4` on both testnets for same-address mechanics evidence and Kernel `0.3.1` on
  Arbitrum One/Celo Mainnet for production. Account derivation accepts an explicit profile and
  asserts matching EntryPoint/factory/implementation/initializer/passkey/salt; it never silently
  falls back, infers a version from chain support, or mixes profile components.
- `memberDeliveryEnabled` is false for every testnet-profile result. Production enablement consumes
  only the separately recorded Kernel `0.3.1` mainnet evidence gate; testnet sponsorship or
  provider-list presence cannot enable the production action.
- Stored claim-request terms and Pending/Accepted/Declined/Superseded selectors.
- Direction-aware confirmation eligibility and provider exclusion.
- Pool/cycle/commitment/dispute recovery selectors.
- Per-action progress exposes `approvedWorkCounts[i] / requiredApprovedWorkCounts[i]` and canonical per-commitment `approvedUnits`; one `requirementIndex` can credit only its matching domain/action position.
- Pool/cycle selectors expose state counts, `openCommitmentCount`, and exact-label `CommitmentUnitSummary` groups. `promiseKeptRate = commitmentsFulfilled / commitmentsDue` is the sole cross-commitment percentage; no selector sums unlike unit-label hashes or exposes a synthetic active-progress percentage.
- Hypercert metadata composer plus `bundleKind`, fulfilled `commitmentIds`, ascending unique `needUIDs`, and the immutable six-field allocation snapshot accepted atomically by `openCycle` (never `seedCycle`). Legacy `WORK_LEGACY` bundles remain readable; new commitment bundles require fulfilled lineage.
- Settlement precedence and states: Confirmed, Cancelled-from-Queued, Cancelled-from-Failed, authenticated execution Failed, Celo executed/acknowledgment-pending, Dispatched, derived delivery-delayed, Queued, then member-delivery-disabled only when no disbursement exists; `isBatch` remains an explicit command/key domain fact; source/executor pause, matching batch limits, executor caps, native-fee-low, and source-chain-linked Celo Safe/role/peer readiness remain separate capabilities.
- Separate mutations for same-key command retry, stored acknowledgment retry, a new logical attempt after authenticated failure, unbatched-Queued or Failed individual cancellation, and atomic whole-batch cancellation while Queued. Timeout alone never exposes cancellation or new-attempt actions, and a Queued batch member never exposes an individual cancel mutation.
- Exported shared API with no client/admin hooks.

## Acceptance

- All hooks live in @green-goods/shared and use centralized queryKeys.
- Mutations use the shared error pattern and event-driven invalidation.
- Offline jobs survive restart, dedupe correctly, and never enqueue an online G$ transfer. Only
  the five field kinds enter `waiting_for_hat`; the system `settlement` job is driven by indexed
  eligibility and reconciles the derived live pointer.
- Request creation/acceptance/decline/supersession and direction-aware confirmation render from canonical stored/indexed data.
- Garden requests expose both canonical GardenAccount claimant and requestedBy operator; Individual requests expose the same address for both. Runtime claim type cannot diverge from the stored creation type.
- Ready selectors expose the onchain charter/provider-open-commitment-cap predicate separately from the current, non-revoked Baseline app preflight, plus evidence, per-action Work approval, and assessment blockers, without treating sentinel `None`/`UNKNOWN` values as renderable identities.
- Exact label bytes determine unit-summary identity: `hours` and `Hours` render as separate groups. Event replay cannot change any selector result.
- Settlement selectors never merge Queued with Dispatched, never merge derived delay with authenticated failure, never present Dispatched or executed/acknowledgment-pending as arrived, preserve the command's destination-peer/version/payload snapshot and cancellation origin, expose a single atomic cancellation affordance for a Queued batch and none for its members, never hide historical settlement state when member delivery is later disabled, and never offer a new member-delivery action while disabled.
- Reward selectors enforce the declared rail: `ArbitrumExternal` can surface only core
  `RewardPaid`; `CeloSettlement` can surface only SettlementModule state; `None` has neither.
- Celo reward eligibility distinguishes beneficiary kind: Garden targets the active registered
  `providerGarden` Safe without consulting `memberDeliveryEnabled`; Individual targets the
  provider AA and remains disabled until that gate is true. The separate steward-only
  `queueFunding` seed/top-up is not exposed as a commitment job or an agent/keeper action.
- Acknowledgment reads preserve the exact originating command-message relationship and stored
  return receiver/version; an older retry ID delivered out of order can join only to its own
  execution key and never to another settlement.
- Garden queries use composite IDs only.
- Account-profile tests prove that `421614` and `11142220` use the explicit Kernel `0.2.4`
  test profile, `42161` and `42220` retain Kernel `0.3.1`, both members of a profile derive the
  same counterfactual address, unsupported/mixed profiles fail closed, and testnet evidence never
  changes `memberDeliveryEnabled`.
- New user-visible shared strings have en/es/pt messages and accessible status announcements.

## RED / GREEN

- RED: add focused shared selector, hook, mutation, query-key, and job tests; capture expected failures before implementation.
- GREEN: run the same files after implementation, then shared typecheck and story checks for any changed shared component.

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
