# Agent Routing Logic

Determines which AI coding agent handles each issue type based on context quality.

## Core Principle

> **Context Quality Determines Autonomy**
>
> High context → Autonomous agent execution
> Low context → Investigation first, then implementation

---

## Agent Capabilities

| Agent | Strengths | Best For | Limitations |
|-------|-----------|----------|-------------|
| **Codex** | Multi-file features, scaffolding, complex implementations | Features, hooks, views | Less effective for debugging |
| **Claude Code** | Debugging, analysis, documentation, careful edits | Bugs, polish, docs, contracts | Can be verbose |
| **Cursor** | Investigation, exploration, quick fixes | Spikes, research, prototypes | Needs supervision for production |

---

## Context Quality Assessment

### Context Sources

| Source | Weight | Required For |
|--------|--------|--------------|
| Parent PRD | 2 | Features, Stories |
| Tech Spec | 3 | Complex features, Contracts |
| Parent Story | 2 | Features |
| Pattern Reference | 2 | All implementations |
| Related Issues | 1 | All |
| Documentation | 1 | All |

### Quality Levels

| Level | Score | Agent Mode |
|-------|-------|------------|
| **High** | 7+ | Autonomous |
| **Medium** | 4-6 | Supervised |
| **Low** | 0-3 | Investigate first |

### Calculation

```javascript
function calculateContextQuality(issue) {
  let score = 0;

  // Upstream artifacts
  if (issue.prdNumber) score += 2;
  if (issue.techSpecNumber) score += 3;
  if (issue.storyNumber) score += 2;

  // Implementation guidance
  if (issue.patternReferences?.length > 0) score += 2;
  if (issue.relatedIssues?.length > 0) score += 1;
  if (issue.documentationLinks?.length > 0) score += 1;

  return {
    score,
    level: score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low',
  };
}
```

---

## Routing Decision Tree

```
Issue Created
    │
    ├── Assess Context Quality
    │   ├── Has Tech Spec? (+3)
    │   ├── Has Parent PRD? (+2)
    │   ├── Has Parent Story? (+2)
    │   ├── Has Pattern Refs? (+2)
    │   └── Score: High (7+) / Medium (4-6) / Low (0-3)
    │
    ├── Is it a PRD/Epic?
    │   └── NO DISPATCH → Await approval, create tech spec if needed
    │
    ├── Is it a Tech Spec?
    │   └── NO DISPATCH → Await approval, then generate stories
    │
    ├── Is it a Story?
    │   ├── Has tech spec approved?
    │   │   └── YES → Generate feature tasks with spec context
    │   ├── Has clear acceptance criteria?
    │   │   └── YES → Generate feature tasks
    │   └── NO → Create tech spec first or human breakdown
    │
    ├── Is it a Feature?
    │   ├── Context Quality HIGH + has spec?
    │   │   └── Codex (autonomous) - full context available
    │   ├── Context Quality MEDIUM?
    │   │   └── Codex (supervised) - some checkpoints needed
    │   ├── Context Quality LOW?
    │   │   └── Cursor (investigate) → gather context → re-route
    │   ├── Is it a contract?
    │   │   └── Claude Code (supervised) + security review + spec required
    │   └── No tech spec but complex?
    │       └── Create tech spec first
    │
    ├── Is it a Bug?
    │   ├── Severity high or security-related?
    │   │   └── Claude Code (supervised)
    │   ├── Involves contracts?
    │   │   └── Claude Code (supervised) + security review
    │   └── Standard bug?
    │       └── Claude Code (autonomous)
    │
    ├── Is it Polish?
    │   └── Claude Code (autonomous)
    │
    ├── Is it Documentation?
    │   └── Claude Code (autonomous)
    │
    ├── Is it a Spike/Investigation?
    │   └── Cursor (investigate-only) → may produce tech spec
    │
    └── Unknown type or Low context?
        └── Cursor (investigate) → re-assess after findings
```

---

## Tech Spec Integration

### When Tech Spec is Required

| Scenario | Spec Required | Reason |
|----------|---------------|--------|
| New contract interface | ✅ Yes | Security review needed |
| Database schema changes | ✅ Yes | Migration planning |
| Complex state management | ✅ Yes | Architecture decisions |
| API design | ✅ Yes | Contract stability |
| 3+ packages affected | ✅ Yes | Coordination needed |
| Simple UI change | ❌ No | Low complexity |
| Bug fix | ❌ No | Fix, not design |

### Spec Status → Dispatch Rules

| Spec Status | Feature Dispatch |
|-------------|------------------|
| `status:approved` | ✅ Can dispatch with full context |
| `status:review` | ⏳ Wait for approval |
| `status:draft` | ⏳ Wait for review cycle |
| No spec (simple feature) | ✅ Dispatch if context score ≥ 4 |
| No spec (complex feature) | ❌ Create spec first |

### Context Injection from Tech Spec

When a tech spec exists, inject into agent dispatch:

```markdown
## From Tech Spec #{spec_number}

### API Contract
{extracted from spec}

### Data Model
{extracted from spec}

### Error Handling
{extracted from spec}

### Security Requirements
{extracted from spec}
```

---

## Routing Matrix

| Issue Type | Complexity | Primary Agent | Mode | Post-Action |
|------------|------------|---------------|------|-------------|
| PRD | - | None | await-approval | Generate stories |
| Story | - | None | generate-features | Create features |
| Feature | Simple (S/M) | Codex | autonomous | Auto-review |
| Feature | Complex (L/XL) | Codex | supervised | Human review |
| Feature (complete) | Any | Codex | supervised | Human review |
| Hook | Any | Codex | autonomous | code-reviewer agent |
| Contract | Any | Claude Code | supervised | Security review |
| Bug | Low severity | Claude Code | autonomous | Auto-merge if tests pass |
| Bug | High severity | Claude Code | supervised | Human review |
| Bug | Security | Claude Code | supervised | Security team |
| Polish | Any | Claude Code | autonomous | Design review |
| Documentation | Any | Claude Code | autonomous | Auto-merge |
| Spike | Any | Cursor | investigate-only | Await approval |

---

## Routing Implementation

### TypeScript Interface

```typescript
interface IssueContext {
  type: 'prd' | 'story' | 'feature' | 'bug' | 'hook' | 'contract' | 'polish' | 'docs' | 'spike';
  title: string;
  labels: string[];
  packagesAffected: string[];
  severity?: 'low' | 'medium' | 'high';
  complexity?: 'XS' | 'S' | 'M' | 'L' | 'XL';
  hasCompleteFlag?: boolean;
  isSecurityRelated?: boolean;
  parentStory?: number;
  parentPRD?: number;
}

interface RoutingDecision {
  agent: 'codex' | 'claude' | 'cursor' | null;
  mode: 'autonomous' | 'supervised' | 'investigate-only' | 'generate-features' | 'await-approval' | 'manual';
  dispatchTemplate: string | null;
  postActions: ('auto-review' | 'security-review' | 'design-review' | 'human-review' | 'auto-merge')[];
  reason: string;
}

function routeIssue(context: IssueContext): RoutingDecision {
  // PRDs - no dispatch, await approval
  if (context.type === 'prd') {
    return {
      agent: null,
      mode: 'await-approval',
      dispatchTemplate: null,
      postActions: [],
      reason: 'PRDs require human approval before story generation'
    };
  }

  // Stories - generate features
  if (context.type === 'story') {
    return {
      agent: null,
      mode: 'generate-features',
      dispatchTemplate: null,
      postActions: [],
      reason: 'Stories decompose into feature tasks'
    };
  }

  // Features - Codex
  if (context.type === 'feature' || context.type === 'hook') {
    const isComplex = context.hasCompleteFlag ||
      context.packagesAffected.length > 2 ||
      ['L', 'XL'].includes(context.complexity || '');

    const isHook = context.type === 'hook' ||
      context.labels.includes('component') ||
      context.title.toLowerCase().includes('hook');

    return {
      agent: 'codex',
      mode: isComplex ? 'supervised' : 'autonomous',
      dispatchTemplate: 'feature',
      postActions: isHook ? ['auto-review'] : (isComplex ? ['human-review'] : ['auto-review']),
      reason: isComplex
        ? 'Complex feature requires supervision'
        : 'Standard feature can be autonomous'
    };
  }

  // Contracts - Claude with supervision
  if (context.type === 'contract' || context.labels.includes('contract')) {
    return {
      agent: 'claude',
      mode: 'supervised',
      dispatchTemplate: 'contract',
      postActions: ['security-review', 'human-review'],
      reason: 'Contract changes require security review'
    };
  }

  // Bugs - Claude
  if (context.type === 'bug') {
    const isHighSeverity = context.severity === 'high' || context.isSecurityRelated;
    const involvesContracts = context.packagesAffected.includes('packages/contracts');

    if (involvesContracts) {
      return {
        agent: 'claude',
        mode: 'supervised',
        dispatchTemplate: 'bug-fix',
        postActions: ['security-review', 'human-review'],
        reason: 'Bug affects contracts - requires security review'
      };
    }

    if (isHighSeverity) {
      return {
        agent: 'claude',
        mode: 'supervised',
        dispatchTemplate: 'bug-fix',
        postActions: ['human-review'],
        reason: 'High severity bug requires human review'
      };
    }

    return {
      agent: 'claude',
      mode: 'autonomous',
      dispatchTemplate: 'bug-fix',
      postActions: ['auto-merge'],
      reason: 'Standard bug can be auto-fixed'
    };
  }

  // Polish - Claude autonomous
  if (context.type === 'polish') {
    return {
      agent: 'claude',
      mode: 'autonomous',
      dispatchTemplate: 'polish',
      postActions: ['design-review'],
      reason: 'Polish tasks are low-risk'
    };
  }

  // Documentation - Claude autonomous
  if (context.type === 'docs') {
    return {
      agent: 'claude',
      mode: 'autonomous',
      dispatchTemplate: 'documentation',
      postActions: ['auto-merge'],
      reason: 'Documentation is low-risk'
    };
  }

  // Spikes - Cursor investigation
  if (context.type === 'spike') {
    return {
      agent: 'cursor',
      mode: 'investigate-only',
      dispatchTemplate: 'investigation',
      postActions: [],
      reason: 'Spikes need investigation before implementation'
    };
  }

  // Fallback - manual triage
  return {
    agent: null,
    mode: 'manual',
    dispatchTemplate: null,
    postActions: [],
    reason: 'Unknown issue type requires human triage'
  };
}
```

---

## Dispatch Templates

### Codex - Feature Implementation

```markdown
@codex Implement this feature.

**Context**: Green Goods offline-first PWA for conservation work.

**Architecture Rules**:
1. All hooks MUST be in `packages/shared/src/hooks/`
2. Contract addresses from deployment artifacts only
3. i18n keys in en.json, es.json, pt.json
4. Follow existing patterns (see CLAUDE.md)

**Implementation Order**:
1. Types/interfaces first
2. Hook implementation
3. Store (if needed)
4. View components
5. Tests
6. i18n keys

**Validation**:
```bash
bun lint && bun test && bun build
npx tsc --noEmit
```

**If blocked**: Document the blocker and request human review.
```

### Claude - Bug Fix

```markdown
@claude Investigate and fix this bug.

**Approach**:
1. Reproduce the issue (if possible)
2. Identify root cause with code analysis
3. Write failing test first (TDD)
4. Implement minimal fix
5. Verify all tests pass

**Constraints**:
- Minimal, focused changes only
- No unrelated refactoring
- Add regression test
- Update any affected documentation

**Validation**:
```bash
bun test && bun lint
```

**If uncertain**: Document findings and request human guidance.
```

### Claude - Contract Work

```markdown
@claude Implement this contract change.

**CRITICAL SECURITY REQUIREMENTS**:
- Follow Checks-Effects-Interactions (CEI) pattern
- Add reentrancy guards where needed
- Validate all inputs
- Emit events for state changes
- No tx.origin for authorization

**Testing Requirements**:
- 100% coverage required
- Include fuzz tests for parameters
- Gas snapshot must be updated

**Validation**:
```bash
cd packages/contracts
forge test -vvv
forge coverage
forge snapshot --check
```

**Security Checklist**:
- [ ] CEI pattern followed
- [ ] Access control verified
- [ ] Integer overflow protected
- [ ] Events emitted
- [ ] NatSpec complete

Request security review before merge.
```

### Claude - Polish

```markdown
@claude Apply this UI polish.

**Focus Areas**:
- Visual consistency with existing components
- WCAG 2.1 AA accessibility
- Responsive behavior (mobile-first)
- Smooth interactions and transitions

**Validation**:
- Visual review in browser
- Axe accessibility audit
- Test on mobile viewport (375px, 768px)

**Don't**:
- Change component APIs
- Refactor unrelated code
- Add new dependencies
```

### Claude - Documentation

```markdown
@claude Update documentation as specified.

**Guidelines**:
- Concise and actionable
- Include code examples
- Update outdated references
- Verify all links work
- Follow existing doc style

**Validation**:
- Links are valid
- Code examples run
- No broken markdown
```

### Cursor - Investigation

```markdown
@cursor Investigate this issue.

**Deliverables Required**:
1. **Affected Components**: List all files and packages involved
2. **Root Cause Analysis**: What's causing the issue?
3. **Proposed Solutions**: At least 2 options with trade-offs
4. **Effort Estimate**: XS/S/M/L/XL for each solution
5. **Risk Assessment**: What could go wrong?
6. **Recommended Approach**: Your suggestion and why

**Do NOT implement changes** - investigation only.

Post findings as a comment when complete.
```

---

## Mode Definitions

| Mode | Behavior | Human Touchpoints |
|------|----------|-------------------|
| `autonomous` | Agent works independently, creates PR | PR review only |
| `supervised` | Agent works, but pauses for approval at key points | Multiple checkpoints |
| `investigate-only` | Agent researches but doesn't change code | Approve before implementation |
| `generate-features` | System creates child issues | Review generated issues |
| `await-approval` | No action until human approves | Explicit approval required |
| `manual` | No automation | Full human handling |

---

## Post-Action Definitions

| Action | Trigger | Behavior |
|--------|---------|----------|
| `auto-review` | PR created | Run code-reviewer agent automatically |
| `security-review` | PR created | Request security team review |
| `design-review` | PR created | Request design team review |
| `human-review` | PR created | Require human approval |
| `auto-merge` | Tests pass | Merge automatically if CI green |

---

## Overrides

### Manual Override via Labels

| Label | Effect |
|-------|--------|
| `agent:codex` | Force Codex dispatch |
| `agent:claude` | Force Claude dispatch |
| `agent:cursor` | Force Cursor dispatch |
| `agent:none` | Skip automation |
| `mode:supervised` | Force supervised mode |
| `mode:autonomous` | Force autonomous mode |

### Override via Comment

```markdown
/assign-agent codex supervised
/assign-agent claude autonomous
/skip-automation
```

---

## Metrics & Monitoring

### Track Per Agent

| Metric | Description |
|--------|-------------|
| Dispatch count | Issues sent to agent |
| Success rate | PRs merged / dispatched |
| Time to PR | Dispatch → PR created |
| Time to merge | PR → merged |
| Revision count | Comments/changes before merge |
| Rollback rate | PRs that caused issues |

### Alert Thresholds

| Condition | Alert |
|-----------|-------|
| Agent blocked > 24h | Notify team |
| Success rate < 70% | Review agent prompts |
| Time to PR > 48h | Check for blockers |
| Rollback rate > 5% | Pause automation |
