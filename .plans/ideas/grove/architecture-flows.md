# Capture → review → share, locally

**Current direction:** 13 November 2026, with the decisions of 14 November. Green Goods runs these flows locally, and Grove, the extension, adds the agent's steps (D31, D32). These are proposed flows, not runtime proof. [Community sharing](community-sharing.md) owns the contract and its [terms](community-sharing.md#terms); [spec.md](spec.md#decision-log) owns the decisions cited here as D-numbers. Solid lines are the MVP. Dotted lines are next lanes or later work.

## Four audiences

```mermaid
flowchart TB
  subgraph LOCAL["LOCAL · own devices"]
    Cap["Capture<br/>work report, promise or knowledge"] --> Vault[("Encrypted vault<br/>on each device")]
    Agent["Grove's agent<br/>brings in what fits the focus"] --> Vault
    Vault --> PRev["Personal review<br/>by hand. In Grove the agent assesses and structures"]
  end
  subgraph COMMUNITY["COMMUNITY · members"]
    Recv["Verify sender, member list and recipients<br/>decrypt and store"] --> CRev["Review together<br/>decisions and corrections"]
  end
  subgraph PARTNER["PARTNER COMMUNITY"]
    PSum["Read a minimized summary<br/>no private history"]
  end
  subgraph PUBLIC["PUBLIC · by choice"]
    Rel["Release<br/>report, resource or claim"]
  end
  PRev -->|"The author approves:<br/>revision, fields, recipients,<br/>purpose, destination"| File["Signed, encrypted file"]
  File --> Recv
  File -.->|"Next lane: ciphertext only"| Box[("Hosted mailbox<br/>Solid preferred")]
  Box -.-> Recv
  CRev -->|"A steward approves a new projection.<br/>The author too, if their corrected capture leaves"| PSum
  CRev -.->|"Later lane: a steward approves<br/>before any upload"| Rel
```

Local means one person's own phone and laptop; community means the devices of the garden's named members; a partner community is named recipients elsewhere; public is anyone. Moving outward is a deliberate disclosure of one projection, never a change of visibility on the source. Local-only use is complete without any other audience. A partner can read a summary without receiving the evidence under it. Each crossing has its own approval and its own approver (D17).

## Initial user flows

| Step | Work reports and promises | Knowledge | Boundary and authority |
|---|---|---|---|
| 1. Start locally | Start a garden locally or accept a verified invitation | Same | No wallet or provider login. Each device gets its own keys. A recovery code is created. The steward writes the garden's focus. A published Garden can be linked later |
| 2. Capture | Report work or make a promise, through the existing screen or free-form in the member's own words with photos | Save a guide, page excerpt, lesson or note | Saved first, with source, time and consent. No model, network or unlock is needed to save. In Grove, the agent also brings in pages that fit the garden's focus as the person browses |
| 3. Review personally | Check date, attribution and evidence; keep planned, reported and recorded apart. On a laptop, check the agent's structured version against the words it came from | Correct a summary, inspect sources, add a connection | By hand on any device. In Grove, each item the agent brought in comes with its assessment; the person decides and can discard. No attestation is created |
| 4. Share for review | Choose the fields and the reviewers; leave out unneeded personal and location data | Choose an excerpt or resource and named reviewers | The author approves the exact revision, fields, recipients, purpose and destination. The file is encrypted before it leaves; the original stays |
| 5. Review together | A steward or reviewer checks the evidence and accepts, rejects or corrects. On a laptop the agent proposes the structured version if the report arrived free-form | Members discuss and correct a lesson | Each reviewer's decision is recorded with their identity and the revision. Reading gives no authority to release |
| 6. Share an outcome | Send a report to a named funder or partner | Send a useful summary to a partner community | A steward approves a new, minimized projection. The author approves too if a corrected version of their capture is leaving |
| 7. Publish by choice | Publish the work report, its approval or the promise to the chain | Release a public learning resource | Later lane. A steward approves before the first upload. Existing Work and WorkApproval rules apply to what is published |

Example: a gardener reports a planting session on a phone in their own words, while a learning facilitator saves a workshop lesson in Grove on a laptop. Each reviews on their own device and shares selected records with the garden's reviewers. A funder receives a reviewed summary; culturally restricted knowledge, participant details and precise ecological locations stay in narrower audiences.

## Sequences

### Capture and personal review

```mermaid
sequenceDiagram
  participant P as Person
  participant C as Green Goods app or Grove
  participant V as Vault and local store
  P->>C: Report work, make a promise or save knowledge
  C->>V: Encrypt to this device's own key and save revision 1
  V-->>C: Committed
  C-->>P: Saved locally
  Note over C,V: Saving needs no unlock, model, account or network
  P->>C: Unlock with passkey or passphrase
  P->>C: Review by hand, correct, add context
  C->>V: Save revision 2 and the review
  opt On the laptop, when the model is available
    C->>V: Record a keyed investigation request
    Note over C,V: Pi runs Gemma, checks each quote and stores proposals
    P->>C: Accept, reject or correct each proposal
    C->>V: Save the decision against the exact revision
  end
```

A save is acknowledged only after its transaction commits. Inference is optional and happens after the save, never before it.

### Passive capture and assessment on the laptop

```mermaid
sequenceDiagram
  participant P as Person browsing
  participant X as Extension
  participant A as Agent, a local model run by Pi
  participant V as Vault and local store
  P->>X: Visits a page
  X->>X: Skip private windows, blocked sites and pages with a password field
  X->>X: Plain text match against the community's focus
  Note over X: No match. The text is discarded and nothing is logged
  X->>A: A page that matches, queued for when the laptop is idle
  A->>A: Is it relevant to a stated goal
  Note over A: Not relevant. Discarded, nothing is kept
  A->>V: Relevant. Save it as a capture in the person's own inbox
  A->>V: Assessment. Why it was brought in, source and date, what to check before sharing
  P->>X: Reviews the inbox and keeps, corrects or discards
  Note over X,A: While the vault is locked the agent reads nothing and queued text is dropped
  Note over P,V: Sharing with the community still needs the author's approval
```

The agent brings in only what it judges relevant, so it never recommends discarding an item (D28). The person reviews everything it brings in. The focus is the steward's written list of topics, goals and open questions (D30); with no focus the agent brings in nothing.

### A free-form report, structured at review

```mermaid
sequenceDiagram
  participant G as Gardener on a phone
  participant F as Encrypted file
  participant R as Reviewer in Grove on a laptop
  participant A as Agent, a local model run by Pi
  G->>G: Report work in their own words, with photos
  Note over G: Saved first. No form, model or network
  G->>F: Approve the share and export
  F->>R: Arrives, is verified and stored
  R->>A: Open the report for review
  A->>A: Read the gardener's words. Photos are attached as evidence
  A-->>R: Structured version. Each value with the words it came from
  Note over A,R: The Action is filled only when the garden's Action list is on the device
  R->>R: Accept or correct each value by hand
  R->>F: The structured version, as a new revision
  F->>G: Arrives on the gardener's phone
  G->>G: Approve it before it leaves the garden
```

A promise follows the same steps. So does the author's own review when they have a laptop (D35). A report made through the existing work screen is already structured and skips them. The agent proposes and never decides: it cannot approve, share or publish, and a value the words do not state stays empty (D36). A gardener with only a phone sees the structured version when it comes back, and it leaves the garden only with their approval (D17).

### Phone to laptop

```mermaid
sequenceDiagram
  participant Ph as Green Goods on the phone
  participant F as Encrypted file
  participant L as Grove on the laptop
  Ph->>Ph: Select captures and build a file for the member's own laptop key
  Ph->>F: Export through the share sheet
  F->>L: Import in Grove
  L->>L: Check the signature, the sending device and the recipient
  L->>L: Decrypt and store, skipping anything already held
  L-->>Ph: Receipt, carried by the next file in the other direction
```

The app and Grove have separate storage. Nothing moves between them except through a file a person carries across (D21). How Grove connects to the app in the same laptop browser is open (O17).

### Share and recipient review

```mermaid
sequenceDiagram
  participant A as Author's device
  participant M as Member list held by the author
  participant F as Encrypted file
  participant R as Reviewer's device
  A->>A: Choose revision, fields, recipients, purpose and destination
  A->>M: Are the recipients current members and is the list fresh
  M-->>A: Yes, or sharing pauses when the list is older than seven days
  A->>A: Record the author's share approval
  A->>A: Sign the manifest, encrypt under a fresh key, wrap the key to each recipient device
  A->>F: Export the file
  F->>R: Arrives by any channel
  R->>R: Check signature, sender in the list, named as recipient, not a duplicate
  R->>R: Decrypt and store
  R-->>A: Signed receipt for the stored file
  R->>R: Record a review decision or a correction
  Note over A,R: Stored, received, reviewed and released are four separate states
```

Show delivery as **saved locally → exported → received by device**. Show review and release separately. A receipt means a device stored the file, not that anyone read or accepted it. Changed content or recipients need a new approval.

### Correction and partner summary

```mermaid
sequenceDiagram
  participant R as Reviewer
  participant A as Author
  participant S as Steward
  participant P as Partner contact
  R->>A: Correction, a new revision that supersedes the shared one
  A->>A: Approve the corrected version if it will leave the community
  S->>S: Build a minimized projection from approved revisions
  S->>S: Record the release approval, naming the decisions it relied on
  S->>P: Signed, encrypted file for named partner devices
  P->>P: Verify against the paired community's member list, decrypt, store
  P-->>S: Receipt
  Note over S,P: The partner receives the summary only. Sources and draft history stay behind
```

### Removing a device

```mermaid
sequenceDiagram
  participant S as Steward, the controller
  participant A as Sender, offline
  participant X as Removed device
  S->>S: Sign member list version n+1 without the device
  Note over A: Still holds version n
  A-->>X: A file shared now is still wrapped to the removed device
  Note over A,X: The seven-day limit bounds this window
  S-->>A: Any file that carries version n+1
  A->>A: Adopt version n+1
  A->>A: Later files leave the removed device out
  Note over X: Keeps everything it already received
```

### Unlock and recovery

```mermaid
flowchart LR
  PK["Existing passkey<br/>where the provider supports it"] --> K1["Passkey secret combined with<br/>a key held on the device"]
  PP["Passphrase"] --> K2["Derived key"]
  K1 --> VK["Vault key on this device"]
  K2 --> VK
  VK --> DK["This device's private keys"]
  VK --> Rec["Record payloads"]
  DK --> Sign["Sign what this device sends"]
  DK --> Open["Open files addressed to this device"]
  RC["Recovery code<br/>kept off the device"] --> K3["Derived key"]
  K3 --> EX["Recovery export<br/>records and membership,<br/>no device keys"]
  EX --> NEW["Restored device makes new keys<br/>and is added to the member list again"]
```

The passkey unlocks; it does not identify a device, sign Grove records or decrypt shared files. The recovery code does not open a device's vault. It opens a recovery export, which holds records and the member's place in the community and never a device's private keys, so a restore cannot bring back the identity of a lost or removed device.

### Optional publication, a later lane

```mermaid
sequenceDiagram
  participant S as Steward
  participant G as Green Goods app, working locally
  participant Q as Green Goods upload queue
  participant I as Public IPFS
  participant C as Chain
  S->>G: Choose approved revisions and fields for release
  G-->>S: Preview the exact payload that would be uploaded
  S->>G: Release approval, bound to that payload's digest
  G->>Q: Hand over only after the approval is recorded
  Note over Q,I: Today the queue uploads during background preparation, before Upload all
  Q->>I: Pin media and metadata. Public from this moment
  S->>Q: Upload all, which only signs
  Q->>C: Work attestation under the existing garden rules
  Note over G,C: A local approval is not the WorkApproval attestation. Existing authority is unchanged
```

This sequence is why the release approval sits before the hand-over and not before the signature. The upload behavior is current code, read on 14 November; the local steps are proposed.

## Identity and processing ownership

The [identity and role map](identity-role-mapping.md) separates a garden's onchain account, WebID and group accounts from each member's wallet, WebID and personal account. Associations are private by default and confer no role and no key.

The [Pi capture and review contract](durable-execution.md#where-pi-belongs-in-capture--review--share) keeps saving and human review in Grove transactions. Pi resumes optional multi-step enrichment on the laptop and finishes ready for review; a human correction can request a new investigation.

## How this extends Green Goods and Coop

```mermaid
flowchart LR
  Local["NEW: local garden identity<br/>Reports, promises and personal review"] --> Shared["NEW: encrypted sharing in the garden<br/>Member review and corrections"]
  Shared --> Consent["Separate release approval"]
  Existing["EXISTING: Green Goods local drafts<br/>and public Ethereum garden identity"] --> Consent
  Consent --> Protocol["Existing public upload and<br/>Work / WorkApproval workflows"]
  Protocol -.-> Local
  Coop["Coop patterns<br/>Capture / pairing / offline sync / receipts"] -.-> Local
  Coop -.-> Shared
```

This project adds local garden identity and shared evidence before the existing public boundary. Existing draft queues, public IPFS uploads and onchain identity are not an encrypted shared layer. Coop provides patterns that were read from source, not an implementation that has been shown to keep a host blind, and its code cannot be copied until its license is settled. No application or contract behavior changes in this plan revision.

## The laptop workspace

The diagrams below describe Grove: the laptop's graph and investigation lane, which is part of the MVP (D25). The agent's three jobs, passive capture, assessment and structuring, are shown in the sequences above (D26 to D30, D35); in these older diagrams they correspond to the capture and investigation steps. Three things in them are next lanes and not the MVP (D22): the Admin Hub import and digest, the KOI peer, and structured Garden, Work and WorkApproval records, which arrive with the Hub import. Pinned resource packs follow the MVP with S10. In the MVP the graph shows the records held on the device: work reports, promises, knowledge captures, reviewed links and received records. For confidential records, the encryption and recipient rules above apply before any outbound adapter. Pi owns resumable investigations; the graph and the review lists read committed knowledge.

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

In the MVP, “find” means what the agent brings in as the person browses and what people capture by hand. Lookup in a pinned resource pack arrives after the MVP with S10, and a selected KOI resource collection with the KOI lane. Garden context stays local. Unattended web search, background crawling and publishing a Commons contribution are later capabilities.

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
