# Admin Sheet Animation Retune — ui Handoff

**Feature**: `admin-sheet-animation-retune`
**Lane**: `ui`
**Owner**: `claude`
**Status**: `ready`
**Branch**: `claude/ui/admin-sheet-animation-retune`

## Current Context

- UI implementation is ready for QA as of 2026-04-26.
- `MainSheet` no longer transitions `filter`; recession now animates opacity and transform only while retaining the static receded blur state.
- `RightSheet` width variants were added and threaded through the admin registry so form-heavy account settings can use `wide`.
- Manual visual/performance evidence is still the QA lane's responsibility.

## Source Files

- [brief.md](../brief.md)
- [spec.md](../spec.md)
- [plan.todo.md](../plan.todo.md)
- [eval.md](../eval.md)

## Validation

- `bun run check:design-tokens` passed.
- `bun run lint:vocab` passed.
- `cd packages/shared && bun run check:stories` passed.
- `cd packages/shared && bun run check:story-quality` passed.
- `cd packages/shared && bun run typecheck` passed.
- `cd packages/shared && bun run test src/__tests__/components/MainSheet.test.tsx src/__tests__/components/Canvas/RightSheet.test.tsx src/__tests__/components/Canvas/SheetInteractions.test.tsx src/__tests__/components/FormWizard.test.tsx` passed after network-approved rerun.
- `cd packages/admin && bun run test:hub` passed after network-approved rerun.
- `cd packages/admin && bun run lint` passed with 6 existing warnings.
- `cd packages/admin && bun run build` passed with existing Rollup/sourcemap/chunk warnings.
