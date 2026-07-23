# Commitment Pooling - Claude Client UI Handoff

## Status

- Execution sub-lane: ui_client
- Machine lane: ui
- Owner: Claude
- Branch signal: claude/ui-client/commitment-pooling
- Current state: blocked on state_api
- Linear context: PRD-724 (client UI lane) under parent PRD-650

## Inputs

- GREEN shared hooks/selectors/jobs and composite Garden query contract
- uiux-spec.md and client frames in wireframes.md
- acceptance-matrix.md for exact identity, copy/state, and role proof
- Functions-only settlement states and memberDeliveryEnabled selector
- Existing AppShell, Garden detail, WalletDrawer, offline indicator, wallet/passkey, and i18n patterns

## Outputs

- Garden pool browse/detail/create, open and approval-gated participation, evidence/work linkage, confirmation, dispute/recovery, one-open-Season plus concurrent-Campaign views, and WalletDrawer commitment views; no CP Profile fork.
- DomainImpact creation emits one ordered row per requirement and preserves equal positional `domains[]`, `requiredActionUIDs[]`, and `requiredApprovedWorkCounts[]` arrays. Detail/progress views bind each row by `requirementIndex`, render its approved/required count, and use canonical per-commitment `approvedUnits` supplied by state/API rather than recomputing contract math in the client.
- Narrowed dispatch option (status.json `ui_client.blocked_reason`): the core pool views above (W1–W5 — browse, detail, create, confirm, and WalletDrawer panel) may be dispatched by an explicit narrowed handoff once state_api is GREEN, without waiting for settlement. W6 is not active work; it is only the W6→W5 compatibility alias. The settlement slices stay with the settlement gate: W23 WalletDrawer G$ section, reward-status rows (Reported/checking/Verified/Failed) on W2, and the online `transfer` flow.
- Claim-request Pending/Accepted/Declined/Superseded states with indexed canonical `claimant`, authenticated `requestedBy`, `claimType`, `gardenContext`, request time/state/reason/resolution, derived accepted `providerGarden`, and a fresh re-request path after decline.
- Pool readiness checklist exposes charter, qualifying baseline, and provider open-commitment cap; Paused exposes its reason while leaving only the contract-authorized recovery actions available.
- Pool and cycle summaries show state counts and exact-label unit groups; `promiseKeptRate` is the only cross-commitment percentage. `hours` and `Hours` remain visibly separate, and active progress never adds unlike units.
- Direction-aware confirmation UI: Offer recipient; Request creator; provider never shown as eligible.
- G$ reward status and online send flow gated by verified receipt and member delivery readiness.
- Accessible mobile/PWA states and en/es/pt copy.

## Acceptance

- The five field job kinds work offline, survive restart, expose waiting/retry/failure, and do not duplicate submissions.
- DomainImpact creation rejects unequal positional arrays, duplicate domains, missing actions, domain/action mismatches, and zero required counts; successful jobs preserve the complete ordered `domains[]`, `requiredActionUIDs[]`, and `requiredApprovedWorkCounts[]` payload through restart and retry. Per-action progress remains attached to `requirementIndex`, and the commitment uses canonical state/API `approvedUnits`.
- The pool renders at most one open Season plus every concurrently open Campaign; scope controls label Season/Campaign/all-current state counts and exact-label summaries, and member creation binds one explicit cycle or cycle-less context.
- Decline changes only the selected request and leaves peers Pending; acceptance consumes stored terms and renders every other pending indexed request Superseded; a new request never mutates or retries the old record.
- Individual request identity shows claimant=requestedBy; Garden request identity shows the GardenAccount claimant and operator requestedBy. A client can never submit a runtime claim type different from the stored type.
- A G$ transfer remains an explicit online Celo action.
- Reported renders as transfer reported/checking receipt; only Verified renders support arrived.
- AA failure shows delivery unavailable with a calm recovery explanation; it never offers a garden-custody claim path.
- Every flow includes loading, empty, offline, pending, declined, superseded, failed, retry, and terminal states where applicable.
- Controls have accessible names, logical focus order, 44px targets, sufficient contrast, and reduced-motion behavior.
- Fulfillment/cycle-close hero moments remain PWA-only and do not obscure status.

## RED / GREEN

- RED: focused component/flow tests fail for concurrent Season/Campaign scope, direction-aware eligibility, stored claim terms and decline/supersession recovery, offline jobs, and settlement/member-delivery precedence.
- GREEN: the same tests pass; client build passes; authenticated Brave and real-device walkthroughs prove the visible flows.

## Exact Bun commands

Both named client test files do not exist yet; they are intentional to-be-created RED-first deliverables of this lane.

- bun run --filter @green-goods/client test -- src/__tests__/commitment-pooling.test.tsx
- bun run --filter @green-goods/client test -- src/__tests__/settlement-reward-status.test.tsx
- bun run --filter @green-goods/client build
- bun run lint:vocab
- bun run agentic:check
- bun run check:design-md
- bun run check:design-generated
- bun run check:design-tokens

## Out of scope

- Shared hooks in the client package, direct contract calls, package-level env files, offline G$ transfer, garden-custody member claims, manual receipt verification, bridge UI, rankings, credit scores, or admin controls.

## Unblock evidence

- Core pooling dispatch requires core state_api GREEN and exports the documented core selectors/jobs; it does not wait for settlement. W23, reward-status rows, and Celo transfer remain blocked until settlement state_api GREEN.
- Corrected client wireframes and copy/state matrix are final.
- RED evidence exists before implementation.
- GREEN requires targeted tests, build, authenticated Brave, and a real-device PWA pass including offline restart and member-delivery-disabled behavior.
