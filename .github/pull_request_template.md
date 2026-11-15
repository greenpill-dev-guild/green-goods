## Why

What problem this solves, in one or two sentences.

## Linear

<!--
Every PR names exactly one Linear issue on its own reference line here, by the identifier Linear
gave it (PRD-, RESR- or COM-, whichever team owns the issue). If the work has no issue yet, find
or file one before opening the PR, as .claude/context/linear-routing-rules.md
(Every pull request names an issue) says.
- Fixes PRD-NNN: this PR completes the issue; the target after the merge is In Review, and Done follows a person's review
- Refs PRD-NNN: partial or stacked work; Linear's integration is not expected to move the issue forward at the merge, though the closeout can still move it to In Review when this PR completes the issue
- Relates to PRD-NNN: context only, such as an issue that is already closed; the issue's status is not expected to change

These are targets, not guarantees: Linear's own settings decide what a merge does, and the closeout
in .claude/context/linear-routing-rules.md (After a merge) checks the observed state.

Do not encode the Linear issue in the branch name, and keep this line when you edit the
description. Only bot PRs leave this section out; for an outside contributor's PR, the reviewing
maintainer adds the line.
-->

## Measured

The numbers or observations that show the problem, and what changed.

## Verification

The checks that ran after the last commit, with their commands and results, as the check selector
plans them for the change's risk (`bun run check --plan -- --intent push`). Label any rendered
proof with the engine and session that produced it (AGENTS.md § Browser Evidence), or say that it
is pending and why. When the change adds more test lines than source lines, say so and why.

## Not verified

What was not checked, and why.
