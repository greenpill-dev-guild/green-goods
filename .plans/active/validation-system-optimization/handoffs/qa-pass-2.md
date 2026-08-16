# Integrated QA Pass 2

## Required Proof

- Full selector-driven Ship Gate at a clean tested SHA.
- Final recurrence sweep for selector/workflow drift and accidental scope.
- Live GitHub Actions registration, first-failure behavior, and timing evidence from the PR head.

## Validation Receipt

**Live GitHub Actions: green at `fb835410` (PR #719).** Every expected workflow succeeded — Admin,
Agent, Client, Contracts, CodeQL, Design, Docs, Indexer, Ontology, Shared, Supply Chain, and the CI
Gate itself. `mergeStateStatus` is CLEAN. This satisfies the live-CI proof that was outstanding.

**Fixtures: 66/66 pass** via `bun run test:validation-system` under the exact pinned toolchain
(Node 22.22.1, Bun 1.3.14, Foundry 1.7.1), including the new guard that keeps the shared JS setup
cacheless.

**Local checkpoint: partial, and honestly so.** A broad 66-path `checkpoint` run passed `format`,
`lint`, `shared-typecheck`, `shared-test`, `client-test`, `admin-test`, `agent-typecheck`, and
`agent-test`, then stopped at `indexer-test`. The stop is correct fail-fast behavior and the failure
is local-environment only: this worktree has `envio` 2.32.12 installed from July while the package
declares 3.2.1, and 2.x rejects the 3.x `chains:` config key. CI installs from the frozen lockfile
and its Indexer Test passed at this same SHA. No dependency install was performed, per this hub's
boundary. `contracts-test`, `docs-test`, `docs-build`, `source-structure`, `design-guardrails`, and
`supply-chain` therefore have CI proof at this SHA but no local receipt from this run.

**Post-certification change.** Removing the Bun dependency cache from `.github/actions/setup-js`
lands after the green run above, so it carries fixture proof only. Its live sample arrives with the
next push.

## Recurrence Sweep

No selector/workflow drift found: the parity fixtures cover trigger, setup, coverage, and formatting
ownership, and a repository-wide search found no stale references to the removed cache.
