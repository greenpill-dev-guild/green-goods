# Envio HyperIndex v3 Migration

**Slug**: `envio-hyperindex-v3-migration`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-05-24`
**Linear Issue**: [PRD-557](https://linear.app/greenpill-dev-guild/issue/PRD-557/migrate-green-goods-indexer-to-envio-hyperindex-v3)
**Linear Source**: `source:plans`

## Problem

Green Goods currently runs the indexer package on Envio `2.32.3`, while Envio HyperIndex v3 is now published and changes the handler API, config shape, test helpers, runtime requirements, and generated-package workflow.

The migration is not safe as a casual dependency bump. The current indexer is healthy, so this work should be planned as a staged maintenance migration that preserves current behavior and leaves clear proof before any production deployment.

## Desired Outcome

- Green Goods has an implementation-ready path from Envio v2 to v3.
- The indexer migration is split into a safer v2 preload prep phase and a v3 migration phase under the `state_api` lane.
- Runtime, CI, tests, Docker, docs, and agent guidance all agree with the installed Envio version.
- Contracts, client UI, admin UI, and shared hooks remain unchanged unless the GraphQL schema or query output forces a follow-up.

## Scope Notes

- In scope: `packages/indexer`, indexer CI/runtime scripts, local doctor checks, docs, `.claude` canonical guidance, generated `.agents` skill mirror, and Linear visibility.
- Out of scope: contract changes, app UI changes, shared data-hook rewrites, production deployment, and schema expansion beyond what v3 migration requires.
- Production hosted indexer rollout is a later approval step after local/CI proof and an explicit reindex/rollback decision record.

## Success Signal

The indexer runs on Envio v3 with equivalent Green Goods GraphQL behavior, package validation and local runtime smoke pass, and `.plans/backlog/envio-hyperindex-v3-migration/status.json` records complete proof for prep, migration, docs, QA, and production-readiness deferral.
