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

**Two-phase rhythm for ambiguous or multi-issue work**: investigate (read-only) → present numbered findings → wait for explicit scope lock from the human → fix only locked items → run the validation ladder. Canonical spec: `.claude/skills/audit-then-ship/SKILL.md`. The skill text is the source of truth for this rhythm; Codex follows the same phases. Do not invent a parallel Codex-specific protocol.

## Research, Plan, Implement

For ambiguous, multi-package, or high-risk work, do not jump straight into edits.

1. Research first: read the relevant source, tests, docs, and nearest package guide.
2. Record the evidence: cite the existing patterns, affected files, and any inference that is not directly proven.
3. Plan the smallest implementation path, including explicit out-of-scope items and validation commands.
4. Surface human judgment points before editing protected or irreversible surfaces.
5. Implement only after the research and plan are coherent. If the session went down the wrong path, summarize the useful findings and restart with clean context.

## Contract Deployment Review Phases

For new or not-yet-broadcast contract work, missing addresses in
`deployments/{chainId}-latest.json` or zero addresses in dependent config usually mean
**pending broadcast**, not an automatic P0. In pre-broadcast reviews, verify the deploy
command exists, dry-runs safely, persists artifacts, and has a post-broadcast indexer/config
update path. Call it a **deployment path blocker** only when that path is missing or broken.
After a claimed or authorized broadcast, required zero/missing addresses, schema UIDs, or
indexer config become **post-broadcast blockers**.

## Multi-Agent Repo Safety

This repo runs multiple concurrent Codex/Claude sessions on the same tree and `develop`. Treat working-tree changes you didn't author this session as another agent's work-in-progress.

- Stash unknown diffs, don't revert: `git stash push -u -m "..."` is recoverable; `git checkout HEAD --`, `rm -rf`, and `git reset --hard` are not.
- Investigate first: `git for-each-ref --sort=-committerdate refs/heads/ | head -10`, `ls ~/.codex/worktrees/`, `git log -3 -- <file>`.
- Bulk destructive ops always need fresh user OK in the current turn — multi-file `git checkout HEAD --`, `rm -rf` of `.plans/`/`packages/`/`docs/`, `git add -A`/`git add .`, `git push --force`.
- Stay strictly in your dispatched scope. If you find unexpected state in the working tree, surface it in your final report — do not "fix" it.

## Verify Before Claiming Success

Before reporting that a fix works, a setting takes effect, or a behavior holds, produce evidence in the same turn — the command output, the passing test, the rendered DOM, the re-read file showing the change. "Should work", "probably fixed", and unrun commands are not evidence. If a CLI flag is unfamiliar, read `--help` or the source before invoking it; do not invent flags. If you cannot verify (no test, no live DOM, no observable signal), say "I can't verify this without X" and stop rather than declaring success. Untested fixes and hallucinated commands have produced more reverts in this repo than any other failure mode.

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

**Tokens** — root `DESIGN.md` front matter is the canonical DesignMD token source; generated `--gg-*` tokens and runtime aliases live in `packages/shared/src/styles/theme.css`. Never hardcode `cubic-bezier`, `duration`, or raw color / radius values. Use `--spring-*` (6 tokens), `--color-*`, `--radius-*`, `--color-material-*`, `--blur-material-*`. Concentricity: `child_radius = parent_radius − padding`. 4-role volume hierarchy: canvas 80–90% / ink 8–15% / stone 3–5% / accent green 1–3%.

**Banned vocabulary** (enforced in i18n by `bun run lint:vocab`):
- Any surface: `streak`, `countdown`, `leaderboard`, `FOMO`.
- Admin only: `hero moment`, `gallery`, `decorative gradient`, glass outside the admin `AppBar`.
- Client only: `operator cockpit`, `utility copy`, `Plus Jakarta Sans`, `KPI tile`, `dashboard`.

**Additional validation steps**: `bun run check:design-generated` (root DesignMD ↔ generated artifacts), `bun run check:design-tokens` (runtime projection guard + version coupling), `bun run lint:vocab`. Add these to the Validation Ladder for frontend work.

**Design-system alignment reviews**: for any full-repo design-system alignment review — DesignMD files, Warm Earth, `theme.css`, Storybook, admin, client PWA/browser, docs UI, agentic guidance, Claude + Codex repo instructions — Codex must read and follow the Claude-owned repo protocol at `.claude/skills/design/system-alignment-review.md`. Treat it as the single source of truth for this review shape; do not author a separate Codex-only review protocol and do not duplicate the Warm Earth spec inside Codex guidance. The protocol starts read-only and does not apply fixes unless explicitly requested.

## Known Gotchas

**Tailwind v4 does not scan `packages/shared/src/` from admin/client builds.** Utility classes (`mx-4`, `w-max`, `self-center`, `justify-self-center`) added directly to JSX in shared components silently fail to generate in the consuming app. Symptom: layout looks right in Storybook (which runs from `packages/shared`) but breaks in admin/client (off-center, missing padding, wrong width). There is no `tailwind.config.*` file and no `@source` directive — Vite uses `@tailwindcss/vite` with default content scanning per package.

Proven workarounds in this repo (do **not** chase a Vite/Tailwind config fix — none has been wired up and none has worked):
- Inline styles or CSS custom properties for layout in shared components (`packages/shared/src/components/Canvas/MainSheet.tsx`, commit `374508db`).
- CSS overrides in the consuming package (`packages/admin/src/styles/admin-m3-overrides.css` restates `width: max-content` instead of relying on shared's `w-max`, commit `bba06573`).
- Apply utility classes in the consumer's JSX, not in shared.

When you see a layout bug that "looks like" a missing class, first check: was the class authored in `packages/shared/src/`? If yes, this gotcha is the likely cause.

## Validation Ladder

- Codex drift check: `node scripts/quality/check-codex-docs.js`
- Quick repo verification: `node scripts/dev/ci-local.js --quick`
- Test-quality guardrail: `bash scripts/quality/check-test-quality.sh`
- Lint check: `bun run format:check && bun lint`
- Lint fix: `bun format && bun lint`
- Full tests: `bun run test`
- Full build: `VITE_CHAIN_ID=11155111 bun run build` _(Sepolia is the deterministic validation chain — overrides local environment files so the build is reproducible across machines without requiring Arbitrum-specific deployment artifacts)_

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

## Scripts

A script earns a place in `scripts/` only if it has a durable caller: root `package.json`, a `.github/workflows/*.yml`, `ecosystem.config.cjs` (PM2), or a Claude/Codex harness path. If a new script doesn't fit any of those, do not add it.

- One-shot ops (single-deploy fixes, batch migrations, ad-hoc audits) live in `.plans/<feature>/` or get deleted after use — never in `scripts/`.
- Every new script in `scripts/` gets a one-line entry in [`scripts/README.md`](scripts/README.md) under the right caller-bucket, in the same PR.
- Do not create a script when a `package.json` script + an existing CLI already does the job.
- Data files (baselines, fixtures consumed by scripts) belong in `scripts/data/`, not at the root of `scripts/`.
