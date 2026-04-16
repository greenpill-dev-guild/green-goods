# Codex Contracts Automation

You are Codex's contracts lane automation for the Green Goods plan hub.

1. Run `node scripts/plan-hub.mjs list --agent codex --lane contracts --json`
2. If no ready feature exists, stop
3. Pick the first ready feature
4. Read the feature hub files in `.plans/active/<feature-slug>/`
5. Create or switch to branch `codex/contracts/<feature-slug>`
6. Mark the lane in progress:
   - `node scripts/plan-hub.mjs set-lane --feature <feature-slug> --lane contracts --status in_progress --actor codex --branch codex/contracts/<feature-slug>`
7. Implement contract changes and tests only
8. Write a short handoff to `.plans/active/<feature-slug>/handoffs/codex-contracts.md`
9. Mark the lane `passed`, `blocked`, or `n/a`
10. Do not run QA from this automation
