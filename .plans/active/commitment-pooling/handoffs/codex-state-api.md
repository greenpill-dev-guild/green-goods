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
- Five offline job kinds: commitment, claim, evidence, workLink, and confirmation.
- Job payloads mirror the full ABI: creation includes cycle, direction, claim type/mode, repeatable
  `{ actionUID, requiredCount }` requirements, contributor policy/roster facts, need, reward
  rail/source/token/amount, evidence, and timing. DomainImpact creation never accepts caller-authored
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
- `memberDeliveryEnabled` is false for every testnet-profile result. Production enablement consumes
  only the separately recorded Kernel `0.3.1` mainnet evidence gate; testnet sponsorship or
  provider-list presence cannot enable the production action.
- Stored claim-request terms and Pending/Accepted/Declined/Superseded selectors.
- Direction-aware confirmation eligibility with every frozen team member excluded.
- Pool/cycle/commitment/dispute recovery selectors.
- Per-action progress exposes `approvedCount / requiredCount`, the registry-derived domain tag,
  credited contributors, and canonical per-commitment `approvedUnits`; one `requirementIndex` can
  credit only its matching registered action requirement.
- Pool/cycle selectors expose state counts, `openCommitmentCount`, and exact-label `CommitmentUnitSummary` groups. `promiseKeptRate = commitmentsFulfilled / commitmentsDue` is the sole cross-commitment percentage; no selector sums unlike unit-label hashes or exposes a synthetic active-progress percentage.
- Hypercert metadata composer plus `bundleKind`, fulfilled `commitmentIds`, ascending unique
  `needUIDs`, certificate-scoped contributor allocation rows, and the immutable six-field
  allocation snapshot accepted atomically by `openCycle`
  (never `seedCycle`). Legacy `WORK_LEGACY` bundles remain readable; new commitment bundles
  require fulfilled lineage from one non-zero cycle and reject every `cycleId == 0` selection
  before allowlist or metadata construction because no six-role allocation snapshot exists.
- Settlement precedence and states: Confirmed, Cancelled-from-Queued, Cancelled-from-Failed, authenticated execution Failed, Celo executed/acknowledgment-pending, Dispatched, derived delivery-delayed, Queued, then member-delivery-disabled only when no disbursement exists; `isBatch` remains an explicit command/key domain fact; source/executor pause, matching batch limits, executor caps, native-fee-low, and source-chain-linked Celo Safe/role/peer readiness remain separate capabilities.
- Separate mutations for same-key command retry, stored acknowledgment retry, a new logical attempt after authenticated failure, unbatched-Queued or Failed individual cancellation, and atomic whole-batch cancellation while Queued. Timeout alone never exposes cancellation or new-attempt actions, and a Queued batch member never exposes an individual cancel mutation.
- Exported shared API with no client/admin hooks.

## Acceptance

- All hooks live in @green-goods/shared and use centralized queryKeys.
- Mutations use the shared error pattern and event-driven invalidation.
- Offline jobs survive restart, dedupe correctly, and never enqueue an online G$ transfer.
- Request creation/acceptance/decline/supersession and direction-aware confirmation render from canonical stored/indexed data.
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
  steward while the commitment is Accepted, unfrozen, and that Work has not been counted.
- Evidence selectors expose every attribution row but treat `evidenceCredits` as a 0-or-1
  participation signal per contributor. Hypercert selectors join integer recognition units
  through `(hypercertId, commitmentId, contributor)` and never read them from or write them onto
  the commitment contributor row.
- Exact label bytes determine unit-summary identity: `hours` and `Hours` render as separate groups. Event replay cannot change any selector result.
- Settlement selectors never merge Queued with Dispatched, never merge derived delay with authenticated failure, never present Dispatched or executed/acknowledgment-pending as arrived, preserve the command's destination-peer/version/payload snapshot and cancellation origin, expose a single atomic cancellation affordance for a Queued batch and none for its members, never hide historical settlement state when member delivery is later disabled, and never offer a new member-delivery action while disabled.
- Reward selectors enforce the declared rail: `ArbitrumExternal` can surface only core
  `RewardPaid`; `CeloSettlement` can surface only SettlementModule state; `None` has neither.
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
