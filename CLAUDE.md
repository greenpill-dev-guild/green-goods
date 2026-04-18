# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Commands

```bash
bun setup                    # Initial setup (deps, packages, .env)
bun dev                      # Start all services via PM2
bun dev:stop                 # Stop all services
bun format && bun lint       # Format and lint workspace
bun run test                 # Run all tests (CRITICAL: not `bun test`)
bun build                    # Build everything (respects dependency order)
```

> **`bun test` vs `bun run test`**: `bun test` uses bun's built-in runner (ignores vitest config). `bun run test` runs the package.json script (vitest with proper environment). Always use `bun run test`.

Per-package: `bun run test`, `bun build`, `bun lint` (check each package.json for available scripts).

**Contracts** (never use raw `forge` commands): `bun build` (adaptive changed-target compile), `bun build:changed` (changed Solidity only), `bun build:target -- src/...` (single-target compile), `bun build:full` (CI/deploy only), `bun run test:fork` (needs RPC URLs).

## Architecture

Green Goods is an **offline-first, single-chain** platform for documenting regenerative work on-chain. Bun monorepo.

### Key Principles
1. **Offline-First**: Client PWA works without internet, syncs when connected
2. **Single Environment**: All packages share root `.env` (never create package-specific .env)
3. **Single Chain**: Target chain set by `VITE_CHAIN_ID` at build time
4. **Shared Logic**: ALL React hooks MUST live in `@green-goods/shared`

### Intent Priorities (trade-off hierarchy)
When principles conflict, resolve top-down:
1. **Offline correctness** — nothing breaks without network
2. **Security** — funds, access control, key management
3. **User experience** — PWA-native feel, responsive, accessible
4. **Developer experience** — build times, test speed, clear errors
5. **Code elegance** — readability, patterns, minimal complexity

### Criticality Matrix
Use criticality to choose review depth before optimizing for speed:

- **`critical`**
  - `packages/contracts/src/**`
  - `packages/shared/src/providers/{Auth,JobQueue,Work}.tsx`
  - `packages/shared/src/modules/job-queue/**`
  - `packages/shared/src/hooks/{auth,work,vault,blockchain}/**`
  - Required depth: read every touched line, run the matching reviewer flow (`contracts-security` or `mutation-reliability`), and do not treat log-only failure handling as acceptable.
- **`sensitive`**
  - `packages/agent/src/**`
  - admin workflow state surfaces
  - client journey views
  - Required depth: keep the diff bounded, inspect failure and recovery states explicitly, and run the lightest targeted validation that proves the user-facing path still works.
- **`routine`**
  - docs
  - automation prompts
  - stories
  - cleanup-only changes
  - test-only refactors that do not alter runtime behavior
  - Required depth: use the lightest honest check and avoid escalating the review footprint unless runtime behavior changes.

### Plan Location
Superpowers plans save to `.plans/active/<feature-name>/plan.todo.md` (not the skill default).

### Build Order
1. **contracts** -> ABIs for other packages
2. **shared** -> hooks/modules for frontends
3. **indexer** -> needs contract ABIs
4. **client/admin/agent** -> need shared package

## Documentation

The `docs/` directory contains a Docusaurus site with product documentation, user guides, and developer references. When investigating domain questions, architecture decisions, or user-facing behavior, consult:

- System architecture (diagrams): `docs/docs/developers/architecture.mdx`
- Domain glossary: `docs/docs/glossary.md`
- Impact model (CIDS): `docs/docs/concepts/impact-model.mdx`
- Strategy and goals: `docs/docs/concepts/strategy-and-goals.mdx`
- Entity matrix: `docs/docs/developers/reference/entity-matrix.mdx`

Package-specific context files (`.claude/context/*.md`) include additional documentation references relevant to each package.

## Key Patterns

**Hook Boundary**: ALL hooks in `@green-goods/shared`. Client/admin only have components and views.
```typescript
import { useAuth, useGardens } from '@green-goods/shared'; // correct
```

**Contract Integration**: Import deployment artifacts, never hardcode addresses.
```typescript
import deployment from '../../../contracts/deployments/11155111-latest.json';
```

**Barrel Imports**: Always `import { x } from "@green-goods/shared"`, never deep paths.

**Type System**: Domain types (`Garden`, `Work`, `Action`, `Address`) live in `@green-goods/shared`. Use `Address` type (not `string`) for Ethereum addresses.

**Error Handling**: Never swallow errors. Use `parseContractError()` + `USER_FRIENDLY_ERRORS` for contract errors. Use `createMutationErrorHandler()` in shared mutation hooks. Use `logger` from shared (not `console.log`).

**Query Keys**: Use `queryKeys.*` helpers from shared. Serialize objects in query keys.

**Indexer Boundary**: Envio indexes only Green Goods core state (actions, gardens, hats role membership, vault history, yield split history, minimal hypercert linkage/claims). Do not re-index EAS attestations, Gardens V2 community/pools, marketplace, ENS lifecycle, cookie jars, or Hypercert display metadata.

**Investigate Before Answering**: Never speculate about code you have not opened. If referencing a specific file, you MUST read it before answering. Give grounded, hallucination-free answers based on actual file contents, not assumptions about what code might look like.

**Subagent Discipline**: Spawn teammates when tasks can run in parallel, require isolated context, or involve independent workstreams. Work directly (no subagent) for single-file edits, sequential operations, tasks sharing state across steps, or any task needing fewer than 10 tool calls. Prefer the simplest approach that completes the task.

## Design System

Full skills: `design` (direction) + `ui` (implementation). Load explicitly when paradigm, layout composition, new view, tokens, or PR review is at stake. For trivial edits (padding, copy, a single component touch), the rules below are sufficient.

**Language**: Warm Earth — M3 Expressive × Liquid Glass. Canonical spec: `.claude/skills/design/language.md`. Scannable cheat sheet: `.claude/skills/design/quick-reference.md`. Ecosystem map: `.claude/skills/design/ARCHITECTURE.md`.

**Surface identities (never mix)**:
- **Admin** (`packages/admin`) — restrained operator cockpit. M3 strict anatomy (v0.192), Plus Jakarta Sans, glass only on `TopContextBar`, solid surfaces everywhere else. Use `Admin*` wrappers. Litmus: appropriate for Linear / GitHub / Stripe Dashboard?
- **Client PWA** (`packages/client`) — warm garden-journal feel. Full Warm Earth expression. Inter typography. Bottom `AppBar` (installed PWA) / `SiteHeader` hamburger (browser). Hero moments live here, never in admin.
- **Shared** (`packages/shared`) — primitives + tokens in `src/styles/theme.css`. All React hooks live here (`@green-goods/shared`).

**Tokens**: Never hardcode `cubic-bezier`, `duration`, or raw color/radius values. Use `--spring-*` (6 motion tokens), `--color-*`, `--radius-*`, `--color-material-*` + `--blur-material-*`. Concentricity rule: `child_radius = parent_radius − padding`.

**4-role volume hierarchy**: canvas 80–90% / ink 8–15% / stone 3–5% / accent green 1–3%. Flooding the screen with green is the #1 failure mode. Codebase token `--color-primary` resolves to the **tertiary accent** role — do not rename.

**Banned vocabulary** (enforced by `bun run lint:vocab` on i18n strings):
- Any surface: `streak`, `countdown`, `leaderboard`, `FOMO`, growth-hacking language.
- Admin only: `hero moment`, `gallery`, `decorative gradient`, `marketing banner`, glass outside `TopContextBar`.
- Client only: `operator cockpit`, `utility copy`, `KPI tile`, `dashboard`, `Plus Jakarta Sans`.

**Component palettes** (do not invent component names — flag missing primitives instead):
- Admin: 13 `Admin*` wrappers + `CanvasLayout` / `TopContextBar` / `MainSheet` / `{Left,Right,Bottom}Sheet` / `NavigationBar` / `AdminFab`. Full list: `.claude/skills/design/prompt-contract.md § Canonical Component Palette`.
- Client: `@green-goods/shared` primitives + `PlatformRouter` / `SiteHeader` / `AppBar`. Full list: `.claude/skills/design/client-prompt-contract.md § Canonical Component Palette`.

**Validation**: `bun run check:design-tokens` (spec ↔ theme.css drift + version coupling) · `bun run lint:vocab` (banned terms).

**PR review**: 4-lens checklist at `.claude/skills/design/review-checklist.md` — Regenerative → Spatial → Ecosystem → Compliance. Quick pass = Lenses 1 + 4. Full pass (new view) = all four.

**Admin UI defect resolution**: When the user reports anything off on an admin surface — however casually ("the card on Hub feels tight", "that thing at the top", "the tabs look weird on mobile") — do **not** guess and do **not** ask them to formalize the report. Resolve to a canonical `Admin*` wrapper or canvas region first, then edit. Escalate in order:

1. **Chrome MCP live DOM** — if an admin tab is open (`mcp__claude-in-chrome__tabs_context_mcp`), use `javascript_tool` or `read_page` to read `data-component` / `data-variant` / `data-region` / `data-workspace` on the rendered page. This is the preferred path because the user already runs admin in Brave with Chrome MCP for UI review.
2. **Grep fallback** — `grep -rn 'data-component="AdminX"' packages/admin/src/views/<workspace>/` when the page isn't open or Chrome MCP is unavailable. Map casual terms ("card", "tabs", "search") via the table in the grammar file.
3. **Ask** — only if 1 + 2 don't narrow to a single candidate. Ask in terms the user recognizes (component name + view), never ask them to write the grammar.

Full resolution workflow, casual-term mapping, and defect-type taxonomy: `.claude/skills/design/defect-grammar.md`. Ground every edit with an internal `<Component> in <route/region> → <defect-type>: <expected> vs <actual>` statement — user never has to write it.

## Contract Deployment

```bash
bun script/deploy.ts core --network sepolia              # Dry run
bun script/deploy.ts core --network sepolia --broadcast   # Deploy
bun script/deploy.ts core --network sepolia --broadcast --update-schemas  # Deploy + schemas
```

**Deployment artifacts**: `deployments/{chainId}-latest.json` is the source of truth for all addresses. Zero addresses mean the module hasn't been deployed yet (not a blocker for optional modules).

## Environment

Single `.env` at root (never create package-specific .env). `VITE_CHAIN_ID` sets target chain at build time. `.env.schema` is the source of truth.

## Scope Discipline
- When instructions say "output in chat" or "just tell me", do NOT edit files
- For destructive changes (removing sections, replacing pages, merging content): list what will be REMOVED and ADDED, then wait for confirmation
- Never replace content that was asked to be added as new
- When unsure about scope, ask — the cost of a clarifying question is far less than a wrong edit

## Git Workflow

**Branches**: `type/description` (e.g., `feature/hats-v2`, `bug/admin-fix`)

**Commits**: Conventional Commits with scope: `type(scope): description`
- Types: feat, fix, refactor, chore, docs, test, perf, ci
- Scopes: contracts, indexer, shared, client, admin, agent, claude

**Validation before committing**: `bun format && bun lint && bun run test && bun build`

## Session Continuity

Before context compaction or ending a long session, write a `session-state.md` in the working directory:

```markdown
## Session State
- **Current task**: [what you're working on]
- **Progress**: [what's done, what's in progress]
- **Files modified**: [list of changed files]
- **Tests**: [passing/failing/not yet written]
- **Next steps**: [immediate next actions]
- **Blocked by**: [blockers, if any]
```

This is distinct from any local project memory, which is untracked and not canonical. Session state captures execution context for the next context window.

## Cleanup

If you create temporary files, scripts, or helpers during iteration, remove them before reporting task completion.
