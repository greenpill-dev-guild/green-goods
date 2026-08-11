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

- GREEN shared hooks/selectors/jobs, including the documented bare-address `Garden.id` query
  contract plus chain-scoped IDs for new Commitment Pooling entities
- uiux-spec.md Appendix E, and W28–W31 as drawn in `hifi/screens/exchange.ts` with `sb35`/`sb36`
  as validated journeys (register #97f; wireframes.md keeps the lo-fi frames as background)
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
- Narrowed dispatch option (status.json `ui_client.blocked_reason`): the core pool views above (W1–W5 — browse, detail, create, confirm, and WalletDrawer panel) may be dispatched by an explicit narrowed handoff once state_api is GREEN, without waiting for settlement. W6 is not active work; it is only the W6→W5 compatibility alias. The settlement slices stay with the settlement gate: W23 WalletDrawer G$ section, distinct consideration-status rows (Queued, Dispatched, derived delayed, executed/acknowledgment-pending, Confirmed, authenticated Failed, Cancelled-from-Queued, and Cancelled-from-Failed) on W2, and the online `transfer` flow.
- Claim-request Pending/Accepted/Declined/Superseded states with indexed canonical `claimant`, authenticated `requestedBy`, `claimType`, `gardenContext`, request time/state/reason/resolution, derived accepted `providerGarden`, and a fresh re-request path after decline.
- The locked `W25@context-chooser` pre-claim chooser opens from a protocol-pool claim action before submission: Personal submits the connected member as both `claimant` and `requestedBy`; Garden is visible only to eligible Garden Stewards, binds the selected GardenAccount as `claimant`, the authenticated steward as `requestedBy`, and the selected garden as `gardenContext`. The chooser never rewrites a stored claim type after submission.
- Commitment deep links open `WFLOW@review`, the existing Work Review state with a read-only “Fulfills” row. The row carries the canonical `meta.commitmentId`, shows the linked commitment context without making it editable, and preserves the dependent work link used by evidence/approval review.
- Pool readiness checklist exposes charter, qualifying baseline, and provider open-commitment cap; Paused exposes its reason while leaving only the contract-authorized recovery actions available.
- Pool and cycle summaries show state counts and exact-label unit groups; `promiseKeptRate` is the only cross-commitment percentage. `hours` and `Hours` remain visibly separate, and active progress never adds unlike units.
- Direction-aware confirmation UI: Offer receiver or Request creator, a named-group option, and
  distinct `PoolFallback` / `ProtocolFallback` provenance, with every frozen contributor omitted
  from every path.
- G$ consideration status and online send flow gated by authenticated acknowledgment and member delivery readiness.
- The protocol pool uses the same payout-plan lifecycle with explicit payer/provider identities
  and immutable contributor-or-beneficiary shape. Garden-claimed Requests show one external garden
  Safe beneficiary; individual Requests and all Offers show contributor consideration. The client
  never creates a settlement offline job or permissionlessly queues a disbursement after Fulfilled.
- Accessible mobile/PWA states and en/es/pt copy.

## Acceptance

- The six field job kinds (`commitmentSeries`, `commitment`, `claim`, `evidence`, `workLink`,
  `confirmation`) work offline, survive restart, expose waiting/retry/failure, and do not duplicate
  submissions. `transfer` remains online-only and never enters the offline queue.
- Every Commitment draft/place persists `clientCommitmentId` plus creator-scoped
  `creationRequestKey` before send. Retry reads through the contract mapping and reuses the same
  key; it never creates a new key behind the same button. Work-link jobs do the equivalent with a
  caller-scoped `operationKey`, including the stale-retry-after-unlink case.
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
- Consideration presentation follows the declared rail: an external payout record never appears as a
  Celo settlement, and a `CeloSettlement` declaration never exposes the external
  `recordConsiderationPaid` path.
- Gardener settlement rows use exactly three phrases: Queued, Dispatched, derived delay, Celo executed, and acknowledgment-pending all render “support on its way”; only Confirmed renders “support arrived”; authenticated Failed renders “support is being rearranged,” never a success phrase. A calm action explanation may accompany the phrase without exposing the internal state noun. Cancelled renders its separate locked copy for Queued versus Failed origin. Existing settlement history always outranks the member-delivery availability gate.
- AA failure leaves the fulfilled commitment, payout-plan summary, garden retention, unprepared
  contributor rows, and historical child states visible while disabling only first child
  preparation and member sends. It never offers a garden-custody claim path or a retry for an
  unprepared row.
- Every flow includes loading, empty, offline, pending, declined, superseded, failed, retry, and terminal states where applicable.
- Saved Offer metadata renders `LOCAL_DRAFT`, `SAVING_REMOTE`, `SAVED_REMOTE`, `SAVE_FAILED`,
  `OFFLINE_LOCAL`, and `VERSION_CONFLICT` truthfully. Save first enters Saving; only a confirmed
  owner-authenticated Agent response may claim Saved or cross-device durability. SB-38 remains
  visibly unsaved with no signal.
- Controls have accessible names, logical focus order, 44px targets, sufficient contrast, and reduced-motion behavior.
- Fulfillment/cycle-close hero moments remain PWA-only and do not obscure status.

## RED / GREEN

- RED: focused component/flow tests fail for concurrent Season/Campaign scope, direction-aware eligibility, stored claim terms and decline/supersession recovery, offline jobs, and settlement/member-delivery precedence.
- RED includes the broadcast-before-local-hash crash window for Commitment creation, Work-link
  replay after unlink, and every saved-Offer persistence result including offline and conflict.
- GREEN: the same tests pass; client build passes; authenticated Brave and real-device walkthroughs prove the visible flows.

## Exact Bun commands

Both named client test files do not exist yet; they are intentional to-be-created RED-first deliverables of this lane.

- bun run --filter @green-goods/client test -- src/__tests__/commitment-pooling.test.tsx
- bun run --filter @green-goods/client test -- src/__tests__/settlement-consideration-status.test.tsx
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
  indexer read-back, plus the scoped existing-admin/UI foundation cleanup. W23, consideration-status
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

## Binding confirmation amendment — 2026-08-02

- W3 includes a native “Let the Green Goods team confirm if nobody local is eligible” control —
  **on by default for the pilot** (register #94, 2026-08-10, superseding this amendment's earlier
  off default; opt-out per promise, usage guard unchanged). The offline creation job persists
  `protocolFallbackEnabled`; review and retry show the stored choice. If no protocol pool is registered, the control is disabled with an
  explanation rather than accepting a promise with a dead-end confirmer.
- W2 and W4 consume indexed `fulfilledBy`, `confirmationPath`, and `fallbackReason`. Ordinary
  confirmation names the counterparty. `PoolFallback` reads “confirmed by your garden steward —
  fallback”; `ProtocolFallback` reads “confirmed by the Green Goods team — fallback.” Both show
  the reason and never rely on colour alone.
- Protocol fallback is structural, not time-based. The client never promises automatic escalation
  or a waiting period, and never exposes either fallback to a frozen contributor. A wallet that is
  only the CommitmentPoolingModule owner receives no confirmation control.
- RED fixtures cover a small garden with no ordinary/local eligible confirmer, opt-in preserved
  through offline restart, successful Green Goods protocol fallback, local fallback precedence
  when one wallet holds both roles, missing-protocol-pool recovery, and explicit actor/path/reason
  rendering.

## Binding ongoing-Offer amendment — 2026-08-02

- Runtime implementation follows `standing-commitments-spec.md`, `uiux-spec.md` Appendix F, and
  the completed `claude-standing-artifacts.md` output. The approved artifacts are canonical;
  product code remains behind the backend gates.
- Add Things I can offer, signed private saved-Offer metadata, the Offer once / Offer over time
  choice, garden selection for the ongoing path, finite Add places,
  claim-one-pre-created-instance, series Story, Ask me again next cycle, and holder-only
  prospective metadata edit/rest/resume/retire. Active and Resting metadata edits call
  `updateCommitmentSeriesMetadata` without rewriting existing instance snapshots. Zero-place
  series keep Rest and Retire reachable without first creating capacity. “I’m learning this” is
  outside the Commitment Pooling Offer flow.
- Preserve the selected pool lifecycle through ongoing-Offer creation and detail. A Ready pool may
  create the series but renders a Ready-specific detail with no Add-places/W35 path until indexed
  state is Open. Composted remains distinct from Closed: participation is unavailable now, while
  member copy preserves the steward-owned `reopenPool` path and history.
- The canonical six-kind list is `commitmentSeries`, `commitment`, `claim`, `evidence`,
  `workLink`, and `confirmation`; `transfer` remains online-only. Availability appears only after
  Offer creation sync reserved the slot.
- Keep Pool participation history separate from one ongoing Offer’s Story. No device-only saved
  Offer metadata, claim-spawned instance, auto-renewal, active succession control, inferred
  participant count, reliability score, or cross-pool identity.
