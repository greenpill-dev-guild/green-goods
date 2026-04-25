# Design System Alignment Review Spec

## Goal

Run the repo's existing design-system alignment protocol as a backlog review item. This replaces the old implementation sweep and is intentionally read-only at the start.

## Required Protocol

Use `.claude/skills/design/system-alignment-review.md` as the review contract. Do not author a separate review rubric. The review must:

1. Respect the protocol's source-of-truth order.
2. Run the live validators before claiming generated-token, runtime-token, vocabulary, or Storybook drift.
3. Classify output as confirmed drift, inferred risk, missing proof, considered-and-rejected, and state of health.
4. Cite concrete file:line or command-output evidence for every claim.

## Validator Set

```bash
bun run check:design-generated
bun run check:design-tokens
bun run lint:vocab
cd packages/shared && bun run check:stories
cd packages/shared && bun run check:story-quality
```

If a validator cannot run, the review must record the blocker and avoid claiming that dimension is healthy.

## Human Judgment Points

- Whether any confirmed drift should be fixed immediately or batched into a later implementation hub.
- Whether recent external design work changes the intended Warm Earth spec, or only exposes stale repo guidance.
- Whether manual visual QA belongs in `manual-ops-closeout` or a later implementation plan.

## Out Of Scope

- Editing DesignMD sources, generated token artifacts, UI components, stories, or package instructions during this review.
- Adding new tokens because a surface could be more symmetrical.
- Reopening the old implementation sweep as a second plan surface.
