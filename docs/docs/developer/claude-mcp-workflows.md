# Claude Code MCP Workflows

This guide documents how to use Claude Code with MCP (Model Context Protocol) integrations for efficient development workflows in Green Goods.

## MCP Server Status

| Server | Type | Status | Authentication |
|--------|------|--------|----------------|
| **Figma** | Remote URL | Active | Greenpill Dev Guild (Pro) |
| **Vercel** | Remote URL | Active | CLI authenticated |
| **Foundry** | Local Tools | Active | forge v1.3.5-stable |
| **Storacha** | Local npx | Requires Config | Needs env vars |
| **Miro** | Remote URL | Available | On-demand auth |
| **Railway** | Local npx | Available | On-demand auth |

### Known Issues

**Local npx servers (Storacha, Railway):** The project's npm overrides for React 19 can cause conflicts when spawning npx-based MCP servers from within the project directory. Workarounds:

1. Use the Vercel/Figma skills which use remote URLs
2. For Foundry, use direct `forge`/`cast`/`anvil` commands (they work perfectly)
3. For Railway/Storacha, authenticate the CLIs globally

---

## Server-by-Server Workflows

### Figma MCP (Design-to-Code)

**Purpose:** Extract design context, generate UI code, manage Code Connect mappings.

**Available Tools:**

| Tool | Purpose | Invocation |
|------|---------|------------|
| `get_design_context` | Extract UI specs + code | Provide Figma URL |
| `get_screenshot` | Capture node images | "Screenshot this Figma node" |
| `get_metadata` | Get node structure | "Show structure of this design" |
| `get_variable_defs` | Extract design tokens | "Get design variables" |
| `add_code_connect_map` | Link Figma → code | "Connect this component" |
| `generate_diagram` | Create FigJam diagrams | "Create flowchart" |
| `whoami` | Check authentication | "Check Figma auth" |

**Workflow: Implement Design from Figma**

```
1. Copy Figma URL: https://figma.com/design/ABC123/File?node-id=1-2
2. Request implementation:
   "Implement this Figma design: [URL]
    - Use @green-goods/shared components
    - Follow our design tokens
    - Add data-testid for e2e"
3. Claude extracts design context via MCP
4. Generates React component matching specs
5. Downloads referenced assets
```

**Workflow: Set Up Code Connect**

```
After implementing a component that matches a Figma design:

"Connect the Button component at packages/shared/src/components/Button.tsx
 to Figma node 1:234 in file ABC123"

Claude uses add_code_connect_map to create the mapping.
Future designs referencing that Figma component will auto-suggest your code.
```

**Best Practices:**

- Structure Figma files with clear component hierarchy
- Name Figma layers semantically (matches easier)
- Set up Code Connect for design system components early
- Use variable definitions for consistent theming

---

### Vercel MCP (Deployment)

**Purpose:** Deploy applications, view logs, manage environments.

**Invocation Methods:**

| Method | Command | Use Case |
|--------|---------|----------|
| Skill | `/vercel:deploy` | Quick deploy |
| Skill | `/vercel:logs` | Check deployment |
| Skill | `/vercel:setup` | Initial config |
| Direct | "Deploy to Vercel" | Conversational |

**Workflow: Deploy After PR Merge**

```bash
# 1. Validate locally
bun format && bun lint && bun test && bun build

# 2. Deploy via Claude
"Deploy the client to Vercel production"

# 3. Monitor
"/vercel:logs"
```

**Workflow: Preview Deployments**

```
"Deploy a preview of the current branch to Vercel"

Claude will:
1. Check current branch status
2. Create preview deployment
3. Return preview URL for testing
```

**Environment Variables:**

Vercel environments are managed separately. For new env vars:

```
"Add VITE_NEW_KEY to Vercel environment for client"
```

---

### Foundry MCP (Smart Contracts)

**Purpose:** Direct access to forge, cast, anvil for contract development.

**Available Commands:**

| Tool | Purpose | Example |
|------|---------|---------|
| `forge build` | Compile contracts | "Compile the contracts" |
| `forge test` | Run tests | "Test the GardenToken" |
| `forge script` | Run scripts | "Run deploy script (dry run)" |
| `cast call` | Read contract state | "Get garden operator list" |
| `cast send` | Write transactions | "Register action on testnet" |
| `cast balance` | Check balances | "Check deployer balance" |
| `anvil` | Local node | "Start local Anvil fork" |

**Workflow: Contract Development Loop**

```
1. "Create a new contract for batch work approvals"
   → Claude scaffolds contract + test

2. "Compile the contracts"
   → forge build with size report

3. "Run the batch approval tests"
   → forge test --match-contract BatchApproval

4. "Estimate gas for approveWorks([addr1, addr2])"
   → cast estimate on Base Sepolia

5. "Deploy to testnet" (when ready)
   → Use bun deploy:testnet (not raw forge script)
```

**Workflow: Query Contract State**

```
"What actions are registered for garden 0x1234...?"

Claude uses cast call to query ActionRegistry:
cast call $ACTION_REGISTRY "getGardenActions(address)" 0x1234...
```

**Important:** Always use `bun deploy:testnet` for actual deployments (loads env, handles schemas, updates indexer).

---

### Storacha MCP (IPFS/Filecoin)

**Purpose:** Upload work media to decentralized storage, retrieve CIDs.

**Prerequisites:**

```bash
# In root .env (not package-specific!):
VITE_STORACHA_KEY=your_private_key
VITE_STORACHA_PROOF=your_delegation_proof
```

**Workflow: Upload Work Media**

```
"Upload this image to IPFS and return the CID"

Claude:
1. Reads the file
2. Uploads via Storacha MCP
3. Returns CID: bafybeigdyrzt5sfp7udm7hu76uh7y26nf3...
```

**Integration with Job Queue:**

In the client PWA, work submissions use Storacha through the job queue:

```typescript
// packages/shared/src/modules/jobs/processors/workProcessor.ts
// Media is uploaded to IPFS, CID stored in work metadata
await addJob({
  kind: JobKind.WORK_SUBMISSION,
  payload: {
    gardenAddress,
    actionUID,
    mediaCIDs: ['bafybeig...'] // Storacha CIDs
  }
});
```

---

### Miro MCP (Architecture/Planning)

**Purpose:** Create architecture diagrams, planning boards, research visualization.

**Workflow: Architecture Diagrams**

```
"Create a Miro diagram showing the data flow from
 client → indexer → contracts"

Claude generates:
1. Mermaid syntax for the diagram
2. Uploads to Miro
3. Returns shareable link
```

**Use Cases:**

- System architecture documentation
- Feature planning sessions
- Data flow visualization
- Sprint planning boards

---

### Railway MCP (Backend Services)

**Purpose:** Deploy and manage backend services (indexer, databases).

**Workflow: Deploy Indexer**

```
"Deploy the Envio indexer to Railway"

Claude:
1. Checks Railway project config
2. Deploys indexer service
3. Configures PostgreSQL + Hasura
4. Returns service URLs
```

**Workflow: Debug Indexer Issues**

```
"Show Railway logs for the indexer service"

Claude retrieves recent logs for debugging.
```

---

## Combined Workflows

### Full-Stack Feature Implementation

```
1. Design Phase (Figma MCP)
   "Get design context for: [Figma URL]"

2. Plan Phase
   "/plan"
   → Creates implementation plan with tests

3. Contract Work (Foundry MCP)
   "Add WorkBatch struct to GardenToken"
   "Run contract tests"

4. Frontend Work (Figma MCP)
   "Implement the work submission form from the design"

5. Testing
   "bun test && bun test:e2e:smoke"

6. Deploy (Vercel + Railway MCP)
   "/vercel:deploy"
   "Deploy indexer updates to Railway"
```

### Offline Work Submission Flow

```
User Flow:
1. Gardener captures photos offline → IndexedDB
2. Returns online → Job queue activates
3. Media uploaded → Storacha MCP → IPFS CIDs
4. Work submission → Foundry (contract call)
5. Indexer picks up → Railway (GraphQL updated)

Claude Support:
- "Debug why work submissions aren't syncing"
- "Check Storacha upload status"
- "Query indexer for pending works"
```

### Contract Upgrade Workflow

```
1. "Create upgrade for GardenToken v2"
   → Foundry: scaffold upgrade contract

2. "Test upgrade path"
   → forge test --match-test testUpgrade

3. "Dry run deployment"
   → bun deploy:testnet (no --broadcast)

4. "Deploy upgrade"
   → bun deploy:testnet --broadcast

5. "Update indexer schema"
   → Railway: redeploy with new ABI
```

---

## Agent Access Matrix

Different Claude agents have access to different MCP servers:

| Agent | Figma | Vercel | Foundry | Storacha | Miro | Railway |
|-------|-------|--------|---------|----------|------|---------|
| **cracked-coder** | ✓ | ✓ | ✓ | ✓ | - | ✓ |
| **oracle** | ✓ | ✓ | - | - | ✓ | - |
| **code-reviewer** | - | - | - | - | - | - |

**Usage:**

```
"Use cracked-coder to implement the work history page from Figma"
→ Has access to Figma (design) + Vercel (deploy) + Foundry (contracts)

"Ask oracle about the current deployment architecture"
→ Has access to Vercel (deployment info) + Miro (diagrams)
```

---

## Quick Reference

### Figma

```
"Implement this Figma: [URL]"
"Get screenshot of Figma node 1:234"
"Connect Button component to Figma"
"Check my Figma authentication"
```

### Vercel

```
/vercel:deploy
/vercel:logs
/vercel:setup
"Deploy preview to Vercel"
```

### Foundry

```
"Compile contracts"
"Run GardenToken tests"
"Estimate gas for approveWork"
"Check deployer balance on Base Sepolia"
"Query registered actions"
```

### Storacha

```
"Upload image to IPFS"
"Get CID for this file"
"Pin content to Filecoin"
```

### Miro

```
"Create architecture diagram"
"Make planning board"
```

### Railway

```
"Deploy indexer to Railway"
"Check Railway service logs"
"Get database connection info"
```

---

## Troubleshooting

### Figma Not Responding

1. Check authentication: "Check Figma auth"
2. Verify URL format: `https://figma.com/design/:fileKey/:fileName?node-id=:nodeId`
3. Check file permissions in Figma

### Foundry Commands Failing

1. Ensure forge is installed: `forge --version`
2. Check you're in project root
3. For deployments, use `bun deploy:testnet` not raw `forge script`

### Storacha Upload Failed

1. Verify env vars are set in root `.env`
2. Check network connectivity
3. Verify Storacha proof hasn't expired

### Vercel Deploy Issues

1. Run `/vercel:logs` to check errors
2. Ensure build passes locally: `bun build`
3. Check environment variables in Vercel dashboard

---

## See Also

- [Cursor Workflows](cursor-workflows) — Cursor-specific MCP integration
- [Architecture](architecture) — System design overview
- [Contracts Handbook](contracts-handbook) — Smart contract patterns
- [Testing Guide](testing) — Test infrastructure
