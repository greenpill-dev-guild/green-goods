---
name: review
description: Diff-scoped code review for Green Goods. Use when reviewing a PR, branch diff, working-copy change, or cross-package change. Focus on correctness, boundary violations, missing tests, and judgment-heavy callouts such as dependencies, permissions, migrations, and destructive operations. Avoid broad style commentary and keep findings high-confidence.
argument-hint: "[file-or-PR]"
version: "2.0.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-04-18"
last_verified: "2026-04-18"
---

# Review Skill

Read-only review for Green Goods unless the user explicitly asks for a fix pass.

This skill exists to answer:

- what changed?
- what is broken or risky?
- what can the agent fix automatically?
- what must a human judge deliberately?

## Activation

Use when:

- the user asks for a review
- a PR, diff, or working-copy change needs structured findings
- a cross-package change needs a scoped verification pass

## Scope Lock

Default mode is read-only. Only switch into a fix flow when the user explicitly asks for one.

## What This Skill Owns

- diff-scoped correctness review
- repo-invariant checks against `CLAUDE.md` and `AGENTS.md`
- judgment routing: automatic fix candidates vs human call-outs
- verification recommendations proportional to blast radius

## What This Skill Does Not Own

- dead-code or dependency audits across the full repo (`audit`)
- abstract design judgment detached from a concrete change (`principles`)
- full architecture mapping (`architecture`)

### Internal Lenses

When a diff exposes a boundary problem, use the `architecture` lens inside this review. When it exposes a coherence, simplicity, or duplication problem, use the `principles` lens inside this review. Do not make the user switch commands unless they explicitly ask for a dedicated pass.

## Review Model

This review uses two buckets.

### Agent-Fix-Now

These are mechanical or localized issues:

- broken imports
- obvious lint or type violations
- missing barrel usage
- missing nearby tests for narrow behavior
- clear invariant breaks with an obvious fix

### Human-Judge

These require deliberate ownership:

- new dependencies
- auth or permission changes
- migrations, backfills, or destructive operations
- contract upgrade or deployment behavior
- retry, fallback, or trust-boundary changes
- shared public API changes with cross-package impact

Do not blur these categories.

## Workflow

### 1. Explain the Change

Start with:

```text
Review scope: [PR | branch diff | working tree | file set]
Blast radius: [packages touched]
Review mode: report_only | verify_only | apply_fixes
```

If the change is too large to review honestly, say so and ask for a narrower scope.

### 2. Check Requirement Coverage

For requested work, map stated requirements to code changes.

If a requirement is clearly missing, lead with that. Do not bury requirement misses under style commentary.

### 3. Inspect High-Signal Risk Areas

Prioritize:

- correctness and runtime behavior
- shared boundary violations
- missing or misleading permission checks
- missing tests on changed behavior
- hidden fallback or error-swallowing behavior
- dependency or destructive-operation call-outs

### 4. Apply Green Goods Invariants

Check the diff against actual repo rules:

- hooks live in `@green-goods/shared`
- shared imports should prefer the barrel
- addresses come from deployment artifacts
- no package-level `.env` files
- use `bun run test`, not `bun test`
- user-facing strings need localization
- frontend work should use the established shared/admin primitives

### 5. Produce Findings Only if They Clear the Bar

A finding must have:

- a concrete file reference
- a clear explanation of why it matters
- a credible next step

Drop anything that is speculative, preference-based, or low-confidence.

## False-Positive Guardrails

- do not review the whole codebase when the request is a diff review
- do not report style preferences as findings
- do not elevate architectural taste into a blocker unless it violates a repo rule or creates concrete risk
- do not report "missing abstraction" unless the current diff creates repeated cost or confusion
- do not call out missing tests when the changed behavior is purely mechanical or non-behavioral

## Output Contract

Lead with findings. Keep the list short enough to act on.

### Bucket Rules

- `Critical|High -> must-fix`
- `Medium -> should-fix`
- `Low -> nice-to-have`

Use this mapping in the final review output even when you keep the total number of findings small.

### Required Sections

1. **Summary** — what changed and blast radius
2. **Findings** — ordered by severity
3. **Human Call-Outs** — optional, only when needed
4. **What Looks Good** — positive anchors
5. **Verification** — what was run or what should run next
6. **Verdict** — `approve`, `request_changes`, or `comment_only`

Use this exact ordered output shape:

### Summary

What changed, blast radius, and whether the review scope is trustworthy enough to judge.

### Severity Mapping

- `Critical|High -> must-fix`
- `Medium -> should-fix`
- `Low -> nice-to-have`

### Must-Fix

High-confidence correctness, invariant, permission, migration, or reliability issues only.

### Should-Fix

Meaningful issues worth fixing in this change when they are not hard blockers.

### Nice-to-Have

Only low-risk suggestions with clear value. Keep this section short or omit its contents.

### Verification

State what was run, what was inspected, and what still needs confirmation.

### Recommendation

End with `APPROVE`, `REQUEST_CHANGES`, or `COMMENT_ONLY`.

### Finding Format

```text
[Title]
- Severity: critical | high | medium
- Type: correctness | invariant | testing | dependency | permissions | migration | reliability
- Evidence: file:line
- Why it matters: ...
- Next step: ...
```

### Severity Rules

- `critical` — broken behavior, security risk, or hard invariant violation
- `high` — likely regression, missing guard, or missing high-value test
- `medium` — meaningful cleanup or consistency issue worth fixing in this change

Use `comment_only` when the change mainly needs human judgment, not a hard block.

## GitHub Posting

Only post when PR context exists. For working-copy reviews or local diffs, return findings in chat instead of assuming GitHub output.

## Mode Notes

### `report_only`

Default. Produce findings and stop.

### `verify_only`

Use for cross-package verification when the main implementation is already done. Focus on blast radius, dependency order, and shared-surface impact.

### `apply_fixes`

Only when explicitly requested. Fix the `Agent-Fix-Now` bucket first. Re-review after changes. Do not auto-resolve human-judge call-outs.

## Anti-Patterns

- reviewing >800 LOC as if it were trustworthy and complete
- mixing broad codebase audits into a diff review
- giving long lists of low-confidence nits
- treating every review comment as equally urgent
- auto-fixing dependencies, permissions, or migrations without explicit approval

## Related Skills

- `architecture` — structural context when a finding is really a boundary issue
- `principles` — design judgment when a diff exposes deeper coherence problems
- `testing` — test strategy and focused verification
- `audit` — repo-health follow-up when a review reveals broader drift
