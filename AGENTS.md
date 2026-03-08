# Green Goods — Agent Guide (Pointer Contract)

Compact runtime contract for AI agents. Canonical guidance lives in `CLAUDE.md` and `.claude/**`.

## Non-Negotiable Invariants

- Use `bun` for all package operations (never npm/yarn).
- Use `bun run test` (NEVER `bun test`) — `bun test` ignores vitest config.
- Never use raw `forge` commands — use `bun build`, `bun run test:contracts`.
- Hooks live in `@green-goods/shared` only.
- Root `.env` only; never add package-level `.env` files.
- Single-chain behavior only (`getDefaultChain()` / `DEFAULT_CHAIN_ID`).
- Contract deployments/upgrades go through `deploy.ts` wrappers and bun scripts.
- `packages/contracts/config/schemas.json` is read-only.
- Any new user-facing string must be added to `en/es/pt` locale files.

## Code Conventions

- Barrel imports: `import { x } from "@green-goods/shared"`, never deep paths.
- Use `Address` type (not `string`) for Ethereum addresses.
- Use `logger` from shared, never `console.log`.
- Icons: Remixicon (`Ri*Line`), never lucide.
- Never swallow errors — use `parseContractError()` for contract errors.
- Build order: contracts → shared → indexer → client/admin/agent.

## Scope Constraints (Automated Tasks)

When running automated maintenance tasks:
- Max 20 files changed per PR.
- Never touch deployment scripts, contract upgrade scripts, or `.env` files.
- Do not create new packages or top-level directories.
- Do not modify `CLAUDE.md`, `AGENTS.md`, or files in `.claude/`.
- All automated PRs must be created as drafts with appropriate labels.

## Canonical Sources

| What | Where |
|---|---|
| Primary context | `CLAUDE.md` |
| Package contexts | `.claude/context/{shared,client,admin,contracts,indexer,agent}.md` |
| Skills | `.claude/skills/*/SKILL.md` (also symlinked at `.agents/skills/`) |
| Agents | `.claude/agents/*.md` |
| Rules | `.claude/rules/*.md` (path-scoped, loaded conditionally) |
| MCP servers | `.mcp.json` (single source of truth) |

For agentic development practices and tool-specific guides, see `docs/docs/builders/agentic/`.

## Guidance Governance

```bash
node .claude/scripts/check-guidance-consistency.js
```

CI runs this check via `.github/workflows/claude-guidance.yml`.
