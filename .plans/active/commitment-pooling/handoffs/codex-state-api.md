# Commitment Pooling - Codex State/API Handoff

## Status

- Machine lane: state_api
- Execution sub-lane: state_api
- Owner: Codex
- Branch signal: codex/state-api/commitment-pooling
- Current state: two-phase — core waits for core indexer GREEN; settlement selectors wait for settlement indexer GREEN
- Linear context: PRD-723 (state/API lane) under parent PRD-650

## Inputs

- Frozen pooling ABI/events for the core phase; frozen Functions-only settlement ABI/events for the settlement phase
- GREEN core indexer codegen/build and agreed entity/query contract; settlement entities join only for the settlement phase
- acceptance-matrix.md for shared identity, status, copy, and final-proof contracts
- Composite Garden-ID query cutover
- Existing shared queryKeys, mutation-error, IndexedDB job, wallet/passkey, and chain-registry patterns

## Outputs

- Core shared domain types, centralized query keys, EAS/Envio adapters, hooks, selectors, mutation hooks, and invalidation rules, including missing-evidence and Assessment v3 readiness outputs.
- Five offline job kinds: commitment, claim, evidence, workLink, and confirmation.
- Job payloads mirror the full ABI: creation includes cycle, direction, claim type/mode, domains/actions, need, reward, evidence and timing; claim preserves kind/garden context; confirmation is the submit-or-confirm union. Accept/decline, assessment attach, Ready submission, and override remain explicit online mutations.
- Online-only Celo wallet transfer action; it never enters the offline queue.
- Stored claim-request terms and Pending/Accepted/Declined/Superseded selectors.
- Direction-aware confirmation eligibility and provider exclusion.
- Pool/cycle/commitment/dispute recovery selectors.
- Hypercert metadata composer plus `bundleKind`, `commitmentIds`, ascending unique `needUIDs`, and allocation-preset selectors required by the indexer/admin cut-over.
- Settlement precedence and states, including derived checking while on-chain state remains Reported, oracle-invalid failure, infrastructure retry, and member-delivery disabled.
- Exported shared API with no client/admin hooks.

## Acceptance

- All hooks live in @green-goods/shared and use centralized queryKeys.
- Mutations use the shared error pattern and event-driven invalidation.
- Offline jobs survive restart, dedupe correctly, and never enqueue an online G$ transfer.
- Request creation/acceptance/decline/supersession and direction-aware confirmation render from canonical stored/indexed data.
- Garden requests expose both canonical GardenAccount claimant and requestedBy operator; Individual requests expose the same address for both. Runtime claim type cannot diverge from the stored creation type.
- Ready selectors expose charter, baseline, exposure-cap, evidence, Work approval, and assessment blockers without treating sentinel `None`/`UNKNOWN` values as renderable identities.
- Settlement selectors never present Reported/checking as arrived and never offer a member-delivery action while disabled.
- Garden queries use composite IDs only.
- New user-visible shared strings have en/es/pt messages and accessible status announcements.

## RED / GREEN

- RED: add focused shared selector, hook, mutation, query-key, and job tests; capture expected failures before implementation.
- GREEN: run the same files after implementation, then shared typecheck and story checks for any changed shared component.

## Exact Bun commands

The three named shared test files do not exist yet; they are intentional to-be-created RED-first deliverables of this lane.

- bun run --filter @green-goods/shared test -- src/__tests__/commitment-pooling.test.ts
- bun run --filter @green-goods/shared test -- src/__tests__/commitment-jobs.test.ts
- bun run --filter @green-goods/shared test -- src/__tests__/settlement-selectors.test.ts
- bun run --filter @green-goods/shared typecheck
- bun run --filter @green-goods/shared check:stories
- bun run --filter @green-goods/shared check:story-quality

## Out of scope

- Hooks in client/admin, package-level env files, contract or indexer changes, raw Celo indexing, an offline G$ transfer job, manual receipt verification, garden-custody claims, credit, rankings, and transferable vouchers.

## Unblock evidence

- Core dispatch requires frozen pooling interfaces plus core indexer entity/query/codegen/build proof. Settlement selector work remains blocked until the settlement interfaces and settlement indexer phase are GREEN.
- Composite Garden replay proof is required before switching shared reads, but the live cutover itself is owned by `human-release-ops.md`.
- Manual status.json gate is explicitly cleared.
- RED proof is recorded before shared implementation; final GREEN includes targeted tests and typecheck.
