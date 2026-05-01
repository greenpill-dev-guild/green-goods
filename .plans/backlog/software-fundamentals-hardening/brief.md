# Software Fundamentals Hardening

**Slug**: `software-fundamentals-hardening`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-05-01`
**Source Audit**: `reports/software-fundamentals-audit-2026-05-01.md`

## Problem

Green Goods already has many of the foundations that make AI-assisted development work: `.plans`, domain glossaries, shared module maps, typed domain primitives, Storybook-backed UI surfaces, and validation scripts. The current risk is that these foundations are not consistently enforced against the latest stable code. That creates the same failure mode described in the software-fundamentals talk: agents can keep producing code that passes local checks while the system becomes harder to understand, test, and change.

The audit found seven main entropy leaks:

- agent guidance and plan commands drift from the real repo surface
- package-level contract guidance still describes resolver shapes that no longer exist
- shared's accepted fat-barrel interface has grown past the ADR snapshot and needs a sharper API policy
- dead-code scanning exists as a dependency but is not currently runnable in the local audit path because Knip imports Vite/Varlock config
- Knip has prior repo evidence and known false positives, but Fallow has not yet been evaluated on this codebase as a possible broader dead-code / duplication / health / boundary signal
- source-structure guardrails are differential and do not describe stable baseline complexity
- recent stable flows still land as large orchestration files instead of deep, testable module boundaries

## Desired Outcome

- Agents can rely on current repo instructions, plan-hub commands, and guidance checks without chat-only correction.
- Package guides and ADRs reflect the current architecture rather than remembered architecture.
- Dead-code and source-structure feedback loops can run without local secret-manager coupling.
- The repo has a written Knip-vs-Fallow recommendation based on Green Goods output, false-positive cost, CI fit, and agent usability.
- New work is shaped around small, explicit, testable module interfaces before UI or hook implementation grows.
- Existing large stable surfaces have a visible, prioritized hardening path instead of recurring rediscovery in reviews.
- Feedback loops distinguish "tests exist" from "the core behavioral boundary is tested."
- The plan remains a backlog hardening program until a human explicitly activates one or more lanes.

## Scope Notes

- In scope:
  - guidance and plan-hub command drift
  - contracts package guidance drift, limited to docs/comments and current resolver vocabulary
  - shared API / barrel policy refresh around the existing ADR-008 decision
  - Knip vs Fallow evaluation before choosing the recurring static-analysis toolchain
  - env-safe dead-code audit path for Knip/file-level cleanup checks
  - source-structure baseline reconciliation
  - test-first boundary policy for new plans
  - Campaign Cookie Jar module hardening
  - agent API server internal boundary hardening
  - cleanup of stale admin route/view/primitive surfaces
  - documentation of proof limits and validation evidence
- Out of scope:
  - product redesign
  - Solidity behavior, contract deployment, or upgrade changes
  - replacing the accepted shared fat-barrel strategy with a new import architecture
  - broad repo cleanup unrelated to the audit findings
  - making Fallow or Knip a blocking CI gate before baseline and false-positive triage
  - using autofix for deletions without a human scope lock and a dry-run review
  - touching unrelated dirty worktree files
  - making every oversized file small in one PR

## Success Signal

The repo has one validated backlog hub that turns the audit into an executable hardening sequence, and the first activated lane can prove a concrete reduction in agent-facing drift or module-boundary risk without widening into general cleanup.
