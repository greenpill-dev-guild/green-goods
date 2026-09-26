# Agent Messaging Channels (WhatsApp + SMS) - UI Handoff

## Lane

- Owner: unassigned (one builder, 2026-09-25 to 2026-10-02)
- Branch: set when work begins using `<type>/<work-description>`
- Status: blocked (see status.json; this block is derived from it)

## Scope

> **Lane order.** Lanes route skill and package, not execution. Follow the numbered step
> order in `plan.todo.md`: `state_api` and `ui` interleave in both directions, so neither
> blocks the other.
Buildathon prototype steps 9-12 and 15: draft intake port modelled on useShareTargetIntake, the ?wa= locator on /home/garden beside ?draftId= and ?shareTarget=, first-run passkey with the in-app-browser handoff, open-joining admission before the attestation, the outcome call on submission completion, and EXIF/location stripping before publication. Proves UX-01, ID-01, part of UX-02, DATA-06. Shared auth and work surfaces take the critical override; step 11 needs authenticated Brave proof.

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
