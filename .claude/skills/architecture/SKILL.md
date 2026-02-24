---
name: architecture
user-invocable: false
description: Architecture patterns (Clean, Hexagonal, DDD) and entropy reduction. Use for system design, refactoring, deletion.
version: "1.0.0"
status: active
packages: ["contracts", "shared", "client", "admin"]
dependencies: []
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

# Architecture Skill

System design patterns and entropy reduction philosophy for maintainable codebases.

---

## Activation

When invoked:
- Identify the smallest end-state codebase that solves the problem.
- Look for deletion opportunities before adding new abstractions.
- Validate against Green Goods core rules in `CLAUDE.md`.

## Part 1: Reducing Entropy

### The Goal

**Less total code in the final codebase** - not less code to write right now.

- Writing 50 lines that delete 200 lines = net win
- Keeping 14 functions to avoid writing 2 = net loss
- "No churn" is not a goal. Less code is the goal.

**Measure the end state, not the effort.**

### Three Questions

#### 1. What's the smallest codebase that solves this?

Not "what's the smallest change" - what's the smallest *result*.

- Could this be 2 functions instead of 14?
- Could this be 0 functions (delete the feature)?
- What would we delete if we did this?

#### 2. Does the proposed change result in less total code?

```
Before: X lines
After: Y lines

If Y > X → Question the change
If Y < X → Good direction
```

#### 3. What can we delete?

Every change is an opportunity to delete:
- What does this make obsolete?
- What was only needed because of what we're replacing?
- What's the maximum we could remove?

### Red Flags

| Red Flag | Reality |
|----------|---------|
| "Keep what exists" | Status quo bias. The question is total code, not churn. |
| "This adds flexibility" | Flexibility for what? YAGNI. |
| "Better separation of concerns" | More files/functions = more code. Separation isn't free. |
| "Type safety" | Worth how many lines? Sometimes runtime checks win. |
| "Easier to understand" | 14 things are not easier than 2 things. |

### Prioritization

When trade-offs arise: **Maintainability > Speed > Brevity**

Protect the existing architecture over shipping fast.

---

## Part 2: The Cathedral Test

Before writing code, run this mental checklist. Hold the "cathedral" (system architecture) in mind while laying this "brick" (specific change).

### 1. What Cathedral Am I Building?

Identify the system-level design this change supports:

| Domain | Green Goods Cathedral | Key Pattern |
|--------|----------------------|-------------|
| **Offline sync** | Jobs queue for blockchain writes | `useJobQueue` with `JobKind` enum |
| **State management** | Zustand with granular selectors | Never `(s) => s`, always specific fields |
| **Server state** | TanStack Query with query keys | `queryKeys.gardens.list(chainId)` |
| **Auth** | Dual wallet/passkey system | `useAuth` from shared, never local |
| **Hooks location** | ALL hooks in `@green-goods/shared` | Never define hooks in client/admin |
| **Addresses** | From deployment artifacts | Never hardcode `0x...` |

**Ask**: "Which cathedral does this change belong to?"

### 2. Does This Brick Fit?

Find the most similar existing file and verify alignment:

| Check | Example Reference |
|-------|-------------------|
| Naming conventions | `useGardenMetrics` → `use[Domain][Action]` |
| Error handling | `createMutationErrorHandler()` pattern |
| State updates | `queryInvalidation.gardens(queryClient)` |
| Offline handling | `addJob({ kind: JobKind.WORK_SUBMISSION, ... })` |
| Import structure | `import { x } from '@green-goods/shared'` |

**Reference file**: [identify the closest existing implementation]

### 3. Hidden Global Costs?

Check architectural rules:

| Rule | Check | Fix |
|------|-------|-----|
| **Timer Cleanup** | Raw setTimeout/setInterval? | Use `useTimeout()` |
| **Event Listeners** | Missing removeEventListener? | Use `useEventListener()` or `{ once: true }` |
| **Async Mount Guard** | Async in useEffect without guard? | Use `useAsyncEffect()` |
| **Zustand Selectors** | `(s) => s` pattern? | Never `(s) => s`, use granular selectors |
| **Query Keys** | Inline object keys? | Use `queryKeys.x.y()` helpers |
| **Chained useMemo** | useMemo depending on useMemo? | Combine into single |
| **Context Values** | Inline object in Provider value? | Wrap in useMemo |

**Additional checks**:
- [ ] Will this create waterfall requests?
- [ ] Does this break offline-first guarantee?
- [ ] Is this duplicating logic in `@green-goods/shared`?

### 4. Explain Non-Obvious Violations

When you spot a **non-obvious** violation:
1. Explain the principle being violated
2. Then suggest the fix

*For obvious violations (missing cleanup, hardcoded addresses), the fix is self-explanatory.*

---

## Part 3: Design Patterns

### Clean Architecture (Uncle Bob)

**Layers (dependencies point inward):**

```
┌─────────────────────────────────────────┐
│           Frameworks & Drivers          │  ← UI, Database, External
├─────────────────────────────────────────┤
│           Interface Adapters            │  ← Controllers, Gateways
├─────────────────────────────────────────┤
│              Use Cases                  │  ← Application Logic
├─────────────────────────────────────────┤
│              Entities                   │  ← Business Rules
└─────────────────────────────────────────┘
```

**Key Principles:**
- Dependencies point inward only
- Inner layers independent of outer layers
- Business logic framework-agnostic
- Testable without external infrastructure

### Hexagonal Architecture (Ports & Adapters)

```typescript
// Port (interface)
interface PaymentGateway {
  charge(amount: Money, card: CardDetails): Promise<PaymentResult>;
}

// Adapter (implementation)
class StripeAdapter implements PaymentGateway {
  async charge(amount: Money, card: CardDetails): Promise<PaymentResult> {
    return stripe.charges.create({ /* ... */ });
  }
}

// Domain uses port, not adapter
class OrderService {
  constructor(private payments: PaymentGateway) {}

  async processOrder(order: Order): Promise<void> {
    await this.payments.charge(order.total, order.payment);
  }
}
```

### Domain-Driven Design (DDD)

**Tactical Patterns:**

```typescript
// Value Object (immutable, validated)
class Money {
  constructor(
    readonly amount: number,
    readonly currency: string
  ) {
    if (amount < 0) throw new Error("Amount cannot be negative");
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error("Currency mismatch");
    }
    return new Money(this.amount + other.amount, this.currency);
  }
}

// Entity (identity-based)
class Garden {
  constructor(
    readonly address: Address,  // Identity
    private name: string,
    private actions: Action[]
  ) {}

  addAction(action: Action): void {
    this.actions.push(action);
    this.emit(new ActionAddedEvent(this.address, action));
  }
}

// Aggregate Root (consistency boundary)
class WorkSubmission {
  approve(approver: Operator): void {
    if (this.status !== WorkStatus.Pending) {
      throw new Error("Can only approve pending work");
    }
    this.status = WorkStatus.Approved;
    this.emit(new WorkApprovedEvent(this.id, approver));
  }
}
```

---

## Part 4: Green Goods Application

### Current Architecture

| Pattern | Implementation |
|---------|----------------|
| **Ports** | `@green-goods/shared` interfaces |
| **Adapters** | Package-specific implementations |
| **Bounded Contexts** | `client` (gardeners), `admin` (operators) |
| **Repository Pattern** | Query hooks with IndexedDB/GraphQL |

### When Adding Features

1. **Define the domain entity** in `shared/src/types/`
2. **Create port interface** in `shared/src/hooks/` (query/mutation)
3. **Implement adapter** using existing infrastructure
4. **Keep business logic** in domain, not UI

### Directory Structure

**Current structure** (`packages/shared/src/`):

```
├── components/       # Reusable UI components
├── hooks/            # Domain-organized hooks (app/, auth/, garden/, work/)
├── modules/          # Business logic modules
├── providers/        # React context providers
├── stores/           # Zustand state stores
├── types/            # TypeScript type definitions
└── workflows/        # XState state machines
```

> **Note:** Domain entities are defined in `types/`. Imports should use `@green-goods/shared` barrel exports.

---

## Anti-Patterns

| Anti-Pattern | Problem |
|--------------|---------|
| **Anemic Domain** | Entities with only data, no behavior |
| **Framework Coupling** | Business logic knows about HTTP/DB |
| **Fat Controllers** | Business logic in controllers |
| **Repository Leakage** | ORM objects in domain layer |
| **Missing Abstractions** | Concrete dependencies everywhere |
| **Over-Engineering** | DDD for simple CRUD operations |

---

## Best Practices Summary

1. **Dependencies point inward** — UI depends on domain, never reverse
2. **Small interfaces** — Interface segregation
3. **Domain logic separate** — No framework code in entities
4. **Test without infrastructure** — Mock adapters, test domain
5. **Bounded contexts** — Clear boundaries between domains
6. **Ubiquitous language** — Same terms in code and conversation
7. **Bias toward deletion** — Measure the end state
8. **Rich domain models** — Behavior with data

## Related Skills

- `react` — Component composition and state management patterns
- `testing` — TDD workflow that drives architectural decisions
- `performance` — Bundle analysis and optimization that validate architecture
- `migration` — Cross-package migration when architecture evolves
