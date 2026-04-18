# Harness Hardening Wave 1

**Slug**: `harness-hardening-wave-1`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-04-18`
**Research Map**: `.plans/ideas/autonomous-harness-map-2026-04-18.md`
**Active Rollout**: `.plans/active/autonomy-harness-rollout/`
**Next Follow-On Hub**: `Telegram trace capture`

## Problem

The active autonomy rollout is focused on control-surface repair and honest repo truth. The next gap is harness hardening: deterministic guardrails are still too soft, reviewer scopes are too broad, source-structure regressions are not ratcheted, criticality depth is implied instead of explicit, and recurring harness friction is not being harvested into a durable weekly loop. Pulling that work into the active rollout would blur scope and make it harder to tell whether control-surface stabilization actually landed.

## Desired Outcome

- Wave 1 exists as a separate backlog hub dedicated to harness hardening only.
- Deterministic scripts, not reviewer pass/fail semantics, block design and source-structure regressions.
- Advisory reviewer lanes exist for `contracts-security` and `mutation-reliability`, with clear promotion criteria before they become required.
- Criticality classes and remediation-first prompts are explicit in repo guidance.
- A weekly harness-GC automation writes dated proposals without editing code.
- `Telegram trace capture` stays out of this wave and becomes the next follow-on hub after Wave 1 stabilizes.

## Scope Notes

- In scope:
  - new backlog hub, brief/spec/eval, and lane metadata for Wave 1
  - blocking deterministic checks for design guardrails and source structure
  - split advisory reviewer workflows for contracts security and mutation reliability
  - explicit `critical` / `sensitive` / `routine` guidance and edit-time warnings
  - weekly harness-GC automation prompt and report contract
- Out of scope:
  - `Telegram trace capture`
  - Chromatic wiring
  - design-lane rollout
  - changing the scope of `.plans/active/autonomy-harness-rollout/`
  - making Claude review workflows required in this wave

## Success Signal

The repo gains deterministic blocking guardrails plus report-only reviewer and GC scaffolding, while the active autonomy rollout stays focused on the current control-surface work and `Telegram trace capture` remains queued as the next follow-on hub.
