# Codebase Architecture Skills and Seam Governance

**Slug**: `codebase-architecture-skills`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-08-24`
**Historical predecessor**: [`../../archive/module-seams-and-velocity/`](../../archive/module-seams-and-velocity/)

## Problem

The completed Module Seams and Velocity program created direct seams, faster test projects, and a
specialist certification skill. The repository still lacks one shared definition of a deep module,
an architecture-opportunity workflow, and bounded machine tracking for critical seams. Guidance,
builder docs, Linear state, direct-test enforcement, and validation selection have also drifted from
the implemented architecture.

## Desired Outcome

- Agents use one architecture model for depth, seams, locality, leverage, and test design.
- Existing `plan`, `review`, `audit`, and `module-seams-review` skills have distinct, tested roles.
- Human-selected critical seams and hotspots have fresh, machine-checked evidence.
- Architecture work moves through `OBSERVED -> CANDIDATE -> SELECTED -> IMPLEMENTED -> CERTIFIED`;
  unselected work may be `DEFERRED` without entering the registry.
- Test quality, coverage floors, and validation velocity remain separate evidence dimensions.
- The historical program stays immutable and its Linear parent closes cleanly.

## Scope Notes

- In scope: agent guidance, the specialist review matrix, seam registry/checker, validation routing,
  trigger/behavior fixtures, builder documentation, Plan Hub/Linear tracking, and coverage freshness.
- Out of scope: runtime product refactors, Solidity registry enforcement, new top-level skills,
  dependency installs, and the separate `client-structure-and-agent-guides` implementation.

## Success Signal

A review of the architecture guidance selects the three intended evidence checks; certified
registry entries fail closed when their exports, composition, proof, or fingerprint drifts; and a
fresh exact-SHA coverage run remains green without weakening any inner-loop or ship gate.
