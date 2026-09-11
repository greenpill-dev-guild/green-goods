# Community QA pass 2 handoff

**Status:** BLOCKED — starts only after QA pass 1 evidence and defect disposition.

## Inputs

- QA1 readout/screenshots, fixed or accepted defects, final hub/status/handoffs, validation logs.

## Outputs

- Regression verdict, plan/code/Linear traceability check, dispatch/blocker audit, rerun evidence, and remaining external blockers.

## Acceptance

- No false-ready lane; parent_only preserved; all accepted QA1 defects rerun; status/visual/copy names match specs; four-schema/two-resolver artifact routing and EAS envelope normalization match the contracts; directional-signal edge cases and stale offline intent are rerun; release claims are limited to evidence.

## RED / GREEN

- RED: replay each fixed QA1 defect, wrong-ref-schema/cross-garden/revoked-parent contract cases, same-timestamp signal tie, revoked winner without fallback, both direction switches, clear, stale offline coalescing, and every machine-readable blocker invariant.
- GREEN: targeted regressions, quick gate, plan validation, drift, docs/vocab, and available authenticated evidence pass.

## Exact commands

```sh
node scripts/harness/plan-hub.mjs validate
node scripts/harness/plan-hub.mjs list --agent codex --lane contracts --stage active --json
bun run drift:check -- --scope plans --json
node scripts/dev/ci-local.js --quick
```

## Out of scope

New feature work, broad cleanup, branch shipping, or overriding external blockers.

## Unblock evidence

QA1 completed handoff, defect ledger with dispositions, and coordinator authorization for regression pass.
