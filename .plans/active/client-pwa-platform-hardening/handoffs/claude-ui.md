# Client PWA Platform Hardening - UI Handoff

## Lane

- Owner: Codex
- Branch: shared `develop` checkout; no branch operation authorized
- Status: implementation complete; device/QA proof pending

## Scope

- Implement the UI behavior accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- Keep hooks, query keys, and shared state in `@green-goods/shared`.

## TDD Proof

- RED: regression tests were authored during the implementation; individual RED snapshots were not retained.
- GREEN: 13 focused Client PWA test files, 101 assertions passed.
- Proof limit: physical Android/WebAPK behavior is not reproducible in the local desktop browser.

## Validation

- Client lint and repository format pass.
- Direct Vite production build and all PWA startup/offline-shell budgets pass.
- Authenticated Brave renders the public and installed shells and loads the public funding wallet
  island only after interaction.

## Validation Receipt

- Tested implementation commit SHA: `d788fa2e8d9f9555dcb80c94422d08a3ac0786c2`
- Run at (UTC): 2026-08-31T21:45:24.000Z
- Exact command(s): `cd packages/client && bun run test` (full client Vitest suite)
- Result: 120/120 test files, 1021/1021 tests passed; exit 0
- Validated paths: `packages/client` and the shared provider/hook/component surfaces the PWA shell
  consumes
- Worktree identity command and result: `git rev-parse HEAD` =
  `d788fa2e8d9f9555dcb80c94422d08a3ac0786c2`;
  `git status --porcelain=v1 --untracked-files=all -- packages/client packages/shared` returned
  empty (clean)
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Physical Android Chrome/WebAPK is required for install/open capture, system Share Target, badges,
  cold-offline launch, and two-version update proof.
- The full Client test/typecheck gate is blocked by a checked-in WalletConnect/`uint8arrays`
  resolver failure and concurrent address-typing changes.
