---
id: specs-overview
title: Specifications
sidebar_label: Specifications
sidebar_position: 1
description: Feature and technical specifications for Green Goods
---

# Specifications

This section contains detailed feature and technical specifications for Green Goods platform features. Each feature has two companion documents:

| Document Type | Purpose | Primary Audience |
|--------------|---------|------------------|
| **Feature Spec** (GG-FEAT-XXX) | Product requirements, user stories, acceptance criteria | Product, Design, QA |
| **Technical Spec** (GG-TECH-XXX) | Engineering architecture, implementation details, TDD stubs | Engineering, AI Agents |

## Available Specifications

### [Hypercerts Minting](/specs/hypercerts)

**Status:** 🟡 In Development

Bundle verified work attestations into ERC-1155 Hypercert tokens for on-chain impact certification.

- Feature Spec: GG-FEAT-005
- Technical Spec: GG-TECH-005
- Priority: High
- Estimated Effort: 4 weeks

---

### Octant Vaults

**Status:** 📋 Planned

Enable Garden treasuries to deposit into yield-generating vaults with yield routed to Hypercert fraction purchases via conviction voting.

- Feature Spec: GG-FEAT-006 (coming soon)
- Technical Spec: GG-TECH-006 (coming soon)
- Priority: High
- Estimated Effort: 8 weeks


---

### [ENS Integration](/specs/ens)

**Status:** 📋 Planned

Garden and gardener ENS identity management, including registration status and operator flows.

- Feature Spec: GG-FEAT-008
- Technical Spec: GG-TECH-008
- Priority: Medium

---

### [Cookie Jar](/specs/cookie-jar)

**Status:** 📋 Planned

Allowance-based micro-disbursement integration for member claims.

- Feature Spec: GG-FEAT-009
- Technical Spec: GG-TECH-009
- Priority: High

---

### [Yield Splitting](/specs/yield-splitting)

**Status:** 📋 Planned

Protocol-level yield distribution routing across treasury and integration targets.

- Feature Spec: GG-FEAT-010
- Technical Spec: GG-TECH-010
- Priority: High

---

### [Juicebox Routing](/specs/juicebox)

**Status:** 📋 Planned

Route configured yield slices into Juicebox projects with auditable payment records.

- Feature Spec: GG-FEAT-011
- Technical Spec: GG-TECH-011
- Priority: Medium


### Gardens Conviction Voting

**Status:** 📋 Planned

Integrate Gardens V2 Conviction Voting for community-driven yield allocation to Hypercert fraction purchases, with the `HypercertYieldAllocator` adapter bridging Gardens and Hypercerts.

- Feature Spec: GG-FEAT-007 (coming soon)
- Technical Spec: GG-TECH-007 (coming soon)
- Priority: High
- Estimated Effort: 6 weeks

---

## Specification Standards

### Naming Convention

```
GG-[TYPE]-[NUMBER]_[Feature_Name]_Spec.md
```

- `GG-FEAT-XXX`: Feature specification (product-focused)
- `GG-TECH-XXX`: Technical specification (engineering-focused)
- `GG-EXPLORATION-XXX`: Research/exploration documents

### Required Sections

**Feature Specs:**
1. Feature Overview
2. User Stories
3. User Flows
4. UI/UX Requirements
5. Integration Points
6. Data Requirements
7. Acceptance Criteria
8. Edge Cases

**Technical Specs:**
1. Overview & Scope
2. System Architecture
3. Data Models
4. Sequence Diagrams
5. Implementation Plan
6. Testing Strategy (TDD)
7. Deployment

### Diagram Standards

- Use **Mermaid** for all diagrams (auto-renders on GitHub)
- Include **PNG fallbacks** in `./images/` directory for non-Mermaid environments
- Use collapsible `<details>` blocks for fallback images

---

## Templates

Use these templates when creating new specifications:

| Template | Use For |
|----------|---------|
| [Feature Template](/specs/templates/feature-template) | Product requirements, user stories, acceptance criteria |
| [Technical Template](/specs/templates/technical-template) | Engineering architecture, implementation details, testing strategy |

### Creating a New Spec

1. Create a new folder: `docs/docs/specs/[feature-name]/`
2. Copy templates into the folder:
   - `feature-spec.md` (from feature template)
   - `technical-spec.md` (from technical template)
3. Add `_category_.json` for sidebar configuration
4. Add `index.md` as a landing page (optional)
5. Link the spec in this index page under "Available Specifications"
