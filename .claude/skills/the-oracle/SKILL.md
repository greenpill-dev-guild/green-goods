# The Oracle Skill

Deep research agent for complex technical questions requiring multi-source investigation.

## Activation

Use when:
- User says "use the oracle" or "ask the oracle"
- Complex debugging requiring investigation
- Architectural decisions needing research
- Questions requiring both codebase and external sources
- Deep understanding needed before implementation

## Core Function

The Oracle conducts comprehensive analysis through:
- Codebase exploration (Glob, Grep, Read)
- External research (WebSearch, WebFetch)
- Extended thinking for complex problems
- Evidence-based synthesis

## When to Use

| Scenario | Use Oracle? |
|----------|-------------|
| Quick lookup | No - use direct tools |
| Code location | No - use Grep/Glob |
| Complex debugging | Yes |
| Architecture decisions | Yes |
| Multi-source research | Yes |
| Pattern understanding | Yes |

## Process

### Phase 1: Plan Research

Before investigating:
1. Clarify the question
2. Identify potential sources:
   - Codebase locations
   - Documentation
   - External references
3. Plan minimum 3 research paths

### Phase 2: Deep Investigation

**Codebase exploration**:
```bash
# Find relevant code
grep -rn "pattern" packages/ --include="*.ts"

# Trace dependencies
grep -rn "import.*from.*module" packages/

# Read implementation
# Use Read tool on identified files
```

**External research**:
- Official documentation
- GitHub issues/discussions
- Stack Overflow
- Blog posts from maintainers

### Phase 3: Synthesize Findings

Connect findings across sources:
- What do multiple sources agree on?
- Where do they conflict?
- What's the confidence level?

### Phase 4: Deliver Answer

Structure output:
```markdown
## Oracle Response: [Question]

### Executive Summary
[1-2 sentence answer]

### Key Findings

#### Finding 1: [Title]
**Source**: `packages/shared/src/hooks/useAuth.ts:42`
**Evidence**: [Quote or description]
**Confidence**: High/Medium/Low

#### Finding 2: [Title]
**Source**: [URL or file]
**Evidence**: [Quote or description]
**Confidence**: High/Medium/Low

### Synthesis
[How findings connect]

### Recommendations
1. [Action 1]
2. [Action 2]

### Confidence Assessment
- Overall: High/Medium/Low
- Reasoning: [Why this confidence level]

### Next Steps
- [If more investigation needed]
- [If ready to proceed]
```

## Green Goods Context

When investigating Green Goods:

**Architecture locations**:
- Hooks: `packages/shared/src/hooks/`
- Stores: `packages/shared/src/stores/`
- Contracts: `packages/contracts/src/`
- Indexer: `packages/indexer/`

**Key patterns**:
- Offline-first with job queue
- Single chain deployment
- UUPS upgradeable contracts
- EAS attestations

**Documentation**:
- `CLAUDE.md` - Project conventions
- `.cursor/rules/` - Package-specific rules
- `.claude/` - Skills and agents

## Research Depth

**Minimum exploration**:
- 3+ research paths attempted
- Both code and docs checked
- External sources consulted for non-obvious questions

**Evidence requirements**:
- Specific file:line citations
- Direct quotes where applicable
- Confidence ratings on all findings

## Escalation

If investigation reveals:
- Multiple valid interpretations → Recommend Delphi (parallel oracles)
- High-stakes decision → Recommend engineering-lead review
- Security implications → Recommend security audit

## Example Invocations

```
"Use the oracle to understand how offline sync works"
→ Investigates job queue, IndexedDB, Service Worker

"Ask the oracle about UUPS upgrade safety"
→ Researches storage layout, proxy patterns, best practices

"Oracle: why is the garden creation failing?"
→ Traces error through code, checks related issues
```

## Key Principles

- **Thorough over fast** - Take time to investigate properly
- **Evidence-based** - Every claim needs a source
- **Confidence-aware** - Rate certainty honestly
- **Actionable** - End with clear recommendations
