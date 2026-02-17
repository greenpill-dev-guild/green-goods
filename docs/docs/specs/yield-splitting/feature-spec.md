---
id: yield-splitting-feature-spec
title: GG-FEAT-010 Yield Splitting
sidebar_label: Feature Spec
---

# GG-FEAT-010 — Yield Splitting

## Goal
Distribute accrued yield across configured destinations (treasury, cookie jar, juicebox, purchases).

## Acceptance Criteria
- Split percentages are validated and sum correctly.
- Distribution decisions are auditable in events/entities.
- Low-yield accumulation behavior is explicit in UX.
