# Codex Lane B — Admin GreenWill Error UX + Padding Cleanup (Sprint Day 2, 2026-04-20)

Sprint board: `.plans/active/admin-ui-revamp/execution-board-2026-04-20.md`
Base: `develop` tip (committed). No cross-lane dependencies.

## Goal

Close two ship-blockers on admin surfaces:

1. `GreenWillPanel.tsx` must handle invalid-address input and ownership-lookup errors properly. No more collapsing a failed lookup into a misleading empty/success-looking state.
2. `Community/index.tsx` and `Actions/index.tsx` must reflect the padding ownership rule: route canvas owns the outer gutter, nested `Surface` defaults to `padding="none"`, terminal `AdminCard` / record units keep their own padding.

## Context

- `GreenWillPanel.tsx` currently:
  - Does not validate `lookupAddress` before passing to `useGreenWillBadges`. Any non-empty string (`"not-an-address"`) produces a silent query path.
  - Only destructures `isLoading` from `useGreenWillBadges`. The hook already exposes `isError` and `error` (see `packages/shared/src/hooks/greenwill/useGreenWillBadges.ts` lines 70-74). The panel ignores them — a failed lookup renders as "0 badges found".
  - Definitions and recent-grants errors render via `isDefinitionsError` / `isGrantsError`. Lookup errors must get equivalent surfacing, plus an empty-but-not-found vs empty-because-error distinction.
- `Community/index.tsx:345` — `<Surface elevation="solid-raised" padding="default" className="overflow-hidden">` wraps `<CommunityTab …>`. Outer-canvas gutter is already provided by `<div className="mt-4 px-4 sm:px-6">` on the preceding line. The `default` padding adds double gutter.
- `Actions/index.tsx` — three `<Surface … padding="default">` shells at lines 232-238 (loading skeleton), 256 (empty state), 283 (filtered-empty state). Route canvas gutter is already `<div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 sm:px-6">` above them.

## Scope

### Owned files (exact)

- `packages/admin/src/views/Actions/GreenWillPanel.tsx`
- `packages/admin/src/views/Community/index.tsx`
- `packages/admin/src/views/Actions/index.tsx`
- `packages/shared/src/hooks/greenwill/useGreenWillBadges.ts` — **only if the hook is missing a return value needed for the UI**. Prefer not editing; the `isError`/`error` return fields already exist.
- Focused tests for `GreenWillPanel.tsx` under `packages/admin/src/__tests__/views/Actions/` (create directory if absent).

### Out of scope

- Any other view, hook, or store.
- `packages/client/src/views/Profile/Badges.tsx` (out of sprint Day-2 scope).
- `packages/contracts/**` — Lane A.
- `packages/agent/**` — Lane C.
- `.claude/**`, `AGENTS.md` — never.

## Required changes

### `GreenWillPanel.tsx`

- Validate address input with viem's `isAddress` (already imported elsewhere in shared).
- Only enable the lookup hook when `isAddress(lookupAddress) === true`.
- Destructure `isError` and `error` from `useGreenWillBadges`.
- Render states, in priority order, below the address input:
  1. Empty input → prompt copy (existing behavior).
  2. Non-empty but invalid address → inline validation message (new i18n key `admin.greenWill.invalidAddress`).
  3. Loading → existing loading message.
  4. Error → distinct error message (new i18n key `admin.greenWill.lookupError`, with a short technical hint if `error.message` is available).
  5. Success → existing count summary + list.
- New i18n keys must be registered in `packages/shared/src/i18n/en.json`, `es.json`, `pt.json`. English fallbacks acceptable for es/pt per repo convention (D56).

### `Community/index.tsx`

- Flip the outer `Surface padding="default"` (line 345) to `padding="none"`.
- If `CommunityTab` visually needs inner gutter, add a minimal wrapper `<div className="p-4 sm:p-5">` inside the Surface — but prefer confirming that `CommunityTab` already handles its own internal padding via `@media (min-width: 640px)` rules.

### `Actions/index.tsx`

- Flip the three `Surface padding="default"` (lines 232-238, 256, 283) to `padding="none"`.
- `EmptyState` already provides its own internal gutter (check `packages/shared/src/components/EmptyState/` — if confirmed, no further wrapping needed).
- Loading skeleton: wrap skeleton rows in an explicit `className="space-y-3 p-4 sm:p-5"` on the surface if readability suffers.

## Constraints

- Follow CLAUDE.md: hooks from `@green-goods/shared` barrel only. `logger` not `console.log`. `Address` type for EVM addresses. Remixicon `Ri*Line`.
- i18n: any new user-facing string must be added to all three locale files (`en`, `es`, `pt`). Never hardcode user-facing copy.
- No new dependencies.
- No changes outside the listed files.
- Tests must cover: invalid-address case, lookup-error case, empty-result case. Use existing test patterns under `packages/admin/src/__tests__/`.
- **Commit your changes inside the worktree.**

## Validation (commands must pass, quoted in `validation_output`)

- `cd packages/admin && bun run test` — PASS.
- `cd packages/admin && bun run build` — PASS.
- `bun run lint:vocab` — PASS.
- `bun run check:design-tokens` — PASS.
- `cd packages/shared && bun run check:stories` — PASS.

## Done when

- All four required behaviors render correctly in `GreenWillPanel.tsx` — invalid input, error, loading, empty, success.
- Community + Actions shell Surfaces are `padding="none"` with no visible regression (Storybook check if possible).
- Tests added, validation commands above pass.
- Everything committed inside the worktree.
- `codex-result.md` written per schema with `status: success`. Any blocker → `status: partial` with exact command + error.

## Reporting requirements

Same as Lane A — paste literal last ~10 lines of each validation command into `validation_output`, not a summary.
