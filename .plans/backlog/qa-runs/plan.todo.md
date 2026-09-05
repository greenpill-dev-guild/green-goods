# QA Runs Plan

**Feature Slug**: `qa-runs`
**Stage**: `backlog`
**Status**: PLANNED
**Created**: 2026-09-05
**Last Updated**: 2026-09-05

## Requirements Coverage

| Requirement | Lane | Status |
|---|---|---|
| Run index + per-run shards + migration (spec 1–4) | `state_api` | ⏳ |
| Run select, compare, delta tally, Re-QA filter, retired mapping (spec 5–7) | `ui` | ⏳ |
| `qa:pull --run`, `qa:report --previous <run>` (spec 8) | `state_api` | ⏳ |
| Catalog split with `replacedBy`, Android twins, redeploy (spec 9) | `state_api` | ⏳ |
| Guidance + docs name runs; two-tester smoke on 2026-09-08 | `qa_pass_1` | ⏳ |

## Implementation Steps

1. **Store and API** — run index, per-run shard paths, open/close endpoints, closed-run refusal,
   migration of the legacy shards to Run 1 (tests in `qa-app-store.test.ts` / `qa-app-auth.test.ts`).
2. **Page** — Run select, compare toggle, delta tally, Re-QA filter, N/A hint, environment line;
   outbox keyed by owner and run (tests in `qa-app-client.test.ts`).
3. **Scripts** — run-aware pull and report; delta by run; `qa:status` reads the open run.
4. **Catalog split** — retire and replace per `catalog-feedback-2026-09-04.md`; ledger append;
   build; redeploy the QA app; verify the compare honours `replacedBy`.
5. **Guidance and docs** — `qa.md`, qa-session/qa-triage/routine wording, product-experience-qa
   and test-cases pages.
6. **Tuesday** — close Run 1, open Run 2 on beta, two-tester smoke, first real compare.

## Validation

- `bun run test:agent-tools`, `bun run test:review-guardrails`, `bun run check:docs-generated`
- `bun run validation:plan -- --intent push` before the push gate
