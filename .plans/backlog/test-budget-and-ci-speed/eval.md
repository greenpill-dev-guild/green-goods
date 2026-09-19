# Evaluation and completion evidence

## Preparation and plan validation

Preparation is a source/measurement refresh, not a full audit rerun. The [dated report](reports/2026-09-19-preparation.md) records source identity, inventory method, open PR heads, CI and coverage references, target dispositions and limits.

Before validation, rendered:

```sh
bun run check --plan -- --intent diagnose --changed .plans/backlog/test-budget-and-ci-speed/plan.todo.md --json
```

Result: ready, sensitive risk, no selected checks. The direct Plan Hub acceptance check is `node scripts/harness/plan-hub.mjs validate`, required by `.plans/README.md`. Validate canonical documents, status and links; do not treat this as product proof.

Plan validation on 2026-09-19: `node scripts/harness/plan-hub.mjs validate` passed with “Validated 27 feature hubs.” The installed Biome formatter formatted status.json; local Markdown links resolve and scaffold placeholders are absent. Source HEAD remained `459ca0b904a46511e31293ef921dfc8c3af70496`; git status showed only this new hub. These are working-copy documents; no committed evidence receipt is claimed.

## Per-slice proof

Render `bun run check --plan -- --intent <intent>` for actual changed paths first. Follow selectedBy, critical overrides and `.claude/context/validation-pipeline.md`. These are acceptance requirements, not precomputed future selector results.

| Change | Direct evidence |
|---|---|
| Guidance | bun run check --only agent-guidance and --only guidance-links; semantic skill evaluation only if triggers change |
| Browser policy | Ordinary pending manual proof, automated failure, unavailable automated capability, stale receipt if applicable, critical override, unchanged ship/merge/release behavior. Demonstrate actual hook outcome in a disposable fixture without bypass. |
| Sharding | Wrapper forwarding, failed/missing shard gate tests, parity, both shards and CI Gate green at the PR's current SHA |
| Floors | Current exact-glob coverage, controlled below-floor failure, then unmodified passing baseline; matching parity |
| Missing proof | Named invariant, real module, baseline result and evidence the assertion detects the defect. Deliberate faults stay in disposable fixtures/scratch. Exposed product bugs get separate scope. |
| Helpers | Before/after JSON reports with identical names and zero failures; preserve retry/cache/provider semantics; list exclusions |
| Deletion | Same-fault surviving test or verified absence of callers; targeted suite passes; staged-module/direct-proof registry protections retained |
| Store contract | Both adapters run common cases; SQLite covers withdrawal, expiry/sweep, stale revisions, pending cap, encryption and persistence |
| Layout | Real subject geometry/interactions and faithful boot-document fixture; required authenticated Brave evidence. Similar markup in a story is not equivalent proof. |
| File merge | Baseline/registry exclusions checked; same-subject cases retained; bun run check --only test-quality |
| Ratio summary | Informational output handles additions, deletions and zero-source changes; cannot fail the required gate |

Use `bun run test` through repo wrappers. No dependencies need installation for preparation. Future visible UI changes follow authenticated-browser requirements and disclose missing evidence.

## Performance and coverage

For adopting shards, collect at least three comparable unsharded and three sharded runs at equivalent code/toolchain/configuration. State cache/runner differences. The September 19 reference is one run, not p50 or exact-current-head proof. Report test-step, job and critical-path time separately. Worker setup/import/environment buckets are aggregate time and cannot be added into wall time.

Refresh coverage before enforcing floors. Nightly directory rows are starting evidence, not necessarily recursive-glob totals. No threshold is changed by this plan. Item 6a remains deferred: three comparable CI runs each way, no new failures and explicit selection before disabling isolation.

## Snapshot and closeout

Snapshot 06 follows selected merges. Recover the original measurement/fault methods where possible; otherwise describe a new panel and do not claim like-for-like fault-score improvement. Record skips, superseded targets and deferred isolation. External republishing requires authorization.

Implementation handoffs record tested SHA, UTC time, exact commands, validated paths, clean path-scoped worktree identity, results and remaining manual evidence. Use required RED/GREEN proof for changed behavior; use not_applicable with a reason for pure test/documentation refactors. Current-head CI is required for readiness. Close through the existing plan-skill procedure after delivery; give unresolved obligations explicit destinations.
