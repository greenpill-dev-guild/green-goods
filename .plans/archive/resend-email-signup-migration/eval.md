# Resend Email Signup Migration Evaluation Plan

## Release Gates

1. Correctness: valid subscription requests create/update a Resend contact with source, locale
   when present, consent timestamp, and a Green Goods signup marker.
2. Usability: the public homepage signup remains visually and behaviorally unchanged except for
   provider-neutral failure copy.
3. Regression safety: invalid email, missing consent, disallowed origin, rate limit, oversized
   body, and missing-provider paths keep returning safe failures.
4. Evidence quality: research evidence and open assumptions are recorded before implementation.
5. Human judgment: protected surfaces and maintainer-call decisions are called out before merge.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Resend provider adapter | Adapter tests prove create/update/already-subscribed behavior, request shape, and upstream failure handling without logging sensitive details. | `state_api` | `handoffs/codex-state-api.md` |
| AC-2 | Public subscribe route | Public API tests prove existing validation guards and success/failure response shape after the provider swap. | `state_api` | `handoffs/codex-state-api.md` |
| AC-3 | Shared/client provider-neutral copy | Shared public contracts and all locale files use provider-neutral error names; client tests still pass for payload and success reset. | `ui` | `handoffs/claude-ui.md` |
| AC-4 | No out-of-scope surfaces | Diff review confirms no contracts, indexer schema, wallet, payment, or admin changes. | `qa_pass_1` | `handoffs/claude-qa-pass-1.md` |
| AC-5 | Live provider proof | Authenticated Brave or operator-led QA confirms a test/staging signup appears in Resend, or records that proof is blocked by missing credentials. | `qa_pass_1` | `handoffs/claude-qa-pass-1.md` |
| AC-6 | Regression review | Codex reruns focused validation and quick repo verification before PR handoff. | `qa_pass_2` | `handoffs/codex-qa-pass-2.md` |

## Test Strategy

- Unit: focused provider adapter tests replacing `luma.test.ts` with Resend request/response
  behavior.
- Integration: public Agent API tests for `POST /public/subscribe` success, duplicate/already
  subscribed, missing provider, invalid email, missing consent, oversized payload, CORS, and rate
  limiting.
- E2E / Playwright: none required for the provider adapter itself; clean-room browser proof is not a
  substitute for live Resend contact creation.
- Manual checks: authenticated Brave QA against the public homepage subscribe path when a safe
  Resend test/staging key is configured.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in
  `status.json`.

## QA Sequence

### Claude QA Pass 1

- Focus on UX issues, provider-neutral copy, missing requirements, test gaps, and live provider
  proof availability.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Confirm the trigger branch exists: `claude/qa-pass-1/resend-email-signup-migration`
- Re-run targeted validation and close the loop on remaining defects
