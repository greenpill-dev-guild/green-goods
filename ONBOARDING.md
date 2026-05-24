# Welcome to Greenpill Dev Guild

## How We Use Claude

Based on Afo's usage over the last 30 days:

Work Type Breakdown:
  Plan Design       █████████░░░░░░░░░░░  46%
  Improve Quality   ████░░░░░░░░░░░░░░░░  22%
  Build Feature     ███░░░░░░░░░░░░░░░░░  17%
  Write Docs        █░░░░░░░░░░░░░░░░░░░   7%
  Debug Fix         █░░░░░░░░░░░░░░░░░░░   4%

Top Skills & Commands:
  /clear            ████████████████████  85x/month
  /plugin           ████░░░░░░░░░░░░░░░░  16x/month
  /reload-plugins   ██░░░░░░░░░░░░░░░░░░   7x/month
  /clean            █░░░░░░░░░░░░░░░░░░░   6x/month
  /review           █░░░░░░░░░░░░░░░░░░░   6x/month
  /doctor           █░░░░░░░░░░░░░░░░░░░   5x/month
  /architecture     █░░░░░░░░░░░░░░░░░░░   4x/month
  /usage            █░░░░░░░░░░░░░░░░░░░   4x/month

Top MCP Servers:
  claude-in-chrome  ████████████████████  942 calls

## Your Setup Checklist

### Codebases
- [ ] green-goods — https://github.com/greenpill-dev-guild/green-goods (Bun monorepo: `packages/{contracts,indexer,shared,client,admin,agent}` + `docs/` at root)
- [ ] greenpill-dev-guild/.github — https://github.com/greenpill-dev-guild/.github (org-wide community defaults; only clone if you'll touch guild routines)

### Local Setup
- [ ] Follow the [Developer Getting Started guide](https://docs.greengoods.app/builders/getting-started) (`npm run setup`, then `bun run dev:web`).
- [ ] Read `CLAUDE.md` and `AGENTS.md` at the repo root before pairing with Claude — they encode invariants Claude will assume you know.
- [ ] Skim `.claude/context/<package>/` for whichever package you'll touch first.

### MCP Servers to Activate
- [ ] **claude-in-chrome** — Chrome/Brave extension that lets Claude read and drive a live browser tab. Heavy use here for admin UI review: reading rendered `data-component`/`data-region`/`data-workspace` attributes on the running admin app (see `.claude/skills/design/defect-grammar.md` for the workflow). Install the Claude browser extension, sign in, and grant tab access. Note: this is configured at the user level — the repo's `.mcp.json` is intentionally empty (see `docs/docs/builders/agentic/mcp-guide.mdx`).

### Skills to Know About
Slash-invokable (type the command):
- [ ] `/status` — Branch-first orientation when you sit down or return to a branch (read-only, ~30-60s). Start here.
- [ ] `/review [package|PR|file]` — Diff-scoped review before merge. Positional arg scopes the review (`/review admin`, `/review #123`).
- [ ] `/clean` — 8 parallel cleanup agents after findings are accepted (`--dry-run`, `--scope`, `--agents`).
- [ ] `/ship` — Pre-merge gate: format, lint, test, build, conventional-commit, vocab/design-token lint.
- [ ] `/architecture` and `/audit` — Internal lenses. `/architecture` for boundary/placement calls inside planning or review; `/audit` as a follow-up when broader drift shows up.

Intent-triggered (no slash — just describe it in plain English):
- [ ] `plan` — Fires on "plan this", "break down X", "coordinate a team", or cross-package work. Plans land in `.plans/active/<feature-name>/plan.todo.md`.
- [ ] `debug` — Fires when you describe a bug, paste a stack trace, or report a failing test.

Loaded by context (you usually don't pick these manually):
- [ ] `design` + `ui` — Warm Earth design language, M3 anatomy, Tailwind v4 + Radix + Storybook.
- [ ] Package skills — `react`, `contracts`, `indexer`, `data-layer`, `testing`, `web3`.

(Full skill index: `.claude/skills/index.md`.)

## Team Tips

These complement (not duplicate) `CLAUDE.md` — they're things that aren't already encoded in the project rules.

- **Run admin in Brave first, or Chrome/Chromium as a fallback, with the Claude browser extension installed.** That's why you'll see ~942 `claude-in-chrome` calls a month — Claude reads `data-component`/`data-region`/`data-workspace` off the live admin DOM during UI review. Without it, every admin UI change becomes guesswork.
- **Commit in scoped groups, not one mega-diff.** Working trees here often accumulate multiple unrelated changes; split them by package or concern using Conventional Commits (`feat(admin): ...`, `refactor(shared): ...`). Use `git add -p` if you need to slice a file.
- **For multi-lane work, dispatch Codex from Claude via `codex exec --full-auto`.** Claude stays the orchestrator. Codex is strong as a plan-follower and code reviewer, weak at visual polish — never delegate UI design work to it.
- **Don't make Claude "wait" — use `/loop` or `/schedule`.** `/loop <interval> <command>` for active polling; `/schedule` for cron-style remote routines (deploy checks, weekly sweeps, scheduled cleanup PRs).
- **Sibling repos live in `~/Code/greenpill/`** — `coop`, `gardens`, `network-website`, `cookie-jar`, etc. They share identity/chain/attestation infra with green-goods. Pull them down if your work crosses those boundaries.
- **Real-time coordination happens in [Telegram](https://t.me/+N3o3_43iRec1Y2Jh).** Drop in if you're stuck or pairing.

## Get Started

Your starter task: **set the repo up end-to-end and report back on the experience.** Onboarding feedback is the only way the next person's path gets smoother.

1. Run through **Local Setup** above: `npm run setup` → `bun run dev:doctor -- --profile web` → `bun run dev:web` → confirm client (`:3001`), admin (`:3002`), and docs (`:3003`) all respond.
2. Note every paper cut as you go — broken links, unclear steps, missing prereqs, env vars that weren't obvious, anything that made you pause.
3. Drop the feedback into Telegram or open an issue tagged `onboarding`. Concrete observations beat vague ones (`docs/builders/getting-started step 3 didn't mention X` > `setup was confusing`).

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
