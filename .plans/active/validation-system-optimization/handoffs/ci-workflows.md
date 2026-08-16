# CI Gate and Workflow Handoff

## Scope

- CI Gate consumes the shared selector mapping and fails immediately on completed non-success.
- Newest reruns win; missing expected workflows retain strict timeout behavior.
- Shared exact JS setup pins Node/Bun, uses frozen install, and caches only Bun downloads.
- Workflow routing, CI reporters, repository formatting ownership, and Contracts Realism setup are
  narrowed without deleting tests or reducing thresholds.

## TDD Evidence

- RED fixtures exposed delayed aggregate failure and selector-to-live-trigger drift.
- GREEN fixtures cover failure, rerun, timeout, setup, trigger, cache, coverage, and format parity.

## Validation Receipt

Working-copy proof exists. Commit-attributed terminal receipt is pending live GitHub Actions proof.
