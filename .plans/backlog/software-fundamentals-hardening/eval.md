# Software Fundamentals Hardening Evaluation Plan

## Release Gates

1. Correctness: repo guidance, plan commands, and validation scripts match the live checkout.
2. Agent usability: a new agent can find the current plan command, current guidance checks, and current module targets without chat-only context.
3. Guidance fidelity: package guides and ADRs describe the current architecture, including contracts resolvers and shared import policy.
4. Feedback reliability: Knip and Fallow are compared on the same baseline, then the chosen dead-code/static-health checks can run as cleanup evidence before becoming gates.
5. Regression safety: Campaign Cookie Jar and agent API behavior remain covered while internals move behind deeper boundaries.
6. Evidence quality: every activated slice records command output, test evidence, and proof limits in handoffs or reports.
7. Human judgment: deletions, CI promotion, and broad refactors are scope-locked before implementation.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `check:claude-guidance` and `check:codex-guidance` pass or record an explicit accepted blocker | `state_api` | command output in handoff |
| AC-2 | `.plans` docs and automation prompts no longer point agents at stale plan-hub commands | `state_api` | `rg` output + plan validation |
| AC-3 | contracts package guidance no longer references removed `GreenGoodsResolver` files or tests | `state_api` | `rg` output + guide diff |
| AC-4 | ADR-008 and shared package guidance state the current root-barrel/subpath import policy | `state_api` | docs diff + app import spot-check |
| AC-5 | Knip vs Fallow report compares same-baseline output, false positives, true positives, runtime, secret coupling, duplication/health coverage, and agent usability | `state_api` | `reports/knip-vs-fallow-evaluation.md` |
| AC-6 | The selected dead-code/static-health path runs without Varlock/1Password failure and records triage output | `state_api` | `bun run check:dead-code` or chosen command output |
| AC-7 | source-structure baseline report identifies stable oversized files, stale allowlist entries, and next cleanup targets | `state_api` | report under this hub |
| AC-8 | large behavior work has RED evidence, interface-level tests, or explicit proof-limit notes before implementation | `state_api` | plan/handoff checklist updates |
| AC-9 | Campaign Cookie Jar has tests at a deeper non-UI behavior boundary before hook/UI decomposition | `state_api` | targeted test output |
| AC-10 | Agent API server internals are split without changing the `createServer` public interface | `state_api` | targeted agent test output |
| AC-11 | stale admin surfaces are deleted, adopted, or explicitly documented as story-only | `ui` | source references + reviewer signoff |
| AC-12 | QA pass 1 verifies the human-facing plan and UI-facing implications | `qa_pass_1` | `handoffs/claude-qa-pass-1.md` |
| AC-13 | QA pass 2 verifies implementation regressions and remaining proof limits | `qa_pass_2` | `handoffs/codex-qa-pass-2.md` |

## Test Strategy

- Unit: read-model/mutation-service tests for Campaign Cookie Jar and extracted agent API helpers.
- Integration: existing admin/client/agent tests that cover the moved surfaces.
- E2E / Playwright: only if a later implementation slice changes user-facing behavior.
- Static checks: contracts guidance `rg`, shared import spot-checks, Knip/Fallow same-baseline comparison, chosen dead-code/static-health command, and source-structure report review.
- Manual checks: stale surface classification and CI/gate placement decision.

### Knip vs Fallow Evaluation Commands

Run in report-only mode first. If Fallow cannot be resolved locally because network access is blocked, record the blocker and do not infer tool fitness from documentation alone.

- `bunx knip --include files --reporter compact`
- `bunx knip --reporter compact`
- `bunx fallow dead-code --format json`
- `bunx fallow dupes --mode mild --format json`
- `bunx fallow health --targets --format json`
- `bunx fallow audit --base origin/develop --format json`

Required report sections:

- tool versions and install/resolution path
- runtime and whether secrets/env setup was required
- high-confidence true positives
- false positives and required ignore/baseline rules
- findings Knip catches that Fallow misses
- findings Fallow catches that Knip misses
- recommendation: Knip only, Fallow only, hybrid, or defer
- first gate posture: advisory, baseline/regression, changed-file only, or blocking

## QA Sequence

### Claude QA Pass 1

- Review whether the plan still reflects the human audit intent rather than generic cleanup.
- Confirm UI-facing stale-surface decisions are understandable and conservative.
- Check that Campaign Cookie Jar behavior is not being redesigned under a refactor label.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists: `claude/qa-pass-1/software-fundamentals-hardening`.
- Re-run targeted validation:
  - `node scripts/harness/plan-hub.mjs validate`
  - `bun run check:claude-guidance`
  - `bun run check:codex-guidance`
  - `rg "GreenGoodsResolver|src/resolvers/GreenGoods|GreenGoods\\.sol" packages/contracts/AGENTS.md packages/contracts/src packages/contracts/test`
  - review `reports/knip-vs-fallow-evaluation.md` for a tool decision and proof limits
  - `bun run check:dead-code`
  - `bun run check:source-structure`
  - targeted `bun run test -- <file>` commands for touched implementation slices
  - `bash scripts/quality/check-test-quality.sh` when tests changed
- Record any remaining proof limits in `reports/` before the hub is promoted, split, or archived.
