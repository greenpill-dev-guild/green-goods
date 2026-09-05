# QA Runs Specification

## Users

The two or three allowlisted testers who walk Green Goods before and after a fix cycle, and the
agents that pull the store to write the session report and slices.

## Requirements

1. **Run model.** A run has an id, label, `openedAt`, `openedBy`, `closedAt`, `closedBy`,
   `catalogVersion`, `environment` (`production | beta | local`), and optional build SHAs per
   surface. Exactly one run is open at a time: the only close is a rollover that closes the current run and
   opens its successor in one ETag-conditional write of the index, so no request can observe a
   zero-open state. The run index lives beside the shards (`qa/runs.json`); shards move to
   `qa/runs/<runId>/entries/<address>.json`.
2. **Migration.** The existing `qa/entries/<address>.json` shards become Run 1 by a one-time
   server-side move; the legacy path is read only until the move completes, then never written.
   Run 1 is legacy latest-state, not a bounded session: its index entry records
   `openedAt` = the earliest migrated entry timestamp, `closedAt` = the migration time, and
   `legacy: true`, and the compare treats it as a baseline of last-known verdicts rather than a
   dated walk.
3. **Immutability.** `POST /api/state` writes only to the open run; a write against a closed run is
   refused with the open run's id in the response. The page then re-targets that pending outbox at
   the open run, saves it there, and tells the tester which run received it, so a tester who was
   offline or mid-save when a teammate rolled the run over loses nothing; the closed run stays
   immutable. The outbox is keyed by owner and run.
4. **Open and close.** Any allowlisted session may roll the run over (close the open one and open
   its successor with a label, environment, and optional build SHAs) in one action; the index
   records who did it and when. Closing never deletes, and there is no standalone close.
5. **View.** A Run select beside View defaults to the open run; closed runs are readable. A compare
   toggle shows, per row, the compared run's rollup verdict and notes; the tally adds fixed, still
   failing, regressed, and newly walked. A Re-QA filter lists cases that were fail or blocked in the
   compared run.
6. **Retired IDs.** When a compared run holds a verdict for an ID the current catalog retired, the
   compare shows it on each successor named in `replacedBy`, labelled as inherited.
7. **Vocabulary.** The N/A control's hint says "out of scope for this run"; a not-walked case has
   no entry. The run's environment shows in the header; the `[beta]`/`[prod]` note prefix is
   documented in the app's help line.
8. **Scripts.** `qa:pull --run <id | open | latest-closed>` pulls one run; the default is `open`
   for a live session, but the call-report flow pulls the run the call recorded into: `qa-session`
   writes the run id into the session header, `/qa-triage --call` and the routine read it from
   there (or from the parent's lede on a rerun) and pass it explicitly, and `latest-closed` is the
   documented fallback when the run was rolled over before the report ran. `qa:report --previous`
   accepts a run id or a pulled directory; the delta section names both runs.
9. **Catalog split (lane input: catalog-feedback-2026-09-04.md).** Retire grouped rows walked or
   failing on 2026-09-04 with `replacedBy` successors, add the Android twins, fix wrong-surface and
   bug-encoding expectations; ledger append-only; QA app redeployed before Tuesday.

## Existing Sources

- `packages/qa/api/state.ts`, `packages/qa/auth.ts`, `packages/qa/index.html`, `packages/qa/dev.mjs`
- `scripts/agents/qa-state.ts`, `qa-state-pull.ts`, `qa-report.ts`, `qa-status.ts`
- `scripts/data/qa-test-catalog.json`, `qa-test-id-ledger.json`, `scripts/agents/qa-app-build.test.ts`
- `.claude/context/qa.md` (verdict vocabulary, dispositions), `docs/docs/builders/quality/*.mdx`

## Human Judgment

Closing Run 1 and opening Run 2 on 2026-09-08 is a human act on the deployed app with two wallets;
the compare's usefulness is judged on that call, not in tests.

## Risks and Mitigations

- A malformed run index or shard fails every poll: validate on read, refuse the write on shape
  errors, and keep the migration reversible (legacy path untouched until verified).
- Two testers opening runs at once: the index write is conditional on its ETag, like shards.
- The split lands after a run opened on the old catalog: a run pins the catalog version it opened
  with; the compare maps by `replacedBy` either way.

## Decision Log

1–7 in brief.md, locked 2026-09-05. Sources: the 2026-09-04 call (versioning promise, split
request), the qa-report hub's delta constraint, and the three alignment rounds recorded in the
session that filed PRD-864.
