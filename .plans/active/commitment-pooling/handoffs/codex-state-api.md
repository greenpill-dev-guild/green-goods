# Commitment Pooling - Codex State/API Handoff

## Status

- Machine lane: `state_api`
- Owner: Codex
- Branch: `codex/state-api/commitment-pooling`
- Current state: manually blocked
- Blocked until: pooling contract interfaces and the agreed PRD-673 indexer entity/query contract are recorded

## Scope

- Implement shared domain types, query keys, hooks, selectors, mutation flow, evidence model, and job/action substrate for commitments.
- Cover five offline queue kinds: `commitment`, `claim`, `evidence`, `workLink`, and `confirmation`.
- Add online-only settlement-chain wallet `transfer` action for G$ sends; it is not an offline job and must not be retried through MAX_RETRIES.
- Add settlement selectors and reward-status precedence: settlement-module record when present, else pooling-module `rewardPaid`.

## Acceptance

- Hooks live in `@green-goods/shared` and export through barrels only.
- Query keys use centralized `queryKeys`; no ad hoc query arrays.
- Mutation hooks use the repo mutation-error pattern and invalidate event-driven state instead of polling by default.
- Evidence flow supports IPFS CID lightweight evidence for mutual-aid commitments and preserves MDR rigor for DomainImpact.
- Final GREEN requires indexer codegen/build evidence and shared hook/query/job proof.

## Proof Expectations

- RED: failing shared hook/selector/job test selected before implementation.
- GREEN: same proof passing, plus package validation.
- Validation from `packages/shared`: targeted test first; add `bun run typecheck` for exported types/contracts; use repo quick gate only for cross-package signature impact.

## Out Of Scope

- Direct hooks in client/admin, package-level env files, raw Celo transfer indexing, Sarafu integration, transferable vouchers, credit job kinds, leaderboards, and public credit scores.
