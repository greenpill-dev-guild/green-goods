# Envio HyperIndex v3 Migration Eval

## Acceptance Criteria

| ID | Criterion | Evidence |
|----|-----------|----------|
| AC-1 | Envio v2 preload prep passes without changing public indexer behavior | Package validation output from prep lane |
| AC-2 | Envio v3 migration builds and tests against the new API | Package validation output from v3 lane |
| AC-3 | Dynamic contract discovery still works | Focused handler tests for GardenAccount and OctantVault registration |
| AC-4 | Hypercert metadata fetch behavior is preload-safe | Test or documented v3 effect proof |
| AC-5 | Docs/guidance match v3 runtime and no longer prescribe obsolete generated ReScript setup | Docs/guidance diff plus `bun run check:skills` |
| AC-6 | Linear PRD-557 and this plan hub agree on status | `status.json` history and Linear link |
| AC-7 | Envio v3 local runtime starts and serves GraphQL | Docker/runtime smoke plus representative GraphQL query evidence |
| AC-8 | v3 package, ESM, config, env, Docker, CI, and doctor surfaces are aligned | Source diff plus focused grep for removed v2-only generated setup |
| AC-9 | Hosted rollout is explicitly deferred with production-readiness decisions recorded | Closeout note covering reindex, DB compatibility, rollback, secrets/config, and approval owner |

## Regression Scenarios

- Garden mint registers GardenAccount and later GardenAccount updates mutate the same Garden entity.
- Vault creation registers OctantVault and later Deposit/Withdraw events update vault totals and event history.
- GreenWill badge events still materialize definitions, grants, and ownership.
- Campaign Cookie Jar factory metadata handling remains unchanged.
- EAS attestation data remains outside the Envio indexer.
- Local GraphQL endpoint exposes the expected Green Goods entity shape after v3 startup.
- CI and local doctor no longer fail because `packages/indexer/generated` is absent after v3.

## Proof Policy

- Record RED/GREEN or proof-limit notes in lane handoffs.
- Record machine-readable lane status and proof in `status.json`.
- Do not claim production readiness from local package validation alone; hosted Envio deployment remains a separate approval step.
- Do not archive this hub while hosted rollout, reindex confirmation, or rollback approval remains unresolved.
