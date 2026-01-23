# Documentation Template - Green Goods Extension

> This template extends the generic org-level docs template with Green Goods-specific sections.

## Template Structure

```markdown
# [DOCS]: {Title}

## Priority
`critical` | `high` | `medium` | `low`

## Documentation Type
`readme` | `api-docs` | `guide` | `architecture` | `agent-rules` | `contributing`

---

## Green Goods Context

### Package Detection
- [ ] project-wide
- [ ] client - PWA documentation
- [ ] admin - Dashboard documentation
- [ ] shared - Hook/utility documentation
- [ ] contracts - Solidity documentation
- [ ] indexer - GraphQL schema documentation
- [ ] agent - Bot documentation
- [ ] .claude - Agent rules/skills

---

## Documentation Scope

### Documents to Update
| Document | Sections | Priority |
|----------|----------|----------|
| `{path}` | {sections} | High/Medium/Low |

### Documents to Create
| Document | Purpose |
|----------|---------|
| `{path}` | {purpose} |

---

## Content Outline

1. **{Section 1}**
   - {Subsection}
2. **{Section 2}**
   - {Subsection}

---

<details>
<summary>Source Material</summary>

### Files to Reference
| Source | What to Extract |
|--------|-----------------|
| `packages/shared/src/hooks/{hook}.ts` | API signatures |
| `packages/contracts/src/{contract}.sol` | NatSpec |

### Code Examples Required
| Example | Language | Purpose |
|---------|----------|---------|
| Basic usage | TypeScript | Show simple usage |
| CLI | Bash | Commands |

</details>

<details>
<summary>AI Implementation Notes</summary>

### GG Documentation Locations
| Doc Type | Location |
|----------|----------|
| Package READMEs | `packages/{pkg}/README.md` |
| Project README | `README.md` |
| Contributing | `CONTRIBUTING.md` |
| Agent rules | `.claude/` |

</details>

---

## Related Issues
- Documents: #{issue}

---

## Effort Estimate
**AI Suggested:** {X hours}
**Final Estimate:** {user confirms}

---

## CLAUDE.md Compliance
- [ ] Follows existing documentation patterns
- [ ] Code examples are tested/runnable
- [ ] Links are valid

---

## Best Practices Reference
- [Technical Writing Guide](https://developers.google.com/tech-writing)
- [Documentation System](https://documentation.divio.com/)
```

## Section Visibility

| Section | Visibility |
|---------|------------|
| Priority, Type | Always visible |
| GG Context | Always visible |
| Documentation Scope | Always visible |
| Content Outline | Always visible |
| Source Material | Collapsible |
| AI Implementation Notes | Collapsible |
| Related Issues | Always visible |
| Effort/Compliance | Always visible |
