# Offers Over Time: Durable Series and Repeatable Fulfillment

**Feature Slug**: `commitment-pooling`
**Status**: SCOPE LOCKED
**Locked**: 2026-08-02
**Owner**: Commitment Pooling architecture
**Companions**: `contract-spec.md`, `uiux-spec.md`, `acceptance-matrix.md`,
`plan.todo.md`, `status.json`, `pilot-evidence-spec.md`

This specification is the canonical architecture record for Offers used once or over time inside
Commitment Pooling. It resolves the durable-identity gap identified in the private Fable
exploration
[The practice that remains](https://claude.ai/code/artifact/998342dd-6dd2-4677-a7a3-e429e28cd9cc):
the existing `Commitment` is a strong one-time fulfillment record, but no durable identity exists
when a person chooses to make the same Offer available repeatedly across claims and cycles.

The exploration is design evidence, not implementation authority. This file and its companion
specifications own the locked model.

## 1. Outcome

A gardener may describe an Offer and choose either **Offer once** or **Offer over time**. An
ongoing Offer belongs to one pool, may expose a finite number of places, fulfills those places as
ordinary immutable Commitments, may rest without losing its history, and can return in a later
cycle without recreating its internal identity.

The architecture separates four facts without introducing another product noun:

1. **Offer**: something a person is ready to provide, used once or over time.
2. **Ongoing Offer identity**: the internal `CommitmentSeries` for one Offer used over time in one
   pool.
3. **Availability**: the finite set of ordinary Offer instances genuinely available now.
4. **Commitment instance**: one claimant, one exact set of terms, and one independent lifecycle.

The durable identity compounds memory. It does not create a transferable labor asset, automatic
renewal, personal score, rolling unit balance, or cross-pool reputation.

## 2. Locked vocabulary and authority

| Term | Meaning | Authority |
|---|---|---|
| **Offer once** | Create one ordinary Offer; no durable series identity | existing `Commitment` path with `commitmentSeriesId == 0` |
| **Offer over time** | Use an Offer repeatedly in one pool; user-facing behavior, not a new object | internal pool-scoped `CommitmentSeries` |
| **Saved Offer metadata** | Private signed offchain data that may prefill either Offer path; not a protocol object, obligation, credential, or public identity | signed offchain profile data; only unsaved drafts may remain local |
| **Availability** | Number of unclaimed Offered instances whose provider capacity is already reserved | derived from canonical Commitment and registry state |
| **Commitment** | One immutable fulfillment instance | existing module and registry lifecycle |
| **Story** | Linked instance history and absolute counts for one series | indexed read model |
| **Pool participation history** | Existing per-member `PoolMemberHistory` context | indexed read model; replaces the ambiguous product phrase “counts-only standing” |
| **Lineage** | Future consent-based handover or fork relationships | reserved follow-on series events; never inferred |

One saved Offer may be used once, used over time, or reused as input for separate ongoing Offers
in more than one pool. Every pool gets its own `CommitmentSeries` and independent Story. The
protocol never merges series across pools or creates a cross-pool Offer identity.

“I’m learning this” is not a Commitment Pooling Offer state in the initial scope. A future general
profile may describe learning or capability, but that information is not a `CommitmentSeries` and
does not enter this product flow.

## 3. Initial-deploy contract

### 3.1 Module-owned series

The initial `CommitmentPoolingModule` adds:

```solidity
enum CommitmentSeriesState { None, Active, Resting, Retired }

struct CommitmentSeries {
    uint256 poolId;
    address createdBy;
    address currentHolder;
    CommitmentSeriesState state;
    string metadataCID;
    bytes32 creationPayloadHash;
}
```

Storage adds `nextCommitmentSeriesId`,
`mapping(uint256 seriesId => CommitmentSeries) commitmentSeries`, and
`mapping(address holder => mapping(bytes32 creationRequestKey => uint256 seriesId))
seriesIdByCreationRequest`. The last mapping is the sender-compatible idempotency boundary.

The initial functions are:

```solidity
function createCommitmentSeries(
    uint256 poolId,
    bytes32 creationRequestKey,
    string calldata metadataCID
) external returns (uint256 seriesId);

function updateCommitmentSeriesMetadata(
    uint256 seriesId,
    string calldata metadataCID
) external;

function restCommitmentSeries(uint256 seriesId) external;
function resumeCommitmentSeries(uint256 seriesId) external;
function retireCommitmentSeries(uint256 seriesId) external;
```

The initial events are:

```solidity
event CommitmentSeriesCreated(
    uint256 indexed seriesId,
    uint256 indexed poolId,
    address indexed holder,
    string metadataCID
);
event CommitmentSeriesMetadataUpdated(uint256 indexed seriesId, string metadataCID);
event CommitmentSeriesRested(uint256 indexed seriesId);
event CommitmentSeriesResumed(uint256 indexed seriesId);
event CommitmentSeriesRetired(uint256 indexed seriesId);
```

Series IDs start at 1. `0` is the one-shot sentinel everywhere.

`clientSeriesId` remains private local dependency state. Before the job's first send, shared
derives a public-safe key as
`keccak256(abi.encode("green-goods.commitment-series.v1", chainId, moduleAddress, holder,
clientSeriesId))`; only that `bytes32 creationRequestKey` enters calldata. The contract scopes the
key again by `msg.sender`. First use stores the new series ID and the immutable
`creationPayloadHash = keccak256(abi.encode(poolId, keccak256(bytes(metadataCID))))`. An exact
replay returns that existing ID without incrementing `nextCommitmentSeriesId`, mutating state, or
emitting a second event. Reusing the same holder/key with a different creation payload reverts
`SeriesCreationRequestConflict`; zero key reverts `InvalidSeriesCreationRequestKey`.

This is the replay boundary because the supported wallet, embedded, and passkey
`TransactionSender` implementations expose a hash only after submission. They cannot promise
pre-broadcast signed bytes. After restart, shared reads
`getCommitmentSeriesIdByCreationRequest(holder, creationRequestKey)`: a non-zero result binds the
local job immediately, while zero permits a fresh send using the same key. If an earlier
transaction is merely pending, both submissions remain safe because only the first mined call
creates or emits the series.

### 3.2 Creation and lifecycle rules

- Series creation is direct-holder only in the initial version. The caller becomes immutable
  `createdBy` and initial `currentHolder`.
- The caller must be a current member of the series pool's garden.
- The pool must exist and be `Ready` or `Open`; paused, closed, and composted pools reject.
- `metadataCID` must be non-empty.
- Metadata may change while Active or Resting. Retired series are immutable.
- Active may become Resting or Retired. Resting may become Active or Retired. Retired is terminal.
- Resting or retiring a series never changes, cancels, transfers, or rewrites an existing
  Commitment instance.
- No steward-recorded series, co-holder, apprenticeship, handover, community-held series, or fork
  is introduced in the initial ABI. Those verbs require their own consent events in the follow-on
  series slice.

The struct uses both `createdBy` and `currentHolder` now so a later two-step handover does not
redefine historical authorship. No initial function changes `currentHolder`.

### 3.3 Commitment relationship

`Commitment`, `CreateCommitmentParams`, and `CommitmentCreated` gain
`uint256 commitmentSeriesId`.

- `commitmentSeriesId == 0` preserves the existing one-shot path.
- A non-zero reference must resolve to an existing series in the same pool.
- The series must be Active.
- The Commitment must be an Offer with `ClaimType.Individual`.
- The resolved Commitment creator and `msg.sender` must both equal `currentHolder`.
- A steward-recorded `onBehalfOf` creation cannot attach to a series in the initial version.
- Every other Commitment field remains instance-owned. The series does not supply hidden defaults
  to the contract.
- Revising series metadata changes no prior or open instance. New Commitment creation snapshots
  its own current terms as before.

Required named errors:

```solidity
error UnknownCommitmentSeries(uint256 seriesId);
error CommitmentSeriesPoolMismatch(uint256 seriesId, uint256 expectedPoolId, uint256 actualPoolId);
error CommitmentSeriesNotActive(uint256 seriesId);
error CommitmentSeriesHolderOnly(uint256 seriesId, address caller);
error CommitmentSeriesOfferOnly(uint256 seriesId);
error CommitmentSeriesIndividualOnly(uint256 seriesId);
error InvalidCommitmentSeriesState(uint256 seriesId, CommitmentSeriesState state);
```

An arbitrary or indexer-invented series ID is never accepted. A field-only deployment with no
canonical series authority is explicitly rejected.

## 4. Honest availability and provider capacity

The current frozen register acquires a provider slot when a commitment is accepted. That is not
truthful enough for an ongoing Offer: two displayed places can otherwise compete for one remaining
provider slot and fail only when claimed.

The initial-deploy accounting therefore changes asymmetrically by direction:

- **Offer**: the creator is already the accountable lead. `createCommitment` registers the class
  and immediately calls `commitUnits` for the full quota. The provider slot is reserved while the
  Commitment is Offered and remains reserved when it becomes Accepted.
- **Request**: the provider is unknown at creation. The class stays Registered and acquires its
  units plus provider slot only when the Request is accepted, as previously planned.
- **Offer acceptance**: validates that the class is already Committed and does not call
  `commitUnits` or increment provider exposure again.
- **Offer cancellation or expiry before acceptance**: releases the full units and provider slot.
- **Accepted terminal outcomes**: preserve the existing single-shot release or fulfill path.
- **Request cancellation or expiry before acceptance**: has no registry effect because no provider
  capacity was acquired.

The register's `Committed` state means “provider capacity reserved,” not “a claimant has accepted.”
`providerOpenCommitmentCount` therefore counts every non-terminal provider obligation:
Offered Offers plus Accepted Offers and Accepted Requests with a resolved provider and committed
capacity. It still never counts unaccepted Requests or contributors.

For atomic bilateral `acceptExchange`, both Offered classes are already Committed. The function
verifies both exact full reservations plus the providers, memberships, cycles, and identities, but
performs no second registry commit, consumes no second provider slot, and does not reapply
provider-cap headroom. Provider caps are checked only when `commitUnits` reserves a new slot, so a
later cap reduction cannot strand an existing Offer. Both acceptance transitions and the marker
event remain atomic.

This is still the existing non-transferable, full-quota, one-shot accounting model. There is no
partial claim, reservation token, rolling series balance, or arithmetic across Commitment units.
Two available workshop places are two ordinary Offer instances, each with its own exact terms and
full terminal lifecycle.

## 5. Indexed read model

The initial indexer adds:

### `CommitmentSeries`

- composite ID `chainId-seriesId`
- `chainId`, `seriesId`, `poolId`, `poolEntityId`
- `createdBy`, `currentHolder`
- `state`, `metadataCID`
- `instanceCount`
- current outcome counts: `offeredCount`, `acceptedCount`, `readyCount`, `fulfilledCount`,
  `cancelledCount`, `expiredCount`, `disputedCount`
- `fulfilledCycleIds` as unique composite cycle IDs
- cursor fields for the latest series mutation
- `createdAt`, `updatedAt`

### `CommitmentSeriesCycleSummary`

- composite ID `chainId-seriesId-cycleId`
- series and cycle relationship fields
- the same current outcome counts for that series inside that cycle
- no unit totals across unlike labels
- no rate, rank, grade, comparison, or funding-order field

`Commitment` gains nullable `commitmentSeriesId` and `commitmentSeriesEntityId`. Series-linked
creation increments instance and current-state counts once. The existing cursor-ordered lifecycle
projection helper applies the same reversible current-outcome deltas to the series and series-cycle
rows, including Expired to Disputed to RestorePrevious or Cancelled.

Fulfilled instances are terminal, so `fulfilledCycleIds` appends a cycle once when its first
series instance becomes Fulfilled. Cycle ID `0` never enters that list.

The Story may say “kept 12 times across 5 cycles” because both values are exact event-derived
facts. A participant count is not derivable from the current protocol. UI may show only a clearly
labelled reported participant count sourced from evidence or assessment data; it may not silently
present that value as an indexed protocol fact.

Raw series events remain public onchain facts. Product disclosure is pool-scoped:

- holder and current pool stewards may inspect instance-level Story rows;
- pool members may see currently available series Offers in their pool;
- editorial/public surfaces receive separately approved pool-level aggregates only;
- no cross-pool series merge exists.

## 6. Shared state and offline jobs

The shared layer adds canonical series types, query keys, selectors, and mutations. Saved Offer
metadata is a separate signed offchain concern and never becomes a contract type.

The offline queue gains a sixth pooling job kind, `commitmentSeries`. A local series draft owns a
stable `clientSeriesId`. A queued Commitment may refer to either an onchain series ID or a
`clientSeriesId`; when the local series job has not yet produced its receipt-derived onchain ID,
the Commitment job waits without consuming retry budget. After the series receipt is indexed, the
runner materializes the onchain ID and submits the ordinary Commitment payload.

Series submission has one additional durable boundary. The queued payload persists
`clientSeriesId` and its deterministically derived `creationRequestKey` before the first send.
Restart recovery reads `getCommitmentSeriesIdByCreationRequest` before retrying. A non-zero result
binds the local job to that onchain ID even if the process stopped after broadcast but before hash
or receipt persistence; zero permits another ordinary `TransactionSender` call with the same key.
Contract idempotency makes overlapping or repeated wallet/UserOperation submissions converge on
one series. A mined receipt or successful read-through binds `clientSeriesId` before dependent
Commitment jobs resume. Tests cover process stop after broadcast, a still-pending first
submission, exact replay, key/payload conflict, and one-event/one-series convergence.

This dependency and contract-idempotent recovery are explicit queue states, not guessed
transaction ordering or an indexer-side join. Discarding a failed local series job keeps its
dependent Commitment drafts recoverable and explains why they are waiting.

The signed offchain model stores reusable Offer metadata and explicit references to any
pool-scoped series created from it. Unsaved edits may remain in IndexedDB. Saved Offer metadata
must use signed offchain persistence so it survives device changes. It defaults private; using it
to create a one-time Offer or an ongoing Offer in a pool is always explicit.

### 6.1 Signed saved-Offer persistence contract

“Saved” means owner-authenticated cross-device storage, not a browser-local draft. The service
boundary follows the existing profile-avatar pattern but is private and encrypted:

- `packages/shared` owns `SavedOfferPayloadV1`, record/error types, canonical auth-message
  builders, validators, query keys, and a typed API adapter. Hooks remain in
  `@green-goods/shared`.
- `packages/agent` owns the Hono routes, wallet-signature verification, short-lived sessions, and
  encrypted compare-and-swap store. Its persistence key is
  `(chainId, normalizedOwnerAddress, savedOfferId)`.
- `packages/client` consumes the shared adapter and may cache decrypted owner-visible records in
  IndexedDB. A local-only record is an **unsaved draft** and may not display Saved or Synced.

The versioned plaintext before encryption is:

```ts
type SavedOfferPayloadV1 = {
  schemaVersion: 1;
  savedOfferId: string; // client-generated UUID
  title: string;
  description: string;
  commitmentKind: "DomainImpact" | "SupportService";
  unitLabel: string;
  targetUnits: string; // canonical base-10 uint256 text
  claimMode: "Open" | "ApprovalGated";
  domainTags: string[];
  requirements: Array<{
    actionId: string;
    requiredCount: number;
    note?: string;
  }>;
  seriesLinks: Array<{
    chainId: number;
    poolId: string;
    commitmentSeriesId: string;
  }>;
};
```

Pool, cycle, claimant, due-date, reward-payment, confirmer, availability, and active Commitment
state are deliberately absent. They are chosen or validated when the owner explicitly creates an
Offer. `seriesLinks` are convenience references only; the module remains authoritative for series
holder, lifecycle, pool, and linked instances. A payload is rejected unless it is canonical JSON,
at most 32 KiB, uses unique normalized tags, has no more than `MAX_REQUIREMENTS` requirements, and
has no more than 32 unique series links.

The private API is:

| Method and route | Contract |
|---|---|
| `POST /public/saved-offers/session/challenge` | Accepts `chainId` and normalized owner address; returns a cryptographically random, single-use nonce with a five-minute expiry and the service audience. |
| `POST /public/saved-offers/session` | Verifies the canonical `Green Goods Saved Offers Session` message over version, chain ID, owner, nonce, audience, and issued-at; returns an opaque owner-scoped bearer session with a fifteen-minute expiry. |
| `GET /public/saved-offers` | Lists the authenticated owner's non-deleted records as `{ savedOfferId, payload, version, updatedAt }`; no address query parameter may select another owner. |
| `GET /public/saved-offers/:savedOfferId` | Reads one non-deleted record owned by the authenticated session. |
| `PUT /public/saved-offers/:savedOfferId` | Accepts `{ payload, expectedVersion }`; the path ID must equal `payload.savedOfferId`; creates only at version 0 or atomically advances the current version. |
| `DELETE /public/saved-offers/:savedOfferId` | Accepts `{ expectedVersion }`; atomically writes a tombstone at the next version so an older device cannot resurrect the record without first observing the conflict. |

Session signatures support an EOA, deployed EIP-1271 account, or counterfactual account with the
same fail-closed verifier and paired `factory`/`factoryData` inputs used by profile-avatar writes.
Only the saved-Offer owner may list, read, write, or delete. Pool stewardship, module ownership,
admin roles, and possession of a `CommitmentSeries` ID grant no access. Challenges are
single-use, expire after five minutes, bind to the configured service audience, and cannot be
replayed across chain IDs or owners. Expired sessions return `401`; ownership failures return
`404`; stale writes/deletes return `409 version_conflict` with the current version but no payload.

The agent encrypts each canonical payload at rest with an authenticated cipher, a dedicated
saved-Offer encryption key, and a fresh random nonce for every version. Database rows retain only
the owner key, record ID, ciphertext, cipher nonce, version, timestamps, and tombstone flag.
Encryption at rest protects database disclosure but is not end-to-end encryption: the agent
decrypts after owner authentication to serve another device. Origin allowlisting, request-size
limits, per-owner and per-IP rate limits, constant-time signature handling, and log redaction are
mandatory. Logs may contain error code, route, payload byte count, and a non-reversible request
hash; they may not contain wallet addresses, bearer sessions, signatures, plaintext metadata, or
series links.

Implementation order is Agent API/store first, then the shared adapter and client sync. RED proof
must cover EOA/EIP-1271/counterfactual authentication, nonce replay and expiry, owner isolation,
canonical/oversized payload rejection, encrypt/decrypt without plaintext persistence, optimistic
concurrency across two devices, tombstone conflict behavior, redacted logs, and a local draft
remaining visibly unsaved when the service is unavailable. No saved-Offer UI may claim
cross-device durability until those tests and the live service configuration are GREEN.

## 7. Product behavior

The gardener-facing entry point is **Things I can offer**, not “portfolio.”

The locked client journey is:

1. Describe an Offer or select saved Offer metadata.
2. Choose **Offer once** or **Offer over time**.
3. For **Offer once**, create an ordinary Offer with `commitmentSeriesId == 0`.
4. For **Offer over time**, choose a garden and create or use its pool-scoped
   `CommitmentSeries`.
5. Choose a finite number of Offer instances for the current cycle.
6. Default renewal posture: **Ask me again next cycle**.
7. Each claim accepts one already-created instance.
8. Each instance follows the existing evidence, confirmation, dispute, recognition, and
   settlement lifecycle independently.
9. The ongoing Offer’s Story groups those records without rewriting them.
10. Resting blocks new instances but leaves active instances and the Story intact.

“Carry my offer forward until I pause it” may exist as an explicit app preference, but the
protocol never auto-creates obligations. The app asks for current consent before queuing a new
cycle's instances.

The existing “Offer again” path remains valid:

- a one-shot Commitment copies its terms into another one-shot draft;
- a series-linked Commitment returns to its ongoing Offer detail and adds a new instance;
- neither path rewinds a terminal Commitment.

## 8. Succession boundary

Succession is several consentful actions, never one generic transfer:

- co-holder;
- apprentice relationship;
- two-step handover of the current holder;
- adoption as a new fork with one-way lineage;
- community-held stewardship;
- rest or retirement.

The first implementation includes only rest, resume, and retire. Follow-on work may add the other
verbs after the initial series and Story have pilot evidence. Every action that binds another
person requires their explicit acceptance. Open or accepted Commitment instances always keep
their original accountable lead and contributors.

No series, saved Offer metadata, or history is saleable, transferable as a token, or usable as
collateral.

## 9. Trust, burden, and evidence

- “Kept N times” means N Fulfilled Commitment instances. It does not mean verified impact N times.
- Disputed, repaired, cancelled, and expired instances remain visible in the Story as records, not
  penalty points.
- No per-series or per-person percentage, score, ranking, comparison, or protocol-consumed
  reliability value exists.
- Pilot evidence must examine whether repeated fulfillment creates hidden burden, whether Resting
  is used without stigma, and whether other members actually become able to depend on the Offer.
- Cross-pool visibility is off by default.
- A small-pool privacy review must precede any public participant or series-level Story.

## 10. Delivery and artifact ownership

### Codex-owned specification and coordination

- this specification and companion plan/spec amendments;
- contract, indexer, state/API, acceptance, ontology, and handoff boundaries;
- Linear issue and dependency reconciliation;
- canonical Google Doc prose and final image placement;
- final cross-source review.

### Claude Code-owned canonical artifacts

- lo-fi wireframes and canonical hi-fi screens;
- prototype journeys, fixtures, states, and coverage;
- visual-gallery story assets and architecture imagery;
- rendered light/dark/mobile verification;
- publication of the canonical prototype and gallery artifacts.

Claude implements the locked model. Artifact work may not redefine series authority, capacity
semantics, persistence, visibility, or succession scope.

The private Fable exploration must be corrected before its concepts enter the canonical artifacts:

- a claim accepts a pre-created instance; it does not spawn an instance;
- available places follow the provider-cap reservation rule in section 4;
- `Practice` is removed as a defined noun; the product offers **Offer once** and **Offer over
  time**;
- reusable saved Offer metadata is signed offchain, not device-only;
- participant counts are reported evidence unless separately modelled;
- “pool participation history” replaces the ambiguous product phrase “counts-only standing.”

## 11. Delivery horizons

| Horizon | Scope |
|---|---|
| **Architecture amendment before PRD-721 continues** | module-owned series, validated `commitmentSeriesId`, Offer capacity reservation, series events, indexer entities, state/API contract, acceptance and handoff updates |
| **Canonical artifact pass** | Offer once/over time choice, saved Offer metadata, available instance, Story, cycle roll-up, rest/resume/retire, later-succession preview |
| **Backend implementation** | contracts → indexer → shared state/API, each under existing RED/GREEN and release gates |
| **Runtime app implementation** | signed saved-Offer persistence, client/admin/editorial ongoing-Offer surfaces after backend and prototype gates |
| **Follow-on series slice** | co-holder, apprenticeship relationship, two-step handover, fork lineage, community-held |

## 12. Explicitly unchanged or excluded

- Existing Commitment terminal lifecycle and immutable evidence/confirmation/dispute facts
- Existing contributor roster and recognition allocation
- `PoolMemberHistory` entity and its steward/self disclosure boundary
- Pool-level `promiseKeptRate` as the only percentage
- Exact-label unit accounting with no cross-label arithmetic
- Settlement and CreditRegistry custody boundaries
- Garden-to-garden routing
- Transferable vouchers or labor obligations
- Relative-pricing enforcement
- Cross-pool reputation
- Public personal histories
- Scores, ranks, leaderboards, or reliability-adjusted protocol permissions
