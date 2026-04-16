# Claude Automation Setup Prompt

Use this prompt in Claude when you want Claude to set up or update the Claude-side automations for this repo.

```text
Set up the Claude-side automations for the Green Goods repository at /Users/afo/Code/greenpill/green-goods.

Use the repo prompt files as the source of truth. The jobs themselves live in Claude's automation system, not in git.

Read these files first:
- /Users/afo/Code/greenpill/green-goods/.plans/README.md
- /Users/afo/Code/greenpill/green-goods/.plans/_automation/README.md
- /Users/afo/Code/greenpill/green-goods/.plans/_automation/claude-ui.prompt.md
- /Users/afo/Code/greenpill/green-goods/.plans/_automation/claude-qa-pass-1.prompt.md
- /Users/afo/Code/greenpill/green-goods/.plans/_automation/claude-docs-pass-2.prompt.md

Create or update Claude automations for:
1. UI lane
2. QA pass 1
3. Docs pass 2

Use these branch and queue contracts exactly:
- UI lane claims work from node scripts/plan-hub.mjs list --agent claude --lane ui --json
- QA pass 1 claims work from node scripts/plan-hub.mjs list --agent claude --lane qa_pass_1 --json
- Docs pass 2 only runs after the trigger branch codex/docs-pass-1/<date> exists and the Codex report file for that date is present

Suggested cadence:
- UI lane: hourly on weekdays
- QA pass 1: hourly on weekdays, later than the implementation lanes
- Docs pass 2: weekly, after Codex docs pass 1

Do not rewrite the repo workflow. Configure the automations to follow the existing repo prompts and leave a short summary of the final schedules and prompt bodies.
```
