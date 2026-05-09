# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Commands

```bash
npm run setup                # First-clone setup bridge before Bun is available
bun run setup                # Setup after Bun is available
bun run dev:doctor -- --profile web   # Non-mutating local environment readiness check
bun run dev:web              # Start client, admin, and docs via PM2
bun run dev:smoke:web        # Check web doctor plus client/admin/docs health
bun run dev:full             # Start all services via PM2
bun run dev                  # Alias for dev:full
bun run dev:stop             # Stop all services
bun format && bun lint       # Format and lint workspace
bun run test                 # Run all tests (CRITICAL: not `bun test`)
bun run test:fast            # Same scope, but cache-aware via Turborepo (skips packages with unchanged inputs)
bun run test:fast:force      # Same as test:fast but bypasses cache (use when debugging a stale cache hit)
bun build                    # Build everything (respects dependency order)
```

> **`bun test` vs `bun run test`**: `bun test` uses bun's built-in runner (ignores vitest config). `bun run test` runs the package.json script (vitest with proper environment). Always use `bun run test`.

> **`test` vs `test:fast`**: `bun run test` always runs every package via `bun --filter`. `bun run test:fast` runs the same scope through Turborepo, which caches passing test runs by input hash. Cache invalidates automatically when a package's source, its workspace dependencies' source (shared/contracts), `.env`, `biome.json`, or root tsconfigs change. **Failing tests are never cached** — fix the test, not the cache. To force a fresh run, use `bun run test:fast:force` or `rm -rf .turbo`.

Per-package: `bun run test`, `bun build`, `bun lint` (check each package.json for available scripts).

**Contracts** (never use raw `forge` commands): `bun build` (adaptive changed-target compile), `bun build:changed` (changed Solidity only), `bun build:target -- src/...` (single-target compile), `bun build:full` (CI/deploy only), `bun run test:fork` (needs RPC URLs). For Arbitrum deploy/upgrade operations, use the named root `contracts:*` scripts; they set `FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer`, clear unrelated Pinata upload secret resolution, and encode the current proxy-owner sender where required.

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

**Feature Availability**: Use `isGreenWillDeployed(chainId?)` from `@green-goods/shared` to detect when a feature contract is undeployed (zero-address) on the active chain. Render a "not available on this network" branch instead of a generic empty state — masking deployment gaps as data gaps wastes debugging cycles.

**Optimistic-UI Memos**: When a memo depends on a value written to localStorage in the same tab (e.g. pending-join membership), include `usePendingJoinsVersion()` from `@green-goods/shared` in its `useMemo` deps. The hook returns an incrementing counter that ticks on every in-tab pending-join change. Standard `storage` events only fire across tabs, so without this same-tab consumers go stale until an unrelated re-render. The pattern is generalizable — propose a sibling `use<Thing>Version()` hook when introducing new localStorage-backed optimistic state.

**Indexer Boundary**: Envio indexes only Green Goods core state (actions, gardens, hats role membership, vault history, yield split history, minimal hypercert linkage/claims). Do not re-index EAS attestations, Gardens V2 community/pools, marketplace, ENS lifecycle, cookie jars, or Hypercert display metadata.

**Investigate Before Answering**: Never speculate about code you have not opened. If referencing a specific file, you MUST read it before answering. Give grounded, hallucination-free answers based on actual file contents, not assumptions about what code might look like.

**Verify Before Claiming Success**: Before reporting that a fix works, a setting takes effect, or a behavior holds, produce evidence in the same turn — the command output, the passing test, the rendered DOM via Chrome MCP, the re-read file showing the change. "Should work", "probably fixed", and unrun commands are not evidence. If a CLI flag is unfamiliar, read `--help` or the source before invoking it; do not invent flags. If you cannot verify (no test, no live DOM, no observable signal), say "I can't verify this without X" and stop rather than declaring success. Untested fixes and hallucinated commands have produced more reverts in this repo than any other failure mode.

**User-Observed UI Regression Debugging**: Bug reports trigger the debug skill automatically. When the reported symptom is something the user can see or touch — cannot click, cannot select, missing selected border/state, collapsed or blank cards, invisible content, broken scroll/refresh, visible-but-unusable controls — start from the rendered surface before tracing data flow. First reproduce or simulate the exact visible/clickable symptom with the real component path, inspect DOM geometry and computed styles (bounding rect, width/height, opacity, display, pointer-events, z-index, overflow, disabled state, selected classes, border/ring), verify whether click/tap changes state, trace visible element → card/button/input → wrapper/carousel/sheet/dialog → state setter, and check recent component commits with `git log --follow` or focused `git show`. Only move into providers, query hooks, auth, or indexer/data explanations after proving the rendered surface is intact. If text/data exists in the DOM but the control is collapsed, invisible, untappable, or lacks selected visual state, treat it as a component/CSS regression until browser or DOM evidence proves otherwise.

**Research, Plan, Implement**: For ambiguous, multi-package, or high-risk work, research first, record evidence, plan the smallest implementation path, surface human judgment points, then edit. If the session goes down the wrong path, summarize only the useful findings and restart with clean context instead of carrying contaminated assumptions forward.

**Subagent Discipline**: Spawn teammates when tasks can run in parallel, require isolated context, or involve independent workstreams. Work directly (no subagent) for single-file edits, sequential operations, tasks sharing state across steps, or any task needing fewer than 10 tool calls. Prefer the simplest approach that completes the task.

## Design System

Full skills: `design` (direction) + `ui` (implementation). Load explicitly when paradigm, layout composition, new view, tokens, or PR review is at stake. For trivial edits (padding, copy, a single component touch), the rules below are sufficient.

**Language**: Warm Earth — M3 Expressive × Liquid Glass. Canonical spec: `.claude/skills/design/language.md`. Scannable cheat sheet: `.claude/skills/design/quick-reference.md`. Ecosystem map: `.claude/skills/design/ARCHITECTURE.md`.

**Surface identities (never mix)**:
- **Admin** (`packages/admin`) — restrained operator cockpit. M3 strict anatomy (v0.192), Plus Jakarta Sans, glass only on the admin `AppBar`, solid surfaces everywhere else. Use `Admin*` wrappers. Litmus: appropriate for Linear / GitHub / Stripe Dashboard?
- **Client PWA** (`packages/client`) — warm garden-journal feel. Full Warm Earth expression. Inter typography. Bottom `AppBar` (installed PWA) / `SiteHeader` hamburger (browser). Hero moments live here, never in admin.
- **Shared** (`packages/shared`) — primitives + tokens in `src/styles/theme.css`. All React hooks live here (`@green-goods/shared`).

**Tokens**: Never hardcode `cubic-bezier`, `duration`, or raw color/radius values. Use `--spring-*` (6 motion tokens), `--color-*`, `--radius-*`, `--color-material-*` + `--blur-material-*`. Concentricity rule: `child_radius = parent_radius − padding`.

**4-role volume hierarchy**: canvas 80–90% / ink 8–15% / stone 3–5% / accent green 1–3%. Flooding the screen with green is the #1 failure mode. Codebase token `--color-primary` resolves to the **tertiary accent** role — do not rename.

**Banned vocabulary** (enforced by `bun run lint:vocab` on i18n strings; canonical source: [`docs/docs/reference/glossary-community.md § Banned Vocabulary`](docs/docs/reference/glossary-community.md), machine-readable sidecar: [`docs/docs/reference/banned-vocabulary.json`](docs/docs/reference/banned-vocabulary.json)):
- Any surface: `streak`, `countdown`, `leaderboard`, `FOMO`, growth-hacking language (`urgent`, `limited time`, `re-engagement`, `retention hook`).
- Admin only: `hero moment`, `gallery`, `decorative gradient`, `marketing banner`, glass outside the admin `AppBar`.
- Client only: `operator cockpit`, `utility copy`, `KPI tile`, `dashboard`, `Plus Jakarta Sans`.

**Component palettes** (do not invent component names — flag missing primitives instead):
- Admin: 13 `Admin*` wrappers + `CanvasLayout` / `AppBar` / `MainSheet` / `LeftSheet` / `RightSheet` / `BottomSheet` / `NavigationBar` / `AdminFab`. Full list: `.claude/skills/design/prompt-contract.md § Canonical Component Palette`.
- Client: `@green-goods/shared` primitives + `PlatformRouter` / `SiteHeader` / `AppBar`. Full list: `.claude/skills/design/client-prompt-contract.md § Canonical Component Palette`.

**Validation**: `bun run check:design-tokens` (spec ↔ theme.css drift + version coupling) · `bun run lint:vocab` (banned terms).

**PR review**: 4-lens checklist at `.claude/skills/design/review-checklist.md` — Regenerative → Spatial → Ecosystem → Compliance. Quick pass = Lenses 1 + 4. Full pass (new view) = all four.

**Admin UI defect resolution**: When the user reports anything off on an admin surface — however casually ("the card on Hub feels tight", "that thing at the top", "the tabs look weird on mobile") — do **not** guess and do **not** ask them to formalize the report. Resolve to a canonical `Admin*` wrapper or canvas region first, then edit. Escalate in order:

1. **Chrome MCP live DOM** — if an admin tab is open (`mcp__claude-in-chrome__tabs_context_mcp`), use `javascript_tool` or `read_page` to read `data-component` / `data-variant` / `data-region` / `data-workspace` on the rendered page. This is the preferred path because the user already runs admin in Brave with Chrome MCP for UI review.
2. **Grep fallback** — `grep -rn 'data-component="AdminX"' packages/admin/src/views/<workspace>/` when the page isn't open or Chrome MCP is unavailable. Map casual terms ("card", "tabs", "search") via the table in the grammar file.
3. **Ask** — only if 1 + 2 don't narrow to a single candidate. Ask in terms the user recognizes (component name + view), never ask them to write the grammar.

Full resolution workflow, casual-term mapping, and defect-type taxonomy: `.claude/skills/design/defect-grammar.md`. Ground every edit with an internal `<Component> in <route/region> → <defect-type>: <expected> vs <actual>` statement — user never has to write it.

## Known Gotchas

**Tailwind v4 does not scan `packages/shared/src/` from admin/client builds.** Utility classes (`mx-4`, `w-max`, `self-center`, `justify-self-center`) added directly to JSX in shared components silently fail to generate in the consuming app. Symptom: layout looks right in Storybook (which runs from `packages/shared`) but breaks in admin/client (off-center, missing padding, wrong width). There is no `tailwind.config.*` file and no `@source` directive — Vite uses `@tailwindcss/vite` with default content scanning per package.

Proven workarounds in this repo (do **not** chase a Vite/Tailwind config fix — none has been wired up and none has worked):
- **Inline styles for layout in shared components** — see `packages/shared/src/components/Canvas/MainSheet.tsx` (`width: min(calc(100% - 2rem), 1400px); justify-self: center`), commit `374508db`
- **CSS overrides in the consuming package** — admin restates `width: max-content` in `packages/admin/src/styles/admin-m3-overrides.css` rather than relying on shared's `w-max` utility, commit `bba06573`
- **Apply utility classes in the consumer's JSX, not in shared** — when the class needs to come from Tailwind, put it on the wrapper in admin/client where the content scan reaches it

When you see a layout bug that "looks like" a missing class, first check: was the class authored in `packages/shared/src/`? If yes, this gotcha is the likely cause.

## Contract Deployment

```bash
bun script/deploy.ts core --network sepolia              # Dry run
bun script/deploy.ts core --network sepolia --broadcast   # Deploy
bun script/deploy.ts core --network sepolia --broadcast --update-schemas  # Deploy + schemas
```

**Deployment artifacts**: `deployments/{chainId}-latest.json` is the source of truth for all addresses. For new contract work before broadcast, zero or missing addresses usually mean **pending broadcast**; review the deploy command, dry-run, artifact persistence, and dependent config update path instead of treating the address absence itself as a P0. After a claimed or authorized broadcast, required zero/missing addresses, schema UIDs, or indexer addresses are **post-broadcast blockers**.

## Environment

Single `.env` at root (never create package-specific .env). `VITE_CHAIN_ID` sets target chain at build time. `.env.schema` defines the contract.

**Env loading**: `.env` is materialized from `.env.template` via `bun run env:sync` (runs `op inject`). Bun, Vite, and Node read `.env` natively — no per-command 1Password fetch. For shared team secrets, edit `.env.template` and use `op://Vault/Item/field` refs. For personal local credentials, edit `.env` directly. Validate with `bun run env:check`.

**Chain selection**: `VITE_CHAIN_ID` is required for predictable behavior. Without it, `FALLBACK_CHAIN_ID` in `packages/shared/src/config/blockchain.ts` decides — currently `42161` (Arbitrum mainnet, real funds). The client logs a `[blockchain]` warning at module init when fallback is used; `bun run dev:doctor -- --profile web` flags the same gap. Common values: `42161` Arbitrum, `11155111` Sepolia, `42220` Celo.

## Local services (PM2)

`bun run dev` (full), `bun run dev:web` (web), `bun run dev:full`, and `bun run dev <app...>` (custom subset, e.g. `bun run dev client admin tunnel`) start services via PM2 (`ecosystem.config.cjs`). When the stack is up, `[stack] all N services ready in Xs` is printed once every port-binding service responds. Canonical service → port mapping:

- **client** — `https://localhost:3001/` (HTTPS in dev; not HTTP)
- **admin** — `https://localhost:3002/`
- **docs** — `http://localhost:3003/`
- **storybook** — `http://localhost:6006/`
- **indexer GraphQL** — `http://localhost:8080/v1/graphql` (requires Docker stack up)
- **indexer postgres** — `localhost:5433`
- **envio indexer runtime** — `localhost:9898`

Use `npx pm2 list` to see live status, `npx pm2 logs <name> --nostream` to inspect a single service. The full-stack indexer requires Docker — without it, `/api/graphql` proxy returns no data and PWA pages render empty states.

**Indexer hot-reload (Docker)**: the PM2 `indexer` app runs `docker compose -f docker-compose.indexer.yaml up --build --watch`. The compose file declares `develop.watch` rules so edits to `packages/indexer/src/**` and `config.yaml` sync into the container and trigger a fast envio restart (~1-2s); `schema.graphql`, `Dockerfile`, and `package.json` changes trigger a full image rebuild. Test handler files (`*.test.ts`, `__tests__/**`) are excluded from the sync. If the watch loop misbehaves, `bun run dev:indexer` runs the native `envio dev` path (faster but can hit the macOS `system-configuration` crate panic in older Rust toolchains).

**Tunnel for mobile QA**: PM2's `tunnel` app spawns one `cloudflared` tunnel per port — by default both client (3001) and admin (3002) — and writes per-port URL files (`.tunnel-url` for client, `.tunnel-url-admin` for admin). Each Vite dev server exposes its tunnel URL at `/__dev/tunnel` for the in-page QR overlay, so admin reviews work on real devices the same way client PWA reviews do. Standalone single-port use still works: `bun run dev:tunnel -- --port 3001`.

**Client presentation mode (PWA vs website)**: the client renders different chrome depending on whether it's running as an installed PWA or a regular browser tab — bottom `AppBar` + `/home` entry for PWA, hamburger `SiteHeader` + `/` entry for website. On localhost, append `?presentation=pwa`, `?presentation=website`, or `?presentation=auto` to override the auto-detected mode; the choice is cached in **per-tab** sessionStorage so each tab keeps its own mode after redirects. The dev stack opens both modes in adjacent tabs by default. Source: `packages/shared/src/utils/app/pwa.ts:getClientPresentationMode`.

## Scope Discipline
- When instructions say "output in chat" or "just tell me", do NOT edit files
- For destructive changes (removing sections, replacing pages, merging content): list what will be REMOVED and ADDED, then wait for confirmation
- Never replace content that was asked to be added as new
- When unsure about scope, ask — the cost of a clarifying question is far less than a wrong edit

## Multi-Agent Repo Safety

This repo runs multiple concurrent Claude/Codex sessions on the same tree and `develop`. Treat working-tree changes you didn't author this session as another agent's work-in-progress.

- **Stash unknown diffs, don't revert.** `git stash push -u -m "..."` is recoverable; `git checkout HEAD --`, `rm -rf`, and `git reset --hard` are not.
- **Investigate before destroying.** `git for-each-ref --sort=-committerdate refs/heads/ | head -10`, `ls ~/.codex/worktrees/`, and `git log -3 -- <file>` show what other agents are doing.
- **Bulk destructive ops always need fresh user OK in the current turn** — multi-file `git checkout HEAD --`, `rm -rf` of `.plans/`/`packages/`/`docs/`, `git add -A`/`git add .`, `git push --force`.
- **When dispatching a sub-agent**, tell them this repo runs concurrent agents and they must stay in the paths listed in their handoff. Surface unexpected state in their report instead of "fixing" it.
- **Pattern-matching is the trap.** A wider-than-expected diff after a sub-agent run is often parallel agents' work, not the dispatched agent's scope creep. Verify before assuming.

## Git Workflow

**Branches**: `type/description` (e.g., `feature/hats-v2`, `bug/admin-fix`)

**Commits**: Conventional Commits with scope: `type(scope): description`
- Types: feat, fix, refactor, chore, docs, test, perf, ci
- Scopes: contracts, indexer, shared, client, admin, agent, claude

**Validation before committing**: `bun format && bun lint && bun run test && bun build`

## Codex Dispatch

Codex CLI ships inside the Mac app — there is no globally installed `codex` binary. Use the absolute path:

```bash
CODEX=/Applications/Codex.app/Contents/Resources/codex
```

Common invocations:
- Non-interactive review of the current branch's uncommitted diff: `"$CODEX" exec review --uncommitted - < /path/to/prompt.md`
- Non-interactive task: `"$CODEX" exec --full-auto -C <worktree> -o <result-file> "<prompt>"`
- Review a specific commit: `"$CODEX" exec review --commit <sha> "<prompt>"`

Don't reach for `which codex` or attempt to install it globally — the app-bundled binary is the canonical CLI on this machine. Worktree + dispatch protocol details live in the memory note `feedback_claude_orchestrated_codex.md`.

## Drift Cleanup Ritual

When the working tree is heavy (changes spanning packages, drift across docs/code/tests, "feels off"), don't pile broad sweeps on top of unaudited changes. Run in this order:

1. **`/audit-then-ship`** — surgical pass with a built-in scope-lock gate. Phase 1 picks a lens (audit/review/principles/architecture/design) and produces numbered findings; Phase 2 you pick which to fix; Phase 3 fixes only those; Phase 4 ships. The Phase 2 gate is the pause between investigation and action — that's the feedback checkpoint.
2. **`/clean`** — broad 8-subagent sweep (dedup, dead code, type strengthening, defensive code, legacy, AI slop). Run only after `/audit-then-ship` clears the surgical drift, because its scope isn't number-pickable and would otherwise muddy a review.
3. **`/simplify`** — focused refinement of recently changed code. Skip if `/clean` already touched the same surface.
4. **`/ship`** — final gate. Already runs at the end of `/audit-then-ship`; re-run here only if `/clean` or `/simplify` modified anything afterward.

Skip the ritual entirely for: single-file edits, doc-only changes, bug fixes with a known fix path. It's earned only by multi-issue, ambiguous-scope, cross-package work.

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

## Scripts

A script earns a place in `scripts/` only if it has a durable caller:

1. Wired into root `package.json` (a `bun run X` someone will type), or
2. Called by a `.github/workflows/*.yml`, or
3. Referenced by `ecosystem.config.cjs` (PM2), or
4. Invoked by a Claude skill or planning harness (`.claude/**`, `.plans/_automation/**`).

If a new script doesn't fit any of those, it doesn't belong here.

- One-shot ops (single-deploy fixes, batch migrations, ad-hoc audits) live in `.plans/<feature>/` or get deleted after use — not in `scripts/`.
- Every new script in `scripts/` gets a one-line entry in [`scripts/README.md`](scripts/README.md) (under the right caller-bucket), in the same PR.
- Don't create a script when a `package.json` script + an existing CLI already does the job.
- Data files (baselines, fixtures consumed by scripts) belong in `scripts/data/`, not at the root of `scripts/`.

## Cleanup

If you create temporary files, scripts, or helpers during iteration, remove them before reporting task completion.
