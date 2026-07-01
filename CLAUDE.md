# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Commands

```bash
npm run setup                # First-clone setup bridge before Bun is available
bun run setup                # Setup after Bun is available
bun run dev:doctor -- --profile web   # Non-mutating local environment readiness check
bun run dev                  # Start the full local environment with the repo-native PM2 stack
bun run dev:health           # Check readiness for the full local environment
bun run dev:smoke:full       # Read-only full-local smoke: browser, agent, indexer, Postgres, Anvil fork
bun run dev:prod             # Start local browser surfaces against production Arbitrum/indexer/agent APIs
bun run dev:prod:health      # Check prerequisites for hosted production-backed local mode
bun run dev:prod:mirror      # Start production-backed browser surfaces plus local live-indexer mirror
bun run dev:prod:mirror:health # Check prerequisites for production mirror mode
bun run dev:prod:smoke       # Read-only prod smoke: local surfaces, RPC, bytecode, agent, indexer lag
bun run dev:stop             # Stop repo-owned Green Goods dev services
bun run dev:web              # Start client, admin, docs, Storybook, browser helper, and tunnel
bun run dev:smoke:web        # Check web doctor plus client/admin/docs health
bun run dev:full             # Start all PM2 services
bun run dev:stack:stop       # Stop all PM2 services
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

## Validation Intent Ladder

Use the lightest honest proof for the user's intent. QA fixes, checkpoint
validation, and merge readiness are different modes.

- **QA Speed Mode**: default for "QA mode", "quick fix", "get this to staging", and small visible/content/control fixes. Run targeted test file(s) or the package-local command that proves the touched behavior. Add package-local typecheck/build only when route wiring, render/build output, exported types, or runtime contracts move. For visible UI, use authenticated Brave rendered proof when available; if that path is unavailable, report browser QA as blocked rather than replacing it with isolated Playwright. Do not run full `bun run test`, full `bun build`, or `ci-local --quick` just to close an isolated QA fix.
- **Repo Quick Gate**: run `node scripts/dev/ci-local.js --quick` for cross-package/shared-impact changes, after several QA fixes as a coordinator checkpoint, or when shared exports, hook signatures, provider contracts, data shapes, or mutation flows move.
- **Ship Gate**: run `bun format && bun lint && bun run test && bun build` plus conditional design/vocab/contract checks only for explicit ship/PR/commit/merge/release readiness, critical surfaces, or when asked to prove the branch is ready.
- **Multiple agents in QA mode**: each agent runs targeted proof for its own lane; one coordinator runs Repo Quick Gate or Ship Gate at checkpoints before merge/release.

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

- System architecture (diagrams): `docs/docs/builders/architecture.mdx`
- Domain glossary: `docs/docs/reference/glossary-community.md`
- Impact model & Eight Forms of Capital: `docs/docs/reference/design-research.md`
- Action domains, goals & schema registry: `docs/docs/builders/specs/v1-0.mdx`
- Entity matrix: `docs/docs/builders/integrations/entity-matrix.mdx`

Package-specific context files (`.claude/context/*.md`) include additional documentation references relevant to each package.

## Linear Workspace

Linear (workspace `greenpill-dev-guild`) is the durable backlog as of 2026-05-09. GitHub is for PRs and code review only — never open GitHub Issues for backlog work. Routine and label-scheme details: [`docs/routines/README.md`](docs/routines/README.md). Live workspace state (active initiatives, projects, customers, cycle status) — query the Linear MCP at the time you need it; do not hardcode it here, it drifts.

**Teams**: Product (`PRD`) and Research (`RESR`). Their workflow states are asymmetric — Product has `QA` and `Ready` as backlog states (no Triage); Research has a `Triage` state (no QA/Ready). Matters when filtering or transitioning issues.

**Records**: `Customer Need` (raw signal, structured body) → `Issue` (accepted work). `.plans/` remains execution truth for agent implementation; Linear mirrors carry the `source:plans` label.

**Project routing**: new Issues default unprojected on the Product team. Graduate into a bounded active project only when one already exists for the work; never route new work into a project whose status is Completed.

**Canonical label families** (only these): `protocol:* / package:* / activity:* / source:* / agent:* / funding:*`. Retired and not to be reintroduced: `area:*`, `work:*`, `task:*`, `automation:*`, `health:*`, `grant:*`. The `agent:*` family distinguishes `agent:claude` (interactive Claude Code) from `agent:routine` (cron'd routine writes) — they are not synonymous.

**Cloud routines that write Linear** (cron'd at [claude.ai/code/routines](https://claude.ai/code/routines), per-routine docs in [`docs/routines/`](docs/routines/README.md)): `bug-intake`, `health-watch`, `growth-pulse`. **Local skills aware of Linear**: `/audit`, `/clean`, `/principles`, `/plan`, `/debug`, `/drift` — all prompt before creating Linear records.

**Linear MCP** is wired into the Claude Code harness globally (~40 tools). No project `.mcp.json` config needed. Use it for read/query, triage/promote, state transitions, and branch-context loading.

**Privacy boundary** (PostHog evidence in Linear bodies): error message + hash + counts OK; replay URLs, session IDs, distinct IDs, wallet addresses, and reporter identifiers stay out.

## PostHog

PostHog hosts **three separate projects**. The connector defaults to one project at session start (often the wrong one), so every PostHog tool call defaults to silently querying the wrong telemetry — returning zero results without flagging that there's a project mismatch. This has cost real debugging time. **Always call `switch-project` before any PostHog query, every time.**

Inference table (pick the project based on what surface the issue lives in):

| Surface in the bug report | Project | ID | When to pick |
|---|---|---|---|
| PWA, installed app, client, website, editorial, `/home/*`, `/gardens`, `/actions`, `/fund`, `/impact`, `/cookies`, `/glossary` | **App** | `163591` | Default for end-user / gardener / operator reports. |
| Admin cockpit, `Admin*` components, `Hub`, `MainSheet`, `LeftSheet`, `RightSheet`, `/dashboard`, operator-facing tooling | **Admin** | `262122` | When the user mentions admin routes/components. |
| Telegram bot, WhatsApp, SMS, agent/messaging runtime | **Agent** | `262124` | When the report names a chat channel or `packages/agent/**`. |

Rule, in order:
1. Read the user's report. Classify the surface (App / Admin / Agent). If ambiguous, **ask** before querying.
2. Call `switch-project` with the matching ID.
3. Run the PostHog query.
4. If the first project returns nothing relevant, try the next likely project — do not assume "no data" until you've checked the surface the user actually described.

Authoritative source for these IDs and the surface mapping: [docs/routines/README.md § PostHog projects](docs/routines/README.md). Curated-question library + privacy boundaries: [.claude/skills/posthog-questions/SKILL.md](.claude/skills/posthog-questions/SKILL.md).

## QA Sync Triage

After a build sync QA session (the meeting formerly called product sync), [`/qa-triage`](.claude/skills/qa-triage/SKILL.md) is the interactive path for turning meeting notes into Linear records + QA-sheet rows. It pulls the latest Gemini notes from Drive (with `~/Downloads` fallback), cross-references each item against PostHog telemetry per surface, gates the triage with a scope lock, and writes Customer Needs/Issues plus appends to the **Green Goods v1.1 QA** Sheet. The companion cron'd routine [`qa-triage-pulse`](docs/routines/qa-triage-pulse.md) pre-stages Customer Needs every Wednesday after the 10am PST build sync, so `/qa-triage` can resume from the pre-staged set rather than re-extracting.

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

**Verify Before Claiming Success**: Before reporting that a fix works, a setting takes effect, or a behavior holds, produce evidence in the same turn — the command output, the passing test, the rendered DOM through the authenticated Brave QA profile, the re-read file showing the change. "Should work", "probably fixed", and unrun commands are not evidence. If a CLI flag is unfamiliar, read `--help` or the source before invoking it; do not invent flags. If you cannot verify (no test, no live DOM, no observable signal), say "I can't verify this without X" and stop rather than declaring success. Untested fixes and hallucinated commands have produced more reverts in this repo than any other failure mode.

**QA Speed Mode**: When the user is actively QAing staging or asks for a small quick fix, prove the narrow behavior first: targeted tests, direct file re-read, and authenticated rendered proof for visible UI. Escalate to Repo Quick Gate or Ship Gate only when the Validation Intent Ladder calls for it. A QA-speed pass is not a merge/release readiness claim.

**User-Observed UI Regression Debugging**: Bug reports trigger the debug skill automatically. When the reported symptom is something the user can see or touch — cannot click, cannot select, missing selected border/state, collapsed or blank cards, invisible content, broken scroll/refresh, visible-but-unusable controls — start from the rendered surface before tracing data flow. First reproduce or simulate the exact visible/clickable symptom with the real component path, inspect DOM geometry and computed styles (bounding rect, width/height, opacity, display, pointer-events, z-index, overflow, disabled state, selected classes, border/ring), verify whether click/tap changes state, trace visible element → card/button/input → wrapper/carousel/sheet/dialog → state setter, and check recent component commits with `git log --follow` or focused `git show`. Only move into providers, query hooks, auth, or indexer/data explanations after proving the rendered surface is intact. If text/data exists in the DOM but the control is collapsed, invisible, untappable, or lacks selected visual state, treat it as a component/CSS regression until browser or DOM evidence proves otherwise.

**Research, Plan, Implement**: For ambiguous, multi-package, or high-risk work, research first, record evidence, plan the smallest implementation path, surface human judgment points, then edit. If the session goes down the wrong path, summarize only the useful findings and restart with clean context instead of carrying contaminated assumptions forward.

**Subagent Discipline**: Spawn teammates when tasks can run in parallel, require isolated context, or involve independent workstreams. Work directly (no subagent) for single-file edits, sequential operations, tasks sharing state across steps, or any task needing fewer than 10 tool calls. Prefer the simplest approach that completes the task.

## Design System

Full skills: `design` (direction) + `ui` (implementation). Load explicitly when paradigm, layout composition, new view, tokens, or PR review is at stake. For trivial edits (padding, copy, a single component touch), the rules below are sufficient.

**Language**: Warm Earth — M3 Expressive × Liquid Glass. Canonical spec: `.claude/skills/design/language.md`. Scannable cheat sheet: `.claude/skills/design/quick-reference.md`. Ecosystem map: `.claude/skills/design/ARCHITECTURE.md`.

**Surface identities (never mix)**:
- **Admin** (`packages/admin`) — restrained operator cockpit. M3 strict anatomy (v0.192), Plus Jakarta Sans, transparent admin `AppBar` root, Controlled Chrome glass only on Navigation/FAB and sheet shells, solid dense surfaces everywhere else. Use `Admin*` wrappers. Litmus: appropriate for Linear / GitHub / Stripe Dashboard?
- **Client PWA** (`packages/client`) — warm garden-journal feel. Full Warm Earth expression. Inter typography. Bottom `AppBar` (installed PWA) / `SiteHeader` hamburger (browser). Hero moments live here, never in admin.
- **Shared** (`packages/shared`) — primitives + tokens in `src/styles/theme.css`. All React hooks live here (`@green-goods/shared`).

**Tokens**: Never hardcode `cubic-bezier`, `duration`, or raw color/radius values. Use `--spring-*` (6 motion tokens), `--color-*`, `--radius-*`, `--color-material-*` + `--blur-material-*`. Concentricity rule: `child_radius = parent_radius − padding`.

**4-role volume hierarchy**: canvas 80–90% / ink 8–15% / stone 3–5% / accent green 1–3%. Flooding the screen with green is the #1 failure mode. Codebase token `--color-primary` resolves to the **tertiary accent** role — do not rename.

**Banned vocabulary** (enforced by `bun run lint:vocab` on i18n strings; canonical source: [`docs/docs/reference/glossary-community.md § Banned Vocabulary`](docs/docs/reference/glossary-community.md), machine-readable sidecar: [`docs/docs/reference/banned-vocabulary.json`](docs/docs/reference/banned-vocabulary.json)):
- Any surface: `streak`, `countdown`, `leaderboard`, `FOMO`, growth-hacking language (`urgent`, `limited time`, `re-engagement`, `retention hook`).
- Admin only: `hero moment`, `gallery`, `decorative gradient`, `marketing banner`, AppBar glass, glass outside Navigation/FAB and sheet shells.
- Client only: `operator cockpit`, `utility copy`, `KPI tile`, `dashboard`, `Plus Jakarta Sans`.

**Component palettes** (do not invent component names — flag missing primitives instead):
- Admin: 13 `Admin*` wrappers + `CanvasLayout` / `AppBar` / `MainSheet` / `LeftSheet` / `RightSheet` / `BottomSheet` / `NavigationBar` / `AdminFab`. Full list: `.claude/skills/design/prompt-contract.md § Canonical Component Palette`.
- Client: `@green-goods/shared` primitives + presentation-mode loaders / `PublicShell` / `PwaRuntime` / `AppShell` / `SiteHeader` / `AppBar`. Full list: `.claude/skills/design/client-prompt-contract.md § Canonical Component Palette`.

**Validation**: `bun run check:design-md` (root + dialect DesignMD lint) · `bun run check:design-generated` (DesignMD generated artifacts) · `bun run check:design-tokens` (spec ↔ theme.css drift + version coupling) · `bun run lint:vocab` (banned terms). When a component, story, or Storybook-covered surface changes, also run `bun run --filter @green-goods/shared check:stories` and `bun run --filter @green-goods/shared check:story-quality`.

**PR review**: 4-lens checklist at `.claude/skills/design/review-checklist.md` — Regenerative → Spatial → Ecosystem → Compliance. Quick pass = Lenses 1 + 4. Full pass (new view) = all four.

## Agentic Modern Web Standard

- Baseline target: Baseline Widely Available. Before frontend, UI, CSS, accessibility, browser proof, or web-design changes, use repo-installed Modern Web Guidance through `bun run agentic:guidance` to search and retrieve current Chrome guidance as documentation/source material only; Green Goods local QA uses the authenticated Brave QA profile, while CI clean-room browser proof uses Brave only as non-authenticated evidence. Then apply Warm Earth and the package-level design rules.
- Prefer semantic HTML, native controls, platform CSS, and browser primitives before custom JavaScript. Keep headings, landmarks, form labels, accessible names, focus order, visible focus, touch targets, loading/error/empty states, and reduced-motion behavior legible to humans, assistive tech, and browser agents.
- Run `bun run agentic:check` as the hard guidance-readiness front door for repo-installed Modern Web Guidance, design docs, token drift, agent guidance, and shared Storybook story quality. For local built-route QA across client, admin, and docs, use the authenticated Brave QA profile through the live authenticated-browser path below. Treat `bun run agentic:verify`, `bun run agentic:browser-proof`, and `bun run lighthouse` as CI/clean-room or code-level proof only unless they attach to authenticated Brave; do not report them as local authenticated verification. `dev-surfaces` remains the cross-repo/global doctor for shared Modern Web Guidance cache refresh, Brave, and MCP readiness.
- Local agentic browser QA must use the authenticated Brave QA profile. Codex: use the Codex browser-extension path and claim the already-open Brave tab/window. Claude Code: use the Claude Code Chrome/Chromium extension path (`claude --chrome` or `/chrome`) and select the authenticated Brave profile/tab when it is installed, connected, and able to control the already-open Brave window. Do not fall back merely because the extension is branded Chrome. If the Brave extension path is unavailable or not connected, use Claude computer-use/visible desktop control of the already-open Brave window; if neither can reach authenticated Brave, report QA as blocked. Use this for admin, PWA, extension, wallet/passkey, staging-session, installed-app, and profile-dependent verification.
- Do not use isolated Browser, Playwright, or DevTools MCP profiles for local QA. Existing isolated browser-proof commands are CI/clean-room checks only and must not be reported as authenticated verification. If authenticated Brave access is blocked, stop and report QA as blocked.
- Brave DevTools MCP is project-configured in `.mcp.json` through `scripts/mcp/brave-devtools.mjs`, but do not use it for local QA, live admin/PWA verification, rendered DOM proof, screenshots, traces, or success claims because it can launch a separate non-authenticated profile. The wrapper calls the upstream `chrome-devtools-mcp` package because that is the protocol package name, but the browser executable must be Brave. It rejects Google Chrome, Chrome for Testing, Chromium, and Edge paths. Use this wrapper only for CI/clean-room public-route checks or explicit non-authenticated protocol debugging, and label any result as non-authenticated evidence. Native WebMCP discovery requires a Brave build that exposes `navigator.modelContext`. WebMCP v1 is implemented only for public-safe client/browser routes via `packages/client/src/modules/webmcp/public-tools.ts`; do not expose secrets, private data, hidden admin actions, onchain writes, destructive operations, or background-only actions as WebMCP tools.

**Admin UI defect resolution**: When the user reports anything off on an admin surface — however casually ("the card on Hub feels tight", "that thing at the top", "the tabs look weird on mobile") — do **not** guess and do **not** ask them to formalize the report. Resolve to a canonical `Admin*` wrapper or canvas region first, then edit. Escalate in order:

1. **Authenticated Brave live DOM** — if an admin tab is open in the authenticated Brave QA profile, use the Codex browser-extension path or the Claude Code Chrome/Chromium extension path (`claude --chrome` or `/chrome`) to read `data-component` / `data-variant` / `data-region` / `data-workspace` on the rendered page when either extension is installed and connected to the authenticated Brave profile/tab. Use Claude computer-use/visible desktop control only when the Brave extension path is unavailable or not connected. This is the preferred path because the user runs admin review in Brave first.
2. **Code fallback** — `rg -n 'data-component="AdminX"' packages/admin/src/views/<workspace>/` when the page is not open or authenticated Brave access is unavailable. Map casual terms ("card", "tabs", "search") via the table in the grammar file. If rendered authenticated proof is required and Brave access is blocked, report QA as blocked rather than switching to an isolated browser.
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

## Local services

`bun run dev` is the canonical full local environment command. It runs the repo-native PM2 stack (`scripts/dev/stack.js full`), starts the Arbitrum fork, client, admin, docs, Storybook, agent, indexer, browser helper, and tunnel helper, streams logs in the foreground, opens the PWA/editorial/admin/docs/Storybook review URLs, and cleans up on Ctrl-C. Use the shared `dev` workbench only for cross-repo orchestration or narrow `project:target` launches.

Run `bun run dev:smoke:full` after `bun run dev` when you need a current proof of the safe full-local stack. It is read-only and verifies both client presentations, admin, docs, Storybook, local agent `/health`, Anvil chain id `42161`, deployed Arbitrum bytecode on the fork, funded Anvil accounts, local Envio/Hasura GraphQL, local indexer service health, and the Postgres TCP listener.

Production-backed local development is explicit: `bun run dev:prod` starts only client, admin, docs, Storybook, and the browser helper against Arbitrum One (`42161`), the hosted production indexer, and `https://agent.greengoods.app`. It must not start local Anvil, local agent, local indexer, or a tunnel; expected ports are `3001`-`3004` only. `bun run dev:prod:mirror` adds the local Docker-backed indexer mirror on `3006`-`3008` while still targeting Arbitrum One. Mirror mode needs `ENVIO_API_TOKEN` for reliable HyperSync catch-up; without it, containers may be healthy while lag proof fails. Wallet-confirmed transactions in both production-backed modes are real Arbitrum writes. The automatic `bun run dev:prod:smoke` is read-only and verifies local surfaces, RPC chain id, deployed bytecode, agent `/health`, indexer GraphQL metadata, and indexer lag. `/ready` on the production agent is stricter than `/health` and may 503 while optional AI/voice readiness is loading.

The repo-native PM2 fallback commands are `bun run dev:web` (web), `bun run dev:full`, `bun run dev:stack`, and `bun run dev:stack:stop`. Use those only for focused PM2 debugging. Canonical service → port mapping:

- **client** — `https://localhost:3001/` (HTTPS in dev; not HTTP)
- **admin** — `https://localhost:3002/`
- **docs** — `http://localhost:3003/`
- **storybook** — `http://localhost:3004/`
- **indexer GraphQL** — `http://localhost:3006/v1/graphql` (requires Docker stack up)
- **indexer postgres** — `localhost:3008`
- **envio indexer runtime** — `http://localhost:3007/`

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

- **Stay on the current branch unless explicitly told otherwise.** Do not create or switch branches unless the user asks for that branch action in the current turn; branch changes can confuse other agents and put their work on the wrong branch.
- **Stash unknown diffs, don't revert.** `git stash push -u -m "..."` is recoverable; `git checkout HEAD --`, `rm -rf`, and `git reset --hard` are not.
- **Investigate before destroying.** `git for-each-ref --sort=-committerdate refs/heads/ | head -10`, `ls ~/.codex/worktrees/`, and `git log -3 -- <file>` show what other agents are doing.
- **Bulk destructive ops always need fresh user OK in the current turn** — multi-file `git checkout HEAD --`, `rm -rf` of `.plans/`/`packages/`/`docs/`, `git add -A`/`git add .`, `git push --force`.
- **When dispatching a sub-agent**, tell them this repo runs concurrent agents and they must stay in the paths listed in their handoff. Surface unexpected state in their report instead of "fixing" it.
- **For QA-mode sub-agents**, require targeted proof for the assigned lane and leave broad validation to the coordinating checkpoint unless the assignment explicitly asks for a wider gate.
- **Pattern-matching is the trap.** A wider-than-expected diff after a sub-agent run is often parallel agents' work, not the dispatched agent's scope creep. Verify before assuming.

## Git Workflow

**Branches**: `type/description` (e.g., `feature/hats-v2`, `bug/admin-fix`)

**Commits**: Conventional Commits with scope: `type(scope): description`
- Types: feat, fix, refactor, chore, docs, test, perf, ci
- Scopes: contracts, indexer, shared, client, admin, agent, claude

**Validation before committing**: `bun format && bun lint && bun run test && bun build`. This is the Ship Gate, not the default loop for every QA-speed fix.

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

1. **`/drift`** — read-only classifier for guidance, plan, design, docs, quality, and cleanup drift. It routes findings before anything mutates.
2. **`/audit-then-ship`** — surgical pass with a built-in scope-lock gate. Phase 1 picks a lens (audit/review/principles/architecture/design) and produces numbered findings; Phase 2 you pick which to fix; Phase 3 fixes only those; Phase 4 ships. The Phase 2 gate is the pause between investigation and action — that's the feedback checkpoint.
3. **`/clean`** — broad 8-subagent sweep (dedup, dead code, type strengthening, defensive code, legacy, AI slop). Run only after `/drift` or `/audit-then-ship` proves cleanup is the right tool, because its scope isn't number-pickable and would otherwise muddy a review.
4. **`/simplify`** — focused refinement of recently changed code. Skip if `/clean` already touched the same surface.
5. **`/ship`** — final gate. Already runs at the end of `/audit-then-ship`; re-run here only if `/clean` or `/simplify` modified anything afterward.

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

## Supply-chain and agent safety

- Do not install or upgrade npm, Python, or package-manager dependencies unless the user explicitly approves that install in the current task.
- Prefer existing repo tooling, checked-in lockfiles, and standard library options over adding new packages.
- Treat `package.json`, lockfiles, package-manager config, `.github/workflows/**`, `AGENTS.md`, `CLAUDE.md`, `.codex/**`, and `.claude/**` as security-sensitive surfaces. Call out any changes to them in final summaries.
- Keep dependency installs on the checked-in lockfile path and preserve the repo's release-age gate configuration.
