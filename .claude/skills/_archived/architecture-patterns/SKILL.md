---
name: architecture-patterns
description: Backend architecture patterns including Clean Architecture, Hexagonal, and DDD. Use when designing systems or refactoring for maintainability.
---

# Architecture Patterns

Proven backend architecture patterns for building maintainable, testable, and scalable systems.

## When to Use

- Designing new backend systems
- Refactoring monolithic applications
- Establishing architecture standards
- Implementing domain-driven principles
- Creating testable codebases
- Planning microservices decomposition

## Core Patterns

### 1. Clean Architecture (Uncle Bob)

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

### 2. Hexagonal Architecture (Ports & Adapters)

**Components:**
- **Domain Core**: Business logic, no infrastructure
- **Ports**: Interface contracts (what the domain needs)
- **Adapters**: Port implementations (how to get it)

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

### 3. Domain-Driven Design (DDD)

**Strategic:**
- Bounded contexts
- Context mapping
- Ubiquitous language

**Tactical:**
- Entities (identity-based)
- Value Objects (immutable, validated)
- Aggregates (consistency boundaries)
- Repositories (data access)
- Domain Events (what happened)

```typescript
// Value Object
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

// Entity
// Note: emit() assumes an event emitter mixin or base class provides emit(event: Event): void
class Garden {
  constructor(
    readonly address: Address,  // Identity
    private name: string,
    private actions: Action[]
  ) {}

  addAction(action: Action): void {
    this.actions.push(action);
    // Assuming event emitter mixin provides emit()
    this.emit(new ActionAddedEvent(this.address, action));
  }
}

// Aggregate Root
// Note: emit() assumes an event emitter mixin or base class provides emit(event: Event): void
class WorkSubmission {
  private constructor(
    readonly id: WorkId,
    private status: WorkStatus,
    private photos: Photo[]
  ) {}

  approve(approver: Operator): void {
    if (this.status !== WorkStatus.Pending) {
      throw new Error("Can only approve pending work");
    }
    this.status = WorkStatus.Approved;
    this.emit(new WorkApprovedEvent(this.id, approver));
  }
}
```

## Directory Structure

```
packages/shared/src/
├── domain/           # Entities, Value Objects, Domain Events
│   ├── garden/
│   │   ├── Garden.ts
│   │   ├── Action.ts
│   │   └── events/
│   └── work/
│       ├── Work.ts
│       └── WorkStatus.ts
├── use-cases/        # Application logic
│   ├── submitWork.ts
│   └── approveWork.ts
├── ports/            # Interfaces
│   ├── GardenRepository.ts
│   └── StorageGateway.ts
└── adapters/         # Implementations
    ├── IndexedDBGardenRepository.ts
    └── StorachaGateway.ts
```

## Green Goods Application

### Current Architecture

Green Goods already follows these patterns:

| Pattern | Implementation |
|---------|----------------|
| **Ports** | `@green-goods/shared` interfaces |
| **Adapters** | Package-specific implementations |
| **Bounded Contexts** | `client` (gardeners), `admin` (operators) |
| **Repository Pattern** | Query hooks with IndexedDB/GraphQL |

### Applying These Patterns

When adding new features:

1. **Define the domain entity** in `shared/src/types/`
2. **Create port interface** in `shared/src/hooks/` (query/mutation)
3. **Implement adapter** using existing infrastructure
4. **Keep business logic** in domain, not UI

## Best Practices

1. **Dependencies point inward** — UI depends on domain, never reverse
2. **Small interfaces** — Interface segregation
3. **Domain logic separate** — No framework code in entities
4. **Test without infrastructure** — Mock adapters, test domain
5. **Bounded contexts** — Clear boundaries between domains
6. **Ubiquitous language** — Same terms in code and conversation
7. **Thin controllers** — Only HTTP concerns
8. **Rich domain models** — Behavior with data

## Anti-Patterns to Avoid

| Anti-Pattern | Problem |
|--------------|---------|
| **Anemic Domain** | Entities with only data, no behavior |
| **Framework Coupling** | Business logic knows about HTTP/DB |
| **Fat Controllers** | Business logic in controllers |
| **Repository Leakage** | ORM objects in domain layer |
| **Missing Abstractions** | Concrete dependencies everywhere |
| **Over-Engineering** | DDD for simple CRUD operations |
