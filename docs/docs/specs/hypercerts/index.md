---
id: hypercerts-overview
title: Hypercerts Minting
sidebar_label: Hypercerts
sidebar_position: 1
description: Specifications for the Hypercerts minting feature
---

# Hypercerts Minting Specifications

This section contains the complete specifications for implementing the Hypercerts minting feature (GG-FEAT-005 / GG-TECH-005).

## Overview

Hypercerts are ERC-1155 tokens that bundle verified work attestations into tradable impact certificates. This feature enables Garden Operators to:

- **Aggregate Work**: Bundle approved work attestations into a single Hypercert
- **Create Impact Certificates**: Mint on-chain certificates representing ecological contributions
- **Enable Yield Allocation**: Use Hypercerts in Conviction Voting for Octant vault yield distribution

## Specifications

| Document | Purpose | Audience |
|----------|---------|----------|
| [Feature Spec](/specs/hypercerts/feature-spec) | Product requirements, user flows, acceptance criteria | Product, Design, QA |
| [Technical Spec](/specs/hypercerts/technical-spec) | Engineering blueprint, architecture, implementation details | Engineering, AI Agents |

## Quick Links

### Feature Spec Highlights
- [User Flows](/specs/hypercerts/feature-spec#3-user-experience-flows-per-action)
- [Non-Functional Requirements](/specs/hypercerts/feature-spec#7-non-functional-requirements-and-constraints)
- [Permission Model](/specs/hypercerts/feature-spec#55-permission-model-hats-protocol-integration)

### Technical Spec Highlights
- [System Architecture](/specs/hypercerts/technical-spec#2-system-overview)
- [Sequence Diagrams](/specs/hypercerts/technical-spec#5-sequence-diagrams)
- [Implementation Guide](/specs/hypercerts/technical-spec#10-implementation-guide)
- [Testing Strategy](/specs/hypercerts/technical-spec#9-testing-strategy-tdd)

## Diagram Assets

All Mermaid diagrams have PNG fallbacks available in the `./images/` directory for use in environments that don't support Mermaid rendering.

| Diagram | Description |
|---------|-------------|
| `system-context.png` | C4 context diagram showing system boundaries |
| `package-dependencies.png` | Monorepo package dependencies |
| `entity-relationship.png` | Data model relationships |
| `complete-minting-sequence.png` | End-to-end minting flow |
| `implementation-dependency-graph.png` | File creation order for implementation |

## Status

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| M1: Schema Complete | Jan 22, 2026 | 🟡 In Progress |
| M2: Wizard UI Complete | Jan 29, 2026 | ⬜ Not Started |
| M3: Minting Works | Feb 5, 2026 | ⬜ Not Started |
| M4: Production Ready | Feb 12, 2026 | ⬜ Not Started |
