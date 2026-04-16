# Fix Garden Domain UI & Data Issues Evaluation Plan

## Release Gates

1. Correctness: gardens retain the expected domain mask and zero-domain gardens are surfaced consistently.
2. Operator clarity: the garden detail and submit-work flows explain how to recover from an empty-domain state.
3. Regression safety: the change does not alter indexer contracts, route structure, or unrelated garden detail behavior.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `getGardens()` lowercases the domain lookup key and preserves non-empty domain masks | `state_api` | Shared test or fixture proof |
| AC-2 | Garden detail always renders the domain row and shows the correct empty-state affordance for managers vs read-only users | `ui` | Component test or screenshot |
| AC-3 | Submit Work empty state links back to the garden detail/domain configuration path | `ui` | Manual flow or integration test |
| AC-4 | `useGardenDerivedState` emits an overview alert for zero-domain gardens | `state_api` | Hook test or derived-state assertion |
| AC-5 | New strings exist in `en`, `es`, and `pt` | `qa_pass_1` | i18n diff review |
| AC-6 | `bun format && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build` passes | `qa_pass_2` | Command output |

## Test Strategy

- Unit: shared data and derived-state coverage for the domain lookup and empty-domain alert
- Integration: garden detail and submit-work rendering for a zero-domain garden fixture
- E2E / Playwright: optional admin smoke path if the change lands with adjacent garden-detail work
- Manual checks: open a garden with `domainMask = 0`, confirm the alert, empty row, and recovery CTA all point to the same fix path

## QA Sequence

### Claude QA Pass 1

- Confirm the empty-domain state is visible and understandable on garden detail and Submit Work
- Check copy, CTA placement, and translation coverage

### Codex QA Pass 2

- Re-run targeted shared/admin validation and the repo-level safety checks
- Verify no broader garden data regression was introduced by the lookup normalization
