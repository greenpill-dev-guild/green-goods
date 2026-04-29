# Manual Ops Closeout Spec

## Summary

This hub consolidates manual, console-only tails from four otherwise-near-complete hubs into one checklist. It exists because the parent hubs should be closable once their agent-doable work lands — and carrying "Manual / Human Tasks" rows across four hubs makes closure ambiguous. Work here is gated on human operator access (GitHub.com, PostHog, native translators); the agent's role is post-hoc verification via `gh api`, PostHog API reads, and locale lint.

## Users

- Primary: Afo — sole human operator with GitHub admin, PostHog admin, and translation coordination access.
- Secondary: future-Afo referring back to which parent hub each item came from (so release notes on the parent hub stay honest).

## Functional Requirements

1. GitHub-side rollout items from `github-copilot-rollout` land per `.github/copilot-rollout-settings-checklist.md`.
2. PostHog dashboards and funnels reflect the current admin route paths.
3. Admin es/pt translation pass completes after the English key set is stable.
4. Each completed manual action has either (a) a GitHub/PostHog link recorded as evidence, or (b) an agent-run `gh api` / PostHog API / locale grep confirming the live state.
5. Once a parent hub's agent-doable tail has merged, the parent hub's `plan.todo.md` links to this hub for the remaining rows instead of carrying them inline.

## Non-Functional Constraints

- Package boundaries: none — this is an operational hub, not a code hub. No `packages/*` change should originate here except the en.json translator pass inside `packages/shared/src/i18n/`.
- Security: GitHub rulesets, Copilot premium budget, and security-toggle items are the critical items — they must be in place before any Copilot cloud-agent capability expands beyond the current conservative defaults.
- Offline / sync: n/a
- Localization: the es/pt translator pass is the localization scope; no new keys are introduced here.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | n/a — no UI code changes |
| State / API | `state_api` | n/a — no data-layer changes |
| Contracts | `contracts` | n/a |
| QA | `qa_pass_1`, `qa_pass_2` | Run after each manual section is completed by Afo; evidence via `gh api` / PostHog API / locale grep. |

## Risks

- Risk: Afo completes a GitHub setting but the agent marks it "verified" from a stale cache or prior state.
  - Mitigation: Verification command output is recorded in `status.json` `history[]` with the command string + timestamp; an agent cannot tick an AC without running the probe in the same turn.
- Risk: Native translator availability delays the es/pt pass.
  - Mitigation: English-with-fallback keys already ship per D56 — translation is additive, not blocking.
- Risk: Rows get migrated from the parent hub before the agent-doable tail merges, losing the trail back to the closing commit.
  - Mitigation: Decision 4 below enforces the merge-first ordering.
