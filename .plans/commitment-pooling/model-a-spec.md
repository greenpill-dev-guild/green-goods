# Model A Spec — Attestation-based Commitment Pooling (July substrate) — 2026-06-28

> **Errata, 2026-06-28:** This file is a historical reference export, not the current source of
> truth. Current Linear framing replaces "Model A pool" language with one durable Green Goods
> Garden Commitment Pool identity/control plane. The proof/attestation capability attaches to that
> same `poolId`; future settlement/voucher capability also attaches to that same `poolId`. Do not
> build a disposable Model A pool. The earlier recommendation below to hold aggregate state in
> resolvers is superseded: resolvers validate attestations, while a shared pool
> control-plane/aggregator emits indexable pool stats for Envio.
>
> **Final planning alignment — 2026-06-29:** Use
> `lifecycle-and-aggregator-semantics.md` for the current proof-capability plan. V1 uses a
> `CommitmentPoolingModule` with a pool registry/control plane. A separately deployed aggregator is
> not required for V1 unless later implementation review proves a split is needed without changing
> `poolId` or UX.

> Companion to [`research-memo.md`](./research-memo.md). This is the **July-shippable** layer: commitments and fulfillment as on-chain EAS attestations, aggregate state surfaced to garden pages, riding the existing `Work`/role/hypercert rails. **Model B** (ERC-20 vouchers + owner-governed swap pool + seed/reserve) is explicitly out of scope here and snaps on later, reusing these attestations as proof-of-fulfillment.

## 1. Scope

**In:** commitment + fulfillment-confirmation EAS schemas and resolvers; per-garden aggregate state + indexing; operator config (caps, season, allowed types); default/non-fulfillment handling; the domain vs support/service distinction; the hypercert hand-off for domain commitments.

**Out (→ Model B):** ERC-20 vouchers, transferability, the swap pool, seed/collateral mechanics, reserve denomination (DAI/G$), cross-garden circulation. Model A commitments are **soulbound by nature** (attestations don't transfer), so they need **no seed and no reserve** — which is why this layer is small.

## 2. The commitment-type decision (answers "non-domain commitments?")

A single field `commitmentType` on the commitment splits two first-class kinds:

| Type | `actionUID` | Fulfillment evidence | Impact pipeline | Example |
| -- | -- | -- | -- | -- |
| `DOMAIN_ACTION` (0) | required, valid | a linked `Work` attestation (existing flow) | **yes** → hypercert/impact | "Plant 200 seedlings" (AGRO), "Install panel" (SOLAR) |
| `SUPPORT_SERVICE` (1) | `0` | the confirmer's own attested evidence | **no** (pool-only) | "Cook for the work day", "Lend my truck", "Watch kids while we plant" |

**Guardrail:** support/service commitments circulate in the pool (reciprocity, credit, relationships) but are **never counted as regenerative impact** and never auto-mint a hypercert — keeping the impact ledger clean. Operators choose which types their garden's pool allows (config, §8), so a garden can stay impact-only or open up to full mutual aid.

## 3. Commitment lifecycle (state machine)

```
PROPOSED ──issue──▶ OPEN ──evidence+confirm──▶ FULFILLED ──(domain)──▶ HYPERCERT-ELIGIBLE
   │                  │                              │
   │                  ├──dispute──▶ DISPUTED ──operator──▶ FULFILLED | DEFAULTED
   │                  └──expiry (season end)──▶ EXPIRED/DEFAULTED
```

- **OPEN** = issued, awaiting fulfillment within the season window.
- **FULFILLED** = a valid `FulfillmentConfirmation` exists (counterparty default; operator fallback).
- **DEFAULTED/EXPIRED** = unfulfilled at season end, or operator-marked. Model A "clawback" = a **state transition + event** (no token to claw — soulbound). Reputation consequence is deferred to GreenWill; for now it dings the issuer's open-exposure.

## 4. Schemas (EAS)

Follows the repo convention (explicit `bytes32` UID links, `uint8` enums) seen in `Schemas.sol`. Both schemas register the **garden account** as the attestation `recipient` so resolvers can call `IGardenAccessControl(recipient)` exactly like `Work.sol:96`.

### CommitmentSchema
```solidity
struct CommitmentSchema {
    uint8   commitmentType;   // 0 DOMAIN_ACTION, 1 SUPPORT_SERVICE
    uint256 actionUID;        // domain action ref; required iff DOMAIN_ACTION, else 0
    address beneficiary;      // 0x0 = open offer/request to the garden
    string  title;            // short label
    string  description;
    uint256 value;            // amount in base units
    uint8   unit;             // 0 = HOURS (default); extensible
    uint64  expiry;           // 0 = use garden season window
    string  metadata;         // CID for media/detail
}
```

### FulfillmentConfirmationSchema
```solidity
struct FulfillmentConfirmationSchema {
    bytes32 commitmentUID;     // the Commitment being confirmed
    bytes32 workUID;           // linked Work attestation; required iff commitment is DOMAIN_ACTION, else 0x0
    bool    fulfilled;         // confirm (true) or dispute (false)
    uint8   confidence;        // 0–3  (reuses Confidence enum)
    uint8   verificationMethod;// bitmask HUMAN|IOT|ONCHAIN|AGENT (reuses VerificationMethod, ≤ 15)
    string  notesCID;
}
```

Reuses the **exact** `confidence` (0–3) and `verificationMethod` (4-bit bitmask) semantics already validated in `WorkApproval.sol:170,175` and defined in `shared/src/types/domain.ts:102` — so IoT/agent capture needs nothing new.

## 5. Resolvers (new EAS `SchemaResolver`s)

Both extend `SchemaResolver + OwnableUpgradeable + UUPSUpgradeable` and gate in `onAttest`, mirroring `Work`/`WorkApproval`. Singletons holding per-garden state in a `mapping(address garden => …)`.

### CommitmentResolver.onAttest
1. schema UID match (if set).
2. **attester is gardener|operator** of `recipient` (reuse `IGardenAccessControl`; mirrors `Work.sol:101`).
3. `title` + `description` non-empty; `value > 0`; `commitmentType ∈ {0,1}`.
4. **If `DOMAIN_ACTION`:** `actionUID != 0`, action exists + active + not expired, and **`gardenHasDomain(recipient, action.domain)`** (mirrors `Work.sol:118-134`). **If `SUPPORT_SERVICE`:** `actionUID == 0` and **garden config allows support commitments** (§8).
5. **Cap check:** issuer's current open exposure + `value` ≤ operator cap (§8).
6. Record OPEN in per-garden state; emit `CommitmentOpened(garden, commitmentUID, issuer, type, value)`.

### FulfillmentConfirmationResolver.onAttest
1. references a valid **OPEN** commitment in the same garden.
2. **`attester != commitment.issuer`** — the self-attestation block (the D1 invariant; mirrors `WorkApproval.sol:154`).
3. **Confirmer authority:** `attester == commitment.beneficiary` (counterparty path) **OR** `isOperator(attester)` (fallback/escalation). For open offers (`beneficiary == 0x0`) the actual recipient is recorded as confirmer.
4. **Anti-collusion escalation:** if `commitment.value > garden.escalationThreshold`, **require `isOperator(attester)`** (operator co-sign above the cap) — §6 sybil model.
5. **If commitment is `DOMAIN_ACTION`:** require `workUID` references a valid `Work` attestation whose attester == `commitment.issuer` and `actionUID == commitment.actionUID` (ties the impact claim to real domain work). **If `SUPPORT_SERVICE`:** `workUID` may be `0x0`; the confirmation + its `notesCID`/`verificationMethod` stand as the evidence.
6. `confidence ≤ 3`, `verificationMethod ≤ 15`.
7. On `fulfilled`: mark FULFILLED, decrement issuer open-exposure, emit `CommitmentFulfilled(...)`. On `!fulfilled`: mark DISPUTED → operator resolves.

## 6. Aggregate state & surfacing (the rung-4 answer)

**Recommendation: hold aggregate state *in the resolvers* and index their events — no separate aggregator contract for v1.** The resolvers already run on every attest; keep `mapping(garden => CommitmentStats{open, fulfilled, defaulted, valueCirculating, perIssuerExposure})` there and emit `CommitmentOpened/Fulfilled/Defaulted`.

This is the honest fix for "EAS isn't Envio-indexed": the **resolver contracts** are normal contracts whose events Envio *can* index. **Add the two resolvers to `packages/indexer/config.yaml`** (small, bounded change) → garden pages read aggregate pool state from Hasura like they read vault state today. Individual commitments/confirmations remain EAS reads (GraphQL), same as work today. **No bespoke agent API** — which is what we wanted.

*(A dedicated per-garden `CommitmentPool` registry, provisioned via `onGardenMinted`, is the natural upgrade if state outgrows the resolver; deferred.)*

## 7. Roles (Hats, reused)

| Role | Capability |
| -- | -- |
| Owner | enable/disable the garden pool; final policy; emergency pause |
| **Operator** | configure pool (allowed types, caps, escalation threshold, season window); seed/approve fulfillment (fallback); resolve disputes; mark default |
| **Gardener** | issue commitments (domain or support), submit `Work` evidence for domain ones, request help |
| **Community** | discover/request; **confirm fulfillment as the counterparty** (the D1 default path) |
| Evaluator | quality-grade fulfilled domain commitments via `Assessment` (optional) |
| Funder | (Model B) seed reserve; view reporting |

## 8. Operator config (per garden)

Stored alongside resolver state, writes gated to operator/owner via `IGardenAccessControl`:
`allowedTypes` (domain-only | support-only | both), `maxOpenValuePerIssuer` (cap), `escalationThreshold` (operator-co-sign cap), `seasonStart`/`seasonEnd` (default expiry window). Ties commitment pooling to the **Seasons** primitive: a season is the seed→commit→fulfill→settle window.

## 9. Connections out

- **Hypercerts:** a FULFILLED `DOMAIN_ACTION` commitment is hypercert-eligible — operator registers a hypercert allowlist (`Hypercerts.sol:139`), fractions become the ownable proof, and the `YieldResolver` buys them **conviction-weighted** → funding seeds the next season. Support/service commitments do **not** enter this path.
- **Conviction pools:** commitment pools (action/service) feed fulfilled-impact into the conviction-weighted funding the garden already runs (decision → capital → action). The seam exists in `Yield.sol`; deepen by surfacing fulfilled commitments as conviction-pool signal candidates.

## 10. July build checklist

1. `CommitmentSchema` + `FulfillmentConfirmationSchema` registered (EAS), UIDs in deployment artifacts.
2. `CommitmentResolver` + `FulfillmentConfirmationResolver` (UUPS) with the `onAttest` logic above + per-garden stats/config + events.
3. Indexer: add both resolvers' events to `config.yaml` + handlers + `schema.graphql` entities (Commitment, FulfillmentConfirmation, CommitmentStats).
4. Shared hooks (`@green-goods/shared`): `useGardenCommitments`, `useCreateCommitment`, `useConfirmFulfillment`, `useCommitmentPoolStats` (mutation hooks in shared per the hook-boundary rule).
5. PWA: replace the `WalletDrawer` "Pools" `ComingSoonStub` with the commitment surface (offer/request/seed/mark-fulfilled), mutual-aid copy.
6. Admin: garden "Commitments" config + dispute/default controls + exposure risk flags.
7. Editorial: garden-page pool story (made / fulfilled / circulating) from indexed stats.

## 11. Open questions specific to Model A

- **Base unit:** HOURS as the only v1 unit, or a generic point with a per-pool label? (Recommend: HOURS, single unit, defer richer units.)
- **Open-offer matching:** when `beneficiary == 0x0`, how does a recipient "claim" an open offer before confirming — a lightweight `Claim` attestation, or just first-confirmer-wins? (Recommend: lightweight claim to prevent races.)
- **Dispute UX:** operator resolves DISPUTED → does it need an evidence round, or just an operator decision in v1? (Recommend: operator decision + notes for v1.)
- **Season default vs per-commitment expiry:** allow per-commitment override of the garden season window, or force season-aligned? (Recommend: season-aligned default, operator override allowed.)
