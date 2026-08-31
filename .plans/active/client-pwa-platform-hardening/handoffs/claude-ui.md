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

- Tested implementation commit SHA: none; work remains uncommitted in a shared dirty checkout
- Run at (UTC): 2026-08-30T21:14:30Z
- Exact command(s): focused Client Vitest; Client lint; direct Vite production build; PWA budget
  checker; authenticated Brave browser inspection
- Result: implementation checks pass; external/full-checkout gates remain
- Validated paths: `packages/client`, relevant Shared provider/hooks/components, and generated `dist`
- Worktree identity command and result: `git status --short`; shared `develop` checkout contains
  unrelated concurrent changes that were preserved
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Physical Android Chrome/WebAPK is required for install/open capture, system Share Target, badges,
  cold-offline launch, and two-version update proof.
- The full Client test/typecheck gate is blocked by a checked-in WalletConnect/`uint8arrays`
  resolver failure and concurrent address-typing changes.
