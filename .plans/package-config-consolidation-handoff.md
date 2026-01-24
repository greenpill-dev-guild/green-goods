# Package-Level AI Configuration Consolidation Plan

## Agent Handoff Instructions

**Permissions:** Accept all edits (auto-approve file changes)

**Error handling:** If you encounter an issue (file not found, unclear pattern, etc.):
- STOP and ask the user for guidance
- Do NOT skip or make assumptions

**Scope:** Strict plan execution with improvement suggestions
- Execute exactly what's in this plan
- If you notice potential improvements, NOTE them but don't implement
- Ask user before making any changes outside the plan

**Commits:** Do NOT commit - only make edits. User will handle commits.

---

## Summary

Consolidate ~45 fragmented package-level AI configuration files into 6 comprehensive context files within `.claude/context/`, maintaining root `.cursor/` for Cursor support (BUGBOT, MCP).

## Current State

| Category | Count | Location | Action |
|----------|-------|----------|--------|
| `.cursor/rules/*.mdc` | 30 | packages/* | **DELETE** (migrate to context/) |
| `AGENTS.md` | 6 | packages/* | **DELETE** (replaced by context/) |
| `.cursor/BUGBOT.md` | 6 | packages/* | **DELETE** (root BUGBOT is sufficient) |
| `.cursorrules` | 1 | packages/contracts | **DELETE** (merge to context/contracts.md) |
| `.claude/settings.local.json` | 2 | packages/* | **DELETE** (root has comprehensive permissions) |

**Root `.cursor/` (KEEP):**
- `mcp.json` - Single source of truth for MCP servers
- `BUGBOT.md` - PR review automation rules
- `AGENT_SYSTEM_GUIDE.md` - Update to reflect new architecture

**Root `AGENTS.md` (KEEP):**
- Keep as quick-reference pointer to CLAUDE.md and context files
- Update to reference new `.claude/context/` structure

## Target Architecture

```
.cursor/                        # ROOT - KEEP for Cursor support
├── mcp.json                   # MCP servers (single source of truth)
├── BUGBOT.md                  # PR review rules
└── AGENT_SYSTEM_GUIDE.md      # Updated to reflect new structure

.claude/
├── context/                    # NEW: Comprehensive package context (~200 lines each)
│   ├── client.md              # Offline patterns, passkey auth, components
│   ├── admin.md               # Access control, workflows
│   ├── shared.md              # Hook architecture, providers, state
│   ├── contracts.md           # UUPS, deployment, production readiness
│   ├── indexer.md             # Envio conventions, event handlers
│   └── agent.md               # Platform adapters, handlers
├── settings.local.json         # Existing (already comprehensive)
├── hooks.json                  # Existing
├── agents/                     # Existing (3 agents)
├── skills/                     # Existing (4 skills)
└── commands/                   # Existing (4 commands)

CLAUDE.md                       # Root guide (existing)

packages/*/                     # CLEANED - no AI config files
└── (source code only)
```

**Result: ~45 package files → 6 context files**

## Git Strategy

Work on current branch: `feature/hypercerts-minting`
- **No commits** - only edits (user will handle commits)
- Git history preserves all deleted content for reference

## Execution Order

Create context files in this order (shared first as template):
1. **shared.md** - Most complex, defines patterns others use (template for rest)
2. **client.md** - Offline patterns (high priority)
3. **contracts.md** - UUPS patterns (high priority)
4. **admin.md** - Access control
5. **indexer.md** - Envio patterns
6. **agent.md** - Bot patterns

## Implementation Phases

### Phase 1: Create Context Files (Day 1)

**Create:** `.claude/context/` directory with 6 comprehensive files (~200 lines each)

**IMPORTANT:** Thoroughly read ALL source .mdc files before writing each context file. Don't rely on summaries - extract the actual valuable patterns and code examples.

| Context File | Source Files to Read | Key Patterns to Extract |
|--------------|---------------------|------------------------|
| `client.md` | `offline-architecture.mdc`, `authentication.mdc`, `component-cards.mdc`, `component-forms.mdc`, `component-modals.mdc`, `component-radix.mdc`, `testing.mdc`, `rules.mdc` | Job queue, media URLs, passkey branching, card/form/modal patterns |
| `admin.md` | `access-control.mdc`, `component-workflows.mdc`, `testing.mdc`, `rules.mdc` | Role-based access, garden management, modal workflows |
| `shared.md` | `hook-architecture.mdc`, `state-patterns.mdc`, `cross-package-imports.mdc`, `design-system.mdc`, `testing-patterns.mdc`, `appkit-integration.mdc`, `rules.mdc` | Hook categories, provider hierarchy, query keys, import boundaries |
| `contracts.md` | `uups-upgrades.mdc`, `deployment-patterns.mdc`, `schema-management.mdc`, `.cursorrules`, `rules.mdc` | Storage gaps, deploy.ts usage, production readiness checklist |
| `indexer.md` | `envio-conventions.mdc`, `development.mdc` | Entity patterns, event handlers, Docker workflow |
| `agent.md` | `architecture.mdc`, `security.mdc`, `deployment.mdc`, `testing.mdc`, `rules.mdc` | Platform adapters, encryption, Railway deployment |

**Content depth:** Comprehensive (~200 lines) with:
- Critical patterns (code examples from the actual .mdc files)
- Anti-patterns (what NOT to do)
- Common mistakes
- Package-specific commands

**PRIORITY PATTERNS** (must be captured thoroughly):
1. **Offline patterns (client.md)** - Job queue, media URL lifecycle, sync triggers, event-driven updates
2. **UUPS patterns (contracts.md)** - Storage gap calculations, upgrade safety, initializer patterns
3. **Hook architecture (shared.md)** - Hook categories, naming conventions, when to create new hooks
4. **Access control (admin.md)** - Role-based guards, permission checking
5. **Query key patterns (shared.md)** - Centralized keys, invalidation patterns

These patterns are critical for consistent, reliable code generation.

### Phase 2: Update Root .cursor/ (Day 1)

**Update:** `.cursor/AGENT_SYSTEM_GUIDE.md` to reflect new architecture
- Remove references to package-level `.cursor/rules/`
- Point to `.claude/context/` for package-specific guidance
- Keep MCP server documentation

**Keep unchanged:**
- `.cursor/mcp.json` - Single source of truth for MCP
- `.cursor/BUGBOT.md` - Already comprehensive, package BUGBOT files are redundant

### Phase 3: Delete Package Files (Day 2)

**Delete all in one pass** (no archiving - clean delete):

```bash
# AGENTS.md files (6)
rm packages/*/AGENTS.md

# .cursor directories (6 packages × all contents)
rm -rf packages/client/.cursor
rm -rf packages/admin/.cursor
rm -rf packages/shared/.cursor
rm -rf packages/contracts/.cursor
rm -rf packages/indexer/.cursor
rm -rf packages/agent/.cursor

# .cursorrules (1)
rm packages/contracts/.cursorrules

# Package-level .claude directories (2)
rm -rf packages/contracts/.claude
rm -rf packages/shared/.claude
```

**Total deleted:** ~45 files across 6 packages

### Phase 4: Update Documentation & Agents (Day 2)

**A. Update CLAUDE.md** - Add context file documentation:

```markdown
### Package Context Files

Package-specific patterns are documented in `.claude/context/`:

| File | Package | Key Patterns |
|------|---------|--------------|
| `client.md` | PWA | Offline-first, passkey auth, components |
| `admin.md` | Dashboard | Access control, workflows |
| `shared.md` | Hooks/Modules | Hook architecture, providers, state |
| `contracts.md` | Solidity | UUPS upgrades, deployment, production |
| `indexer.md` | GraphQL | Envio conventions, entities |
| `agent.md` | Bot | Platform adapters, handlers |

These files extend CLAUDE.md with package-specific context (~200 lines each).
Context files are loaded automatically when working in the corresponding package.
```

**B. Update Agent Files** - Add glob patterns for automatic context loading:

Update `.claude/agents/cracked-coder.md` and `.claude/agents/oracle.md` to include:

```markdown
## Context Loading

When working in a package, load the relevant context file:
- Working in `packages/client/` → Read `.claude/context/client.md`
- Working in `packages/admin/` → Read `.claude/context/admin.md`
- Working in `packages/shared/` → Read `.claude/context/shared.md`
- Working in `packages/contracts/` → Read `.claude/context/contracts.md`
- Working in `packages/indexer/` → Read `.claude/context/indexer.md`
- Working in `packages/agent/` → Read `.claude/context/agent.md`
```

**C. Update Root AGENTS.md** - Add reference to new structure:

```markdown
## Package Context

Package-specific guidance has moved to `.claude/context/`:
- See CLAUDE.md for architecture and principles
- See `.claude/context/{package}.md` for package-specific patterns
```

### Phase 5: Update References in READMEs and Docs (Day 2)

**Check for outdated references:**

```bash
# Find references to deleted files
grep -r "AGENTS\.md" docs/ packages/*/README.md --include="*.md" 2>/dev/null
grep -r "\.cursor/rules" docs/ packages/ --include="*.md" 2>/dev/null
grep -r "cursorrules" docs/ packages/ --include="*.md" 2>/dev/null
```

**Update any found references to point to:**
- `.claude/context/{package}.md` for package-specific patterns
- `CLAUDE.md` for architecture and principles
- `.cursor/BUGBOT.md` for PR review rules

### Phase 6: Verify & Test (Day 2)

**Verification checklist:**
- [ ] All 6 context files exist in `.claude/context/`
- [ ] No `AGENTS.md` files in `packages/*/`
- [ ] No `.cursor/` directories in `packages/*/`
- [ ] Root `AGENTS.md` exists and references context files
- [ ] Root `.cursor/` still has `mcp.json`, `BUGBOT.md`
- [ ] Agent files updated with context loading instructions
- [ ] No broken references in docs/ or READMEs
- [ ] `bun build` passes
- [ ] `bun lint` passes

## Critical Files

**Files to modify (5):**
- [CLAUDE.md](CLAUDE.md) - Add context file documentation section
- [AGENTS.md](AGENTS.md) - Add reference to new context structure
- [.cursor/AGENT_SYSTEM_GUIDE.md](.cursor/AGENT_SYSTEM_GUIDE.md) - Update to reflect new architecture
- [.claude/agents/cracked-coder.md](.claude/agents/cracked-coder.md) - Add context loading instructions
- [.claude/agents/oracle.md](.claude/agents/oracle.md) - Add context loading instructions

**Files to create (6 total):**
- `.claude/context/client.md` (~200 lines)
- `.claude/context/admin.md` (~200 lines)
- `.claude/context/shared.md` (~200 lines)
- `.claude/context/contracts.md` (~200 lines)
- `.claude/context/indexer.md` (~200 lines)
- `.claude/context/agent.md` (~200 lines)

**Files to delete (~45 total):**
- `packages/*/AGENTS.md` (6 files)
- `packages/*/.cursor/` (6 directories, ~30 .mdc files + 6 BUGBOT.md)
- `packages/contracts/.cursorrules` (1 file)
- `packages/contracts/.claude/settings.local.json` (1 file)
- `packages/shared/.claude/settings.local.json` (1 file)

**Files to keep (root level):**
- `AGENTS.md` - Quick reference (updated to point to context/)
- `.cursor/mcp.json` - MCP server configuration
- `.cursor/BUGBOT.md` - PR review automation
- `.claude/settings.local.json` - Already comprehensive

## Context File Template (~200 lines)

```markdown
# {Package} Context

Loaded when working in `packages/{package}/`. Extends CLAUDE.md.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun test` | Run tests |
| `bun build` | Build package |
| ... | ... |

## Architecture

{Brief diagram or description of package structure}

## Critical Patterns

### {Pattern 1 Name}
{10-20 lines: code example + explanation}

### {Pattern 2 Name}
{10-20 lines: code example + explanation}

### {Pattern 3 Name}
{10-20 lines: code example + explanation}

## Anti-Patterns

### {Anti-Pattern 1}
```typescript
// ❌ Wrong
{bad code}

// ✅ Correct
{good code}
```

### {Anti-Pattern 2}
{...}

## Common Mistakes

| Mistake | Why It Fails | Solution |
|---------|--------------|----------|
| ... | ... | ... |

## Package-Specific Constraints

- {Constraint 1}
- {Constraint 2}

## Reference Files

- {key source file}: {what it does}
- {key source file}: {what it does}
```

## Verification

After implementation:

```bash
# 1. Verify no package-level AI config
find packages -name "AGENTS.md" -o -name ".cursor" -type d
# Should return nothing

# 2. Verify context files exist
ls -la .claude/context/
# Should show 6 .md files

# 3. Verify root AGENTS.md exists
test -f AGENTS.md && echo "✓ Root AGENTS.md exists"

# 4. Verify root .cursor intact
ls .cursor/
# Should show: mcp.json, BUGBOT.md, AGENT_SYSTEM_GUIDE.md

# 5. Verify agent files updated
grep -l "context/" .claude/agents/*.md
# Should show cracked-coder.md and oracle.md

# 6. Verify no broken references in docs
grep -r "packages/[^/]*/AGENTS\.md" docs/ --include="*.md" 2>/dev/null
grep -r "packages/[^/]*/\.cursor" docs/ --include="*.md" 2>/dev/null
# Should return nothing

# 7. Verify build passes
bun build && bun lint
```

## Maintenance Guidelines

### When to Update

| Change Type | Location |
|-------------|----------|
| Monorepo-wide pattern | CLAUDE.md |
| Package-specific pattern | `.claude/context/{package}.md` |
| Convention enforcement | `.claude/hooks.json` |
| PR review rule | `.cursor/BUGBOT.md` |

### Context File Criteria

**Include if:**
- Specific to package domain (not in CLAUDE.md)
- Cannot be inferred from code structure
- Involves non-obvious sequencing
- Has caused bugs when violated

**Exclude if:**
- Already in CLAUDE.md
- Standard practice for the technology
- Can be inferred from imports/types

### Single Source of Truth

```
CLAUDE.md (principles, architecture, commands)
    ├── .claude/context/*.md (package patterns)
    └── .cursor/BUGBOT.md (PR review rules)
         └── Source code (implementation)
```

**Rule:** Never duplicate content from a higher level.

## MCP Configuration

**Location:** `.cursor/mcp.json` (single source of truth)

| Server | Purpose |
|--------|---------|
| figma | Design context extraction |
| vercel | Deployment management |
| miro | Whiteboard/diagrams |
| railway | Agent deployment |
| foundry | Contract development |
| storacha | IPFS/Filecoin storage |

Both Cursor and Claude Code read from this file. No package-level MCP config needed.
