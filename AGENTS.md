# Green Goods — Agent Guide

Primary runtime contract for coding agents in this repository. Start here, then read the nearest
`AGENTS.md` for the package you are editing. Package-level guides override this file for
their subtree.

## Monorepo Map

- `packages/contracts` — Solidity contracts, deploy/upgrade wrappers, Foundry tests
- `packages/shared` — Shared hooks, providers, stores, modules, types, i18n, UI primitives
- `packages/client` — End-user web app
- `packages/admin` — Admin cockpit
- `packages/agent` — Bot/webhook service
- `packages/indexer` — Envio indexer

## Package Guides

Read the nearest guide before editing a package. It narrows this root contract for that subtree.

- `packages/contracts/AGENTS.md`
- `packages/shared/AGENTS.md`
- `packages/client/AGENTS.md`
- `packages/admin/AGENTS.md`
- `packages/agent/AGENTS.md`
- `packages/indexer/AGENTS.md`

## Common Commands

- `bun run validation:plan -- --intent <intent>` — select evidence from intent, paths, dependencies, and criticality
- `bun run test:fast` — cache-aware full-scope iteration after targeted proof is green
- `bun run test:fast:force` — repeat the same full scope without cache reuse
- `node scripts/dev/ci-local.js --quick` — cross-package checkpoint
- `bun run test` — exact uncached full test gate
- `VITE_CHAIN_ID=11155111 bun run build` — deterministic root application build
- `bun run build:agent` / `bun run build:docs` — Agent and Docs builds, which the root build does not include

The command definitions, conditional checks, receipt rules, and stop conditions live in
[`.claude/context/validation-pipeline.md`](.claude/context/validation-pipeline.md). Development and
service entrypoints live in [`scripts/README.md`](scripts/README.md).

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

## Linear Workspace

Linear (workspace `greenpill-dev-guild`) is the durable backlog as of 2026-05-09. GitHub is for PRs and code review only — never open GitHub Issues for backlog work. Routine and label-scheme details: `docs/routines/README.md`. Live workspace state (active initiatives, projects, customers, cycle status) — query the Linear MCP at the time you need it; do not hardcode it here, it drifts.

**Teams**: five as of 2026-07-14 — Product (`PRD`), Research (`RESR`), Community (`COM`), Growth (`GROW`), Marketing (`MAR`). Green Goods work writes only to **Product**. States: PRD and RESR have `Triage`; COM/GROW/MAR use the standard set without it; the old Product `QA`/`Ready` states are retired (QA proof lives in `In Review` + acceptance rules). Matters when filtering or transitioning issues.

**Records**: `Customer Need` (raw signal, structured body) → `Issue` (accepted work). `.plans/` remains execution truth for agent implementation; Linear mirrors carry the `source:plans` label.

**Project routing**: new Issues default unprojected on the Product team. Graduate into a bounded active project only when one already exists for the work; never route new work into a project whose status is Completed.

**Canonical label families** (only these): `protocol:* / package:* / activity:* / source:* / ai:* / funding:*`. Retired and not to be reintroduced: `area:*`, `work:*`, `task:*`, `automation:*`, `health:*`, `grant:*`. The `ai:*` family distinguishes `ai:claude` (interactive Claude Code), `ai:codex` (Codex), and `ai:routine` (cron'd routine writes) — they are not synonymous. This family was written as `agent:*` in earlier docs; the live group is `ai`, and `agent` exists only as `package:agent` (the agent runtime package), which is unrelated. **`group:child` above is display shorthand — `save_issue` resolves labels by bare child name or ID**, so pass `["green-goods", "qa"]`, not `["protocol:green-goods", "activity:qa"]`. A single unresolvable entry rejects the whole array and files nothing.

**Cloud routines that write Linear** (cron'd at claude.ai/code/routines, per-routine docs in `docs/routines/`): `bug-intake`, `health-watch`, `growth-pulse`. Codex does not run these — they are Claude Code routines. Codex consumes the Linear surface they produce.

**Linear MCP** is wired into the Codex environment; it is the same Linear MCP that Claude Code uses. No project `.mcp.json` config needed. Use it for read/query, triage/promote, state transitions, and branch-context loading.

**Writing in Linear — write for the person who opens it cold.** Titles and bodies are read by teammates, not parsed by agents. Say what is wrong or what should exist, in plain sentences, the way you would explain it to a colleague who has not been in your session.

- **Lead with the problem or the outcome**, not the mechanism. "Gardeners can't submit work when offline" beats "JobQueue mutation retry regression".
- **Prose over structure.** No status tables, no emoji headers, no `P0/P1` prefixes in titles, no restating the same fact in a summary *and* a detail section. Short paragraphs; a list only when the items are genuinely parallel.
- **Never paste raw agent output** — session transcripts, tool logs, full stack traces, diff dumps, or a wall of file:line anchors. Quote the one line that matters and link the rest.
- **No internal shorthand**: no screen codes (`W22`), no spec citations (`§6.1`, `register #90`), no plan-hub lane names, no decision-log numbers. Those live in `.plans/`. If context is genuinely needed, link the file.
- **One issue per issue.** Two unrelated bugs in one title is two issues.
- **Say what you actually know.** Mark what is verified versus suspected, and never write that something is fixed, passing, or deployed without having seen it — the same evidence bar as everywhere else in this file.
- **Comments are updates, not changelogs.** Say what changed and what it means for the reader. Don't narrate your process.
- **Don't rewrite history.** A `Done` issue's description stays as it was; add a comment, or open a successor and link it.

Issue references use native `<issue>` mentions rather than markdown links. Fuller conventions and the routing contract: `.claude/context/linear-routing-rules.md`.

**Privacy boundary** (PostHog evidence in Linear bodies): error message + hash + counts OK; replay URLs, session IDs, distinct IDs, wallet addresses, and reporter identifiers stay out.

## PostHog Routing

Select the project before every query: **App** (`163591`) for client/PWA/public browser,
**Admin** (`262122`) for the operator cockpit, and **Agent** (`262124`) for messaging runtimes.
The connector can start on the wrong project and return a misleading empty result. The current
surface map, approved evidence, and privacy rules live in
[`docs/routines/README.md`](docs/routines/README.md) and
[`docs/routines/posthog-questions.md`](docs/routines/posthog-questions.md).

## Linear-Spawned Issue Contract

When you are dispatched from a Linear issue (delegated/assigned, labeled `ai:codex`), **that issue is your spec.** Read it in full, plus this file and — if the issue references a `.plans/<feature>/` lane — that lane's `status.json` and todo.

- **Codex-ready gate.** Start implementing only if the issue gives all of: clear **acceptance criteria**, a named **surface / `package:*`**, and **validation** (explicit commands, or inferable from the Validation Ladder below). If any is missing, the scope is ambiguous, or it asks for a cross-lane or architecture decision — **stop and comment on the issue with what's missing; do not guess.** A vague issue is a no-op, not a green light. This is the Linear entry to the same two-phase scope-lock rhythm in `## Codex Workflow`.
- **Executor, not orchestrator.** Implement only the issue's scoped unit. Cross-lane order and coupling live in `.plans/<feature>/status.json` + the human — do not reorder lanes, pull in sibling lanes, or expand past the acceptance criteria. Coupled-feature order: shared/types + contracts → state/API → UI.
- **Branch + PR.** Branch names describe the work, never the worker, tool, Linear issue, or orchestration lane: `<type>/<work-description>`, where type is `feature`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`, `ci`, `release`, or `research`. Use a concrete kebab-case outcome such as `feature/commitment-pooling-indexer`; never use `codex/`, `claude/`, `<user>/PRD-NNN-...`, or generic lane prefixes. When an issue or plan supplies a branch, it must follow this contract, and so does a branch you inherit: sessions frequently begin on an auto-created branch that predates this rule, so check the name before your first push or PR and, if it does not conform, ask the user before renaming. Never rename unprompted — concurrent sessions share this checkout, and `git branch -m` moves the branch under all of them. With approval, rename while the branch is still local; renaming after a PR exists closes that PR and forces a new one. The PR body is the issue↔PR source of truth: use `Fixes PRD-NNN` when merge completes the issue, `Refs PRD-NNN` for partial or stacked work, or `Relates to PRD-NNN` for context. One issue per PR; keep unattended-maintenance PRs as drafts with the right labels (see `## Scope Constraints For Automated Maintenance`); never self-merge. `critical` and `packages/contracts` surfaces get extra human/Claude review.
- **Before the PR**, run the Ship Gate from `## Validation` and produce evidence per `## Verify Before Claiming Success`. Honor the privacy boundary above and `## Multi-Agent Repo Safety`.

## Agent Workflow

1. Read the nearest `AGENTS.md`.
2. Apply [the Implementation Quality Contract](.claude/context/values.md#implementation-quality-contract)
   while planning, writing, and reviewing code.
3. Keep the change inside the smallest sensible package boundary.
4. Run the lightest validation loop that still proves the change.
5. Escalate to cross-package verification when shared contracts, shared types, or public APIs move.

**Two-phase rhythm for ambiguous or multi-issue work**: investigate (read-only) → present numbered findings → wait for explicit scope lock from the human → fix only locked items → run the validation ladder. This paragraph is the canonical spec (the former `audit-then-ship` skill folded into it; Claude gets the same gate from plan mode + CLAUDE.md § Scope Discipline). Do not invent a parallel Codex-specific protocol.

For architecture opportunity discovery or structural review, load
[`.claude/context/codebase-architecture.md`](.claude/context/codebase-architecture.md). Keep
candidate selection in the owning Plan Hub; do not turn an unselected idea into implementation or
registry state.

## Change Criticality

- **Critical**: contract source and release tooling; shared Auth, JobQueue, Work providers and
  modules; auth/work/vault/blockchain mutation hooks. Read every touched line and retain the
  selector's critical override.
- **Sensitive**: Agent runtime, indexer retry/lifecycle behavior, Plan Hub evidence, validation or
  migration tooling, admin workflow state, and client journey views. Inspect failure and recovery
  behavior and keep the diff bounded.
- **Routine**: docs, stories, cleanup, and test-only refactors without runtime changes. Use the
  lightest honest proof unless a changed command, guide, or skill creates a sensitive consumer risk.

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

- Stay on the current branch for interactive work, which during release/staging prep should be `develop`. Do not create or switch branches unless the user explicitly asks for that branch action in the current turn; branch changes can confuse other agents and risk their work being saved to the wrong place.
- Stash unknown diffs, don't revert: `git stash push -u -m "..."` is recoverable; `git checkout HEAD --`, `rm -rf`, and `git reset --hard` are not.
- Investigate first: `git for-each-ref --sort=-committerdate refs/heads/ | head -10`, `ls ~/.codex/worktrees/`, `git log -3 -- <file>`.
- Bulk destructive ops always need fresh user OK in the current turn — multi-file `git checkout HEAD --`, `rm -rf` of `.plans/`/`packages/`/`docs/`, `git add -A`/`git add .`, `git push --force`.
- Stay strictly in your dispatched scope. If you find unexpected state in the working tree, surface it in your final report — do not "fix" it.

## Verify Before Claiming Success

Before reporting that a fix works, a setting takes effect, or a behavior holds, produce evidence in the same turn — the command output, the passing test, the rendered DOM, the re-read file showing the change. "Should work", "probably fixed", and unrun commands are not evidence. If a CLI flag is unfamiliar, read `--help` or the source before invoking it; do not invent flags. If you cannot verify (no test, no live DOM, no observable signal), say "I can't verify this without X" and stop rather than declaring success. Untested fixes and hallucinated commands have produced more reverts in this repo than any other failure mode.

## Validation

Render `bun run validation:plan -- --intent <intent>` before executing validation. Follow its
selected checks and inspect `selectedBy`; do not invent a broader suite or omit a direct acceptance
check. Use these rungs:

- **Diagnosis/review**: non-mutating evidence needed to prove or disprove the finding.
- **QA Speed Mode**: targeted behavior proof; add package typecheck/build only for the runtime or
  interface risk that needs it.
- **Repo Quick Gate**: cross-package checkpoints and shared public-contract changes.
- **Ship Gate**: full uncached readiness proof for ship, PR, commit, merge, release, or critical
  surfaces.

Each selected check names its risk, expected signal, freshness rule, and stopping condition. Never
reuse a failure. User cancellation is terminal, unavailable capabilities remain `BLOCKED`, and no
speed budget may suppress a critical override. Multiple agents prove their own lanes; one
coordinator runs the broader checkpoint. The canonical commands and conditional gates are in
[`.claude/context/validation-pipeline.md`](.claude/context/validation-pipeline.md).

## User-Observed UI Regression Debugging

Bug reports trigger the repo debug skill automatically. When the reported symptom is something the
user can see or touch — cannot click, cannot select, missing selected border/state, collapsed or
blank cards, invisible content, broken scroll/refresh, visible-but-unusable controls — start from
the rendered surface before tracing data flow.

Required first pass:

1. Reproduce or simulate the exact visible/clickable symptom using the real component path.
2. Inspect DOM geometry and computed styles: bounding rect, width/height, opacity, display,
   pointer-events, z-index, overflow, disabled state, selected classes, and border/ring styles.
3. Verify whether the interaction changes state after click/tap.
4. Trace visible element → card/button/input → wrapper/carousel/sheet/dialog → state setter.
5. Check recent commits for the affected component and wrapper with `git log --follow` or focused
   `git show`.

Only move into providers, query hooks, auth, or indexer/data explanations after proving the
rendered surface is intact. If text/data exists in the DOM but the control is collapsed,
invisible, untappable, or lacks selected visual state, treat it as a component/CSS regression until
browser or DOM evidence proves otherwise.

## Admin UI Defaults

- For `packages/admin`, read `docs/docs/builders/packages/admin.mdx` alongside `packages/admin/AGENTS.md`; it is the active UI contract.
- The canonical admin shell is `CanvasLayout`.
- Use `/hub` as the reference admin canvas surface; `/work` is retired.
- New admin UI should not start from `DashboardLayout`, `Sidebar`, or `Header`; treat them as legacy migration references only.
- Default to the preferred admin primitives in `packages/admin/AGENTS.md` and shared Storybook-backed foundations from `packages/shared`.

## Design Language (Warm Earth)

Single design language across frontend packages, with distinct admin, installed PWA, public browser, and docs surfaces. Full detail in `.claude/skills/design/`. One-page map: `.claude/skills/design/ARCHITECTURE.md`.

**Admin** (`packages/admin`) — restrained operator cockpit. M3 strict anatomy (v0.192). Plus Jakarta Sans. The admin `AppBar` root stays transparent over the workspace canvas; glass is reserved for Navigation/FAB chrome only. Dialogs, side sheets, route cards, forms, tables, lists, and dense content stay solid. Use `Admin*` wrappers from `packages/admin/src/components/Admin*.tsx` (count derives from the filesystem; 16 today). Litmus: Linear / GitHub / Stripe-appropriate?

**Client** (`packages/client`) — adaptive shell. Browser = `SiteHeader` + hamburger. Installed PWA = bottom `AppBar` (Home / Garden / Profile). Never mix. Inter across PWA; editorial serif only on public browser site. Hero moments (garden creation, first submission, hypercert mint, vault deposit, seasonal transitions, assessment completion, role milestone) live here, never in admin.

**Tokens** — root `DESIGN.md` front matter is the canonical DesignMD token source; generated `--gg-*` tokens and runtime aliases live in `packages/shared/src/styles/theme.css`. Never hardcode `cubic-bezier`, `duration`, or raw color / radius values. Use `--spring-*` (6 tokens), `--color-*`, `--radius-*`, `--color-material-*`, `--blur-material-*`. Concentricity: `child_radius = parent_radius − padding`. 4-role volume hierarchy: canvas 80–90% / ink 8–15% / stone 3–5% / accent green 1–3%.

**Banned vocabulary and prompt-only wording**:
- Lint-enforced i18n terms (`bun run lint:vocab`, from `docs/docs/reference/banned-vocabulary.json` → `linter_enforced.terms`): `streak`, `countdown`, `leaderboard`, `FOMO`, `urgent`, `limited time`, `re-engagement`, `retention hook`.
- Admin prompt-only vocabulary (not parsed by `lint:vocab`): `hero moment`, `gallery`, `decorative gradient`, AppBar glass, glass outside Navigation/FAB chrome.
- Client prompt-only vocabulary (not parsed by `lint:vocab`): `operator cockpit`, `utility copy`, `Plus Jakarta Sans`, `KPI tile`, `dashboard`.

**Additional validation steps**: `bun run check:design-md` (root + dialect DesignMD lint), `bun run check:design-generated` (root DesignMD ↔ generated artifacts), `bun run check:design-tokens` (runtime projection guard + version coupling), and `bun run lint:vocab` (i18n vocabulary guard). Add these to the Validation Ladder for frontend work; when a component, story, or Storybook-covered surface changes, also run `bun run --filter @green-goods/shared check:stories` and `bun run --filter @green-goods/shared check:story-quality`.

**Design-system alignment reviews**: for any full-repo design-system alignment review — DesignMD files, Warm Earth, `theme.css`, Storybook, admin, client PWA/browser, docs UI, agentic guidance, Claude + Codex repo instructions — Codex must read and follow the Claude-owned repo protocol at `.claude/skills/design/system-alignment-review.md`. Treat it as the single source of truth for this review shape; do not author a separate Codex-only review protocol and do not duplicate the Warm Earth spec inside Codex guidance. The protocol starts read-only and does not apply fixes unless explicitly requested.

## Agentic Modern Web Standard

- Baseline target: Baseline Widely Available. Before frontend, UI, CSS, accessibility, browser proof, or web-design changes, use repo-installed Modern Web Guidance through `bun run agentic:guidance` to search and retrieve current Chrome guidance as documentation/source material only; Green Goods local QA uses the authenticated Brave QA profile, while CI clean-room browser proof uses Brave only as non-authenticated evidence. Then apply the repo's Warm Earth and package-level design rules.
- Prefer semantic HTML, native controls, platform CSS, and browser primitives before custom JavaScript. Keep headings, landmarks, form labels, accessible names, focus order, visible focus, touch targets, loading/error/empty states, and reduced-motion behavior legible to humans, assistive tech, and browser agents.
- Run `bun run agentic:check` as the hard guidance-readiness front door for repo-installed Modern Web Guidance, design docs, token drift, the ontology sidecar (`bun run check:ontology`), Codex/skill guidance, and shared Storybook story quality. For local built-route QA across client, admin, and docs, use the authenticated Brave QA profile through the live authenticated-browser path below. Treat `bun run agentic:verify`, `bun run agentic:browser-proof`, and `bun run lighthouse` as CI/clean-room or code-level proof only unless they attach to authenticated Brave; do not report them as local authenticated verification. `dev-surfaces` remains the cross-repo/global doctor for shared Modern Web Guidance cache refresh, Brave, and MCP readiness.
- Local agentic browser QA must use the authenticated Brave QA profile. Codex: use the Codex browser-extension path and claim the already-open Brave tab/window. Claude Code: use the Claude Code Chrome/Chromium extension path (`claude --chrome` or `/chrome`) and select the authenticated Brave profile/tab when it is installed, connected, and able to control the already-open Brave window. Do not fall back merely because the extension is branded Chrome. If the Brave extension path is unavailable or not connected, use Claude computer-use/visible desktop control of the already-open Brave window; if neither can reach authenticated Brave, report QA as blocked. Use this for admin, PWA, extension, wallet/passkey, staging-session, installed-app, and profile-dependent verification.
- Do not use isolated Browser, Playwright, or DevTools MCP profiles for local QA. Existing isolated browser-proof commands are CI/clean-room checks only and must not be reported as authenticated verification. If authenticated Brave access is blocked, stop and report QA as blocked.
- Brave DevTools MCP is project-configured in `.mcp.json` through `scripts/mcp/brave-devtools.mjs`, but do not use it for local QA, live admin/PWA verification, rendered DOM proof, screenshots, traces, or success claims because it can launch a separate non-authenticated profile. The wrapper calls the upstream `chrome-devtools-mcp` package because that is the protocol package name, but the browser executable must be Brave. It rejects Google Chrome, Chrome for Testing, Chromium, and Edge paths. Use this wrapper only for CI/clean-room public-route checks or explicit non-authenticated protocol debugging, and label any result as non-authenticated evidence. Native WebMCP discovery requires a Brave build that exposes `navigator.modelContext`. WebMCP v1 is implemented only for public-safe client/browser routes via `packages/client/src/modules/webmcp/public-tools.ts`; do not expose secrets, private data, hidden admin actions, onchain writes, destructive operations, or background-only actions as WebMCP tools.

## Known Gotchas

**Tailwind v4 does not scan `packages/shared/src/` from admin/client builds.** Utility classes (`mx-4`, `w-max`, `self-center`, `justify-self-center`) added directly to JSX in shared components silently fail to generate in the consuming app. Symptom: layout looks right in Storybook (which runs from `packages/shared`) but breaks in admin/client (off-center, missing padding, wrong width). There is no `tailwind.config.*` file and no `@source` directive — Vite uses `@tailwindcss/vite` with default content scanning per package.

Proven workarounds in this repo (do **not** chase a Vite/Tailwind config fix — none has been wired up and none has worked):
- Inline styles or CSS custom properties for layout in shared components (`packages/shared/src/components/Canvas/MainSheet.tsx`, commit `374508db`).
- Fork the component into the consuming package — the admin Canvas shell (`packages/admin/src/components/Shell/`) exists precisely so its utility classes live where the content scan reaches them.
- Apply utility classes in the consumer's JSX, not in shared.

When you see a layout bug that "looks like" a missing class, first check: was the class authored in `packages/shared/src/`? If yes, this gotcha is the likely cause.

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

## Shared Skill Surface

`.claude/skills` is the canonical repo skill source. `.agents/skills` is a symlink to it (`.agents/skills -> ../.claude/skills`), so Claude Code and Codex read one shared skill tree — there is no generated mirror and nothing to keep in sync.

- Edit skills in `.claude/skills`; Codex sees the same files through the `.agents/skills` symlink.
- Codex officially follows symlinked skill folders, so the retired `skills:sync` regeneration and `check:skills` drift gate stay removed.
- Do not convert `.agents/skills` back into a real directory or a second copy — that reintroduces the copy drift this symlink removes.

## Scripts

A script earns a place in `scripts/` only if it has a durable caller: root `package.json`, a `.github/workflows/*.yml`, `ecosystem.config.cjs` (PM2), or a Claude/Codex harness path. If a new script doesn't fit any of those, do not add it.

- One-shot ops (single-deploy fixes, batch migrations, ad-hoc audits) live in `.plans/<feature>/` or get deleted after use — never in `scripts/`.
- Every new script in `scripts/` gets a one-line entry in [`scripts/README.md`](scripts/README.md) under the right caller-bucket, in the same PR.
- Do not create a script when a `package.json` script + an existing CLI already does the job.
- Data files (baselines, fixtures consumed by scripts) belong in `scripts/data/`, not at the root of `scripts/`.

## Supply-chain and agent safety

- Do not install or upgrade npm, Python, or package-manager dependencies unless the user explicitly approves that install in the current task.
- Prefer existing repo tooling, checked-in lockfiles, and standard library options over adding new packages.
- Treat `package.json`, lockfiles, package-manager config, `.github/workflows/**`, `AGENTS.md`, `CLAUDE.md`, `.codex/**`, and `.claude/**` as security-sensitive surfaces. Call out any changes to them in final summaries.
- Keep dependency installs on the checked-in lockfile path and preserve the repo's release-age gate configuration.
