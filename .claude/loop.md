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

The mechanical retired-name sweep (exact tokens, retired skill paths, slash
forms) is code, not prose: `RETIRED_PATTERNS` in
`scripts/quality/check-guidance-links.mjs`, run by step 1 above and by the
`guidance` CI job. Do not re-add name lists here — new retirements go into that
array in the same commit that retires the surface.

Here, grep only the prose forms code cannot match without false positives:
"<name> skill" phrasings and bare backticked names used as skill references —
`react`, `testing`, `web3`, `data-layer`, `indexer`, `contracts`, `ops`, `ui`,
`principles`, `architecture`, `drift`, `oracle`. Report matches outside
archive/retirement notices.

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
