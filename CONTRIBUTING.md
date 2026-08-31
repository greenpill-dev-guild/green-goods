# Contributing to Green Goods

Green Goods is open source infrastructure stewarded by the Greenpill Dev Guild. This file is the repo-level quick reference; the full contributor guide lives at [docs.greengoods.app/builders/how-to-contribute](https://docs.greengoods.app/builders/how-to-contribute).

## First Setup

Install Node.js 22+ and Git first. Install Docker Desktop if you plan to run the full stack or indexer locally.

```bash
git clone https://github.com/greenpill-dev-guild/green-goods.git
cd green-goods
npm run setup
bun run dev:health
bun run dev
```

`npm run setup` is the only normal npm entrypoint. It installs Bun if needed, installs workspace dependencies, and creates the root `.env` from `.env.schema`. After setup, use `bun run ...` for repo scripts.

## Contribution Flow

1. Pick a scoped task from the Linear backlog (or discuss the change with maintainers first via Discord/Telegram). Green Goods tracks all work in Linear — GitHub is for PRs and code review only.
2. Create a focused branch from `develop` (see [Branch Model](#branch-model) below).
3. Keep the change inside the smallest sensible package boundary.
4. Add or update tests when behavior changes.
5. Open a pull request into `develop` with what changed, why it changed, and how you validated it.

## Branch Model

Green Goods runs a **staging → production** flow:

- **`develop`** is the integration/staging branch. Open your PRs here; merges to `develop` deploy to staging for validation.
- **`main`** is production. Maintainers promote `develop → main` once changes are validated on staging.

Branch from `develop` and PR into `develop`. Don't target `main` directly except for a documented hotfix.

### Releases and hotfixes

Green Goods ships a **monthly release** at the start of each month (minor bump: `1.1.0` → `1.2.0`; patch for hotfixes; major for breaking). Releases are cut from a `release/<ship-month>-<version>` branch off `develop`, versioned with `bun run version:bump <x.y.z>`, checked with `bun run version:check <x.y.z>`, PR'd into `main`, and tagged `vX.Y.0` after merge. Pushing the tag triggers `.github/workflows/release.yml`, which creates the GitHub Release from the merged production history.

After every release or hotfix, fetch the merged `main` branch and merge it back into `develop`. Never open a back-merge PR with `main` as the head branch: GitHub is configured to delete merged PR head branches. If direct back-merge is unavailable, push `origin/main` to a temporary `chore/backmerge-main-<date>` branch and use that branch as the PR head.

Hotfixes branch from `main`, use a patch version, follow the same tag workflow, and are also back-merged to `develop`. Release source-map upload jobs run on the trusted `main` push and must be checked separately because they are not part of the PR CI Gate.

### PR gate

Both branches are protected: the **CI Gate** is the required aggregate check for a pull request to merge, and it passes only after every CI check triggered for that PR succeeds. Maintainers keep an admin fast-path for docs/trivial/hotfix changes only. (Required reviewer approval turns on as the contributor base grows; until then, CI Gate is the required check — it already applies to every PR, including maintainers'.)

## Funding and Bounties

Green Goods does not run open-ended bounties. Paid implementation work is grant-dependent and must be clearly scoped with maintainers before work begins.

If compensation is part of the work, confirm the scope, budget, acceptance criteria, and review path in writing before implementing. Unlabeled issues and general roadmap items should not be treated as funded tasks.

## Quality Gate

Run the lightest validation that honestly proves your change. Before opening a normal pull request, expect to run:

```bash
bun run format:check
bun run lint
bun run check:source-structure
bun run test
bun run build
```

If formatting fails, run `bun run format`, then rerun `bun run format:check`.

For E2E or authentication changes, run the matching Playwright CI project: client work uses
`PLAYWRIGHT_APP=client APP_ENV=test bunx playwright test --project=client-ci`; admin work uses
`PLAYWRIGHT_APP=admin APP_ENV=test bunx playwright test --project=admin-ci`.

## Repo Rules

- Use `bun run test`, never `bun test`.
- Use root `.env` only; do not add package-level env files.
- Keep React hooks in `@green-goods/shared`.
- Use the `Address` type for Ethereum addresses.
- Use shared `logger`, not `console.log`.
- Add new user-facing app strings to `en`, `es`, and `pt`.
- Read the nearest `AGENTS.md` before editing a package.
- Read the relevant workflow guidance in [`.claude/skills/`](.claude/skills/) before cross-cutting work.

## Community

Follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Report security issues through the [Security Policy](./SECURITY.md), not public issues.
