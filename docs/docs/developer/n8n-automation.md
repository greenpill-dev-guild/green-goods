# n8n Issue Automation

Automated pipeline from Google Meet notes to GitHub issues to Cursor Cloud Agents.

## Overview

This workflow automates:
1. **Extraction**: LLM parses Gemini meeting notes for bug candidates
2. **Deduplication**: Searches existing issues before creating new ones
3. **Issue management**: Creates/updates GitHub issues with proper labels
4. **Agent dispatch**: Posts `@cursor` comments to trigger Cloud Agents
5. **Gating**: Routes by severity/priority/size to one-shot vs investigation

See [n8n Automation Diagram](./diagrams#n8n-automation) for visual flow.

---

## Labels & Custom Fields

### Priority (custom field)

*When should we do it?*

| Value | Meaning | SLA |
|-------|---------|-----|
| **P0** | Critical blocker | Fix immediately |
| **P1** | High priority | This sprint |
| **P2** | Normal priority | Next 2 sprints |
| **P3** | Low priority | Backlog |

### Severity (custom field)

*How bad is it for users/protocol?*

| Value | Meaning | Examples |
|-------|---------|----------|
| **low** | Minor annoyance | UI glitch, typo, missing tooltip |
| **med** | Degraded experience | Slow performance, confusing flow |
| **high** | Broken functionality | Auth failure, data loss, incorrect attestations |

### Size (custom field)

*How much effort to fix?*

| Value | Estimate | Typical Scope |
|-------|----------|---------------|
| **XS** | < 1 hour | Typo fix, config change |
| **S** | 1-4 hours | Simple bug fix, add validation |
| **M** | 1-2 days | Feature scaffold, multi-file change |
| **L** | 3-5 days | New component/module, refactor |
| **XL** | 1+ week | Major feature, architecture change |

### Area Labels

| Label | Package |
|-------|---------|
| `area:client` | packages/client |
| `area:admin` | packages/admin |
| `area:shared` | packages/shared |
| `area:contracts` | packages/contracts |
| `area:indexer` | packages/indexer |
| `area:agent` | packages/agent |

### Source Labels

| Label | Origin |
|-------|--------|
| `source:meeting` | Gemini notes from Google Meet |
| `source:bugbot` | Cursor Bugbot review |
| `source:manual` | Human-created |

---

## Gating Rules

### Auto One-Shot Fix

Dispatch `@cursor` to fix immediately when ALL of:
- `severity: low`
- `priority: P2 OR P3`
- `size: XS OR S`
- LLM confidence ≥ 0.75
- No security/auth/contracts deployment risk

### Investigation First

Require investigation when ANY of:
- `severity: med OR high`
- `priority: P0 OR P1`
- `size: M OR L OR XL`
- LLM confidence < 0.75
- Keywords: "auth", "passkey", "deploy", "mainnet", "security"

### Human Triage Required

Skip automation entirely when:
- Multiple packages affected
- Unclear reproduction steps
- Security vulnerability mentioned
- Contract upgrade or deployment
- User data or funds at risk

---

## n8n Workflow Nodes

### 1. Trigger

**Google Drive Trigger**
- Event: File created in folder
- Folders: `Meeting Notes/Product Sync`, `Meeting Notes/Community`

### 2. Fetch Document

**Google Docs Node**
- Action: Get document content
- Output: Plain text of Gemini notes

### 3. Sanitize

**Code Node (JavaScript)**
```javascript
const text = $input.first().json.content;

// Check for potential secrets
const secretPatterns = [
  /ghp_[A-Za-z0-9]{20,}/,
  /sk_live_[0-9A-Za-z]{10,}/,
  /PRIVATE_KEY\s*[:=]/i,
];

const hasSecrets = secretPatterns.some(p => p.test(text));

return [{
  json: {
    text: text,
    hasSecrets: hasSecrets,
    meetingType: $input.first().json.folderName.includes('Product') 
      ? 'product' 
      : 'community'
  }
}];
```

### 4. LLM Extraction

**OpenAI/Anthropic Node**

System prompt:
```
You are analyzing meeting notes to extract bug reports and action items.

For each potential bug, extract:
- title: Short summary (max 80 chars)
- summary: One paragraph description
- stepsToReproduce: Array of steps (if mentioned)
- expected: What should happen
- actual: What actually happens
- area: One of [client, admin, shared, contracts, indexer, agent]
- severity: One of [low, med, high]
- priority: One of [P0, P1, P2, P3]
- size: One of [XS, S, M, L, XL]
- confidence: 0.0-1.0 (how sure are you this is a real bug?)
- keywords: Array of searchable terms
- requiresHumanTriage: boolean

Return JSON array. If no bugs found, return empty array.
```

Output schema:
```json
{
  "bugs": [
    {
      "title": "Loading spinner not appearing on mobile",
      "summary": "When submitting work on mobile Chrome, the loading spinner doesn't show during IPFS upload.",
      "stepsToReproduce": [
        "Open app on mobile Chrome",
        "Navigate to garden",
        "Submit new work with photos",
        "Observe: no spinner during upload"
      ],
      "expected": "Loading spinner appears during submission",
      "actual": "No visual feedback, appears frozen",
      "area": "client",
      "severity": "low",
      "priority": "P2",
      "size": "S",
      "confidence": 0.85,
      "keywords": ["spinner", "mobile", "loading", "IPFS", "upload"],
      "requiresHumanTriage": false
    }
  ]
}
```

### 5. Deduplication

**GitHub Node**
- Action: Search issues
- Query: `repo:greenpill-dev-guild/green-goods is:issue is:open {keywords}`

**Code Node**
```javascript
const bugs = $input.first().json.bugs;
const existingIssues = $('GitHub Search').all();

return bugs.map(bug => {
  // Find matching existing issue by title similarity or keywords
  const match = existingIssues.find(issue => {
    const titleMatch = issue.json.title.toLowerCase()
      .includes(bug.title.toLowerCase().split(' ')[0]);
    const keywordMatch = bug.keywords.some(kw => 
      issue.json.title.toLowerCase().includes(kw.toLowerCase()) ||
      issue.json.body?.toLowerCase().includes(kw.toLowerCase())
    );
    return titleMatch || keywordMatch;
  });

  return {
    json: {
      ...bug,
      existingIssueNumber: match?.json.number || null,
      action: match ? 'update' : 'create'
    }
  };
});
```

### 6. Create or Update Issue

**IF Node**: Split on `action === 'create'`

**GitHub Node (Create)**
```
Title: [{{area}}] {{title}}
Body: 
## Summary
{{summary}}

## Steps to Reproduce
{{stepsToReproduce}}

## Expected
{{expected}}

## Actual
{{actual}}

---
*Source: Meeting notes (automated)*

Labels: area:{{area}}, source:meeting
Custom fields: priority={{priority}}, severity={{severity}}, size={{size}}
```

**GitHub Node (Update)**
```
Comment on issue #{{existingIssueNumber}}:

## Additional Context from Meeting

{{summary}}

{{#if stepsToReproduce}}
### Updated Reproduction Steps
{{stepsToReproduce}}
{{/if}}

---
*Source: Meeting notes (automated)*
```

### 7. Gating Decision

**Code Node**
```javascript
const bug = $input.first().json;

const canAutoFix = 
  bug.severity === 'low' &&
  ['P2', 'P3'].includes(bug.priority) &&
  ['XS', 'S'].includes(bug.size) &&
  bug.confidence >= 0.75 &&
  !bug.requiresHumanTriage;

const needsHumanTriage = 
  bug.requiresHumanTriage ||
  bug.severity === 'high' ||
  bug.priority === 'P0' ||
  ['L', 'XL'].includes(bug.size);

return [{
  json: {
    ...bug,
    dispatchType: canAutoFix ? 'one-shot' : 'investigate',
    skipDispatch: needsHumanTriage
  }
}];
```

### 8. Dispatch Cloud Agent

**GitHub Node (Post Comment)**

One-shot template:
```
@cursor Investigate and fix this bug.

Constraints:
- Identify root cause before implementing fix
- Add a regression test if feasible
- Keep changes minimal and focused
- Follow repo patterns in .cursor/rules/

Validation: {{validationCommand}}

If you cannot fix this confidently, reply with your investigation findings instead.
```

Investigation template:
```
@cursor Investigate this issue and reply with:

- Affected package(s) and files
- Suspected root cause(s)
- Proposed fix plan + risk assessment
- Recommended size estimate (XS/S/M/L/XL)
- Best validation command(s)

Do NOT push code changes yet. Wait for human approval.
```

### 9. Validation Commands by Area

```javascript
const validationCommands = {
  client: 'cd packages/client && bun test && bun test:e2e:smoke',
  admin: 'cd packages/admin && bun test',
  shared: 'cd packages/shared && bun test',
  contracts: 'cd packages/contracts && bun test',
  indexer: 'cd packages/indexer && bun test',
  agent: 'cd packages/agent && bun test',
};

return [{
  json: {
    validationCommand: validationCommands[$input.first().json.area] || 'bun test && bun lint'
  }
}];
```

---

## State Machine Labels

For tracking automation state:

| Label | Meaning |
|-------|---------|
| `cursor:investigating` | Cloud Agent is analyzing |
| `cursor:implementing` | Cloud Agent is coding |
| `cursor:pr-open` | PR opened, awaiting review |
| `triage:needed` | Human review required |
| `triage:approved` | Human approved for auto-fix |

---

## Manual Override

### Approve Investigation for Auto-Fix

If investigation looks good, post:
```
@cursor Implement the fix based on your investigation.

Use the plan you described. Add tests and follow repo patterns.
```

### Cancel Automation

Add label `triage:manual` to prevent further automation.

### Re-trigger

Remove `cursor:*` labels and re-run n8n workflow.

---

## Monitoring

### n8n Webhook for PR Events

Set up GitHub webhook to n8n for:
- PR opened by `cursor[bot]`
- PR merged
- PR closed without merge

Update issue labels accordingly:
- PR opened → `cursor:pr-open`
- PR merged → close issue
- PR closed → `triage:needed`

---

## Reference

- [n8n Automation Diagram](./diagrams#n8n-automation)
- [Cursor Workflows](cursor-workflows)
- [Orchestration Rule](https://github.com/greenpill-dev-guild/green-goods/tree/main/.cursor/rules/orchestration.mdc)
- [Cursor GitHub Integration](https://cursor.com/docs/integrations/github)
- [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent)
