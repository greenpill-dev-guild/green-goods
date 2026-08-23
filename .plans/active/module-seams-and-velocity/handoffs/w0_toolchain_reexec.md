# W0-B: Compatible toolchain re-exec

## Goal

Make both documented `ci-local` entrypoints re-enter through a compatible real Node toolchain from
an agent shell, without changing the honest blocked result on hosts that do not have Node 22.

## Read first

- `AGENTS.md`
- `scripts/lib/dev-shared.js`
- `scripts/dev/node-cli.js`
- `scripts/dev/ci-local.js`
- `scripts/dev/ci-local.test.mjs`
- `scripts/quality/select-validation.mjs`
- `scripts/quality/select-validation.test.mjs`
- `package.json` (coordinator review step only)
- `.plans/active/module-seams-and-velocity/spec.md`

## Allowed paths

- `scripts/lib/dev-shared.js`
- `scripts/lib/dev-shared.test.mjs`
- `scripts/dev/node-cli.js`
- `scripts/dev/ci-local.js`
- `scripts/dev/ci-local.test.mjs`

## Required outcome

- Add injectable `findCompatibleNode({ isSupported, candidates, probe, exists })` and
  `reexecUnderCompatibleNodeIfNeeded({ scriptPath, sentinel, cwd, isSupported, spawn, exit })` to
  `dev-shared.js`.
- Candidate order is the mise shim first, then `$NODE`, PATH entries excluding Bun shims, then mise
  installs. Re-entry must carry the matching Bun and Foundry toolchain.
- Replace `node-cli.js`'s private compatibility search and re-entry with the shared helpers while
  preserving its 22.12+/20.19+ policy and sentinels.
- In the direct-run path only, make `ci-local.js` re-enter with
  `GREEN_GOODS_CI_LOCAL_NODE_REEXEC` and `GREEN_GOODS_CI_LOCAL_COMPAT_REEXEC`; imported test code
  must remain side-effect free. `ci-local` requires Node major 22 or newer.
- Add dependency-free `node:test` coverage for candidate selection, missing-compatible-Node behavior,
  successful re-entry, sentinel no-op, and the static `ci-local` wiring guard.
- Add the new direct root test to `directRootTestChecks`. Register it in the root
  `test:validation-system` script during the coordinator review step.

## Do not

- Edit lockfiles, workflow files, or `.claude/**`.
- Install dependencies, relax toolchain checks, or invent fallback versions.
- stage, commit, push, merge, or modify another lane's paths.

## Gates

- RED: `node scripts/dev/ci-local.js --quick --plan-json` reports
  `blocked [toolchain.node, toolchain.bun]` from the current agent shell.
- `node --test scripts/lib/dev-shared.test.mjs scripts/dev/ci-local.test.mjs`
- GREEN: `node scripts/dev/ci-local.js --quick --plan-json` reports `ready` with Node 22.22.1,
  Bun 1.3.14, and Foundry 1.7.1 on this host; `bun run ci:local -- --quick` reaches the same plan.
- Render and execute `bun run validation:plan -- --intent qa --changed scripts/lib/dev-shared.js,scripts/lib/dev-shared.test.mjs,scripts/dev/node-cli.js,scripts/dev/ci-local.js,scripts/dev/ci-local.test.mjs`.

## Report back

Write `/tmp/gg-codex-w0_toolchain_reexec/codex-result.md` with `status`, `tests_passed`, and
`issues`. Include changed files, RED/GREEN output, the sentinel infinite-loop proof, and any host
capability blocker. Do not claim passed until a clean committed Validation Receipt exists.

## Validation Receipt

- Tested implementation commit SHA: `285837e93930a2d32a8ff7e8fd060881a56f7794`
- Published stacked commit SHA: `28754385cf91ea5c7e75358504540e12c2b04d8b` in PR #755,
  based on `perf/prepush-static-checks`.
- Run at (UTC): `2026-08-23T03:43:59Z`
- Exact command(s):
  - `bun run test:validation-system`
  - `node scripts/dev/ci-local.js --quick --plan-json`
  - `bun run ci:local -- --quick --plan-json`
  - `bunx @biomejs/biome format --no-errors-on-unmatched package.json`
  - `git status --porcelain=v1`
- Result: PASS. The durable suite passed 114/114. Both entrypoints returned `ready` with Node
  22.22.1, Bun 1.3.14, and Foundry 1.7.1 when the existing lockfile-matched dependency tree was
  exposed to the isolated worktree. Package formatting passed and final status was clean.
- Validated paths: `package.json`, `scripts/lib/dev-shared.js`,
  `scripts/lib/dev-shared.test.mjs`, `scripts/dev/node-cli.js`, `scripts/dev/ci-local.js`,
  `scripts/dev/ci-local.test.mjs`, `scripts/quality/select-validation.mjs`, and
  `scripts/quality/select-validation.test.mjs`
- Worktree identity command and result: `git worktree list --porcelain` identified
  `/private/tmp/gg-codex-w0_toolchain_reexec` on `fix/ci-local-toolchain-reexec` at the tested SHA.
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1`
  returned no paths after validation-only symlinks were moved out of the worktree.
