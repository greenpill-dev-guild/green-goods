# Green Goods Agent System Guide

This document provides an overview of the AI configuration system for Green Goods.

## Configuration Architecture (Consolidated)

All AI configuration is now centralized at the root level:

```
green-goods/
├── CLAUDE.md                    # Primary context (always loaded)
├── .claude/
│   ├── agents/                 # Agent definitions
│   │   ├── oracle.md           # Deep research agent
│   │   ├── cracked-coder.md    # TDD implementation agent
│   │   └── code-reviewer.md    # 6-pass review agent
│   ├── context/                # Package-specific context
│   │   ├── shared.md           # Loaded for packages/shared/**
│   │   ├── client.md           # Loaded for packages/client/**
│   │   ├── admin.md            # Loaded for packages/admin/**
│   │   ├── contracts.md        # Loaded for packages/contracts/**
│   │   ├── indexer.md          # Loaded for packages/indexer/**
│   │   └── agent.md            # Loaded for packages/agent/**
│   ├── hooks.json              # Convention enforcement hooks
│   └── skills/                 # Slash commands
│       ├── plan/SKILL.md       # /plan
│       ├── review/SKILL.md     # /review
│       ├── debug/SKILL.md      # /debug
│       └── audit/SKILL.md      # /audit
└── .cursor/
    ├── AGENT_SYSTEM_GUIDE.md   # This file (overview)
    ├── BUGBOT.md               # Bugbot configuration
    └── mcp.json                # MCP server configuration
```

## Context Loading

### Primary Context (Always Loaded)

**CLAUDE.md** is always loaded and contains:
- Development commands
- Architecture overview
- Coding patterns
- Type system rules
- Error handling
- Testing standards
- Claude Code integration

### Package-Specific Context

When working in a package directory, the corresponding context file is loaded:

| Working In | Context Loaded |
|------------|----------------|
| `packages/shared/**` | `.claude/context/shared.md` |
| `packages/client/**` | `.claude/context/client.md` |
| `packages/admin/**` | `.claude/context/admin.md` |
| `packages/contracts/**` | `.claude/context/contracts.md` |
| `packages/indexer/**` | `.claude/context/indexer.md` |
| `packages/agent/**` | `.claude/context/agent.md` |

### Context Contents

Each package context file (~200 lines) contains:
- Quick reference commands
- Package architecture
- Critical patterns (MANDATORY rules)
- Anti-patterns to avoid
- Common mistakes and solutions
- Testing coverage targets
- Reference files

## Available Commands (4)

| Command | Purpose |
|---------|---------|
| `/plan` | Create, check, and execute implementation plans |
| `/review` | Perform 6-pass code review, process feedback |
| `/debug` | Systematic debugging with root cause analysis |
| `/audit` | Comprehensive codebase health analysis |

## Available Agents (3)

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `oracle` | Deep research with evidence | Research questions, multi-source investigation |
| `cracked-coder` | TDD implementation | Feature development (>50 lines) |
| `code-reviewer` | 6-pass systematic review | PR review before merge |

**Invocation:** Just say "use cracked-coder for this" or "ask oracle about X"

## Hooks (Convention Enforcement)

Hooks in `.claude/hooks.json` enforce Green Goods patterns:

| Category | What It Catches |
|----------|-----------------|
| Quality | Hooks in wrong location, package .env files |
| Safety | Production deploys, force push to main |
| Workflow | TDD reminder, i18n reminder, ABI rebuild reminder |

## MCP Servers (6)

| Server | Purpose |
|--------|---------|
| `figma` | Design context extraction |
| `vercel` | Deployment management |
| `miro` | Whiteboard collaboration |
| `railway` | Railway deployment |
| `foundry` | Contract development (forge, cast, anvil) |
| `storacha` | IPFS/Filecoin storage |

## Critical Cross-Package Rules

These rules are enforced across ALL packages (from CLAUDE.md):

### 1. Root .env Only
**✅ DO:** Use root `.env` file
**❌ DON'T:** Create package-specific `.env` files

### 2. Chain from Environment
**✅ DO:** Use `VITE_CHAIN_ID` via `DEFAULT_CHAIN_ID`
**❌ DON'T:** Read from wallet `chainId`

### 3. Deploy via deploy.ts
**✅ DO:** `bun deploy:testnet` or `bun script/deploy.ts`
**❌ DON'T:** `forge script script/Deploy.s.sol`

### 4. Never Modify schemas.json
**✅ DO:** Create `schemas.test.json` for testing
**❌ DON'T:** Edit `config/schemas.json`

### 5. Centralized Query Keys
**✅ DO:** Use `queryKeys` from `@green-goods/shared`
**❌ DON'T:** Construct ad-hoc query keys

### 6. Hooks Live in Shared (CRITICAL)
**✅ DO:** Create hooks in `packages/shared/src/hooks/`
**❌ DON'T:** Create hooks in client or admin packages

## The 4 Entry Points

All work enters through one of these flows:

| Entry Point | Flow | TDD |
|-------------|------|-----|
| **PRD** | `/plan` → Specs → Stories → Features | No |
| **Feature** | cracked-coder (GATHER → PLAN → TEST → IMPLEMENT → VERIFY) | **Yes** |
| **Bug** | `/debug` → root cause → cracked-coder (if complex) | If complex |
| **Polish** | Direct Claude (no agent needed) | No |

## Quality Baseline

All packages follow these standards:

| Standard | Requirement |
|----------|-------------|
| TypeScript | Strict mode, no `any` without justification |
| Formatting | Biome (35x faster than Prettier) |
| Linting | oxlint (30ms on entire codebase) |
| Commits | Conventional commits (`feat:`, `fix:`, `docs:`) |
| Testing | 70%+ overall, 80%+ for critical paths |

## Getting Started

1. Read `CLAUDE.md` for project overview and patterns
2. Check `.claude/context/{package}.md` for package-specific rules
3. Use agents: "use cracked-coder for this feature"
4. Use commands: `/plan`, `/review`, `/debug`, `/audit`
5. Follow conventional commits
6. Run validation before committing: `bun format && bun lint && bun test && bun build`

## Migration Notes

**Previous Structure (Deprecated):**
- 36 individual `.mdc` rule files across packages
- Package-level `AGENTS.md` files

**Current Structure (Active):**
- 1 primary `CLAUDE.md` file
- 6 package context files in `.claude/context/`
- 3 agents in `.claude/agents/`
- 4 skills in `.claude/skills/`

This consolidation reduces context overhead by ~80% while preserving all critical patterns.

---

**Last Updated:** 2026-01-24
**Maintained by:** Green Goods core team
