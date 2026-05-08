# Website UX Flow Optimization Evaluation Plan

## Release Gates

1. Correctness: public flow changes route to the intended pages and preserve existing funding/dialog behavior.
2. Usability: critical decision moments use plain language and every success/error state has a clear next action.
3. Regression safety: touched public-browser tests, typecheck, lint, and build pass or record precise unrelated blockers.
4. Evidence quality: RED/GREEN or proof-limit evidence is recorded in the UI handoff before lane completion.
5. Human judgment: glossary and CTA-style decisions are called out before Phase 3 implementation.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Funding decision language | Funding selector no longer shows "smart contract", "yield", "wallet recovery", or "onchain" in the visitor decision moment. | `ui` | `handoffs/claude-ui.md` |
| AC-2 | Success continuity | Funding receipt success state offers clear next routes, and subscription success clears entered email state. | `ui` | `handoffs/claude-ui.md` |
| AC-3 | Async honesty | Public funding/Garden discovery states show loading, empty, error, or retry affordances where data can be delayed or fail. | `ui` | `handoffs/claude-ui.md` |
| AC-4 | Discovery | `/cookies` and `/actions` are reachable from public flows without pasted URLs. | `ui` | `handoffs/claude-ui.md` |
| AC-5 | QA review | Desktop and mobile browser pass verifies the seven visitor flows. | `qa_pass_1` | `handoffs/claude-qa-pass-1.md` |
| AC-6 | Regression review | Targeted tests and plan-hub state match the final diff. | `qa_pass_2` | `handoffs/codex-qa-pass-2.md` |

## Test Strategy

- Unit: public funding selector copy/branching, receipt retry/wayfinding, subscription form state, zero-results announcement where practical.
- Integration: route rendering tests for touched public browser surfaces.
- E2E / browser: desktop and mobile walkthrough of affected flows.
- Manual checks: plain-language scan, mobile layout at 375px, success/error recovery, glossary/CTA judgment.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Focus on UX clarity, mobile flow, accessibility, i18n completeness, and whether the changes preserve the public editorial dialect.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` passes.
- Confirm the trigger branch exists: `claude/qa-pass-1/website-ux-flow-optimization`.
- Re-run targeted validation and close the loop on plan-hub state.
