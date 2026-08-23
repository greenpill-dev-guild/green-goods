# Validation System Optimization

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

**Slug**: `validation-system-optimization`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-08-15`

## Problem

GitHub Actions, local developer commands, and agent verification guidance select different checks,
use different environments, and stop at different times. Routine work is often over-validated while
CI still gives slow or misleading failure signals.

## Desired Outcome

- One machine-readable policy selects validation from intent, changed paths, dependency impact, and risk.
- Quick work receives focused proof; push, merge, release, contract, authentication, mutation, and deployment work retain strict gates.
- Local plans predict the GitHub job graph and toolchain closely enough to explain any deliberate difference.
- Deterministic failures stop dependent work immediately and user cancellation is terminal.

## Scope Notes

- In scope: CI aggregation, path routing, dependency setup, coverage reporters, local validation,
  toolchain alignment, agent guidance, performance profiling, and policy/fixture tests.
- Out of scope: deleting tests, lowering coverage thresholds, weakening contract/fork/release gates,
  changing production behavior, deployments, broadcasts, and repository settings.

## Success Signal

Fixture tests prove the same selector drives CI, local, and agent plans; the supplied failure class
turns the aggregate red immediately; routine quick plans select a check set within their budget
without suppressing any critical gate. The budget figure is a selection-time projection, not a
measured wall-clock result.
