# Commitment Pooling - Claude Admin UI Handoff

## Status

- Execution sub-lane: `ui_admin`
- Machine lane: `ui`
- Owner: Claude
- Branch: `claude/ui-admin/commitment-pooling`
- Current state: blocked on `state_api`

## Scope

- Garden workspace pool console, cycles, seeding, claims, analog capture, assessment v3, allocation presets, disputes, reward/settlement queue, and Pools workspace/Hub confirmation queue.

## Acceptance

- Every module write goes through shared mutation hooks; no direct contract calls in admin views.
- Admin remains a restrained operator cockpit with no client hero moments.
- Settlement account setup and batch actions follow `settlement-spec.md` without making Celo Safe rollout launch-blocking.

## Proof Expectations

- Targeted component/mutation tests plus authenticated Brave proof for operator-critical flows.
