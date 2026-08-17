# Integrated QA Pass 2

## Required Proof

- Full selector-driven Ship Gate at a clean tested SHA.
- Final recurrence sweep for selector/workflow drift and accidental scope.
- Live GitHub Actions registration, first-failure behavior, and timing evidence from the PR head.

## Validation Receipt

**Live GitHub Actions: green at `fb835410` (PR #719).** Every expected workflow succeeded — Admin,
Agent, Client, Contracts, CodeQL, Design, Docs, Indexer, Ontology, Shared, Supply Chain, and the CI
Gate itself. `mergeStateStatus` is CLEAN. This satisfies the live-CI proof that was outstanding.

**Fixtures pass** via `bun run test:validation-system` under the exact pinned toolchain
(Node 22.22.1, Bun 1.3.14, Foundry 1.7.1). The count grew with the branch — 66 at this run, 77 once
the concurrency, scoped-format, and compatibility-filter guards were added — so treat the current
suite result rather than the number recorded here as authoritative.

**Local checkpoint: partial, and honestly so.** A broad 66-path `checkpoint` run passed `format`,
`lint`, `shared-typecheck`, `shared-test`, `client-test`, `admin-test`, `agent-typecheck`, and
`agent-test`, then stopped at `indexer-test`. The stop is correct fail-fast behavior and the failure
is local-environment only: this worktree had `envio` 2.32.12 installed from July while the package
declared 3.2.1 at the time, and 2.x rejects the 3.x `chains:` config key. The package and lockfile
now declare 3.6.1; 3.2.1 and 2.32.12 are both historical. CI installs from the frozen lockfile
and its Indexer Test passed at this same SHA. No dependency install was performed, per this hub's
boundary. `contracts-test`, `docs-test`, `docs-build`, `source-structure`, `design-guardrails`, and
`supply-chain` therefore have CI proof at this SHA but no local receipt from this run.

**Post-certification changes now carry live proof.** The cache removal, the local-runner
concurrency, the indexer batching sweep, and the Envio 3.6.1 upgrade all landed after the run above,
and each pushed head has since completed a full green CI run. No change on this branch rests on
fixture proof alone.

## Recurrence Sweep

No selector/workflow drift found: the parity fixtures cover trigger, setup, coverage, and formatting
ownership, and a repository-wide search found no stale references to the removed cache.
