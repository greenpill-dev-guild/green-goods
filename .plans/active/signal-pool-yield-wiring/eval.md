# Signal Pool → Yield Wiring Supplement Evaluation Plan

## Release Gates

1. Correctness: pool creation or repair results in an actual hypercert pool wiring entry on the resolver.
2. Upgrade safety: storage layout and migration/backfill steps are validated before any live rollout.
3. Operator recovery: admins can detect and repair failed wiring without protocol-owner-only intervention.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `GardensModule` auto-wires the hypercert pool on mint-path and `createGardenPools()` recovery-path pool creation | `contracts` | Contract tests |
| AC-2 | `YieldResolver` accepts trusted module calls, validates manual repair calls, and emits wiring update events | `contracts` | Contract tests |
| AC-3 | Treasury fallback routes use the garden TBA instead of emitting stranded-yield behavior in the targeted paths | `contracts` | Contract tests |
| AC-4 | Migration/backfill steps set module references and repair existing gardens with pools but no resolver wiring | `contracts` | Dry-run checklist or migration output |
| AC-5 | Shared/admin follow-up surfaces whether yield was connected and exposes a manual reconnect path only on failure | `state_api`, `ui` | Hook/UI verification |
| AC-6 | `cd packages/contracts && bun run test -- --match-contract GardensModule` passes | `qa_pass_2` | Command output |
| AC-7 | `cd packages/contracts && bun run test -- --match-contract YieldSplitter` passes | `qa_pass_2` | Command output |
| AC-8 | `bun format && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build` passes | `qa_pass_2` | Command output |

## Test Strategy

- Unit: `GardensModule` and `YieldSplitter` access control, wiring, and treasury fallback coverage
- Fork / integration: at least one live-garden style scenario covering existing pools and post-upgrade repair
- UI / hook: verify post-create wiring status and reconnect fallback behavior
- Manual checks: create or repair a garden pool flow and confirm resolver state changes as expected

## QA Sequence

### Claude QA Pass 1

- Review the operator-facing wiring status and reconnect affordance for clarity
- Confirm fallback copy only appears when auto-wiring actually failed

### Codex QA Pass 2

- Re-run contract-focused validation and the repo-level safety checks
- Confirm the migration/backfill notes are sufficient for a deployment engineer to execute safely
