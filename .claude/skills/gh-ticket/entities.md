# Green Goods Entity Set for Mermaid Diagrams

> **Purpose**: Standard entities for generating dynamic Mermaid diagrams in Green Goods issues.
> When generating diagrams, use these consistent entity names and node formats.

## Entity Reference

| Entity | Description | Mermaid Node | Alias |
|--------|-------------|--------------|-------|
| User | End user interacting with app | `U[User]` | `U` |
| Client | PWA frontend (port 3001) | `C[Client PWA]` | `C` |
| Admin | Admin dashboard (port 3002) | `A[Admin Dashboard]` | `A` |
| View | React view/page component | `V[ViewName]` | `V` |
| Hook | Shared React hook | `H[useHookName]` | `H` |
| Store | Zustand store | `S[storeName]` | `S` |
| Indexer | Envio GraphQL API (port 8080) | `I[Indexer]` | `I` |
| Contract | Solidity smart contract | `SC[ContractName]` | `SC` |
| IPFS | Storacha/IPFS storage | `IPFS[IPFS]` | `IPFS` |
| JobQueue | Offline job queue | `JQ[Job Queue]` | `JQ` |
| IndexedDB | Local database | `IDB[IndexedDB]` | `IDB` |

## Standard Flow Patterns

### Full Stack Flow (Feature Implementation)
```mermaid
flowchart LR
    subgraph Client
        V[View] --> H[useHook]
    end
    subgraph Shared
        H --> S[Store]
        H --> GQL[GraphQL Query]
    end
    subgraph Backend
        GQL --> I[Indexer]
        S --> SC[Contract]
    end
    SC --> IPFS[IPFS]
```

### Offline-First Flow
```mermaid
flowchart LR
    U[User] --> V[View]
    V --> H[useHook]
    H --> IDB[IndexedDB]
    H --> JQ[Job Queue]
    JQ -->|When Online| SC[Contract]
    JQ -->|Sync| I[Indexer]
```

### Contract Interaction Flow
```mermaid
sequenceDiagram
    participant U as User
    participant C as Client PWA
    participant H as useContract
    participant SC as Contract
    participant IPFS as IPFS
    participant I as Indexer

    U->>C: Initiates transaction
    C->>H: Calls hook
    H->>SC: Execute function
    SC->>IPFS: Store metadata
    SC-->>I: Emit events
    I-->>H: Index update
    H-->>C: Update state
    C-->>U: Confirm transaction
```

### Hook Data Flow
```mermaid
sequenceDiagram
    participant V as View Component
    participant H as useHookName
    participant S as Store (Zustand)
    participant I as Indexer (GraphQL)
    participant SC as Contract

    V->>H: Call hook
    H->>S: Check/update local state
    H->>I: Fetch data
    I-->>H: Return data
    H->>SC: Read contract state
    SC-->>H: Return value
    H-->>V: Return { data, isLoading, error }
```

## Usage Guidelines

### When to Use Which Pattern

| Issue Type | Recommended Diagram |
|------------|---------------------|
| Bug (UI) | Hook Data Flow |
| Bug (Contract) | Contract Interaction Flow |
| Bug (Offline) | Offline-First Flow |
| Feature (Full Stack) | Full Stack Flow + Sequence |
| Feature (Hook Only) | Hook Data Flow |
| Feature (Contract) | Contract Interaction Flow |
| Polish | Usually no diagram needed |
| Docs | Architecture diagrams as needed |

### Dynamic Generation

When generating diagrams based on issue context:

1. **Identify involved entities** from the issue description
2. **Select appropriate base pattern** from above
3. **Customize entity names** to match actual components
4. **Add/remove nodes** based on what's actually involved

Example transformation:
```
Issue: "Add dark mode toggle that persists preference"

Entities detected: User, View (Settings), Hook (useTheme), Store (themeStore), IndexedDB

Generated diagram:
```mermaid
flowchart LR
    U[User] --> V[Settings View]
    V --> H[useTheme]
    H --> S[themeStore]
    S --> IDB[IndexedDB]
```

## Related Files

- Pattern reference: `packages/shared/src/hooks/garden/useGarden.ts`
- Store example: `packages/shared/src/stores/gardenStore.ts`
- Contract hook: `packages/shared/src/hooks/contracts/useWorkApproval.ts`
