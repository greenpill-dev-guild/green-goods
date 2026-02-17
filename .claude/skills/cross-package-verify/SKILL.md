---
name: cross-package-verify
description: Parallel cross-package verification using domain-specific sub-agents. Use for comprehensive multi-package validation.
version: "1.0"
last_updated: "2026-02-11"
last_verified: "2026-02-11"
status: established
packages: [shared, client, admin, contracts, indexer]
dependencies: [testing, contracts, architecture]
---

# Cross-Package Verify Skill

Parallel verification across all packages using domain-specific sub-agents. Each agent owns a package domain, runs independently, and findings are synthesized into a unified report.

**References**: See `CLAUDE.md` for package structure. See package context files in `.claude/context/`.

---

## Activation

| Trigger | Action |
|---------|--------|
| "verify all packages" | Full cross-package verification |
| "cross-package verify" | Same |
| "parallel verification" | Same |
| After large cross-cutting change | Verify nothing is broken |

## Progress Tracking (REQUIRED)

Every verification MUST use **TodoWrite**. See `CLAUDE.md` → Session Continuity.

---

## Part 1: Verification Domains

### Domain 1: Contracts

```bash
# Full production readiness (build → lint → tests → E2E → dry runs on all chains)
bun run verify:contracts

# Or fast iteration (skip E2E and dry runs)
bun run verify:contracts:fast

# Individual steps if needed:
cd packages/contracts && bun run build:full     # Full via_ir compilation
cd packages/contracts && bun run test           # Unit tests
cd packages/contracts && bun run test:e2e:workflow  # E2E workflow

# Verify storage layout for upgrade safety (if UUPS contracts changed)
cd packages/contracts && forge inspect GardenToken storage-layout
```

**What to check:**
- All tests pass (forge test)
- No compilation warnings
- New functions have test coverage
- Gas snapshot not regressed: `forge snapshot --diff`
- Security: No reentrancy, access control intact

### Domain 2: Shared Package

```bash
# Type check
cd packages/shared && bunx tsc --noEmit

# Run tests (CRITICAL: use bun run test, not bun test)
cd packages/shared && bun run test

# Lint
cd packages/shared && bun lint

# Verify exports
cd packages/shared && bunx tsc --noEmit --listFiles 2>/dev/null | head -5
```

**What to check:**
- All exported types are used by consumers
- ABI type safety (if contract ABIs changed)
- No barrel import violations
- All hooks are in correct location
- Query key stability

**Test quality checks (shared):**
- No `expect(true).toBe(true)` or other no-op assertions in test files
- New hooks have corresponding test files with error path coverage
- No `.skip` tests added without a tracking comment explaining why
- Critical paths (auth, job queue, contract errors) maintain 80%+ coverage
- Mock factories are used instead of ad-hoc inline mocks where available

### Domain 3: Client Package

```bash
# Type check
cd packages/client && bunx tsc --noEmit

# Run tests
cd packages/client && bun run test

# Build
cd packages/client && bun build

# Lint
cd packages/client && bun lint
```

**What to check:**
- TypeScript compilation clean
- Tests pass with correct environment (jsdom)
- Build succeeds (includes bundle size check)
- No unhandled promise rejections
- Offline behavior intact for write operations

**Test quality checks (client + admin):**
- No `expect(true).toBe(true)` or placeholder assertions in view/component tests
- Renamed `.skip` files (e.g., `*.test.skip.tsx`) have a tracking issue or plan for re-enablement
- Component tests assert rendered content or user interactions, not just "renders without crashing"
- Mock modules include all exports accessed by the component under test (avoid missing export errors)

### Domain 4: Admin Package

```bash
# Type check
cd packages/admin && bunx tsc --noEmit

# Run tests
cd packages/admin && bun run test

# Build
cd packages/admin && bun build

# Lint
cd packages/admin && bun lint
```

**What to check:**
- TypeScript compilation clean
- Tests pass
- Build succeeds
- Access control patterns intact

### Domain 5: Indexer

```bash
# Build
cd packages/indexer && bun build

# Run tests
cd packages/indexer && bun run test
```

**What to check:**
- Build succeeds
- Tests pass
- Schema.graphql consistent with EventHandlers.ts
- Config.yaml addresses match deployment artifacts

### Domain 6: Integration Checks

```bash
# Cross-package imports resolve
bun build

# Verify deployment artifacts are consistent
ls packages/contracts/deployments/*.json

# Check .gitignore covers build artifacts
git status --short | grep -E '\.(js|d\.ts|map)$'

# Format check
bun format --check 2>&1 || true
```

**What to check:**
- All cross-package imports resolve
- Deployment artifacts are up to date
- No build artifacts committed
- Formatting is consistent

### Domain 7: Documentation Consistency

**What to check:**
- Architecture docs in `.plans/` match actual implementation
- Function signatures in docs match code
- Chain configurations documented correctly
- Module names in docs match actual exports

---

## Part 2: Parallel Execution Strategy

### Using Sub-Agents (Team Mode)

When running with agent teams, spawn domain-specific agents:

```
Leader (you)
├─ Agent 1: contracts-verifier → Domain 1
├─ Agent 2: ui-verifier → Domains 3 + 4
├─ Agent 3: shared-verifier → Domain 2
├─ Agent 4: integration-verifier → Domains 5 + 6 + 7
```

Each agent runs independently and reports findings.

### Using Task Tool (Sequential Parallel)

When teams aren't available, use the Task tool to spawn parallel sub-agents:

```
Task 1: "Verify contracts package — run bun run build:full, bun run test, check warnings"
Task 2: "Verify shared package — run tsc --noEmit, bun run test, check exports"
Task 3: "Verify client + admin — run tsc --noEmit, bun run test, bun build"
Task 4: "Verify integration — cross-package imports, deployment artifacts, formatting"
```

### Sequential Fallback

If parallel execution isn't possible, run domains in dependency order:

```
1. contracts (generates ABIs)
2. shared (depends on contract artifacts)
3. indexer (depends on contract ABIs)
4. client + admin (depend on shared)
5. integration checks
6. documentation consistency
```

---

## Part 3: Headless Mode

### Full Cross-Package Verification

```bash
claude -p "Run full cross-package verification of the current branch. For each domain:
1. Contracts: bun run build:full, bun run test, check warnings, verify test coverage for new functions
2. Shared: tsc --noEmit, bun run test, bun lint, verify barrel exports
3. Client: tsc --noEmit, bun run test, bun build, bun lint
4. Admin: tsc --noEmit, bun run test, bun build, bun lint
5. Indexer: bun build, bun run test
6. Integration: cross-package imports resolve, deployment artifacts consistent, formatting clean
7. Docs: cross-reference .plans/ docs against implementation

Synthesize all findings into a single prioritized report. Then implement all must-fix items, re-run all test suites, and commit when green." --allowedTools "Read,Bash,Grep,Glob,Edit,Write,TodoWrite"
```

### Verification-Only (No Fixes)

```bash
claude -p "Run full cross-package verification. Report findings only — do not implement fixes. Output a prioritized report of all issues found across all packages." --allowedTools "Read,Bash,Grep,Glob,TodoWrite" > .plans/verify-$(date +%Y%m%d).md
```

---

## Part 4: Output Format

### Unified Verification Report

```markdown
## Cross-Package Verification Report

### Summary
| Domain | Status | Tests | Types | Build | Issues |
|--------|--------|-------|-------|-------|--------|
| Contracts | PASS | 616/616 | N/A | OK | 0 |
| Shared | PASS | 84/84 | Clean | N/A | 1 |
| Client | FAIL | 42/43 | 2 errors | OK | 3 |
| Admin | PASS | 28/28 | Clean | OK | 0 |
| Indexer | PASS | 12/12 | N/A | OK | 0 |
| Integration | WARN | N/A | N/A | OK | 2 |

### Critical Issues (Blocking)
1. **Client test failure**: `useGardenData.test.tsx` — assertion mismatch on line 45
2. **Client type error**: `GardenDetail.tsx:123` — property 'name' missing on type

### High Priority
3. **Shared barrel export**: `useNewHook` not exported from index.ts

### Medium Priority
4. **Integration**: Deployment artifact `11155111-latest.json` outdated
5. **Integration**: 2 files not formatted (run `bun format`)

### Documentation Drift
- `.plans/octant-vault-architecture.md` references `useVaultBalance` but hook is named `useVaultDeposits`

### Actions Taken
- Fixed issues #1-5
- Re-ran all test suites: ALL PASS
- Committed: `fix(client,shared): resolve cross-package verification issues`
```

---

## Anti-Patterns

- **Running tests with wrong runner** — Always `bun run test`, never `bun test` for vitest packages
- **Skipping type checks** — Tests passing doesn't mean types are clean
- **Ignoring indexer** — Schema drift causes silent data loss
- **Sequential when parallel is possible** — Use sub-agents for speed
- **Fixing without understanding dependency order** — Always fix contracts → shared → client/admin
- **Skipping documentation check** — Doc drift causes confusion in future sessions

## Related Skills

- `testing` — Test patterns for each package
- `contracts` — Contract-specific verification
- `architecture` — Architectural rule enforcement
- `deployment` — Pre-deployment verification
- `autonomous-review` — Full review→fix→verify pipeline
- `ci-cd` — CI pipeline configuration
