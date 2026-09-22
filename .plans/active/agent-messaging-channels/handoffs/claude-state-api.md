# Agent Messaging Channels (WhatsApp + SMS) - State/API Handoff

## Lane

- Owner: unassigned (one builder, 2026-09-25 to 2026-10-02)
- Branch: set when work begins using `<type>/<work-description>`
- Status: blocked (see status.json; this block is derived from it)

## Scope

> **Lane order.** Lanes route skill and package, not execution. Follow the numbered step
> order in `plan.todo.md`: `state_api` and `ui` interleave in both directions, so neither
> blocks the other.
Buildathon prototype steps 1-8, 13 and 14: Meta webhook signature plus a leased event claim, normalization, encrypted-subject draft tables, bounded media fetch, single-use link with chat-side confirmation, draft-scoped account proof and read, the authenticated outcome route, and receipt derivation with a restart-safe outbox. Proves SEC-01, CH-01, WORK-01, SEC-02, AUTH-01, AUTH-03, OPS-05, and DATA-02 for the consent notice and the deletion path. Reuse garden-join-request-auth.ts and profile-avatars.ts rather than writing new verification.

## TDD Proof

- RED: pending
- GREEN: pending
- Proof limit: none recorded

## Validation

- Pending lane implementation.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Record blockers here before changing `status.json`.
