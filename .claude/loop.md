---
name: loop
description: Project maintenance loop — guidance consistency, stale references, and build health.
disable-model-invocation: true
---

# Maintenance Loop

Run these checks and report a concise summary. Only flag issues, not passing checks.

## 1. Guidance Consistency
```!
cd $CLAUDE_PROJECT_DIR && bun run check:codex-guidance 2>&1 | tail -5
```

## 2. Stale References

Grep the `.claude/` directory (and `CLAUDE.md`/`AGENTS.md`) for these known-retired names. Report any matches outside of archive/retirement notices:
- `skills/react`, `skills/testing`, `skills/web3`, `skills/data-layer`, `skills/indexer`, `skills/contracts`, `skills/ops`, `skills/ui` (retired domain skills)
- `skills/principles`, `skills/architecture`, `skills/audit-then-ship`, `skills/drift` (folded into review/audit)
- `registry/skills.json`, `skills/index.md`, `check:claude-guidance` (removed meta-infrastructure)
- `cracked-coder`, `oracle` agent definitions
- `error-handling-patterns`, `skill-bundles.json`, `hooks.json`

## 3. Build Health
```!
cd $CLAUDE_PROJECT_DIR && bun lint --quiet 2>&1 | tail -3
```

## Output Format

```
## Loop Check — $ARGUMENTS
- Guidance: [pass | N issues]
- Stale refs: [clean | N found]
- Lint: [pass | N issues]
```

Only expand details for failing checks.
