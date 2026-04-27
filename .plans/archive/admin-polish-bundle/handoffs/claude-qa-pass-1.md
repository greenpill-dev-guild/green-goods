# Admin Polish Bundle — qa_pass_1 Handoff

**Feature**: `admin-polish-bundle`
**Lane**: `qa_pass_1`
**Owner**: `claude`
**Status**: `passed`
**Branch**: `claude/qa-pass-1/admin-polish-bundle`
**Closed**: 2026-04-26

## Summary

QA evidence captured under the combined April 28 admin bundle:
**`./qa-evidence/combined-qa.md`** (canonical, single-source-of-truth across all three admin plans).

### Polish-specific outcome

- ✅ A. Nav first paint — cold load shows auth spinner then full `CanvasLayout` shell with `data-workspace="hub"` directly; no transient default→authenticated nav snap. `useEffectiveToolbarPermissions` fail-open path keeps shell painting; covered by `CanvasLayout` regression test.
- ✅ B. Tooltip + icon-only labels — live DOM at `/hub/work`: 0 unlabeled icon-only buttons; 4 AppBar tooltips render via CSS hover. AdminFab + garden hero back button use `AdminTooltip` with `bottom-start` placement (source-verified).
- ✅ C. Remixicon `Ri*Line` consistency — live DOM scan: 9/10 SVGs match Remixicon source, 0 lucide / 0 material-symbols matches in admin shell.
- ✅ D. Wide settings sheet — live DOM via `open-account-sheet` event: settings → `data-width="wide"` (max 471.273px); profile + notifications → `data-width="default"` (max 366.545px). Source: `RightSheetRegistry.tsx:155–164`.

## Validation

See `combined-qa.md § 6 Validation Results` for the full ladder. All commands passed.

## Source Files

- [brief.md](../brief.md)
- [spec.md](../spec.md)
- [plan.todo.md](../plan.todo.md)
- [eval.md](../eval.md)
- [combined-qa.md](./qa-evidence/combined-qa.md) — combined evidence bundle (this plan hosts the canonical bundle)
