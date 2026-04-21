# Codex Lane A — GreenWill Deploy CLI + Fork Gate (Sprint Day 2, 2026-04-20)

Sprint board: `.plans/active/admin-ui-revamp/execution-board-2026-04-20.md`
Readiness context: `.plans/active/admin-ui-revamp/artifacts/greenwill-deploy-readiness-2026-04-20.md`
Reputation plan: `.plans/active/reputation-badging/plan.todo.md` (esp. §0.1a, §0.2, §0.3)
Base: `develop` tip (committed) + rsynced Day 1 GreenWill test files.

## Goal

Close two ship-blockers:

1. Make `badge-locks` and `badge-schemas` real deploy CLI targets. Dry-run must parse and print the planned transactions. No broadcast wired yet.
2. Get `FOUNDRY_PROFILE=fork bun run test:match 'test/fork/ArbitrumGreenWillSupport.t.sol'` truly green against a real Arbitrum RPC. If the RPC is unreachable, surface the exact missing env var and stop — do not mark done.

## Context

- `bun script/deploy.ts --help` currently exposes: `core`, `goods`, `juicebox`, `octant-factory`, `garden`, `actions`, `hats-tree`, `status`, `fork`. **No badge commands.**
- `packages/contracts/script/deploy/cli.ts` is the CLI dispatch entry. Other targets live under `packages/contracts/script/deploy/*.ts` — follow the existing target module pattern (see `core.ts`, `gardens.ts`, `hats.ts`, `octant-factory.ts`).
- Badge policy (from readiness artifact, locked):
  - 6 badges: `verified-gardener`, `active-contributor`, `stewardship`, `garden-operator`, `community-builder`, `impact-verified`.
  - All Unlock locks `transferrable=false`.
  - Expirations: `active-contributor` = 1 year, `garden-operator` = 0 (manager-revoked), others = 0 (lifetime).
  - Single shared EAS schema: `string badgeType, address recipient, uint40 earnedAt, string evidenceUri, uint8 tier`. Resolver `0x0`. `revocable=true`.
- Fork test current state (from my local run):
  - Without `ARBITRUM_RPC_URL` → `ForkUnavailable("arbitrum")` (env-only blocker).
  - With env sourced → 7/8 assertions pass including `hasBadge(FIRST_SUPPORT_BADGE, supporter) → true`. Failing assertion is line 58: `assertGt(IERC20(AWETH).balanceOf(strategy), 0, "WETH support should auto-allocate into live Aave aWETH")`. §0.1a does **not** require this Aave assertion — it requires only "asserts FIRST_SUPPORT issuance." Existing Aave coverage is in `test/fork/ArbitrumAaveStrategy.t.sol` and `test/fork/ArbitrumVaultYieldE2E.t.sol`.
- Existing fork-env convention: `try vm.envString("ARBITRUM_RPC_URL")` with fallback `try vm.envString("ARBITRUM_RPC")`. Root `.env` is symlinked into this worktree at `.env`. Source it before running fork tests: `set -a; source .env; set +a`.

## Scope

### Owned files (exact)

- `packages/contracts/script/deploy.ts`
- `packages/contracts/script/deploy/cli.ts`
- New: `packages/contracts/script/deploy/badge-locks.ts`
- New: `packages/contracts/script/deploy/badge-schemas.ts`
- `packages/contracts/test/fork/ArbitrumGreenWillSupport.t.sol` — relax the line-58 Aave auto-allocation assertion (remove or soft-gate; keep the 7 other assertions intact). If the test still fails for a different structural reason on the current fork block, **do not silently disable** — return `status: partial` with the exact trace.
- `packages/contracts/test/fork/helpers/*` — only if a new fixture is required; prefer not editing if existing helpers suffice.

### Out of scope (do not touch)

- `packages/contracts/script/upgrade.ts` — **no GreenWill upgrade target this sprint.**
- `packages/contracts/deployments/42161-latest.json` — **do not modify.**
- UI: `packages/admin/src/views/Actions/GreenWillPanel.tsx`, `packages/client/src/views/Profile/Badges.tsx`.
- Any file under `packages/shared/**` or `packages/admin/src/views/Community/**` or `packages/admin/src/views/Actions/index.tsx` — those are Lane B.
- `packages/agent/**` — Lane C.
- `.claude/**`, `AGENTS.md` — never.
- Broadcast. Dry-run only.

## Historical pre-wire scaffold for `badge-locks.ts` / `badge-schemas.ts`

Follow the existing deploy-module pattern. For each target:

- Export a default-entry function that receives CLI options (network, dry-run, broadcast flag, sender) and a constructed dependency bag (`NetworkManager`, `DeploymentAddresses`).
- Dry-run path: print the six planned Unlock `createLock` calldata packets (for `badge-locks`) or the planned `SchemaRegistry.register` call (for `badge-schemas`) without sending anything. No chain writes.
- Broadcast path: guard behind explicit `--broadcast`. If the network config lacks an Unlock factory address on Arbitrum, fail fast with a clear error naming the missing address key. Do not invent an address.
- Wire both into `deploy/cli.ts` help output and switch table.

## Constraints

- Follow CLAUDE.md: `bun run` only, no raw `forge`. Use existing `NetworkManager` / `DeploymentAddresses` helpers — do not re-implement.
- Never use raw `forge build|test|script` — always `bun run test:match …`, `bun build`, `bun script/deploy.ts …`.
- Do not add new dependencies.
- Custom errors only for new Solidity; no `require` strings.
- If a fix genuinely requires touching a file outside the owned set, stop and return `status: partial` with the exact file + reason.
- **Commit your changes inside the worktree** (`git add` + `git commit -m "…"`). Last dispatch left artifacts untracked which blocked clean merge.

## Validation (commands must pass, quoted in `validation_output`)

- `bun script/deploy.ts --help` — stdout must contain literal strings `badge-locks` and `badge-schemas`.
- `bun script/deploy.ts badge-locks --network arbitrum --dry-run` — historical expectation: command was expected to become recognized.
- `bun script/deploy.ts badge-schemas --network arbitrum --dry-run` — historical expectation: command was expected to become recognized.
- `cd packages/contracts && bun run test:match 'test/unit/GreenWill*.t.sol'` — PASS, 19 tests.
- `cd packages/contracts && bun run test:match 'test/integration/GreenWillWorkflow.t.sol'` — PASS, 1 test.
- `cd packages/contracts && set -a; source ../../.env; set +a; FOUNDRY_PROFILE=fork bun run test:match 'test/fork/ArbitrumGreenWillSupport.t.sol'` — PASS, 1 test.
- `cd packages/contracts && bun run build` — PASS.

## Done when

- All validation commands above pass in this worktree.
- Two new deploy modules exist, both dry-run capable.
- Fork test relaxed only on the specific Aave line-58 assertion; all seven other assertions remain.
- Everything is **committed** inside the worktree.
- `codex-result.md` written per schema with `status: success`. If anything blocks (e.g., fork RPC unreachable), return `status: partial` with the exact command, exact error, and exact env var that would unblock it.

## Reporting requirements

In `codex-result.md`, populate:
- `files_created` and `files_modified` with real paths (relative to repo root).
- `validation_output` — paste the literal last ~10 lines of each validation command, not a summary.
- `issues` — one entry per blocker. Empty array only if nothing is blocked.
