# Keep Older Passkey Accounts Working on Every Site - State/API Handoff

## Lane

- Owner: Codex (steps 1 to 3 by Claude, 2026-10-17)
- Branch: `feature/passkey-account-continuity`
- Status: in progress. Steps 1 to 3 done (`a76570cfd`, `b89b06bef`, `8c1e84f86`); steps 4 to 6 and
  10 remain.

## Scope

- Implement shared types, hooks, query keys, state, job queue, and API flows accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- Keep reusable hooks in `packages/shared/src/hooks`.

## TDD Proof

- RED (before each fix, 2026-10-17):
  - Step 1: `authServices.test.ts` failed 2 of 42. A hex-stored entry and the legacy device were
    both refused with "Passkey server authentication failed". With only the hex reading fixed,
    the hosted spelling's name still failed "did not match the expected account address".
  - Step 3: `passkey-directory.test.ts` failed 5 of 29 (key spelling, a claimed ID beside its
    owner, challenge purpose, `signingId` in the lookup), and the SQLite scope failed 9
    (`user_version` 9, the v2.0.1 upgrade, the store contract).
  - Step 2 moves the verifier without changing behaviour, so it has a GREEN run only.
- GREEN: `authServices.test.ts` 42 of 42 and six shared auth files 141 of 141; the verifier with
  its byte form 60 of 60; `passkey-directory.test.ts` 29 of 29; the SQLite scope 21 files, 203 of
  203. Shared typecheck, source structure, agent typecheck and test typecheck, and lint passed.
- Proof limit: none recorded.

## Validation

- Pending lane implementation.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Record blockers here before changing `status.json`.
