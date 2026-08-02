# Commitment Pooling - Claude Client UI Handoff

## Status

- Execution sub-lane: ui_client
- Machine lane: ui
- Owner: Claude
- Branch signal: claude/ui-client/commitment-pooling
- Current state: prototype/journey review may continue; implementation waits for state_api,
  verified non-value deployment/indexer output, and the existing admin/UI foundation cleanup
- Linear context: PRD-724 (client UI lane) under parent PRD-650

Concurrent agents share this repository. Stay inside the client lane's named paths, preserve
unrelated working-tree changes, and do not switch the primary tree's branch.

## Inputs

- GREEN shared hooks/selectors/jobs and composite Garden query contract
- uiux-spec.md Appendix E and client frames W28–W31 in wireframes.md, plus planned SB-35/SB-36
- acceptance-matrix.md for exact identity, copy/state, and role proof
- CCIP command/execution/acknowledgment states and gardenerDeliveryEnabled selector
- Existing AppShell, Garden detail, WalletDrawer, offline indicator, wallet/passkey, and i18n patterns

## Outputs

- Garden pool browse/detail/create, open and approval-gated participation, evidence/work linkage, confirmation, dispute/recovery, one-open-Season plus concurrent-Campaign views, and WalletDrawer commitment views; no CP Profile fork.
- Template-first creation, the “offer this in exchange for…” picker, mirrored give/receive review,
  pair chip/detail/feed, A-creator confirmation sheet, and proposed/matched/counterpart-lapsed
  states use existing primitives only. `acceptExchange` is online; after it succeeds, each promise
  follows its own ordinary timeline and confirmation rule.
- DomainImpact creation emits one ordered `{ actionUID, requiredCount }` row per requirement.
  Detail/progress views bind each row by `requirementIndex`, render its approved/required count and
  ActionRegistry-derived domain tag, and use canonical per-commitment `approvedUnits` supplied by
  state/API rather than recomputing contract math in the client.
- Narrowed dispatch option (status.json `ui_client.blocked_reason`): the core pool views above (W1–W5 — browse, detail, create, confirm, and WalletDrawer panel) may be dispatched by an explicit narrowed handoff once state_api is GREEN, without waiting for settlement. W6 is not active work; it is only the W6→W5 compatibility alias. The settlement slices stay with the settlement gate: W23 WalletDrawer G$ section, distinct reward-status rows (Queued, Dispatched, derived delayed, executed/acknowledgment-pending, Confirmed, authenticated Failed, Cancelled-from-Queued, and Cancelled-from-Failed) on W2, and the online `transfer` flow.
- Claim-request Pending/Accepted/Declined/Superseded states with indexed canonical `claimant`, authenticated `requestedBy`, `claimType`, `gardenContext`, request time/state/reason/resolution, derived accepted `providerGarden`, and a fresh re-request path after decline.
- The locked `W25@context-chooser` pre-claim chooser opens from a protocol-pool claim action before submission: Personal submits the connected member as both `claimant` and `requestedBy`; Garden is visible only to eligible Garden Stewards, binds the selected GardenAccount as `claimant`, the authenticated steward as `requestedBy`, and the selected garden as `gardenContext`. The chooser never rewrites a stored claim type after submission.
- Commitment deep links open `WFLOW@review`, the existing Work Review state with a read-only “Fulfills” row. The row carries the canonical `meta.commitmentId`, shows the linked commitment context without making it editable, and preserves the dependent work link used by evidence/approval review.
- Pool readiness checklist exposes charter, qualifying baseline, and provider open-commitment cap; Paused exposes its reason while leaving only the contract-authorized recovery actions available.
- Pool and cycle summaries show state counts and exact-label unit groups; `promiseKeptRate` is the only cross-commitment percentage. `hours` and `Hours` remain visibly separate, and active progress never adds unlike units.
- Direction-aware confirmation UI: Offer recipient or Request creator, with every frozen team
  member omitted from eligibility.
- G$ reward status and online send flow gated by authenticated acknowledgment and member delivery readiness.
- The protocol pool uses the same provider-garden payout-plan read model as other pools. The client
  never creates a settlement offline job or permissionlessly queues a disbursement after
  Fulfilled.
- Accessible mobile/PWA states and en/es/pt copy.

## Acceptance

- The five field job kinds work offline, survive restart, expose waiting/retry/failure, and do not duplicate submissions.
- DomainImpact creation rejects an empty or over-`MAX_REQUIREMENTS` requirement list, missing
  actions, and zero required counts; actions in the same domain remain valid. Successful jobs
  preserve the complete ordered requirement payload through restart and retry. Per-action progress
  remains attached to `requirementIndex`, and the commitment uses canonical state/API
  `approvedUnits`.
- The pool renders at most one open Season plus every concurrently open Campaign; scope controls label Season/Campaign/all-current state counts and exact-label summaries, and member creation binds one explicit cycle or cycle-less context.
- Decline changes only the selected request and leaves peers Pending; acceptance consumes stored terms and renders every other pending indexed request Superseded; a new request never mutates or retries the old record.
- Individual request identity shows claimant=requestedBy; Garden request identity shows the GardenAccount claimant and operator requestedBy. A client can never submit a runtime claim type different from the stored type.
- `W25@context-chooser` always resolves Personal or an eligible steward-owned Garden before the claim mutation runs; Garden is absent for ineligible members, and back/retry preserves the still-unsubmitted choice without fabricating a request record.
- `WFLOW@review` opened from a commitment renders the locked read-only “Fulfills” row from `meta.commitmentId`; its commitment and work destinations are navigable, while the relationship itself has no edit control.
- A G$ transfer remains an explicit online Celo action.
- Reward presentation follows the declared rail: an external payout record never appears as a
  Celo settlement, and a `CeloSettlement` declaration never exposes the external
  `recordRewardPaid` path.
- Queued renders “support is queued”; Dispatched renders “support on its way”; derived delay adds “delivery delayed” without becoming Failed; Celo executed/acknowledgment-pending renders “confirming arrival”; only Confirmed renders “support arrived”; authenticated failure renders “still arranging support”; Cancelled renders different locked copy for Queued versus Failed origin. Existing settlement history always outranks the member-delivery availability gate.
- AA failure leaves the fulfilled commitment, payout-plan summary, garden retention, unprepared
  contributor rows, and historical child states visible while disabling only first child
  preparation and member sends. It never offers a garden-custody claim path or a retry for an
  unprepared row.
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

- Shared hooks in the client package, direct contract calls, package-level env files, offline G$ transfer, garden-custody member claims, manual settlement confirmation, CCIP token-bridge UI, rankings, credit scores, or admin controls.

## Unblock evidence

- Core pooling dispatch requires core state_api GREEN, the verified non-value deployment and live
  indexer read-back, plus the scoped existing-admin/UI foundation cleanup. W23, reward-status
  rows, and Celo transfer remain blocked until settlement state_api GREEN.
- Corrected client wireframes and copy/state matrix are final.
- RED evidence exists before implementation.
- GREEN requires targeted tests, build, authenticated Brave, and a real-device PWA pass including offline restart and member-delivery-disabled behavior.

## Binding architecture amendment — 2026-07-28

- W2/W2b shows one accountable lead, every contributor, roster-forming/frozen state, and the contribution record. Do not present presence as equal credit.
- W2b contributor changes are explicit online-only wallet mutations with member selection,
  retryable failure state, and no offline-queue badge. The frozen roster has no edit affordance.
- Evidence composition requires a labelled bounded credited-contributor selection and persists the
  exact address vector through queued, failed, and retry states; reconnect never invents a fallback recipient.
- W3 uses repeatable action/count requirements and never tells people they may add only four. W4 excludes every team member from confirmation.
- Recognition preview uses the opened cycle policy or immutable cycle-less 20/80 default. It
  presents zero-eligible legacy/indexed state as a blocking inconsistency with no lead or
  metadata-only repair action. For a cycle-less commitment, the preview explicitly labels the
  split as recognition/payment-only and “Not certificate eligible · no cycle allocation.”
- W23 contributor receipts distinguish Hypercert recognition from garden-funded child payment, name the garden payer and retained amount, and never say “arrived” before authenticated confirmation.
- The hi-fi artifact and SB-33 are the interaction reference; all new user-facing copy lands in en/es/pt and requires authenticated Brave plus real-device proof.
