# Admin Sheet Animation Retune — qa_pass_1 Handoff

**Feature**: `admin-sheet-animation-retune`
**Lane**: `qa_pass_1`
**Owner**: `claude`
**Status**: `passed`
**Branch**: `claude/qa-pass-1/admin-sheet-animation-retune`
**Closed**: 2026-04-26

## Summary

QA evidence captured under the combined April 28 admin bundle:
**`.plans/active/admin-polish-bundle/handoffs/qa-evidence/combined-qa.md`** (canonical, single-source-of-truth across all three admin plans).

### Sheet-motion-specific outcome

- ✅ Resting state: `mainSurface` transition list contains `opacity` and `transform` only; `filter: none`.
- ✅ Receded state (sheet open via `open-account-sheet`): `mainSurface` keeps the same transition list (no `filter` animated); static `blur(1.5px)` applied via `--canvas-blur-receded` token; transform = `translateY(8px)`; opacity = `0.95`.
- ✅ Bounded `RightSheet` overlay does not stack `backdrop-filter` on top of `MainSheet`. Source: `RightSheet.tsx:241–244` (`backdropFilter: isBounded ? undefined : "blur(2px)"`); live: `backdropFilter: none` for bounded overlays.
- ✅ Reduced-motion path: covered by passing unit test `MainSheet.test.tsx:103–125` — when `(prefers-reduced-motion: reduce)` matches, transition becomes `"none"`. Re-run via admin `test:hub` (87 tests passed).
- ✅ AC-4 throttled performance trace not required — no obvious jank observed in lean smoke.

## Validation

See `combined-qa.md § 6 Validation Results` for the full ladder. All commands passed.

## Source Files

- [brief.md](../brief.md)
- [spec.md](../spec.md)
- [plan.todo.md](../plan.todo.md)
- [eval.md](../eval.md)
- [combined-qa.md](../../admin-polish-bundle/handoffs/qa-evidence/combined-qa.md) — combined evidence bundle
