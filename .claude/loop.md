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

Grep the `.claude/` directory (and `CLAUDE.md`/`AGENTS.md`/`ONBOARDING.md`) for these known-retired names. Check BOTH the path form (`skills/<name>`) AND the prose forms — backtick names like `` `ui` ``, "<name> skill", "skill `<name>`", and subfile refs like `ops/migration` — the prose forms are how stale references actually survive sweeps. Report any matches outside of archive/retirement notices:
- Retired domain skills: `react`, `testing`, `web3`, `data-layer`, `indexer`, `contracts`, `ops`, `ui` (as skill references — their content lives in `.claude/context/*.md` and `design/implementation.md`)
- Folded into review/audit: `principles`, `architecture`, `audit-then-ship`, `drift` (as skill references)
- Removed meta-infrastructure: `registry/skills.json`, `skills/index.md`, `check:claude-guidance`, `check-skill-frontmatter`
- Removed agents: `cracked-coder`, `oracle`
- Older retirements: `error-handling-patterns`, `skill-bundles.json`, `hooks.json`, `skills:sync`
- Round-2 retirements (2026-07-25): `agent-output-gate` (hook + script), `context/docs.md`, `context/intent.md` (folded into `context/product.md`)

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
