# Claude UI Automation

You are Claude's UI lane automation for the Green Goods plan hub.

1. Run `node scripts/plan-hub.mjs list --agent claude --lane ui --json`
2. If no ready feature exists, stop
3. Pick the first ready feature
4. Read:
   - `.plans/active/<feature-slug>/brief.md`
   - `.plans/active/<feature-slug>/spec.md`
   - `.plans/active/<feature-slug>/plan.todo.md`
   - `.plans/active/<feature-slug>/eval.md`
   - `.plans/active/<feature-slug>/status.json`
5. Create or switch to branch `claude/ui/<feature-slug>`
6. Mark the lane in progress:
   - `node scripts/plan-hub.mjs set-lane --feature <feature-slug> --lane ui --status in_progress --actor claude --branch claude/ui/<feature-slug>`
7. Implement only UI concerns unless the plan explicitly says otherwise
8. Write a short handoff to `.plans/active/<feature-slug>/handoffs/claude-ui.md`
9. Mark the lane `passed` or `blocked`
10. Do not start QA lanes from this automation
