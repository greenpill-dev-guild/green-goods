# Karma GAP Integration Repair - Contracts Handoff

## Lane

- Owner: Codex
- Branch: set when work begins using `<type>/<work-description>`
- Status: implementation checkpoint validated; release blocked

## Scope

- Implement contract behavior accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- Use repo `bun` wrappers for build, test, deploy, and upgrade flows.

## TDD Proof

- RED: focused reconciliation and payload tests failed against the pre-change authority, ordering,
  role, and JSON behavior during the implementation session
- GREEN: selected contract suites pass through package Bun wrappers, including reconciliation
  15/15, JSON builder 33/33, KarmaModule 53/53, GardenAccount 95/95, WorkApproval 44/44,
  Garden minting 6/6, and upgrade behavior 1/1
- Proof limit: results are working-tree evidence, not a clean commit-attributed terminal receipt

## Validation

- Karma project creation, canonical details/image and Project Update payloads, role-union access,
  membership history, structured failure events, and continuous metadata hooks are implemented.
- Storage layout matches the updated additive baseline, lint has zero errors, source ceilings hold,
  and every deployable contract remains below EIP-170.

## Validation Receipt

- Tested implementation commit SHA: not pinned; dirty working-tree checkpoint
- Run at (UTC): 2026-08-26T06:59:00Z
- Exact command(s): `bun run --cwd packages/contracts test:match <selected-test-path>`; `bun run --cwd packages/contracts check:storage-layout -- --contract KarmaGAPModule`; `bun run --cwd packages/contracts check:sizes`; `bun run --cwd packages/contracts lint:check`; `bun run check:source-structure`
- Result: focused suites and all listed structural gates pass; Solidity lint reports zero errors
- Validated paths: `packages/contracts/src`, `packages/contracts/test`, generated GardenAccount/GardenToken ABIs, KarmaGAPModule storage baseline
- Worktree identity command and result: intentionally dirty implementation paths; terminal receipt not claimed
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Existing deterministic GardenAccounts delegate directly to the original GardenAccount
  implementation. They are not AccountProxy-backed UUPS instances and cannot receive the new
  callback through UUPS, including when called by the Garden NFT owner.
- Production deployment, migration, reconciliation, and broadcast remain unauthorized.
