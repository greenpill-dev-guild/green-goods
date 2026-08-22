# Docs Lane Handoff

Status: partial working-copy receipt; the lane remains open in `status.json`

This working-copy slice applies the accepted agent-guidance consolidation and deterministic
architecture checks. The lane is not complete: it still depends on the UI lane, the changes are
uncommitted, and the truthful TypeScript build gate is blocked on the `GardenAssessment` model
decision recorded in `handoffs/codex-state-api.md`.

## Implemented

- The CI gate now runs the source-structure fixtures and the live architecture checker before it
  polls the package workflows.
- `check-react-patterns.js` now enforces Green Goods package dependency direction, production
  dependency declarations, package-manifest cycles, shared export targets, and exported consumer
  hooks. Its existing shared-import and Zustand rules remain intact.
- `check-react-patterns.test.mjs` provides negative fixtures for each new boundary.
- Root and package agent guides use neutral agent-facing titles, keep the root `AGENTS.md` as the
  shared contract, and point duplicated authenticated-browser policy back to that canonical rule.
- Builder and testing documentation now reflects the current skill inventory, symlinked shared
  skill tree, configured Codex model, Bun-wrapped Foundry commands, Playwright setup, and test
  entrypoints.
- `check-codex-docs.js` now verifies derived facts instead of relying on prose review alone,
  including skill inventory, model config parity, package paths, shared hook/store inventory, and
  testing commands.

## Deliberately deferred

- File-level TypeScript import-cycle enforcement and formal shared-domain layering need AST/module
  resolution support; the current check does not pretend to prove them.
- Full root-guide compression and package structure cleanup remain in the parent plan.
- The TypeScript `tsc -b` gate was restored rather than left red. A truthful candidate config finds
  87 client and 61 admin errors, with the central ambiguity being legacy assessment fields in the
  UI versus the canonical `GardenAssessment` v2 shape.

## Fresh validation

- `node --test scripts/quality/select-validation.test.mjs scripts/dev/ci-local.test.mjs scripts/quality/ci-gate.test.mjs scripts/quality/check-react-patterns.test.mjs` — 74 passed.
- `node scripts/quality/check-react-patterns.js` — 0 blocking violations.
- `bun run check:codex-guidance` — passed. A deliberate stale skill-count probe failed before the
  correct count was restored.
- `bun run check:guidance-links` — 59 guidance files passed.
- `bun run test:review-guardrails` — 85 passed.
- `node docs/scripts/docs-audit.mjs --ci` — no warnings.
- `node scripts/harness/plan-hub.mjs validate` — 44 hubs passed before this receipt update.

`bun run test` is not a passing receipt for this slice: the pre-change baseline reached 2,050
passing contract tests, then `test:script` hit two existing five-second release-test timeouts. Do
not present this working copy as merge-ready until those baseline failures are resolved or proven
unrelated under a fresh Ship Gate.
