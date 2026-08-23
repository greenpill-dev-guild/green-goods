# W0-H: Validation Receipt debt burn-down

## Goal

Replace every temporary receipt waiver with fresh, commit-attributable proof by 2026-09-03, then
archive Validation System Optimization so this hub becomes the only active validation program.

## Read first

- `AGENTS.md`
- `.claude/skills/plan/SKILL.md`
- `.plans/_templates/feature/handoffs/README.md`
- `scripts/data/plan-hub-validation-receipt-debt.json`
- The status, plan, and handoff files for each waived feature and lane
- `.plans/active/validation-system-optimization/status.json`

## Allowed paths

- `scripts/data/plan-hub-validation-receipt-debt.json`
- The existing handoff files for the eight waived lanes
- The owning feature hubs' `status.json` and non-immutable plan files
- `.plans/active/module-seams-and-velocity/**`
- The archive move for `.plans/active/validation-system-optimization`

## Required outcome

- Re-run each waiver's exact lane commands on a clean committed path set.
- Add the complete Validation Receipt fields: tested SHA, UTC time, exact commands, concise result,
  validated paths, and empty path-scoped status. Use evidence-only parent receipts only with both
  required path-scoped diff and status proofs.
- Validate VSO state/API with selector and `ci-local` tests; contracts with CI Gate and parity tests;
  UI with its four guidance checks; QA passes with `test:validation-system` and cited live-CI
  evidence; Commitment Pooling and Celo with their declared contract/state validation through Bun
  wrappers.
- Delete an entry only after its receipt is complete. Never extend `expires_at`.
- If a lane cannot be revalidated honestly, mark it blocked with the reason.
- When all waivers are gone and Plan Hub validation is green, archive Validation System
  Optimization with an accurate completed resolution.

## Do not

- Edit or delete dated reports, weaken a command, reuse a failure, run raw Forge, broadcast, or
  extend a waiver.
- Start before W0-B, W0-C, and W0-G1 are merged into `develop`.
- merge a critical-surface receipt without Afo's approval.

## Gates

- All eight lane-specific commands from their current handoffs.
- `node scripts/harness/plan-hub.mjs validate`
- `node --test scripts/harness/plan-hub.test.mjs`
- `node -e` or an equivalent read-only JSON assertion that the debt entry array is empty.
- Re-read the archive status and confirm this hub's `depends_on_features` still resolves.

## Report back

Return one row per waiver with tested SHA, commands, result, clean path identity, and final state.
Name any lane that became blocked. Do not claim the hub archived until the filesystem move and Plan
Hub validation are both observed.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable
