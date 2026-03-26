---
title: "GreenWill Evaluation Plan (March 2026)"
sidebar_label: GreenWill Evaluation
slug: /builders/specs/greenwill-gif-evaluation-plan-2026-03
audience: developer
owner: docs
last_verified: 2026-03-25
feature_status: Proposed
---

# GreenWill Evaluation Plan

## Purpose

This document defines how GreenWill should be evaluated before and during rollout.

It is intentionally closer to a TDD and release-gating plan than a generic analytics memo.

It complements:

- [GreenWill Badging + GIF Analysis](/builders/specs/greenwill-gif-analysis-2026-03)
- [GreenWill Implementation Spec](/builders/specs/greenwill-gif-implementation-spec-2026-03)
- [GreenWill One-Pager](/builders/specs/greenwill-gif-one-pager-2026-03)

---

## Evaluation Principles

GreenWill should be considered successful only if it is:

- correct
- auditable
- understandable
- useful
- motivating without being manipulative

That means evaluation must cover both:

- system correctness
- human usefulness

---

## Core Questions

1. Does the system mint the right badge to the right person at the right time?
2. Can every badge be traced back to a valid source event?
3. Do seasonal badges behave correctly as active vs historical credentials?
4. Do users understand what the badge means?
5. Do builders and researchers feel the system is legible enough to contribute to?
6. Do the first badge families actually create value for gardeners, operators, evaluators, and funders?

---

## Test Pyramid

GreenWill should be validated across five levels.

| Level | Purpose | Primary commands or surfaces |
|---|---|---|
| Contract unit tests | registry and status logic correctness | `bun run test:contracts` |
| Shared/unit tests | badge rules, provenance mapping, active/historical logic | `bun run test:shared` |
| Integration tests | source event -> engine -> registry -> issuance -> proof | targeted cross-package tests |
| Client tests | earned moments, proof rendering, status display | `bun run test:client` |
| Manual + user evaluation | usefulness, clarity, trust, motivation | pilot cohort review and survey |

This is not optional layering. Each level catches a different failure mode.

---

## Acceptance Criteria By Layer

## 1. Contract correctness

### `GreenWillRegistry`

Must prove:

- class registration works
- role variants are represented correctly
- season fields persist correctly
- active-expiry fields behave correctly
- updates are permissioned correctly

### Minimum test cases

- register Genesis Gardener and Genesis Operator as separate classes
- register permanent and seasonal classes side by side
- mark a class as active-expiring and verify metadata remains readable after expiration logic changes
- reject malformed or duplicate class definitions

## 2. Badge rule correctness

Must prove:

- `first_submission` triggers once
- `first_approval` triggers once
- `first_assessment` triggers once
- `first_support` correctly accepts multiple qualifying source types
- operator and evaluator stewardship logic are distinct

### Minimum test cases

- first qualifying source event mints
- second identical qualifying source event does not duplicate mint
- a later, different source type does not incorrectly remint a one-time support badge
- seasonal class replay with same source fingerprint is idempotent

## 3. Cross-chain provenance correctness

Must prove:

- badge minted on Celo can point to Arbitrum source activity
- provenance fields remain complete
- proof surface does not confuse mint chain and source chain

### Minimum test cases

- Arbitrum work approval -> Celo badge issuance
- Celo assessment -> Celo badge issuance
- source chain ID, source type, and source ref all render correctly

## 4. UI correctness

Must prove:

- earned moments are visible
- active vs historical seasonal badges are distinguishable
- proof detail is readable
- role-specific Genesis variants are visually distinct

### Minimum test cases

- badge list renders mixed permanent and seasonal badges
- expired seasonal badge still displays in history
- proof detail page shows provenance fields
- Genesis Gardener and Genesis Operator do not collapse into the same display treatment

## 5. Operational correctness

Must prove:

- asynchronous engine can replay safely
- failure logs are actionable
- issuance can recover from partial failure

### Minimum test cases

- simulate issuer failure and rerun
- confirm no duplicate mint on replay
- confirm failed item remains recoverable

---

## Badge Family Acceptance Matrix

| Family | Must prove | Release gate |
|---|---|---|
| Genesis | qualification is role-correct and season-bound | no role leakage |
| Starter | users get first wins quickly and predictably | time-to-first-badge acceptable |
| Domain | thresholds feel fair across domains | no obvious cadence bias |
| Stewardship | operator and evaluator logic stay separate | no merged role confusion |
| Support | multiple support surfaces work without ambiguity | provenance and source coverage verified |
| Seasonal | active expiry does not destroy historical record | archive behavior is clear |

---

## Human Evaluation Framework

System correctness is necessary but not sufficient.

GreenWill should also be evaluated with a small, explicit pilot feedback loop.

## Target groups

- gardeners
- operators
- evaluators
- funders
- builders and researchers reviewing the docs

## Key evaluation themes

### 1. Usefulness

Questions:

- Did the badge feel meaningful?
- Did the proof detail make the badge more credible?
- Did the badge help you understand Green Goods better?

### 2. Value

Questions:

- Does this badge feel like reputation?
- Would you share it publicly?
- Would you care about earning the next one?

### 3. Clarity

Questions:

- Can you tell why you earned it?
- Can you tell whether it is active or historical?
- Can you tell what role or season it represents?

### 4. Fairness

Questions:

- Do the badge thresholds feel fair for your kind of work?
- Do domain differences feel respected?
- Does the support badge treat different support actions credibly?

## Suggested pilot method

- survey after first earned badge
- survey after first seasonal cycle
- short qualitative interviews with at least one participant from each launch role

The first survey priority should be:

- usefulness
- perceived value

That matches the current product direction.

---

## Metrics

## System metrics

- badge issuance success rate
- duplicate issuance rate
- provenance completeness rate
- replay recovery rate
- seasonal status correctness rate

## Product metrics

- time to first badge
- first-badge rate
- badge detail view rate
- favorites / hide usage if shipped
- support badge conversion by source type

## Human metrics

- usefulness rating
- perceived value rating
- clarity rating
- willingness to share publicly
- role-specific fairness feedback

---

## Release Gates

GreenWill should not widen the badge catalog unless these gates are met.

## Gate 1: correctness gate

- registry tests pass
- rule tests pass
- cross-chain provenance tests pass
- no unresolved duplicate issuance bug

## Gate 2: UX gate

- earned moment works
- proof surface is legible
- seasonal active vs historical status is obvious

## Gate 3: usefulness gate

- pilot cohort feedback does not show major confusion
- usefulness and value feedback are net positive
- major fairness issues are not surfacing from one domain or role only

## Gate 4: expansion gate

Before adding more badges, confirm:

- Genesis and starter families are stable
- support-source coverage is real, not aspirational
- operator/evaluator distinction is working

---

## Test Backlog

The minimum test backlog should include:

## Contracts

- registry registration tests
- season model tests
- access control tests

## Shared

- badge rule engine tests
- provenance formatter tests
- status resolver tests

## Client

- badge rail rendering
- proof detail rendering
- earned moment rendering
- historical seasonal badge rendering

## Cross-package integration

- Arbitrum source -> Celo mint path
- Celo source -> Celo mint path
- support-source multi-path behavior

## Manual QA

- Genesis qualification review
- proof field sanity check
- expired seasonal badge still visible
- operator/evaluator confusion audit

---

## Anti-Patterns To Detect Early

Evaluation should explicitly watch for:

- badges minting without strong proof
- badges that feel ornamental rather than meaningful
- role confusion between operator and evaluator badges
- support badges that over-credit easy actions
- seasonal expiration that looks like badge deletion
- source-chain confusion in public proof pages
- over-reliance on black-hat gamification

---

## Definition Of “Ready To Share Widely”

GreenWill is ready for broader community sharing when:

1. the badge model is coherent on paper
2. the registry and source attribution model are implemented
3. at least one end-to-end badge path works reliably
4. proof pages make the provenance legible
5. pilot users report that the badges feel useful and valuable

If any of those are missing, the system is still in internal pilot mode, even if badges are minting technically.
