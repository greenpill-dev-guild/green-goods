# Codex Handoff: QA Pass 2

**Lane**: `qa_pass_2`  
**Branch**: `codex/qa-pass-2/envio-hyperindex-v3-migration`  
**Depends on**: `qa_pass_1`

## Objective

Run the final proof pass, reconcile plan state, and prepare the hub for archive if the migration is fully complete.

## Checks

- Re-run the indexer package validation loop.
- Re-run or verify recorded local runtime smoke, including a representative GraphQL query.
- Re-run guidance checks relevant to changed docs/skills.
- Confirm a production-readiness note exists and explicitly defers hosted rollout if not approved.
- Confirm Linear PRD-557 status matches the plan hub status.
- If complete, move this hub to `.plans/archive/` and update `status.json` history before final report.

Do not archive if hosted Envio deployment or production verification is still pending.
