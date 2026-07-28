# Envio HyperIndex 3.2.1 Migration Eval

## Acceptance Criteria

| ID | Criterion | Required Evidence |
|----|-----------|-------------------|
| AC-1 | PR #649 targets `develop` and contains only migration-required changes | PR metadata and changed-file review |
| AC-2 | Root workflows remain Bun-first and package-local Envio skill copies are absent | Source grep and workflow diff |
| AC-3 | Envio 3.2.1 codegen, boundary check, build, and tests pass | Command output from the corrected PR head |
| AC-4 | Dynamic GardenAccount and OctantVault discovery remains intact | Focused tests |
| AC-5 | Existing entity IDs, relationships, chain IDs, and GraphQL shape are preserved | Replay fixtures and representative GraphQL query |
| AC-6 | Configured block boundaries preserved; clean replay deterministic and a repeated same-store range rejected without mutation (handler idempotence not claimed) | Migration/replay evidence |
| AC-7 | Local v3 runtime starts and serves Green Goods data | Runtime smoke evidence or an explicit merge blocker |
| AC-8 | Migration-required docs and canonical guidance match v3 | Docs checks and focused source review |
| AC-9 | Reindex, DB compatibility, hosted configuration, rollback, and approval owner are recorded | Production-readiness note |
| AC-10 | PRD-557, PRD-721, PRD-722, and this hub agree | Live Linear read-back and fresh sync timestamp |

## Regression Scenarios

- Garden mint registers GardenAccount and later GardenAccount events update the same Garden.
- Vault creation registers OctantVault and later Deposit/Withdraw events update the same vault.
- GreenWill, Hypercert, Campaign/Cookie Jar, and current Garden entities retain their behavior.
- EAS attestation data remains outside the Envio indexer.
- A replay from configured start blocks does not duplicate or orphan entities.
- Existing GraphQL consumers can query the same representative entity relationships.

## Proof Policy

- Behavior-changing implementation requires RED/GREEN evidence in the `state_api` handoff and
  machine-readable TDD evidence in `status.json`.
- Missing install authorization, generated bindings, local runtime, or GraphQL proof is a blocker,
  not a pass.
- PRD-557 completes when the corrected migration lands on `develop`; hosted deployment and reindex
  remain separately authorized release operations.
