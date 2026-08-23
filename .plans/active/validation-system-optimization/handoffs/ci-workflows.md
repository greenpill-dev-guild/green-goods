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

Confirmed by per-job log accounting across 25 jobs, which is immune to the time-of-day confound
because restore and install are both read from inside the same job's own log:

| | `bun install` | cache restore | total setup |
|---|---|---|---|
| No cache (n=12) | 25.7s | none | **25.7s** mean, 24.2s median |
| Warm cache (n=13) | 8.3s | 24.6s | **33.0s** mean, 28.6s median |

The cache does what it claims: install falls 17.4s. It costs 24.6s to get that, so it spends
**1.41x what it saves**. That ratio is scale-invariant, so a slower runner day moves both terms
together and does not rescue it. All 13 warm-cache jobs are slower than the median no-cache job, and
the fastest warm job (27.2s) still loses to it. Net penalty is +7.3s per job.

The store additionally consumed 1.02 GB of an already-over-quota 10 GB repository cache (10.34 GB in
use), evicting per-commit Foundry build caches that do pay off.

**No wall-clock gain on the critical path.** Indexer Test (610s) still sets PR duration and was not
touched. See the deferred profiling note in `plan.todo.md`.

## Validation Receipt

- Tested implementation commit SHA: `8fd3311980b28d71d48f72fe41c99d15276de912`
- Run at (UTC): `2026-08-23T08:02:46Z`
- Exact command(s): `node --test scripts/quality/ci-gate.test.mjs
  scripts/quality/workflow-performance-parity.test.mjs`.
- Result: 40/40 CI Gate and workflow parity tests passed. Live GitHub Actions on cumulative Wave 0
  SHA `05ff122782ae1eed7e69b534492ad355aad72885` also passed Agent, Admin, Client, Shared, Docs,
  Supply Chain Guardrails, and CI Gate (run IDs 32622463566–32622463606).
- Validated paths: `.github/actions/setup-js`, `.github/workflows/**`, `scripts/quality/ci-gate.mjs`,
  its test, workflow parity test, selector workflow mapping, and root toolchain declarations.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all --
  .github scripts/quality package.json .mise.toml` → empty.
- Evidence-only diff command and result (if applicable): not applicable.
- Evidence-only worktree-status command and result (if applicable): not applicable.
