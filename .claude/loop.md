---
name: loop
description: Project maintenance loop — guidance consistency, registry drift, stale references, and build health.
disable-model-invocation: true
---

# Maintenance Loop

Run these checks and report a concise summary. Only flag issues, not passing checks.

## 1. Guidance Consistency
```!
cd $CLAUDE_PROJECT_DIR && bun run check:claude-guidance 2>&1 | tail -5
```

## 2. Registry Drift

Check that `.claude/registry/skills.json` sub_files entries match actual files on disk for each skill directory. Report any files that exist but aren't listed, or listed but don't exist.

## 3. Stale References

Grep the `.claude/` directory for these known-retired names. Report any matches outside of archive/retirement notices:
- `error-handling-patterns`
- `skill-bundles.json` (outside the removed-registry guard in check script)
- `hooks.json`

## 4. Build Health
```!
cd $CLAUDE_PROJECT_DIR && bun lint --quiet 2>&1 | tail -3
```

## Output Format

```
## Loop Check — $ARGUMENTS
- Guidance: [pass | N issues]
- Registry: [synced | N drift items]
- Stale refs: [clean | N found]
- Lint: [pass | N issues]
```

Only expand details for failing checks.
