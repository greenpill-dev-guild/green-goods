# Archived dispatch artifacts — sprint 2026-04-20

These files are **historical**. They are the exact `codex exec --full-auto` prompts that were dispatched during the 2026-04-20 admin-ship sprint (Day 1 + Day 2), preserved for provenance only.

Do not re-dispatch them as-is:

- The worktree paths they reference (`/tmp/gg-codex-lane-*-2026-04-20`) and the branches they pinned (`codex/lane-*-day*/sprint-2026-04-20`) have been cleaned up.
- The baseline preconditions they assume (e.g., "rsynced Day 1 GreenWill test files") no longer hold — those artifacts are in the main tree.
- All deliverables from these dispatches have been merged; re-running would duplicate or conflict.

For live orchestration, use the operational inputs in the `handoffs/` directory two levels up:

- `../../orchestration.md` — phase-agnostic playbook.
- `../../codex-tasks.md` — long-lived phase-organized task catalog.
- `../../codex-result-schema.json` — reusable `codex-result.md` schema.

## Inventory

| File | Lane | Scope |
|---|---|---|
| `codex-lane-a-2026-04-20.md` | Day 1 Lane A | Missing shared/admin stories + focused sheet/shell tests |
| `codex-lane-b-2026-04-20.md` | Day 1 Lane B | Bug triage + GreenWill Phase 0 readiness + confidence test suite |
| `codex-lane-a-day2-2026-04-20.md` | Day 2 Lane A | `badge-locks` / `badge-schemas` deploy CLI + fork test scope/relax |
| `codex-lane-b-day2-2026-04-20.md` | Day 2 Lane B | GreenWillPanel invalid-address + lookup-error UX + padding ownership cleanup |
| `codex-lane-c-day2-2026-04-20.md` | Day 2 Lane C | Agent `feedback.test.ts` tracingChannel (dispatched, terminated — blocker unreproducible in main env) |

Sprint board: `../../../execution-board-2026-04-20.md`.
