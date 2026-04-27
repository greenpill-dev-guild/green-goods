# Admin Sheet Animation Retune Evaluation Plan

## Release Gates

1. Plan hygiene: this plan remains `ACTIVE / QA READY`; this update does not close it.
2. Combined evidence: close this plan through the shared April 28 admin QA bundle with `admin-ux-padding-compounding` and `admin-polish-bundle`.
3. Lean evidence: sheet-open and reduced-motion smoke evidence is enough unless obvious jank appears.
4. Plan-surface validation: `node scripts/harness/plan-hub.mjs validate` passes after status edits.

## Combined Admin QA Contract

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Combined QA evidence bundle is used for all three admin plans | `qa_pass_1` | shared handoff report |
| AC-2 | Sheet open/close smoke covers representative mobile and desktop widths | `qa_pass_1` | short visual evidence or notes |
| AC-3 | Reduced-motion path is checked and remains clear | `qa_pass_1` | handoff note |
| AC-4 | Full performance trace is required only if smoke evidence shows obvious jank | `qa_pass_1` | trace or explicit not-needed note |
| AC-5 | Plan remains separate from padding and polish plans | system | plan hub layout |

## Future QA Strategy

- Lean sheet-open smoke shows no obvious jank; if obvious jank appears, capture throttled before/after timing before closeout.
- Reduced-motion path unchanged.
- Visual recede effect remains clearly distinct from "sheet not open" at full opacity.
- Run implementation validation only after a later code-fix pass. This plan-alignment pass only requires plan-hub validation.

## QA Sequence

### Claude QA Pass 1

- Review user-facing behavior, missing requirements, and test gaps.
- Use the combined admin QA bundle rather than a separate sheet-only pass.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists: `claude/qa-pass-1/admin-sheet-animation-retune`.
- Re-run targeted validation and close the loop on remaining defects.
