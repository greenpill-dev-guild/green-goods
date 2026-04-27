# Admin Polish Bundle Spec

## Summary

Four small admin defects identified across recent feedback (`feedback_admin_audit_2026_04_14`, `project_admin_known_pains_2026_04_19`) that don't warrant their own plan but together push admin from "functional" to "trusted." Each item is independently dispatchable — this hub keeps the rolling polish queue visible.

## Functional Requirements

- A. Nav flash on first paint — own commit.
- B. Tooltip coverage on icon-only controls — own commit.
- C. Icon library consolidation — own commit.
- D. RightSheet width variants — own commit.

## Research Evidence

- Source plan: [plan.todo.md](./plan.todo.md)
- Confirmed during normalization: this plan previously lived in `.plans/active/admin-polish-bundle/plan.todo.md` without machine-readable lane state.

## Human Judgment Points

- Decide whether the plan should remain in `active` before broad implementation begins.
- Keep any protected package or deployment surfaces approval-gated.

## Non-Functional Constraints

Use the package-local AGENTS.md guidance for any touched package and keep validation scoped to changed surfaces.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Primary implementation lane. |
| State / API | `state_api` | Marked n/a unless later scope adds state/API work. |
| Contracts | `contracts` | Marked n/a unless later scope adds contract work. |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential after primary lanes complete. |

## Risks

- Scope drift from the original TODO plan.
- Validation claims that exceed the checklist evidence.
