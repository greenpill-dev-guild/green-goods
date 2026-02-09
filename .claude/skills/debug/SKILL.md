---
name: debug
description: Debugging & Troubleshooting - root cause investigation. Use for systematic debugging and verification.
version: "1.0"
last_updated: "2026-02-08"
last_verified: "2026-02-09"
status: proven
packages: [shared, client, admin, contracts, indexer]
dependencies: []
---

# Debug Skill

Systematic debugging: find root causes before fixes, verify with evidence before completion.

**References**: See `CLAUDE.md` for codebase patterns. Use `oracle` for complex investigation, `cracked-coder` for fixes.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/debug` | Start root cause investigation |
| Tests failing | Systematic debugging |
| Build failures | Trace and fix |
| Verifying completion | Evidence-based checks |

## Progress Tracking (REQUIRED)

Every debug session MUST use **TodoWrite**. See `CLAUDE.md` → Session Continuity.

---

## Core Principle

> ALWAYS find root cause before attempting fixes.
> Evidence before claims, always.

---

## Part 1: Root Cause Investigation

### Phase 1: Gather Evidence

**DO NOT attempt any fixes yet.**

1. **Read error messages thoroughly**
2. **Reproduce consistently** — exact steps
3. **Check recent changes**: `git log --oneline -20`
4. **Trace data flow backward** — where does error manifest?

### Phase 2: Hypothesis Testing

1. **Form specific hypothesis**
   - ✅ "Error occurs because X calls Y with null"
   - ❌ "Something is wrong with the API"

2. **Test minimally** — ONE variable at a time

3. **If 3+ fixes fail: STOP**
   - Question the architecture
   - Reassess understanding
   - Ask for help

---

## Part 2: Escalation to cracked-coder

| Fix Type | Criteria | Action |
|----------|----------|--------|
| **Simple** | <10 lines, single file | Fix directly |
| **Complex** | >10 lines, multi-file, needs tests | Escalate to cracked-coder |
| **Architectural** | Pattern change, refactor | cracked-coder + /plan |

### Handoff Format

```markdown
## Debug → cracked-coder Handoff

### Root Cause
[What you found]

### Location
[File:line where issue originates]

### Evidence
[Commands/logs that prove the cause]

### Suggested Fix
[Your recommendation]
```

---

## Part 3: Verification Before Completion

### Mandatory Verification

| Claim | Command |
|-------|---------|
| "Tests pass" | `bun test` |
| "Build succeeds" | `bun build` |
| "Linting clean" | `bun lint` |
| "Types correct" | `bun run tsc --noEmit` |

### Suspicious Language

If you say these, STOP and verify first:
- "should work"
- "I think"
- "probably"
- "seems to"

---

## Part 4: Green Goods Debugging

### Offline Sync Issues
- Check `useJobQueue` for stuck jobs
- IndexedDB: Chrome DevTools > Application > IndexedDB > `jobQueueDB`
- Service Worker registration: Chrome DevTools > Application > Service Workers
- Job queue stats: `jobQueue.getStats(userAddress)` in console
- Event bus monitoring: subscribe to `"job:failed"` events

### Contract Issues
```bash
# Compile and check artifacts
cd packages/contracts && bun build

# Inspect deployment addresses
cat deployments/84532-latest.json | jq '.gardenToken'

# Verbose test output (traces all calls)
forge test --match-test "testFailing" -vvvv

# Gas snapshot for regression detection
forge snapshot --diff

# Check storage layout for upgrade safety
forge inspect GardenToken storage-layout

# Decode transaction calldata
cast decode-function "functionName(uint256)" 0xcalldata

# Check on-chain state
cast call <contract> "functionName()" --rpc-url $RPC
```

### Frontend Debugging Tools

| Tool | Purpose | How to Access |
|------|---------|---------------|
| **React DevTools** | Component tree, props, state, re-renders | Browser extension → Components tab |
| **React Profiler** | Render timing, commit frequency | Browser extension → Profiler tab |
| **TanStack Query DevTools** | Query cache, stale state, refetch triggers | Auto-included in dev mode |
| **Redux DevTools** | Zustand store inspection (with `devtools` middleware) | Browser extension |
| **Vite Debug** | Build issues, dependency resolution | `DEBUG=vite:* bun dev` |
| **Network tab** | GraphQL queries, IPFS uploads, RPC calls | Chrome DevTools → Network |

### Indexer Debugging

```bash
# View Docker container logs
cd packages/indexer && bun run dev:docker:logs

# Check Hasura GraphQL console (runs on port 8080)
open http://localhost:8080/console

# Test a GraphQL query directly
curl -X POST http://localhost:8080/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ Garden { id name } }"}'

# Restart indexer containers
bun run dev:docker:down && bun run dev:docker
```

### Build & Type Debugging

```bash
# TypeScript errors without emitting
cd packages/shared && npx tsc --noEmit

# Check specific package types
cd packages/client && npx tsc --noEmit

# Vite build with verbose output
cd packages/client && DEBUG=vite:* bun build

# Check bundle analysis
cd packages/client && npx vite-bundle-visualizer
```

### Hook Issues
```bash
bash .claude/scripts/validate-hook-location.sh
```

### Common Debug Scenarios

| Symptom | Likely Cause | Diagnostic |
|---------|-------------|------------|
| "Invalid hook call" | Hook defined outside `@green-goods/shared` | Run `validate-hook-location.sh` |
| Stale query data | Missing query invalidation after mutation | Check TanStack Query DevTools |
| Transaction silently fails | Wrong auth mode (wallet vs passkey) | Log `authMode` before contract call |
| Indexer missing events | Contract address mismatch in config | Compare `deployments/*.json` with `config.yaml` |
| Storage quota errors | Too many offline photos | Check `getStorageQuota()` |
| Service worker not updating | Aggressive caching | Check `Cache-Control` headers for `/sw.js` |

---

## Part 5: Distributed Debugging (End-to-End Pipeline)

For tracing issues through the full offline → blockchain → indexer pipeline:

### Work Submission Pipeline

```
IndexedDB Draft → Job Queue → IPFS Upload → Contract Call → Indexer Event → GraphQL Cache
```

### Step-by-Step Trace

#### Layer 1: Client (IndexedDB → Job Queue)

```bash
# Check IndexedDB for stuck drafts
# Chrome DevTools > Application > IndexedDB > green-goods-drafts

# Check job queue state
# Console: jobQueue.getStats(userAddress)

# Monitor job events
# Console: eventBus.subscribe("job:*", console.log)
```

| Symptom | Layer | Check |
|---------|-------|-------|
| Draft not saving | IndexedDB | Storage quota: `navigator.storage.estimate()` |
| Job stuck in `pending` | Job Queue | Is the user online? Check `navigator.onLine` |
| Job stuck in `processing` | Job Queue | Check for thrown errors in IPFS/contract call |
| Job `failed` repeatedly | IPFS or Chain | Check `job.error` and `job.retryCount` |

#### Layer 2: IPFS Upload

```bash
# Check if media uploaded successfully
# Job payload should contain a CID after upload

# Verify CID is retrievable
curl https://w3s.link/ipfs/<CID>

# Check Storacha service health
# Look for 4xx/5xx in Network tab for storacha requests
```

#### Layer 3: Blockchain Transaction

```bash
# Decode the transaction that was sent
cast tx <txHash> --rpc-url $RPC

# Check if transaction reverted and why
cast run <txHash> --rpc-url $RPC

# Verify contract state after tx
cast call <gardenAddress> "getWork(bytes32)" <workUID> --rpc-url $RPC

# Check gas estimation (may fail before tx is sent)
cast estimate <gardenAddress> "submitWork(bytes32,string)" <args> --rpc-url $RPC
```

#### Layer 4: Indexer Processing

```bash
# Check if event was emitted
cast receipt <txHash> --rpc-url $RPC | grep -A5 "logs"

# Check indexer lag — how far behind is it?
# Compare latest indexed block vs chain head
INDEXED=$(curl -s localhost:8080/v1/graphql -H "Content-Type: application/json" \
  -d '{"query":"{ _metadata { lastProcessedBlock } }"}' | jq '.data._metadata.lastProcessedBlock')
CHAIN_HEAD=$(cast block-number --rpc-url $RPC)
echo "Indexer lag: $((CHAIN_HEAD - INDEXED)) blocks"

# Check if entity exists in indexer
curl -s localhost:8080/v1/graphql -H "Content-Type: application/json" \
  -d '{"query":"{ Work(where: {id: {_eq: \"<workId>\"}}) { id status } }"}'
```

#### Layer 5: Frontend Cache

```bash
# Force refetch in TanStack Query DevTools
# Or invalidate programmatically:
# queryClient.invalidateQueries({ queryKey: queryKeys.work.all })

# Check if the query key matches what the indexer returns
# TanStack Query DevTools > Queries tab > check cache content
```

### Cross-Layer Diagnostic Script

```bash
# Full pipeline health check
echo "=== Pipeline Health ==="

# 1. Chain connectivity
echo -n "Chain: "; cast block-number --rpc-url $RPC && echo "OK" || echo "UNREACHABLE"

# 2. Contract deployed
echo -n "Contract: "; cast call $GARDEN_ADDRESS "name()(string)" --rpc-url $RPC && echo "OK" || echo "MISSING"

# 3. Indexer running
echo -n "Indexer: "; curl -sf localhost:8080/healthz && echo "OK" || echo "DOWN"

# 4. Frontend GraphQL reachable
echo -n "GraphQL: "; curl -sf localhost:8080/v1/graphql -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' && echo "OK" || echo "UNREACHABLE"
```

---

## Three-Strike Protocol

After 3 failed fixes:
1. **STOP fixing**
2. **Document what you tried**
3. **Question assumptions**
4. **Consider alternatives**

---

## Output

After debugging provide:
1. Root cause explanation
2. Fix applied
3. Verification results
4. Prevention recommendations

## Related Skills

- `error-handling-patterns` — Error categorization and handling strategies
- `testing` — Writing regression tests after fixing bugs
- `monitoring` — Production diagnostics and error tracking
- `performance` — Performance profiling for performance bugs
