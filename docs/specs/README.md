# Green Goods Specifications

This directory contains feature and technical specifications for Green Goods development.

## Naming Convention

```
GG-FEAT-XXX_[Feature_Name].md          # Feature specification
GG-TECH-XXX_[Feature_Name]_Technical.md # Technical specification
```

Where `XXX` is a sequential number (001, 002, etc.).

## Templates

| Template | Purpose | Use When |
|----------|---------|----------|
| [TEMPLATE-FEATURE.md](TEMPLATE-FEATURE.md) | Product requirements | Starting a new feature |
| [TEMPLATE-TECH.md](TEMPLATE-TECH.md) | Engineering blueprint | After feature spec is approved |

## Workflow

```
1. PRD (Workspace)
   │
   ▼
2. Feature Spec (GG-FEAT-XXX)
   │ - User stories
   │ - Acceptance criteria
   │ - Success metrics
   │
   ▼
3. Tech Spec (GG-TECH-XXX)
   │ - Implementation plan
   │ - Data models
   │ - Testing strategy
   │
   ▼
4. GitHub User Story Issue
   │ - Links to specs
   │ - Done state
   │
   ▼
5. GitHub Task Issues
   │ - Links to tech spec sections
   │ - Implementation guidance
   │
   ▼
6. Implementation → PR → Merge
```

## Creating a New Spec

### Feature Spec

```bash
# Copy template
cp docs/specs/TEMPLATE-FEATURE.md docs/specs/GG-FEAT-XXX_[Name].md

# Edit with your content
# Ensure all sections are filled or marked N/A
```

### Tech Spec

```bash
# Copy template (after feature spec is approved)
cp docs/specs/TEMPLATE-TECH.md docs/specs/GG-TECH-XXX_[Name]_Technical.md

# Link back to feature spec
# Fill implementation details
```

## Linking Specs to Issues

When creating GitHub issues, reference specs directly:

```markdown
## Specifications

**Feature Spec**: [docs/specs/GG-FEAT-005_Hypercerts_Minting_Spec.md](docs/specs/GG-FEAT-005_Hypercerts_Minting_Spec.md)
**Tech Spec**: [docs/specs/GG-TECH-005_Hypercerts_Technical_Spec.md](docs/specs/GG-TECH-005_Hypercerts_Technical_Spec.md)

Key sections:
- Feature Spec §3: User Journey
- Tech Spec §4: Implementation Plan
```

## Spec Review Checklist

Before marking a spec as ready:

- [ ] All sections completed or marked N/A
- [ ] Links to related documents work
- [ ] Acceptance criteria are testable
- [ ] Implementation plan has clear phases
- [ ] Dependencies identified
- [ ] Open questions resolved or tracked

## Existing Specs

| Number | Name | Status |
|--------|------|--------|
| 005 | Hypercerts Minting | Active |
| 006 | Octant Vaults | Active |
| 007 | Gardens Conviction Voting | Active |
