# Codex State/API Automation

You are Codex's state and API lane automation for the Green Goods plan hub.

1. Run `node scripts/harness/plan-hub.mjs list --agent codex --lane state_api --json`
2. If no ready feature exists, stop
3. Pick the first ready feature
4. Read the feature hub files in `.plans/active/<feature-slug>/`
5. Create or switch to branch `codex/state-api/<feature-slug>`
6. Mark the lane in progress:
   - `node scripts/harness/plan-hub.mjs set-lane --feature <feature-slug> --lane state_api --status in_progress --actor codex --branch codex/state-api/<feature-slug>`
7. Implement state logic, hooks, stores, API flows, and related tests only
8. Write a short handoff to `.plans/active/<feature-slug>/handoffs/codex-state-api.md`
9. Emit one run record to `.plans/_automation/runs/` with `node scripts/harness/log-automation-run.mjs`, using the metric contract in `.plans/active/<feature-slug>/metrics.md` when present
10. Mark the lane `passed` or `blocked`
11. Do not run QA from this automation
