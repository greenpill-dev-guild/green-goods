# Codex Lane B — Triage + GreenWill Phase 0 Readiness + Contract Confidence (Sprint 2026-04-20 · Day 1)

Sprint board: `.plans/active/admin-ui-revamp/execution-board-2026-04-20.md`
Reputation plan: `.plans/active/reputation-badging/plan.todo.md` (esp. §0.1a, §0.2, §0.3)
Branch: `codex/lane-b-greenwill/sprint-2026-04-20` (worktree — commit here only)
Base commit: current `develop` tip

## Goal

Produce three deliverables on Day 1, all blocking any eventual Arbitrum broadcast:

1. Triage note for bugs `#385`, `#428`, `#431` with file suspects, complexity estimates, and whether fixing would collide with Claude-owned files on Day 1 or Day 2. **Triage only — no fixes.**
2. GreenWill Phase 0 deployment-readiness note — including the explicit question below about `deploy.ts` extensibility — plus dry-run output showing what would broadcast.
3. Contract confidence test coverage — **create two new test files** and add upgrade-preservation coverage to three existing unit suites. No broadcast.

## Context

- Sprint rules: GreenWill stays on existing live-data surfaces (`packages/admin/src/views/Actions/GreenWillPanel.tsx`, `packages/client/src/views/Profile/Badges.tsx`). **Do not touch UI files this Day.** UI validation happens after broadcast, on Day 2+.
- `GreenWillPanel.tsx` already consumes `useGreenWillBadgeDefinitions`, `useGreenWillBadges`, and `useGreenWillRecentGrants` against `DEFAULT_CHAIN_ID` — "wire to real deployments" is primarily about those hooks resolving to the deployed lock and schema addresses on Arbitrum. It is not a UI rewrite. Capture any empty/loading/error path gaps observed in the readiness note so Day 2 knows where live data will look wrong first.
- Existing GreenWill Solidity sources:
  - `packages/contracts/src/registries/GreenWillRegistry.sol`
  - `packages/contracts/src/modules/GreenWillUnlockModule.sol`
  - `packages/contracts/src/modules/GreenWillSupportRouter.sol`
  - Interfaces: `IGreenWillRegistry.sol`, `IGreenWillUnlockModule.sol`, `IGreenWillValidator.sol`
- Existing unit tests:
  - `packages/contracts/test/unit/GreenWillRegistry.t.sol`
  - `packages/contracts/test/unit/GreenWillSupportRouter.t.sol`
  - `packages/contracts/test/unit/GreenWillUnlockModule.t.sol`
- **These two tests do not yet exist — create them** (see reputation-badging §0.1a):
  - `packages/contracts/test/integration/GreenWillWorkflow.t.sol` — one workflow test covering genesis claim → first-work claim → first-support issuance in a single contracts path.
  - `packages/contracts/test/fork/ArbitrumGreenWillSupport.t.sol` — one Arbitrum fork test routing live WETH support through an Octant vault and asserting `FIRST_SUPPORT` issuance.
- `bun script/deploy.ts` currently has these targets in `packages/contracts/script/deploy/`: `actions`, `anvil`, `core`, `gardens`, `goods`, `hats`, `octant-factory`. **There is no `badge-locks` or `badge-schemas` target yet.** Your readiness note must answer: does Phase 0 need a new deploy target, and if so, what is the minimal scaffolding?
- `packages/contracts/deployments/42161-latest.json` exists. Zero addresses are acceptable for modules that have not been deployed.
- 6 badges per reputation-badging §0.2: `verified-gardener`, `active-contributor`, `stewardship`, `garden-operator`, `community-builder`, `impact-verified`. Expirations: `active-contributor=1y`, `garden-operator=0` (manager-revoked), others=`0` (lifetime). Unlock lock `transferrable=false` for all.
- Single shared EAS schema: `string badgeType, address recipient, uint40 earnedAt, string evidenceUri, uint8 tier` (decision 11 variant — one UID shared across all badges, distinguish by `badgeType` field).

## Constraints

- **Triage only for `#385` / `#428` / `#431`.** No code fixes. Use `gh issue view <n>` for context, suspect files only.
- **No broadcast this Day.** Dry-run only for any `deploy.ts` command. Do not modify `deployments/42161-latest.json`.
- **Never use raw `forge`** — use `bun run test:match`, `bun build`, `bun script/deploy.ts` per `packages/contracts/AGENTS.md`.
- **Do not touch `packages/admin/src/views/Actions/GreenWillPanel.tsx` or `packages/client/src/views/Profile/Badges.tsx`** — UI validation is a Day 2+ Lane B scope item.
- **Do not touch `.claude/**` or `AGENTS.md`** files.
- Follow CEI, explicit visibility, custom errors, storage gaps (per `packages/contracts/AGENTS.md`) in any new test fixtures or helpers.
- Upgrade-preservation coverage means: deploy V1, populate storage, upgrade to a V2 that adds a new variable in the correct slot, verify all original state is intact. Use `UpgradeSafety.t.sol` as a reference pattern.
- If scaffolding `script/deploy-badge-locks.ts` or `script/register-badge-schemas.ts`, keep them **dry-run capable and OFF by default** — broadcast wiring is Day 2 Lane B only, not Day 1.

## Artifacts to produce

1. `.plans/active/admin-ui-revamp/artifacts/bug-triage-2026-04-20.md`
   - One section per bug (`#385`, `#428`, `#431`) — suspected files, complexity (S/M/L), whether the fix overlaps Claude-owned Day 1 or Day 2 files (yes/no + which file), and recommended dispatch window.
2. `.plans/active/admin-ui-revamp/artifacts/greenwill-deploy-readiness-2026-04-20.md`
   - Answer: does `bun script/deploy.ts` already support a `badge-locks` or `badge-schemas` target, or do we need a new module under `packages/contracts/script/deploy/`? If new, sketch the file structure and entry points needed.
   - Enumerate the 6 badge IDs with expiration policy and `transferrable=false` flag.
   - Dry-run output preview: command(s) you would run to broadcast, with expected Unlock factory and EAS SchemaRegistry contract interactions.
   - Gaps in the current `GreenWillPanel.tsx` / `Badges.tsx` live-data render path — empty / loading / error risks observed from reading the code (do not edit).
3. New Solidity tests:
   - `packages/contracts/test/integration/GreenWillWorkflow.t.sol` — genesis → first-work → first-support, one path.
   - `packages/contracts/test/fork/ArbitrumGreenWillSupport.t.sol` — live Arbitrum WETH → Octant vault → `FIRST_SUPPORT` issuance (must run under `FOUNDRY_PROFILE=fork`).
4. Upgrade-preservation additions to existing unit suites (append tests; do not rewrite):
   - `packages/contracts/test/unit/GreenWillRegistry.t.sol`
   - `packages/contracts/test/unit/GreenWillUnlockModule.t.sol`
   - `packages/contracts/test/unit/GreenWillSupportRouter.t.sol`

## Validation (before declaring done)

- `cd packages/contracts && bun run test:match 'test/unit/GreenWill*.t.sol'` — must pass (existing + new upgrade cases).
- `cd packages/contracts && bun run test:match 'test/integration/GreenWillWorkflow.t.sol'` — must pass (new file).
- `cd packages/contracts && FOUNDRY_PROFILE=fork bun run test:match 'test/fork/ArbitrumGreenWillSupport.t.sol'` — must pass (new file; needs Arbitrum RPC env var per existing fork tests).
- `cd packages/contracts && bun build` — must succeed (adaptive; no full rebuild unless needed).

## Done when

- All three artifacts exist at the paths above.
- Both new test files exist and the three `bun run test:match` commands in `Validation` pass.
- Upgrade-preservation coverage appended to the three unit suites.
- No changes to `deployments/42161-latest.json`.
- No changes to UI files or `.claude/**` files.
- Structured `codex-result.md` written per schema with `status: success` (or `partial` with explicit issues list if a validation command fails — do not force-pass a broken test).

## Out of scope (defer)

- Any Phase 0 broadcast. Day 2 earliest, and only after admin is stable enough not to block Claude.
- `GreenWillPanel.tsx` / `Badges.tsx` UI edits — Day 2+ Lane B, Claude approval required.
- Indexer changes — EAS / Unlock are not indexed per reputation-badging D10.
- Any fix for `#385` / `#428` / `#431` — Claude must re-sequence the sprint before Lane B touches those.
- `.claude/**` edits.
