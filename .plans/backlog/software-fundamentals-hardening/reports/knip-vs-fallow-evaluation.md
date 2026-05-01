# Knip vs Fallow Evaluation

**Feature Slug**: `software-fundamentals-hardening`
**Status**: planned
**Created**: `2026-05-01`

## Purpose

Green Goods already has Knip installed and prior `.plans/clean` evidence from a dead-code pass.
The Syntax transcript points to Fallow as a broader anti-slop tool because it combines dead-code,
duplication, health, changed-file audit, baselines, CI output, and dry-run autofix. This report is
the required comparison surface before the repo adopts, replaces, or gates on either tool.

## Current Hypothesis

Use Knip as the incumbent baseline because it has already found real dead files in this repo, but
evaluate Fallow as a possible broader static-analysis layer for:

- dead-code detection with boundary and circular-dependency findings
- duplication detection, including semantic clone modes
- health / refactoring target reports
- changed-file audit mode for AI-generated or agent-generated diffs
- baseline/regression gating before full blocking CI

Do not choose a winner from documentation alone. Run both tools on the same checkout and compare
actual Green Goods signal.

## Source Notes

- Knip is already in `package.json` and configured by `knip.ts`.
- Prior cleanup report: `.plans/clean/agent-3-dead-code.md`
- Fallow docs reference: https://docs.rs/crate/fallow-core/2.34.0

## Commands To Run

Run these from the repo root in report-only mode.

```bash
bunx knip --include files --reporter compact
bunx knip --reporter compact
bunx fallow dead-code --format json
bunx fallow dupes --mode mild --format json
bunx fallow health --targets --format json
bunx fallow audit --base origin/develop --format json
```

If `bunx fallow` requires network access or fails to resolve, record that blocker here. Do not
substitute a documentation-only recommendation.

## Comparison Matrix

| Criterion | Knip Result | Fallow Result | Decision Impact |
|---|---|---|---|
| Version / resolution path | TBD | TBD | Must be reproducible by agents |
| Runtime | TBD | TBD | Must be cheap enough for local use |
| Requires secrets / Varlock / 1Password | TBD | TBD | Must be env-safe for static analysis |
| High-confidence unused files | TBD | TBD | Candidate for cleanup-loop inputs |
| Noisy unused exports/types | TBD | TBD | Baseline or warn-only if public API noise is high |
| Dependencies false positives | TBD | TBD | Must account for Foundry, Vite, Storybook, Docusaurus, scripts |
| Generated / runtime-loaded files | TBD | TBD | Must not remove Envio, service worker, docs CSS, or generated artifacts |
| Duplicate code signal | n/a unless another tool is added | TBD | Main reason to consider Fallow |
| Health / complexity signal | n/a unless another tool is added | TBD | Should complement, not replace, source-structure ratchet |
| Boundary violation signal | partial via repo scripts/docs | TBD | Useful only if Green Goods rules are expressible |
| Changed-file audit support | partial via manual scope | TBD | Important for PR/agent gates |
| Baseline / regression mode | TBD | TBD | Required before blocking CI |
| Autofix safety | TBD | dry-run only until reviewed | Never delete without scope lock |

## Known Green Goods False-Positive Classes

Carry these forward from the prior Knip dead-code report and verify whether Fallow handles them
better, worse, or the same:

- Foundry Solidity dependencies and remappings
- Storybook auto-discovery and hoisted Storybook dependencies
- service worker fragments loaded by generated service worker code
- Docusaurus CSS referenced from config
- Vite string-plugin references such as React Compiler
- runtime barrels and intentional public API exports
- exported prop types and domain types with zero runtime cost
- Envio generated code and side-effect handler registration
- Varlock / 1Password resolution triggered by importing Vite config

## Recommendation

TBD after commands run.

Allowed outcomes:

1. **Knip only**: keep Knip as the dead-code source and invest in env-safe config plus false-positive ignores.
2. **Fallow only**: replace Knip if Fallow gives equal or better dead-code signal plus useful duplication/health/boundary output with lower config cost.
3. **Hybrid**: keep Knip for dead-code until proven otherwise, add Fallow as advisory `dupes` / `health` / changed-file `audit`.
4. **Defer gates**: keep both as manual report tools until the baseline is reliable enough for agents and CI.

## First Gate Recommendation

TBD after comparison. The default should be advisory or baseline/regression mode, not blocking full
repo failure, until false positives are captured.
