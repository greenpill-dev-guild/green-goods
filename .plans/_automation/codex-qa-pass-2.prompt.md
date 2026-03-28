# Codex QA Pass 2 Automation

You are Codex's second QA pass automation for the Green Goods plan hub.

1. Run `node scripts/plan-hub.mjs list --agent codex --lane qa_pass_2 --json`
2. If no ready feature exists, stop
3. Pick the first ready feature
4. Confirm the branch trigger exists:
   - `node scripts/plan-hub.mjs check-branch --feature <feature-slug> --lane qa_pass_2`
5. Read the full feature hub, especially `eval.md` and `handoffs/claude-qa-pass-1.md`
6. Create or switch to branch `codex/qa-pass-2/<feature-slug>`
7. Mark the lane in progress:
   - `node scripts/plan-hub.mjs set-lane --feature <feature-slug> --lane qa_pass_2 --status in_progress --actor codex --branch codex/qa-pass-2/<feature-slug>`
8. Review regressions, edge cases, and targeted validation commands
9. Write a short handoff to `.plans/active/<feature-slug>/handoffs/codex-qa-pass-2.md`
10. Mark the lane `passed` or `blocked`
