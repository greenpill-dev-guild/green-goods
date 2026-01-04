# Green Goods Architecture Diagrams

Canonical Mermaid diagrams for understanding Green Goods data flows and system architecture.

> **Usage:** Reference these diagrams in documentation, PRs, and agent explanations. Install [Mermaid Preview](https://marketplace.cursorapi.com/items?itemName=bierner.markdown-mermaid) in VS Code/Cursor to render inline.

---

## System Context {#system-context}

High-level view of the Green Goods monorepo and external integrations.

```mermaid
graph TD
  subgraph Frontends
    C[Client PWA<br/>packages/client]
    A[Admin Dashboard<br/>packages/admin]
  end

  subgraph Shared["Shared Package"]
    S["@green-goods/shared<br/>hooks • modules • providers"]
  end

  subgraph Backend
    AG[Agent Bot<br/>packages/agent]
    IDX[Envio Indexer<br/>packages/indexer<br/>GraphQL API]
  end

  subgraph Onchain["Blockchain Layer"]
    SC[Smart Contracts<br/>packages/contracts]
    EAS[EAS Attestations]
    TBA[Token-Bound Accounts]
  end

  subgraph External["External Services"]
    IPFS[IPFS / Storacha]
    PIM[Pimlico<br/>Smart Accounts]
    REOWN[Reown AppKit<br/>Wallet Connect]
    GAP[Karma GAP]
  end

  C --> S
  A --> S
  AG --> S
  S --> IPFS
  S --> PIM
  S --> REOWN
  S --> SC
  SC --> EAS
  SC --> TBA
  SC --> GAP
  SC --> IDX
  IDX --> C
  IDX --> A
  IDX --> AG
```

**When to use:** Explaining package relationships, onboarding new contributors, architecture discussions.

---

## Work Submission Flow {#work-submission}

Complete flow from gardener form input to on-chain attestation.

```mermaid
sequenceDiagram
  participant G as Gardener
  participant UI as Client PWA
  participant Q as Job Queue<br/>(IndexedDB)
  participant IPFS as IPFS/Storacha
  participant SA as Smart Account<br/>(Pimlico)
  participant SC as WorkResolver<br/>(Contract)
  participant EAS as EAS
  participant IDX as Envio Indexer

  G->>UI: Fill MDR form + capture photos
  UI->>Q: enqueue(workDraft, files)
  Note over UI,Q: Works offline

  alt Online + Smart Account Ready
    Q->>IPFS: Upload media files
    IPFS-->>Q: CID / URLs
    Q->>SA: Build attestation tx
    SA->>SC: WorkResolver.onAttest()
    SC->>EAS: Create work attestation
    EAS-->>SC: Attestation UID
    Note over SC,EAS: Work stored as EAS attestation
    SC-->>UI: Transaction confirmed
    UI-->>G: Success notification
  else Offline or SA Unavailable
    Note over Q: Job persisted, retry on reconnect
    Q-->>UI: Pending status
  end
```

**When to use:** Explaining offline-first architecture, debugging submission issues, client PRs.

---

## Work Approval Flow {#work-approval}

Operator review through to Karma GAP impact attestation.

```mermaid
sequenceDiagram
  participant O as Operator
  participant AD as Admin Dashboard
  participant IDX as Envio Indexer
  participant W as Wallet<br/>(MetaMask)
  participant SC as WorkApprovalResolver
  participant GG as GreenGoodsResolver<br/>(Fan-out)
  participant GAP as Karma GAP
  participant EAS as EAS

  O->>AD: View pending work
  AD->>EAS: Query work attestations (EAS GraphQL)
  EAS-->>AD: Work list + IPFS URLs
  O->>AD: Review photos, approve
  AD->>W: Sign approval tx
  W->>SC: WorkApprovalResolver.onAttest()
  SC->>EAS: Create approval attestation
  SC->>GG: onWorkApproved(garden, worker, workUID)
  
  par Module Fan-out (try/catch)
    GG->>GAP: Create impact attestation
    Note over GG: Other modules (Octant, Unlock) also triggered
  end

  EAS-->>SC: Approval UID
  SC-->>AD: Transaction confirmed
  AD-->>O: Success toast
```

**When to use:** Explaining approval workflow, admin PRs, contract resolver changes.

---

## Authentication Flow {#auth-flow}

Passkey vs wallet authentication branching.

```mermaid
flowchart TD
  START([User opens app]) --> CHECK{Saved auth mode?}
  
  CHECK -->|passkey| RESTORE[Restore passkey session]
  CHECK -->|wallet| WALLET[Check wagmi connection]
  CHECK -->|none| LOGIN[Show login screen]
  
  RESTORE --> VALID{Session valid?}
  VALID -->|Yes| HOME[Navigate to /home]
  VALID -->|No| LOGIN
  
  WALLET --> CONNECTED{Wallet connected?}
  CONNECTED -->|Yes| HOME
  CONNECTED -->|No| LOGIN
  
  LOGIN --> CHOICE{User chooses}
  CHOICE -->|Passkey| WEBAUTHN[WebAuthn registration]
  CHOICE -->|Wallet| APPKIT[Reown AppKit modal]
  
  WEBAUTHN --> PIM[Pimlico creates smart account]
  PIM --> HOME
  
  APPKIT --> EOA[EOA connected]
  EOA --> HOME
  
  subgraph Passkey Mode
    WEBAUTHN
    PIM
  end
  
  subgraph Wallet Mode
    APPKIT
    EOA
  end
```

**When to use:** Auth-related PRs, debugging login issues, explaining auth modes.

---

## Provider Hierarchy {#provider-hierarchy}

Required React context nesting order for client/admin apps.

```mermaid
flowchart TD
  subgraph Providers["Provider Nesting (top to bottom)"]
    W[WagmiProvider] --> QC[QueryClientProvider]
    QC --> AK[AppKitProvider]
    AK --> AU[AuthProvider]
    AU --> AP[AppProvider]
    AP --> JQ[JobQueueProvider]
    JQ --> WP[WorkProvider]
    WP --> CH["{children}"]
  end

  W -.->|"Blockchain connection"| W
  QC -.->|"React Query instance"| QC
  AK -.->|"Wallet modal (needs Wagmi)"| AK
  AU -.->|"Auth state (needs AppKit)"| AU
  AP -.->|"App settings, i18n"| AP
  JQ -.->|"Offline queue (needs Auth)"| JQ
  WP -.->|"Work submission (needs Queue)"| WP
```

**When to use:** Setting up new entry points, debugging provider issues, understanding context dependencies.

---

## E2E Test Execution {#e2e-test-flow}

Playwright test run lifecycle.

```mermaid
flowchart LR
  subgraph Setup
    GS[global-setup.ts] --> WS[webServer starts]
    WS --> IDX[indexer:8080]
    WS --> CLI[client:3001]
    WS --> ADM[admin:3002]
  end

  subgraph Execution
    IDX & CLI & ADM --> TESTS[Run specs in parallel]
    TESTS --> CS[client.smoke.spec.ts]
    TESTS --> AS[admin.smoke.spec.ts]
  end

  subgraph Teardown
    CS & AS --> GT[global-teardown.ts]
    GT --> DONE([Complete])
  end
```

**When to use:** Understanding test infrastructure, CI/CD debugging, E2E test PRs.

---

## Contract Deployment {#deployment-flow}

deploy.ts CLI execution flow.

```mermaid
flowchart LR
  A[deploy.ts CLI] --> B{--broadcast?}
  B -->|No| C[Dry Run<br/>Simulate only]
  B -->|Yes| D[Deploy to chain]
  D --> E[Verify on Explorer]
  E --> F[Update deployments/*.json]
  F --> G{--update-schemas?}
  G -->|Yes| H[Update schema metadata]
  G -->|No| I[Skip schema update]
  H --> J[Trigger Envio codegen]
  I --> J
  J --> K([Deployment complete])
```

**When to use:** Contract deployment PRs, understanding deploy.ts, upgrade procedures.

---

## Indexer Event Processing {#indexer-flow}

Envio event handler data flow.

```mermaid
sequenceDiagram
  participant Chain as Blockchain
  participant ENV as Envio Runtime
  participant EH as EventHandlers.ts
  participant DB as PostgreSQL
  participant GQL as GraphQL API
  participant FE as Frontend

  Chain->>ENV: New block with events
  ENV->>EH: Process GardenMinted event
  EH->>EH: Parse event data, compute IDs
  EH->>DB: context.Garden.set(entity)
  
  ENV->>EH: Process ActionRegistered event
  EH->>EH: Map capitals enum, create entity
  EH->>DB: context.Action.set(entity)
  
  Note over DB,GQL: Schema auto-generated from schema.graphql
  
  FE->>GQL: Query gardens with works
  GQL->>DB: SQL query
  DB-->>GQL: Results
  GQL-->>FE: JSON response
```

**When to use:** Indexer PRs, understanding data flow, debugging GraphQL issues.

---

## n8n Issue Automation {#n8n-automation}

Meeting notes → GitHub issue → Cursor Cloud Agent pipeline.

```mermaid
flowchart TD
  subgraph Meet["Google Meet + Gemini Notes"]
    M1[Meeting ends] --> M2[Gemini notes created]
    M2 --> M3{Notes moved to folder}
    M3 -->|product sync| N1
    M3 -->|community chat| N1
  end

  subgraph N8N["n8n Workflow"]
    N1[Trigger: new doc in folder] --> N2[Fetch doc text]
    N2 --> N3["LLM extract bug candidates<br/>(title, repro, area, severity,<br/>priority, size, confidence)"]
    N3 --> N4["Dedup: search existing issues<br/>by keywords + error strings"]
    N4 --> N5{Existing issue?}
  end

  subgraph GH["GitHub"]
    G1["Update existing issue:<br/>comment + adjust labels"]
    G2["Create new issue:<br/>priority + severity + size<br/>+ area:* + source:meeting"]
    G3["Post @cursor comment<br/>(dispatch Cloud Agent)"]
    G4["Cloud Agent opens PR"]
  end

  subgraph Gate["Severity / Priority / Size Gate"]
    X1{"severity:low AND<br/>priority:P2/P3 AND<br/>size:XS/S?"}
    X2["@cursor one-shot fix"]
    X3["@cursor investigate only"]
    X4{"Investigation says<br/>size ≤ M and safe?"}
    X5["@cursor implement fix"]
    X6["Notify humans for triage"]
  end

  subgraph Human["Humans"]
    H1["Review PR + local tests<br/>(bun test:e2e:ui)"]
    H2[Merge / request changes]
  end

  N5 -->|Yes| G1
  N5 -->|No| G2
  G1 --> X1
  G2 --> X1

  X1 -->|Yes| X2 --> G3
  X1 -->|No| X3 --> G3

  G3 --> G4 --> H1 --> H2

  X3 -.-> X4
  X4 -->|Yes| X5 --> G3
  X4 -->|No| X6
```

**When to use:** Understanding automated issue creation, n8n setup, Cloud Agent dispatch.

**Labels used:**
- **priority** (custom field): P0, P1, P2, P3
- **severity** (custom field): low, med, high
- **size** (custom field): XS, S, M, L, XL
- **area**: client, admin, shared, contracts, indexer, agent
- **source**: meeting, bugbot, manual

---

## Quick Reference

| Diagram | Anchor | Use Case |
|---------|--------|----------|
| System Context | `#system-context` | Package relationships, onboarding |
| Work Submission | `#work-submission` | Offline queue, client PRs |
| Work Approval | `#work-approval` | Admin PRs, resolver changes |
| Auth Flow | `#auth-flow` | Auth PRs, login debugging |
| Provider Hierarchy | `#provider-hierarchy` | Context issues, new entry points |
| E2E Test Flow | `#e2e-test-flow` | Test infrastructure, CI/CD |
| Deployment Flow | `#deployment-flow` | Contract PRs, deploy.ts |
| Indexer Flow | `#indexer-flow` | Indexer PRs, GraphQL issues |
| n8n Automation | `#n8n-automation` | Meeting → issue → agent pipeline |

---

## Mermaid Syntax Reference

```mermaid
%% Flowchart (logic, decisions)
graph TD
  A[Start] --> B{Decision?}
  B -->|Yes| C[Action]
  B -->|No| D[Other]

%% Sequence (interactions over time)
sequenceDiagram
  participant U as User
  participant S as Server
  U->>S: Request
  S-->>U: Response
```

**Tips:**
- Use `graph TD` for top-down flows, `graph LR` for left-right
- Use `sequenceDiagram` for time-ordered interactions
- Wrap labels in quotes if they contain special characters
- Use `subgraph` to group related nodes
