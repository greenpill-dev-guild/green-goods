# Design System Alignment Review

**Slug**: `design-system-alignment-review`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-04-25`

## Problem

The earlier design-system enforcement work completed the code/token sweep. Since recent design work has continued outside that plan, the next useful plan is not another implementation sweep; it is a read-only alignment review that checks whether DesignMD sources, generated tokens, Storybook, admin, client, docs, and agent guidance still agree.

## Desired Outcome

- A repo-grounded design-system health report with confirmed drift, inferred risks, missing proof, and rejected false positives.
- No UI or token edits unless the user explicitly approves a fix pass after the review.
- Clear separation between actual drift and aspirational design polish.

## Scope Notes

- In scope: the surfaces listed in `.claude/skills/design/system-alignment-review.md`.
- In scope: validators for generated design artifacts, runtime tokens, vocabulary, Storybook coverage, and Storybook quality.
- Out of scope: component-by-component redesign, new token proposals without evidence, and fixing drift during the review pass.

## Success Signal

The review can state, with validator output and file:line evidence, whether the design system is healthy, drifting, or needs attention.
