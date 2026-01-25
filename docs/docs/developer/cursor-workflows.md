# Cursor Agent Workflows

This guide documents how to use Cursor's AI agent with MCP integrations for efficient development workflows.

## Overview

Green Goods uses several MCP (Model Context Protocol) servers to tighten the development feedback loop:

| MCP Server | Location | Purpose |
|------------|----------|---------|
| **GitHub** | Global config | Issue triage, PR management, Cloud Agent dispatch |
| **Figma** | Project config | Design file access, screenshots, code generation |
| **Vercel** | Project config | Deployment status |
| **Railway** | Project config | Agent deployment |
| **Miro** | Project config | Diagrams, boards |

### Two GitHub Connections

| Connection | Purpose | How It Works |
|------------|---------|--------------|
| **GitHub MCP** (global) | In-editor orchestration | Read issues, post `@cursor` comments, create PRs |
| **GitHub App** (cloud) | Cloud Agents + Bugbot | Clones repo, pushes commits, opens PRs |

They work together: **MCP dispatches → GitHub App executes**.

---

## Workflow 0: Orchestrator → Cloud Agents (Parallel Issue Dispatch)

Use your Cursor UI as a "command center" to spawn Cloud Agents for multiple issues in parallel.

### Prerequisites

1. **GitHub App installed**: [Cursor Integrations Dashboard](https://cursor.com/dashboard?tab=integrations) → Connect GitHub
2. **GitHub MCP with write access**: Already in your global config with `GITHUB_TOKEN`

### Step 1: Triage Issues

Ask the agent to analyze open issues:

```
Using GitHub MCP:

1. List the top 10 open issues labeled "bug" or "feature" for greenpill-dev-guild/green-goods
2. For each issue:
   - Identify affected package(s): client, admin, shared, indexer, contracts, agent
   - Estimate complexity: trivial, medium, complex
   - Recommend: Cloud Agent vs Local Agent
3. For Cloud Agent candidates, prepare `@cursor` dispatch comments
```

### Step 2: Dispatch Cloud Agents

For each issue you want to offload, have the agent post a comment:

```
Using GitHub MCP, post this comment on issue #123:

@cursor Investigate and fix this issue.

Constraints:
- Identify affected package(s)
- Add/adjust a test first if feasible
- Run the smallest relevant suite (unit or e2e smoke)
- Keep hooks in @green-goods/shared only
- Follow repo rules in .cursor/rules/

Validation:
- If UI: bun test:e2e:smoke
- If shared: cd packages/shared && bun test
- If contracts: cd packages/contracts && bun test
```

The Cloud Agent will:
1. Clone the repo
2. Analyze the issue
3. Implement changes
4. Open a PR for your review

### Step 3: Batch Dispatch (Multiple Issues)

For parallel dispatch:

```
Using GitHub MCP, for each of these issues post the dispatch comment:
- Issue #101: @cursor Fix the loading spinner not appearing on mobile
- Issue #102: @cursor Add aria-labels to garden cards for accessibility
- Issue #103: @cursor Update date formatting to use shared formatDate utility

Use the standard dispatch template with package-appropriate validation commands.
```

### Step 4: Track Progress

```
Using GitHub MCP:

1. List all open PRs authored by cursor[bot] in greenpill-dev-guild/green-goods
2. For each: show title, linked issue, CI status, and review state
3. Flag any that need attention (failed CI, changes requested)
```

### Bugbot + Auto-Fix

When Bugbot flags issues in a PR, dispatch a fix:

```
Using GitHub MCP, post this comment on PR #456:

@cursor fix
```

The Cloud Agent reads Bugbot's suggestions and applies them.

---

## Workflow 1: Issue → Local Agent → Tests → Fix

Use this workflow when addressing bugs or implementing features from GitHub issues.

### Step 1: Fetch Issue Details

```
@github: Get issue #123 from greenpill-dev-guild/green-goods
```

The agent will retrieve the issue body, labels, and comments.

### Step 2: Kickoff Investigation (Bugs)

For bugs, use this prompt template:

```
Take issue #123. 
1. Determine which package(s) are affected
2. Reproduce via the smallest relevant test (prefer `bun test:e2e:smoke` or unit tests)
3. Add/adjust a failing test first
4. Implement the fix
5. Re-run tests and report the diff + output
```

### Step 3: Kickoff Scaffolding (Features)

For new features, use this prompt template:

```
Create initial scaffolding for <feature description>.
- Hooks/providers in `@green-goods/shared` only
- UI components in `packages/client` or `packages/admin`
- Add minimal unit test
- Add Playwright smoke assertion if user-facing
- Follow existing patterns from `.cursor/rules/`
```

### Step 4: Watch Tests Run

Two options for watching tests execute:

**Option A: Playwright UI (time-travel debugging)**

```bash
bun test:e2e:ui
```

Features:
- Step through test timeline
- Inspect DOM at any point
- View network requests
- See console logs

**Option B: Headed Mode (live browser)**

```bash
bun tests/run-tests.ts headed
# or
npx playwright test --headed
```

Features:
- Watch browser execute in real-time
- Good for visual verification
- Faster than UI mode for quick checks

### Step 5: Validate & Commit

```bash
bun format && bun lint && bun test:e2e:smoke
```

Then commit with conventional commit format:

```bash
git commit -m "fix(client): resolve garden loading race condition

Fixes #123"
```

---

## Workflow 2: Figma → Code

Use this when implementing new UI views or components from Figma designs.

### Step 1: Get Figma URL

Copy the URL of the frame or component you want to implement from Figma.

Format: `https://figma.com/design/:fileKey/:fileName?node-id=:nodeId`

### Step 2: Generate Code

```
From this Figma design: [paste URL]

1. Generate the component for packages/client using our existing patterns
2. Use semantic tokens from design-system.mdc (bg-bg-white, text-text-strong, etc.)
3. Add data-testid attributes for e2e stability
4. Show me what files you'd create/modify
```

### Step 3: Iterate

For complex designs, break into steps:

```
From this Figma design: [paste URL]

1. First, show me the design metadata and structure
2. Generate just the layout structure (no styling yet)
3. Now add the styling using our design tokens
4. Add any necessary state/hooks
```

### Step 4: Verify in Browser

```bash
bun dev:client  # or bun dev:admin
```

Then use Cursor Browser MCP to verify:

```
@browser: Navigate to https://localhost:3001/route
@browser: Take a screenshot
```

---

## Workflow 3: Contract Scaffolding

For new Solidity contracts or features.

### Step 1: Create from Issue

```
From issue #456, scaffold a new contract:
1. Create in packages/contracts/src/
2. Follow existing patterns (custom errors, events, UUPS if upgradeable)
3. Add storage gaps if upgradeable
4. Create test file in packages/contracts/test/
5. Don't modify config/schemas.json (it's immutable)
```

### Step 2: Validate

```bash
cd packages/contracts
bun run build && bun run lint && bun run test
```

### Step 3: Integration Testing

For contracts that interact with existing ones:

```bash
bun run test --match-contract Integration
```

---

## Quick Reference: Test Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `bun test:e2e:ui` | Playwright UI debugger | Debugging failures, time-travel |
| `bun tests/run-tests.ts headed` | Visible browser | Quick visual verification |
| `bun test:e2e:smoke` | Fast validation | Before commit/push |
| `bun test:e2e:client` | Client PWA only | Client-specific changes |
| `bun test:e2e:admin` | Admin dashboard only | Admin-specific changes |
| `bun test:e2e:mobile` | Android + iOS | Mobile-specific changes |

---

## Quick Reference: MCP Prompts

### GitHub (from global config)

```
@github: List open issues labeled "bug" in greenpill-dev-guild/green-goods
@github: Get PR #789 diff
@github: Create issue "Add dark mode" with labels: feature, client
```

### Figma

```
@figma: Get design context for [fileKey] node [nodeId]
@figma: Get screenshot for [fileKey] node [nodeId]
@figma: Get variable definitions for [fileKey] node [nodeId]
```

**Note:** Extract `fileKey` and `nodeId` from the Figma URL:
`https://figma.com/design/:fileKey/:fileName?node-id=:nodeId`

### Cursor Browser

```
@browser: Navigate to https://localhost:3001
@browser: Take a screenshot
@browser: Get console messages
@browser: Get network requests
```

### Vercel

```
@vercel: List deployments for green-goods
@vercel: Get build logs for deployment xyz
```

---

## Debugging Checklist

When a test fails:

1. **First**: Run `bun test:e2e:ui` and use time-travel to find failure point
2. **Check DOM**: Inspect element state at failure
3. **Check Network**: Look for failed requests
4. **Check Console**: Look for JS errors
5. **Still stuck?**: Use `@browser` to manually explore the flow

When Figma generation is wrong:

1. **Check selection**: Make sure you've selected the right frame
2. **Simplify**: Select a smaller component first
3. **Iterate**: Generate layout, then styling, then logic separately

---

## Environment Setup

### GitHub MCP

Already configured in your global Cursor settings with `GITHUB_TOKEN`.

### Figma MCP

Defined in root `.mcp.json`. Authenticate via Cursor MCP settings when prompted.

### Playwright

```bash
# First time setup
npx playwright install

# Verify
bun test:e2e:smoke
```

---

## Cloud Agent vs Local Agent

| Scenario | Use Cloud Agent | Use Local Agent |
|----------|-----------------|-----------------|
| **Simple bug fixes** | ✅ Best choice | ⚠️ Overkill |
| **Documentation updates** | ✅ Best choice | ⚠️ Overkill |
| **Parallel issue dispatch** | ✅ Best choice | ❌ Can't parallelize |
| **UI changes (needs visual check)** | ⚠️ PR then local verify | ✅ Watch with `bun test:e2e:ui` |
| **Auth/passkey flows** | ❌ Needs local env | ✅ Has access to secrets |
| **Complex refactoring** | ⚠️ May need guidance | ✅ Interactive iteration |
| **Contract deployment** | ❌ Needs secrets | ✅ Has `.env` access |

### Recommended Hybrid Flow

1. **Dispatch to Cloud Agent** for initial implementation
2. **Pull the PR branch locally**
3. **Watch tests run** with `bun test:e2e:ui` or `headed`
4. **Iterate locally** if needed, then push

---

## Dispatch Templates

### Bug Fix Template

```
@cursor Investigate and fix this bug.

Constraints:
- Identify root cause before implementing fix
- Add a regression test
- Keep changes minimal and focused
- Follow repo patterns in .cursor/rules/

Validation: bun test && bun lint
```

### Feature Scaffold Template

```
@cursor Scaffold this feature.

Constraints:
- Hooks/providers in @green-goods/shared only
- UI components in packages/client (or admin)
- Add unit tests for new logic
- Add data-testid for e2e stability
- Follow design-system.mdc tokens

Validation: bun test && bun test:e2e:smoke
```

### Contract Template

```
@cursor Implement this contract change.

Constraints:
- Use custom errors (not require strings)
- Emit events for state changes
- Add storage gaps if upgradeable
- Don't modify config/schemas.json
- Create test in packages/contracts/test/

Validation: cd packages/contracts && bun test
```

### Indexer Template

```
@cursor Update the indexer for this event.

Constraints:
- Include chainId in all entities
- Use composite IDs: ${chainId}-${identifier}
- Update bidirectional relationships
- Add test in packages/indexer/test/

Validation: cd packages/indexer && bun test
```

---

---

## n8n Automated Pipeline

For fully automated "meeting → issue → Cloud Agent" workflows, see [n8n Automation Guide](n8n-automation).

This extends the manual orchestration above with:
- **Gemini notes extraction**: LLM parses meeting notes for bugs
- **Deduplication**: Searches existing issues before creating
- **Severity/priority/size gating**: Auto-routes to one-shot vs investigation
- **State tracking**: Labels like `cursor:investigating`, `cursor:pr-open`

---

## Reference

- [n8n Automation Guide](n8n-automation) — Full automated pipeline setup
- [Cursor GitHub Integration](https://cursor.com/docs/integrations/github) — Cloud Agents + Bugbot setup
- [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent) — How Cloud Agents work
- [Cursor Bugbot](https://cursor.com/docs/bugbot) — Automated PR review
- [Cursor Web Development Cookbook](https://cursor.com/docs/cookbook/web-development) — General workflows
- [E2E Test Architecture](https://github.com/greenpill-dev-guild/green-goods/tree/main/tests/ARCHITECTURE.md) — Playwright setup
- [E2E Test Quick Start](https://github.com/greenpill-dev-guild/green-goods/tree/main/tests#readme) — Test commands
