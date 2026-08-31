# Community Needs & Signals: Garden Join-Request Queue

**Feature Slug**: `community-interface`
**Stage**: `active` — local implementation in progress; production activation gate remains
**Created**: 2026-07-12
**Companions**: `spec.md` §§7 and 9 (member and Garden-admin placement); `research-plan.md` (RESR-64 operating gate); `status.json` (manual blocker); `../commitment-pooling/plan.todo.md` decision #35 (pool-job consumer).
**Grounding rule**: Every statement about present code names a `repo/path:line`; all proposed work is marked **NET-NEW**. This is the only canonical join-request design.

---

## 2026-08-27 implementation lock

Afo explicitly authorized the selected service queue with these operating defaults: Green Goods is the controller, Fly.io is the processor, Afo owns the initial encryption key and incident response, pending and resolved rows each have a 30-day retention window, and a backup operator must be named before production activation. That authorization clears local implementation work; it does not authorize collecting production requests yet.

The implementation reuses the repository's existing personal-sign signature verifier instead of adding a second EIP-712 verifier. The canonical message binds chain, garden, account, action, nonce, issue/expiry times, request/cursor/revision fields, and the normalized request content. The verifier still supports EOAs, deployed ERC-1271 accounts, and counterfactual EIP-6492 accounts. Personal fields are encrypted together in one authenticated AES-256-GCM payload; the database stores only a keyed account digest outside that payload. These are implementation refinements to the earlier draft below, with the same trust boundaries and privacy outcome.

The first shipped source is `garden_detail`, matching the requested PWA garden-detail placement. Create replay guards are durable and the active-row constraint makes a newly signed retry converge on the existing pending request. Same-proof automatic retry and the draft `Idempotency-Key` response cache are deferred; the UI reports an unknown outcome and asks for an explicit status check or newly signed retry instead of persisting a browser credential.

Production activation remains blocked until the Fly.io secret is installed, the backup operator is named, the operator recovery path is rehearsed, and authenticated Brave proof is recorded. No contract or indexer change is part of this slice.

## 1. Decision and ownership

**NET-NEW decision:** a closed-garden join request is one small, garden-scoped record on the agent service. It is not a protocol permission, an on-chain request registry, or a job-queue item. Community Needs & Signals owns its lifecycle, personal-data rules, and RESR-64 operating gate because its first-action flow creates the same membership wait (`spec.md:245-249`).

Commitment Pooling consumes the result only: its five August pool job kinds enter `waiting_for_hat` before a send and resume when membership is observed (`../commitment-pooling/uiux-spec.md:205-225`). The queue never grants membership.

The open-garden path is separate: `useJoinGarden` reads `openJoining` (`packages/shared/src/hooks/garden/useJoinGarden.ts:58-83`) and sends a sponsored passkey `joinGarden` transaction when it is enabled (`packages/shared/src/hooks/garden/useJoinGarden.ts:285-299`). **NET-NEW:** this queue is only for a closed, non-member garden.

## 2. Thin architecture

```text
Closed-garden card or Community first action
  -> passkey account signs one join-request proof
  -> agent verifies it and stores one Pending row
  -> authorized operator reads the garden queue in Manage Members
  -> operator calls existing addGardener(address)
  -> agent confirms gardener membership, then marks Welcomed
  -> client observes the Hat and releases waiting_for_hat work
```

If the service is unavailable, the operator adds the address manually using the existing membership flow; no member permission is lost and no protocol key is introduced.

### 2.1 One encrypted table

Implemented `garden_join_requests` fields:

| Field | Purpose |
|---|---|
| `id`, `gardenAddress`, `kind` | Opaque request ID; public garden scope; the current kind is `garden_membership` |
| `ciphertext`, `nonce`, `accountAddressKey` | One authenticated encrypted payload contains address, name, optional note, and optional decline reason; the keyed account digest supports lookup without storing a raw address |
| `state` | `pending`, `welcomed`, or `declined`; decline requires a reason |
| `requestedVia` | `garden_detail` in the current slice |
| `requestedAt`, `expiresAt`, `resolvedAt`, `updatedAt`, `revision` | Lifecycle timestamps plus a monotonic compare-and-set revision |

**NET-NEW request indexes:** `UNIQUE(gardenAddress, accountAddressKey) WHERE state = 'pending'`; queue scan `(gardenAddress, state, requestedAt DESC, id DESC)`; member history `(gardenAddress, accountAddressKey, requestedAt DESC)`. The partial constraint permits a re-request immediately after decline without allowing two active requests.

The implemented `garden_join_request_proofs` companion table stores only a domain-separated keyed digest of each proof nonce and its expiry. It stores no raw nonce, address, name, note, reason, request ID, or signature. The digest is unique and is deleted at proof expiry, so a withdrawn request cannot be reopened with the same proof.

The agent remains a direct SQLite service (`packages/agent/src/services/db.ts:35-48`) and its schema is initialized in `packages/agent/src/services/db/schema.ts:3-112`. **NET-NEW:** add this table, migration, and narrowly named query helpers there; do not add a second data store.

### 2.2 Lifecycle and retention — locally authorized; production activation gated

| Rule | Proposal |
|---|---|
| Pending expiry | Hard-delete an unanswered pending row after **30 days**. It has no fourth visible state; the member can ask again. |
| Resolved retention | Keep welcomed/declined text for **30 days** after resolution so the member can read the outcome, then hard-delete it. |
| Member withdrawal | `DELETE` only removes the caller's pending row immediately; it has no on-chain effect. The hash-only guard remains only until proof expiry to reject a replay. |
| Encryption | Encrypt address, name, note, and reason at rest; the RESR-64 record must name the key owner, rotation, backup, and deletion mechanism before any collection begins. |
| Analytics | Retain aggregate, non-identifying event counts only; never retain address, note, reason, signature, request ID, or garden ID in analytics. |

These defaults were authorized for local implementation on 2026-08-27. Production collection remains blocked until the activation requirements in `status.json` are satisfied.

## 3. API and proof contract

### 3.1 Shared contracts and routes

Existing browser contracts are framework-free shared types (`packages/shared/src/public-contracts/index.ts:14-74`) and public routes are composed in the agent server (`packages/agent/src/api/server.ts:118-136`). **NET-NEW:** add `join-requests.ts` to that shared contracts surface, including validators, response types, route constants, and error codes. The agent adds one route module; it does not add a second API framework.

**NET-NEW September dual-use:** the current closed-garden client creates only `garden_membership`, which derives `requestedVia: garden_detail`. Once RESR-64 accepts the September slice, the Community first-action flow creates `community_membership`, deriving `requestedVia: community_first_action`. Both kinds use the same table, proofs, endpoints, three visible states, retention, and operator flow. Until that gate clears, the agent rejects `community_membership` with `409 kind_not_enabled`; no September UI is implied by this data contract.

| Route | Auth | Request / response behavior |
|---|---|---|
| `POST /public/gardens/:garden/join-requests` | Member create proof in `Authorization` | Body: display name, optional note, and `requestedVia: garden_detail`. Returns `201` for a new request or `200` when a newly signed request converges on the existing active row. |
| `GET /public/gardens/:garden/join-requests/me` | Member `JoinQueueAccessV1` proof in `Authorization` | Returns only the caller's request ID, state, reason when declined, timestamps, and `canAskAgain`. No background polling or stored bearer token. |
| `GET /public/gardens/:garden/join-requests?state=pending&cursor=…&limit=…` | Operator/owner list proof in `Authorization` | Returns only that garden's rows plus `nextCursor`. Default 25, maximum 100; cursor encodes `(requestedAt,id)`, never an address. |
| `POST /public/gardens/:garden/join-requests/:id/resolve` | Operator/owner `JoinQueueAccessV1` proof | Body is either `{ action: "welcome", expectedRevision }` or `{ action: "decline", reason, expectedRevision }`. Welcome returns `202` until a current gardener-role read succeeds, then `200` welcomed; decline is `200`. |
| `DELETE /public/gardens/:garden/join-requests/me` | Member withdrawal proof in `Authorization` | Withdraws only a pending request and returns `{ ok: true }`; welcomed/declined history remains readable until its retention window ends. |

The API uses `Cache-Control: no-store`. Every protected request sends `Authorization: GG-JoinProof <base64url(JSON proof envelope)>`; signatures never appear in query parameters. The proof envelope includes the fields needed to reconstruct the exact personal-sign message on the server.

**NET-NEW response/error contract:** successful detail responses are `{ ok: true, request: { id, kind, state, revision, requestedVia, requestedAt, expiresAt, resolvedAt?, reason?, canAskAgain } }`; list responses add `{ items, nextCursor? }`. Use `400 invalid_request`, `401 invalid_signature`, `403 garden_role_required`, `404 request_not_found`, `409 already_member|idempotency_conflict|kind_not_enabled|resolution_conflict`, `410 request_expired|request_withdrawn`, `429 rate_limited`, `503 chain_reader_unavailable`, and the existing `500 internal_error` shape. No response includes a signature, token, keyed digest, or encrypted field.

**Deferred idempotency work:** the current transport does not send `Idempotency-Key` or automatically retry a write with the same proof. Durable proof-digest claims reject a reused write proof, while the active-row constraint makes a newly signed retry return the existing pending request. After an unknown write outcome, the client asks the member to check status or sign a new retry. A response cache for same-key/same-proof retries remains future work and must not be described as shipped behavior.

### 3.2 Signature binding — selected path

The canonical proof is a personal-sign signature over the UTF-8 bytes returned by `buildGardenJoinProofMessage`. The message is a newline-joined sequence with this fixed order: title, version, chain ID, normalized garden, normalized account, action, normalized nonce, issued time, expiry time, then present request ID, cursor, expected revision, display name, note, reason, requested-via, state, and limit fields. User-controlled string values escape backslash, carriage return, and newline as `\\`, `\r`, and `\n` before joining, so content cannot create a second field. The client signs this exact string and the agent reconstructs the same string after validation.

Create, read, list, withdrawal, welcome, and decline all use that same personal-sign encoding with different bound action and content fields. Five-minute issue/expiry validation, garden matching, action matching, cursor/revision matching, and nonce replay claims prevent a proof from being reused for another operation. The signature itself is never written to SQLite or logs.

**NET-NEW verification order:**

1. Validate the proof envelope, timestamps, expected action, and garden binding before signature verification.
2. Rebuild the canonical personal-sign message from the validated proof and request content.
3. Use the shared viem signature verifier for EOA personal-sign recovery, deployed ERC-1271 accounts, and counterfactual EIP-6492 accounts. Reject any proof that does not verify for the bound account.

The current passkey flow creates a Kernel smart account from the WebAuthn credential (`packages/shared/src/workflows/authServices.ts:350-388`), so an EOA-only verifier would fail the first join for a never-transacted passkey account. **NET-NEW:** inject a narrow `JoinQueueChainReader` into the agent API for the configured EIP-6492 universal-validator `eth_call` and current operator/owner/gardener role reads; the current API dependency surface does not provide one (`packages/agent/src/api/http/server.types.ts:35-70`). Its validator address and RPC operator must be accepted in the RESR-64 record and come from a checked-in deployment configuration. This is the only additional server dependency, not a transaction signer or protocol admin key.

The current client treats gardener or operator as garden membership (`packages/shared/src/hooks/garden/useJoinGarden.ts:159-175`). **NET-NEW:** after proof verification but before storage, create checks those current roles through `JoinQueueChainReader`; either role returns `409 already_member` and creates no row. The current admin membership view maps gardeners to `operations.addGardener` (`packages/admin/src/views/Garden/ManageMembers.tsx:31-38`), whose shared operation simulates then calls the Hats module's `grantRole` (`packages/shared/src/hooks/garden/createGardenOperation.ts:221-299`).

**NET-NEW resolution concurrency rule:** before every resolve, the agent reads the same gardener-or-operator membership predicate used at creation. If either role exists, it atomically writes `welcomed` regardless of a prior decline: observed on-chain membership is authoritative. Otherwise, decline is `UPDATE … WHERE state = pending AND revision = expectedRevision`, incrementing `revision`; a stale decline returns `409 resolution_conflict`. Welcome first reuses the existing client transaction, then reads the gardener-or-operator predicate again. If both roles are still absent and the row is pending, return `202`; if it is declined, return `409 resolution_conflict`. If the transaction reports the address already has membership, the admin still calls resolve so the role read can converge the queue.

**NET-NEW reconciliation rule:** `GET …/me` checks that one account's gardener-or-operator membership before responding; the operator list performs the same predicate reads in a bounded batch for its returned page. Any observed member is atomically marked `welcomed`, including an operator-only account. This is how a manually added address converges after an agent outage; it is a read-time check, not an automatic add or a background job. This keeps only the three member-visible states and never reports a false welcome.

## 4. Client and admin behavior

### 4.1 Member

**NET-NEW:** a closed, non-member garden card shows **Ask to join**. The form contains chosen display name and an optional note. A successful create shows **Asked to join**, then **Waiting for a steward**. An explicit **Check update** uses a read proof; the client never triggers a surprise passkey prompt in the background. A decline shows its reason and **Ask again**; withdrawal is available while pending.

The existing Home empty state directs members to seek an open garden or ask an operator to add them (`packages/client/src/views/Home/GardenList.tsx:108-140`). The Profile list filters out closed, non-member gardens and routes shown non-members through self-join (`packages/client/src/views/Profile/GardensList.tsx:38-58`, `packages/client/src/views/Profile/GardensList.tsx:189-211`). **NET-NEW:** those are the two client placements for closed-garden requests.

`waiting_for_hat` starts and ends from observed Hat membership, never from an optimistic queue row. The Community plan already specifies the same zero-retry wait for `need`, `needSignal`, and `testimony` (`spec.md:227-233`).

### 4.2 Operator

**NET-NEW:** add **Waiting to join** as a section of the existing Manage Members dialog launched from `/community/members` — never in `/community/needs` and never as a standalone route. A row shows chosen name, abbreviated address, requested time, and a note marker; its detail shows the optional note. **Welcome in** calls `addGardener(address)` when the account is not already a member and waits for the gardener-or-operator membership read. **Decline** requires a reason and has no on-chain effect.

The existing dialog is the flat role roster and add-member surface (`packages/admin/src/components/Garden/ManageMembersDialog.tsx:37-67`, `packages/admin/src/components/Garden/ManageMembersDialog.tsx:91-129`). **NET-NEW:** an operator sees the usual queue rows plus a calm aggregate banner such as “Some requests were rate-limited recently”; it never reveals throttled addresses or note text.

## 5. Abuse, copy, analytics, and inventory

The browser API already checks allowed origins and derives public rate-limit keys (`packages/agent/src/api/http/public.ts:33-65`; `packages/agent/src/api/public-protection.ts:81-107`). Its conversational `join` limit is three per day (`packages/agent/src/services/rate-limiter.ts:88-93`). **NET-NEW:** the browser route gets a distinct `join_request_create` policy: three creates per account/garden per 24 hours, ten per IP/garden per ten minutes, fifty new requests per garden per 24 hours, and a hard cap of one hundred pending requests per garden. The database cap and active-row constraint remain effective if an in-memory limiter restarts.

**NET-NEW i18n key families:** `app.garden.joinRequest.*` (`askToJoin`, `askedToJoin`, `waitingForSteward`, `checkUpdate`, `askAgain`, `withdraw`) and `admin.garden.joinRequest.*` (`waitingToJoin`, `welcomeIn`, `decline`, `reasonRequired`, `rateLimitedNotice`). Add each in en/es/pt using the copy above; no banned-vocabulary terms.

**NET-NEW analytics:** `join_request_created`, `join_request_create_rejected`, `join_request_status_checked`, `join_request_resolved`, `join_request_withdrawn`, and `join_request_expired`. Properties are counts and enums only: `kind`, `state`, `requestedVia`, `resolution`, `errorClass`, `isCounterfactual`, and `retry`. Never send address, garden, request ID, display name, note, reason, signature, or token.

**NET-NEW inventory delta:** add exactly two user-vocabulary actions using `prototypes.md` §16 conventions: `M-ask-to-join` and `O-welcome/decline`. They remain outside the August 39 until RESR-64 clears implementation.

## 6. Acceptance, exclusions, and RESR-64 decisions

- [ ] A passkey user can submit exactly one signed pending request for a closed garden, check status after an unknown outcome, retry with a newly signed proof, withdraw while pending, and read their own outcome.
- [ ] A duplicate create/resolve proof cannot replay within its expiry, including after withdrawal or decline; a newly signed create converges on the active row.
- [ ] The personal-sign verifier accepts counterfactual passkey accounts through EIP-6492, deployed smart accounts through ERC-1271, and EOAs through message recovery.
- [ ] An operator/owner can read only their garden's paginated queue, use the existing gardener transaction, and decline with a reason.
- [ ] Welcome follows an observed gardener role; it releases waiting work without consuming a retry.
- [ ] Concurrent welcome/decline actions converge on the observed gardener role, and an existing gardener/operator never receives a new request row.
- [ ] A request manually fulfilled while the agent is unavailable becomes welcomed on the next member or operator queue read.
- [ ] Pending, resolved, and withdrawn records follow the accepted expiry/deletion policy; no personal request field reaches logs or analytics.
- [ ] Rate limits, queue cap, and the aggregate operator spam signal are testable.
- [ ] Every string is added in en/es/pt and avoids the banned-vocabulary policy (`scripts/data/banned-vocabulary.json`).
- [x] API, database, and UI implementation is authorized locally; production request collection remains blocked by the activation checklist in `status.json`.

**Out of scope:** public on-chain requests; Linear-as-queue; implicit localStorage transport; a protocol admin key; automatic membership grants; a new pool job kind; a new admin workspace or route; September Community UI; and activation of `community_membership` before RESR-64 accepts it.

**RESR-64 approval questions (maximum 4):** confirm the proposed 30-day retention/expiry policy; name the controller, processor, and encryption/key owner; approve the EIP-6492 universal-validator deployment and RPC operator; and name the incident/support owner for deletion, rate-limit, and role-read failures.
