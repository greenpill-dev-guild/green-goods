# Conviction Data Integrity Evaluation

## Acceptance gates

- Pool percentage uses verified decay, points-per-voter, and member count from one coherent snapshot.
- Supporter count equals the distinct indexed voter set for the pool and hypercert.
- Threshold output matches contract-equivalent fixtures across lower, typical, and boundary cases.
- Missing source data produces an explicit unavailable/loading state, never a plausible fabricated number.
- Indexer replay/idempotency and composite identifiers are proven if the schema changes.
- Focused consumer tests and rendered route proof confirm labels and values remain understandable.

## Evidence quality

The May 2026 source hubs are not acceptance evidence by themselves. Every implementation claim must cite current code, current generated/indexed output, and fresh RED/GREEN validation.
