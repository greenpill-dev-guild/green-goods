# Builder Documentation Authority

**Slug**: `builder-docs-authority`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-08-30`

## Problem

The builder documentation repeats implementation details that already live in code, configuration,
workflows, and package manifests. Those copies cannot be executed or tested, so they drift and give
humans and coding agents conflicting answers.

## Desired Outcome

- Code and checked-in configuration own implementation facts.
- The ontology owns cross-layer domain language and evidence-backed capability status.
- Generated references expose volatile facts and fail CI when stale.
- Authored builder docs stay focused on user flows, rationale, troubleshooting, and navigation.
- Historical specifications remain recoverable through Git without appearing as current guidance.

## Scope Notes

- In scope: all 84 pages under `docs/docs/builders`, their tracked consumers, package runbooks,
  deterministic docs projection tooling, Docusaurus navigation and redirects, and Docs CI.
- Out of scope: runtime product behavior, contracts, deployments, live QA results, external
  publication beyond the existing Docs workflow, and a Linear mirror.

## Success Signal

The builder surface contains exactly 44 pages: 17 deterministic projections, 26 thin authored
guides, and the retained Revenue Explorer specification. Broken authority paths and stale generated
output fail CI with zero baseline debt.
