# Bug Template - Green Goods Extension

> This template extends the generic org-level bug template with Green Goods-specific sections.

## Template Structure

```markdown
# [BUG]: {Title}

## Priority
`critical` | `high` | `medium` | `low`

## Environment
| Attribute | Value |
|-----------|-------|
| Package(s) | {detected from context} |
| Environment | production / staging / local |
| Browser/OS | {if known} |
| Version | {commit or version} |

## Bug Description
{Clear description from investigation}

## Steps to Reproduce
1. {Step 1}
2. {Step 2}
3. {Observe error}

## Expected vs Actual

<details>
<summary>Expected Behavior</summary>

{What should happen}

</details>

<details>
<summary>Actual Behavior</summary>

{What actually happens}

```
{Error message or stack trace}
```

</details>

---

## Green Goods Context

### Package Detection
- [ ] client - PWA (port 3001)
- [ ] admin - Dashboard (port 3002)
- [ ] shared - Hooks & modules
- [ ] contracts - Solidity
- [ ] indexer - Envio GraphQL (port 8080)
- [ ] agent - Telegram bot

### Offline-Related?
- [ ] Occurs in offline mode
- [ ] Occurs during sync
- [ ] Not offline-related

### Root Cause Flow
```mermaid
{AI generates based on bug context using entities.md patterns}
```

<details>
<summary>AI Investigation Notes</summary>

### Files Analyzed
| File | Line(s) | Finding | Validated |
|------|---------|---------|-----------|
| `packages/{package}/src/{path}.ts` | L{n}-{m} | {finding} | ✓/? |

### Error Context
```typescript
// Relevant code snippet
{code}
```

### Root Cause Hypothesis
{What the AI discovered during investigation}

### Suggested Fix
{If fix approach is known}

```typescript
// Proposed fix
{code}
```

</details>

<details>
<summary>GG Pattern References</summary>

| Pattern | Reference File | Validated |
|---------|----------------|-----------|
| Error handling | `packages/shared/src/lib/errors.ts` | ✓ |
| Hook structure | `packages/shared/src/hooks/garden/useGarden.ts` | ✓ |
| Contract calls | `packages/shared/src/hooks/contracts/useWorkApproval.ts` | ✓ |

</details>

<details>
<summary>GG Architecture Docs</summary>

- [Offline-First Design](packages/client/README.md)
- [Job Queue System](packages/shared/src/lib/jobQueue.ts)
- [Hook Patterns](packages/shared/src/hooks/README.md)

</details>

---

## Related Issues
{AI searches existing issues}
- #{issue} - {title} (relevance: high/medium/low)

---

## Effort Estimate
**AI Suggested:** {X hours}
**Final Estimate:** {user confirms}

---

## CLAUDE.md Compliance
- [ ] Hooks in `@green-goods/shared` only
- [ ] No hardcoded contract addresses
- [ ] i18n keys for UI strings

---

## Best Practices Reference
- [Debugging Guide](https://developer.chrome.com/docs/devtools/)
- [Error Handling Patterns](https://www.patterns.dev/posts/error-handling/)
- [Conventional Commits](https://www.conventionalcommits.org/)
```

## Section Visibility

| Section | Visibility |
|---------|------------|
| Priority, Environment, Description | Always visible |
| Steps to Reproduce | Always visible |
| Expected vs Actual | Collapsible |
| GG Context (Package, Offline) | Always visible |
| Root Cause Flow diagram | Always visible |
| AI Investigation Notes | Collapsible |
| Pattern References | Collapsible |
| Architecture Docs | Collapsible |
| Related Issues | Always visible |
| Effort Estimate | Always visible |
| Compliance | Always visible |

## Auto-Detection Rules

### Package Detection from Files
```typescript
const PACKAGE_PATTERNS = {
  client: /packages\/client\//,
  admin: /packages\/admin\//,
  shared: /packages\/shared\//,
  contracts: /packages\/contracts\//,
  indexer: /packages\/indexer\//,
  agent: /packages\/agent\//,
};
```

### Offline Detection Keywords
```typescript
const OFFLINE_KEYWORDS = [
  'offline', 'sync', 'job queue', 'IndexedDB',
  'service worker', 'background sync', 'network'
];
```

## Validation Requirements

Before including pattern references, validate files exist:
- If file missing, search for alternatives
- Mark validated files with ✓
- Mark unvalidated with ?
