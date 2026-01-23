# GitHub Ticket System Guide

> Quick reference for creating AI-ready GitHub issues in Green Goods.

---

## Quick Commands

| Command | Template | Use For |
|---------|----------|---------|
| `/ticket bug "desc"` | Bug Report | Bugs with reproduction steps |
| `/ticket feature "desc"` | Feature Simple | Quick features (1-2 packages) |
| `/ticket feature --complete "desc"` | **Feature Complete** | **AI-buildable specs** (3+ packages) |
| `/ticket task "desc"` | Engineering Task | Specific engineering work |
| `/ticket contract "desc"` | Smart Contract | Contract creation/modification |
| `/ticket hook "desc"` | Shared Hook | New hooks in shared package |
| `/ticket spike "desc"` | Investigation | Research with timebox |

---

## Template Selection Flow

```
Feature Request
       │
       ▼
   Complex?  ─────────────────────────────────────┐
   │                                              │
   │ NO (1-2 packages,                   YES (3+ packages,
   │ online-only)                        offline, AI agent)
   ▼                                              ▼
┌─────────────────┐                   ┌─────────────────────┐
│  feature.md     │                   │  feature-complete.md │
│  (Simple)       │                   │  (AI-Buildable)      │
├─────────────────┤                   ├─────────────────────┤
│ • Problem stmt  │                   │ • Everything in      │
│ • Acceptance    │                   │   simple template    │
│ • Architecture  │                   │ • Given/When/Then    │
│ • File list     │                   │ • TypeScript APIs    │
│ • Compliance    │                   │ • GraphQL schemas    │
└─────────────────┘                   │ • Test fixtures      │
                                      │ • Error matrix       │
                                      │ • Offline patterns   │
                                      │ • Self-verification  │
                                      └─────────────────────┘
```

---

## When to Use `--complete`

Use the AI-buildable template when the feature:

- **Spans 3+ packages** (client + shared + contracts + indexer)
- **Requires offline support** with job queue
- **Will be assigned to an AI agent** for autonomous implementation
- **Needs complex state management** with Zustand stores

---

## Template Locations

```
.claude/skills/gh-ticket/
├── SKILL.md                    # Main workflow instructions
├── entities.md                 # Mermaid entity definitions
└── templates/
    ├── bug.md                  # Bug reports
    ├── docs.md                 # Documentation tasks
    ├── feature.md              # Simple features
    ├── feature-complete.md     # AI-buildable features
    └── polish.md               # Polish/refinement
```

---

## Feature-Complete Template Sections

The AI-buildable template includes these sections that enable autonomous implementation:

| Section | Purpose |
|---------|---------|
| **Acceptance Criteria (Given/When/Then)** | Testable scenarios for happy path, errors, edge cases |
| **TypeScript API Contracts** | Hook interfaces, store types, input/output shapes |
| **GraphQL Schema Additions** | Indexer schema changes with example queries |
| **Test Specifications** | Unit test structure with fixtures and mocks |
| **Error Handling Matrix** | Error codes, messages, recovery actions |
| **Offline Implementation** | Job types, IndexedDB schemas, sync strategies |
| **AI Self-Verification** | Checklist to validate implementation completeness |

---

## Labels Applied Automatically

| Issue Type | Auto Labels |
|------------|-------------|
| Bug | `bug`, `triage` |
| Feature | `enhancement` |
| Task | `task` |
| Contract | `contract` |
| Hook | `component`, `shared` |
| Spike | `spike` |

Package labels are detected from file paths mentioned:
- `packages/client/*` → (implied client work)
- `packages/contracts/*` → `contract`
- `packages/indexer/*` → `api`

---

## Project Board

All issues are automatically added to **Green Goods project board (#4)**:

```bash
gh project item-add 4 --owner greenpill-dev-guild --url [issue-url]
```

---

## Related Resources

- **Full skill workflow**: `.claude/skills/gh-ticket/SKILL.md`
- **Org templates**: `greenpill-dev-guild/.github/.github/ISSUE_TEMPLATE/`
- **Project board**: https://github.com/orgs/greenpill-dev-guild/projects/4

---

*Last updated: January 2026*
