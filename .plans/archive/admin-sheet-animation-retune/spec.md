# Admin Sheet Animation Retune Spec

## Summary

The recede animation in `MainSheet` currently transitions `opacity + transform + filter (blur)` simultaneously on shared duration and easing tokens. On lower-end Android, animated `filter: blur()` stacks paints on top of any overlay sheet's `backdrop-filter`, producing a visible sluggishness. A token-level retune (fewer animated properties + lighter blur strategy) lifts perceived performance across every sheet open without rewriting the spatial language.

## Functional Requirements

- Capture baseline frame timings on sheet open (throttled CPU).
- Remove `filter` from animated property list in MainSheet recede.
- If depth reading is lost, apply static blur on mount instead.
- Audit overlay sheets for redundant `backdrop-filter`.
- Re-profile; record delta.
- Visual QA across Right / Left / Bottom + main recede.
- Validation: `bun run check:design-tokens && bun run test`.

## Research Evidence

- Source plan: [plan.todo.md](./plan.todo.md)
- Confirmed during normalization: this plan previously lived in `.plans/active/admin-sheet-animation-retune/plan.todo.md` without machine-readable lane state.

## Human Judgment Points

- Decide whether the plan should remain in `active` before broad implementation begins.
- Keep any protected package or deployment surfaces approval-gated.

## Non-Functional Constraints

- No raw `cubic-bezier` or duration literals — use motion tokens only (6 spring tokens).
- Preserve spatial intent: receded surface must read as receded, not just "less opaque."
- Strict M3 anatomy — no decorative motion add-ons.

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
