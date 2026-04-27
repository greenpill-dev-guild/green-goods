# Admin Sheet Animation Retune — state_api Handoff

**Feature**: `admin-sheet-animation-retune`
**Lane**: `state_api`
**Owner**: `codex`
**Status**: `n/a`
**Branch**: `codex/state-api/admin-sheet-animation-retune`

## Current Context

- Normalized from a TODO-only active plan on 2026-04-26.
- - Detailed sequencing remains in plan.todo.md; status.json is now the lane-state source of truth.
- - Admin sheet animation performance pass; requires visual and timing evidence.

## Source Files

- [brief.md](../brief.md)
- [spec.md](../spec.md)
- [plan.todo.md](../plan.todo.md)
- [eval.md](../eval.md)

## Validation

- Run `node scripts/plan-hub.mjs validate` after lane-state or handoff edits.
- Use the package-specific validation listed in [eval.md](../eval.md) for implementation changes.
