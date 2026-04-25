# Manual Ops Closeout

**Slug**: `manual-ops-closeout`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-04-19`

## Problem

Several retired implementation plans left behind a small tail of work that only a human operator with an external console can close — GitHub repo settings (rulesets, billing, security toggles), PostHog dashboards, native-translator es/pt copy, and live-browser visual QA. Keeping those tails in deleted plans would create stale truth surfaces.

## Desired Outcome

- Admin PostHog/i18n, client stacking QA, design breakpoint QA, and GitHub operator checks live here as one checklist.
- `github-copilot-rollout` remains active only for final GitHub-side settings, alert routing, and pilot review evidence.
- One checklist surfaces every remaining manual operator item so Afo can work through it in a single session with the right console open.
- Agent-verifiable items (ruleset shape via `gh api`, dashboard paths via PostHog API) are flagged for post-hoc verification so each manual action has an evidence trail.

## Scope Notes

- In scope:
  - `github-copilot-rollout` GitHub UI settings (rulesets, premium budget, security toggles, 2-week pilot metrics review).
  - Admin PostHog dashboard/funnel updates for the current `/hub/*` routes.
  - Admin native-translator es/pt pass after the English key set is stable.
- `github-copilot-rollout` final settings: develop draft-review parity, premium budget/alerts, Dependabot alert routing, autonomous-agent controls, and two-week pilot review.
- Out of scope:
  - Any new feature, code, or migration.
  - Anything an agent can close directly in an active implementation hub.

## Success Signal

All remaining operator-only tasks close from this hub with verification evidence, and no agent needs to follow a deleted implementation plan to understand the work.
