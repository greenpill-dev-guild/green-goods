# Admin Polish Bundle — qa_pass_2 Handoff

**Feature**: `admin-polish-bundle`
**Lane**: `qa_pass_2`
**Owner**: `codex`
**Status**: `passed`
**Branch**: `codex/qa-pass-2/admin-polish-bundle`
**Evidence**: `qa-evidence/combined-qa.md`

## Result

- Accepted the `qa_pass_1` polish evidence for nav fail-open, tooltip/icon-only coverage, Remixicon consistency, and settings-only wide `RightSheet`.
- Re-verified source truth: `CanvasLayout.tsx` does not block shell paint on `permissions.isLoading`, and `RightSheetRegistry.tsx` sets `width: "wide"` only for `SETTINGS`.
- Verified the latest Storybook blocker fix: `CommunityTab` now accepts `YieldAllocation[]`, and its story fixtures include `totalAmount`, `gardenAddress`, and `assetAddress`.
- Built Storybook iframe smoke confirms `CommunityTab` populated/no-pools/read-only stories no longer crash with `Cannot mix BigInt and other types`.

## Validation

- `cd packages/admin && bun run lint` — passed, 6 pre-existing warnings / 0 errors.
- `cd packages/admin && bun run test:hub` — passed, 13 files / 87 tests.
- `cd packages/admin && bun run build` — passed, known Rollup/Vite warnings only.
- `cd packages/shared && bun run check:stories` — passed, 157/157 required surfaces.
- `cd packages/shared && bun run test:stories:ci` — passed, 26 files / 97 tests.
- `cd packages/shared && bun run build-storybook` — passed.
- Built iframe smoke: `admin-workflows-garden-communitytab--populated`, `--no-pools`, and `--read-only` passed.

## Remaining

- No polish-bundle blocker remains.
- Seeded live garden content remains a manual/product-data signoff gap, not a polish blocker.
