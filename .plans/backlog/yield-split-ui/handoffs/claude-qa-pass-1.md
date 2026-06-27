# Yield Split UI - Claude QA Pass 1 Handoff

**Lane**: `qa_pass_1`
**Owner**: Claude
**Branch signal**: `claude/qa-pass-1/yield-split-ui`
**Status**: blocked until implementation lanes pass.

## Scope

Review the implemented UI and product guardrails after `ui`, `state_api`, and `contracts` have passed.

## Checks

- Admin `/community` Treasury reads live split config and no longer relies on hardcoded `DEFAULT_SPLIT_CONFIG`.
- `/community/treasury/vault` / `PositionCard` exposes operator-only `splitYield` with pending, escrowed, loading, error, disabled, and no-op states.
- `ConvictionDrawer` reads live split config and remains read-only.
- Preset editing appears only after `contracts` Phase 2 is complete.
- Preset confirmation shows before/after percentages and fixed Protocol Treasury share.
- UI does not expose `setGardenTreasury`, treasury destination editing, raw Protocol Treasury bps editing, or raw three-way `setSplitRatio` fields.
- Copy uses `Protocol Treasury` and all new strings exist in `en`, `es`, and `pt`.

## Validation

Prefer targeted reruns from the implementation lanes, plus source review for guardrails:

```bash
bun run --cwd packages/admin test src/__tests__/components/Garden/GardenYieldCard.yield-split.test.tsx src/__tests__/components/Vault/PositionCard.yield-split.test.tsx
bun run --cwd packages/client test src/__tests__/components/Dialogs/ConvictionDrawer.yield-split.test.tsx
bun run lint:vocab
node scripts/harness/plan-hub.mjs validate
```

Record unresolved issues directly in this file before handing to Codex QA Pass 2.
