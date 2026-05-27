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

1. Pick a scoped GitHub issue or discuss the change with maintainers first.
2. Create a focused branch from the active base branch.
3. Keep the change inside the smallest sensible package boundary.
4. Add or update tests when behavior changes.
5. Open a pull request with what changed, why it changed, and how you validated it.

## Funding and Bounties

Green Goods does not run open-ended bounties. Paid implementation work is grant-dependent and must be clearly scoped with maintainers before work begins.

If compensation is part of the work, confirm the scope, budget, acceptance criteria, and review path in writing before implementing. Unlabeled issues and general roadmap items should not be treated as funded tasks.

## Quality Gate

Run the lightest validation that honestly proves your change. Before opening a normal pull request, expect to run:

```bash
bun run format:check
bun run lint
bun run test
bun run build
```

If formatting fails, run `bun run format`, then rerun `bun run format:check`.

## Repo Rules

- Use `bun run test`, never `bun test`.
- Use root `.env` only; do not add package-level env files.
- Keep React hooks in `@green-goods/shared`.
- Use the `Address` type for Ethereum addresses.
- Use shared `logger`, not `console.log`.
- Add new user-facing app strings to `en`, `es`, and `pt`.
- Read the nearest `AGENTS.md` before editing a package.

## Community

Follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Report security issues through the [Security Policy](./SECURITY.md), not public issues.
