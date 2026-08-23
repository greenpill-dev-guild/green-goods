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

## Terminal Validation Receipt — 2026-08-23

- Tested implementation commit SHA: `8fd3311980b28d71d48f72fe41c99d15276de912`
- Run at (UTC): `2026-08-23T08:02:46Z`
- Exact command(s): `bun run test:validation-system`; `node --test
  scripts/quality/ci-gate.test.mjs scripts/quality/workflow-performance-parity.test.mjs`.
- Result: 130/130 integrated validation tests and 40/40 focused CI/workflow tests passed. Live
  GitHub Actions at cumulative Wave 0 SHA `05ff122782ae1eed7e69b534492ad355aad72885`
  succeeded for Agent, Admin, Client, Shared, Docs, Supply Chain Guardrails, and CI Gate.
- Validated paths: all VSO selector, local runner, workflow, toolchain, guidance, and guardrail
  inputs plus their tests.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- scripts
  .github package.json turbo.json .mise.toml AGENTS.md CLAUDE.md .claude` → empty.
- Evidence-only diff command and result (if applicable): not applicable.
- Evidence-only worktree-status command and result (if applicable): not applicable.
