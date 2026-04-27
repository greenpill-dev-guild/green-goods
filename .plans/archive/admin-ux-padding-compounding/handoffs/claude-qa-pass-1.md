# Admin Padding Compounding — qa_pass_1 Handoff

**Feature**: `admin-ux-padding-compounding`
**Lane**: `qa_pass_1`
**Owner**: `claude`
**Status**: `passed`
**Branch**: `claude/qa-pass-1/admin-ux-padding-compounding`
**Closed**: 2026-04-26

## Summary

QA evidence captured under the combined April 28 admin bundle:
**`.plans/active/admin-polish-bundle/handoffs/qa-evidence/combined-qa.md`** (canonical, single-source-of-truth across all three admin plans).

### Padding-specific outcome

- ✅ Hub gold-standard sweep at 4 widths (mapped iw 460 / 745 / 982 / 1545) — `MainSheet` measures 428 / 713 / 950 / 1400 (capped, centered). 16px outer margin, zero internal padding compounding.
- ✅ Per-route shell smoke at iw=1545 across `/hub/work`, `/garden/overview`, `/garden/impact`, `/community/treasury`, `/community/treasury/vault`, `/actions` — all render `MainSheet` at the 1400px cap with the same wrapper contract.
- ⚠ `/garden/impact/hypercerts/:id` not testable without seeded garden — recorded as data-limited.
- ✅ FIXED: `/actions` `MainSheet` mobile overflow. Edit: `packages/shared/src/styles/theme.css` — `workspace-canvas-grid` columns changed from `1fr` to `minmax(0, 1fr)` on both desktop and mobile tracks. Live re-measurement at iw=460: layout grid now resolves to `460px`, MainSheet 428px (matches `/hub/work` baseline). Validation re-run all green.
- ⚠ Out-of-scope follow-up: at iw≤460 on `/actions`, `AdminTabRail` content remains intrinsically wider than the now-correct MainSheet and gets clipped by MainSheet's `overflow:hidden` frame. This is an `AdminTabRail` responsive-width concern, not padding compounding.

## Validation

See `combined-qa.md § 6 Validation Results` for the full ladder. All commands passed.

## Source Files

- [brief.md](../brief.md)
- [spec.md](../spec.md)
- [plan.todo.md](../plan.todo.md)
- [eval.md](../eval.md)
- [combined-qa.md](../../admin-polish-bundle/handoffs/qa-evidence/combined-qa.md) — combined evidence bundle
