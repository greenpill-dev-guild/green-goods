# Codex Lane C — Agent Quick Gate Fix (Sprint Day 2, 2026-04-20)

Sprint board: `.plans/active/admin-ui-revamp/execution-board-2026-04-20.md`
Base: `develop` tip (committed).

## Goal

Make `node scripts/ci-local.js --quick` return exit 0.

Current failure (from root-level run):
- `packages/agent/src/__tests__/feedback.test.ts` throws `TypeError: diagnostics.tracingChannel is not a function`.

Root cause hypothesis (verify before fixing): Node's `diagnostics_channel.tracingChannel` was introduced in Node 20. If the runtime or a transitive dependency targets Node 18 or an older shim, the call fails. The fix may be a test-side shim, a dependency alignment, or a Node-version guard inside the test.

## Scope

### Owned files (exact)

- `packages/agent/src/__tests__/feedback.test.ts`
- Minimal supporting files strictly required for the `diagnostics.tracingChannel` path (for example a shared test helper under `packages/agent/src/__tests__/helpers/` or a `vitest.setup.ts`).

### Out of scope

- Anything outside `packages/agent/src/__tests__/`.
- Runtime/prod code (unless the TypeError originates in prod code — in that case investigate and flag, but do not change unrelated code).
- `.claude/**`, `AGENTS.md`.
- Other failing tests in `ci-local.js --quick` (if any surface only after this fix lands, return `status: partial` with the next failure quoted).

## Constraints

- Keep the fix minimum-scope. Prefer a targeted mock/shim over a dependency bump.
- Do not disable or skip the test. If the test is fundamentally unviable on the current Node, return `status: partial` with the exact Node version required and the next recommended action.
- No raw `console.log` — use `logger` from shared if any logging added.
- **Commit your changes inside the worktree.**

## Validation (commands must pass, quoted in `validation_output`)

- `cd packages/agent && bun run test -- feedback` — PASS.
- `node scripts/ci-local.js --quick` from repo root — exit 0.
- `bun run lint` from repo root — PASS (to catch any unrelated regressions).

## Done when

- `ci-local.js --quick` returns 0.
- Everything committed inside the worktree.
- `codex-result.md` written per schema with `status: success`. Any blocker → `status: partial` with exact command + trace.

## Reporting requirements

Paste the literal last ~10 lines of each validation command into `validation_output`. Include the Node version (`node --version`) you used to validate.
