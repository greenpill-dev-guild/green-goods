# Green Goods — Codex Guide

Primary runtime contract for Codex in this repository. Start here, then read the nearest
`AGENTS.md` for the package you are editing. Package-level guides override this file for
their subtree.

## Monorepo Map

- `packages/contracts` — Solidity contracts, deploy/upgrade wrappers, Foundry tests
- `packages/shared` — Shared hooks, providers, stores, modules, types, i18n, UI primitives
- `packages/client` — End-user web app
- `packages/admin` — Admin cockpit
- `packages/agent` — Bot/webhook service
- `packages/indexer` — Envio indexer

## Global Invariants

- Use `bun` for repo scripts and package operations. The only npm exception is `npm run setup`
  on a fresh machine before Bun is available.
- Use `bun run test`, never `bun test`.
- Never use raw `forge`; use the repo's bun scripts for build, test, deploy, and upgrade flows.
- Hooks live in `@green-goods/shared` only.
- Use root `.env` only; do not add package-level `.env` files.
- Default to single-chain behavior through `getDefaultChain()` or `DEFAULT_CHAIN_ID`.
- Use the `Address` type for Ethereum addresses.
- Use `logger` from shared, never `console.log`.
- Use Remixicon (`Ri*Line`), never lucide.
- Any new user-facing string must be added to `en`, `es`, and `pt`.
- Respect build dependency order: contracts -> shared -> indexer -> client/admin/agent.

## Codex Workflow

1. Read the nearest `AGENTS.md`.
2. Keep the change inside the smallest sensible package boundary.
3. Run the lightest validation loop that still proves the change.
4. Escalate to cross-package verification when shared contracts, shared types, or public APIs move.

## Research, Plan, Implement

For ambiguous, multi-package, or high-risk work, do not jump straight into edits.

1. Research first: read the relevant source, tests, docs, and nearest package guide.
2. Record the evidence: cite the existing patterns, affected files, and any inference that is not directly proven.
3. Plan the smallest implementation path, including explicit out-of-scope items and validation commands.
4. Surface human judgment points before editing protected or irreversible surfaces.
5. Implement only after the research and plan are coherent. If the session went down the wrong path, summarize the useful findings and restart with clean context.

## Admin UI Defaults

- For `packages/admin`, read `docs/docs/builders/packages/admin.mdx` alongside `packages/admin/AGENTS.md`; it is the active UI contract.
- The canonical admin shell is `CanvasLayout`.
- Use `/hub` as the reference admin canvas surface; `/work` is retired.
- New admin UI should not start from `DashboardLayout`, `Sidebar`, or `Header`; treat them as legacy migration references only.
- Default to the preferred admin primitives in `packages/admin/AGENTS.md` and shared Storybook-backed foundations from `packages/shared`.

## Design Language (Warm Earth)

Single design language across all frontend packages, two dialects. Full detail in `.claude/skills/design/`. One-page map: `.claude/skills/design/ARCHITECTURE.md`.

**Admin** (`packages/admin`) — restrained operator cockpit. M3 strict anatomy (v0.192). Plus Jakarta Sans. Glass only on the admin `AppBar`. Use `Admin*` wrappers from `packages/admin/src/components/Admin*.tsx` (13 total: `AdminBadge`, `AdminButton`, `AdminCard`, `AdminCheckbox`, `AdminDialog`, `AdminFab`, `AdminFilterChip`, `AdminLinearProgress`, `AdminListItem`, `AdminSearchToolbar`, `AdminTabRail`, `AdminTextField`, `AdminTooltip`). Litmus: Linear / GitHub / Stripe-appropriate?

**Client** (`packages/client`) — adaptive shell. Browser = `SiteHeader` + hamburger. Installed PWA = bottom `AppBar` (Home / Garden / Profile). Never mix. Inter across PWA; editorial serif only on public browser site. Hero moments (garden creation, first submission, hypercert mint, vault deposit, seasonal transitions, assessment completion, role milestone) live here, never in admin.

**Tokens** — `packages/shared/src/styles/theme.css`. Never hardcode `cubic-bezier`, `duration`, or raw color / radius values. Use `--spring-*` (6 tokens), `--color-*`, `--radius-*`, `--color-material-*`, `--blur-material-*`. Concentricity: `child_radius = parent_radius − padding`. 4-role volume hierarchy: canvas 80–90% / ink 8–15% / stone 3–5% / accent green 1–3%.

**Banned vocabulary** (enforced in i18n by `bun run lint:vocab`):
- Any surface: `streak`, `countdown`, `leaderboard`, `FOMO`.
- Admin only: `hero moment`, `gallery`, `decorative gradient`, glass outside the admin `AppBar`.
- Client only: `operator cockpit`, `utility copy`, `Plus Jakarta Sans`, `KPI tile`, `dashboard`.

**Additional validation steps**: `bun run check:design-tokens` (Warm Earth spec ↔ `theme.css` drift + version coupling), `bun run lint:vocab`. Add both to the Validation Ladder for frontend work.

## Validation Ladder

- Codex drift check: `node scripts/check-codex-consistency.js`
- Quick repo verification: `node scripts/ci-local.js --quick`
- Test-quality guardrail: `bash scripts/check-test-quality.sh`
- Lint check: `bun run format:check && bun lint`
- Lint fix: `bun format && bun lint`
- Full tests: `bun run test`
- Full build: `VITE_CHAIN_ID=11155111 bun run build`

## Package Guides

- `packages/contracts/AGENTS.md`
- `packages/shared/AGENTS.md`
- `packages/client/AGENTS.md`
- `packages/admin/AGENTS.md`
- `packages/agent/AGENTS.md`
- `packages/indexer/AGENTS.md`

## Scope Constraints For Automated Maintenance

When Codex is running unattended maintenance work:

- Keep PRs to 20 changed files or fewer.
- Do not modify deployment scripts, contract upgrade scripts, or `.env` files.
- Do not create new packages or top-level directories.
- Do not modify agent operating docs (`AGENTS.md`, `.codex/**`, `CLAUDE.md`, `.claude/**`) unless the task explicitly asks for it.
- Keep automated PRs as drafts with the appropriate labels.

## Codex Config Surface

- Project config: `.codex/config.toml`
- Environment and actions: `.codex/environments/environment.toml`
- Reference doc: `docs/docs/builders/agentic/codex.mdx`
