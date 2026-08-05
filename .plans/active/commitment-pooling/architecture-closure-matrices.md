# Commitment Pooling Architecture Closure Matrices

**Status**: canonical pre-code closure contract  
**Scope locked**: 2026-08-03  
**Authority**: this companion is normative for replay, retry, persistence truth, and safe
wind-down. `contract-spec.md`, `standing-commitments-spec.md`, `uiux-spec.md`, the lane handoffs,
and the executable prototypes must agree with it before implementation begins.

These matrices close four invariant families that earlier review passes handled too narrowly.
They are deliberately finite. A new indexed event, entity, relationship, offline job, retry
control, persistence label, or lifecycle transition must add a row here and pass
`architecture-closure.validate.ts`.

## Reading rules

- **Position** means the emitted `(blockNumber, logIndex)` pair compared lexicographically.
- **Audit idempotency** means `chainId-txHash-logIndex` is inserted once before any projection.
- **Latest wins** is used only for a mutable field that may legitimately change more than once.
- **Commutative delta** means every unique event contributes a signed delta once, so final state
  is independent of delivery order. `updatedAt` becomes `max(current, event.timestamp)`.
- **Natural-key recovery** means a retry first reads the authoritative target and treats an exact
  already-applied result as success; it never blindly rebroadcasts.
- **Creation-key recovery** means a client operation key and payload hash are persisted before the
  first send and the contract returns the original identity on exact replay.
- **No automatic retry** means the person must authorize a new wallet action.

---

## Matrix A — Event ordering and replay

### A1. Complete event inventory

The canonical ABI inventory contains **54 events**. Every event is assigned exactly one primary
projection policy below. Audit-row insertion is independently idempotent for all 54.

| ID | Events | Primary projection | Ordering and replay contract | Required reverse-delivery proof |
|---|---|---|---|---|
| EO-01 | `PoolRegistered` | Pool immutable identity | Fill the `registrationSeen = false` placeholder once, set the flag, and initialize a mutable field only when that field has no later cursor. | registration after charter, cap, or lifecycle update |
| EO-02 | `PoolCharterUpdated` | Pool charter | Independent latest-wins charter cursor. Never coupled to pool lifecycle or cap. | two charters in both orders; update before registration |
| EO-03 | `ProviderOpenCommitmentCapUpdated` | Pool provider cap | Independent latest-wins cap cursor. Never coupled to pool lifecycle or charter. | two caps in both orders; update before registration |
| EO-04 | `PoolReady`, `PoolOpened`, `PoolPaused`, `PoolResumed`, `PoolClosed`, `PoolComposted`, `PoolReopened` | Pool lifecycle and pause reason | One pool-lifecycle cursor. Only a winning event may change state, pause reason, or `updatedAt`. | every opposing transition in both orders and before registration |
| EO-05 | `CycleSeeded` | Cycle immutable identity | Fill the `seedSeen = false` placeholder once, set the flag, and initialize state only when no later lifecycle cursor exists. | lifecycle event before seed |
| EO-06 | `CycleOpened`, `CycleClosed`, `CycleComposted`, `CycleCancelled` | Cycle lifecycle, allocation snapshot, pool open-cycle relationships | One cycle-lifecycle cursor. `CycleOpened` fills immutable snapshots once even when an older Open cannot regress a newer terminal state. Pool Season/Campaign relationships change only with a winning cycle event. | Open/Close/Compost/Cancel in both orders; Open before Seed |
| EO-07 | `CommitmentSeriesCreated` | Series immutable identity | Fill the `creationSeen = false` placeholder once and set the flag. Lifecycle and metadata cursors are independent and nullable; creation initializes only the field whose cursor is absent. | metadata or lifecycle before creation |
| EO-08 | `CommitmentSeriesMetadataUpdated` | Series metadata | Independent latest-wins metadata cursor. | two metadata updates in both orders |
| EO-09 | `CommitmentSeriesRested`, `CommitmentSeriesResumed`, `CommitmentSeriesRetired` | Series lifecycle | Independent latest-wins lifecycle cursor. Retired remains terminal on-chain. | Rest/Resume/Retire in both orders |
| EO-10 | `CommitmentCreated` | Commitment immutable identity, requirements, Need/counter relationships, base pool/cycle/series counts | Create once, fill placeholders, apply the base Offered/Requested projection once, then atomically drain typed pending projections in position order. Set-like relationship arrays are unique and deterministically sorted. | every dependent event before creation; duplicate creation |
| EO-11 | `RewardDeclared` | Declared reward tuple | Independent latest-wins reward cursor. Creation may not restore an older initial tuple. | two declarations in both orders; declaration before creation |
| EO-12 | `ValueDeclared` | Declared value/basis tuple | Independent latest-wins value cursor. Zero/empty values are data, not absence. | two updates in both orders; update before creation |
| EO-13 | `ConfirmerRuleSet` | Complete confirmer rule tuple | Independent latest-wins rule cursor. The list, threshold, and fallback flag move atomically. | opposing rules in both orders; update before creation |
| EO-14 | `ClaimRequested`, `ClaimDeclined`, `CommitmentAccepted` | Claim request row/index plus immutable acceptance facts | Each claimant row owns a lifecycle cursor and `requestSeen`. Decline-before-request creates a terminal placeholder with nullable request payload; an older Request fills payload without reviving it, while a genuinely newer post-decline Request may become `PENDING`. Acceptance/cancel/expiry still win by position. | decline-before-request, fresh request after decline, request/acceptance, request/cancel, and request/expiry in both orders |
| EO-15 | `ExchangeAccepted` | Immutable exchange pair | Create once from emitted facts. It never adds lifecycle, unit, exposure, or member-history deltas. | marker before both ordinary acceptances; duplicate marker |
| EO-16 | `ContributorAdded`, `ContributorRemoved` | Contributor active membership | Each commitment/contributor row owns a latest-wins membership cursor. Older membership events may fill immutable actor/time facts but never regress `active`. The contributor index is a unique address-sorted set. | Add/Remove/Add in every delivery order and before acceptance/freeze |
| EO-17 | `ContributorRequirementAssigned` | One contributor/requirement assignment relationship | One relationship row per `(commitment, contributor, requirementIndex)`, with its own latest-wins cursor. The contributor's active requirement list is rebuilt from the bounded assignment index and sorted numerically. | assign/unassign for the same row in both orders plus interleaved different rows |
| EO-18 | `ContributorRosterFrozen` | Frozen-roster marker/count | One-way event-owned fact. Terminal participant history waits for the emitted count and the exact cursor-correct active rows. | freeze before acceptance and before every contributor row |
| EO-19 | `WorkLinked`, `WorkUnlinked` | Work-attribution link state | Each Work attribution owns a latest-wins link cursor independent of approval-decision sequence. Contributor pending-work deltas apply only when the effective link state changes and account for an already-active credit. | Link/Unlink in both orders; approval before link; reversal before unlink |
| EO-20 | `ApprovedWorkCounted`, `ApprovedWorkReversed` | Effective Work credit and cumulative requirement/commitment values | Resolver `decisionSequence` orders decisions. Exact replay is a no-op; stale sequence is ignored; equal sequence with another UID is inconsistent. Emitted cumulative counts are assigned and emitted unit deltas apply once. | approval/reversal in both delivery orders around link/unlink |
| EO-21 | `EvidenceAttached` | Evidence/evidence-attribution rows and bounded index | Contract CID dedupe plus audit idempotency. Attribution IDs are unique and sorted; evidence credits change only on the contributor's first effective evidence credit. A late row observes current terminal state when setting `confirmed`. | evidence before creation; evidence before/after fulfillment; duplicate CID |
| EO-22 | `AssessmentAttached` | One-time assessment relationship | Contract permits one attachment. Create/fill once; duplicate delivery is an audit no-op. | assessment before creation and before readiness |
| EO-23 | `CommitmentReadyForConfirmation`, `ConfirmationRecorded` | Commitment lifecycle/readiness and confirmation totals | Readiness uses the commitment lifecycle helper. Confirmation count is the maximum emitted cumulative count, never last-delivered count; each explicit confirmer history increment is audit-event-owned once. | confirmations in reverse order; Ready before creation/acceptance |
| EO-24 | `CommitmentFulfilled`, `CommitmentCancelled`, `CommitmentExpired`, `CommitmentDisputed`, `DisputeResolved` | Commitment terminal/dispute lifecycle, reversible current-state deltas, member history, Need/attribution side projections | One commitment lifecycle cursor plus typed pre-creation buffer. Reversible transition helper owns current pool/cycle/series counts and live-count deltas. Event-owned actor counters remain once-only. | every state event before creation/acceptance/freeze and every opposing terminal/dispute order |
| EO-25 | `RewardPaid` | One authenticated external-reward receipt | Contract permits one recorded payout identity. Create/fill receipt once; exact event replay is a no-op. | receipt before commitment creation and duplicate receipt |
| EO-26 | `ModuleDependencyUpdated`, `ModuleSchemaUIDUpdated`, `ModulePauseStatusChanged`, `ModuleUpdated` | Pool-less configuration audit | Immutable audit rows only in this read model. No inferred actor, pool, cycle, or commitment relation. | all four before any pool plus duplicate delivery |
| EO-27 | `ClassRegistered` | Immutable capacity class | Create one `CommitmentClass` row from emitted pool/cycle/label/quota. It changes no aggregate or exposure. | class before commitment and unit events |
| EO-28 | `UnitsCommitted`, `UnitsReleased`, `UnitsFulfilled` | Exact-label summaries, provider exposure, pool/cycle open counts | Unique-event signed commutative deltas. Final totals are independent of delivery order; cumulative class totals are audit evidence, not aggregate assignment. Counts may be transiently negative during synthetic reverse replay but are never published as a completed checkpoint until the replay transaction/batch converges. | Commit/Release/Fulfill in every order, same label and case-distinct labels |

### A2. Complete indexed entity and relationship inventory

| ID | Entity or relationship | Owning events/derivation | Replay invariant |
|---|---|---|---|
| ER-01 | `CommitmentPool` | EO-01–04, EO-03, EO-28, commitment lifecycle | `registrationSeen` plus nullable base identity; separate charter/cap/lifecycle cursors; event-owned lifetime counters; commutative open counts; cursor-ordered live count. |
| ER-02 | `CommitmentCycle` | EO-05–06, EO-28, commitment lifecycle | `seedSeen` plus nullable seed facts; lifecycle cursor; commutative unit/open counts; cursor-ordered live count. |
| ER-03 | `CommitmentClass` | EO-27 | Immutable `chainId-classId` row; no inferred provider. |
| ER-04 | `CommitmentUnitSummary` | EO-20, EO-28 | Exact-label identity and unique signed deltas; case-sensitive labels never merge. |
| ER-05 | `CommitmentProviderExposure` | EO-28 | Provider comes only from unit events; unique signed slot deltas. |
| ER-06 | `CommitmentSeries` | EO-07–10 and lifecycle | `creationSeen` plus nullable base facts and independent nullable lifecycle/metadata cursors; current-state counts use the reversible transition helper. |
| ER-07 | `CommitmentSeriesCycleSummary` | EO-10 and lifecycle | Current-state counts are the same reversible transition applied to one series/cycle key. |
| ER-08 | `Commitment` | EO-10–25 | Immutable creation/acceptance facts, independent mutable-field cursors, and one lifecycle cursor/buffer. |
| ER-09 | `CommitmentRequirement` | EO-10, EO-20 | Immutable requirement identity; emitted cumulative approval count assignment. |
| ER-10 | `CommitmentContributor` | EO-16, EO-19–21 | `additionSeen` and nullable Add facts support remove/decision-first delivery; membership cursor and credits change only from effective state transitions. |
| ER-11 | `CommitmentContributorRequirementAssignment` | EO-17 | Per-relationship cursor; one current boolean. |
| ER-12 | `HypercertCommitmentContributorAllocation` | frozen recognition output | Immutable bundle allocation keyed by hypercert/commitment/contributor; replay upserts exact values only. |
| ER-13 | `CommitmentWorkAttribution` | EO-19–20 | `linkSeen` and nullable Link facts support unlink/decision-first delivery; link cursor and resolver decision sequence remain independent. |
| ER-14 | `CommitmentContributorIndex` | EO-16 | Unique normalized-address-sorted relationship IDs; order cannot depend on delivery. |
| ER-15 | `CommitmentContributorRequirementIndex` | EO-17 | Unique relationship IDs sorted by contributor then numeric requirement index. |
| ER-16 | `CommitmentEvidenceAttribution` | EO-21, EO-24 | Immutable evidence/contributor identity; confirmed follows current Fulfilled state. |
| ER-17 | `CommitmentEvidenceAttributionIndex` | EO-21 | Unique sorted IDs; bounded direct lookup only. |
| ER-18 | `CommitmentClaimRequest` | EO-14, EO-24 | `requestSeen`, nullable Request payload, and per-row lifecycle cursor; decline-first and commitment-terminal delivery never revive behind a winning marker. |
| ER-19 | `CommitmentClaimRequestIndex` | EO-14 | Unique claimant-key IDs sorted lexicographically; sweep semantics do not depend on insertion order. |
| ER-20 | `CommitmentEvent` | all 54 events | Immutable `chainId-txHash-logIndex` audit guard. |
| ER-21 | `CommitmentPendingLifecycleProjection` | EO-10, EO-23–24 | Typed event payload; same ID as audit event; applied once. |
| ER-22 | `CommitmentPendingLifecycleProjectionIndex` | EO-10, EO-23–24 | Unique IDs drained by stored position, never insertion order. |
| ER-23 | `NeedCommitmentIndex` | EO-10, EO-24, bundle creation | Unique sorted composite relationship IDs; Fulfilled membership follows current terminal result. |
| ER-24 | `CommitmentCounterIndex` | EO-10 | Unique sorted reverse references; immutable after creation. |
| ER-25 | `CommitmentExchange` | EO-15 | Immutable emitted A/B ordering and acceptors. |
| ER-26 | `PoolMemberHistory` | EO-14, EO-18, EO-23–24 | Event-owned actor counts plus reversible terminal lead outcome and once-only frozen participant outcome. |
| ER-27 | Garden relationships (`gardenId`, `providerGardenId`, `gardenContextId`) | emitted addresses | Existing normalized bare-address `Garden.id`; never migrated to a composite key. |
| ER-28 | Pool/cycle/series/commitment relationship fields and arrays | owning entity events | Composite IDs for new entities; every set-like array is unique and deterministically sorted, while semantically ordered pending projections sort by event position. |

### A3. Sparse-event materialization ledger

Every event that may arrive before the event supplying its base row has one representable strategy.
Nullable payload means actual absence; no handler invents an enum, address, raw ID, timestamp, or
empty-string identity. Ordinary queries exclude a row whose base-event seen flag is false.

| ID | Base entity | Sparse events delivered first | Representation before base event | Base-event merge proof |
|---|---|---|---|---|
| PM-01 | `CommitmentPool` | charter, cap, or pool lifecycle before `PoolRegistered` | `registrationSeen = false`; registration-only facts null; supplied mutable field/cursor retained | registration fills identity and cannot regress charter/cap/lifecycle |
| PM-02 | `CommitmentCycle` | cycle lifecycle before `CycleSeeded` | `seedSeen = false`; seed-only facts null; supplied pool/lifecycle/snapshot facts retained | seed fills immutable facts and cannot reopen a newer terminal cycle |
| PM-03 | `CommitmentSeries` | metadata, Rest/Resume/Retire, or linked instance before `CommitmentSeriesCreated` | `creationSeen = false`; base facts null; lifecycle and metadata cursor pairs independently nullable | creation fills base facts and initializes only cursor-absent fields |
| PM-04 | `Commitment` | reward/value/rule update before `CommitmentCreated`; state-derived lifecycle event before creation | `creationSeen = false` with nullable creation-only fields for independent updates; state-derived events use the typed pending index | creation fills base facts, then drains pending lifecycle projections in position order |
| PM-05 | `CommitmentClaimRequest` | `ClaimDeclined` before `ClaimRequested` | `requestSeen = false`; request payload null; terminal decline cursor/reason retained and indexed | older Request fills payload without revival; newer post-decline Request may become Pending |
| PM-06 | `CommitmentContributor` | Remove or Work decision before Add | `additionSeen = false`; Add actor/time null; membership/credit facts retained | Add fills audit facts without regressing the winning membership cursor |
| PM-07 | `CommitmentWorkAttribution` | Unlink or approval decision before Link | `linkSeen = false`; Link-only payload null; supplied link/decision cursor retained | Link fills immutable payload without regressing a newer unlink/decision |
| PM-08 | Remaining ER rows | owning event before related parent entity | owning event carries the complete row identity/payload, or EO-23/24 uses the typed pending lifecycle buffer | parent arrival changes only relationship availability, never row identity or outcome |

---

## Matrix B — Retry and idempotency

### B1. Complete Commitment Pooling ABI classification

The canonical `ICommitmentPoolingModule` interface contains **86 functions**. Every function is
classified exactly once. “No hi-fi surface” is an explicit product boundary, not silent omission.

| Class | Functions |
|---|---|
| Hi-fi executable now | `setPoolCharter`, `setProviderOpenCommitmentCap`, `markPoolReady`, `openPool`, `pausePool`, `resumePool`, `closePool`, `compostPool`, `reopenPool`, `seedCycle`, `openCycle`, `closeCycle`, `compostCycle`, `cancelCycle`, `createCommitmentSeries`, `updateCommitmentSeriesMetadata`, `restCommitmentSeries`, `resumeCommitmentSeries`, `retireCommitmentSeries`, `createCommitment`, `setDeclaredValue`, `claimCommitment`, `acceptClaim`, `declineClaim`, `joinCommitment`, `leaveCommitment`, `addContributor`, `removeContributor`, `setContributorRequirement`, `linkWork`, `attachEvidence`, `attachAssessment`, `submitForConfirmation`, `markReadyForConfirmation`, `confirmFulfillment`, `confirmFulfillmentAsFallback`, `cancelCommitment`, `expireCommitment`, `raiseDispute`, `resolveDispute`, `recordRewardPaid` |
| Planned app surface, not current hi-fi | `acceptExchange` |
| Explicit operator action with no current hi-fi surface | `setDeclaredReward`, `setConfirmerRule`, `unlinkWork`, `syncWorkDecisions` |
| System, deployment, or governance only | `onGardenMinted`, `registerPool`, `onWorkDecision`, `initialize`, `setGardenToken`, `setHatsModule`, `setActionRegistry`, `setCommitmentRegistry`, `setWorkApprovalResolver`, `setEAS`, `setSchemaUIDs`, `setPaused` |
| Read-only or pure | `getCommitmentIdByCreationRequest`, `getWorkLinkOperationPayloadHash`, `validateRecognitionSnapshot`, `getPool`, `getPoolByGarden`, `getCycle`, `getCommitmentSeries`, `getCommitmentSeriesIdByCreationRequest`, `getCommitment`, `getRequirement`, `getContributor`, `isContributor`, `isEligibleContributor`, `getPendingClaim`, `getConfirmers`, `protocolPoolId`, `rootGarden`, `workCommitmentOf`, `getLinkedWorkUIDs`, `isApprovalCounted`, `isEvidenceAttached`, `MAX_CONFIRMERS`, `MAX_REQUIREMENTS`, `MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT`, `MAX_CONTRIBUTORS_PER_COMMITMENT`, `MAX_LINKED_WORKS_PER_COMMITMENT`, `cyclelessRecognitionPolicy`, `paused` |

### B2. Retry policies

| ID | Transaction or operation | Lane | Durable identity before first send | Recovery before retry | Automatic rebroadcast |
|---|---|---|---|---|---|
| RI-01 | Create ongoing Offer series | offline `commitmentSeries` | private `clientSeriesId` plus derived `creationRequestKey`; contract stores payload hash and resulting series ID | read holder/key mapping; bind only after pool, holder, garden, and initial payload hash match | yes, with the same key only |
| RI-02 | Create one Offer or Request, including a series place | offline `commitment` | private `clientCommitmentId` plus derived `creationRequestKey`; contract stores payload hash and resulting commitment ID | read creator/key mapping; bind only after the complete immutable creation payload matches | yes, with the same key only |
| RI-03 | Claim a commitment | offline `claim` | natural key `(commitmentId, canonical claimant)` plus exact kind/context payload | ApprovalGated: read active pending terms; Open/terminal: read accepted claimant/counterparty/lead. Exact applied state completes; conflicting claimant or terms stops | yes only when no exact pending/accepted result exists |
| RI-04 | Attach evidence | offline `evidence` | local evidence job ID, deterministic serialized-content digest, persisted CID, and exact credited-contributor vector | resolve/recover CID first; read `evidenceAttached(commitmentId, cidHash)`. Exact existing attachment completes | yes with the same CID/vector only |
| RI-05 | Link Work | offline `workLink` | private operation key persisted with commitment/work/requirement payload | read operation result or immutable replay mapping. Exact applied or later superseding unlink completes without relinking; conflict stops | yes with the same operation key only |
| RI-06 | Submit for confirmation | offline `confirmation` subtype `submit` | natural `(commitmentId, submit)` key in the job store | Ready/terminal state completes; still eligible Accepted/evidence state may send | yes after read-through |
| RI-07 | Ordinary fulfillment confirmation | offline `confirmation` subtype `confirm` | natural `(commitmentId, confirmer)` key | `hasConfirmed` or terminal Fulfilled completes; contributor/ineligible/conflicting terminal state stops | yes after read-through |
| RI-08 | Saved Offer create/update | authenticated remote `PUT` | `savedOfferId`, canonical payload, `expectedVersion`, request hash | `GET` exact owner record; matching payload/version completes, `409` enters conflict, absence permits create at version 0 | yes only after connectivity/auth and version read |
| RI-09 | Saved Offer delete | authenticated remote `DELETE` | `savedOfferId`, `expectedVersion` | tombstone/current version read; matching tombstone completes, conflict requires user choice | yes after read-through |
| RI-10 | Series metadata, Rest, Resume, Retire | online wallet mutation | no background job | re-read series target state/metadata; exact target is success, incompatible newer state stops | no automatic retry |
| RI-11 | Pool and cycle lifecycle/configuration | online steward mutation | no background job | re-read current state and exact charter/cap/snapshot; exact target is success, stale target returns to review | no automatic retry |
| RI-12 | Accept/decline claim or planned paired exchange | online steward/creator mutation | canonical claimant or immutable exchange pair | re-read request/commitments; exact terminal outcome is success, newer outcome disables action; paired acceptance never retries after either side is already Accepted | no automatic retry |
| RI-13 | Join/leave/add/remove/assign contributor | online participant/lead mutation | target contributor/relationship | re-read cursor-correct target state; exact target is success, frozen/newer target stops | no automatic retry |
| RI-14 | Assessment, Ready override, cancellation, expiry, dispute, dispute resolution | online mutation | target commitment and entered reason/UID | re-read current lifecycle and immutable result; exact result is success, incompatible newer state stops | no automatic retry |
| RI-15 | Fallback confirmation and external reward receipt | online steward mutation | commitment plus reason or payout reference | re-read fulfillment/payout result; exact authenticated result is success | no automatic retry |
| RI-16 | Celo wallet `transfer` | online wallet action | wallet transaction only | transaction/receipt lookup; a failed or unknown attempt is explained before the person authorizes a new send | never |
| RI-17 | Settlement command/batch retry | existing settlement recovery | immutable execution key and payload | same-key command lookup; never create a second Celo execution | yes with same key |
| RI-18 | Settlement acknowledgment retry | existing settlement recovery | stored execution outcome | destination reads stored outcome; never move G$ again | yes with stored outcome |
| RI-19 | Settlement requeue/new logical attempt | online authority-gated | new attempt ID allowed only after authenticated failure | read prior terminal failure and preserve lineage | no hidden retry; explicit new attempt |
| RI-20 | Payout plan parent/child recovery | online authority-gated | stable plan ID; child identity per contributor | retry only the failed vector/child; never recreate the parent | explicit targeted retry |
| RI-21 | Pre-acceptance term edits and Work correction | online steward mutation | target commitment/Work plus exact new term or current resolver decision | re-read the cursor-winning value/reward/rule/link/decision; exact target is success and a newer conflicting target returns to review | no automatic retry |

### B3. Executable-call coverage

Every call name emitted by the hi-fi registry belongs to one RI policy. Calls in a family inherit
that row's recovery rule; this table prevents a new visible mutation from bypassing the matrix.

| RI policy | Executable calls |
|---|---|
| RI-01 | `createCommitmentSeries` |
| RI-02 | `createCommitment` |
| RI-21 | `setDeclaredValue` |
| RI-03 | `claimCommitment` |
| RI-04 | `attachEvidence` |
| RI-05 | `linkWork` |
| RI-06, RI-07 | `submitForConfirmation`, `confirmFulfillment` |
| RI-10 | `updateCommitmentSeriesMetadata`, `restCommitmentSeries`, `resumeCommitmentSeries`, `retireCommitmentSeries` |
| RI-11 | `setPoolCharter`, `setProviderOpenCommitmentCap`, `markPoolReady`, `openPool`, `pausePool`, `resumePool`, `closePool`, `compostPool`, `reopenPool`, `seedCycle`, `openCycle`, `closeCycle`, `compostCycle`, `cancelCycle` |
| RI-12 | `acceptClaim`, `declineClaim` |
| RI-13 | `joinCommitment`, `leaveCommitment`, `addContributor`, `removeContributor`, `setContributorRequirement` |
| RI-14 | `attachAssessment`, `markReadyForConfirmation`, `cancelCommitment`, `expireCommitment`, `raiseDispute`, `resolveDispute` |
| RI-15 | `confirmFulfillmentAsFallback`, `recordRewardPaid` |
| RI-17–RI-19 | `registerSettlementAccount`, `requeue`, `queueFunding`, `createBatch`, `dispatchDisbursement`, `dispatchBatch`, `retryCommand`, `retryBatchCommand`, `retryAcknowledgment`, `cancelBatch`, `cancelDisbursement` |
| RI-20 | `createCommitmentPayoutPlan`, `setContributorPayouts`, `finalizeCommitmentPayoutPlan`, `prepareContributorPayout` |

---

## Matrix C — Persistence truth states

### C1. Canonical state vocabulary

| State | Durable location | Allowed user claim | Forbidden claim | Exit |
|---|---|---|---|---|
| `LOCAL_DRAFT` | IndexedDB on this browser/device | “Draft on this device” | Saved, synced, cross-device, backed up | edit, discard, or begin remote save |
| `SAVING_REMOTE` | local draft plus in-flight authenticated request | “Saving privately…” | Saved or available on another device | confirmed remote response, failure, or offline interruption |
| `SAVED_REMOTE` | authenticated Agent store; optional local cache | “Saved privately to your account” and cross-device durability | on-chain, offered, available, or public | update, delete, or explicitly use for an Offer |
| `SAVE_FAILED` | local draft retained with typed remote error | “Still a draft on this device” | Saved, synced, or portable | retry after connectivity/auth, keep editing, or discard |
| `OFFLINE_LOCAL` | IndexedDB only; no remote write attempted or confirmed | “No signal; this stays on this device” | queued remote save or cross-device durability | reconnect, then enter `SAVING_REMOTE` |
| `VERSION_CONFLICT` | local draft plus newer remote version | “A newer saved version exists” | silently overwritten or merged | reload remote, copy local changes, or explicitly overwrite from current version |

### C2. Object-by-state behavior

| ID | Object | Local draft | Saving/queued | Confirmed durable state | Failed/offline behavior |
|---|---|---|---|---|---|
| PT-01 | Saved Offer metadata | editable `LOCAL_DRAFT`; no garden/pool/series/commitment identity | authenticated `SAVING_REMOTE`; no offline job kind | `SAVED_REMOTE` only after successful Agent response and version capture | `SAVE_FAILED`/`OFFLINE_LOCAL` retain the draft and never route to a Saved view |
| PT-02 | Ongoing Offer series draft | local W33 draft references a saved Offer optionally | `commitmentSeries` job persists key before send; `waiting_for_hat` and dependency states consume no retry | indexed/validated on-chain series ID, state Active/Resting/Retired | failed/discarded series keeps dependent place drafts repairable |
| PT-03 | Commitment/place draft | local payload includes stable `clientCommitmentId` and creation key | queued/sending/waiting-for-series/waiting-for-hat | indexed/validated commitment ID; Offered availability only after capacity reservation sync | failure retains payload; retry uses same key; discard removes only the local draft |
| PT-04 | Evidence attachment | serialized note/link/media plus exact attribution vector | upload and chain-send phases retain content digest/CID | indexed `EvidenceAttached` row | failure/offline retains media and attribution; never displays attached |
| PT-05 | Work link | local selected Work and exact requirement index | linking job with stable operation key | indexed current link state | failure keeps Work unchanged and preserves selection; later unlink supersedes stale retry |
| PT-06 | Claim | local exact kind/context | queued; optimistic row is explicitly pending sync | indexed Pending or Accepted outcome | queue failure is distinct from Declined/Superseded; no stale action survives acceptance/terminal state |
| PT-07 | Confirmation | local intent only | queued ordinary submit/confirm; no fallback job | indexed Ready/confirmation/Fulfilled result | optimism reverts; entered online fallback/dispute reason is retained locally for explicit retry |

### C3. Required executable prototype states

W32 must render `draft-unsaved`, `saving`, `save-failed`, `saved`, `read-error`, and the existing
empty/compose/path states. `w32.save` and `w32.save-draft` enter `saving`; only the confirmed remote
result enters `saved`. SB-38 must remain visibly unsaved throughout its no-signal portion.

W33/W35 must keep queued, membership-wait, dependency-wait, partial-send, failed, repair, discard,
and synced states distinct. A failed W35 place retry uses RI-02 and may never blindly call a new
unkeyed `createCommitment`.

---

## Matrix D — Lifecycle closure and safe wind-down

| ID | Subject | Live/open definition | Entry guard | Terminal/closure guard | Required wind-down while paused/non-open |
|---|---|---|---|---|---|
| LC-01 | Pool | every non-terminal commitment in the pool, including cycle-less Offered/Requested and every cycle-bound live state | creation/claim/readiness/ordinary confirmation require the documented pool state | `closePool` requires `Pool.liveCommitmentCount == 0` and no Open/Seeded/Reconciled cycle awaiting its own terminal act; Composted follows Closed | browse, evidence/linkage where still legal, cancel, expire, dispute, and resolution remain available; the admin lists every blocker |
| LC-02 | Cycle | every non-terminal commitment with this non-zero cycle ID | Seed while Ready/Open; Open from Seeded with valid snapshots and Season cardinality | close/cancel require `Cycle.liveCommitmentCount == 0`; compost requires Reconciled | safe-wind-down actions do not resume a Paused pool |
| LC-03 | Series | Active/Resting series plus all linked instances, whose lifecycles remain independent | create in Ready/Open; add places only Active + pool Open | Retired blocks new places but never terminates or hides existing instances | existing Offered/Accepted instances remain discoverable/actionable until their own terminal state |
| LC-04 | Commitment | Offered/Requested/Accepted/ReadyForConfirmation/Disputed are live; derived Active/EvidenceSubmitted/PartiallyApproved map to Accepted | complete creation/eligibility/capacity checks before mutation | Fulfilled/Cancelled/Expired are terminal; dispute restoration reverses/reapplies live counts exactly once | cancellation/expiry/dispute paths remain; a cycle-less due-date-less commitment requires explicit cancellation before pool closure |
| LC-05 | Claim request | `PENDING` while the parent remains claimable | one active request per canonical claimant and exact stored terms | Accepted/Declined/Superseded are terminal attempts; a fresh post-decline request is a later event | acceptance/cancel/expiry supersedes every current or late-arriving older request |
| LC-06 | Capacity | Offered Offers and Accepted Offers/Requests hold full class units and one lead-provider slot | cap checked only on a new reservation | Fulfill converts; cancel/expire release; no second acceptance commit and no double release | pool/cycle/series state changes never silently release, recreate, or hide capacity |
| LC-07 | Contributors | current cursor-correct active roster before freeze | eligibility/policy/cap/credit gates precede mutation | roster and credit ledger freeze before Ready/Fulfilled; terminal history waits for exact frozen rows | safe wind-down may finish evidence/work/dispute as allowed; no add/remove/assignment after freeze |

### D1. Pool live-count contract

`Pool.liveCommitmentCount` is independent from provider exposure and from every individual
`Cycle.liveCommitmentCount`. Every successful commitment creation increments the pool count,
including an unaccepted Request and a cycle-less commitment. The same cursor-ordered lifecycle
helper that owns cycle live counts decrements the pool count on the first live-to-terminal
Fulfilled/Cancelled/Expired transition, re-increments Expired-to-Disputed, and decrements again on
the replacement terminal result. Creation-time pending-projection drain exposes no intermediate
count. `closePool` reads this O(1) value and reverts before state mutation when it is non-zero.

The admin close control reads the exact indexed pool count. A non-zero value renders a blocker
list and wind-down links, not an enabled confirmation. The member client never receives a
pool-closed state containing live Offered or Accepted rows because the contract makes that state
unreachable.

---

## Future full-pool compatibility gate

This gate freezes adaptability without adding future voucher behavior to Matrices A–D or their
current counts:

| Boundary | Initial implementation invariant | Future layer obligation |
|---|---|---|
| Promise instance | registry `classId == commitmentId`; immutable, non-transferable authority | consume eligible facts without transferring or rewriting the promise |
| Ongoing Offer | `commitmentSeriesId` groups pool-scoped instances and Story | reference as issuer context only; never turn the series into a token |
| Voucher instrument | absent from the initial ABI/storage | own a separate `voucherClassId`, version, issuer, backing mode, supply cap, and redemption terms |
| Adapter seam | Pool reserves one zero `settlementAdapter` address and disabled flag | resolve a versioned adapter/router; never silently bind one forever-fixed token |
| First backing mode | fulfilled balances are authoritative; committed balances are not mint authority | prevent double consumption of fulfilled backing |
| Capacity backing | unavailable | remain disabled until consent, issuance, exposure, default, repair, legal, audit, and liquidity rules close |
| G$ | separate support/settlement command and acknowledgment rail | never call support payout “voucher redemption” without explicit voucher terms |
| Expansion order | no venue or federation | prove one bounded pool's seed, exchange in/out, redemption, and repair before federation |

Any future voucher implementation must create its own complete event, entity, retry, persistence,
lifecycle, custody, redemption, and wind-down matrices. It may not alter the current **54 events**,
**86 module functions**, **56 executable calls**, or other Matrix A–D counts until a separately
reviewed implementation amendment deliberately promotes the new surface.

---

## Closure gate

The architecture is closed only when:

1. all 54 ABI events appear exactly once in Matrix A and every indexed entity/relationship has an
   ER row;
2. all 86 `ICommitmentPoolingModule` functions are classified exactly once, every one of the 56
   executable hi-fi calls has an RI policy, and all six offline job kinds are covered;
3. all eight sparse-event materialization rows have explicit seen/null/fill semantics and
   reverse-delivery proof;
4. Saved appears only after confirmed remote persistence and the W32/SB-38 states match Matrix C;
5. all seven lifecycle subjects have an LC row and pool/cycle zero-live guards are represented in
   contract, indexer, shared-state, admin, and client artifacts;
6. `bun .plans/active/commitment-pooling/architecture-closure.validate.ts` passes;
7. the normal prototype, visual, ontology, format, and repo verification gates pass; and
8. one final adversarial PR review reports no unresolved blocker or major finding against these
   matrices; and
9. the future full-pool compatibility gate above remains explicit in the contract, series,
   exchange, evidence, diagram, Plan Hub, and Linear sources without adding voucher code to the
   initial implementation lane.
