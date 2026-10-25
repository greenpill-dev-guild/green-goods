# One Look for the App and the Cockpit - QA Pass 2 Handoff

## Lane

- Owner: Codex
- Branch: none; the review read a detached checkout of `develop` at `8476dbd80`
- Status: completed; the review asks for changes (one medium finding)

## Scope

- Review regressions, implementation edges, and validation evidence after QA Pass 1.

## Validation

- The regression review read every PRD-1266 code PR merged to `develop` from step 1 (#1172) through
  step 20's merged phases (#1248, #1249, #1251, #1252), for behavior rather than look. Step 20's
  phases 1 (#1256) and 2 (#1255) had not merged, so the review does not cover them.
- Verdict: request changes. One medium regression (A14): at phone width, a queued promise whose
  send failed no longer says why, because the one-line detail drops the reason. Five low findings
  and four calls for Afo follow. No PRD-1266 PR touched auth, wallet signing, the job queue or
  offline uploads.
- Findings (private): https://claude.ai/artifact/WTnYosMJSaicyEArM3wnPX
- Rendered proof, labeled by class: Storybook (headless Chromium), 232 public stories at 390 and
  1280px before PRD-1266 and now. No authenticated-class surface changed.

## Validation Receipt

- Tested implementation commit SHA: `8476dbd80` (`develop`)
- Run at (UTC): 2026-10-24T20:21:00Z
- Exact command(s): `bun run test` in `packages/shared`, `packages/client` and `packages/admin`;
  `VITE_CHAIN_ID=11155111 bun run build`; `bunx playwright test --project=client-ci`;
  `bunx playwright test --project=admin-ci`
- Result: Shared 7,591 tests passed (16 skipped), client 1,746 and admin 1,378. The indexer, client
  and admin built; the contracts build did not run because the checkout's submodules were not
  initialized, and no PRD-1266 PR touched contracts. Playwright's client CI project passed 25 tests,
  and its admin CI project passed 12 on a quiet rerun after a boot timeout under load. GitHub CI on
  `develop` at `8476dbd80` passed.
- Validated paths: `packages/shared`, `packages/client`, `packages/admin` and `tests`
- Worktree identity command and result: recorded at handoff in `.claude/worktrees/step22-develop`,
  the detached `develop` checkout at the tested commit,
  `git status --porcelain=v1 --untracked-files=all -- packages/shared packages/client packages/admin tests`
  → empty
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- The medium finding needs a fix and a one-line amendment to DL-110 before the queued promise rows
  are accepted.
- The review checked no real devices and no live RPC limits; pass 1 covers visual polish.
