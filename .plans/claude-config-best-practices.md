# Claude Code Configuration Best Practices Alignment

**Date**: 2026-02-18
**Branch**: `feature/ens-integration`
**Source**: Review against `code.claude.com/docs` (best-practices, skills, sub-agents, hooks-guide, memory)

## Overview

Align `.claude/` configuration with Anthropic's official best practices. 30+ skills cause context budget bloat, hooks are underused for enforcement, and agents lack safety bounds.

---

## Task 1: CLAUDE.md Trimming

**Priority**: P2 | **Package**: root

Remove content Claude can discover by reading code. Keep only things that would cause mistakes if absent.

### Remove
- **Package Structure** tree (lines ~30-38) — `ls packages/` discovers this
- **Critical Dependencies** list — visible in `package.json`
- **"Claude Code Integration"** section — Claude auto-discovers `.claude/`

### Shorten
- **Environment** section — keep only the "Single `.env` at root" rule and `VITE_CHAIN_ID` note, remove variable list (`.env.example` exists)
- **Contract Deployment** section — keep the 3 deploy commands + "deployment artifacts" note, remove the rest (covered by `deployment` skill)

### Result
Target: under 80 lines total (currently ~100+). Every line must fail the test: "Would removing this cause Claude to make mistakes?"

---

## Task 2: Rules Path Scoping

**Priority**: P1 | **File**: `.claude/rules/typescript.md`

Add `paths` frontmatter so TypeScript rules don't load when Claude edits markdown, JSON, or config files:

```yaml
---
paths:
  - "**/*.{ts,tsx}"
---
```

No content changes needed — just add the frontmatter block.

---

## Task 3: Skill Invocability Audit

**Priority**: P1 | **Package**: `.claude/skills/`

Add `user-invocable: false` to reference/knowledge skills that users should never invoke directly. These are background knowledge Claude auto-loads when relevant.

### Skills to update (add `user-invocable: false` to frontmatter)

1. `tailwindcss/SKILL.md`
2. `radix-ui/SKILL.md`
3. `error-handling-patterns/SKILL.md`
4. `data-layer/SKILL.md`
5. `xstate/SKILL.md`
6. `tanstack-query/SKILL.md`
7. `vite/SKILL.md`
8. `docker/SKILL.md`
9. `dependency-management/SKILL.md`
10. `monitoring/SKILL.md`
11. `biome/SKILL.md`
12. `ci-cd/SKILL.md`
13. `git-workflow/SKILL.md`
14. `i18n/SKILL.md`
15. `performance/SKILL.md`
16. `storybook/SKILL.md`
17. `mermaid-diagrams/SKILL.md`
18. `web3/SKILL.md`
19. `architecture/SKILL.md`
20. `security/SKILL.md`

### Skills to KEEP user-invocable (these are actions/workflows)
- `plan`, `review`, `audit`, `debug` — primary command skills
- `agent-teams` — team orchestration
- `contracts`, `indexer`, `agent`, `react`, `testing` — may be invoked for focused work
- `frontend-design`, `ui-compliance` — design sessions
- `autonomous-review`, `cross-package-verify`, `tdd-bugfix` — thin wrappers
- `migration`, `deployment` — already have `disable-model-invocation: true`

### Validation
After changes, run in Claude Code:
- `/context` — check skill description budget isn't exceeded
- Verify updated skills don't appear in `/` autocomplete menu
- Verify Claude still auto-loads them when working on relevant files

---

## Task 4: Agent Safety Bounds

**Priority**: P1 | **Package**: `.claude/agents/`

Add `maxTurns` to all agent frontmatter to prevent runaway token consumption.

| Agent | File | `maxTurns` |
|-------|------|-----------|
| triage | `triage.md` | 5 |
| oracle | `oracle.md` | 30 |
| cracked-coder | `cracked-coder.md` | 50 |
| code-reviewer | `code-reviewer.md` | 20 |
| migration | `migration.md` | 50 |

Just add `maxTurns: N` to the YAML frontmatter of each file. No other changes.

---

## Task 5: Compaction Re-injection Hook

**Priority**: P0 | **File**: `.claude/hooks.json`

Add a `SessionStart` hook with `compact` matcher to re-inject critical rules after context compaction. This is the single highest-impact change — prevents "Claude forgot the rules mid-session" failures.

Add to the `SessionStart` array in `.claude/hooks.json`:

```json
{
  "matcher": "compact",
  "hooks": [
    {
      "type": "command",
      "command": "echo '## Post-Compaction Reminders\\n- Use `bun run test` (NEVER `bun test`) — bun test ignores vitest config\\n- Never use `forge build`/`forge test` directly — always use bun wrappers\\n- ALL hooks MUST live in packages/shared/src/hooks/ (not client or admin)\\n- Single .env at root only — never create package-specific .env files\\n- Import from `@green-goods/shared` barrel only — never deep paths\\n- Use `Address` type (not string) for Ethereum addresses\\n- Use `logger` from shared (not console.log)\\n- Use `parseContractError()` + `USER_FRIENDLY_ERRORS` for contract errors'"
    }
  ]
}
```

---

## Task 6: PostToolUse Auto-Format Hook

**Priority**: P2 | **File**: `.claude/hooks.json`

Add Biome auto-format after every file edit. This makes formatting deterministic (hook) rather than advisory (CLAUDE.md instruction).

Add to `.claude/hooks.json`:

```json
{
  "PostToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [
        {
          "type": "command",
          "command": "FILE=$(cat | jq -r '.tool_input.file_path // empty'); if [ -n \"$FILE\" ] && echo \"$FILE\" | grep -qE '\\.(ts|tsx|js|jsx|json)$' && ! echo \"$FILE\" | grep -q 'packages/contracts/out/'; then npx @biomejs/biome format --write \"$FILE\" 2>/dev/null; fi; exit 0"
        }
      ]
    }
  ]
}
```

Key details:
- Only formats `.ts/.tsx/.js/.jsx/.json` files (not `.sol`, `.md`, etc.)
- Excludes `packages/contracts/out/` (generated artifacts)
- Always exits 0 so formatting failures don't block Claude
- Uses `npx` to ensure biome is found

---

## Task 7: Notification Hook

**Priority**: P3 | **File**: `.claude/hooks.json`

Add macOS desktop notification when Claude needs attention:

```json
{
  "Notification": [
    {
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Green Goods\"'"
        }
      ]
    }
  ]
}
```

---

## Validation Checklist

After all tasks complete:

- [ ] `CLAUDE.md` is under 80 lines
- [ ] `typescript.md` has `paths:` frontmatter
- [ ] 20 reference skills have `user-invocable: false`
- [ ] All 5 agents have `maxTurns` in frontmatter
- [ ] `hooks.json` has compaction re-injection hook
- [ ] `hooks.json` has PostToolUse auto-format hook
- [ ] `hooks.json` has Notification hook
- [ ] `/context` shows no skill budget warnings
- [ ] `bun format` passes (hooks.json is valid JSON)
- [ ] Existing PreToolUse hooks still present and unchanged

## Out of Scope (Future)

- Skill consolidation (merging radix-ui + tailwindcss + ui-compliance, etc.) — requires content review
- Agent hooks in frontmatter (PostToolUse for cracked-coder auto-format)
- Stop hook with prompt-based verification
- Plugin installation (code intelligence)
- CLAUDE.local.md template for team
