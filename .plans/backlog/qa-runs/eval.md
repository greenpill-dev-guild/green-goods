# QA Runs Evaluation Plan

## Release Gates

1. Correctness: every acceptance check below passes at the head that ships; the migration is proven on a copy of the live store before it runs on the store.
2. Usability: two testers complete the 2026-09-08 rollover and re-QA on the deployed app without reading code.
3. Regression safety: existing `qa-app-*` and `qa-report` suites stay green; the legacy read path keeps serving until the migration is verified.
4. Evidence quality: research evidence and open assumptions are recorded before implementation.
5. Human judgment: protected surfaces and maintainer-call decisions are called out before merge.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Migration moves every legacy shard into Run 1 unchanged (same entries, statuses, notes, timestamps), records Run 1 as legacy latest-state with its window, and is idempotent | `qa-app-store.test.ts`: migrate a fixture store twice; entries byte-equal, index unchanged on the second run | `state_api` | test names + green run in the lane handoff |
| AC-2 | A write against a closed run is refused with the open run's id and never mutates the closed shard; a rollover closes and opens in one conditional index write | `qa-app-store.test.ts`: POST to a closed run → refusal payload names the open run; closed shard ETag unchanged; concurrent rollovers → one winner, one retry | `state_api` | test names + green run |
| AC-3 | The page re-targets a refused outbox at the open run and says so; Run select, compare toggle, delta tally (fixed, still failing, regressed, newly walked), and Re-QA filter render from two fixture runs; the N/A hint reads "out of scope for this run" | `qa-app-client.test.ts` against the built page; authenticated Brave screenshots at desktop and 375×812 | `ui` | test names + screenshot paths in the lane handoff |
| AC-4 | A verdict on an ID retired between runs appears on each `replacedBy` successor in the compare, labelled inherited; `qa:pull --run` and `qa:report --previous <run>` name both runs in the delta | `qa-report.test.ts` and `qa-state-pull.test.ts` fixtures with one retired ID and two runs | `state_api` | test names + green run |
| AC-5 | QA review: rollover, re-record, and compare completed by two testers on the deployed app for the 2026-09-08 session | manual, recorded in `handoffs/claude-qa-pass-1.md` | `qa_pass_1` | session parent link + compare screenshot |
| AC-6 | Regression review: the full `test:agent-tools`, `test:review-guardrails`, and `check:docs-generated` gates pass at the shipping head | `bun run test:agent-tools && bun run test:review-guardrails && bun run check:docs-generated` | `qa_pass_2` | command output in `handoffs/codex-qa-pass-2.md` |

## Test Strategy

- Unit: store migration, rollover, closed-run refusal, run index validation (`qa-app-store.test.ts`, `qa-app-auth.test.ts`); run-aware pull and report (`qa-state-pull.test.ts`, `qa-report.test.ts`).
- Integration: the built page against `dev.mjs` with two fixture runs (`qa-app-client.test.ts`, `qa-app-build.test.ts` for the catalog `replacedBy` projection).
- E2E / Playwright: none new; the built-page harness above is the real-page proof.
- Manual checks: authenticated Brave rehearsal at desktop and mobile widths; the 2026-09-08 two-tester smoke on the deployed app.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Focus on UX issues, missing requirements, and test gaps
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Re-run targeted validation and close the loop on remaining defects
