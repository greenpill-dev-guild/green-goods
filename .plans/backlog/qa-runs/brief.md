# QA Runs

**Stage**: `backlog`
**Status**: Decisions locked 2026-09-05; implementation planned for the 2026-09-06/07 weekend, before the 2026-09-08 re-QA
**Approved**: 2026-09-05 (Afo, three alignment rounds after the 2026-09-04 team QA call)

## Summary

The QA app keeps one verdict per case per tester and overwrites it on re-record, so a re-QA erases
the session it is checking. A **run** is one team pass over the catalog (several sessions may feed
it). Runs make past sessions immutable and comparable: a tester opens a run, records into it, closes
it, and the next run shows what was fixed, what still fails, and what regressed. The same change
carries the test-case cleanup the 2026-09-04 call asked for, because the compare must map retired
cases to their successors.

## Locked Decisions

1. A run is one team pass over the catalog; sessions are timestamps inside it. The store keeps one
   shard per run per tester; a small run index carries label, opened/closed time, opener, catalog
   version, default environment, and build SHAs. Exactly one run is open at any time: closing is
   a rollover that closes the current run and opens its successor in one conditional write, so
   there is never a zero-open state.
2. Today's shards migrate as Run 1 ("Baseline"): legacy latest-state, not a session snapshot. Its
   window is the earliest and latest migrated entry timestamps and the index says so. Closed runs
   are read-only server-side; nothing is ever erased, and a write that arrives for a closed run
   is re-targeted at the open run by the page, never dropped.
3. Any allowlisted tester may open or close a run; the index records who did.
4. `N/A` means intentionally out of scope; a skipped case has no entry. The app's N/A control says
   so. Environment is a run-level field; a note prefixed `[beta]` or `[prod]` marks a verdict taken
   elsewhere.
5. Compare is run-vs-run: a Run select beside View, a "compare with Run N" toggle showing the prior
   verdict and notes on each row, a delta tally (fixed, still failing, regressed, newly walked), and
   a Re-QA filter (fail or blocked in the compared run). Retired IDs map through `replacedBy`.
6. `qa:pull` and `qa:report` become run-aware; the report's delta compares runs, not snapshots.
7. Catalog split before Tuesday, scoped to rows walked or failing on 2026-09-04 plus the Android
   twins; the broader area re-cut waits until after Tuesday. Catalog lifecycle rules unchanged.

## Boundaries

Changes the QA app (store API, page, dev server), the pull and report scripts, the catalog and its
ledger, and the QA guidance. Does not change contracts, the indexer, Admin, or Client. Product
defects found while rehearsing become QA findings, not work in this hub.

## Completion Signal

Run 1 migrated and closed; Run 2 opened for 2026-09-08; the compare shows the 2026-09-04 fails
against Tuesday's re-record; split cases ship with `replacedBy` and the compare honours them; the
deployed QA app completes a two-tester smoke; guidance names runs where it names snapshots today.
