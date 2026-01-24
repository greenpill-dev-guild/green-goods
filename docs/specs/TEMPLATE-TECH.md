# GG-TECH-XXX: [Feature Name] Technical Specification

> Technical Specification Template - Copy this file and rename to `GG-TECH-[NUMBER]_[Feature_Name]_Technical.md`

## 1. Overview

### 1.1 Purpose
Engineering blueprint for implementing [Feature Name].

### 1.2 Scope
- **Packages Affected**: `packages/[list]`
- **New Dependencies**: [list or "None"]
- **Breaking Changes**: [list or "None"]

### 1.3 Related Documents
- **Feature Spec**: [docs/specs/GG-FEAT-XXX.md](docs/specs/GG-FEAT-XXX.md)
- **CLAUDE.md**: Architecture constraints and patterns

---

## 2. System Design

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        [Feature Name]                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Component 1]  ──►  [Component 2]  ──►  [Component 3]      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
User Action
    │
    ▼
[Hook/Component]
    │
    ▼
[Store/State]
    │
    ▼
[API/Contract]
    │
    ▼
[Response/Event]
```

### 2.3 Key Design Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| [Decision] | [Why] | [What else was considered] |

---

## 3. Data Models

### 3.1 TypeScript Interfaces

```typescript
// packages/shared/src/types/[feature].ts

export interface [EntityName] {
  id: string;
  // ... fields
  createdAt: Date;
  updatedAt: Date;
}

export type [EntityName]Status = 'pending' | 'active' | 'completed';
```

### 3.2 Database/Indexer Schema

```graphql
# Envio indexer entity (if applicable)
type [EntityName] @entity {
  id: ID!
  # ... fields
  createdAt: BigInt!
}
```

### 3.3 Contract Storage (if applicable)

```solidity
// Storage layout for upgradeable contracts
struct [FeatureName]Storage {
    mapping(address => uint256) values;
    // ...
}
```

---

## 4. Implementation Plan

### 4.1 Phase 1: Foundation
**Duration**: [X days]

| Task | Files | Dependencies |
|------|-------|--------------|
| [Task 1] | `packages/shared/src/...` | None |
| [Task 2] | `packages/shared/src/...` | Task 1 |

### 4.2 Phase 2: Core Implementation
**Duration**: [X days]

| Task | Files | Dependencies |
|------|-------|--------------|
| [Task 3] | `packages/client/src/...` | Phase 1 |

### 4.3 Phase 3: Integration
**Duration**: [X days]

| Task | Files | Dependencies |
|------|-------|--------------|
| [Task 4] | Multiple | Phases 1-2 |

### 4.4 Phase 4: Polish
**Duration**: [X days]

| Task | Files | Dependencies |
|------|-------|--------------|
| [Task 5] | Tests, docs | Phases 1-3 |

---

## 5. API/Contract Interactions

### 5.1 GraphQL Queries (Envio)

```graphql
query Get[Entity]($id: ID!) {
  [entity](id: $id) {
    id
    # ... fields
  }
}
```

### 5.2 Contract Calls

```typescript
// Read operations
const result = await publicClient.readContract({
  address: deployment.[contractName],
  abi: [ContractName]Abi,
  functionName: '[functionName]',
  args: [/* args */],
});

// Write operations (via smart account)
const hash = await walletClient.writeContract({
  address: deployment.[contractName],
  abi: [ContractName]Abi,
  functionName: '[functionName]',
  args: [/* args */],
});
```

### 5.3 External Service Calls

| Service | Endpoint | Purpose |
|---------|----------|---------|
| [Service] | [URL/method] | [Why] |

---

## 6. State Management

### 6.1 Zustand Store

```typescript
// packages/shared/src/stores/[feature]Store.ts

interface [Feature]State {
  // State
  items: [Entity][];
  isLoading: boolean;
  error: Error | null;

  // Actions
  fetch[Entity]: (id: string) => Promise<void>;
  update[Entity]: (data: Partial<[Entity]>) => void;
  reset: () => void;
}

export const use[Feature]Store = create<[Feature]State>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      error: null,

      fetch[Entity]: async (id) => {
        set({ isLoading: true });
        // ... implementation
      },
    }),
    { name: '[feature]-storage' }
  )
);
```

### 6.2 React Query Keys

```typescript
export const [feature]Keys = {
  all: ['[feature]'] as const,
  lists: () => [...[feature]Keys.all, 'list'] as const,
  list: (filters: Filters) => [...[feature]Keys.lists(), filters] as const,
  details: () => [...[feature]Keys.all, 'detail'] as const,
  detail: (id: string) => [...[feature]Keys.details(), id] as const,
};
```

---

## 7. Component Structure

### 7.1 Component Tree

```
[FeaturePage]
├── [FeatureHeader]
├── [FeatureContent]
│   ├── [ChildComponent1]
│   └── [ChildComponent2]
└── [FeatureFooter]
```

### 7.2 Component APIs

```typescript
// [FeatureComponent].tsx
interface [FeatureComponent]Props {
  id: string;
  onComplete?: () => void;
  className?: string;
}

export function [FeatureComponent]({ id, onComplete, className }: [FeatureComponent]Props) {
  // Implementation
}
```

---

## 8. Error Handling

### 8.1 Error Taxonomy

```typescript
export class [Feature]Error extends Error {
  constructor(
    message: string,
    public readonly code: [Feature]ErrorCode,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = '[Feature]Error';
  }
}

export enum [Feature]ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  // ...
}
```

### 8.2 Recovery Strategies

| Error Code | Strategy | User Action |
|------------|----------|-------------|
| NETWORK_ERROR | Auto-retry 3x | Show retry button |
| VALIDATION_ERROR | Show field errors | Fix and resubmit |
| CONTRACT_ERROR | Log and report | Contact support |

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// __tests__/[feature].test.ts
describe('[Feature]', () => {
  it('should [expected behavior]', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### 9.2 Integration Tests

```typescript
// __tests__/integration/[feature].test.ts
describe('[Feature] Integration', () => {
  it('should complete full workflow', async () => {
    // Setup
    // Execute workflow
    // Verify end state
  });
});
```

### 9.3 Contract Tests (if applicable)

```solidity
// test/unit/[Feature].t.sol
contract [Feature]Test is Test {
    function test_[scenario]() public {
        // Arrange
        // Act
        // Assert
    }
}
```

---

## 10. Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial load | < 2s | Lighthouse |
| Interaction response | < 100ms | Performance API |
| [Feature]-specific | [Target] | [How to measure] |

---

## 11. Security Considerations

### 11.1 Threats
- [Threat 1]: [Mitigation]
- [Threat 2]: [Mitigation]

### 11.2 Permissions
- [Who can do what]

---

## 12. Deployment

### 12.1 Feature Flags
- `VITE_ENABLE_[FEATURE]`: Enable/disable feature

### 12.2 Migration Steps
1. [Step 1]
2. [Step 2]

### 12.3 Rollback Plan
- [How to rollback if issues]

---

## 13. Changelog

| Date | Author | Change |
|------|--------|--------|
| YYYY-MM-DD | @[author] | Initial draft |
