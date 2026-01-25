# Codex Guidance (Reference-Only)

This repo already centralizes AI rules and workflows for Claude. Codex should **reference** those sources instead of duplicating them here.

## Canonical Sources (Do Not Duplicate)

- `CLAUDE.md` — primary rules, architecture, and commands
- `.claude/skills/{plan,review,debug,audit}/SKILL.md` — authoritative workflows
- `.claude/commands/*.md` — command triggers, usage, and outputs
- `.claude/agents/*.md` — role behaviors (`oracle`, `cracked-coder`, `code-reviewer`)

## How Codex Should Operate

When a task matches a Claude workflow or rule set:
1. Open the relevant file(s) above.
2. Follow them verbatim.
3. Do not restate or re-implement the rules elsewhere.

## MCP Configuration (Codex)

MCP servers are defined in `.mcp.json` (single source of truth). Point Codex to this file when MCP is enabled in your runtime.
