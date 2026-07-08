# Commitment Pooling - Claude Client UI Handoff

## Status

- Execution sub-lane: `ui_client`
- Machine lane: `ui`
- Owner: Claude
- Branch: `claude/ui-client/commitment-pooling`
- Current state: blocked on `state_api`

## Scope

- Garden tab pool flows, offer/request creation, browse/claim, work linkage, evidence capture, confirmation, cycle views, Profile wallet commitments, reward status, and G$ send affordance.

## Acceptance

- Field actions use the five offline job kinds where applicable.
- G$ send is an explicit online wallet action on Celo, never part of the offline queue.
- Fulfilled and cycle-close hero moments are client-only.
- Mutual-aid copy avoids banned vocabulary and public credit-score framing.

## Proof Expectations

- Component/hook tests plus authenticated Brave proof for visible flows after implementation.
