# ADR-019: Local-First Data Architecture

**Date**: 2026-04-12
**Status**: Draft

## Context

Green Goods already behaves as an offline-first PWA, but its read side is still network-led. The client uses IndexedDB for the job queue and drafts, Workbox for cached assets and indexer reads, and TanStack Query with `networkMode: "offlineFirst"`. That gives a workable offline story for mutation-heavy flows, but it leaves several read-side gaps:

- cached indexer reads expire and can fall back to empty results
- the browser has no local SQL layer for richer queries or durable read-side mirrors
- form state and some workflow state remain too ephemeral
- wallet users do not share the same offline queue guarantees as passkey flows

The archived `2026-02-19-local-first-evolution` hub explored a broad execution plan. That material is worth keeping, but it should live as architecture guidance instead of occupying backlog space.

## Decision

Treat local-first as a staged architecture direction rather than an execution-ready backlog feature.

### 1. Prefer a staged local read store over a rewrite

The first meaningful step is a persistent local read mirror for gardens, actions, and gardeners. That can sit beside the current offline-first queue without replacing the product architecture.

### 2. Keep the sequence narrow

The intended order is:

1. add a durable local read store
2. improve read fallback and stale-state behavior
3. harden form and workflow persistence
4. evaluate a sync engine only after the local read mirror proves useful

### 3. Preserve existing boundaries

This direction must preserve the current package boundaries, the client/shared split, and the job queue model already used for offline submissions. It is an evolution of ADR-001, not a greenfield local-first rewrite.

## Consequences

- The roadmap keeps the strongest part of the research: durable offline reads and staged adoption.
- Backlog stays execution-focused instead of holding a large architecture proposal.
- Any future implementation still needs fresh validation of browser/runtime ecosystem claims before work begins.

## Open Questions

- Should the local read store use `wa-sqlite`, `libSQL`, or another browser-safe SQLite path?
- How should the client race network, cache, and local read mirrors without increasing inconsistency?
- Should wallet submission flows gain queue parity before or after the local read mirror lands?
- When, if ever, does a sync engine such as ElectricSQL become necessary?
