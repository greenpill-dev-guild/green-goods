# CSS Maintainability Polish Evaluation Plan

## Release Gates

1. Sequencing: broad implementation starts only after active public-browser/PWA/design work is stable or
   explicitly paused.
2. CSS ownership: global selectors and package entry CSS have documented owners.
3. Token correctness: undefined CSS custom-property references are zero or explicitly allowlisted with
   local ownership.
4. Drift control: new raw colors, durations, easing, radii, overlays, and primitive palette usage are
   blocked or tracked in the existing baseline process.
5. Dialect safety: public browser, installed PWA, and admin surfaces keep their distinct visual language.
6. Evidence quality: every accepted cleanup has source evidence, validation output, and visual proof when
   user-facing CSS changes.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Sequencing gate is satisfied or a human explicitly approves starting early | `ui` / `state_api` | Plan status/history note |
| AC-2 | CSS ownership inventory classifies shared theme/utilities, client/admin/docs entry CSS, and component/shell-scoped styles | `ui` | UI handoff with file list |
| AC-3 | Undefined CSS variable guard exists or is documented as a reporting-only first pass with an allowlist | `state_api` | Script/check output or tooling design note |
| AC-4 | Legacy broad selectors are removed, approved as base CSS, or scoped to a shell/root owner | `ui` | CSS diff plus inventory update |
| AC-5 | Raw style values introduced by earlier design work are mapped to Warm Earth tokens or recorded as justified exceptions | `ui` | `check:design-tokens` plus baseline diff |
| AC-6 | Public browser journal still renders with `PublicShell`, `SiteHeader`, editorial serif moments, and no bottom `AppBar` | `qa_pass_1` | Route tests/screenshots |
| AC-7 | Installed PWA still renders with `AppShell`, bottom `AppBar`, Inter-only app typography, and field-tool flows intact | `qa_pass_1` | Installed-mode screenshots/tests |
| AC-8 | Admin surfaces touched by shared CSS changes keep the restrained operator-cockpit dialect | `qa_pass_1` | Admin smoke/story evidence |
| AC-9 | Generated design artifacts and token audit/baseline files are current or explicitly unchanged | `qa_pass_2` | `check:design-generated` and diff review |
| AC-10 | Final validation ladder matches touched surface scope and records proof limits | `qa_pass_2` | QA handoff |

## Test Strategy

- Static/design gates:
  - `node scripts/harness/plan-hub.mjs validate`
  - `bun run check:design-generated`
  - `bun run check:design-tokens`
  - `bun run check:design-md`
  - `bun run lint:vocab`
- CSS guardrails:
  - Undefined CSS variable scan once implemented.
  - Global selector ownership scan or documented review checklist.
  - Raw value/token baseline review.
- Client proof:
  - Public browser route tests/screenshots for `/`, `/gardens`, `/gardens/:id`, `/impact`, `/fund`,
    `/actions`.
  - Installed PWA proof for `/home`, `/garden`, `/profile`, AppBar, splash/loading, drawers, media,
    offline/sync.
- Admin/shared proof:
  - Shared Storybook checks if shared UI/style surfaces move.
  - Admin `/hub` or relevant route smoke if admin/shared CSS changes.

## QA Sequence

### Claude QA Pass 1

- Review visual regressions, missing proof, and places where cleanup changed the feel of a surface.
- Confirm public browser, installed PWA, and admin dialect boundaries remain intact.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` passes.
- Confirm trigger branch exists: `claude/qa-pass-1/css-maintainability-polish`.
- Re-run guardrails and targeted validation.
- Confirm plan/status history reflects the final cleanup outcome.

## Archive Criteria

This hub can archive only after:

- The sequencing gate and any early-start exceptions are recorded.
- CSS ownership inventory is complete.
- Undefined variable and raw-value drift are either fixed or tracked with explicit owners.
- Global selector ownership is documented.
- Public browser, installed PWA, and admin regression proof is recorded for touched surfaces.
- Validation commands above pass or have documented, non-product blockers.
