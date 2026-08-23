# W0-G2: Turbo and scoped validation guidance

## Goal

Make iterative testing guidance use the cache-aware full-scope runner and accurately explain that
local Ship intent is path-scoped unless the change set is empty.

## Read first

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/context/validation-pipeline.md`
- `.claude/context/testing.md`
- `.claude/skills/ship/SKILL.md`
- `.claude/skills/review/SKILL.md`
- `.claude/skills/debug/SKILL.md`
- `.claude/skills/clean/SKILL.md`
- `.claude/skills/audit/SKILL.md`
- root `package.json`

## Allowed paths

- `package.json`
- `CLAUDE.md`
- `.claude/context/*.md`
- `.claude/skills/ship/**`
- `.claude/skills/review/**`
- `.claude/skills/debug/**`
- `.claude/skills/clean/**`
- `.claude/skills/audit/**`
- `packages/{admin,client,shared}/AGENTS.md` when required to satisfy the existing authenticated
  browser-policy guidance guard

## Required outcome

- Set root `test:fast` to concurrency 2.
- Replace iterative-loop `bun run test` guidance with `bun run test:fast`. Keep `bun run test` where
  the exact uncached full suite is the claim.
- Describe `node scripts/dev/ci-local.js` as Ship intent by default, path-scoped for known changes,
  and full-repository when the change set is empty.
- Keep critical, merge, readiness, and release guidance aligned with the repository selector.

## Do not

- Change selector code, validation policy, workflows, dependency versions, or the definition of the
  full Ship Gate.
- Start before `w0_turbo_test_routing` is merged into `develop`.
- stage, commit, push, merge, or modify another lane's paths.

## Gates

- `node scripts/quality/check-codex-docs.js`
- `bun run check:guidance-links`
- `bun run check:skill-behavior`
- Render and execute the QA selector for the exact changed guidance paths.
- Search the changed guidance and confirm every remaining `bun run test` refers to an exact full
  suite, certification gate, or package command rather than the default iterative loop.

## Report back

Return changed paths, each guidance gate result, the remaining intentional `bun run test` references,
and any policy ambiguity. Do not claim passed until a clean committed Validation Receipt exists.

## Validation Receipt

- Tested implementation commit SHA: `8fd3311980b28d71d48f72fe41c99d15276de912`
- Run at (UTC): `2026-08-23T07:56:20Z`
- Exact command(s): `node scripts/quality/check-codex-docs.js`; `bun run
  check:guidance-links`; `bun run check:skill-behavior`; `node
  scripts/check-browser-verification-policy.mjs`; `bun run validation:plan -- --intent qa --changed
  package.json --changed CLAUDE.md --changed .claude/context/validation-pipeline.md --json`; `bun run
  --filter @green-goods/shared typecheck`; `bun run --filter @green-goods/shared test`; `bun run
  --filter @green-goods/client test`; `bun run --filter @green-goods/admin test`; `bun run --filter
  @green-goods/agent typecheck`; `bun run --filter @green-goods/agent test`; `bun run --filter
  @green-goods/indexer test`; `bun run --filter @green-goods/contracts build`; `bun run --filter
  @green-goods/contracts test`; `bun run --filter @green-goods/docs build`.
- Result: Codex consistency and 59-file guidance-link checks passed; 6/6 skill-behavior scenarios
  passed; authenticated-browser policy passed for all 5 required guidance files; the selector was
  ready and every selected surface passed, including Shared 3,931, Client 865, Admin 659, Agent
  270, Indexer 286, Contracts 2,050 plus 289 script tests and the release gas boundary, and Docs
  build. The remaining `bun run test` references are exact certification or package commands.
- Validated paths: `package.json`, `CLAUDE.md`, `.claude/context/validation-pipeline.md`, and
  `packages/{admin,client,shared}/AGENTS.md`, plus the repository validation entrypoints selected
  for those paths.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all --
  package.json CLAUDE.md .claude/context/validation-pipeline.md packages/admin/AGENTS.md
  packages/client/AGENTS.md packages/shared/AGENTS.md` → empty.
- Evidence-only diff command and result (if applicable): `git diff --exit-code
  8fd3311980b28d71d48f72fe41c99d15276de912..HEAD -- package.json CLAUDE.md
  .claude/context/validation-pipeline.md packages/admin/AGENTS.md packages/client/AGENTS.md
  packages/shared/AGENTS.md` → empty.
- Evidence-only worktree-status command and result (if applicable): same path-scoped status command
  above → empty.
