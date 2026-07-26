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
bun run dev:prod:smoke       # Read-only prod smoke: local surfaces, RPC, bytecode, agent, indexer lag
bun run dev:stop             # Stop repo-owned Green Goods dev services
bun format && bun lint       # Format and lint workspace
bun run check:source-structure # Check changed non-test package source structure
bun run test                 # Run all tests (CRITICAL: not `bun test`)
bun run test:fast            # Same scope, cache-aware via Turborepo (skips packages with unchanged inputs)
bun run test:fast:force      # Same as test:fast but bypasses cache (use when debugging a stale cache hit)
bun run eval:skills          # On-demand skill description-routing eval (run after trigger edits)
bun build                    # Build everything (respects dependency order)
```

> **`bun test` vs `bun run test`**: `bun test` uses bun's built-in runner (ignores vitest config). `bun run test` runs the package.json script (vitest with proper environment). Always use `bun run test`.

> **`test` vs `test:fast`**: `bun run test` always runs every package via `bun --filter`. `bun run test:fast` runs the same scope through Turborepo, which caches passing test runs by input hash. Cache invalidates automatically when a package's source, its workspace dependencies' source (shared/contracts), `.env`, `biome.json`, or root tsconfigs change. **Failing tests are never cached** — fix the test, not the cache. To force a fresh run, use `bun run test:fast:force` or `rm -rf .turbo`.

Per-package: `bun run test`, `bun build`, `bun lint` (check each package.json for available scripts). Secondary dev commands (`dev:web`, `dev:full`, `dev:prod:mirror`, PM2 fallbacks) are catalogued in [`scripts/README.md`](scripts/README.md).

**Contracts** (never use raw `forge` commands): `bun build` (adaptive changed-target compile), `bun build:changed` (changed Solidity only), `bun build:target -- src/...` (single-target compile), `bun build:full` (CI/deploy only), `bun run test:fork` (needs RPC URLs). Use `script/deploy.ts` for initial deployments and `script/upgrade.ts` for named UUPS upgrades; do not use `deploy.ts --force` as an upgrade or rollback path. For Arbitrum deploy/upgrade operations, use the named root `contracts:*` scripts; they set `FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer`, clear unrelated Pinata upload secret resolution, and encode the current proxy-owner sender where required.

## Validation Intent Ladder

Use the lightest honest proof for the user's intent. QA fixes, checkpoint
validation, and merge readiness are different modes.

- **QA Speed Mode**: default for "QA mode", "quick fix", "get this to staging", and small visible/content/control fixes. Run targeted test file(s) or the package-local command that proves the touched behavior. Add package-local typecheck/build only when route wiring, render/build output, exported types, or runtime contracts move. For visible UI, use authenticated Brave rendered proof when available; if that path is unavailable, report browser QA as blocked rather than replacing it with isolated Playwright. Do not run full `bun run test`, full `bun build`, or `ci-local --quick` just to close an isolated QA fix.
- **Repo Quick Gate**: run `node scripts/dev/ci-local.js --quick` for cross-package/shared-impact changes, after several QA fixes as a coordinator checkpoint, or when shared exports, hook signatures, provider contracts, data shapes, or mutation flows move.
- **Ship Gate**: run `bun format && bun lint && bun run test && bun build` plus conditional design/vocab/contract checks only for explicit ship/PR/commit/merge/release readiness, critical surfaces, or when asked to prove the branch is ready.
- **Multiple agents in QA mode**: each agent runs targeted proof for its own lane; one coordinator runs Repo Quick Gate or Ship Gate at checkpoints before merge/release.

Command definitions for every rung: [`.claude/context/validation-pipeline.md`](.claude/context/validation-pipeline.md).

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

- **`critical`** — `packages/contracts/src/**` · `packages/shared/src/providers/{Auth,JobQueue,Work}.tsx` · `packages/shared/src/modules/job-queue/**` · `packages/shared/src/hooks/{auth,work,vault,blockchain}/**`. Read every touched line, apply `/review`'s matching critical-surface lens (`contracts-security` or `mutation-reliability`), and never accept log-only failure handling.
- **`sensitive`** — `packages/agent/src/**` · admin workflow state surfaces · client journey views. Keep the diff bounded, inspect failure and recovery states explicitly, run the lightest targeted validation that proves the user-facing path still works.
- **`routine`** — docs · automation prompts · stories · cleanup-only changes · test-only refactors with no runtime change. Lightest honest check; don't escalate the review footprint unless runtime behavior changes.

### Plan Location
Feature plans live in `.plans/{ideas|backlog|active|archive}/<feature-slug>/` hubs (`plan.todo.md` + `status.json`); the `plan` skill owns the lifecycle.

### Build Order
1. **contracts** -> ABIs for other packages
2. **shared** -> hooks/modules for frontends
3. **indexer** -> needs contract ABIs
4. **client/admin/agent** -> need shared package

## Documentation

The `docs/` directory contains a Docusaurus site with product documentation, user guides, and developer references. When investigating domain questions, architecture decisions, or user-facing behavior, consult:

- System architecture (diagrams): `docs/docs/builders/architecture.mdx`
- Domain glossary: `docs/docs/reference/glossary-community.md`
- Canonical machine-readable ontology (entities, vocabularies, EAS schemas, constraints, state machines; CI-gated by `bun run check:ontology`, update protocol in `.claude/context/ontology.md`): `packages/shared/src/ontology/green-goods-ontology.json` → generated reference `docs/docs/reference/ontology.generated.mdx`
- Impact model & Eight Forms of Capital: `docs/docs/reference/design-research.md`
- Action domains, goals & schema registry: `docs/docs/builders/specs/v1-0.mdx`
- Entity matrix (generated from the ontology sidecar via `bun run ontology:generate`; unlisted — cells stay a draft vocabulary aid until each integration ships, not a canonical contract): `docs/docs/builders/integrations/entity-matrix.mdx`

Per-package invariants live in `.claude/context/*.md`. Path-scoped rules in `.claude/rules/*.md` auto-load by file glob (typescript, react-patterns, frontend-design, contracts, indexer) and point at their fuller context files.

## Linear Workspace

Linear (workspace `greenpill-dev-guild`) is the durable backlog as of 2026-05-09. GitHub is for PRs and code review only — never open GitHub Issues for backlog work. Routine and label-scheme details: [`docs/routines/README.md`](docs/routines/README.md). Live workspace state (active initiatives, projects, customers, cycle status) — query the Linear MCP at the time you need it; do not hardcode it here, it drifts.

**Teams**: five as of 2026-07-14 — Product (`PRD`), Research (`RESR`), Community (`COM`), Growth (`GROW`), Marketing (`MAR`). Green Goods routines and skills write only to **Product**. States: PRD and RESR have `Triage`; COM/GROW/MAR use the standard set without it; the old Product `QA`/`Ready` states are retired (QA proof lives in `In Review` + acceptance rules). The funding pipeline (`funding:*`) lives on GROW; marketing/creative briefs on MAR; cohort/community work on COM. Team charters: [`greenpill-dev-guild/.github` → `docs/teams/`](https://github.com/greenpill-dev-guild/.github/tree/main/docs/teams).

**Records**: `Customer Need` (raw signal, structured body) → `Issue` (accepted work). `.plans/` remains execution truth for agent implementation; Linear mirrors carry the `source:plans` label.

**Project routing**: new Issues default unprojected on the Product team. Graduate into a bounded active project only when one already exists for the work; never route new work into a project whose status is Completed.

**Canonical label families** (only these): `protocol:* / package:* / activity:* / source:* / agent:* / funding:*`. Retired and not to be reintroduced: `area:*`, `work:*`, `task:*`, `automation:*`, `health:*`, `grant:*`. The `agent:*` family distinguishes `agent:claude` (interactive Claude Code), `agent:codex` (Codex), and `agent:routine` (cron'd routine writes) — they are not synonymous.

**Cloud routines that write Linear** (cron'd at [claude.ai/code/routines](https://claude.ai/code/routines), per-routine docs in [`docs/routines/`](docs/routines/README.md)): `bug-intake`, `health-watch`, `growth-pulse`. **Local skills aware of Linear**: `/audit`, `/clean`, `/review`, plus the passive `plan` and `debug` skills — all prompt before creating Linear records (shared contract: `.claude/context/linear-routing-rules.md`).

**Linear MCP** is wired into the Claude Code harness globally (~40 tools). Use it for read/query, triage/promote, state transitions, and branch-context loading.

**Privacy boundary** (PostHog evidence in Linear bodies): error message + hash + counts OK; replay URLs, session IDs, distinct IDs, wallet addresses, and reporter identifiers stay out.

**QA sync triage**: after a build sync QA session (formerly "product sync"), [`/qa-triage`](.claude/skills/qa-triage/SKILL.md) turns the meeting notes into Linear records + QA-sheet rows; the cron'd [`qa-triage-pulse`](docs/routines/qa-triage-pulse.md) pre-stages Customer Needs every Wednesday so `/qa-triage` can resume from them.

## PostHog

PostHog hosts **three separate projects**, and the connector defaults to one at session start — often the wrong one, silently returning zero results. This has cost real debugging time. **Always call `switch-project` before any PostHog query, every time.**

| Surface in the bug report | Project | ID | When to pick |
|---|---|---|---|
| PWA, installed app, client, website, editorial, `/home/*`, `/gardens`, `/actions`, `/fund`, `/impact`, `/cookies`, `/glossary` | **App** | `163591` | Default for end-user / gardener / operator reports. |
| Admin cockpit, `Admin*` components, `Hub`, `MainSheet`, `/dashboard`, operator-facing tooling | **Admin** | `262122` | When the user mentions admin routes/components. |
| Telegram bot, WhatsApp, SMS, agent/messaging runtime | **Agent** | `262124` | When the report names a chat channel or `packages/agent/**`. |

Classify the surface (ask if ambiguous) → `switch-project` → query; if the first project returns nothing relevant, try the next likely one before concluding "no data". Authoritative IDs + surface mapping: [docs/routines/README.md § PostHog projects](docs/routines/README.md). Curated-question library + privacy boundaries: [docs/routines/posthog-questions.md](docs/routines/posthog-questions.md).

## Key Patterns

**Implementation Quality**: Apply [the Implementation Quality Contract](.claude/context/values.md#implementation-quality-contract) before and after production-code edits. It is the canonical DRY/KISS/YAGNI/SLAP, cohesion, pattern-selection, and clean-comment contract; do not duplicate a larger textbook checklist in domain skills.

**Hook Boundary**: ALL hooks in `@green-goods/shared`. Client/admin only have components and views.
```typescript
import { useAuth, useGardens } from '@green-goods/shared'; // correct
```

**Contract Integration**: Import deployment artifacts, never hardcode addresses.
```typescript
import deployment from '../../../contracts/deployments/11155111-latest.json';
```

**Shared Imports**: Import only from public paths declared in `packages/shared/package.json#exports`. Prefer the narrowest declared public subpath when it avoids unrelated runtime coupling; never import `@green-goods/shared/src/**` or another undeclared internal path.

**Type System**: Domain types (`Garden`, `Work`, `Action`, `Address`) live in `@green-goods/shared`. Use `Address` type (not `string`) for Ethereum addresses.

**Error Handling**: Never swallow errors. Use `parseContractError()` + `USER_FRIENDLY_ERRORS` for contract errors. Use `createMutationErrorHandler()` in shared mutation hooks. Use `logger` from shared (not `console.log`).

**Query Keys**: Use `queryKeys.*` helpers from shared. Serialize objects in query keys.

**Indexer Boundary**: Envio indexes only Green Goods core state (actions, gardens, hats role membership, vault history, yield split history, minimal hypercert linkage/claims). Do not re-index EAS attestations, Gardens V2 community/pools, marketplace, ENS lifecycle, cookie jars, or Hypercert display metadata.

**Investigate Before Answering**: Never speculate about code you have not opened. If referencing a specific file, you MUST read it before answering. Give grounded, hallucination-free answers based on actual file contents, not assumptions about what code might look like.

**Verify Before Claiming Success**: Before reporting that a fix works, a setting takes effect, or a behavior holds, produce evidence in the same turn — the command output, the passing test, the rendered DOM through the authenticated Brave QA profile, the re-read file showing the change. "Should work", "probably fixed", and unrun commands are not evidence. If a CLI flag is unfamiliar, read `--help` or the source before invoking it; do not invent flags. If you cannot verify (no test, no live DOM, no observable signal), say "I can't verify this without X" and stop rather than declaring success. Untested fixes and hallucinated commands have produced more reverts in this repo than any other failure mode.

**User-Observed UI Regression Debugging**: Bug reports trigger the debug skill automatically. When the symptom is something the user can see or touch, start from the rendered surface (DOM geometry, computed styles, interaction state) before tracing providers, queries, auth, or indexer data — full protocol in the `debug` skill. Rendered-but-unusable is a component/CSS regression until DOM evidence proves otherwise.

**Research, Plan, Implement**: For ambiguous, multi-package, or high-risk work, research first, record evidence, plan the smallest implementation path, surface human judgment points, then edit. If the session goes down the wrong path, summarize only the useful findings and restart with clean context instead of carrying contaminated assumptions forward.

**Subagent Discipline**: Spawn teammates when tasks can run in parallel, require isolated context, or involve independent workstreams. Work directly for single-file edits, sequential operations, tasks sharing state across steps, or any task needing fewer than 10 tool calls. Prefer the simplest approach that completes the task.

Frontend runtime patterns (feature availability via `isGreenWillDeployed`, localStorage-backed optimistic memos, CI mock auth) live in `.claude/context/shared.md` and `.claude/context/testing.md`.

## Design System

Full skill: `design` (direction; `design/implementation.md` for build guidance — dialogs, runbook, Storybook, i18n). Load explicitly when paradigm, layout composition, a new view, tokens, or PR review is at stake. Canonical spec: `.claude/skills/design/language.md` · index: `.claude/skills/design/quick-reference.md` · map: `.claude/skills/design/ARCHITECTURE.md`.

**Surface identities (never mix)**: **Admin** = restrained operator cockpit — strict M3 anatomy, Plus Jakarta Sans, `Admin*` wrappers; litmus: appropriate for Linear / GitHub / Stripe Dashboard? **Client PWA** = warm garden-journal — full Warm Earth expression, Inter, hero moments live here and never in admin. **Shared** = primitives + tokens in `src/styles/theme.css`; all React hooks live here.

**Tokens**: never hardcode `cubic-bezier`, `duration`, or raw color/radius values — use `--spring-*`, `--color-*`, `--radius-*`, `--color-material-*` + `--blur-material-*`. Concentricity: `child_radius = parent_radius − padding`. 4-role volume hierarchy (canvas / ink / stone / accent green) — flooding the screen with green is the #1 failure mode; `--color-primary` resolves to the **tertiary accent** role, do not rename. (Deliberate one-line copies; canonical spec: `language.md`.)

**Vocabulary + palettes**: banned vocabulary is canonical in [`docs/docs/reference/glossary-community.md § Banned Vocabulary`](docs/docs/reference/glossary-community.md) (+ machine-readable [`banned-vocabulary.json`](docs/docs/reference/banned-vocabulary.json); `bun run lint:vocab` enforces the i18n terms). Component palettes: admin `.claude/skills/design/prompt-contract.md § Canonical Component Palette`, client `.claude/skills/design/client-prompt-contract.md § Canonical Component Palette` — do not invent component names; flag missing primitives.

**Validation**: `bun run check:design-md` · `check:design-generated` · `check:design-tokens` · `lint:vocab`; story-touching changes also run shared `check:stories` + `check:story-quality`. PR review: 4-lens checklist at `.claude/skills/design/review-checklist.md` (quick pass = Lenses 1 + 4; new view = all four).

## Agentic Modern Web Standard

- Baseline target: Baseline Widely Available. Before frontend, UI, CSS, accessibility, browser-proof, or web-design changes: retrieve current guidance with `bun run agentic:guidance`, and run `bun run agentic:check` as the guidance-readiness front door. Prefer semantic HTML, native controls, and platform CSS before custom JavaScript; keep landmarks, labels, accessible names, focus order, touch targets, loading/error/empty states, and reduced-motion behavior legible to humans, assistive tech, and browser agents.
- Local agentic browser QA must use the **authenticated Brave QA profile** (Codex browser-extension path, or Claude Code's Chrome/Chromium extension attached to the already-open Brave window; computer-use fallback). If authenticated Brave is unreachable, report QA as **blocked** — never substitute isolated Browser/Playwright/DevTools-MCP profiles or clean-room commands (`agentic:verify`, `agentic:browser-proof`, `lighthouse`, Brave DevTools MCP) and present them as authenticated verification; they are CI/clean-room evidence only. `dev-surfaces` remains the cross-repo doctor for guidance cache, Brave, and MCP readiness.
- Full protocol (extension selection, Brave DevTools MCP constraints, WebMCP scope): `AGENTS.md § Agentic Modern Web Standard`.

**Admin UI defect resolution**: however casually the user reports an admin defect ("the card on Hub feels tight"), resolve it to a canonical `Admin*` wrapper or canvas region before editing — never guess, never ask them to formalize. Escalate: authenticated Brave live DOM (`data-component` / `data-region` / `data-workspace`) → code fallback (`rg -n 'data-component="AdminX"' packages/admin/src/views/`) → ask only if both fail to narrow to one candidate. Full workflow + casual-term mapping: `.claude/skills/design/defect-grammar.md`.

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

**Deployment artifacts**: `deployments/{chainId}-latest.json` is the source of truth for all addresses. Pre-broadcast, zero/missing addresses usually mean **pending broadcast** — review the deploy command, dry-run, artifact persistence, and dependent config path instead of treating the absence as a P0. Post-broadcast, required zero/missing addresses, schema UIDs, or indexer addresses are blockers.

## Environment

Single `.env` at root (never create package-specific .env). `VITE_CHAIN_ID` sets target chain at build time. `.env.schema` defines the contract.

**Env loading**: `.env` is materialized from `.env.template` via `bun run env:sync` (runs `op inject`). Bun, Vite, and Node read `.env` natively — no per-command 1Password fetch. For shared team secrets, edit `.env.template` and use `op://Vault/Item/field` refs. For personal local credentials, edit `.env` directly. Validate with `bun run env:check`.

**Chain selection**: `VITE_CHAIN_ID` is required for predictable behavior. Without it, `FALLBACK_CHAIN_ID` in `packages/shared/src/config/blockchain.ts` decides — currently `42161` (Arbitrum mainnet, real funds). The client logs a `[blockchain]` warning at module init when fallback is used; `bun run dev:doctor -- --profile web` flags the same gap. Common values: `42161` Arbitrum, `11155111` Sepolia, `42220` Celo.

## Local services

`bun run dev` runs the full repo-native PM2 stack (Arbitrum fork, client, admin, docs, Storybook, agent, indexer, browser + tunnel helpers) and opens the review URLs; `bun run dev:smoke:full` is the read-only proof it's all up. `bun run dev:prod` (and `dev:prod:mirror`) run browser surfaces against production Arbitrum — **wallet-confirmed transactions there are real Arbitrum writes**. Inspect with `npx pm2 list` / `npx pm2 logs <name> --nostream`. The indexer requires Docker — without it, `/api/graphql` returns no data and PWA pages render empty states. Stack semantics, prod-backed modes, tunnel/QR mobile QA: [`docs/docs/builders/getting-started.mdx`](docs/docs/builders/getting-started.mdx); indexer hot-reload: `.claude/context/indexer.md`; client presentation mode (PWA vs website, `?presentation=` override): `.claude/context/client.md`.

- **client** — `https://localhost:3001/` (HTTPS in dev; not HTTP)
- **admin** — `https://localhost:3002/`
- **docs** — `http://localhost:3003/`
- **storybook** — `http://localhost:3004/`
- **indexer GraphQL** — `http://localhost:3006/v1/graphql` (requires Docker stack up)
- **indexer postgres** — `localhost:3008`
- **envio indexer runtime** — `http://localhost:3007/`

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

Codex CLI ships inside the Mac app — there is no globally installed `codex` binary; use `CODEX=/Applications/Codex.app/Contents/Resources/codex`. Common forms: `"$CODEX" exec review --uncommitted - < prompt.md` (review uncommitted diff), `"$CODEX" exec --full-auto -C <worktree> -o <result-file> "<prompt>"` (non-interactive task), `"$CODEX" exec review --commit <sha>`. Don't reach for `which codex` or install it globally. Worktree + dispatch protocol details: memory note `feedback_claude_orchestrated_codex.md`.

## Repo Health Ritual

For multi-issue, ambiguous-scope, cross-package messes only (never for single-file edits, doc-only changes, or bug fixes with a known path): **1** `/audit` (read-only numbered findings; `/audit drift` for the quick classifier) → **2** scope lock (user picks findings by number; plan mode for anything large) → **3** `/clean` (broad 8-lane sweep, only after audit proves cleanup-shaped) → **4** `/review` (`/simplify` is an optional refinement pass before it) → **5** `/ship`.

## Session Continuity

Before context compaction or ending a long session, write `session-state.md` in the working directory covering: current task, progress, files modified, test state, next steps, blockers. Distinct from local project memory (untracked, not canonical) — session state is execution context for the next context window.

## Scripts

A script earns a place in `scripts/` only with a durable caller: root `package.json`, a `.github/workflows/*.yml`, `ecosystem.config.cjs` (PM2), or a Claude skill / planning harness. One-shot ops live in `.plans/<feature>/` or get deleted after use. Every new script gets a one-line [`scripts/README.md`](scripts/README.md) entry in the same PR; don't add a script when a package.json script + an existing CLI already does the job. Data files consumed by scripts belong in `scripts/data/`.

## Cleanup

If you create temporary files, scripts, or helpers during iteration, remove them before reporting task completion.

## Supply-chain and agent safety

- Do not install or upgrade npm, Python, or package-manager dependencies unless the user explicitly approves that install in the current task.
- Prefer existing repo tooling, checked-in lockfiles, and standard library options over adding new packages.
- Treat `package.json`, lockfiles, package-manager config, `.github/workflows/**`, `AGENTS.md`, `CLAUDE.md`, `.codex/**`, and `.claude/**` as security-sensitive surfaces. Call out any changes to them in final summaries.
- Keep dependency installs on the checked-in lockfile path and preserve the repo's release-age gate configuration.
