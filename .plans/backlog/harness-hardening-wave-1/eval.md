# Harness Hardening Wave 1 Evaluation Plan

## Release Gates

1. Correctness: new backlog hub validates and the new scripts/workflows match the Wave 1 contract exactly
2. Usability: criticality depth and weekly harness-GC instructions are explicit enough that agents can follow them without chat-only context
3. Regression safety: deterministic checks pass on the current repo baseline and advisory reviewers remain non-blocking in Wave 1

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `.plans/backlog/harness-hardening-wave-1/` contains real brief/spec/plan/eval content and points back to the research map plus active rollout only | `state_api` | Hub files + `status.json` |
| AC-2 | `bun run check:source-structure` enforces 350-line new-file cap, 500-line modified-file cap, and frozen ceilings for current oversized files | `state_api` | local script output |
| AC-3 | blocking workflows exist for `Design Guardrails` and `Source Structure` | `state_api` | workflow files |
| AC-4 | advisory workflows exist for `contracts-security` and `mutation-reliability`, with severe-only prompts and no blocking semantics | `qa_pass_1` | workflow files |
| AC-5 | repo guidance documents explicit `critical`, `sensitive`, and `routine` classes plus critical-surface depth warnings | `state_api` | `CLAUDE.md`, `.claude/context/values.md`, `.claude/settings.json` |
| AC-6 | weekly harness-GC prompt writes only reports to `.plans/reviews/harness/<date>-codex-harness-gc.md` and does not execute changes | `qa_pass_2` | prompt file + automation README |

## Test Strategy

- Unit: n/a
- Integration: validate the plan hub, guidance consistency, and codex consistency scripts
- E2E / Playwright: n/a
- Manual checks: inspect workflow semantics to confirm deterministic checks are blocking and Claude review workflows remain advisory

## QA Sequence

### Claude QA Pass 1

- Focus on missing requirements, reviewer prompt scope, and guidance drift
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Confirm the trigger branch exists: `claude/qa-pass-1/harness-hardening-wave-1`
- Re-run targeted validation and confirm the Wave 1 contracts hold:
  - `node scripts/plan-hub.mjs validate`
  - `node .claude/scripts/check-guidance-consistency.js`
  - `node scripts/check-codex-consistency.js`
  - `bun run check:design-tokens`
  - `bun run lint:vocab`
  - `bun run check:source-structure`
- Open a PR and verify that deterministic checks appear as required status checks while the new reviewer workflows remain advisory comments only
