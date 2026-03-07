# Claude Code Configuration Audit - 2026-03-06 (v2)

## Executive Summary

Comprehensive audit of `.claude/` configuration: agents, skills, hooks, plugins, scripts, context files, and standards against Claude Code official best practices and internal consistency.

- **Files analyzed**: 58 configuration files across `.claude/` + CLAUDE.md + AGENTS.md + .mcp.json
  - 36 skill files (13,051 lines total)
  - 6 agent files
  - 6 context files
  - 3 rule files
  - 6 scripts
  - 2 settings files (settings.json + settings.local.json)
  - 1 standards file
  - 1 skills index
- **Critical**: 1 | **High**: 4 | **Medium**: 7 | **Low**: 4

**Overall assessment**: Significant improvement since v1 audit. The configuration is well-structured with 7 of 13 previous findings fixed. Remaining issues center on: a broken CI workflow, provider hierarchy documentation drift, storybook coverage matrix/anti-pattern inaccuracy, and minor hook regex bypass paths.

---

## Previous Findings Status

_Tracked from: 2026-03-06 (v1)_

| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|
| C1 | Registry files deleted but referenced | `.claude/registry/`, cracked-coder, consistency script | **FIXED** | Registry dir and consistency script both deleted; all references removed from agents |
| C2 | `.claude/hooks.json` deleted but referenced | agent-teams SKILL.md, consistency script | **FIXED** | No `hooks.json` references found anywhere in `.claude/` |
| C3 | MCP servers referenced but not configured | cracked-coder, migration agents, `.mcp.json` | **FIXED** | `mcpServers` field removed from all agent files |
| H1 | Hook in admin package | `admin/views/Gardens/Garden/useGardenDetailData.ts` | **STILL OPEN** | Still exists (tracked in codebase audit, not config-specific) |
| H2 | `eventBus` referenced in skills | debug, data-layer skills | **STILL OPEN** | `data-layer/SKILL.md:612` and `debug/SKILL.md:237` still use `eventBus` instead of `jobQueueEventBus` |
| H3 | Provider nesting order drift | shared context, react-patterns rule | **STILL OPEN** | Shared context shows `WagmiProvider > QueryClientProvider` hierarchy; actual code uses `PersistQueryClientProvider` (admin) and `HelmetProvider` (client). React-patterns rule is closer but says `QueryClientProvider` not `PersistQueryClientProvider` for admin |
| H4 | `frontend-design` skill path confusion | settings, archived skill, index | **FIXED** | Archived local copy removed. Plugin-only approach is clean |
| H5 | `storybook-author` agent not in skills index | index.md | **FIXED** | Now listed in agents table at index.md line 104 |
| H6 | Storybook coverage matrix incomplete | index.md | **STILL OPEN** | Line 327: storybook only shows `shared` column marked, but config pulls from admin+client too |
| H7 | `SessionStart` `compact` matcher validity | settings.json:75 | **STILL OPEN** | Cannot verify runtime behavior; leaving as advisory |
| H8 | `user-invocable: false` non-standard field | 14 skill files | **STILL OPEN** | 14 skills still use it; no runtime effect but serves as documentation |
| M1 | Stale plans directory | `.plans/` | **STILL OPEN** | 8 plan files in `.plans/` root, 5 in `.claude/plans/`. Some >14 days old |
| M2 | Consistency script references AGENTS.md | consistency script | **N/A** | Consistency script deleted entirely |
| M3 | Non-standard custom frontmatter fields | All skills | **STILL OPEN** | `user-invocable`, `version`, `status`, `packages` etc. still used |
| M4 | Agent `skills` field may not be supported | cracked-coder, migration, storybook-author | **STILL OPEN** | 3 agents still use `skills:` frontmatter |
| M5 | `background: true` on oracle agent | oracle.md | **FIXED** | Field removed |
| M6 | Plugin prefix notation in index | index.md:288 | **STILL OPEN** | `frontend-design:frontend-design` still uses colon notation |
| M7 | Redundant deny rules for force push | settings.json + settings.local.json | **STILL OPEN** | Both hook and deny list still overlap |
| M8 | Notification hook empty matcher | settings.json:119 | **STILL OPEN** | `"matcher": ""` still present; intentional but undocumented |
| M9 | PostToolUse biome format swallows errors | settings.json:112 | **STILL OPEN** | `exit 0` still at end regardless of biome result |
| M10 | Stale skill metadata standard section | index.md | **STILL OPEN** | Only documents official fields, not custom ones |
| L1-L6 | Various low findings | Various | **STILL OPEN** | Most unchanged |

### Trend (last 2 config audits)

| Metric | v1 (2026-03-06) | v2 (current) |
|--------|-----------------|--------------|
| Critical | 3 | 1 |
| High | 8 | 4 |
| Medium | 10 | 7 |
| Low | 6 | 4 |
| Total findings | 27 | 16 |

**Progress**: 11 findings resolved (7 fixed, 1 N/A, 3 downgraded). Critical count dropped from 3 to 1. High count dropped from 8 to 4.

---

## Critical Findings

### C1: CI Workflow References Deleted Consistency Script (NEW)

**Severity**: Critical
**Location**: `.github/workflows/claude-guidance.yml:42`, `AGENTS.md:36`, `.claude/skills/cross-package-verify/SKILL.md:52`

The CI workflow `claude-guidance.yml` runs `node .claude/scripts/check-guidance-consistency.js` on every push/PR to main/develop that touches `.claude/` files. This script has been deleted. The CI job will fail on every qualifying push.

Additionally, `AGENTS.md:36` and `cross-package-verify/SKILL.md:52` still reference the deleted script.

**Impact**: Any PR touching `.claude/**` files will have a failing CI check. The cross-package-verify skill instructs Claude to run a nonexistent script.

**Recommendation**: Either:
1. Delete the workflow file and remove references from AGENTS.md and cross-package-verify (if the consistency check is no longer needed), or
2. Create a replacement consistency check script and update all references.

---

## High Findings

### H1: Provider Hierarchy Documentation Drift (STILL OPEN)

**Severity**: High
**Location**: `.claude/context/shared.md:104-120`, `.claude/rules/react-patterns.md:127-135`

Three competing provider hierarchies exist in documentation:

| Source | Admin Hierarchy |
|--------|----------------|
| `shared.md` context (line 104-120) | `WagmiProvider > QueryClientProvider > AppKitProvider > AuthProvider > AppProvider > JobQueueProvider > WorkProvider` |
| `react-patterns.md` rule (line 127-129) | `QueryClientProvider > AppKitProvider > AuthProvider > AppProvider > App` |
| Actual code (`admin/src/main.tsx`) | `PersistQueryClientProvider > ErrorBoundary > AppKitProvider > AuthProvider > AppProvider` |

The shared context is the most inaccurate: it wraps with `WagmiProvider` explicitly (contradicts the note on line 138 that `AppKitProvider` wraps `WagmiProvider` internally) and lists `JobQueueProvider > WorkProvider` at app root (contradicts the react-patterns rule that says these go at route/view level).

**Recommendation**: Update `shared.md` provider hierarchy to match actual code. Remove `WagmiProvider` wrapper, change `QueryClientProvider` to `PersistQueryClientProvider`, add `ErrorBoundary`.

### H2: Storybook Skill and Index Contain Factual Errors (STILL OPEN + EXPANDED)

**Severity**: High
**Location**: `.claude/skills/storybook/SKILL.md:635`, `.claude/skills/index.md:327`

Two related issues:
1. **Storybook skill anti-pattern is wrong**: Line 635 says "Never put stories in client/admin -- all stories in shared package". In reality, the Storybook config explicitly pulls stories from all 3 packages (`shared/.storybook/main.ts:49-52`), and there are currently 16 admin stories and 6 client stories. The `storybook-author` agent's title hierarchy table explicitly includes `Admin/*` and `Client/*` categories.
2. **Coverage matrix incomplete**: The index coverage matrix (line 327) only marks `shared` for the `storybook` skill. Should mark `admin` and `client` too.

**Recommendation**:
- Update storybook SKILL.md line 635 to: "Stories are co-located with their components in shared, admin, and client packages"
- Update index.md coverage matrix to add `x` for admin and client columns on the storybook row

### H3: `eventBus` Import Reference Still Drifted (STILL OPEN)

**Severity**: High
**Location**: `.claude/skills/data-layer/SKILL.md:612`, `.claude/skills/debug/SKILL.md:237`

The actual shared package export is `jobQueueEventBus`, not `eventBus`. These skill references would lead Claude to generate import statements that fail at compile time.

**Recommendation**: Update both references:
- `data-layer/SKILL.md:612`: `import { eventBus }` -> `import { jobQueueEventBus }`
- `debug/SKILL.md:237`: `eventBus.subscribe(...)` -> `jobQueueEventBus.subscribe(...)`

### H4: SessionStart Banner Missing `storybook-author` Agent

**Severity**: High
**Location**: `.claude/settings.json:69`

The session start banner lists agents as `oracle | cracked-coder | code-reviewer | migration | triage` but omits `storybook-author`. While the agent is now documented in `index.md`, users won't see it in the session startup prompt.

**Recommendation**: Add `storybook-author` to the banner: `'Agents: oracle | cracked-coder | code-reviewer | migration | triage | storybook-author'`

---

## Medium Findings

### M1: `bun test` Hook Regex Bypass via Environment Variable Prefix

**Severity**: Medium
**Location**: `.claude/settings.json:38`, `.claude/settings.local.json:30`

The PreToolUse hook regex `(^|[;&|] *)bun test( |$)` requires `bun test` at the start of the command or after a shell operator. Commands prefixed with env vars like `NODE_ENV=test bun test` bypass the regex because `bun test` is no longer at position 0.

The permissions allow list includes `Bash(NODE_ENV=test bun test:*)` which would auto-approve `NODE_ENV=test bun test:fork` (correct, this runs a specific test suite), but also `NODE_ENV=test bun test` (wrong, this runs bun's built-in test runner).

**Recommendation**: Update the regex to also match env-var prefixed commands: `(^|[;&|] *)([A-Z_]+=[^ ]+ )*bun test( |$)` and ensure the `bun run test` exclusion still works.

### M2: Redundant Force Push Protection (STILL OPEN)

**Severity**: Medium
**Location**: `.claude/settings.json:55-60`, `.claude/settings.local.json:62-65`

Force push to main/master is blocked in three independent places:
1. PreToolUse hook in `settings.json:55-60`
2. Permissions deny list in `settings.local.json:62-65` (4 patterns)
3. Claude Code's built-in system prompt

The deny list alone is sufficient and fires before the hook. The hook adds no value but runs on every Bash command.

**Recommendation**: Remove the PreToolUse hook for force push (lines 53-62 in settings.json) since the deny list already handles it.

### M3: Non-Standard `user-invocable` Field in 14 Skills (STILL OPEN)

**Severity**: Medium
**Location**: 14 skill files (architecture, biome, data-layer, error-handling-patterns, git-workflow, i18n, mermaid-diagrams, performance, radix-ui, security, storybook, tailwindcss, tanstack-query, web3)

The `user-invocable: false` field has no runtime effect in Claude Code. The official field for controlling invocation is `disable-model-invocation: true` (used correctly by 10 other skills). These 14 skills likely intend "model can invoke but user should not use /name directly," which has no official equivalent.

**Recommendation**: Document in index.md that `user-invocable` is a project-internal metadata field with no runtime effect. Consider whether any of these 14 should actually have `disable-model-invocation: true`.

### M4: Agent `skills` Frontmatter Field Has No Runtime Effect (STILL OPEN)

**Severity**: Medium
**Location**: `.claude/agents/cracked-coder.md:14-18`, `.claude/agents/migration.md:13-15`, `.claude/agents/storybook-author.md:13-15`

The `skills:` field in agent frontmatter is not a recognized Claude Code agent spec field. Agents do not auto-load skills from this list. Official fields: `name`, `description`, `model`, `tools`, `disallowedTools`, `permissionMode`, `memory`, `maxTurns`.

**Recommendation**: Keep as documentation but add a comment explaining it's informational: `# skills listed here are documentation only; agents discover skills via CLAUDE.md`

### M5: PostToolUse Biome Hook Silently Swallows Errors (STILL OPEN)

**Severity**: Medium
**Location**: `.claude/settings.json:112`

The PostToolUse hook for Biome formatting ends with `exit 0` regardless of whether `npx @biomejs/biome format --write` succeeds. Formatting errors are silently discarded.

**Recommendation**: Log failure before exiting: change to `npx @biomejs/biome format --write "$FILE" 2>/dev/null || echo "Biome format failed for $FILE" >&2; exit 0`

### M6: Stale Plans (>14 Days Old) (STILL OPEN)

**Severity**: Medium
**Location**: `.plans/` and `.claude/plans/`

13 plan/audit files exist across both directories. Several are >14 days old:
- `.plans/2026-02-18-architecture-improvements.md` (16 days)
- `.plans/adversarial-ux-review.md` (status unclear)
- `.plans/claude-config-best-practices.md` (status unclear)
- `.plans/contract-deployment.md` (status unclear)
- `.plans/indexer-verification-fix.todo.md` (status unclear)
- `.claude/plans/admin-ui-overhaul.md`
- `.claude/plans/storybook-design-system.md`

Per the plan skill's lifecycle rules, plans untouched for 14+ days should be reviewed and either completed, archived, or removed.

### M7: Plugin Prefix Notation Undocumented (STILL OPEN)

**Severity**: Medium
**Location**: `.claude/skills/index.md:288`

The Tier 3 taxonomy uses `frontend-design:frontend-design` with a colon prefix to indicate it's a plugin rather than a local skill. This notation is not documented anywhere in the index, and it's inconsistent with all other entries.

**Recommendation**: Either use the same format as other entries (just `frontend-design`) with a note that it's a plugin, or document the colon notation convention.

---

## Low Findings

### L1: Permissions Allow `grep` and `find` Bash Commands

**Severity**: Low
**Location**: `.claude/settings.local.json:43-45`

The allow list includes `Bash(grep:*)` and `Bash(find:*)`, but Claude Code's system prompt instructs using dedicated Grep and Glob tools instead. These permissions are harmless but unnecessary.

### L2: Permissions Allow `pnpm` Commands

**Severity**: Low
**Location**: `.claude/settings.local.json:38-40`

The allow list includes `pnpm install`, `pnpm approve-builds:*`, and `pnpm exec rescript:*`. This project uses `bun` exclusively. These are likely needed for Envio's internal pnpm usage but should be documented with a comment.

### L3: `Notification` Hook Empty Matcher Undocumented

**Severity**: Low
**Location**: `.claude/settings.json:119`

The `"matcher": ""` on the Notification hook matches all notifications. This is likely intentional but should have a comment explaining the behavior.

### L4: `CLAUDE_CODE_EFFORT_LEVEL` Not Documented

**Severity**: Low
**Location**: `.claude/settings.local.json:3`

The local settings set `CLAUDE_CODE_EFFORT_LEVEL: "high"`. This is a valid user preference but is in `settings.local.json` (not checked into git), so other team members won't benefit. Consider documenting this as a recommended setting in CLAUDE.md.

---

## Skill & Configuration Drift

| Reference | Location | Status |
|-----------|----------|--------|
| `check-guidance-consistency.js` | `claude-guidance.yml:42`, `AGENTS.md:36`, `cross-package-verify/SKILL.md:52` | **MISSING** -- script deleted |
| `eventBus` import | `data-layer/SKILL.md:612`, `debug/SKILL.md:237` | **DRIFT** -- actual export is `jobQueueEventBus` |
| Provider hierarchy (shared context) | `shared.md:104-120` | **DRIFT** -- shows `WagmiProvider > QueryClientProvider`, actual uses `PersistQueryClientProvider`, no `WagmiProvider` |
| Provider hierarchy (react-patterns rule) | `react-patterns.md:127-129` | **PARTIAL DRIFT** -- says `QueryClientProvider`, actual is `PersistQueryClientProvider` |
| Storybook anti-pattern | `storybook/SKILL.md:635` | **DRIFT** -- says "never put stories in client/admin" but 22 stories exist there |
| Storybook coverage matrix | `index.md:327` | **DRIFT** -- only marks `shared`, should include `admin` and `client` |
| `storybook-author` in banner | `settings.json:69` | **MISSING** -- not listed in session start agent list |
| `registry/` references | cracked-coder, consistency script | **FIXED** -- all removed |
| `hooks.json` references | agent-teams, consistency script | **FIXED** -- all removed |
| `mcpServers` in agents | cracked-coder, migration | **FIXED** -- field removed |
| `background: true` | oracle agent | **FIXED** -- field removed |
| `frontend-design` archived skill | `.claude/skills/_archived/` | **FIXED** -- directory removed |
| All hooks referenced in skills | shared package | **OK** -- all 12 hooks properly exported |
| All utilities referenced in skills | shared package | **OK** -- all 9 utilities properly exported |
| All types referenced in skills | shared package | **OK** -- all 10 types properly exported |

---

## Positive Findings (What Works Well)

1. **Major cleanup since v1**: Registry directory, hooks.json, MCP server references, oracle background field, archived frontend-design -- all properly cleaned up.
2. **Hook guards are robust**: PreToolUse hooks for hook location, env files, `bun test`, force push, and production deploys all work correctly (tested).
3. **Agent role separation is clear**: Read-only agents (code-reviewer, oracle, triage) correctly use `disallowedTools` and `permissionMode: plan`. Implementation agents correctly have Write/Edit access.
4. **Context files are comprehensive**: 6 package context files provide excellent package-specific guidance.
5. **Skill taxonomy is well-organized**: 4-tier architecture with coverage matrix and decision tree.
6. **Agent teams setup is production-ready**: TeammateIdle and TaskCompleted hooks with quality gates, preflight script, in-process mode configured.
7. **Output contracts are consistent**: Shared severity mapping and section order across review, triage, and migration surfaces.
8. **Agent handoff protocol is well-defined**: Clear context passing rules between triage, oracle, cracked-coder, and code-reviewer.
9. **PostToolUse auto-formatting**: Biome runs on every file edit/write, keeping code consistent.
10. **Three-strike protocol**: Used consistently in debug and cracked-coder agents.
11. **Plugins are lean**: Only 3 official plugins enabled (frontend-design, code-simplifier, superpowers).

---

## Recommendations (Priority Order)

### Priority 1 -- Fix Broken CI
1. Delete `.github/workflows/claude-guidance.yml` or create a replacement consistency check script
2. Remove `check-guidance-consistency.js` reference from `AGENTS.md:36`
3. Remove `check-guidance-consistency.js` reference from `cross-package-verify/SKILL.md:52`

### Priority 2 -- Fix Documentation Drift
4. Update `shared.md:104-120` provider hierarchy to match actual code (remove `WagmiProvider`, use `PersistQueryClientProvider`, add `ErrorBoundary`)
5. Update `react-patterns.md:127-129` admin provider order to use `PersistQueryClientProvider`
6. Fix `storybook/SKILL.md:635` anti-pattern: stories ARE in client/admin
7. Update `index.md:327` coverage matrix: add `x` for admin and client on storybook row

### Priority 3 -- Fix Skill References
8. Update `data-layer/SKILL.md:612`: `eventBus` -> `jobQueueEventBus`
9. Update `debug/SKILL.md:237`: `eventBus` -> `jobQueueEventBus`
10. Add `storybook-author` to session start banner in `settings.json:69`

### Priority 4 -- Hook Improvements
11. Fix `bun test` regex bypass (M1) to catch env-var prefixed commands
12. Remove redundant force-push PreToolUse hook (deny list is sufficient)
13. Add failure logging to PostToolUse biome hook before `exit 0`

### Priority 5 -- Documentation Cleanup
14. Document `user-invocable` and `skills` as project-internal metadata fields
15. Clean up or resolve stale plan files (>14 days old)
16. Standardize or document the colon notation for plugins in skill taxonomy
