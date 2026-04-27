# Admin Polish Bundle — ui Handoff

**Feature**: `admin-polish-bundle`
**Lane**: `ui`
**Owner**: `claude`
**Status**: `ready`
**Branch**: `claude/ui/admin-polish-bundle`

## Current Context

- UI implementation is ready for QA as of 2026-04-26.
- `CanvasLayout` no longer blocks shell paint on `permissions.isLoading`; the fail-open toolbar path has a regression test.
- Icon-only FAB/header controls now carry labels/tooltips, the marketplace approval step uses Remixicon, and account settings can opt into the wider `RightSheet` variant.
- Review cleanup kept the working tree focused on admin/shared UI files and removed unrelated Claude/config/client/plan-hub churn.

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
