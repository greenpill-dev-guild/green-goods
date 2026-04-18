# Automation Prompts

This directory contains prompt files for recurring lane automations.

The actual schedules are configured in Codex and Claude, not committed to the repo. These files are the versioned prompt source-of-truth.

## Recommended Cadence

Use the same feature hub in `.plans/active/<feature-slug>/` for all automations.

Suggested staggered hourly sequence on weekdays:

1. Claude UI at `:05`
2. Codex state/API at `:15`
3. Codex contracts at `:25`
4. Claude QA pass 1 at `:35`
5. Codex QA pass 2 at `:45`

This lets implementation lanes run in parallel while keeping QA sequential.

Suggested weekly docs review sequence:

1. Codex docs pass 1 on Wednesday afternoon
2. Claude docs pass 2 after Codex docs pass 1 has opened its dated branch

Suggested weekly harness-GC sequence:

1. Codex harness GC on Friday afternoon after the week's PR reviews and CI failures have accumulated
2. Write the dated report to `.plans/reviews/harness/<YYYY-MM-DD>-codex-harness-gc.md`
3. Propose guardrail work only; do not edit code from the automation prompt

## Rule of Thumb

- Branch names are the wake-up signal
- `status.json` is the real source of truth for explicit state
- `node scripts/plan-hub.mjs list` computes lane readiness from `status.json` plus branch triggers
- `qa_pass_2` must verify both the trigger branch and `qa_pass_1.status == "passed"`

## Prompt Files

- `claude-ui.prompt.md`
- `codex-state-api.prompt.md`
- `codex-contracts.prompt.md`
- `claude-qa-pass-1.prompt.md`
- `codex-qa-pass-2.prompt.md`
- `codex-docs-pass-1.prompt.md`
- `claude-docs-pass-2.prompt.md`
- `claude-automation-setup.prompt.md`
- `codex-harness-gc.prompt.md`
