# Admin Padding Compounding Evaluation Plan

## Release Gates

1. Plan hygiene: this plan remains `ACTIVE / QA READY`; this update does not close it.
2. Combined evidence: close this plan through the shared April 28 admin QA bundle with `admin-sheet-animation-retune` and `admin-polish-bundle`.
3. Padding scope: the future QA pass must sweep Hub, Garden, Actions, Hypercerts, Vault, and Community.
4. Plan-surface validation: `node scripts/harness/plan-hub.mjs validate` passes after status edits.

## Combined Admin QA Contract

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Combined QA evidence bundle is used for all three admin plans | `qa_pass_1` | shared handoff report |
| AC-2 | Full padding view sweep covers Hub, Garden, Actions, Hypercerts, Vault, and Community | `qa_pass_1` | screenshots or route notes |
| AC-3 | Lean screenshot evidence covers 375 / 768 / 1024 / 1440 widths | `qa_pass_1` | screenshot set |
| AC-4 | Any visible padding regression is recorded for a later implementation pass | `qa_pass_1` | issue/handoff note |
| AC-5 | Plan remains separate from sheet and polish plans | system | plan hub layout |

## Future QA Strategy

- Hub at 375px shows content edges aligned with sheet edges (no compounded inset).
- Canonical token contract documented inline in `theme.css` or surface-level component comment (one line, why-not-what).
- No visible compounded-padding regressions in Hub, Garden, Actions, Hypercerts, Vault, and Community at 4 breakpoints.
- Run implementation validation only after a later code-fix pass. This plan-alignment pass only requires plan-hub validation.

## QA Sequence

### Claude QA Pass 1

- Review user-facing behavior, missing requirements, and test gaps.
- Use the combined admin QA bundle rather than a separate padding-only pass.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists: `claude/qa-pass-1/admin-ux-padding-compounding`.
- Re-run targeted validation and close the loop on remaining defects.
