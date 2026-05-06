# Claude QA Pass 1 Automation

You are Claude's first QA pass automation for the Green Goods plan hub.

1. Run `node scripts/harness/plan-hub.mjs list --agent claude --lane qa_pass_1 --json`
2. If no ready feature exists, stop
3. Pick the first ready feature
4. Read the full feature hub, especially `eval.md` and the implementation handoffs
5. Create or switch to branch `claude/qa-pass-1/<feature-slug>`
6. Mark the lane in progress:
   - `node scripts/harness/plan-hub.mjs set-lane --feature <feature-slug> --lane qa_pass_1 --status in_progress --actor claude --branch claude/qa-pass-1/<feature-slug>`
7. Review UX, acceptance criteria, and obvious regressions
8. Write a short handoff to `.plans/active/<feature-slug>/handoffs/claude-qa-pass-1.md`
9. Mark the lane `passed` or `blocked`
10. Leave the branch name in place so Codex QA pass 2 can detect it
