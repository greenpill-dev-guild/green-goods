# CI Gate and Workflow Handoff

## Scope

- CI Gate consumes the shared selector mapping and fails immediately on completed non-success.
- Newest reruns win; missing expected workflows retain strict timeout behavior.
- Shared exact JS setup pins Node/Bun and installs from the frozen lockfile.
- Workflow routing, CI reporters, repository formatting ownership, and Contracts Realism setup are
  narrowed without deleting tests or reducing thresholds.

## TDD Evidence

- RED fixtures exposed delayed aggregate failure and selector-to-live-trigger drift.
- GREEN fixtures cover failure, rerun, timeout, setup, trigger, cache-absence, coverage, and format
  parity. 66 fixtures pass at the certified SHA.

## Measured Outcomes

Live GitHub Actions proof at `fb835410` (PR #719): every expected workflow green, `mergeStateStatus`
CLEAN.

**Time to first red (the headline gain).** The old gate computed failures only after every expected
workflow had completed, so time-to-red equalled the slowest workflow. It now equals the first failing
workflow plus at most one 20s poll. Two pre-optimization runs show the cost of the old ordering:

| Run | First workflow failure | Old gate concluded | New expected | Saved |
|---|---|---|---|---|
| `325b2134` | Client 161s | 613s | ~181s | ~432s |
| `6b735c61` | Supply Chain 45s | 449s (cancelled) | ~65s | ~384s |

**Contracts Realism Audit: 70s -> 12s (-83%).** Dropping recursive submodules, Foundry, Bun, and
`bun install` from a job that only runs a bash/grep tooling audit. Structural, not content-dependent.

**Bun dependency cache: measured and reverted.** The cache was a net loss and has been removed from
`.github/actions/setup-js`:

| Phase | Baseline (inline, no cache) | With cache (warm hit) |
|---|---|---|
| Cache restore | none | 20.7s (4s transfer, 16.6s extraction, ~878 MB) |
| `bun install` | 21.8s | 6.9s |
| **Total** | **21.8s** | **27.6s** |

Job-level setup across 40 baseline samples averaged 29.4s (median 27.5s, stdev 6.0s) versus 40.9s
across 12 warm-cache samples. The warm run was also slower than the cold run on the same code, which
is the opposite of a working cache. The store additionally consumed 1.02 GB of an already-over-quota
10 GB repository cache (10.34 GB in use), evicting per-commit Foundry build caches that do pay off.
A time-of-day runner confound cannot be excluded from the aggregate figures, but the single-job
accounting above is internal to one log and is not affected by it.

**No wall-clock gain on the critical path.** Indexer Test (610s) still sets PR duration and was not
touched. See the deferred profiling note in `plan.todo.md`.

## Validation Receipt

Live GitHub Actions proof recorded at `fb835410`. The cache removal is proven by fixtures only; it
lands without live evidence because re-running workflows is outside this hub's boundary, and its
next live sample arrives with the following push.
