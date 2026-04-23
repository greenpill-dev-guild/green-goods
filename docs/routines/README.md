# Claude Routines

Source-of-truth prompts and configurations for Claude Code routines operating on Green Goods. Each routine's actual config lives on claude.ai/code/routines; the files here exist so the setup is rebuildable if routines are lost or the research-preview API surface changes.

## Files

- `gg-pr-review.md` — GitHub-triggered inline PR review (replaces `claude-code-review.yml`)
- `gg-morning-watch.md` — Scheduled weekday operational health checks; writes GitHub Issues + Discord #engineering health summary
- `gg-client-polish.md` — Daily client PWA audit with rotating focus + bi-directional Discord; writes GitHub Issues + Discord messages
- `gg-admin-polish.md` — **PAUSED (2026-04-21)** while admin UI revamp is in flux. Daily admin workspace audit with rotating focus (M3 compliance, architecture, testing, UX, quality); writes GitHub Issues + Discord summary. Re-enable once revamp ships.
- `gg-auto-implement.md` — Weekday implementer; picks human-approved issues off the project boards (plus user-reported p2 client bugs in a fast lane), bundles related fixes, and opens PRs against `develop`. Handles both client AND admin packages.
- `gg-hotfix.md` — Every 4h during waking hours, Mon-Fri. Narrow hotfix path: takes user-reported p2 bugs moved to `Ready` on the Bug Board, opens solo PRs against `main` with full-suite validation. No fast-lane, no bundling, no critical paths. Complements `gg-auto-implement` (which targets `develop`).
- `gg-dream-on.md` — Nightly 03:00 cross-project exploration across 5 active guild repos. **Output: session-only markdown brief** — final message in the routine's session history, pleasant to read with morning coffee. Explicitly NEVER opens PRs, issues, branches, files, email, Drive docs, or Discord posts; reads Discord #research + Drive + Calendar + GitHub API read-only.
- `gg-data-analyst.md` — Weekly Dune + PostHog maintenance; writes PR to develop + issues + Discord #funding highlights
- `gg-grant-scout.md` — Weekly grant opportunity scouting + proposal drafting for Green Goods & Coop; writes Drive docs + Discord #funding + GitHub Issues

## Conventions

- All routine PRs target `develop`, never `main`.
- All routine branches use the `claude/<routine-name>/<topic>` prefix.
- Dedupe issues by category labels. `gg-morning-watch` uses `health:<category>`; `gg-data-analyst` uses `metrics:<category>`; `gg-grant-scout` uses `grant:<lifecycle>`; `gg-client-polish` uses the umbrella `polish` combined with a **dimension** (`design`, `testing`, `architecture`, `performance`, `quality`) or a **source** (`source:discord`, `source:telegram`, `source:drive`). The `automated/claude` umbrella carries the "this came from a routine" signal.
- Loop prevention: PR-review filters on `head_branch` starting with `claude/` (not on author — routine PRs carry the user's GitHub author per docs).
- The original design and rollout plan (2026-04-14) lived under `docs/superpowers/` and were removed once the routines shipped; see git history for the source docs.

## Rebuilding a routine

1. Log in to claude.ai/code/routines.
2. Click **New routine**.
3. Paste the prompt from the relevant `.md` file (everything after the `# Prompt` heading).
4. Configure repos, environment, connectors, and triggers as specified in the file's frontmatter.
5. Save.

## Required labels

Ensure these GitHub labels exist before enabling the corresponding routines:

**Automation umbrella** — every routine-authored issue/PR carries this:

| Label | Purpose |
|---|---|
| `automated/claude` | Authored by a Claude automation |

**`gg-morning-watch` — ops health checks** (dedupe: one open issue per category):

| Label | Purpose |
|---|---|
| `health:indexer` | Envio indexer is lagging or unreachable |
| `health:ci` | Recent CI failures on main |
| `health:contracts` | On-chain state drift (vaults, yield split, garden activity) |

**`gg-data-analyst` — metrics**:

| Label | Purpose |
|---|---|
| `metrics:anomaly` | Metric anomaly in Dune or PostHog |

**`gg-client-polish` and `gg-admin-polish` — polish umbrella + dimension + source + package**:

Every polish issue carries `polish` plus a dimension/source plus a package-scope label (`client` or `admin`, repo-local) plus `automated/claude`. Dedupe queries combine labels: `gh issue list --label polish --label admin --label design` returns the design-dimension admin-polish backlog; swap `admin` for `client` to see the client side.

| Label | Purpose |
|---|---|
| `polish` | Umbrella applied to every polish-routine output (client + admin) |
| `design` | Design work — Figma, wireframes, mockups, visual polish |
| `architecture` | Patterns, hook boundaries, state management |
| `testing` | Test coverage, quality, or missing scenarios |
| `performance` | Performance or PWA-specific concerns |
| `quality` | Code quality, principles, dead code |
| `source:discord` | Reported via Discord |
| `source:telegram` | Reported via Telegram bot |
| `source:drive` | Surfaced from Drive meeting notes |

**`gg-grant-scout` — grant lifecycle**:

| Label | Purpose |
|---|---|
| `grant` | Grant opportunity or application |
| `grant:prospect` | Grant opportunity identified, not yet acted on |
| `grant:drafting` | Grant proposal being drafted (see Drive link in body) |
| `grant:submitted` | Grant proposal submitted, awaiting response |

**Agent assignment**:

| Label | Purpose |
|---|---|
| `agent:assigned:claude` | Claude is implementing this — remove to re-dispatch |

Routines apply **both** a category label (for dedupe) and `automated/claude` (for discovery) on every issue or PR they author. The umbrella is what you filter on to see "everything any routine produced"; the category label is what the routine's code uses to decide "create new or append to existing."

**Source of truth (Phase 2 rollout)**: the canonical definitions of every automation label above live in the guild-wide manifest at `greenpill-dev-guild/.github/labels.yml`. Once the guild's label-sync reusable workflow is wired up, this repo's labels will be synced from that file automatically. Until then, maintain parity manually: `gh label create "<name>" --color "<hex>" --description "<purpose>"`.

## Project board coordination

`gg-client-polish` and `gg-admin-polish` (producers) and `gg-auto-implement` + `gg-hotfix` (implementers) coordinate through two GitHub Projects under `greenpill-dev-guild`:

| Project | Purpose | Starting column | Used by |
|---|---|---|---|
| **#4 "Green Goods"** | General kanban — audit findings, ops anomalies, features | `Backlog` | Audit-dimension polish (`polish + {design, testing, architecture, performance, quality}`), health, metrics, grant |
| **#18 "Bug Board"** | Dedicated triage for user-reported bugs | `To triage` | Source-tagged polish (`polish + source:discord`, `polish + source:telegram`) |

Both boards share the lane structure `{starting} → Ready → In progress → In review → Done`.

### Lifecycle

1. **Producer creates + attaches** — `gg-client-polish` or `gg-admin-polish` creates an issue, applies labels, attaches it to the matching board in the starting column (`Backlog` or `To triage`). Admin polish always goes to `Backlog` on #4 (no user-reported admin bugs, no fast lane).
2. **Human triages (the only manual step)** — move items you want auto-fixed to `Ready`. That movement IS the approval signal; no comment, no label, just the column change.
3. **Fast-lane bypass** — `gg-auto-implement` auto-dispatches issues carrying `polish + source:discord` or `polish + source:telegram` at priority p2 straight from `To triage`, because being reported by a user is already a triage act. All other issues require the `Ready` column.
4. **Implementer dispatches + implements + opens PR** — one of two paths:
   - **`gg-auto-implement` (morning)** — picks audit findings + user-reported p2 (fast lane) from `Ready`/`To triage`, bundles related fixes, opens PRs against `develop`.
   - **`gg-hotfix` (every 4h during the day)** — picks user-reported p2 from `Ready` ONLY (no fast lane), solo PRs against `main`, full-suite validation. For bugs affecting live gardeners that shouldn't wait for the next develop→release cycle.

   Both apply `agent:assigned:claude` and move Status to `In progress`. GitHub's default project automation flips to `In review` when the linked PR opens.
5. **Human reviews the PR** — merge, request changes, or close. The PR is where the user's other focal surface lives.
6. **Done** — issue auto-closes on merge via `Closes #N` in the PR body; board moves to `Done`.

### Never auto-dispatched

- p1 from any source — skipped silently by both implementers (gg-auto-implement + gg-hotfix). Needs human ownership.
- Anything touching critical paths from the CLAUDE.md criticality matrix (contracts, providers, job-queue, auth/work/vault/blockchain hooks) — rejected up-front by both implementers' criticality gates.
- Any issue with an existing linked PR (human- or agent-authored) — no dispatch racing.

### Re-dispatching

To force gg-auto-implement to retry an issue it already handled (bundle aborted, PR closed without merge, etc.), remove the `agent:assigned:claude` label manually. The issue becomes eligible again on the next run if all other gates still pass.

## Bot API environment

Routines that consume Telegram feedback need these additional environment variables:

| Variable | Description |
|---|---|
| `BOT_API_URL` | Public URL of the Green Goods agent (e.g., `https://agent.greengoods.app`) |
| `BOT_API_TOKEN` | Bearer token for authenticating API requests to the agent |

Used by: `gg-client-polish` (read + respond), `gg-morning-watch` (read-only).
