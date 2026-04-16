# Agent Evaluation Framework

The active eval surface is intentionally small:

- **Automated agent evals** for the runnable suites we still use
- **Product acceptance cases** as a QA companion for feature work

## Automated Agent Evals

These are the only agent eval packs considered live:

| Agent | Cases | Purpose | Run Method |
|-------|-------|---------|-----------|
| `triage/` | `p0-security.md`, `p1-feature-broken.md`, `p2-degraded-workaround.md`, `p2p3-ambiguous-boundary.md`, `p3-enhancement.md` | Classification accuracy and routing quality | `./.claude/scripts/run-eval.sh` |
| `code-reviewer/` | `clean-pr.md`, `known-bug-pr.md`, `hook-boundary-violation.md`, `false-positive-bait.md` | True/false positive rate and verdict quality | `./.claude/scripts/run-eval.sh` |

### When to Run

Run the automated evals:

- after modifying `.claude/agents/*.md`
- after changing skills used by `triage` or `code-reviewer`
- after changing the review or migration output contracts or the output gate
- after major model changes when you want a quick regression check

### Targets

| Agent | Metric | Target |
|-------|--------|--------|
| triage | Classification accuracy (P0-P4) | >= 90% |
| code-reviewer | True positive rate | >= 85% |
| code-reviewer | False positive rate | <= 10% |

### Historical Results

| Date | Model | Agent | Task | Score | Baseline | Turns | Notes |
|------|-------|-------|------|-------|----------|-------|-------|
| 2026-02-27 | haiku-4.5 | triage | p0-security | 100/100 | — | 5 | Perfect: correct P0/security, identified PostHog vector, recommended log purge |
| 2026-02-27 | haiku-4.5 | triage | p3-enhancement | 100/100 | — | 5 | Perfect: correct P4/enhancement, routed to /plan, no implementation guidance |
| 2026-02-27 | opus-4.6 | code-reviewer | known-bug-pr | 100/100 | — | 20 | Perfect: found all 3 expected bugs + 5 valid bonus findings, 0 false positives |
| 2026-02-27 | opus-4.6 | code-reviewer | hook-boundary-violation | 100/100 | — | 20 | Perfect: found all 3 expected findings + 5 valid bonus, 0 false positives |
| 2026-02-27 | opus-4.6 | code-reviewer | clean-pr | 100/100 | — | 42 | Perfect: APPROVE with 0 findings. Recognized synthetic diff conventions. Note: a parallel run (31 turns) scored 40/100 — flagged real missing imports as build errors. Variance in synthetic eval handling |

## Product Acceptance Cases

`acceptance/` stays in this folder as a QA bridge, not as an agent benchmark pack.

| Directory | Purpose |
|-----------|---------|
| `acceptance/` | Product-level user story validation imported from CharmVerse QA |

See [`acceptance/README.md`](./acceptance/README.md) for usage details. Agents should consult these cases before implementing features so they align with real product behavior, not just code patterns.

**Maturity**: 8 passed (fully specified), 6 in progress, 16 ready (stub). Last synced from CharmVerse: 2026-02-28. Review quarterly.

## Retired Benchmark Note

The old `oracle`, `cracked-coder`, and integration handoff suites are no longer part of the active eval loop and should not be treated as required regression gates.
