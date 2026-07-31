# Community Needs & Signals: Architecture Diagrams

**Feature Slug**: `community-interface`  
**Stage**: `active`  
**Updated**: 2026-07-27
**Source of truth**: `spec.md`. These diagrams answer implementation and communication questions; they do not introduce contract behavior.

## Visual index

| Asset | Audience | Question answered | Owning source | Validation |
|---|---|---|---|---|
| D1 system and read context | contracts, indexer, shared, UI | Which system owns each record and join? | `spec.md` §§2–4, 14 | Mermaid parse + boundary review |
| D2 package and surface placement | shared, client, Community, admin, ops | Where does each experience ship and what must exist first? | `spec.md` §§8–10, 14 | Mermaid parse + monorepo/host review |
| D3 joined-read ERD | contracts, indexer, evaluator | How do EAS records and Envio lineage relate without cross-indexing? | `spec.md` §§3–4, 10–11 | Mermaid parse + schema/event review |
| D3a EAS reference graph | contracts, shared, auditors | Which relationship lives in the EAS envelope, and why does merge remain custom data? | `spec.md` §3 | Exact schema/refUID review |
| D4 moderation state machine | contracts, shared, UI | How do moderation, reopen, and visibility behave? | `spec.md` §§3–4 | Mermaid parse + resolver/view-model tests |
| D5 progress state machine | shared, UI, evaluator | How is progress derived independently from moderation? | `spec.md` §4 | Mermaid parse + selector tests |
| D6 retraction and visibility | shared, UI, evaluator | What remains visible after moderation or author retraction? | `spec.md` §4 | Mermaid parse + role fixtures |
| D7 member write sequence | member UI, shared, contracts | How does a Need move from draft to EAS and protocol lineage? | `spec.md` §§5–8 | Mermaid parse + offline/EAS tests |
| D8 waiting-for-membership sequence | research, shared, Community, admin | What is stored while membership is pending, and what remains undecided? | `spec.md` §§5, 7; `research-plan.md` | Mermaid parse + RESR-64 decision evidence |
| D9 triage and commitment seeding | admin, contracts, evaluator | How does operator moderation become a separately confirmed commitment? | `spec.md` §§9, 11 | Mermaid parse + admin/contract tests |
| D10 funding verification | client, shared, funder | When may an attribution count and how does failure recover? | `spec.md` §10 | Mermaid parse + receipt fixtures |
| D11 evaluator export | admin, shared, evaluator | What sources must be complete before CSV/JSON export? | `spec.md` §§4, 9, 11 | Mermaid parse + export fixtures |
| D12 permissions and responsibility | all lanes | Who may read, write, moderate, fund, seed, confirm, and export? | `spec.md` §§3–11 | Mermaid parse + access-control review |
| D13 cross-surface flow | product, design, ops | Which surface owns each step without adding a public route? | `spec.md` §§8–10, 14 | Mermaid parse + route/host review |

## D1. System context and joined-read boundary

```mermaid
flowchart LR
  subgraph PEOPLE["People"]
    MEMBER["Community member"]
    PROVIDER["Gardener / commitment provider"]
    OPERATOR["Garden operator"]
    EVALUATOR["Evaluator"]
    FUNDER["Funder"]
    STEWARD["Protocol steward"]
  end

  subgraph APPS["Green Goods applications"]
    COMMUNITY["Community PWA<br/>packages/community<br/>community.greengoods.app"]
    ADMIN["Admin /community/needs"]
    CLIENT["Existing client public<br/>garden / impact / funding surfaces"]
    SHARED["Shared joined-read service<br/>and generic foundations"]
  end

  subgraph ARB["Arbitrum records"]
    EAS["EAS<br/>Need / NeedSignal / NeedStatus<br/>Testimony / FundingAttribution"]
    PROTOCOL["Green Goods contracts<br/>Commitment / Work / Approval<br/>Assessment / Hypercert"]
    ENVIO["Envio<br/>Green Goods protocol events only"]
  end

  RECEIPTS["Canonical funding receipts<br/>supported direct rail / GardenVault"]

  MEMBER --> COMMUNITY
  PROVIDER --> COMMUNITY
  OPERATOR --> ADMIN
  EVALUATOR --> ADMIN
  FUNDER --> CLIENT
  STEWARD --> ADMIN

  COMMUNITY --> SHARED
  ADMIN --> SHARED
  CLIENT --> SHARED
  COMMUNITY -->|"member attestations"| EAS
  ADMIN -->|"operator attestations"| EAS
  CLIENT -->|"optional attribution attestation"| EAS
  ADMIN -->|"seed / operate commitments"| PROTOCOL
  PROTOCOL --> ENVIO
  EAS -->|"EAS GraphQL"| SHARED
  ENVIO -->|"protocol GraphQL"| SHARED
  RECEIPTS -->|"verification adapter"| SHARED
```

Hard boundary: Envio never indexes EAS or raw funding transfers. EAS does not become a protocol-event index. `@green-goods/shared` owns the explicit EAS + Envio + funding-proof join and exposes one normalized result to every consumer.

## D2. Package placement and prerequisite boundary

```mermaid
flowchart TD
  EXISTING["Existing packages/client behavior"]
  EXTRACT["Prerequisite shared-foundation lane<br/>runtime + chain providers<br/>auth/passkey + callbacks<br/>offline/install/update/error<br/>adaptive-shell slots"]
  PROVE["Behavior-preserving client<br/>build + auth + offline proof"]
  COMMUNITY["Then scaffold packages/community<br/>independent PWA"]

  EXISTING --> EXTRACT --> PROVE --> COMMUNITY

  SHARED["@green-goods/shared<br/>generic foundations + hooks"]
  CLIENT["packages/client<br/>existing public routes<br/>own nav / manifest / SW / telemetry / copy"]
  CPWA["packages/community<br/>Needs / Create / Profile<br/>own nav / manifest / SW / telemetry / copy"]
  ADMIN["packages/admin<br/>/community/needs: triage / gathering / seed / lineage<br/>/community/coordination: pools / cycles"]

  EXTRACT --> SHARED
  SHARED --> CLIENT
  SHARED --> CPWA
  COMMUNITY --> CPWA

  HOST1["Existing client host"]
  HOST2["community.greengoods.app<br/>localhost:3010"]
  HOST3["Existing admin host"]
  CLIENT --> HOST1
  CPWA --> HOST2
  ADMIN --> HOST3
```

The packages share foundations, not application identity. Their routes, navigation, manifests, service-worker scopes, telemetry identities, and application copy remain separate. Need-specific operator/evaluator work stays in admin `/community/needs`; pool/cycle operations stay in `/community/coordination`; funder discovery stays in the existing client public surfaces.

## D3. EAS + Envio joined-read ERD

```mermaid
erDiagram
  GARDEN ||--o{ NEED : receives
  MEMBER ||--o{ NEED : authors
  NEED ||--o{ NEED_SIGNAL : receives
  NEED ||--o{ NEED_STATUS : moderated_by
  NEED ||--o{ FUNDING_ATTRIBUTION : contextualizes
  NEED ||--o{ COMMITMENT : motivates
  COMMITMENT ||--o{ WORK : evidenced_by
  WORK ||--o{ APPROVAL : approved_by
  COMMITMENT ||--o{ ASSESSMENT : assessed_by
  COMMITMENT ||--o{ TESTIMONY : witnessed_by
  COMMITMENT }o--|| CYCLE : belongs_to
  CYCLE ||--o| HYPERCERT : produces

  NEED {
    bytes32 uid PK
    address recipient "garden"
    bytes32 refUID "zero"
    address attester "author"
    string statementCID
    string desiredOutcomeCID
    uint8 horizon
    string mediaCID
    boolean revoked
  }
  NEED_SIGNAL {
    bytes32 uid PK
    bytes32 refUID FK "Need UID"
    address recipient "same garden"
    address attester
    boolean support
    boolean revoked
  }
  NEED_STATUS {
    bytes32 uid PK
    bytes32 refUID FK "Need UID"
    address recipient "same garden"
    uint64 timeCreated
    uint8 status
    uint8_array domains
    bytes32 mergedIntoNeedUID
    string noteCID
  }
  FUNDING_ATTRIBUTION {
    bytes32 uid PK
    bytes32 refUID FK "Need UID"
    address recipient "same garden"
    uint256 chainId
    bytes32 txHash
    address token
    uint256 amount
    uint8 rail
  }
  COMMITMENT {
    string id PK
    int chainId
    bytes32 needUID FK
    uint8_array domains
    uint256_array requiredActionUIDs
    string state
  }
  WORK {
    string id PK
    int chainId
    bytes32 workUID
  }
  APPROVAL {
    string id PK
    int chainId
    bytes32 approvalUID
  }
  ASSESSMENT {
    string id PK
    int chainId
    bytes32 assessmentUID
  }
  TESTIMONY {
    bytes32 uid PK
    uint256 commitmentId FK
  }
  HYPERCERT {
    string id PK
    int chainId
    bytes32_array needUIDs
  }
```

Source ownership:

- EAS GraphQL: Need, NeedSignal, NeedStatus, Testimony, and FundingAttribution.
- Envio: Green Goods Commitment, Work, Approval, Assessment, Cycle, and Hypercert entities, all with `chainId` and composite IDs.
- Shared: envelope normalization, status winner selection, canonical directional-signal winner selection, funding verification/de-duplication, retraction tombstones, progress derivation, source-health states, and the final joined graph.
- DomainImpact commitment arrays are positional: `domains[i]` pairs with `requiredActionUIDs[i]`; UID `0` is valid because array presence expresses binding.

## D3a. EAS envelope relationships and resolver routing

```mermaid
flowchart LR
  subgraph REGISTRY["EAS SchemaRegistry — four immutable records"]
    NS["Need schema<br/>revocable"]
    SS["NeedSignal schema<br/>revocable"]
    STS["NeedStatus schema<br/>non-revocable"]
    FS["FundingAttribution schema<br/>non-revocable"]
  end

  subgraph RESOLVERS["Two UUPS resolver proxies"]
    CNR["CommunityNeedsResolver<br/>exact UID dispatch<br/>Need · Signal · Status"]
    FAR["FundingAttributionResolver<br/>ungated funding blast wall"]
  end

  NEED["Need attestation<br/>recipient = garden<br/>refUID = 0"]
  SIGNAL["NeedSignal attestation<br/>data = bool support"]
  STATUS["NeedStatus attestation<br/>moderation + optional domains"]
  FUNDING["FundingAttribution attestation<br/>receipt fields"]
  MERGE["Optional mergedIntoNeedUID<br/>second Need relationship"]

  NS --> CNR
  SS --> CNR
  STS --> CNR
  FS --> FAR
  CNR --> NEED
  CNR --> SIGNAL
  CNR --> STATUS
  FAR --> FUNDING
  SIGNAL -->|"EAS refUID"| NEED
  STATUS -->|"EAS refUID"| NEED
  FUNDING -->|"EAS refUID"| NEED
  STATUS -.->|"custom-data second relation"| MERGE
  MERGE --> NEED
```

`recipient` is always the garden and `refUID` is the sole parent-Need relationship. Resolvers validate the referenced record's exact Need schema, recipient, revocation, and expiration state because EAS existence alone does not enforce those domain invariants. Parent revocation does not mutate child history; active readers exclude descendants while retaining authorized provenance.

## D4. Moderation axis

```mermaid
stateDiagram-v2
  [*] --> None
  None --> Acknowledged: acknowledge
  Acknowledged --> Acknowledged: acknowledge again
  Acknowledged --> Merged: merge + target + rationale
  Acknowledged --> Hidden: hide + rationale
  Acknowledged --> Declined: decline + rationale
  None --> Merged: merge + target + rationale
  None --> Hidden: hide + rationale
  None --> Declined: decline + rationale
  Merged --> Acknowledged: reopen + rationale
  Hidden --> Acknowledged: reopen + rationale
  Declined --> Acknowledged: reopen + rationale
  Merged --> Hidden: newer status + rationale
  Merged --> Declined: newer status + rationale
  Hidden --> Merged: newer status + target + rationale
  Hidden --> Declined: newer status + rationale
  Declined --> Merged: newer status + target + rationale
  Declined --> Hidden: newer status + rationale
```

The winning NeedStatus is the greatest tuple `(timeCreated, uid)`, comparing UID as unsigned `bytes32` when timestamps tie. `none` is the absence of a status attestation. The resolver requires a rationale for merge, hide, decline, and any acknowledged status that reopens one of them.

## D5. Progress axis

```mermaid
stateDiagram-v2
  [*] --> Open
  Open --> Committed: linked Commitment created
  Committed --> InProgress: accepted or approved Work counted
  InProgress --> Addressed: linked Commitment fulfilled
  Committed --> Addressed: another linked Commitment fulfilled
```

Progress is monotonic and derives from the highest evidence state reached across all linked commitments. It does not reset when moderation changes and it is never inferred from funding.

## D6. Visibility, redirect, and retraction policy

```mermaid
flowchart TD
  LOAD["Load normalized Need"] --> REVOKED{"Need revoked<br/>by author?"}
  REVOKED -->|"yes, no lineage"| OMIT["Remove from boards and detail"]
  REVOKED -->|"yes, linked lineage"| TOMB["Content-free tombstone<br/>needUID + retracted true<br/>Withdrawn by author"]
  REVOKED -->|"no"| MOD{"Winning moderation"}
  MOD -->|"none / acknowledged"| PUBLIC["Visible under garden policy"]
  MOD -->|"merged"| REDIRECT["Redirect to typed<br/>mergedIntoNeedUID"]
  MOD -->|"hidden"| OPONLY["Operator-only"]
  MOD -->|"declined"| LIMITED["Author + operator only"]
  TOMB --> LINEAGE["Commitment / Hypercert / evaluator lineage<br/>keeps UID, never cached words or media"]
```

Retraction is not a third lifecycle axis. It is an EAS revocation that suppresses content while preserving immutable references. Moderation does not revoke or erase the Need.

## D7. Need to promise to work to proof

```mermaid
sequenceDiagram
  autonumber
  actor M as Community member
  participant PWA as Community PWA
  participant Q as Shared offline queue
  participant EAS as EAS on Arbitrum
  participant JOIN as Shared joined read
  actor O as Garden operator
  participant ADMIN as Admin /community/needs
  participant CP as Commitment module
  participant IDX as Envio

  M->>PWA: describe the problem in their own words
  M->>PWA: record or type statement and desired outcome
  PWA->>Q: persist need job and media references
  alt Community Hat observed and online
    Q->>EAS: attest Need
    EAS-->>Q: Need UID
  else offline or membership pending
    Q-->>PWA: offline-queued or waiting_for_hat
  end
  EAS-->>JOIN: Need from EAS GraphQL
  O->>ADMIN: acknowledge and apply zero or more domains
  ADMIN->>EAS: attest NeedStatus
  O->>ADMIN: seed from Need
  ADMIN->>CP: create commitment with confirmed needUID, domains, and action array
  CP-->>IDX: protocol events with composite IDs
  IDX-->>JOIN: Commitment, Work, Approval, Assessment, Hypercert
  EAS-->>JOIN: Testimony and current NeedStatus
  JOIN-->>PWA: words to promise to work to proof thread
```

The seeding form may prefill domains, but confirmation defaults come from commitment direction: Request creator/Need author, or the accepted Offer recipient. The accepted provider is excluded and an unreachable threshold blocks acceptance. The operator confirms every commitment field. Community v1 does not expose claiming or work submission.

## D8. Offline and waiting-for-membership sequence

```mermaid
sequenceDiagram
  autonumber
  actor M as Member
  participant PWA as Community PWA
  participant Q as Shared queue
  participant JR as Join-request transport
  actor O as Operator
  participant H as Community Hat
  participant EAS as EAS

  M->>PWA: create Need, signal, or testimony
  PWA->>Q: save versioned need / needSignal / testimony job
  alt offline
    Q-->>PWA: saved offline, Edit / Cancel / Delete
  end
  Q->>H: observe membership
  H-->>Q: not a member
  Q->>Q: enter waiting_for_hat
  Note over Q: no network attempt and no retry consumed
  PWA->>JR: submit separate join request
  Note over JR,O: transport blocked on RESR-64 through 2026-08-12
  JR-->>O: reviewable request after decision gate
  O->>H: mint Community Hat after approval
  H-->>Q: membership observed
  Q->>Q: resume with full five-attempt budget
  Q->>EAS: attest saved job
  alt resolver, sponsorship, upload, or network failure
    EAS-->>Q: retryable failure
    Q-->>PWA: keep draft, Retry / Edit / Cancel
  else account revoked, request rejected, draft deleted, or member cancels
    Q-->>PWA: terminal, remove optimistic card
  end
```

`waiting_for_hat` stores the pending product write, never the join request. Public on-chain requests, Linear-as-queue, and implicit localStorage transport are excluded. NeedStatus and FundingAttribution are online-only actions.

## D9. Operator triage to commitment seeding

```mermaid
sequenceDiagram
  autonumber
  actor O as Operator
  participant A as Admin /community/needs
  participant EAS as EAS
  participant J as Shared joined read
  participant CP as Commitment module
  participant IDX as Envio

  O->>A: open fresh Needs for gathering
  A->>J: load EAS Needs plus Envio lineage
  O->>A: acknowledge, merge, hide, decline, or reopen
  A->>EAS: attest typed NeedStatus
  EAS-->>J: select greatest (timeCreated, uid)
  O->>A: choose Seed a commitment
  A->>A: prefill needUID and optional domains
  A->>O: review pool, cycle, direction, provider, units, evidence, actions, confirmer, reward, timing
  O->>CP: createCommitment with confirmed fields
  CP-->>IDX: CommitmentCreated
  IDX-->>J: linked protocol record
  J-->>A: moderation and progress shown as separate fields
```

The Need-specific admin action lives under `/community/needs`; pool/cycle operations remain under `/community/coordination`. DomainImpact requires a positional registered action for each selected domain; an empty domains array remains valid for unclassified non-DomainImpact work.

## D10. Funding attribution verification, de-duplication, and recovery

```mermaid
sequenceDiagram
  autonumber
  actor F as Funder
  participant WEB as Existing client public surface
  participant RAIL as Direct or endowment rail
  participant EAS as EAS
  participant PROOF as Shared funding-proof adapter
  participant READ as Joined read

  F->>WEB: fund in Need context
  WEB->>RAIL: submit existing funding action
  alt funding fails or is canceled
    RAIL-->>WEB: failed or canceled
    WEB-->>F: funding not sent, Retry funding
  else finalized funding succeeds
    RAIL-->>WEB: chainId, txHash, token, amount, rail
    WEB->>EAS: optionally attest FundingAttribution
    alt signing fails or is skipped
      EAS-->>WEB: no attribution
      WEB-->>F: funding succeeded, Retry attribution only
    else attribution exists
      EAS-->>PROOF: candidate attribution
      PROOF->>RAIL: verify supported chain, finalized success, canonical contract and event, garden, token, amount
      alt proof pending, unavailable, failed, or mismatched
        PROOF-->>READ: pending or unverified, contributes zero
        READ-->>WEB: funding stands, Retry verification or attribution
      else proof matches
        PROOF->>READ: group globally by chainId, txHash, rail
        READ->>READ: lowest (timeCreated, uid) is canonical
        READ-->>WEB: show one verified attribution on detail only
      end
    end
  end
```

Attribution never replays or controls the funding transaction, never creates per-Need escrow, and never affects board order. The adapter does not infer an account-abstraction actor from `transaction.from`.

## D11. Evaluator joined-read and export sequence

```mermaid
sequenceDiagram
  autonumber
  actor E as Evaluator
  participant A as Admin /community/needs
  participant JOIN as Shared joined read
  participant EAS as EAS GraphQL
  participant ENV as Envio GraphQL
  participant FUND as Funding-proof adapter

  E->>A: open Need lineage
  A->>JOIN: request normalized graph
  par community evidence
    JOIN->>EAS: Need, statuses, signals, testimony, attribution
  and protocol lineage
    JOIN->>ENV: Commitment, Work, Approval, Assessment, Cycle, Hypercert
  and funding proof
    JOIN->>FUND: verification state
  end
  JOIN-->>A: source health plus normalized lineage
  alt any required source is partial or failed
    A-->>E: Export blocked, name failed source and Retry
  else all required sources complete
    E->>A: Export CSV or JSON
    A-->>E: CSV edge rows or nested JSON with source URLs
  end
```

Exports include the exact fields in `spec.md` §11, preserve withdrawn tombstones, and exclude join identities, research contacts, and unauthorized text/media. A source failure never masquerades as an empty dataset.

## D12. Permission and responsibility map

```mermaid
flowchart LR
  MEMBER["Community Hat member"] -->|"create / retract own Need"| NEED["Need"]
  MEMBER -->|"support / do not support / clear same garden"| SIGNAL["NeedSignal"]
  MEMBER -->|"attest queued witness words"| TEST["Testimony"]
  OPERATOR["Garden operator"] -->|"acknowledge / reopen / merge / hide / decline"| STATUS["NeedStatus"]
  OPERATOR -->|"seed and operate"| COMMIT["Commitment"]
  PROVIDER["Accepted provider"] -->|"perform linked work"| COMMIT
  CONFIRMER["Eligible confirmer<br/>never provider self-confirmation"] -->|"confirm when named"| COMMIT
  FUNDER["Funder wallet"] -->|"fund through existing rail"| RAIL["Garden funding rail"]
  FUNDER -->|"optional post-tx attestation"| ATTR["FundingAttribution"]
  EVALUATOR["Authorized evaluator"] -->|"read lineage / CSV / JSON"| EXPORT["Admin /community/needs export"]
  STEWARD["Protocol steward"] -->|"operate protocol pools and recovery paths"| COMMIT
  SHARED["Shared read service"] -->|"verify, de-duplicate, join"| VIEW["Role-filtered views"]
```

Browse is public under garden visibility rules. Signal, Need, and Testimony require same-garden Community membership. Moderation requires operator authority. FundingAttribution has no Hat gate but counts only after canonical proof verification.

## D13. Cross-surface user-flow map

```mermaid
flowchart LR
  QR["Garden QR / shared link"] --> BOARD["Community PWA Needs<br/>read-only before join"]
  BOARD --> CREATE["Community PWA Create"]
  BOARD --> DETAIL["Community PWA Need detail"]
  CREATE --> PROFILE["Community PWA Profile<br/>drafts / sync / confirmations / testimony"]
  DETAIL --> PROFILE

  BOARD --> GATHER["Admin /community/needs<br/>gathering + triage"]
  GATHER --> SEED["Admin /community/needs<br/>commitment seeding"]
  SEED --> POOLS["Admin /community/coordination<br/>pools and cycles"]
  POOLS --> EVAL["Admin /community/needs<br/>evaluator lineage + export"]

  PUBLIC["Existing client public<br/>garden / impact / funding"] --> FDETAIL["Public Need detail"]
  FDETAIL --> FUND["Existing direct donation<br/>or endowment flow"]
  FUND --> FDETAIL

  BOARD -. "global read-only discovery" .-> PUBLIC
```

There is no new top-level admin `/pools` route and no assumed new public Need route. The funder-lens workstream must fit discovery into existing client public surfaces unless it records an explicit route amendment.
