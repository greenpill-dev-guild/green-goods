# Green Goods — Agent Guide (Pointer Contract)

Compact runtime contract for AI agents. Canonical guidance lives under `CLAUDE.md` and `.claude/**`.

## Non-Negotiable Runtime Invariants

- Hooks live in `@green-goods/shared` only.
- Root `.env` only; never add package-level `.env` files.
- Single-chain behavior only (`getDefaultChain()` / `DEFAULT_CHAIN_ID`).
- Contract deployments/upgrades go through `deploy.ts` wrappers and bun scripts.
- `packages/contracts/config/schemas.json` is read-only.
- Any new user-facing string must be added to `en/es/pt` locale files.

## Canonical Sources

- Primary context: `CLAUDE.md`
- Package contexts: `.claude/context/{shared,client,admin,contracts,indexer,agent}.md`
- Output/severity contract: `.claude/standards/output-contracts.md`
- Skills: `.claude/skills/*/SKILL.md` (Claude discovers automatically)
- Agents: `.claude/agents/*.md` (Claude discovers automatically)
- Rules: `.claude/rules/*.md` (path-scoped, loaded conditionally)

Canonical command surface: `/plan`, `/debug`, `/review`, `/audit`, `/teams`.

## MCP and Tooling Contract

- `.mcp.json` is the single source of truth for MCP servers.
- If a server is not defined in `.mcp.json`, do not route work assuming it exists.
- Prefer local commands for small tasks; escalate to MCP only when needed.

## Guidance Governance Check

Run this before handing off guidance changes:

```bash
node .claude/scripts/check-guidance-consistency.js
```

CI runs the same check via `.github/workflows/claude-guidance.yml`.
