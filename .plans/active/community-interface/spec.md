# Community Needs Interface: Implementation Spec

**Feature Slug**: `community-interface`
**Stage**: `active`
**Created**: 2026-07-04
**Sources**: the latest synthesis “Commitment Pooling × Green Goods — Grassroots Economics Learnings, and the Full Flywheel We're Building” (attached revised Markdown + Linear project document), corrected where repo facts drift in `corrections-log.md`; alignment sessions with Afo 2026-07-04 and 2026-07-09. Companion artifacts: `diagrams.md`, `wireframes.md`, `journeys.md`, `research-plan.md`, and `.plans/active/commitment-pooling/{contract-spec.md,settlement-spec.md,uiux-spec.md}`.

Community members name what better looks like before any commitment exists. A **Need** (statement + mandatory desired outcome) is the object at the start of the flywheel: community names the need, the garden assesses the baseline, a commitment carrying `needUID` promises improvement, work proves it, delta + testimony close it, the cycle Hypercert lists the needs its fulfilled commitments addressed. One sponsored human write; everything downstream is derived or already exists.

---

## 1. Canonical decisions (locked 2026-07-04, 2026-07-09, 2026-07-21, and 2026-07-27)

| # | Decision | Rationale |
|---|---|---|
| 1 | The product noun is **Need**: a Need records a problem the community wants to address, paired with a mandatory desired outcome. Tab Needs, schemas `Need`/`NeedSignal`/`NeedStatus`, field `needUID`, es *Necesidades*, pt *Necessidades*. Plain-language prompts may say “problem” to explain the concept. | Keeps the object clear while using human language during creation. |
| 2 | Linear home: **Community Needs & Signals** builds the needs layer; PRD-682/683 remain the September delivery records in **Commitment Pooling**, amended in place. | Keeps the August MVP project undisturbed; the needs vision has a runway past September. |
| 3 | Spec home: this hub. The commitment-pooling hub gains only the additive `needUID` amendment + a §8 pointer. | One hub per Linear project, mirroring house convention. |
| 4 | App IA: **Needs / Create (center, voice-first) / Profile**. Pool story folds into the Needs board header + per-need promise-work-proof threads. Solution-proposal objects dropped: solutions arrive as commitments. | Creation must feel like taking action; the detail thread is the retention mechanic. |
| 5 | Fund action: embedded **direct donation + endowment** (same paths as `/fund`) in need context; **`FundingAttribution` attestation ships in v1** so funding-per-need is durable. Totals display on the need detail only — never board sort/rank. No per-need escrow; funding goes to the garden. | Funders never direct yield; ranked-by-funding is banned; Afo wants funding-per-need trackable. |
| 6 | Voice: audio is always stored as evidence. Dictation with transcription on **both** the statement and desired-outcome steps; local/on-device first, server transcribe at flush as fallback (reuse agent transcription), never blocking submission. | Authorship barrier is the point; audio is the durable artifact, transcript the convenience. |
| 7 | Discovery: **global read-only browse** of other gardens' needs for members and funders; my garden is the scoped default experience. Signal rights always same-garden (Community Hat). | Inspiration across gardens is powerful; the same-garden signal gate is the brigading guard. |
| 8 | No claim flow in v1 (view / signal / confirm / testify). The need→operator binding is first-class instead: time-sensitive triage + seed-from-Need. Raise-hand ping parked (§16). | Matches PRD-682's locked cut; operators capture offers via analog capture. |
| 9 | A Need has no Request/Offer/Initiative kind. It is the problem to address. **Request / Offer belongs only to the linked commitment's direction**, where it determines provider and confirmer behavior. Need domains are operator-applied, optional, and multi-valued (`uint8[] domains`, unique, max 4); commitments use the same optional multi-domain shape, with at least one domain required only for `DomainImpact`. | Avoids asking members to classify a problem as a form of help and removes duplicate direction vocabulary from the Need and commitment layers. |
| 10 | The member join experience uses a **minimal garden-scoped service queue**: a passkey-account-signed request is stored by the agent and read by an operator, who uses the existing gardener-add transaction. `join-queue-spec.md` is the canonical design. RESR-64 still gates implementation on its operating record for controller, access, retention/deletion, encryption, recovery, abuse, cost, and incident ownership. | Keeps the request off-chain and off the permission boundary while giving members and operators one recoverable handoff; the operating record prevents personal-data policy from being assumed. |
| 11 | Community ships as an independent PWA in **`packages/community`**, hosted at **`community.greengoods.app`** and served locally on **3010**. Before that package starts, generic runtime, auth/passkey, offline status, install/update, error, and shell foundations move into `@green-goods/shared`; client and Community consume the same foundations while retaining separate routes, navigation, manifests, service-worker scopes, telemetry identities, and copy. | Community needs a focused installed experience without cloning security- and lifecycle-sensitive client machinery. |
| 12 | Need presentation has two independent axes: operator-written moderation (`none / acknowledged / merged / hidden / declined`) and commitment-derived progress (`open / committed / in-progress / addressed`). Retraction removes the Need from boards but preserves a content-free withdrawn tombstone wherever protocol lineage already references it. | Moderation must not erase progress, and a member's revocation must not break immutable commitment/evaluator lineage. |
| 13 | PRD-758 is the Community Needs architecture gate for PRD-682. It must close before PRD-682 implementation, but it does not block PRD-721/722/723 or the core Commitment Pooling backend. | Keeps the September Community PWA behind its architecture decision without delaying independent Commitment Pooling backend execution. |
| 14 | The **Needs** substrate uses four immutable EAS schemas across two trust-boundary resolvers. `NeedsResolver` serves `Need`, `NeedSignal`, and `NeedStatus`; `FundingAttributionResolver` remains separate. EAS `recipient` is the canonical garden, and every child schema references its Need through EAS `refUID`. | Four schema records preserve distinct payload, role, volume, and revocability guarantees. Two resolvers remove deployment/upgrade duplication without mixing the ungated funding branch into member/operator authorization. |
| 15 | `NeedSignal` carries only `bool support`. The canonical current signal is the greatest unsigned `(timeCreated, uid)` per `(refUID, attester)`, selected before revocation/expiry filtering; a revoked or expired winner clears the signal without fallback. Switching writes a newer attestation, clearing revokes the winner, pending intents coalesce, and the UI shows separate support/non-support counts with no net score. | Keeps the schema minimal while making direction changes, offline convergence, and reader results deterministic and auditable. Separate counts avoid turning disagreement into a misleading ranking score. |

Sub-decisions: (a) `Need` + `NeedSignal` are **revocable** — EAS revocation is attester-only, so this grants self-retraction and signal clearing, nothing more; operator moderation is never revocation (§4). `NeedStatus` + `FundingAttribution` are non-revocable. (b) A later acknowledged status may reopen merged/hidden/declined only with a non-empty rationale. (c) FundingAttribution has no hat gate, is verified against canonical funding evidence, and one receipt displays at most once globally per `(chainId, txHash, rail)` (§10). (d) Status derivation is an app-side EAS/Envio join; Envio never indexes EAS. (e) A merge target is a typed `mergedIntoNeedUID`; `noteCID` never doubles as an identifier. (f) `need`, `needSignal`, and `testimony` are offline job kinds and may wait in `waiting_for_hat` without consuming retry attempts; `NeedStatus` and `FundingAttribution` remain online writes.

## 2. Scope

**In**: four exact EAS schemas across two resolvers + append-only registration; prerequisite shared foundations; shared job kinds, hooks, joined reads, and voice; independent `packages/community` PWA; admin `/community/needs` triage, moderation, gathering, seed-from-Need, and Need lineage/export; existing `/community/coordination` pool/cycle operations; the minimal service-backed membership queue specified in `join-queue-spec.md` as a section of the existing `/community/members` Manage Members dialog once its RESR-64 operating gate clears; funder discovery in existing client public garden/impact/funding surfaces; paymaster policy extension; docs; TAS dogfood instrumentation; research and operator-onboarding operations in `research-plan.md`.

**Out (deferred, §16)**: eligibility module, raise-hand ping, on-chain seeding gate, push notifications, deeper on-chain funding, ActionSignalPool wiring, solution objects, claim flow, settlement anything.

## 3. Need object model

### 3.1 Exact EAS schemas

Every attestation sets EAS `recipient` to the garden account. The EAS envelope is canonical: readers normalize `garden = recipient`, and child attestations normalize `needUID = refUID`. Custom data does not duplicate either relationship. All four schemas use `expirationTime = 0` in v1. Schema field order is immutable once registered.

**`Need`** — attester: member smart account (the author); revocable **true** (self-retraction only).

```text
string statementCID,string desiredOutcomeCID,uint8 horizon,string mediaCID
```

| Field | Type | Purpose |
|---|---|---|
| `statementCID` | `string` | IPFS: statement text + optional audio CID + transcript + `transcriptionSource` (`none\|dictation\|server`). |
| `desiredOutcomeCID` | `string` | IPFS: mandatory desired outcome (text + optional audio + transcript). Locked framing: a need always arrives paired with what better looks like. |
| `horizon` | `uint8` | 0 week, 1 month, 2 season, 3 years. Routes (§6), does not just describe. |
| `mediaCID` | `string` | Optional photos manifest; `""` = none. In-step attachment, never a separate step. |

No garden, domain, or author field — EAS `recipient` is the garden, domains are operator-applied in `NeedStatus`, and `attester` is the author. A root Need must use `refUID = 0`.

**`NeedSignal`** — attester: member smart account; revocable **true** (clear signal). EAS `refUID` is the Need UID.

```text
bool support
```

| Field | Type | Purpose |
|---|---|---|
| `support` | `bool` | `true` = support; `false` = do not support. Switching direction writes a newer attestation. |

**`NeedStatus`** — attester: operator; revocable **false**. EAS `refUID` is the Need UID. The greatest tuple `(timeCreated, uid)` wins reader-side, comparing UID as an unsigned `bytes32` when timestamps tie; multiple attestations over a Need's life are expected.

```text
uint8 status,uint8[] domains,bytes32 mergedIntoNeedUID,string noteCID
```

| Field | Type | Purpose |
|---|---|---|
| `status` | `uint8` | Moderation: 1 acknowledged · 2 merged · 3 hidden · 4 declined. No status attestation means `none`. |
| `domains` | `uint8[]` | Optional operator tags using the existing 0–3 domain enum. Empty is valid; entries must be unique; max length 4. Readers preserve the latest acknowledged domains even when later moderation statuses omit them. |
| `mergedIntoNeedUID` | `bytes32` | Required and non-zero only for status 2 (merged); zero for acknowledge/hide/decline. References another valid Need in the same garden. |
| `noteCID` | `string` | Human rationale. Required for merge/hide/decline and when acknowledge reopens any of those states; `""` allowed only for the first acknowledge or a repeated acknowledge. Never parsed as an identifier. |

**`FundingAttribution`** — attester: funder wallet (app-composed, post-tx); revocable **false**; no hat gate. EAS `refUID` is the Need UID.

```text
uint256 chainId,bytes32 txHash,address token,uint256 amount,uint8 rail
```

| Field | Type | Purpose |
|---|---|---|
| `chainId` | `uint256` | Chain on which the funding receipt exists; required because transaction hashes are not globally unique. |
| `txHash` | `bytes32` | The donation/deposit transaction being attributed. |
| `token` | `address` | Asset funded. |
| `amount` | `uint256` | Raw amount (display verifies against the tx, §10). |
| `rail` | `uint8` | 0 direct donation · 1 endowment (vault deposit). |

### 3.2 Resolver ABI, storage, and validation contract

Both are `SchemaResolver + OwnableUpgradeable + UUPSUpgradeable`, non-payable, and use flat-tuple `abi.decode`. Hat checks call `IGardenAccessControl` on the recipient garden; garden existence calls immutable `IGardensModule.isGardenInitialized(recipient)`. They never call Hats directly.

Exact external/configuration ABI (EAS calls inherited resolver entrypoints; `onAttest`/`onRevoke` remain internal overrides):

```solidity
interface INeedsResolverConfig {
    event SchemaUIDsUpdated(
        bytes32 indexed oldNeedUID,
        bytes32 indexed newNeedUID,
        bytes32 oldSignalUID,
        bytes32 newSignalUID,
        bytes32 oldStatusUID,
        bytes32 newStatusUID
    );
    // implementation constructor: constructor(address eas, address gardensModule)
    function initialize(address owner_) external;
    function setSchemaUIDs(bytes32 needUID, bytes32 signalUID, bytes32 statusUID) external;
    function needSchemaUID() external view returns (bytes32);
    function needSignalSchemaUID() external view returns (bytes32);
    function needStatusSchemaUID() external view returns (bytes32);
    function GARDENS_MODULE() external view returns (address);
    function isPayable() external pure returns (bool);
}

interface IFundingAttributionResolverConfig {
    event SchemaUIDsUpdated(
        bytes32 indexed oldNeedUID,
        bytes32 indexed newNeedUID,
        bytes32 oldFundingUID,
        bytes32 newFundingUID
    );
    // implementation constructor: constructor(address eas, address gardensModule)
    function initialize(address owner_) external;
    function setSchemaUIDs(bytes32 needUID, bytes32 fundingUID) external;
    function needSchemaUID() external view returns (bytes32);
    function fundingAttributionSchemaUID() external view returns (bytes32);
    event NativeDirectFundingPolicyUpdated(uint256 indexed chainId, bool allowed);
    function setNativeDirectFundingAllowed(uint256 chainId, bool allowed) external;
    function nativeDirectFundingAllowed(uint256 chainId) external view returns (bool);
    function GARDENS_MODULE() external view returns (address);
    function isPayable() external pure returns (bool);
}
```

Every setter and `_authorizeUpgrade` is `onlyOwner`; constructors call `_disableInitializers`; `initialize` rejects zero owner, calls `__Ownable_init`, and transfers ownership. Each atomic UID setter rejects zero values and pairwise equality before mutating storage. `NeedsResolver` stores the three schema UIDs plus:

```solidity
struct ModerationHead { uint64 timeCreated; bytes32 uid; uint8 status; }
mapping(bytes32 needUID => ModerationHead) moderationHead;
```

and reserves `[46]`. `FundingAttributionResolver` stores the Need and FundingAttribution schema UIDs plus `mapping(uint256 => bool) nativeDirectFundingAllowed` and reserves `[47]`. Generated storage-layout baselines remain the final authority. Before validating an acknowledgement rationale, the Community resolver reads `moderationHead[attestation.refUID]`. After validation it replaces the head only when `(attestation.time, attestation.uid)` is lexicographically greater, treating UID as unsigned bytes32. Thus on-chain reopen validation and reader ordering use the same tie-break even for same-timestamp attestations.

Validation order is schema → envelope → garden/recipient → referenced Need → role → required fields → enum/relationship rules. Unknown schema branches fail closed. Every branch requires `expirationTime == 0` and the per-attestation `revocable` flag to match the registered policy:

- **Need branch**: `refUID == 0`; recipient is initialized; attester is Community; statement/outcome CIDs non-empty; horizon `0..3`; attestation is revocable. `onRevoke` returns true only for this schema.
- **NeedSignal branch**: `refUID != 0`; referenced attestation exists, has the exact Need schema, has the same recipient, and is neither revoked nor expired; recipient is initialized; attester is Community; decode only `bool support`; attestation is revocable. No resolver-level duplicate storage. `onRevoke` returns true only for this schema.
- **NeedStatus branch**: the same exact live Need reference checks; attester is Operator; status `1..4`; at most four unique domains, each `0..3`; merge requires a non-zero, non-self, live same-garden Need and all other statuses require a zero merge target; merge/hide/decline require `noteCID`; acknowledge after canonical `moderationHead.status` 2/3/4 also requires `noteCID`; attestation is non-revocable. A successful attest updates `moderationHead[attestation.refUID]` only when its `(timeCreated, uid)` tuple wins. `onRevoke` returns false.
- **FundingAttribution resolver**: accepts only its configured FundingAttribution schema; applies the same exact live Need reference checks; requires `chainId != 0`, `txHash != 0`, `amount > 0`, rail `0..1`; `token == address(0)` is allowed only for rail 0 when `nativeDirectFundingAllowed[chainId] == true`; rail 1 always requires a non-zero token; attestation is non-revocable. No hat gate and no on-chain receipt oracle. `onRevoke` returns false; the joined reader applies §10 verification before display.

Canonical custom errors, including argument types, are:

```solidity
error InvalidGarden(address garden);
error InvalidSchemaUID(bytes32 uid);
error DuplicateSchemaUID(bytes32 uid);
error RootReferenceForbidden(bytes32 refUID);
error ReferenceRequired();
error InvalidReference(bytes32 refUID);
error ReferenceSchemaMismatch(bytes32 refUID, bytes32 expectedSchema, bytes32 actualSchema);
error ReferenceGardenMismatch(bytes32 refUID, address expectedGarden, address actualGarden);
error ReferenceRevoked(bytes32 refUID);
error ReferenceExpired(bytes32 refUID, uint64 expirationTime);
error ExpirationNotAllowed(uint64 expirationTime);
error InvalidRevocability(bool expected, bool actual);
error NotCommunityMember(address attester, address garden);
error NotGardenOperator(address attester, address garden);
error StatementRequired();
error DesiredOutcomeRequired();
error InvalidHorizon(uint8 horizon);
error InvalidModeration(uint8 status);
error TooManyDomains(uint256 supplied);
error InvalidDomain(uint8 domain);
error DuplicateDomain(uint8 domain);
error MergeTargetRequired();
error MergeTargetForbidden(bytes32 mergeTarget);
error InvalidMergeTarget(bytes32 mergeTarget);
error SelfMerge(bytes32 needUID);
error ModerationReasonRequired(uint8 status);
error ChainIdRequired();
error TransactionHashRequired();
error TokenRequired(uint8 rail, uint256 chainId);
error AmountRequired();
error InvalidFundingRail(uint8 rail);
```

Existing `InvalidSchema()` remains shared. Resolver tests assert the selector for every branch above; no `require` strings are permitted.

### 3.3 Append-only registration and deployment

`packages/contracts/config/schemas.json` receives four new immutable entries; existing entries, field order, names, and deployment artifact keys may not change. This is the narrow append-only exception to the package's current prohibition and requires the matching `packages/contracts/AGENTS.md` amendment. Bulk `--update-schemas` remains prohibited.

The planned `need-schemas` deploy target performs this exact sequence:

1. deploy two implementations and ERC1967 proxies with `(EAS, gardensModule)` constructor immutables and `initialize(multisig)` calldata;
2. register Need, NeedSignal, and NeedStatus with the Community resolver and FundingAttribution with the Funding resolver, preserving each declared revocability;
3. call `NeedsResolver.setSchemaUIDs(need, signal, status)` and `FundingAttributionResolver.setSchemaUIDs(need, funding)`; apply the reviewed `nativeDirectFundingAllowed` chain map to FundingAttributionResolver (empty/false by default);
4. merge top-level proxy keys `needsResolver` and `fundingAttributionResolver` plus exact nested keys `schemas.needSchema`, `schemas.needSchemaUID`, `schemas.needSignalSchema`, `schemas.needSignalSchemaUID`, `schemas.needStatusSchema`, `schemas.needStatusSchemaUID`, `schemas.fundingAttributionSchema`, and `schemas.fundingAttributionSchemaUID` into `deployments/{chainId}-latest.json` without replacing sibling keys;
5. verify proxy implementation/owner, exact non-zero pairwise-distinct UIDs, EAS registry schema string/resolver/revocability, GardensModule address, storage-layout checks, and one valid/invalid attestation per schema branch.

Dry-run and broadcast entrypoints are `bun script/deploy.ts need-schemas --network sepolia --dry-run --pure-simulation`, then the same target with `--broadcast`; Arbitrum broadcast stays gated on verified Sepolia artifacts. Human review of the exact transaction plan, the pure-simulation dry run, and fresh-chain deployment/registration proof are blocking prerequisites before schema registration may proceed on any target chain. Pre-broadcast proof is `bun run --filter @green-goods/contracts test:match -- test/unit/NeedResolvers.t.sol`, `bun run --filter @green-goods/contracts test:match -- test/StorageLayout.t.sol`, `bun run --filter @green-goods/contracts test:script`, `bun run --filter @green-goods/contracts lint:check`, and `bun run --filter @green-goods/contracts build:full`. After broadcast, reread `deployments/{chainId}-latest.json` from disk and verify the persisted proxy keys, exact schema strings and UIDs, and dependent resolver configuration on-chain before treating registration as complete. `NeedResolvers.t.sol` maps every custom error, atomic UID event/configuration rule, envelope/reference/revocability rule, native-token policy, canonical moderation tie-break/reopen rule, and initializer/UUPS authorization. The contracts lane remains blocked until the Commitment Pooling standalone registration helper implementation/interface is frozen; the append-only policy and this handoff are no longer blockers by themselves.

## 4. Two-axis lifecycle and joined-read ownership

Moderation and progress are separate fields in the shared view model; the UI never collapses them into one precedence enum.

| Axis | Value | Source and rule |
|---|---|---|
| moderation | `none` | No active NeedStatus. |
| moderation | `acknowledged` | Winning NeedStatus is 1. A later acknowledged attestation reopens merged/hidden/declined and must carry a rationale. |
| moderation | `merged` | Winning NeedStatus is 2; redirect to `mergedIntoNeedUID`. |
| moderation | `hidden` | Winning NeedStatus is 3. |
| moderation | `declined` | Winning NeedStatus is 4. |
| progress | `open` | No linked Commitment exists. |
| progress | `committed` | At least one Commitment was created with this non-zero `needUID`. |
| progress | `in-progress` | At least one linked Commitment was accepted or counted approved Work. |
| progress | `addressed` | At least one linked Commitment was fulfilled. |

Progress is monotonic evidence lineage: choose the highest reached value across linked commitments. The winning moderation attestation is the greatest `(timeCreated, uid)` tuple. A declined Need remains readable only to its author and garden operators; hidden is operator-only; merged public reads redirect to the canonical Need; acknowledged/none remain public according to garden visibility.

**Retraction.** Revoking a Need removes its words, media, signal controls, and board card from every public/member collection. If a commitment, Hypercert, assessment, funding record, or evaluator export already references the UID, the joined reader emits only `{needUID, retracted: true, label: "Withdrawn by author"}`. It never exposes cached content. Retraction does not mutate linked protocol records.

**Read path (hard boundary: Envio never indexes EAS).** Shared owns one joined-read service and hook family:

1. EAS GraphQL supplies Need, NeedSignal, NeedStatus, Testimony, and FundingAttribution attestations. Need lists may filter revoked roots for boards, while NeedSignal reads must retain revoked records for canonical winner selection. The lineage lookup retains only the tombstone for a revoked referenced Need. Readers normalize garden from `recipient` and child Need UID from `refUID`.
2. Envio supplies Green Goods Commitment/Work/Approval/Assessment/Hypercert entities plus the protocol-event-derived `NeedCommitmentIndex` frozen in the Commitment Pooling contract spec. Its ID is `${chainId}-${lowercaseNeedUID}` and every stored relationship is a composite entity ID; no EAS or raw funding transfer indexing is added for this feature.
3. The funding-proof adapter joins the existing public funding-intent receipt for direct funding and the canonical GardenVault deposit entity/receipt for endowments (§10).

`useNeeds`, `useNeed`, `useNeedSignals`, and evaluator export consume the same normalized result. Loading, empty, offline-stale, partial-source, retryable-error, and terminal-error are explicit; stale cached data is labeled and a failed source never masquerades as an empty list.

The indexer lane does not invent another Needs entity. Its exact owned addition is the `NeedCommitmentIndex` definition in `commitment-pooling/contract-spec.md` §8.2: `id`, `chainId`, `needUID`, and composite arrays `commitmentEntityIds`, `fulfilledCommitmentEntityIds`, `cycleEntityIds`, and `hypercertEntityIds`. `CommitmentCreated`, `CommitmentFulfilled`, and commitment-bundled Hypercert handling are its only writers. UID zero is ignored; array appends are idempotent and stable-order. EAS content/moderation/signals remain solely in the joined reader.

## 5. Creation flow (voice-first, Create tab)

Three steps, mirroring the MDR draft grammar (`DraftStep` precedent `intro|media|details|review`); the interface never says attestation, wallet, or transaction.

1. **Describe the problem in your own words** — prompt: “What is your community trying to solve?” Big record button primary; live dictation where available; typing always offered; photos as an in-step attachment. No Request/Offer/Initiative choice appears on a Need. States: `idle`, `recording` (waveform, elapsed, stop), `transcribing` ("we're writing down what you said"), `editing` (transcript editable, audio retained), `offline-queued` ("saved, will send when you're back online").
2. **Desired outcome + horizon** — the outcome field is voice-capable too (same dictation/transcription treatment); horizon chips in plain language (this week / this month / this season / years). The horizon routes silently (§6).
3. **Review** — your words, your desired outcome, horizon, photos; **similar-need nudge** ("is this the same as…?" — soft, never blocking; client-side match against the garden's open needs, FixMyStreet lesson).

**Transcription strategy (decision 6).** Local first: Web Speech dictation during capture (on-device recognition where the language pack exists — availability is user-agent/device dependent, es/pt offline not guaranteed; a feasibility spike on TAS-class Android devices is part of the shared workstream, including whether a WASM route is viable). Fallback: at queue flush, if the payload has audio but no text and the device is online, one **pre-attest server transcription call** (reusing the agent package's existing transcription capability behind a small authenticated endpoint); on any failure or timeout the attestation proceeds audio-only — transcription never blocks. Because `statementCID` is immutable once attested, the reviewed-transcript rule is: text captured live (typed or dictated, member-editable in `editing`) rides the CID; a flush-time server transcript rides the CID marked `transcriptionSource: "server"`; anything transcribed after attestation is display-layer only and labeled auto-generated. Subtitle-first: every audio clip renders with its transcript or an explicit "audio only" chip.

**Queue behavior.** The shared queue adds `need`, `needSignal`, and `testimony` kinds with versioned payload schemas; NeedStatus and FundingAttribution stay online-only. All three member kinds may enter **`waiting_for_hat`** before any network attempt, consume no retry attempt while waiting, persist across app restarts, expose Cancel/Delete, and resume with the full five-attempt budget only after the Community Hat is observed. Pending `needSignal` writes coalesce durably by `(chainId, garden, needUID, attester)`: a later direction replaces an unsent one and resets attempts/backoff; clear removes an unsent local signal when no on-chain winner exists, otherwise it queues revocation of the winning signal UID. An older queued direction can never flush after a newer intent. A revoked/expired local account, rejected membership request, deleted draft, or user cancellation is terminal and removes the optimistic card. Network, sponsorship, upload, transcription, and resolver failures retain the draft plus a plain-language Retry/Edit path; transcription failure proceeds audio-only and never blocks the attestation. Queue analytics contain kind/state/error-class counts only.

## 6. Signal mechanics and horizon routing

A signal is a `NeedSignal` attestation — lightweight, sponsored, offline-queueable (`needSignal` job kind), and revocable to clear. Canonical state is the greatest unsigned `(timeCreated, uid)` per `(refUID, attester)`, selected before revoked/expired filtering. If the winner is revoked or expired, the member has no current signal and no older direction is resurrected. Otherwise `support=true` contributes to support and `support=false` contributes to non-support. Switching direction creates a newer attestation; clearing revokes the winner. The UI displays the two counts separately and never derives a net score. Signal controls are active only for the Need's own garden's Community Hat wearers; global browse is read-only (§8).

Horizon routes:
- **Week (time-sensitive)** → straight to the operator triage queue as an alert; no signal accumulation gate.
- **Month+** → signals accumulate toward the cycle-2 seeding gate: the seeding console's Needs panel orders by support count + recency, alphabetical tiebreak, exposes non-support separately, and never subtracts it into a net rank; **seed-from-Need** prefills the commitment form and sets `needUID`. Confirmation defaults follow commitment direction: a Request defaults to the Need author/commitment creator, while an Offer waits for the accepted recipient; the accepted provider is never retained in a named group, and acceptance fails if provider exclusion makes the threshold unreachable. The gate is a workflow, not a contract rule — signals inform, nothing on-chain blocks seeding. Traceability recorded ("seeded from need" chip; share-of-commitments-carrying-needUID per cycle).

Distinct from yield conviction (HypercertSignalPool) — the two never mix. ActionSignalPool stays dormant (§16).

## 7. Onboarding (QR, lazy join, service-backed membership queue)

Browse is free: the QR from a gardener opens the garden's needs board read-only, in-browser, no install. Join happens lazily on first action (signal, need, or testimony): passkey prompt → one biometric → counterfactual ERC-4337 smart account (Pimlico, sponsored) → a signed request to the garden-scoped agent service → the member write persists locally as `waiting_for_hat`. Once the operator mints a Community Hat, the app observes membership and releases the write into the normal queue. PWA install is optional after the first successful action.

**Locked experience, operating gate remains.** `join-queue-spec.md` selects the small service shape; RESR-64 owns the operating record due **2026-08-12**. The membership-queue slice is not dispatchable until that record names the controller, processor, authentication/authorization model, encrypted fields, retention/deletion windows, member cancellation and recovery, operator handoff, abuse controls, operating cost, incident owner, and offline replay behavior. Public on-chain requests, Linear-as-queue, and implicit localStorage transport are excluded. `waiting_for_hat` stores the member's pending product write, not the join request itself.

## 8. App IA — independent `packages/community` PWA

Hosted at `community.greengoods.app` and locally at `http://localhost:3010`. Three tabs use shared adaptive-shell primitives but Community-owned routes, navigation, manifest, service-worker scope, telemetry identity, and copy: **Needs · Create · Profile**. Authenticated deep links return to the exact garden/Need after passkey or install flow.

| View | Purpose | Content | Primary actions |
|---|---|---|---|
| Needs (landing) | My garden's needs board + pool story header | Garden header strip (pool state banner + cycle progress + aggregate stats, thresholded per uiux-spec §7.2); need cards (author's words, desired outcome, horizon, optional domains, status, distinct-signal count); filters: progress, status, horizon. Never ranked by funding. | Signal; open detail; switch to Explore |
| Explore (within Needs) | Global read-only discovery | Other gardens' needs (domain/progress/horizon/garden filters); no signal buttons ever | Browse; open read-only detail |
| Need detail | The retention mechanic | Promise-work-proof thread: your words → the promise (commitment via `needUID`) → the work (MDR submissions) → the proof (assessment delta) → testimony; author's confirm CTA appears at `ReadyForConfirmation` (shared confirmation grammar); funded-toward line when attributions exist | Signal; confirm (author, when named); add testimony (any Community Hat wearer of this garden) |
| Create (center) | §5 flow | Voice-first three steps | Record / dictate / type; submit |
| Profile | Account + history | Passkey block; my needs; my signals; pending/waiting/failed jobs; my confirmations; my testimonies; language | Retry/edit/delete a job; sign out; manage passkey |

Confirmations inbox and testimony history live in Profile (uiux-spec §8 grammar preserved). No work submission, no claiming, no wallet drawer, no settlement surface.

## 9. Admin `/community/needs` mode and coordination boundary

- **Route ownership is closed**: `/community/needs` is the fifth route-level `AdminTabRail` mode and owns every Need-specific operator/evaluator surface: triage, moderation/reopen, the selected-Need inspector, gathering, seed-from-Need, and Need-filtered lineage/export. Existing `/community/coordination` retains pool and cycle operations. The implementation must not expand the existing catch-all `CommunityTab` branch or duplicate either responsibility across both modes.
- **Need triage queue**: incoming community problems and desired outcomes; week-horizon items grouped first without countdown language; **acknowledge/reopen** (NeedStatus 1 + zero or more unique domains; reopening requires a rationale), **decline** (4 + rationale), **merge** (2 + same-garden target + rationale), and **hide** (3 + rationale). Status writes are online actions with loading, rejected-signature, transaction-failed, stale-read, and retry states.
- **Private-lane intake**: grievances naming individuals never touch the chain — an off-chain note channel to the operator, attested later only if generalized into a need. v1 = documented operator practice + a "capture privately" affordance that stores nothing on-chain.
- **Need-to-commitment linking at seeding**: the PRD-683 signals panel + seed-from-need prefill sets `needUID`, copies optional domains, and applies the direction-aware confirmation default above; the operator confirms all seed fields and sees the provider-exclusion/unreachable-threshold validation before acceptance.
- **Membership queue**: the service-backed flow in `join-queue-spec.md` appears as **Waiting to join** inside the existing `/community/members` Manage Members dialog only after the RESR-64 operating gate. `/community/needs` does not gain this queue. Do not implement an implicit localStorage, Linear, or public-chain queue.
- **Coordination and lineage**: pool/cycle operations remain in `/community/coordination`; read-only Need→Commitment→Work→Approval→Assessment→Testimony→Hypercert lineage and export live in `/community/needs`. No new top-level `/pools` or `/needs` root is introduced. Export is specified in §11.
- **"For the gathering" view**: pending confirmations + recent status changes + fresh needs, print-legible — the operator is the human notification layer; the physical gathering is the loop, not push.

## 10. Funder lens (client public views, editorial system)

These are **two separate responsive applications**, not one surface with device-selected lenses. The independent Community PWA owns member Needs/Create/Profile on `community.greengoods.app`. Existing `packages/client` public-browser routes own public/funder discovery and work on mobile and desktop without importing Community routes, manifest, service worker, navigation, telemetry identity, or app copy.

- **Exact client route ownership (closed)**: `/gardens` owns cross-garden Need discovery; `/gardens/:id` owns a garden's Need list and Need detail/dialog; `/impact` owns read-only Need→promise→work→proof lineage; `/fund?garden=<slug>&need=<uid>` owns both direct-donation and endowment entry with Need context. No `/needs`, `/community`, or other new client public route may be introduced by this feature.
- **Gallery**: the `/gardens` and `/gardens/:id` sections show needs across/all within a garden with domain/horizon/garden filters and garden context. **Never ranked by funding** (unglamorous needs must not starve); default order recency + status.
- **Need detail (funder)**: the `/gardens/:id` dialog presents promise-work-proof thread + garden context + cycle + **funded-toward line** (sum of verified FundingAttributions; detail view only, never a board sort key); its evidence continuation links to `/impact` with a Need filter, not a new route.
- **Fund actions**: embedded **direct donation** and **endowment** reuse `/fund?garden=<slug>&need=<uid>`. After a confirmed tx the app composes the `FundingAttribution` attestation for the funder to sign (wallet write, their gas). Skipping the attribution never blocks the funding itself.
- **Attribution verification — rail 0 direct donation**: require a terminal `funded`/`funded_late` public funding-intent receipt whose `fundingTxHash`, chain, configured destination garden/CookieJar, token, and funded base-unit amount equal the attestation. The agent's existing strict tuple verifier must have observed a successful finalized receipt and canonical-token `Transfer` to the locked destination. The EAS attester must equal the funding intent's recorded recovered/user-owned receiver; never infer it from `transaction.from`.
- **Attribution verification — rail 1 endowment**: require a finalized successful receipt from the configured GardenVault address and exact ERC-4626 `Deposit(address indexed sender,address indexed owner,uint256 assets,uint256 shares)` log, with `owner == attestation.attester`, vault→garden/asset mapping from the composite `GardenVault` entity, `token == vault.asset`, and `amount == assets`. The matching composite `VaultEvent`/receipt must identify the same tx; `transaction.from` is not identity.
- **Failure classes**: unsupported chain, pending/unfinalized receipt, failed receipt, missing canonical config, mismatched garden/token/amount/owner, or unavailable funding proof yields `pending` or `unverified` and contributes zero. Only the two exact adapters above can produce `verified`.
- **Global de-duplication**: group verified attestations by receipt key `(chainId, txHash, rail)` across all Needs. The lowest `(timeCreated, uid)` is canonical; every later duplicate, including one pointing to another `needUID`, contributes zero. The canonical row then appears only under its referenced Need. Funding can succeed when attribution signing/verification fails, and Retry attribution never replays funding.
- Editorial guardrails inherited: aggregates only, small-community thresholds (uiux-spec §7.2), no participant-level data, nothing implying funders direct yield.

## 11. Commitment, Hypercert, and evaluator linkage

- `bytes32 needUID` on the commitment record (0 = none), `CreateCommitmentParams`, and `CommitmentCreated` event — **amended into the August contract-spec 2026-07-04** (additive reference field beside `assessmentUID`; no state-machine change). A commitment can carry both: anchored to an assessment (baseline), motivated by a need.
- `uint8[] domains` is optional on both the operator's latest acknowledged NeedStatus and the linked commitment. The commitment copies suggested domains only as a prefill; its final domain/action scope is explicitly confirmed at seeding. Cross-domain DomainImpact commitments pair each domain with one registered, domain-matching action UID; UID `0` remains valid because array presence, not a numeric sentinel, expresses binding.
- Cycle Hypercert metadata and the Envio Hypercert entity persist `needUIDs` as the ascending, unique, non-zero UIDs carried by fulfilled commitments in the bundle, alongside composite `commitmentEntityIds`; `NeedCommitmentIndex.hypercertEntityIds` supplies the reverse lookup. Retraction preserves the UID but exports only the withdrawn tombstone. Community testimony is offline-queueable witness evidence and never gates payout.
- Admin `/community/needs` offers read-only CSV and JSON export over the same joined view. Each row/object includes `needUID`, `garden`, moderation, progress, retracted flag, commitment composite ID/state, Work/Approval/Assessment/Testimony UIDs, cycle/Hypercert ID, funding chain/tx/rail/verification state, and source URLs. Text/media CIDs appear only when the viewer already has access; wallet addresses, join identities, and research contacts never export. CSV uses one lineage edge per row; JSON nests edges. Partial-source exports are blocked with an explicit Retry rather than emitting incomplete evidence.

## 12. Metrics and instrumentation (no leaderboards)

PostHog routing: community app + funder lens → App (163591); admin triage → Admin (262122). Properties are enums/counts/booleans only — never statement text, addresses, or reporter identity.

Events: `need_created {horizon, domain_count: 0, has_audio, has_photos, transcription_source}` · `need_signal_set {support}` · `need_signal_cleared` · `need_status_set {status, domain_count}` (admin) · `need_detail_viewed {is_author}` · `eligible_confirmation_completed {direction, confirmer_role}` · `testimony_attested` · `fund_from_need {rail}` · `funding_attribution_recorded {rail, verified}` · `seeded_from_need {domain_count}` (admin) · `need_merged` (admin). Offline queue health rides existing job analytics automatically. Domain values, statements, addresses, and join identities never enter analytics.

Derived measures (TAS dogfood): needs raised/addressed per garden per cycle; time-to-acknowledge (Need → first NeedStatus); signal participation (members with a current support or non-support signal ÷ Community Hat wearers); separate support/non-support counts; share of commitments carrying `needUID`; author return visits; eligible direction-aware confirmation participation; funding attributed per need. Benchmark: if under a threshold share of cycle-2 commitments carry a needUID, tighten the signals panel or the gathering ritual before adding machinery.

## 13. i18n and accessibility

Every string ships en+es+pt through the shared four-part coverage gate; families `community.*`, `cockpit.community.*`, and `public.needs.*`. All copy passes `bun run lint:vocab`. Creation, moderation, funding, offline, pending, waiting, declined, merged, hidden, retracted, failed, retry, export, and empty states require translated strings. Accessibility: semantic landmarks/headings and native controls; persistent labels and accessible names; logical focus order and visible focus; at least 44px touch targets; status never color-only; polite live regions for queue/status updates and assertive announcements only for unsafe terminal failure; subtitle/transcript or an "audio only" label; focus restoration after dialogs; reduced-motion and contrast compliance; no timeouts in creation.

## 14. Shared-foundation gate and package wiring

Before scaffolding Community, extract only generic foundations into `@green-goods/shared`: runtime/chain providers, auth/passkey state and callbacks, offline indicator/queue status, install/update prompts, route-error boundary, and adaptive shell slots. `packages/client` migrates to those exports with behavior-preserving tests first; no Community implementation starts until client build/auth/offline tests pass. Hooks remain under `packages/shared/src/hooks`.

Community then owns port **3010**, production host `community.greengoods.app`, a non-overlapping manifest identity and service-worker scope, Needs/Create/Profile routes, navigation items, telemetry identity, and copy. Planned wiring covers root build/lint tasks, `ecosystem.config.cjs`, `scripts/dev/stack.js`, formatting includes, a Community CI workflow and required gate, hosting rewrites/headers, CSP/connect-src for EAS/Envio/IPFS/Pimlico, and smoke tests proving client and Community service workers cannot control each other's origin. No package is scaffolded during planning.

## 15. Risks and mitigations

- **Noise/duplicates** → similar-need nudge, operator merge, mandatory desired outcome raising the floor.
- **Grievances naming individuals** → private lane; never on-chain unless generalized.
- **Brigading** → same-garden signal gate; global browse is read-only.
- **Literacy/language** → voice-first, subtitle-first, es/pt day one, no time-outs.
- **Triage/membership burden** → compact actions, time-sensitive grouping, gathering view, bounded batch operations after the persistence gate.
- **Notification gap** → design for the gathering; operator is the notification layer.
- **Paymaster drain** → policy caps per account/window; gathering-burst test before first sponsored community write.
- **Attribution spam** → read-time tx verification; detail-only display; non-revocable schema keeps the record auditable.
- **Transcript immutability** → CID rule in §5; post-attest transcripts are display-layer and labeled.
- **Join-request privacy/state ambiguity** → explicit decision gate in §7; no membership-queue build until the selected transport has retention, deletion, auth, recovery, and operator-handoff proof.

## 16. Deferred (parked, not September)

On-chain eligibility module (gardener-signed EIP-712 invites, per-inviter caps/revocation via HatsModuleFactory) — promoted only when off-chain caps become operational pain. Raise-hand ping ("I want to help"). On-chain seeding-gate rule. Push notifications. Deeper on-chain funding attribution / fund actions (build on v1 attestation data). ActionSignalPool app wiring. Solution-proposal objects. Claim flow (revisit after one full cycle of signal data).

---

## Appendix: verified anchors

| Anchor | Path |
|---|---|
| Access control checks | `packages/contracts/src/interfaces/IGardenAccessControl.sol:20,25,30,45` |
| Resolver conventions | `packages/contracts/src/resolvers/{Work,WorkApproval,Assessment}.sol` |
| Schema registry + registration template | `packages/contracts/config/schemas.json`; `packages/contracts/script/deploy/badge-schemas.ts` |
| Commitment struct + events (amended) | `.plans/active/commitment-pooling/contract-spec.md` §6 (Commitment, CreateCommitmentParams, CommitmentCreated) |
| Job queue kinds + retries | `packages/shared/src/types/job-queue.ts:89-95`; `packages/shared/src/modules/job-queue/index.ts` |
| EAS read path | `packages/shared/src/modules/data/eas.ts`; `arbitrum.easscan.org/graphql` |
| Paymaster policy | `packages/shared/src/workflows/authServices.ts` (`VITE_PIMLICO_SPONSORSHIP_POLICY_ID`) |
| Audio primitives | `packages/shared/src/components/Audio/{AudioRecorder,AudioPlayer}.tsx`; `packages/shared/src/hooks/utils/useAudioRecording.ts` |
| Client tabs + login reuse | `packages/client/src/components/Layout/AppBar.tsx:35-59`; `packages/client/src/views/Login/` |
| Indexer boundary | `packages/indexer/config.yaml`; corrections-log (Envio never indexes EAS) |
| UX and research artifacts | `diagrams.md`; `wireframes.md`; `journeys.md`; `research-plan.md` |
