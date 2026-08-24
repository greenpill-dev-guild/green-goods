---
name: module-seams-review
description: Deep, read-only review of Green Goods module boundaries, public exports, dependency direction, composition roots, direct-test seams, mock fidelity, and validation velocity. Use for modules-and-seams audits, import-boundary or barrel migrations, testability-architecture reviews, or verification of the Module Seams and Velocity program. Do not use for ordinary small diffs or general dependency and dead-code health.
---

# Module Seams Review

Review whether Green Goods modules have coherent ownership, narrow public boundaries, direct proof,
and efficient validation without hiding runtime coupling. This is a read-only specialist lens over
the repository's canonical `review` verdict contract.

Before starting, read [`../review/SKILL.md`](../review/SKILL.md). It owns requirement ordering,
readiness validation, finding closure, false-positive controls, and verdicts. Read
[`../audit/SKILL.md`](../audit/SKILL.md) only when the user also asks for dead code, dependency
health, or broad repository drift. Do not duplicate those audit lanes here.

Read [`references/review-matrix.md`](references/review-matrix.md) for the detailed inspection matrix.
Load the nearest package `AGENTS.md` files and the relevant package context under
`.claude/context/`. For test architecture, also read `.claude/context/testing.md`; for explicit
production readiness, read `.claude/context/validation-pipeline.md`.

## Read-only boundary

Do not edit files, update plans or Linear, create branches, commit, push, merge, deploy, or resolve
review threads. Return numbered findings and wait for explicit human scope lock before any fix pass.
A request to review, audit, certify, or check production quality does not authorize remediation.

## Scope and candidate

Resolve the candidate before interpreting code:

1. Record the checkout SHA, dirty paths, comparison base, and declared upper bound.
2. Pin the exact `base..head` range when supplied. Never replace it with a newer checkout, PR head,
   `origin/develop`, or an inferred merge base without saying the requested candidate changed.
3. Establish authoritative requirements in the ordering defined by `review`. For the completed
   Module Seams and Velocity program, use the four canonical files under
   `.plans/archive/module-seams-and-velocity/` and treat their historical claims as evidence to
   verify, not established truth.
4. If the candidate exceeds 800 changed LOC, declare review batches before analysis. Maintain a
   coverage ledger with every changed file assigned to exactly one reviewed or explicitly remaining
   batch. Do not infer completeness from representative sampling.
5. Separate implementation changes, tests, configuration, validation entrypoints, guidance, and
   evidence-only commits. A later evidence commit may reuse a tested parent only under the
   repository's exact path-diff and clean-status freshness contract.

State the frozen range, requirements, batch plan, and exclusions at the top of the report.

## Review passes

### 1. Build the boundary graph

Map packages and high-risk domains in dependency order:

`contracts -> shared -> indexer -> client/admin/agent`

For each changed module, identify its owner, public specifier, direct consumers, composition root,
side effects, state identity, and direct subject tests. Review declared exports in
`packages/shared/package.json`; an existing file is not automatically a public API. Flag internal
deep imports, wrong-way package dependencies, broad barrels that materially increase coupling, and
duplicate composition or singleton ownership.

Do not report a barrel, wrapper, interface, or large file merely because it exists. Report concrete
harm: accidental dependency loading, mock instability, public-surface drift, duplicated policy,
state bifurcation, slow import graphs, or an inability to test behavior directly.

### 2. Review seam quality

A useful seam isolates one coherent policy or side effect, is consumer-driven, and has an obvious
default composition edge. Trace both the injected path and production default wiring. Verify that
optional dependency objects do not create multiple runtime identities, bypass shared policy, or
make production behavior differ from tests.

Check commands, ports, repositories, controllers, selectors, transitions, adapters, and providers
against their actual callers. A rename or extraction is not a successful seam when orchestration,
transport, persistence, browser globals, or error policy remain entangled behind the new name.

For mutable dependencies, financial workflows, retries, offline queues, cross-chain delivery,
asynchronous projections, or terminal state, apply the risk-triggered matrix from
`.claude/context/testing.md`. Record the highest-risk invariant as a `review` safety fact.

### 3. Review direct-test and mock fidelity

A subject test must import the module through its own specifier outside every mock factory and must
not mock that same specifier. A consumer test, re-exported barrel import, mock-factory import, typed
fixture, snapshot, or passing full suite is not a substitute for direct behavior proof.

For every changed production import boundary, compare test mock specifiers with the specifiers
production now imports. Identify stale whole-module mocks, transitive mock leakage, tests that pass
only because they intercept an obsolete barrel, and Node/DOM routing that changes semantics. Verify
project discovery parity, `isolate: true`, coverage ownership at the root config, cleanup of timers
and listeners, and direct negative coverage for the original root-cause class.

Run the repository's direct-tested-seam and test-quality guards when selected. Never weaken
isolation, broaden timeouts, or accept retry-based green runs as an architecture fix.

### 4. Review production composition and consumers

Trace each public boundary through at least one real composition root and every materially affected
direct consumer. Verify default adapters, query-key identity, provider ordering, offline/retry/error
paths, and indexer event or schema compatibility when those surfaces changed. For Admin and Client,
separate pure controllers or view models from rendered reachability; a directly tested controller
does not prove its view actually uses it.

For critical Shared surfaces, read every touched line and apply the mutation-reliability rules from
`review`. For visible UI behavior, authenticated Brave proof is required; otherwise record the UI
claim as `BLOCKED`.

### 5. Review validation velocity

Verify that faster validation came from smaller dependency and test graphs rather than skipped
coverage or weaker gates:

- selector scope follows changed artifacts and direct consumers;
- Turbo or receipt inputs include real production, test-runner, setup, mock, and policy inputs;
- Node/DOM projects preserve file parity and coverage behavior;
- suite wall time, worker phases, and import share are not conflated;
- before/after measurements use comparable commands, toolchain, environment, and committed inputs;
- quiet-machine and live-CI claims have actual quiet/live evidence;
- deterministic environment failures remain `BLOCKED`, not passing.

Treat a performance threshold as satisfied only by a fresh comparable receipt. Treat a scheduled
future ratchet as not due, not silently complete or failed.

### 6. Reconcile intent and recurrence

Map every authoritative requirement to `SATISFIED`, `MISSING`, `BLOCKED`, or `OUT_OF_SCOPE`, with a
path and proof level. Then perform a bounded recurrence sweep for each confirmed root-cause class
across the changed scope and direct consumers. Record checked-unaffected paths. Do not say "no other
instances" without a declared search boundary.

## Validation

Start with non-mutating inspection. Render `bun run validation:plan -- --intent review`; use
`--intent readiness` only when the user explicitly asks for production quality, approval, or
merge/readiness certification. Execute the returned plan according to `review` and the shared
validation pipeline.

Useful existing acceptance checks include:

- `bash scripts/quality/check-test-quality.sh`
- `node --test scripts/quality/workflow-performance-parity.test.mjs`
- `bun run check:source-structure`
- `node scripts/harness/plan-hub.mjs validate`

Run them only when they cover the resolved candidate. For every command, record risk, expected
signal, freshness inputs, and stop condition. Failed checks cannot support approval. An unavailable
localhost listener, Docker daemon, authenticated browser, RPC, secret, or live-CI metric is
`BLOCKED`; do not retry until the named capability changes.

## Output contract

Lead with severity-ordered findings. Use this order:

1. **Candidate and coverage ledger** — exact range, dirty state, requirements, batches reviewed and
   remaining.
2. **Must-Fix / Should-Fix / Nice-to-Have** — each finding includes severity, type, file:line,
   concrete failure mode, affected and checked-unaffected scope, proof level, and smallest next step.
3. **Requirement ledger** — `SATISFIED`, `MISSING`, `BLOCKED`, or `OUT_OF_SCOPE` for every accepted
   requirement.
4. **Boundary and seam inventory** — owner, public specifier, production composition root, direct
   consumers, direct subject proof, and status.
5. **Safety facts** — the one or two invariants whose failure would invalidate the candidate.
6. **Velocity evidence** — comparable measurements, guard results, and explicit proof limits.
7. **Verification** — commands and real results at the tested SHA, plus blocked/unrun checks.
8. **Verdict** — use the canonical `APPROVE`, `REQUEST_CHANGES`, or `COMMENT_ONLY` rules from
   `review`.

No findings is not automatically `APPROVE`: the full candidate, requirement ledger, and explicit
production-readiness gate must all be complete and green. Drop low-confidence concerns and style
preferences. Never prescribe a new abstraction without naming the present failure and the code or
decision surface it would remove.
