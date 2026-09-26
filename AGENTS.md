# Green Goods — Agent Guide

Green Goods connects regenerative work, community verification, and funding. This file owns
shared repository instructions for every coding agent. Read the nearest `AGENTS.md` before
editing a surface; its local rules refine this guide. Code and checked-in configuration own
implementation facts; the [ontology](.claude/context/ontology.md) owns shared domain meaning.

## Where to work

| Surface | Purpose | Local guide |
|---|---|---|
| Contracts | Solidity, deployment and upgrade wrappers, Foundry tests | [packages/contracts/AGENTS.md](packages/contracts/AGENTS.md) |
| Shared | Hooks, providers, stores, domain modules, i18n, UI foundations | [packages/shared/AGENTS.md](packages/shared/AGENTS.md) |
| Client | Public website and installed PWA | [packages/client/AGENTS.md](packages/client/AGENTS.md) |
| Admin | Steward cockpit | [packages/admin/AGENTS.md](packages/admin/AGENTS.md) |
| Agent | Messaging and webhook runtime | [packages/agent/AGENTS.md](packages/agent/AGENTS.md) |
| Indexer | Envio event indexing | [packages/indexer/AGENTS.md](packages/indexer/AGENTS.md) |
| QA | Private QA recording application | [packages/qa/AGENTS.md](packages/qa/AGENTS.md) |
| Docs | Public Docusaurus documentation and generated projections | [docs/AGENTS.md](docs/AGENTS.md) |

Service and script entrypoints are in [scripts/README.md](scripts/README.md). Execution plans
live in `.plans/{ideas|backlog|active}/`; code, tests, and CI must not depend on `.plans/`.

## Essential rules

- Use Bun for repository scripts and package operations: `bun run test`, never `bun test`.
  Use the Bun contract wrappers, never raw Forge. The fresh-machine bootstrap may use `npm run setup`.
- Use only the root `.env`; do not create package-level environment files.
- Default to one chain through `getDefaultChain()` or `DEFAULT_CHAIN_ID`; use the `Address`
  type for Ethereum addresses.
- Define React hooks in `packages/shared/src/hooks`. Consume Shared through declared
  `packages/shared/package.json#exports`, never `@green-goods/shared/src/**`.
- Follow the source-structure checker for package boundaries and unused named exports.
  Existing debt baselines may shrink; do not add entries to accommodate new work.
- Use the shared `logger` in application code. CLI tools may print their command output.
- Do not install or upgrade dependencies without explicit approval for this task. Preserve
  the checked-in lockfile and release-age gate.
- Treat manifests, lockfiles, CI, agent instructions, and harness configuration as sensitive.
  Report changes to these surfaces; do not weaken permissions or safety checks as a workaround.
- This repository is public. Keep secrets and private QA evidence out of Git and public records;
  follow the [QA privacy boundary](.claude/context/qa.md#public-repository-boundary).

## Scope and workflow

For coding work, use `pragmatic-programming`; also use `domain-driven-design` when changing
business behavior, terminology, identity, lifecycle, consistency, or integration meaning.
If a skill is unavailable, use this repository's guidance and report the gap; do not install
or duplicate personal skills. Read only references relevant to the task.

Apply the [Implementation Quality Contract](.claude/context/values.md#implementation-quality-contract).
Inspect the owning implementation and its callers before changing a rule. For new helpers,
components, or cross-feature dependencies, read the
[architecture and reuse contract](.claude/context/codebase-architecture.md#reuse-and-capability-ownership).
Use [task routing](.claude/context/task-routing.json) for specialized workflows.

An answer, audit, or review request does not authorize edits. For ambiguous or multi-issue work,
investigate read-only, present numbered findings, obtain explicit scope lock, then implement
only the accepted work. Continue authorized work until its completion criteria and checks are met;
return unresolved product decisions or scope expansion to the user. Implementation permission
does not imply permission to deploy, broadcast, merge, publish, or change branches.

### Multi-Agent Repo Safety

Concurrent sessions share this checkout. Inspect `git status` before editing and leave changes
you did not author untouched. Do not stash, revert, stage, or overwrite another session's work.
Stay on the current branch unless the user explicitly requests a branch action in this turn.
Investigate conflicts through focused diffs and history; coordinate when they prevent your work.
Bulk destructive operations, broad staging (`git add -A` / `git add .`), and force-pushes require
fresh explicit authorization. Stage only your task's paths.

## Common Commands

Run these from the repository root. Package-specific commands live in the local guides.

| When | Command or next step |
|---|---|
| Check local web development readiness | `bun run dev:health -- --profile web` |
| Start or stop repository services | `bun run dev` / `bun run dev -- stop` |
| Select verification before running checks | `bun run check --plan -- --intent <intent>` |
| Verify a bounded change | Run the selected focused proof from the owning package guide |
| Check a coherent cross-package change | `node scripts/dev/ci-local.js --quick` |
| Prepare an ordinary push after targeted proof and commit | `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path <surface>:<path>` |
| Iterate over the full test scope after focused proof passes | `bun run test --cache`; use `bun run test --cache --force` to rerun without cache reuse |
| Run the exact uncached full test gate when selected | `bun run test` |
| Build the root applications deterministically | `VITE_CHAIN_ID=11155111 bun run build` |
| Build Agent or Docs when selected; the root build excludes both | `bun run --cwd packages/agent build` / `bun run --cwd docs build` |

## Validation

Choose `diagnose` for read-only evidence, `qa` for focused iteration, `checkpoint` for a
cross-package checkpoint, and `push` before publication. Use `readiness`, `ship`, `merge`, or
`release` only for the corresponding request. The
[validation pipeline](.claude/context/validation-pipeline.md) owns exact gates, conditional checks,
receipt freshness, and stopping rules. Inspect the selector's `selectedBy` reasons and retain
critical overrides. A guide edit needs link, routing, and consistency proof.

Report commands and observed results, including blocked or unverified claims. Never reuse a
failed check or claim success from an unrun command. Required current-head GitHub CI must pass
before PR approval; local proof alone does not establish merge readiness.

### Change Criticality

- **Critical:** contract source and release tooling; shared Auth, JobQueue, Work providers and
  modules; auth/work/vault/blockchain mutation hooks. Read every touched line and retain the
  selector's complete critical override.
- **Sensitive:** Agent runtime, indexer lifecycle/retry behavior, plan evidence, validation or
  migration tooling, admin workflow state, and client journeys. Inspect failure and recovery.
- **Routine:** documentation, stories, cleanup, and test-only refactors without runtime changes,
  unless the changed guidance or command introduces sensitive consumer risk.

### Browser Evidence

Rendered proof has three separate rules. Skills, package guides, and the validation policy link
here instead of restating them.

1. **Label every rendered proof** with the engine and session that produced it: `authenticated
   Brave` (the user's real profile), `mock-auth localhost` (`?mockAuth=<role>` on a loopback dev
   server), `Storybook`, `CI Playwright` (clean-room), or `none`. Never present one class as
   another, and never call an HTTP or DOM-less check rendered proof.
2. **Authenticated-session proof is required only for the authenticated surface class**: wallet and
   passkey signing, session and auth providers, installed-PWA and service-worker behavior, the job
   queue and offline uploads, profile identity, and the QA app catalog.
   `scripts/data/validation-policy.json` selects the manual `browser-proof` check for exactly these
   paths. Every other surface accepts labeled mock-auth localhost, Storybook, or CI Playwright
   rendered proof; do not report that evidence as authenticated.
3. **Brave specifically is required only for WebMCP, the browser-extension path, and installed-PWA
   behavior.** For rendered DOM and CSS proof any Chromium engine is equivalent when labeled.

The `browser-proof` check is advisory in every local intent: it never blocks a push, review,
ship, or readiness run. Record the proof, or that it is pending and why, in the PR body. Only the
release gate requires attestation:
`node scripts/dev/ci-local.js --intent release --attest browser-proof="<engine, session, date, what was observed>"`.
The release gate rejects a placeholder: the text must name an engine the check accepts
(`attestation.engines` in `scripts/data/validation-policy.json`), carry the date as `YYYY-MM-DD`,
and say what was observed. No other intent consumes an attestation; the proof stays pending there.

Authenticated path: Claude Code uses the Chrome/Chromium extension path against the already-open
Brave profile/tab and probes reachability with a tab-context call, not the connected-browsers
roster; Codex uses its browser-extension path against the same window; visible computer control of
that Brave window is the fallback. If none can reach it, record the authenticated-class proof as
pending and continue with labeled proof for everything else. Do not substitute an isolated
Browser, Playwright, or DevTools MCP profile for authenticated-class proof.

The Brave DevTools MCP wrapper in `.mcp.json` (`scripts/mcp/brave-devtools.mjs`) launches a
separate non-authenticated profile: use it for WebMCP debugging and clean-room public-route
checks, label its output as such, and never for authenticated-class proof. It calls the upstream
`chrome-devtools-mcp` package because that is the protocol package name, but the executable must
be Brave; it rejects Google Chrome, Chrome for Testing, Chromium, and Edge paths. Native WebMCP
discovery requires a Brave build that exposes `navigator.modelContext`. WebMCP v1 covers only
public-safe client/browser routes via `packages/client/src/webmcp.ts`; do not expose secrets,
private data, hidden admin actions, onchain writes, destructive operations, or background-only
actions as WebMCP tools.

## Read when relevant

| Task | Required source |
|---|---|
| Product or domain behavior | [Product context](.claude/context/product.md), [ontology workflow](.claude/context/ontology.md), and the owning code |
| Tests | [Testing contract](.claude/context/testing.md), including its test budget |
| UI, CSS, accessibility, or browser proof | `modern-web-guidance`, the owning `DESIGN.md`, and [design implementation guidance](.claude/skills/design/implementation.md) |
| Full design-system alignment review | [Shared review protocol](.claude/skills/design/system-alignment-review.md) |
| User-observed bug | `debug`; begin visible/clickable regressions at the rendered component before tracing providers or data |
| QA application or catalog changes | [QA application guide](packages/qa/AGENTS.md) and [QA contract](.claude/context/qa.md) |
| Live QA or deferred QA findings | `qa-session` or `qa-triage`, respectively, and the [QA contract](.claude/context/qa.md) |
| Linear records or issue-dispatched work | [Linear routing and execution contract](.claude/context/linear-routing-rules.md) |
| PostHog queries | [Surface selection and privacy](docs/routines/posthog-questions.md); select the project before every query |
| Contract deployment or upgrade review | [Contracts guide](packages/contracts/AGENTS.md#phase-aware-artifact-review); distinguish pending broadcast from post-broadcast blockers |
| Plans, team coordination, or hub closeout | `plan`; use its closeout procedure and preserve the owning hub's execution truth |
| Commit, push, PR, or release | `ship` and the [validation pipeline](.claude/context/validation-pipeline.md) |
| Claude-specific browser tools or Codex dispatch | [Claude harness notes](.claude/context/claude-code.md) |

## Linear Workspace

Linear is the durable backlog; GitHub is for pull requests and code review. Engineering and
accepted product delivery go to Product; research before product scope is accepted goes to
Research. Use Community only for explicitly relevant community work. Read the
[routing contract](.claude/context/linear-routing-rules.md) before writing, and query live workspace
state instead of caching teams, states, or project inventories here. An audit alone authorizes no
external writes. Cloud routine ownership and limits live in [docs/routines](docs/routines/README.md).

## Writing and completion

Use `humanize-writing` for human-facing prose when available. Lead with the useful outcome,
write clear sentences, and preserve evidence and uncertainty. Report what changed, how it was
verified, and anything still blocked. Keep code, commands, and identifiers exact.

## Shared skills and harness configuration

Edit shared skills in `.claude/skills`; `.agents/skills` is its symlinked Codex discovery path.
Do not replace the symlink with a second copy. Project-specific settings and hooks live in
`.claude/settings.json` and `.codex/`; they enforce tool behavior beyond prose instructions.
Keep `CLAUDE.md` as a compatibility import until supported Claude environments load `AGENTS.md`
directly; it must not duplicate repository policy.

## Scripts

Add a script only for a durable caller in root `package.json`, CI, PM2, or an agent harness, and
register it in [scripts/README.md](scripts/README.md). Use existing commands where possible.
One-shot operations belong in the owning Plan Hub; consumed data belongs in `scripts/data/`.
