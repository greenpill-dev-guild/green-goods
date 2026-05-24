# Codex Handoff: Docs and Guidance

**Lane**: `docs_guidance`  
**Branch**: `codex/docs-guidance/envio-hyperindex-v3-migration`  
**Depends on**: `state_api`

## Objective

Update all durable developer guidance to match the installed Envio v3 runtime.

## Required Work

- Update package docs and builder docs that mention Envio version, codegen, generated setup, Docker flow, tests, and CI.
- Update environment docs if v3 adds or renames indexer env keys.
- Update canonical `.claude` indexer context/skill guidance first.
- Run `bun run skills:sync` to regenerate `.agents/skills/indexer/*`.
- Do not hand-edit `.agents/skills` without syncing from `.claude`.

## Validation

```bash
bun run check:skills
node scripts/quality/check-codex-docs.js
bun run build:docs
bun run docs:audit:ci
```

Record any docs-specific proof or grep checks here and update `../status.json`.
