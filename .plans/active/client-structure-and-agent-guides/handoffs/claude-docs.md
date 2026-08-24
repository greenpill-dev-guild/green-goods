# Docs Lane Handoff

Status: Phases 3 and 4 implemented. The broader feature remains open for the state/API, UI, and QA lanes.

## Completed Phase 3 scope

- `AGENTS.md` is the agent-neutral entry contract with one validation summary, early package routing,
  common commands, criticality, PostHog routing, and canonical architecture/validation links.
- `CLAUDE.md` contains Claude-specific entrypoints, tool routing, output/scope behavior, Codex
  dispatch, health-skill routing, and session continuity instead of copying shared policy.
- Every package guide uses the same validation shape: targeted QA, package loop, conditional proof,
  and broader-impact escalation. Package-specific domain and security rules remain local.
- Contracts no longer permit a partial test pass on testnet; every selector-required test must pass.
- `check-codex-docs.js` rejects near-verbatim policy blocks copied between root `AGENTS.md` and
  `CLAUDE.md`, while ignoring short shared labels and unrelated guidance.
- The architecture context link remains present in both agent entrypoints.

## TDD receipt

- Phase 3 RED: `node --test scripts/quality/check-codex-docs.test.mjs` failed because
  `findNearDuplicatePolicyBlocks` was not exported.
- Phase 3 GREEN: the same command passed three fixtures covering near-copy detection, short/unrelated prose,
  and one-report-per-block behavior.
- Phase 4 RED: `node --test scripts/quality/check-source-structure.test.mjs` failed because
  `check-source-structure.js` did not export `collectStructureViolations`.
- Phase 4 GREEN: the same command passed nine fixtures covering placement, client naming, hook
  locality, Shared export-map enforcement, changed-file dead exports, staged/barrel/test/story
  exclusions, exact baseline shrinkage, and baseline growth rejection.

## Completed Phase 4 scope

- The existing source-structure checker now scans the whole package tree for placement, client
  naming, hook locality, and undeclared Shared imports.
- Changed implementation files receive a conservative dead-export scan; barrels, tests, stories,
  and the exact staged-module manifest are excluded.
- `scripts/data/source-structure-baseline.json` records 22 pre-enforcement violations. New IDs and
  baseline growth fail; removed violations leave stale IDs that must be deleted in the same change.
- `AGENTS.md` now states the same durable layout rules enforced by the checker.
- `bun run test:validation-system` owns the nine source-structure fixtures.

## Deliberately retained boundaries

- Service ports and operational variants stay in `scripts/README.md` and builder docs rather than a
  second volatile inventory in root guidance.
- The Contracts guide remains longer because its deployment, upgrade, storage, and security rules
  are legitimate package-specific boundaries; only its development/validation contract was leveled.
- The TypeScript build lane, client layout work, and final QA passes remain open. Phase 2 must shrink
  the structure baseline as it completes the planned moves and renames.

## Validation Receipt

- Tested implementation commit SHA: not commit-attributable; dirty shared worktree limitation for
  the validated paths because this environment denied writes to `.git/index.lock`
- Run at (UTC): `2026-08-24T22:47:26Z`
- Exact command(s): `node scripts/dev/ci-local.js --intent ship --risk sensitive --changed '.plans/active/client-structure-and-agent-guides/eval.md,.plans/active/client-structure-and-agent-guides/handoffs/claude-docs.md,.plans/active/client-structure-and-agent-guides/plan.todo.md,.plans/active/client-structure-and-agent-guides/status.json,AGENTS.md,package.json,scripts/README.md,scripts/data/source-structure-baseline.json,scripts/quality/check-source-structure.js,scripts/quality/check-source-structure.test.mjs,scripts/quality/check-staged-modules.mjs'`; `bun run test:validation-system`; `bun run check:source-structure`
- Result: all 26 mandatory Ship checks passed; validation-system passed 171 of 171 tests; the
  whole-tree source gate matched exactly 22 shrinking-baseline IDs; the focused Phase 4 suite passed
  9 of 9 fixtures
- Validated paths: `.plans/active/client-structure-and-agent-guides/eval.md`,
  `.plans/active/client-structure-and-agent-guides/handoffs/claude-docs.md`,
  `.plans/active/client-structure-and-agent-guides/plan.todo.md`,
  `.plans/active/client-structure-and-agent-guides/status.json`, `AGENTS.md`, `package.json`,
  `scripts/README.md`, `scripts/data/source-structure-baseline.json`,
  `scripts/quality/check-source-structure.js`,
  `scripts/quality/check-source-structure.test.mjs`, and
  `scripts/quality/check-staged-modules.mjs`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- .plans/active/client-structure-and-agent-guides/eval.md .plans/active/client-structure-and-agent-guides/handoffs/claude-docs.md .plans/active/client-structure-and-agent-guides/plan.todo.md .plans/active/client-structure-and-agent-guides/status.json AGENTS.md package.json scripts/README.md scripts/data/source-structure-baseline.json scripts/quality/check-source-structure.js scripts/quality/check-source-structure.test.mjs scripts/quality/check-staged-modules.mjs` → nine modified and two untracked Phase 4 paths (dirty; exact list captured in the session receipt)
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

The earlier Phase 3 receipt passed the same 26-check Ship shape, review guardrails, 162
validation-system tests, and guidance drift checks. Its one semantic skill evaluation remained
externally blocked by incomplete evaluator output and was not repeated, as planned.
