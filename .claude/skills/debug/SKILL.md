---
name: debug
user-invocable: false
description: Debugging & Troubleshooting — fires passively when the user describes a bug, pastes an error or stack trace, reports unexpected behavior, mentions failing tests or builds, or signals an incident. Routes to user_bug_triage when an external party (user / gardener / operator / customer / team member / partner) reports broken product behavior, incident_hotfix on urgency signals, tdd_bugfix on red-test signals, default on general bug reports.
argument-hint: "[error-description]"
version: "1.1.2"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-05-09"
last_verified: "2026-05-09"
---

# Debug Skill

Systematic debugging: find root causes before fixes, verify with evidence before completion.

**References**: See `CLAUDE.md` for codebase patterns. Use `oracle` for complex investigation, `cracked-coder` for fixes.

---

## Activation

This skill is **passive-only**. There is no `/debug` slash command. Fire automatically when the user's prompt matches any signal below.

### Bug signals → Default root-cause mode

- "debug this", "why is X failing?", "what's wrong with Y?"
- Pasted stack trace, error message, or log snippet
- Reported unexpected behavior ("X should do Y but does Z")
- User-visible UI regressions: cannot click/select/tap, missing selected state, missing border,
  collapsed/blank cards, invisible content, broken scroll/refresh, or visible-but-unusable controls
- Test failures or build failures without a clear pattern

### Incident signals → incident_hotfix mode

- "production is down", "incident", "hotfix", "emergency", "urgent"
- "we're bleeding", "customers can't..."
- Focus: minimal stabilizing fix, not ideal root cause

### Red-test signals → tdd_bugfix mode

- "this test is failing", paste of red test output with a clear failing assertion
- "write a failing test for X then fix it"
- Focus: test-first loop — reproduce in a test, then fix

### External-party report signals → user_bug_triage mode

Fires when any external party reports broken product behavior — regardless of phrasing, role, or
channel. Pattern-match semantically, not lexically: `a gardener said`, `the Hypercert team can't`,
`Afolabi got an error`, `operator reports`, `someone is hitting`, `a user said`, forwarded support
message, attached user screenshot, paraphrased complaint — they all engage this mode.

- Focus: reproduce locally first, identify the failing layer, probe the boundary with the user's
  exact inputs, disambiguate opaque errors, then confirm scale/root-cause context with PostHog/Sentry (never the other way).
- See the User-Facing Bug Triage Protocol in Part 1 — it gates the choice between UI Regression
  and Data/API/Contract protocols.

### Verification signals

- "verify this works", "prove completion", "evidence this is done"
- Focus: evidence-based checks after implementation

### Legacy slash (deprecated)

`/debug`, `/debug --mode incident_hotfix`, `/debug --mode tdd_bugfix`, and `/debug --panic` are no longer advertised. If explicitly typed, honor them — but normal flow is passive activation.

## Progress Tracking (REQUIRED)

Use **TodoWrite** when available. If unavailable, keep a Markdown checklist in the response. See `CLAUDE.md` → Session Continuity.

---

## Safety Rules

- Non-destructive recovery only
- Save a patch snapshot before risky edits: `git diff > /tmp/green-goods-debug.patch`
- Use a safety branch for experiments: `git switch -c debug/incident-$(date +%Y%m%d-%H%M%S)`
- Never use destructive reset/reclone patterns in debug flow

## Core Principle

> ALWAYS find root cause before attempting fixes.
> Evidence before claims, always.
> For user-observed UI bugs, start from the rendered surface before tracing data flow.

---

## Part 1: Root Cause Investigation

### Phase 1: Gather Evidence

**DO NOT attempt any fixes yet.**

1. **Read error messages thoroughly**
2. **Reproduce consistently** — exact steps
3. **Check recent changes**: `git log --oneline -20`
4. **Choose the right entrypoint**:
   - External-party bug report: run the **User-Facing Bug Triage Protocol** first — it's the gating frame that decides which deeper protocol applies.
   - User-visible UI regression: inspect the rendered component first (DOM, geometry, computed styles, event target, state change).
   - Data/API/contract symptom: trace data flow backward from the failing output.

### User-Facing Bug Triage Protocol

Fires for `user_bug_triage` mode. Use this as the gating frame whenever any external party
(user, gardener, operator, customer, team member, partner) reports broken product behavior —
regardless of phrasing or role. Apply this BEFORE choosing UI Regression or Data/API/Contract
protocols; this decides which one fits.

1. **Reproduce, with the user's exact inputs.** Drive the real surface (Brave-backed browser MCP against
   `localhost` or prod in Brave, real auth mode, real garden, real entry path). Target: trigger the failure
   yourself within 5 minutes. Do not open PostHog or Sentry yet. If reproducing is impossible, document why
   and proceed with explicit caveat.
2. **Identify the failing layer** before going deeper: UI render, fetch boundary, server response,
   contract call, indexer drift, deployment artifact. Pick by where the symptom surfaces, not
   where you suspect.
3. **Probe the boundary with the user's exact inputs.** For a fetch boundary failure, send the
   actual HTTP request with the user's `Origin`/auth/headers; read raw status, headers, and body.
   For UI, inspect the rendered DOM at the failing moment. For contract, `cast call` against the
   deployed address. One round-trip beats a hundred metric reads.
4. **Treat opaque runtime errors as categories, not causes.** `TypeError: Failed to fetch`,
   `NotReadableError`, `DOMException`, `Error: Network error` — disambiguate before committing:
     - `Failed to fetch` → one `fetch('/health', {mode:'no-cors'})` against the same host.
       Succeeds → it's CORS or app-layer. Fails → real connectivity.
     - `NotReadableError` on a `File` → File handle invalidated (mobile background/foreground
       cycle); test with a fresh pick.
     - `DOMException` from React reconciliation → check for stale chunk / SW version skew
       (cross-bundle callback going undefined) before chasing component logic.
5. **State ONE hypothesis in one sentence.** If you can't, you don't have one — go back to (3).
6. **Run the cheapest test that would *falsify* the hypothesis.** Not the test that confirms it.
   If you can't refute it cheaply, the hypothesis is too vague.
7. **Only now use PostHog/Sentry** — PostHog measures scale, version range, regional distribution, and session patterns. Sentry supplies stack, release, and suspect-code context. Neither replaces the boundary proof above.
8. **Anti-patterns to refuse:**
   - Conflating multiple user sessions with similar symptoms as the same bug without independent
     proof — different sessions are separate threads until evidence ties them.
   - Building a narrative from telemetry before reproducing the failure.
   - Discounting user firsthand observation in favor of a single metric (downlink, geoip, etc.).
   - Accepting an opaque category (`Failed to fetch`, etc.) as a diagnosis.
9. **After fix, if the symptom→cause mapping is reusable**, persist it as a project memory
   (e.g., `project_<subsystem>_known_failures.md`) so the next session resolves it faster.

### User-Observed UI Regression Protocol

When the user describes what they can see or touch in the UI, do not start with providers,
queries, auth, or indexer hypotheses. First prove the rendered surface.

1. **Reproduce or simulate the exact visible symptom** using the real component path when possible.
   Click/tap the real element, not a mocked child component.
2. **Inspect rendered DOM geometry and styles**: bounding rect, width/height, opacity, display,
   pointer-events, z-index, overflow, disabled state, selected classes, and computed border/ring.
3. **Verify whether interaction state changes**: component state, Zustand store, router state,
   form state, or DOM data attributes after click/tap.
4. **Trace the component stack outward-in**: visible element → card/button/input → wrapper
   (carousel/sheet/dialog) → state setter. Only then inspect hooks/providers/query/data.
5. **Check recent component history** with `git log --follow` or focused `git show` on the
   visible component and wrapper files before proposing a fix.
6. **For shared-component layout bugs, check the Tailwind v4 shared JSX scanning gotcha**
   in `CLAUDE.md` before chasing data-layer hypotheses.
7. **Separate rendered-but-unusable from missing data**. If text/data exists in the DOM but the
   control is collapsed, invisible, untappable, or lacks visual selected state, treat it as a
   component/CSS regression until browser or DOM evidence proves otherwise.

### Data/API/Contract Regression Protocol

When the symptom is missing or wrong data, failed writes, failed reads, RPC errors, indexer drift,
deployment artifacts, or contract behavior, do not spend the first pass on CSS or component
geometry. Start at the failing output and trace backward through the data path.

1. **Capture the failing evidence**: request/response body, query key, log line, tx hash, receipt,
   revert reason, deployment artifact, failing test, or build output.
2. **Classify the failing layer** before proposing a fix: component state/query cache, shared hook,
   shared module, API/indexer, RPC/provider, deployment config, contract ABI/address, or on-chain
   contract state.
3. **Trace the data path backward**: visible output or failing assertion → hook/query key → shared
   module → provider/indexer/RPC → contract address/ABI/event/schema.
4. **Verify environment truth first**: chain ID, deployment JSON, indexer config, schema UID,
   contract address, RPC URL, and package guide for the touched surface.
5. **Use repo wrappers for contract/indexer checks**. Do not invoke Forge directly for build
   or test commands; use the bun scripts in `CLAUDE.md` and the package guides.
6. **Do not convert confirmed data/API/contract failures into UI styling investigations** unless
   the data is present and the rendered control is still collapsed, invisible, or unusable.

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
| **Architectural** | Pattern change, refactor | cracked-coder + planning |

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
| "Tests pass" | `bun run test` (NOT `bun test` — see CLAUDE.md) |
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
- IndexedDB: Brave DevTools > Application > IndexedDB > `jobQueueDB`
- Service Worker registration: Brave DevTools > Application > Service Workers
- Job queue stats: `jobQueue.getStats(userAddress)` in console
- Event bus monitoring: subscribe to `"job:failed"` events

### Contract Issues

```bash
# Compile and check artifacts
cd packages/contracts && bun build

# Inspect deployment addresses
cat deployments/11155111-latest.json | jq '.gardenToken'

# Verbose test output (traces all calls) through bun wrapper
cd packages/contracts && bun run test -- --match-test "testFailing" -vvvv

# Quick production-readiness gate for contract-touching fixes
bun run verify:contracts:fast

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
| **Network tab** | GraphQL queries, IPFS uploads, RPC calls | Brave DevTools → Network |

### Indexer Debugging

```bash
# View Docker container logs
cd packages/indexer && bun run dev:docker:logs

# Check Hasura GraphQL console (runs on port 8080)
open http://localhost:8080/console

# Test a GraphQL query directly
node -e 'fetch(\"http://localhost:8080/v1/graphql\", {method:\"POST\", headers:{\"Content-Type\":\"application/json\"}, body: JSON.stringify({query:\"{ Garden { id name } }\"})}).then(r=>r.text()).then(console.log)'

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
# Brave DevTools > Application > IndexedDB > green-goods-drafts

# Check job queue state
# Console: jobQueue.getStats(userAddress)

# Monitor job events
# Console: jobQueueEventBus.subscribe("job:*", console.log)
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
node -e 'fetch(\"https://w3s.link/ipfs/<CID>\").then(r => console.log(r.status))'

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
INDEXED=$(node -e 'fetch(\"http://localhost:8080/v1/graphql\", {method:\"POST\", headers:{\"Content-Type\":\"application/json\"}, body: JSON.stringify({query:\"{ _metadata { lastProcessedBlock } }\"})}).then(r=>r.json()).then(x=>console.log(x.data._metadata.lastProcessedBlock))')
CHAIN_HEAD=$(cast block-number --rpc-url $RPC)
echo \"Indexer lag: $((CHAIN_HEAD - INDEXED)) blocks\"

# Check if entity exists in indexer
node -e 'fetch(\"http://localhost:8080/v1/graphql\", {method:\"POST\", headers:{\"Content-Type\":\"application/json\"}, body: JSON.stringify({query:\"{ Work(where: {id: {_eq: \\\"<workId>\\\"}}) { id status } }\"})}).then(r=>r.text()).then(console.log)'
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
echo -n \"Indexer: \"; node -e 'fetch(\"http://localhost:8080/healthz\").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' && echo \"OK\" || echo \"DOWN\"

# 4. Frontend GraphQL reachable
echo -n \"GraphQL: \"; node -e 'fetch(\"http://localhost:8080/v1/graphql\", {method:\"POST\", headers:{\"Content-Type\":\"application/json\"}, body: JSON.stringify({query:\"{ __typename }\"})}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' && echo \"OK\" || echo \"UNREACHABLE\"
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

### Summary
- Symptom and scope
- Mode used

### Root Cause
- Evidence-backed cause statement

### Actions
- Fix applied (or recommended if report-only)

### Verification
- Commands executed and outcomes
- Contract-touching fixes should also run: `bun run verify:contracts:fast`

### Next Step
- `DONE`, `NEEDS_INPUT`, or `ESCALATE`

## Reference Files

- **[monitoring.md](./monitoring.md)** -- Production monitoring: transaction tracking, job queue health, on-chain verification
- **[posthog.md](./posthog.md)** -- PostHog + Sentry setup, event/error tracking integration, feature flags. Also covers Linear routing for accepted bugs (Customer Need for raw signal, Issue for accepted work) and the PostHog/Sentry↔Linear privacy boundary.
- **[health-diagnostics.md](./health-diagnostics.md)** -- Service worker health, storage quotas, indexer sync lag, Web Vitals, error boundaries

## Linear Routing

This skill is read-only on Linear. After a bug is reproduced and root-caused:

- Raw user/telemetry signal → Linear **Customer Need** (Product team) using the structured body shape (Source / Customer type / Need statement / Evidence / Disposition).
- Accepted fixes, QA follow-ups, or product investigations → Linear **Issue** (Product team), labels: `activity:qa` + relevant `package:*` + `protocol:*`.
- Accepted research questions or evidence-gathering → Linear **Issue** (Research team), labels: `activity:research`.
- If the bug originated in a `.plans` item, link it and label the Linear record `source:plans`.
- Detailed routing rules + PostHog/Sentry↔Linear privacy boundary live in [posthog.md](./posthog.md).
- Always prompt the user before creating any Linear record — never auto-write.

## Anti-Patterns

- **Guessing without reproduction** — never change code before reproducing the issue
- **Using destructive recovery commands** — avoid `git checkout -- .`, repo deletion, and forced resets in debug workflows
- **Claiming success without evidence** — always attach commands and outputs for build/test verification
- **Skipping dependency order checks** — contracts/indexer/shared/app drift can hide root cause
- **Using blocked network commands in docs** — prefer `node -e fetch(...)` examples over `curl`/`wget`

## Related Skills

- `react` (error-handling sub-file) — Error categorization and handling strategies
- `testing` — Writing regression tests after fixing bugs
- `debug` (monitoring sub-file) — Production diagnostics and error tracking
- `react` (performance sub-file) — Performance profiling for performance bugs
