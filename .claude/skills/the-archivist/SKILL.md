# The Archivist Skill

Enforce decision documentation as standard practice during code implementation.

## Activation

Use when:
- Making architectural decisions
- Choosing between technologies
- Breaking established patterns
- Adding external dependencies
- Making security/performance trade-offs
- Reasonable alternatives exist

## Core Philosophy

> Code tells you *what* happens.
> Comments tell you *how*.
> Only decisions tell you *why*.

## Three-Tier Documentation System

### Tier 1: Inline Comments

For local, reversible choices.

```typescript
// Using Map instead of object for O(1) key deletion
const cache = new Map<string, CacheEntry>();

// Debouncing to 500ms based on UX testing - faster felt jittery
const debouncedSearch = useDebouncedCallback(search, 500);
```

### Tier 2: Brief ADR

For multi-file decisions. Document in `.plans/DECISIONS.md`:

```markdown
## 2024-01-15: Use Zustand over Redux

**Context**: Need state management for work submission flow.

**Decision**: Zustand with persist middleware.

**Rationale**:
- Simpler API matches our hook-based architecture
- Built-in persistence with partialize
- Smaller bundle size

**Alternatives Rejected**:
- Redux: Too much boilerplate for our needs
- Jotai: Atomic model doesn't fit our use case
- Context: Would cause unnecessary re-renders
```

### Tier 3: Full ADR

For architectural decisions. Create in `.plans/decisions/`:

```markdown
# ADR-001: Offline-First Architecture

## Status
Accepted

## Context
Green Goods is used in areas with poor connectivity. Gardeners
need to document work even without internet.

## Decision
Implement offline-first with:
- IndexedDB for local storage
- Service Workers for caching
- Job queue for background sync

## Consequences
### Positive
- Works without internet
- Faster perceived performance
- Resilient to network issues

### Negative
- Sync conflict handling complexity
- Larger client bundle
- More complex testing

## Alternatives Considered

### Server-First with Offline Cache
Rejected: Poor UX when offline, sync issues on reconnect.

### Local-Only with Export
Rejected: Data not portable, no collaboration features.
```

## Detection Triggers

Document when you notice:
- Technology choice (framework, library, service)
- Architecture pattern selection
- Breaking established conventions
- Adding external dependencies
- Security trade-offs
- Performance trade-offs
- Multiple reasonable alternatives exist

## Critical Process Rule

> Write the decision documentation *before* writing the implementation code.

This forces clarity and prevents post-hoc rationalization.

## Green Goods Directory Structure

```
.plans/
├── DECISIONS.md              # Brief ADRs (Tier 2)
├── decisions/                # Full ADRs (Tier 3)
│   ├── ADR-001-offline-first.md
│   ├── ADR-002-single-chain.md
│   └── ADR-003-hook-architecture.md
└── services/                 # Implementation plans (mutable)
    ├── work-submission.todo.md
    └── garden-creation.todo.md
```

## ADR Naming Convention

```
ADR-[NNN]-[kebab-case-title].md
```

Examples:
- `ADR-001-offline-first-architecture.md`
- `ADR-002-single-chain-deployment.md`
- `ADR-003-uups-upgradeable-contracts.md`

## Existing Key Decisions (Reference)

| Decision | Location | Summary |
|----------|----------|---------|
| Offline-First | Architecture | IndexedDB + Service Workers + Job Queue |
| Single Chain | Deployment | One chain per deployment, no runtime switching |
| Hook Boundary | Architecture | All hooks in shared package |
| UUPS Upgradeable | Contracts | Upgradeable contracts for bug fixes |
| EAS Attestations | Contracts | Use existing attestation infrastructure |

## Proportional Documentation

Match documentation depth to decision significance:

| Impact | Tier | Format |
|--------|------|--------|
| Single file | 1 | Inline comment |
| Multiple files | 2 | Brief in DECISIONS.md |
| System-wide | 3 | Full ADR |

## Key Principles

- **Document before implement** - Clarity first
- **Proportional effort** - Match depth to impact
- **Include alternatives** - Show what was rejected and why
- **Immutable ADRs** - Never edit accepted ADRs, add superseding ones
- **Link to code** - Reference implementation files
