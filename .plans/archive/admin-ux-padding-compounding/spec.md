# Admin Padding Compounding Spec

## Summary

Across admin views, content nests through `MainSheet → Surface → Surface → Card`, and each layer adds its own padding. The result feels cramped on mobile and wastes horizontal space at desktop. One careful pass through the canvas wrappers lets every admin view inherit the fix without per-view edits.

## Functional Requirements

- Audit current padding per layer (Sheet, Surface variants, Card variants).
- Define canonical token contract (one tier per layer).
- Apply to MainSheet / Surface / Card primitives.
- Sweep Hub.
- Sweep Garden, Action, Hypercerts, Vault, Community.
- Storybook visual diff captured.
- Chrome MCP screenshots at 375 / 768 / 1024 / 1440.
- Validation suite green.

## Research Evidence

- Source plan: [plan.todo.md](./plan.todo.md)
- Confirmed during normalization: this plan previously lived in `.plans/active/admin-ux-padding-compounding/plan.todo.md` without machine-readable lane state.

## Human Judgment Points

- Decide whether the plan should remain in `active` before broad implementation begins.
- Keep any protected package or deployment surfaces approval-gated.

## Non-Functional Constraints

- Do **not** add Tailwind utility classes inside `packages/shared/src/` for new layout — silent scan failure. See CLAUDE.md "Known Gotchas". Use inline styles or token-driven CSS in shared; keep Tailwind utilities in admin/client.
- Strict M3 anatomy in admin — no glass on Surface or Card. (Glass only on `AdminAppBar`.)
- All motion via spring tokens; no hardcoded `cubic-bezier` or duration literals.
- Tokens: prefer existing `--spacing-*` / `--radius-*` from `packages/shared/src/styles/theme.css`.

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
