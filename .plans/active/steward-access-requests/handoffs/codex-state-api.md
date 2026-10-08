# Steward Access Requests - State/API Handoff

## Lane

- Owner: Codex
- Branch: `release/october-2-0-0`
- Status: implementation assembled; committed validation pending

## Scope

- Implement shared types, hooks, query keys, state, job queue, and API flows accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- Keep reusable hooks in `packages/shared/src/hooks`.

## TDD Proof

- RED: Agent admission/API/chain command in status.json failed 11 cases, with 48 passed, at 2026-10-08T06:55:11Z. Missing signed kind binding, steward admission and strict target role confirmation were observed in command output. No persisted RED log exists.
- RED: Shared protocol/transport/hooks initially failed 22 cases with 49 passed; supplemental passkey proof failed 9 with 20 passed. Local logs: `/private/tmp/green-goods-steward-shared-red.log` and `/private/tmp/green-goods-steward-shared-passkey-red.log`.
- GREEN: Shared 108 focused tests; Agent 519 unit tests plus one skipped and 174 SQLite tests; package typechecks/lint/builds passed on the provisional tree. Local logs: `/private/tmp/green-goods-steward-shared-final-proof.log`, `/private/tmp/green-goods-steward-agent-unit-coverage.log` and `/private/tmp/green-goods-steward-agent-sqlite.log`.
- Proof limit: authenticated passkey signing, deployed API and real onchain role assignment are unverified. No production transactions were performed.

## Validation

- Signed proof, authorization grants, query keys, list/self/withdraw/resolve and mutation barriers distinguish membership from stewardship. Legacy omitted kind retains existing membership bytes. Old availability responses enable membership only. The server advertises supported kinds.
- Role confirmation requires Operator or Owner for stewardship; gardener membership is insufficient. Existing gardeners may request stewardship, closed joining does not block it, and existing stewards are rejected as already admitted.
- SQLite schema version 8 migrates the pending uniqueness index by request kind under an immediate transaction, preserving records and encrypted payloads. Garden caps remain aggregate and rate limits unchanged.
- Parent read the changed authorization, service, storage and transport lines. Peer API/protocol review found no additional actionable issue. Final committed validation remains pending.

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
