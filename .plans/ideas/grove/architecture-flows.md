# Grove: capture → review → share

**Current direction:** 13 November 2026. These are proposed flows, not runtime proof. [Community identity and encrypted sharing](community-sharing.md) owns the contract: local identity/keys, preferred optional Solid storage and Yjs co-editing. [C0a/C5 research](collaboration-passkey-spike.md) retains passkey/recovery proof and experimental Automerge + Keyhive; EDV is a storage research alternative. Dotted arrows show optional connections.

## Local, shared and public contexts

```mermaid
flowchart TB
  subgraph PRIVATE["LOCAL · person and their paired devices"]
    Input["Page / note / photo / observation"] --> Capture["Capture source and consent context"]
    Capture --> Vault[("Encrypted local workspace")]
    Vault --> Review["Review and correct<br/>Optional local AI and graph"]
    Identity["Local member and community identity<br/>Device keys and signed policy"] --> Review
  end
  subgraph COMMUNITY["SHARED · named community members"]
    Gate["Choose exact revision, fields,<br/>recipients and purpose"] --> E2EE["Encrypt on sender device<br/>Keys for authorized devices only"]
    E2EE <-.-> Pod[("Solid: preferred optional store<br/>Ciphertext, no content keys")]
    E2EE <--> Direct["Encrypted file / WebRTC transfer"]
    Pod --> Receive["Verify grant and sender<br/>Decrypt on recipient device"]
    Direct --> Receive
    Receive --> Together["Community review<br/>Correction / lesson / draft report"]
  end
  subgraph CROSS["BETWEEN COMMUNITIES · a new audience"]
    Select["Approve a minimized projection"] --> Other["Fresh encrypted copy<br/>for named partner community"]
  end
  subgraph COMMONS["PUBLIC · publish by choice"]
    Release["Preview and approve public release<br/>before any public upload"] --> Public["Public report or knowledge resource"]
    Release -.-> AT["Optional ATProto / Certified"]
    Release -.-> ETH["Optional Green Goods / Ethereum"]
    Release -.-> Archive["Optional IPFS / Filecoin archive"]
  end
  Review --> Gate
  Identity --> Gate
  Together --> Select
  Together --> Release
  Other -.-> KOI["Optional KOI discovery and exchange<br/>Only approved audience data"]
```

These contexts are the privacy rings. Moving outward creates a deliberate disclosure, not a change of visibility on the entire source archive. Local-only use is complete without any outer ring. A recipient can read a public summary without acquiring the underlying private evidence. Public destinations are independent choices, not a required sequence or a guarantee of permanence.

Yjs is the preferred optional draft-merge engine, with encrypted updates and verified writers; it supplies neither community identity nor content-key custody. EDV and Automerge + Keyhive remain research alternatives. None is required to capture, review or exchange selected encrypted records locally.

## Initial user flows

| Step | Knowledge capture | Impact evidence capture | Privacy/authority boundary |
|---|---|---|---|
| 1. Start locally | Create a community workspace or accept a verified invitation | Same; optionally bind an existing public garden later | No wallet or provider login needed. Each device gets separate keys. |
| 2. Capture | Save a guide, page excerpt, lesson or note | Save an observation, photo or account of work; sensor imports later | Save locally first, with source/time/context and consent. A failed model/network never loses the capture. |
| 3. Review personally | Correct a summary, inspect sources, add a connection | Check date, attribution and evidence; preserve planned/reported/recorded distinctions | Local AI proposes. The person decides. No protocol attestation is created. |
| 4. Share for review | Choose an excerpt or resource and named reviewers | Choose the evidence fields and reviewers; omit unnecessary personal/location data | Confirm exact revision, audience and purpose. Encrypt before sending; original remains local. |
| 5. Review together | Members discuss/correct a lesson or approve a shared resource | Authorized reviewers assess the evidence and prepare a report or claim draft | Record reviewer identity and version. The community's policy governs approval; decryption alone gives no review authority. |
| 6. Share an outcome | Send a useful summary to a partner community | Send a report to a named funder or partner | New audience, fresh minimized projection, new approval and keys. A report need not be public. |
| 7. Publish by choice | Release a public learning resource | Release selected impact information or use a protocol publication flow | Separate review before the first upload. Existing Work/WorkApproval rules still apply. |

Example: a steward captures soil observations offline, while a learning facilitator saves a workshop lesson. Each reviews on their own device and shares selected records with the community's reviewers. A funder receives a reviewed summary; culturally restricted knowledge, participant details and precise ecological locations can remain in narrower contexts.

## What happens when two devices share

```mermaid
sequenceDiagram
  participant A as Capturing phone or laptop
  participant G as Local policy and key store
  participant T as File / WebRTC / selected storage
  participant B as Authorized reviewer device
  A->>A: Save encrypted capture, optionally enrich locally
  A->>G: Select revision, recipient, purpose and fields
  G-->>A: Verify current grant and explicit share approval
  A->>A: Create signed encrypted envelope and recipient key wrap
  A->>T: Send ciphertext and persist retry intent
  T->>B: Deliver opaque envelope when reachable
  B->>B: Check sender, grant, epoch, revision and duplicate ID
  B->>B: Decrypt and commit locally
  B-->>A: Authenticated receipt for the committed version
  B->>B: Review or correct, retain provenance
  Note over A,B: Receipt, review, community approval and public release are separate states
```

Show delivery as **saved locally → queued → stored by selected destination / received by device**. Show review and publication separately. If only a Pod upload is confirmed, do not claim that the reviewer received or read the record. Changed content or recipients invalidate the prior approval. If offline membership is stale, preserve the capture and queue the share pending policy reconciliation.

## Identity and processing ownership

The [identity/role map](identity-role-mapping.md) separates the community's GardenAccount/WebID/group account from each member's wallet/WebID/personal account. Account associations are private by default and confer no role or decryption key. Local/community role grants, service delegations and public protocol authority each retain their own scope.

The [Pi capture/review flow](durable-execution.md#where-pi-belongs-in-capture--review--share) keeps source saving and human review in Grove transactions. Pi resumes optional multi-step enrichment, then finishes ready for review; a human correction can enqueue a new keyed investigation. The [storage comparison](storage-comparison-spike.md) tests two backends on the same two-device flow, while [local-first options](local-first-options.md) remain conditional collaboration choices.

## How this extends Green Goods and Coop

```mermaid
flowchart LR
  Local["NEW: local community identity<br/>Capture and personal review"] --> Shared["NEW: encrypted community sharing<br/>Member review and corrections"]
  Shared --> Consent["Separate public-release approval"]
  Existing["EXISTING: Green Goods local drafts<br/>and public Ethereum garden identity"] --> Consent
  Consent --> Protocol["Existing public upload and<br/>Work / WorkApproval workflows"]
  Protocol -.-> Local
  Coop["Coop patterns<br/>Capture / pairing / offline sync / receipts"] -.-> Local
  Coop -.-> Shared
```

Grove adds local/community identity and shared evidence contexts before the existing public boundary. Existing draft queues, public IPFS uploads and onchain identity are not an encrypted shared layer. Coop provides inspected patterns, not a pre-proven host-blind implementation. No application or contract behavior changes in this plan revision.

## Earlier graph and ingestion baseline

The diagrams below preserve the earlier research/work interpretation loop and command-recovery detail. Their public-safe controlled KOI peer is optional. For confidential data, the encryption/recipient boundary above applies before every outbound adapter. Pi owns resumable investigations; the graph and review lists derive from scoped committed knowledge.

## Two loops joined by garden memory

```mermaid
flowchart LR
  subgraph I["Internal loop · work and learn"]
    G["Garden priorities"] --> A["People choose and perform work"]
    A --> W["Work records and evidence"]
    W --> R["Protocol review and reporting"]
    R --> Q["Questions, gaps and lessons"]
    Q --> G
  end
  subgraph B["Grove · shared interpretation"]
    O["Composed ontology profile"] --> K["Versioned garden knowledge graph"]
    K --> H["Inspect source · accept, reject or correct"]
    H --> K
  end
  subgraph E["External loop · find and contextualize"]
    S["Consented browsing and curated resources"] --> C["Capture source and provenance"]
    C --> PI["Pi Durable investigation<br/>Pinned sources · checkpointed phases"]
    PI --> X["Local relevance and relationship proposals"]
  end
  W --> K
  R --> K
  Q -->|"Guide local resource lookup"| S
  K -->|"Garden context"| X
  X -->|"Validated proposals"| K
  H -->|"Included insights in Hub"| G
  H -.->|"Later: approved contribution"| L["Commons case study or improved playbook"]
  L -.-> S
  F["Optional full KOI node<br/>Controlled resource collection"] -->|"Signed resource bundles"| C
  H -->|"Preview and explicitly share one object"| F
```

The internal loop asks what was done, what is known, what is missing and what to improve. The external loop brings in relevant practices, people, tools and resources. Their joining point is a source-backed relationship in the graph, inspected in the context of a real garden question.

Example: a garden records a composting activity. A steward wants a more useful record of the method used. They capture a public playbook; Grove suggests a relationship to the Action and exposes its quote. The steward accepts the link and sees it in the Hub. Later work can cite the method and report what happened. A future, separately reviewed case study could contribute the lesson back to the Commons. Neither reading the playbook nor accepting the link proves an ecological outcome.

For this MVP, “find” means local lookup in a pinned resource pack, a selected KOI resource collection, and the user's consented research. Garden context stays local. Unattended web search, background crawling and publishing a Commons contribution are later capabilities.

## Internal and external ingestion

```mermaid
flowchart TB
  subgraph INTERNAL["Internal inputs"]
    H["Connected Hub<br/>Garden · Action · Work · WorkApproval"] --> I["Structured adapter<br/>Canonical IDs · coverage · source state"]
    N["User-selected internal notes"] --> T["Text extraction<br/>Private by default"]
  end
  subgraph EXTERNAL["External inputs"]
    P["Explicit page save or enabled research scope"] --> E["Extract readable text<br/>URL · source date · content digest"]
    C["Pinned Commons and resource packs"] --> V["Validate version, IDs and reuse boundary"]
    K["Allowlisted full-node bundle"] --> KV["Check signature, target, scope and hash<br/>Persist intake for retry"]
    KV --> V
  end
  I --> B["Validate workspace and composed profile"]
  T --> B
  E --> B
  V --> B
  B --> D["Transaction 1<br/>Save source and structured records<br/>Append change sequence · dispatch intent"]
  D --> G["Graph shows durable capture immediately"]
  D --> J["Pi Durable custom task<br/>Keyed admission · pinned source/context"]
  J <--> PS[("Local Pi execution storage")]
  J --> M["Local Gemma<br/>Propose links and source quotes"]
  M --> Z{"Schema, IDs, predicate endpoints<br/>and exact evidence spans valid?"}
  Z -->|Yes| PREP["Save prepared command in Dexie<br/>Stable operation key and payload digest"]
  PREP --> CP["Pi checkpoint references prepared result"]
  CP --> S["Knowledge command transaction<br/>Store proposals, changes and receipt"]
  S --> DONE["Separate Pi commit<br/>Checkpoint receipt · ready for review"]
  Z -->|No| F["Source stays saved<br/>Show failure or abstention<br/>Bounded retry / manual link"]
  S --> G
  G --> U["Human inspects and reviews"]
  U --> R["Transaction 3<br/>Check expected revision<br/>Append decision and change"]
  R --> G
  R --> FOLLOW["Atomic review follow-up dispatch<br/>New keyed Pi task when requested"]
  R -->|"Only accepted and explicitly included fields"| O["Same-device Hub digest"]
  R --> PREVIEW["Preview selected public-safe projection"]
  PREVIEW -->|"User confirms recipient and fields"| OB["Persist scoped outbox"]
  OB --> PEER["Controlled full node<br/>Verify stored version; reconcile after loss"]
```

Structured protocol import bypasses inference; the model only proposes additional interpretation. Already-validated structured resource records can also import directly. Note/page extraction is untrusted input. Instructions found inside content never grant tool, network or graph-write access.

Pi checkpoints and garden mutations commit separately; stable command receipts recover the gap. Pi owns investigation scheduling, while deterministic capture and KOI delivery have their own workers. Network access and inference occur outside IndexedDB transactions. A save is acknowledged only after its transaction commits. Invalid mapping input is quarantined; interrupted jobs resume from persisted state. Partial snapshots do not prove deletion, and stale model/review results cannot overwrite newer revisions. See the [storage and review contract](spec.md#knowledge-contract-and-time).

## Why the graph feels alive

```mermaid
sequenceDiagram
  participant C as Capture / Hub adapter
  participant D as Dexie garden memory
  participant P as Pi runner
  participant X as Pi execution storage
  participant M as Local Gemma host
  participant G as Graph tab
  participant U as Person
  C->>D: Save source + dispatch intent (garden sequence 41)
  D-->>G: Committed source appears
  D->>P: Submit stable run key and pinned references
  P->>X: Persist task admission / checkpoint
  P->>M: Bounded source packet outside transactions
  M-->>P: Untrusted candidates
  P->>D: Validate and persist prepared command
  P->>X: Checkpoint prepared reference
  P->>D: Apply command ID + digest + expected revisions
  D-->>G: Commit proposal + receipt (garden sequence 42)
  D-->>P: Original receipt, also on retry
  P->>X: Checkpoint receipt, task ready for review
  U->>G: Inspect quote and accept expected revision
  G->>D: Review + optional follow-up dispatch (43)
  D-->>G: Committed review, WorkApproval unchanged
  D->>P: New keyed follow-up if requested
  U->>G: Compare garden sequences 41 and 43
  G->>D: Read historical projections
  D-->>G: Source only vs source + reviewed relationship
```

“New” comes from committed change sequences after the person's seen cursor. A new edge can connect two old nodes. The timeline shows what Grove knew at that time; a late import is not backdated. Planned time and reported/recorded activity are separate dimensions. Accepting a planned trial or receiving a signed bundle never makes it completed Work. Personal feedback changes retrieval/review state, not model weights. New captures should settle into place; continuous force motion is unnecessary.

## Two gardens, one implementation

```mermaid
flowchart LR
  V["Vida Verde<br/>Agroforestry question + public evidence"] --> A["Scoped adapter + ontology profile"]
  T["TAS<br/>Learning / solar question + public evidence"] --> A
  A --> W["Separate local workspaces<br/>One active garden view"]
  W --> G["Garden overview → topic → source<br/>Back restores view and time"]
  G --> R["Review relationship<br/>Keep plans distinct from recorded work"]
  R --> H["Local history + same-device Hub"]
  R -->|"Explicit selected projection"| K["Optional KOI peer"]
```

The [first-spike walkthrough](first-spike.md) defines the public evidence, failure cases and limits. The [KOI contract](koi-integration.md) separates current-object exchange from durable local history and describes the application-level collection inventory used for recovery.

The [Pi execution contract](durable-execution.md) defines host ownership, source privacy, review continuation and interruption recovery. A Pi execution sequence is never substituted for the garden timeline sequence.
