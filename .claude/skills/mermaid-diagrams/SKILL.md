---
name: mermaid-diagrams
description: Create software diagrams using Mermaid syntax. Use when explaining architecture, flows, or relationships.
---

# Mermaid Diagramming

Create professional software diagrams using Mermaid's text-based syntax. Diagrams are version-controllable and maintainable alongside code.

## When to Use

- Explaining system architecture (Pass 0 in code review)
- Documenting API flows
- Database schema visualization
- User journey mapping
- State machine documentation

## Diagram Type Selection

| Type | Use Case |
|------|----------|
| **Class Diagram** | Domain modeling, OOP design, entity relationships |
| **Sequence Diagram** | API flows, authentication, component interactions |
| **Flowchart** | Processes, algorithms, decision trees |
| **ERD** | Database schemas, table relationships |
| **State Diagram** | State machines, lifecycle states |
| **C4 Diagram** | Multi-level architecture documentation |

## Quick Examples

### Sequence Diagram (API Flow)

```mermaid
sequenceDiagram
    participant User
    participant Client as PWA Client
    participant API as GraphQL API
    participant Chain as Blockchain

    User->>Client: Submit work
    Client->>Client: Queue in IndexedDB
    Client->>API: POST /work
    API->>Chain: submitWork()
    Chain-->>API: Transaction hash
    API-->>Client: Confirmation
    Client-->>User: Success toast
```

### Flowchart (User Journey)

```mermaid
flowchart TD
    Start([User opens app]) --> Auth{Authenticated?}
    Auth -->|No| Login[Show login]
    Auth -->|Yes| Role{User role?}
    Role -->|Gardener| GardenList[Show gardens]
    Role -->|Operator| AdminDash[Show admin]
    Login --> Passkey{Has passkey?}
    Passkey -->|Yes| PasskeyAuth[Authenticate]
    Passkey -->|No| Wallet[Connect wallet]
```

### Class Diagram (Domain Model)

```mermaid
classDiagram
    Garden "1" --> "*" Action : defines
    Garden "1" --> "*" Work : tracks
    Work --> Action : implements
    Work --> Gardener : submittedBy

    class Garden {
        +Address address
        +string name
        +Action[] actions
    }

    class Work {
        +string id
        +WorkStatus status
        +string[] photos
        +submit()
        +approve()
    }
```

### ERD (Database Schema)

```mermaid
erDiagram
    GARDEN ||--o{ ACTION : defines
    GARDEN ||--o{ WORK : contains
    WORK }o--|| ACTION : implements
    WORK }o--|| GARDENER : submittedBy

    GARDEN {
        address id PK
        string name
        uint256 chainId
    }

    WORK {
        string id PK
        address garden FK
        bytes32 actionUID FK
        enum status
    }
```

## Green Goods Integration

### Use in Code Review (Pass 0)

When reviewing changes, create a diagram showing:
- What components are affected
- How data flows through the system
- What dependencies are involved

```mermaid
flowchart LR
    subgraph Changed["Changed Files"]
        Hook[useSubmitWork]
        Store[workStore]
    end

    subgraph Affected["Affected"]
        Queue[Job Queue]
        Sync[Sync Service]
    end

    Hook --> Store
    Store --> Queue
    Queue --> Sync
```

### Canonical Diagrams Reference

When documenting cross-package flows, reference or update the centralized diagrams:

**Location:** `docs/developer/architecture/diagrams.md`

Before creating new diagrams, check if an existing one covers the flow:
- System Context → Package relationships
- Work Submission → `useSubmitWork`, `workStore`, offline queue
- Work Approval → Admin flows, resolver changes
- Auth Flow → Passkey/wallet authentication

Update the canonical diagrams when architectural changes are made.

### Use in Planning

Before implementing a feature, diagram:
- Component interactions
- State transitions
- API flow

## Best Practices

1. **Start simple** - Core entities first, details later
2. **Clear labels** - Self-documenting names
3. **One concept per diagram** - Split large diagrams
4. **Comment complex parts** - Use `%%` for explanations
5. **Version with code** - Store `.mmd` files alongside source

## Rendering

**Supported platforms:**
- GitHub/GitLab Markdown (native)
- VS Code (with extension)
- Notion, Obsidian, Confluence

**Export:**
- [Mermaid Live Editor](https://mermaid.live) - PNG/SVG export
- CLI: `npx @mermaid-js/mermaid-cli -i input.mmd -o output.png`
