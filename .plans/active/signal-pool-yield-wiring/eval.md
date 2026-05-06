# Signal Pool → Yield Wiring Supplement Evaluation Plan

## Target

Complete by Friday, 2026-05-15. Do not mark this hub complete unless the release gates and acceptance checks below are satisfied.

## Release Gates

1. Correctness: pool creation or repair results in an actual hypercert pool wiring entry on the resolver.
2. Upgrade safety: storage layout and migration/backfill steps are validated before any live rollout.
3. Operator recovery: admins can detect and repair failed wiring without protocol-owner-only intervention.
4. Pool identity: no acceptance path relies on trimmed array index to decide which pool is the HypercertSignal pool.
5. Deployment safety: both resolver references are wired and verified before the hub can close.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `GardensModule` auto-wires the hypercert pool on mint-path and `createGardenPools()` recovery-path pool creation | `contracts` | Contract tests |
| AC-2 | `GardensModule` records a typed HypercertSignal pool mapping and clears it during reset/reinit recovery | `contracts` | Contract tests |
| AC-3 | `YieldResolver` accepts trusted module calls, validates manual repair calls against CVStrategy compatibility and typed HypercertSignal pool state, and emits wiring update events | `contracts` | Contract tests |
| AC-4 | Treasury fallback routes use the garden TBA instead of emitting stranded-yield behavior in the targeted paths | `contracts` | Contract tests |
| AC-5 | Migration/backfill steps set bidirectional module references, typed HypercertSignal pool state, resolver pool wiring, and garden treasury defaults | `contracts` | Dry-run checklist or migration output |
| AC-6 | Shared hooks never classify Hypercert vs Action pools by trimmed array index and expose `connected`, `missing-pool`, `missing-resolver-wiring`, and `mismatch` wiring states | `state_api` | Hook tests |
| AC-7 | Admin `/community` exposes the primary reconnect action only when the expected HypercertSignal pool is known; other pool/yield surfaces deep-link to the same repair flow | `ui` | UI verification |
| AC-8 | Post-deploy verification fails if `gardensModule.yieldResolver() != yieldResolver`, `yieldResolver.gardensModule() != gardensModule`, typed pool mapping mismatches resolver mapping, or unacknowledged no-pool gardens remain | `qa_pass_2` | Command output |
| AC-9 | `cd packages/contracts && bun run test -- --match-contract GardensModule` passes | `qa_pass_2` | Command output |
| AC-10 | `cd packages/contracts && bun run test -- --match-contract YieldSplitter` passes | `qa_pass_2` | Command output |
| AC-11 | `bun format && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build` passes | `qa_pass_2` | Command output |

## Test Strategy

- Unit: `GardensModule` and `YieldSplitter` access control, typed pool identity, wiring, reset cleanup, and treasury fallback coverage
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
