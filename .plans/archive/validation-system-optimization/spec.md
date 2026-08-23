# Validation System Optimization Spec

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

## Summary

Validation is a policy decision followed by command execution. The repository will own a versioned
check catalog and selector. CI supplies authoritative push/merge intent, local tooling supplies the
developer's requested intent, and agents render the selector output instead of inventing a command
set. Every check names its risk, expected signal, freshness rule, time budget, and stopping behavior.

## Functional Requirements

1. Select checks from intent, changed paths, dependency impact, criticality, environment capability,
   freshness receipts, and cancellation state.
2. Fail the CI aggregate as soon as any expected workflow fails while retaining missing-workflow protection.
3. Make local validation change-aware, fail-fast by default, and able to emit a machine-readable plan.
4. Keep per-PR coverage thresholds blocking; CI may use lighter reporters but not weaker thresholds.
5. Remove unrelated package fan-out when a consumer-visible artifact did not change.
6. Share exact Bun, Node, Foundry, and environment profiles between local tooling and CI where applicable.
7. Preserve mandatory overrides for contracts, deployment/release tooling, authentication, JobQueue,
   Work providers, mutation hooks, ontology, supply-chain guidance, and release workflows.
8. Treat user cancellation and environment-blocked proof as explicit non-passing terminal results.

## Research Evidence

- `scripts/quality/ci-gate.mjs` waits for all pending workflows before evaluating failures.
- `scripts/dev/ci-local.js` records failures but continues sequential phases and differs from CI coverage,
  E2E, design, ontology, supply-chain, build, generated-artifact, and environment behavior.
- The ten-run live sample identified Indexer coverage as the dominant PR critical path and found no queue delay.
- The supplied Client failure occurred in a repository-wide formatting step inside a package-labeled job.
- Current coverage configs enforce blocking thresholds; removing per-PR coverage would weaken safety.

## Human Judgment Points

- Coverage thresholds and every critical/release gate remain unchanged unless a later reviewed experiment
  proves an equal-or-stronger replacement.
- Time budgets warn and profile; they never auto-skip mandatory checks.
- Independent CI diagnostics may continue after aggregate failure, but dependent expensive work must not.

## Non-Functional Constraints

- No new dependency.
- New durable scripts are documented in `scripts/README.md` and called by root scripts or CI.
- Policy parsing and tests use Node standard library so the selector can run before dependency installation.
- CI user intent cannot downgrade merge safety.
- Existing dirty work outside this hub and the locked files is preserved.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Selector, local runner, receipts | `state_api` | Repository policy tooling, no runtime package behavior |
| CI aggregation, workflows, caching | `contracts` | Infrastructure lane name only; no Solidity changes |
| Guidance and toolchain parity | `ui` | Agent-facing command-selection surface, no product UI |
| Integrated regression and timing proof | `qa_pass_1`, `qa_pass_2` | Sequential review and proof |

## Risks

- A selector bug could skip a required gate. Mitigation: critical overrides, exhaustive fixtures, and CI-authoritative intent.
- Caches could hide stale results. Mitigation: exact input/toolchain/policy keys and never caching failures.
- Workflow restructuring could orphan required checks. Mitigation: missing-workflow tests and a staged graph migration.
- Test parallelism could expose shared state. Mitigation: profile first and require equivalence tests before enabling it.
