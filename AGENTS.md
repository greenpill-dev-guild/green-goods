# Green Goods Agent Guide

Green Goods connects regenerative work, community verification, and funding. This file owns
shared repository instructions for every coding agent. Read the nearest `AGENTS.md` before
editing a surface; its local rules refine this guide. Code and checked-in configuration own
implementation facts; the [ontology](.claude/context/ontology.md) owns shared domain meaning.

## Where to work

| Surface | Purpose | Local guide |
|---|---|---|
| Contracts | Solidity, deployment and upgrade wrappers, Foundry tests | [packages/contracts/AGENTS.md](packages/contracts/AGENTS.md) |
| Shared | Hooks, providers, stores, domain modules, i18n, UI foundations | [packages/shared/AGENTS.md](packages/shared/AGENTS.md) |
| Client | Green Goods Website and the installed Green Goods App | [packages/client/AGENTS.md](packages/client/AGENTS.md) |
| Admin | Green Goods Hub, the steward surface | [packages/admin/AGENTS.md](packages/admin/AGENTS.md) |
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

## Rules and their enforcers

A rule with an enforcer fails a check, a hook or a guard when it is broken. The shared guards are
machine-wide hooks in `~/.agents/guards` that `dev agents sync` installs on each developer's
machine; this repository does not carry them. They apply their own rules and the ones
`.agents/policy.json` declares. Where they are absent, as in cloud sessions or on other
contributors' machines, this repository's hooks (`scripts/harness/command-policy.mjs`,
`.claude/settings.json`, `.codex/hooks`) are the floor, but only for what a row says they do: a
row whose enforcer is only the shared guards has no floor.

| Rule | Enforcer | Where |
| --- | --- | --- |
| `bun run test`, never `bun test` | `bun test` (with `test` right after `bun`) is blocked by the shared guards and both harnesses' hooks | `.agents/policy.json` `bun-test`, `scripts/harness/command-policy.mjs` |
| Bun contract wrappers, not raw `forge build` or `forge test` | the shared guards ask; the Codex hook blocks | `.agents/policy.json` `forge-direct` |
| Mainnet deploys and live broadcasts need out-of-band confirmation | the shared guards ask and the Codex hook blocks a broadcast or Safe signature whose last `--network` or `-n` is live, a contracts broadcast not pinned to a test network, and the release operator | `.agents/policy.json` `mainnet-*`, `production-broadcast`, `vercel-prod`, `fly-deploy` |
| No env files under `packages/*` | file-tool edits to a `.env` or `.env.*` file in `packages/*` are blocked, and the shared guards also block them anywhere else except `.env.example`; shell writes such as `cp` or a `>` redirect pass | `.agents/policy.json` `package-env`, `~/.agents/guards` `secret-edit`, `.claude/settings.json`, `.codex/hooks/edit_policy.sh` |
| No secrets in Git | push protection for the secret patterns GitHub supports; the shared guards block reading a `.env` or `.env.*` file other than `.env.example` with Read, Grep or most shell programs, and the repository hooks block common readers such as `cat`, `grep` or `sed` | GitHub secret scanning, `~/.agents/guards` `secret-read`, `scripts/harness/command-policy.mjs` |
| React hooks live in `packages/shared/src/hooks` | file-tool edits to app hook folders are blocked; exported hooks defined in Client or Admin fail lint | `.agents/policy.json` `client-hooks`, `admin-hooks`, `check-react-patterns.js` |
| Admin, Client, Agent and Indexer consume Shared through its declared exports | lint | `check-react-patterns.js` rule 11 |
| No new raw timers (in React modules), raw listeners or address strings in Shared, Client and Admin | shrink-only lint baseline | `check-react-patterns.js`, `scripts/quality/data/lint-rules-baseline.json` |
| Shared imports `DEFAULT_CHAIN_ID` from `config/default-chain`, not `config/blockchain` | structure check | `check-source-structure.js` |
| Package boundaries, placement and file size | structure check in each package workflow; the extension has no workflow, and QA has neither a workflow nor `src` | `check-source-structure.js` |
| The structure and React-pattern debt baselines only shrink | growth against the base fails | `check-source-structure.js`, `check-react-patterns.js` |
| The shared `logger`, not `console`, in Client, Admin, Shared and Agent `src` | lint with warnings denied, the logger module and test files aside | `.oxlintrc.json` `no-console` |
| Lockfile and release-age gate | frozen installs; a minimum release age when versions are resolved | `.github/actions/setup-js`, `bunfig.toml` |
| Report changes to sensitive surfaces | the shared guards print a notice on file-tool edits to manifests, the lockfile, workflows, `.agents`, `.claude` and `.codex`, and critical paths | `.agents/policy.json` `config-*`, `critical-*` |
| An answer, audit or review request does not authorize edits | on a turn whose prompt the shared guards read as a question, review, audit, plan or discussion, they block file-tool edits, commits, pushes, `gh` pull request and issue writes, `sed -i`, redirects and file commands into the repository, and MCP writes such as `save_issue`; a script that writes for itself passes | `~/.agents/guards` `read-only-turn` |
| Stay on the current branch | the shared guards block creating, switching or renaming a branch, `git worktree add -b`, `gh pr edit --base` and `gh pr create --base main` unless a prompt in the session has asked for branch, worktree, rebase or pull request work | `~/.agents/guards` `branch-change` |
| Do not stash another session's work | the shared guards block `git stash`, `stash pop`, `stash clear` and a `stash push` without `-m` | `~/.agents/guards` `stash` |
| Leave changes you did not author untouched | the shared guards block `git reset --hard`, `git clean -f`, a forced checkout or switch, `git worktree remove --force`, and `git restore` or `git checkout --` on `.` or on a file dirty when the session started | `~/.agents/guards` `reset-hard`, `clean`, `discard-changes`, `worktree-remove-force`, `restore-dirty` |
| Stage only your task's paths | the shared guards block `git add -A`, `-u` or `.` and `git commit -a`; naming a folder passes | `~/.agents/guards` `broad-staging`, `commit-all` |
| Force-pushes need fresh authorization | the shared guards block `--force`, `-f` and `+ref` pushes and any force push that names `main` or `master`, but not `--force-with-lease` to another branch; the repository hooks block only a push with a force flag that names `main` or `master` | `~/.agents/guards` `force-push`, `force-push-main`, `scripts/harness/command-policy.mjs` |
| Critical changes keep their proof | the check selector's critical overrides, on every intent but `diagnose` and `review`, which plan evidence only | `scripts/data/validation-policy.json`, `scripts/quality/select-validation.mjs` |
| Report the checks you ran and what they showed | the shared guards' stop hook sends a final reply back when the turn edited repository files with a file tool and no check command ran after the last edit, or the reply cites none; the same reply sent again passes, the result is not read, and shell edits do not trigger it | `~/.agents/guards` `proof`, `.agents/policy.json` `proof` |
| Run the push intent before publication | pre-push hook | `.husky/pre-push` |
| Current-head CI passes before merge | required check that organization admins may bypass, on `develop` always and on `main` in a pull request | `CI Gate` in the `develop` and `main` rulesets |
| Contract source, tests, scripts, deployments and config; workflows; the root and `packages/*` guides; `CLAUDE.md`; `.claude`; `.codex`; and root env files have code owners | review requests | `.github/CODEOWNERS` |
| Local guides exist and name commands that exist; the skills link and `CLAUDE.md` as an import stay intact | guidance check | `check-codex-docs.js` |
| Plan hubs live in `.plans/{ideas,backlog,active}` | plan hub validation in CI checks the layout inside `.plans`; a hub-shaped folder elsewhere is never found | `scripts/harness/plan-hub.mjs validate` |
| A release that touches authenticated surfaces needs an attestation | when the selector's `browser-proof` paths changed (they also catch public-only routes such as `packages/client/src/routes/PublicShell.tsx`), the release gate exits blocked unless an attestation names `authenticated Brave`, carries a `YYYY-MM-DD` date and adds 12 or more characters, which filler can supply; other intents leave `browser-proof` advisory | `scripts/data/validation-policy.json`, `scripts/dev/ci-local.js` `validateAttestation` |
| Brave only for the DevTools MCP wrapper | a local launch refuses other browsers; a remote endpoint is not checked | `scripts/mcp/brave-devtools.mjs` |
| WebMCP exposes only public-safe tools | pinned tools and routes | `packages/client/src/__tests__/webmcp.test.ts` |
| Linear is the backlog | GitHub Issues are off; issues saved through a `save_issue` MCP tool are shape-checked | repository settings, the `lint-linear-issue.sh` hook |

Review alone holds the rest: reading the nearest `AGENTS.md`, inspecting `git status` before
editing, Bun for package operations other than tests, `bun test` after Bun's global options,
approval before installing dependencies, merge commits only (both rulesets still allow squash), live
writers with no broadcast flag (`cast send`, `open-minting.mjs`), `forge script`, private hooks
outside hook folders, the other debt baselines, secrets GitHub has no pattern for, the release age
of versions already in the lockfile, an `.env.example` in other package folders such as `docs/`,
env files written from the shell, reading `.env` inside a script, through `git show` or as an
option value, a notice for edits to `AGENTS.md`, choosing the default chain through
`getDefaultChain()` or `DEFAULT_CHAIN_ID`, code owners for `.agents`, `.github/actions`, other
contracts files, `docs/AGENTS.md` and package env files, Linear writes through other paths, the
logger in QA, the extension and `docs/src`, `context.log` rather than `console` in the indexer,
Shared's declared exports in contracts tooling, raw timers outside React modules and the three
ratcheted patterns outside Shared, Client and Admin, the structure of an extension-only change in
CI, QA's source layout, staging a folder or another session's files by name, `git revert`, `rm`
and file-tool overwrites of another session's work, `--force-with-lease` to other branches, a
branch change in a later turn of a session that asked for one earlier, files a script writes for
itself in a read-only turn, whether a cited check passed, proof after a shell edit, guide prose
beyond its commands, code and CI that do not depend on `.plans/`, labeled rendered proof and a
Linear line in every PR body, and registering new scripts in `scripts/README.md`.

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

Use merge commits by default for authorized PR merges into `develop` and `main`, including
promotions from `develop` to `main`. Squash only when documented repository policy calls for it or
the user explicitly requests it for that PR. Verify that GitHub allows the selected method and pass
it explicitly to the merge tool. If the selected method is unavailable, ask before merging.

### Multi-Agent Repo Safety

Concurrent sessions share this checkout. Inspect `git status` before editing and leave changes
you did not author untouched. Do not stash, revert, stage, or overwrite another session's work.
Stay on the current branch unless the user explicitly requests a branch action in this turn.
When independent work needs isolation, request a separate worktree rather than changing branches
under another active session; this does not authorize automatic branch changes.
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
  modules, workflows, and auth/work/vault hooks; and any other Shared code that signs, sends a
  transaction, moves funds, or changes auth, session or queue state. Read every touched line and
  run the selector's critical override: for Shared, the owner's typecheck and focused suite plus
  every consumer's source and test typecheck, with CI's consumer workflows owning the whole suites
  and builds on the current head; for contracts, the full local gate, consumer suites and builds
  included.
- **Sensitive:** Agent runtime, indexer lifecycle/retry behavior, plan evidence, validation or
  migration tooling, admin workflow state, client journeys, and read-only Shared hooks that left
  the critical tier. Inspect failure and recovery.
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
discovery requires a Brave build that exposes `document.modelContext`. WebMCP v1 covers only
public-safe client/browser routes via `packages/client/src/webmcp.ts`; do not expose secrets,
private data, hidden admin actions, onchain writes, destructive operations, or background-only
actions as WebMCP tools.

## Read when relevant

| Task | Required source |
|---|---|
| Product or domain behavior | [Product context](.claude/context/product.md), [ontology workflow](.claude/context/ontology.md), and the owning code |
| Tests | [Testing contract](.claude/context/testing.md), including its test budget |
| Copy: product strings, website or docs prose, release notes, announcements, funder or partner documents | [Brand voice guidelines](docs/docs/reference/brand-voice.mdx), then the owning surface `DESIGN.md` |
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
external writes. Every pull request names one Linear issue, found or filed before it opens, per
[Every pull request names an issue](.claude/context/linear-routing-rules.md#every-pull-request-names-an-issue).
A merge does not finish a Linear record; after one, follow
[After a merge](.claude/context/linear-routing-rules.md#after-a-merge). Cloud routine ownership and
limits live in [docs/routines](docs/routines/README.md).

## Writing and completion

Use `humanize-writing` for human-facing prose when available, and the [brand voice
guidelines](docs/docs/reference/brand-voice.mdx) for anything a gardener, steward, funder, or visitor reads. Lead with the useful outcome,
write clear sentences, and preserve evidence and uncertainty. Report what changed, how it was
verified, and anything still blocked. Keep code, commands, and identifiers exact.

For coding and investigation tasks, capture observed phase boundaries as work proceeds and
include the compact [task/phase record](.claude/context/task-handoffs.md) in the final or
continuation handoff, including ordinary tasks without a Plan Hub. Keep it in the existing chat
or owning handoff; unknown timing and human attention stay unknown.

## Shared skills and harness configuration

Edit shared skills in `.claude/skills`; `.agents/skills` is its symlinked Codex discovery path. Do
not replace the symlink with a second copy. The review, debug, plan, ship and research skills come
from the shared agent kit (dev-surfaces `agents/kit/skills`): change their method there first, and
keep Green Goods specifics in `.agents/adapter.md`, which they read. Project-specific settings and
hooks live in `.claude/settings.json` and `.codex/`; they enforce tool behavior beyond prose
instructions. `.agents/policy.json` declares the same command and path rules for the machine-wide
guards, and these hooks stay their floor where those guards are absent;
`scripts/harness/agent-hooks.test.mjs` fails when a declared rule loses its floor enforcer on its
listed fixtures. `.agents/merge-policy.json` states the merge tiers, and
`scripts/quality/select-validation.test.mjs` keeps them covering the selector's critical and
sensitive paths.
Keep `CLAUDE.md` as a compatibility import until supported Claude environments load `AGENTS.md`
directly; it must not duplicate repository policy.

## Scripts

Add a script only for a durable caller in root `package.json`, CI, PM2, or an agent harness, and
register it in [scripts/README.md](scripts/README.md). Use existing commands where possible.
One-shot operations belong in the owning Plan Hub; consumed data belongs in `scripts/data/`.
