# QA Runs Plan

**Feature Slug**: `qa-runs`
**Stage**: `active`
**Status**: IN PROGRESS (all lanes serial in one Claude session on `feature/qa-runs`)
**Created**: 2026-09-05
**Last Updated**: 2026-09-07 (implementation complete on `feature/qa-runs`; PWA catalog second pass on `feature/qa-runs-pwa-split`; Tuesday smoke pending)

## Requirements Coverage

| Requirement | Lane | Status |
|---|---|---|
| Run index + per-run shards + migration (spec 1–4) | `state_api` | ✅ `packages/qa/runs.ts`, `store.ts`, `api/state.ts`, `api/runs.ts`, `dev.mjs` |
| Run select, compare, delta tally, Re-QA filter, retired mapping (spec 5–7) | `ui` | ✅ `packages/qa/index.html`, `build.mjs` (`replaces`, `revision`) |
| `qa:pull --run`, `qa:report --previous <run>` (spec 8) | `state_api` | ✅ `qa-state-pull.ts`, `qa-status.ts`, `qa-report.ts` |
| Catalog split with `replacedBy`, Android twins, redeploy (spec 9) | `state_api` | ✅ catalog + ledger (22 new ids, 8 retirements); redeploy = merge to develop |
| PWA half of the remaining grouped rows + missing read-only PWA rows (feedback C15/C20; decision 12) | `state_api` | ✅ `feature/qa-runs-pwa-split`, stacked on `feature/qa-runs` (36 new ids PWA-067…102, 7 retirements) |
| Guidance + docs name runs; two-tester smoke on 2026-09-08 | `qa_pass_1` | ✅ guidance; ⏳ smoke on 2026-09-08 |

## Implementation Steps

1. ✅ **Store and API** — `runs.ts` (pure run model, shared with `dev.mjs`), `store.ts` (Blob
   half: create-only and ETag-conditional writes, run index, first-contact migration),
   `api/state.ts` (`?run=`, closed-run 409 with `openRun`), `api/runs.ts` (rollover, one
   conditional write, carries names). Tests: `qa-app-store.test.ts` (22), `qa-app-parity.test.ts`.
2. ✅ **Page** — tolerant mode, run select, compare with inherited verdicts, delta tally, Re-QA
   filter, N/A hint, run + help lines, rollover form, outbox keyed by owner and run with adoption
   and retirement, 409 re-targeting, poll overlay gated to the open run. Test: `runsHarness` in
   `qa-app-client.test.ts`; `build.mjs` ships `replaces` and `revision`.
3. ✅ **Scripts** — `qa:pull --run <open|latest-closed|run-N>` with the legacy fallback,
   `qa:status` open-run line, `qa:report` run-named delta with `newlyWalked` and `inherited`.
4. ✅ **Catalog split** — 8 retirements with `replacedBy`, 22 new ids (PWA-051…066,
   PWA-AND-006…008, ADM-046, ADM-047, PUB-034), wording fixes, ledger append, docs regenerated,
   ADM-026 locales; dispositions per item in `catalog-feedback-2026-09-04.md`. Redeploy happens
   on merge to `develop` (Vercel).
4b. ✅ **Catalog second pass (PWA half)** — on `feature/qa-runs-pwa-split`, stacked on
   `feature/qa-runs`: PWA-027/029/030/031/032/033/039 retired into one row per act (PWA-067…096,
   including the acts the grouped rows never named: ask to take up, send for confirmation, join
   the team) and the missing read-only rows PWA-097…102 (garden header and Work tab, Insights,
   Gardeners, Pool tab, commitment detail, Commitments drawer). Ledger append, docs regenerated;
   no journey-referenced row changed, so no locale edits. Admin C18, public rows, and the area
   re-cut stay post-Tuesday.
5. ✅ **Guidance and docs** — `qa.md` § Runs, qa-session header and close, qa-triage call mode,
   routine Phase 2/7, Linear lede template, product-experience-qa, QA app README, scripts README;
   qa-report spec decision log; qa-journey-mode note. The cloud `qa-call-report` prompt must be
   re-pasted after merge.
6. ⏳ **Tuesday** — Run 1 is migrated open on first contact after deploy; a tester presses Start
   new run (label, beta, build SHAs), both record into Run 2 with compare = Run 1 and the Re-QA
   filter, then `qa:pull --run open` + `--run run-1 --out …/previous` + `qa:report --previous`.

## Validation

- `bun run test:agent-tools`, `bun run test:review-guardrails`, `bun run check:docs-generated`
- `bun run validation:plan -- --intent push` before the push gate
