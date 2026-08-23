# W0-E: Load-sensitive tests

## Goal

Remove the five measured load-sensitive failures without retries, skipped assertions, or broad
timeout inflation, and preserve each test's real behavior contract.

## Read first

- `AGENTS.md`
- `packages/admin/AGENTS.md`
- `packages/client/AGENTS.md`
- `packages/shared/AGENTS.md`
- `packages/contracts/AGENTS.md`
- The five listed test files and their current implementation subjects
- `packages/admin/src/__tests__/components/CreateAssessmentDialog.test.tsx` around the real-timer model

## Allowed paths

- `packages/admin/src/__tests__/components/CreateAssessmentDialog.test.tsx`
- `packages/admin/src/__tests__/components/Garden/AddMembersDialog.test.tsx`
- `packages/contracts/script/deploy/release.test.ts`
- `packages/contracts/vitest.config.ts`
- `packages/shared/src/__tests__/i18n/locale-coverage.test.ts`
- `packages/client/src/__tests__/components/GardenGardeners.test.tsx`

## Required outcome

- Assessment dialog Escape waits for `/hub/work` and dialog removal, then keeps the `Discard`
  negative assertion last.
- Add Members uses `userEvent.setup({ delay: null })`, clicks the input, and pastes the address once.
- Contract deploy script tests use a package Vitest config with Node and 30-second test/hook
  timeouts; only the named two-spawn case receives a 60-second timeout.
- Locale coverage prefilters by the accepted FormatJS trigger tokens before parsing, includes one
  direct trigger-form test, and proves filtered versus unfiltered references are identical on the
  current tree.
- Garden Gardeners pins `getBoundingClientRect` and waits for asynchronous virtualization rows and
  ARIA state.

## Do not

- Change production UI or contract behavior, install dependencies, use raw Forge, add retries, skip
  tests, or widen any unrelated global timeout.
- Add or change user-facing copy.
- stage, commit, push, merge, or modify another lane's paths.

## Gates

- Render and execute the QA selector for the six allowed paths.
- Run every focused test alone and five times while `bun run test:admin` is active in a separate
  process. Record at least one pre-change loaded failure per file and zero of five after.
- Run the contract script suite through its Bun/Vitest wrapper, never raw Forge.
- Run the one-off locale reference equivalence proof and keep it in the result evidence, not as an
  unmaintained production script.

## Report back

Write `/tmp/gg-codex-w0_load_sensitive_tests/codex-result.md` with `status`, `tests_passed`, and
`issues`. Include failure frequency before and after for all five files, the exact commands, and any
host-load caveat. Do not claim passed until a clean committed Validation Receipt exists.

## Validation Receipt

- Tested implementation commit SHA: `87e6d6495feab686a75178ed478440a425df2599`
- Published stacked commit SHA: `ffbed3546cd3d798ff449407f1b35bece479a29c` in PR #758,
  based on `perf/turbo-test-routing`.
- Run at (UTC): `2026-08-23T04:44:43Z`
- Exact command(s):
  - `bun run test -- src/__tests__/components/CreateAssessmentDialog.test.tsx src/__tests__/components/Garden/AddMembersDialog.test.tsx` from `packages/admin`
  - `bun run test -- src/__tests__/components/GardenGardeners.test.tsx` from `packages/client`
  - `bun run test -- src/__tests__/i18n/locale-coverage.test.ts` from `packages/shared`
  - `bun run test:script -- script/deploy/release.test.ts` from `packages/contracts`
  - `/Users/afo/.local/share/mise/installs/node/22.22.1/bin/node /tmp/w0e-locale-equivalence.mjs`
  - `git status --porcelain=v1`
- Result: PASS WITH PRE-CHANGE PROOF LIMIT. At the clean committed SHA, admin passed 14/14, client
  1/1, shared 13/13, and contracts 32/32. All five focused files then passed 5/5 repetitions under
  continuous admin-suite load, and all five background admin suites passed 94 files/659 tests.
  The exact pre-change admin-load RED did not reproduce; an untouched-baseline shared-coverage run
  supplied supporting but non-equivalent locale-flake evidence. No before/after frequency claim is
  made beyond the measured post-edit 0/5 per file. The required one-off locale comparison found
  4,568 identical references with and without the prefilter while reducing parsed source files from
  1,226 to 451.
- Validated paths: the six allowed paths above.
- Worktree identity command and result: `git worktree list --porcelain` identified
  `/private/tmp/gg-codex-w0_load_sensitive_tests` on `test/load-sensitive-tests` at the tested SHA.
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1`
  returned no paths after validation-only dependency and Foundry-artifact symlinks were moved out.
