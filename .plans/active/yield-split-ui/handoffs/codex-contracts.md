# Yield Split UI - Codex Contracts Handoff

**Lane**: `contracts`
**Owner**: Codex
**Branch signal**: `codex/contracts/yield-split-ui`
**Status**: ready
**Depends on**: none
**Blocks**: Phase 3 preset editing.

## Scope

Harden `setGardenTreasury` so garden operators cannot change the Protocol Treasury destination. This is an in-plan governance gate, not a separate follow-up.

The expected product outcome is:

- Protocol Treasury destination is Green Goods/protocol governed.
- Operators cannot change it through contract permissions.
- UI never exposes treasury destination controls.
- Visibility and operator-only `splitYield` can proceed before this lane, but preset editing cannot ship until this lane passes.

## Guardrails

- Keep the contract change narrow to `setGardenTreasury` permission behavior and any required tests/ABI refresh.
- Do not redesign the yield protocol.
- Do not add a UI-facing treasury destination mutation path.
- Use repo bun scripts for Foundry work; do not call raw `forge` directly.
- If ABI/types change, refresh generated artifacts through existing package scripts.

## Likely Target Surfaces

- `packages/contracts/src/resolvers/Yield.sol`
- `packages/contracts/test/unit/YieldSplitter.t.sol`
- generated ABI/type surfaces only if the ABI changes

Confirm exact files from current source before editing.

## TDD Requirement

Start with failing contract tests that prove the current unsafe behavior:

- garden operator can no longer call `setGardenTreasury`;
- intended Green Goods/protocol-governed authority can still set or preserve the treasury destination;
- existing yield split behavior remains intact.

Record RED/GREEN proof back into this handoff and then into `status.json` with:

```bash
node scripts/harness/plan-hub.mjs record-tdd --feature yield-split-ui --lane contracts --red-command "..." --red-evidence "..." --green-command "..." --green-evidence "..."
```

## Validation

```bash
bun run --cwd packages/contracts test:match test/unit/YieldSplitter.t.sol
bun run --cwd packages/contracts build:abis
node scripts/harness/plan-hub.mjs validate
```

Run `build:abis` only if the implementation changes ABI output or generated contract artifacts.

## Stop Conditions

- Stop if the current deployed upgrade path makes permission hardening unsafe without a broader upgrade plan.
- Stop if the desired protocol-governed authority is ambiguous in current contract ownership patterns.
- Stop if hardening `setGardenTreasury` requires unrelated contract redesign.
