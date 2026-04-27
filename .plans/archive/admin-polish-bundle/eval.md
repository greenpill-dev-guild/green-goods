# Admin Polish Bundle Evaluation Plan

## Release Gates

1. Plan hygiene: this plan remains `ACTIVE / QA READY`; this update does not close it.
2. Combined evidence: close this plan through the shared April 28 admin QA bundle with `admin-ux-padding-compounding` and `admin-sheet-animation-retune`.
3. Polish scope: future QA signs off nav first paint, tooltip placement, icon consistency, and wide account settings sheet behavior.
4. Plan-surface validation: `node scripts/harness/plan-hub.mjs validate` passes after status edits.

## Combined Admin QA Contract

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Combined QA evidence bundle is used for all three admin plans | `qa_pass_1` | shared handoff report |
| AC-2 | Nav first paint does not visibly snap from default to authenticated state | `qa_pass_1` | screenshot/smoke note |
| AC-3 | Icon-only controls have accessible names and non-clipped tooltip placement | `qa_pass_1` | screenshot/smoke note |
| AC-4 | Admin icon treatment remains visually consistent with Remixicon `Ri*Line` usage | `qa_pass_1` | handoff note |
| AC-5 | Account settings uses the wide `RightSheet`; profile/notifications stay default width | `qa_pass_1` | screenshot/smoke note |
| AC-6 | Plan remains separate from padding and sheet plans | system | plan hub layout |

## Future QA Strategy

- Visual signoff is required for nav first paint, tooltip placement, icon consistency, and wide settings sheet behavior.
- Lean screenshot/smoke evidence is enough for this plan; do not require a full browser QA suite beyond the combined admin evidence bundle.
- Run implementation validation only after a later code-fix pass. This plan-alignment pass only requires plan-hub validation.

## QA Sequence

### Claude QA Pass 1

- Review user-facing behavior, missing requirements, and test gaps.
- Use the combined admin QA bundle rather than a separate polish-only pass.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists: `claude/qa-pass-1/admin-polish-bundle`.
- Re-run targeted validation and close the loop on remaining defects.
