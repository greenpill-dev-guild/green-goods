# Codex Handoff: Docs and Guidance

**Lane**: `docs_guidance`  
**Branch**: `codex/docs-guidance/envio-hyperindex-v3-migration`  
**Depends on**: `state_api`

## Objective

Update only durable developer guidance required to operate the installed Envio 3.2.1 runtime.

## Required Work

- Update package docs and builder docs that mention Envio version, codegen, generated setup, Docker flow, tests, and CI.
- Update environment docs if v3 adds or renames indexer env keys.
- Update canonical `.claude` indexer guidance only where the migration changes real commands or
  runtime contracts.
- Do not create package-local Envio skill copies.
- Do not hand-edit `.agents/skills`; it is a symlink to `.claude/skills`.

## Validation

```bash
node scripts/quality/check-codex-docs.js
bun run build:docs
bun run docs:audit:ci
```

Record any docs-specific proof or grep checks here and update `../status.json`.
