# Ops Console Closeout

**Slug**: `ops-console-closeout`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-04-19`

## Problem

Four otherwise-near-complete hubs each carry a small tail of work that only a human operator with an external console can close — GitHub repo settings (rulesets, billing, security toggles), PostHog dashboards, native-translator es/pt copy. Keeping those tails inside the parent hubs blocks closure and spreads operator-only work across multiple files.

## Desired Outcome

- Parent hubs (`admin-ui-revamp`, `client-z-index-sweep`, `design-system-enforcement`, `github-copilot-rollout`) become closable once their agent-doable work lands; no row in those hubs is blocked solely on Afo's console session.
- One checklist surfaces every remaining manual operator item so Afo can work through it in a single session with the right console open.
- Agent-verifiable items (ruleset shape via `gh api`, dashboard paths via PostHog API) are flagged for post-hoc verification so each manual action has an evidence trail.

## Scope Notes

- In scope:
  - `github-copilot-rollout` GitHub UI settings (rulesets, premium budget, security toggles, 2-week pilot metrics review).
  - `admin-ui-revamp` PostHog dashboard/funnel updates (D54).
  - `admin-ui-revamp` native-translator es/pt pass (D56) — **after** agent formalizes the en.json key set.
- Out of scope:
  - Any new feature, code, or migration.
  - Anything an agent can close directly — that stays on the parent hub's tail and closes the parent hub.

## Success Signal

All four parent hubs reach `stage=done` without a leftover "Manual / Human Tasks" row, because each such row is now tracked (and verified) here.
