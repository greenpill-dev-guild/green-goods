# Codex Final-Review Lane Prompts

> Sub-file of the [clean skill](./SKILL.md). Verbatim prompts for the two Codex review
> lanes dispatched via `.claude/scripts/dispatch-codex-lane.sh` — load at dispatch time.

## Lane R — Regression hunt (diff-scoped, `--phase regression`)

```
You are reviewing the merged diff between $BASE_BRANCH and the approved implementation
head. Cleanup implementation just modified this codebase. Your job is to find any change
that alters runtime behavior, NOT to find new cleanup opportunities.

Scan every hunk and classify:

REGRESSION-HIGH  — Behavior change disguised as a refactor. Examples: removed catch block
                    that was actually load-bearing, changed default arg, narrowed a type
                    that callers relied on, dead-code removal that wasn't actually dead.
REGRESSION-MED   — Plausible behavior change but unclear; needs human eye.
REGRESSION-LOW   — Likely safe but worth flagging (e.g., reordered arguments, renamed
                    public symbol without checking external consumers).
SAFE             — Pure refactor / dedup / type tightening with equivalent semantics.

For each non-SAFE finding, output: file:line, the agent's likely intent, why it might
break, and the smallest revert (specific lines).

Honor these invariants from CLAUDE.md — flag if any agent broke them:
- Hook boundary (all hooks live in @green-goods/shared)
- Shared imports use only declared package export paths; no `shared/src` internals
- Address type for Ethereum addresses
- parseContractError() + USER_FRIENDLY_ERRORS for contract errors
- Offline-first fallbacks are intentional, not legacy
- Single root .env (no per-package .env)
```

## Lane G — Miss hunt (codebase-wide, `--phase gap`)

```
The 8 cleanup lanes have just finished. Their integrated summaries are included in
this review context. Your job is to find cleanup opportunities they MISSED,
especially issues that don't fit neatly into a single lane.

Read each lane summary first to understand what was already covered. Then scan for:

CROSS-CUTTING — Issues spanning two or more agent domains (e.g., a duplicated type that
                is also dead, a defensive catch around legacy code).
TAXONOMY      — Inconsistent naming, ambiguous file/folder placement, types/components
                whose names lie about what they do. Use the "promptability" lens: would
                an AI agent looking at this codebase confidently know where to put a new
                feature?
PLACEMENT     — Files in the wrong package (e.g., a hook in client/ that should be in
                shared/, a domain type in admin/ that should be in shared/).
SEAM DRIFT    — Public APIs that have grown asymmetric (one helper does X+Y, its sibling
                only does X), declared exports that don't match what consumers import.
DOC/CODE DRIFT — Comments, JSDoc, or .claude/context/*.md that contradict the current code.

For each finding, output: location, category, concrete fix, and confidence
(HIGH/MED/LOW). Do NOT modify files. Output is a report only.
```
