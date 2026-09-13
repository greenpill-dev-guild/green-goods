# Green Goods

[![Version](https://img.shields.io/github/v/tag/greenpill-dev-guild/green-goods)](https://github.com/greenpill-dev-guild/green-goods/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Community infrastructure for documenting, reviewing, and funding regenerative work.**

Green Goods helps communities organize environmental and social work, from tree planting
and waste collection to solar maintenance and education. A community workspace is called
a **garden**: it can represent a neighborhood, cooperative, campus, or local project.

Gardeners record their contributions through a mobile web app. Stewards review the evidence,
and approved work becomes an onchain record. Communities use these records alongside
shared governance and funding tools to coordinate their work and support contributors.

The repository includes the public website and installed PWA, the steward admin app,
smart contracts, shared application code, an event indexer, and a messaging/API service.
The PWA supports local drafts and queued submissions; connected capabilities depend on
the sign-in method and available services.

[Explore Green Goods](https://greengoods.app) · [Read the docs](https://docs.greengoods.app)

## Get started with your agent

Clone this repository, open it in your coding agent, and use this prompt:

```text
Read AGENTS.md and ONBOARDING.md. Help me set up Green Goods and understand
where to make my first contribution. Check what is already installed, choose
the public-contributor or team setup path with me, and explain any missing
credentials. Verify the supported workflow and report its limits. Preserve
existing environment files and other sessions' services.
```

[ONBOARDING.md](ONBOARDING.md) owns the complete procedure for Codex, Claude Code,
and other agents. [AGENTS.md](AGENTS.md) owns repository rules; the nearest package
guide explains the area you will edit.

## Manual setup

Use **Node 22** and Git. Exact tool versions are pinned in [.mise.toml](.mise.toml).
Use macOS or Linux; on Windows, use WSL2. Team full-stack development also needs
OrbStack or Docker. Contract work requires the pinned Foundry version.

```bash
git clone https://github.com/greenpill-dev-guild/green-goods.git
cd green-goods
```

Run commands from the repository root. `npm run setup` can install Bun when it is
missing; after that, use Bun for repository commands.

### Public contributors

This path creates a non-secret root `.env` and uses hosted APIs for public browsing.
It does not require shared team credentials or a local Docker indexer.

```bash
npm run setup -- --profile isolated
bun run dev:health -- prod
bun run dev -- prod
```

Open the client URL printed by the launcher. Authentication, uploads, and steward
workflows may require additional credentials or roles; public browsing does not prove them.
**This mode uses production APIs and live Arbitrum. Confirmed transactions are real.**

### Team members

Use the host profile and your team's 1Password access. Environment requirements and
recovery are explained in [Environment Management](https://docs.greengoods.app/builders/env-management).

Existing `.env` files are kept. Review readiness before explicitly replacing local credentials.
**Confirmed transactions affect live Arbitrum.**

```bash
npm run setup -- --profile host
test -f .env || bun run env:sync
bun run dev:health
bun run dev
```

Host setup installs dependencies and reports the environment steps; it does not create
a secret-filled `.env`. Use `bun run env:template:init` only if no template exists.
Keep personal credentials in the root `.env` and shared references in `.env.template`.

**Default development uses live Arbitrum**, with local client, admin, agent, and indexer
services. It does not start Anvil. Wallet and passkey confirmations can send real transactions.

## Everyday development

| Task | Command |
|---|---|
| Start the default local services | `bun run dev` |
| Include docs and Storybook | `bun run dev -- full` |
| Use an explicit local fork | `bun run dev -- fork` |
| Start selected services | `bun run dev -- client admin` |
| Check prerequisites for a mode | `bun run dev:health -- prod` |
| Check running services | `bun run dev:smoke` |
| Inspect service ownership | `bun run dev -- status` |
| Preview disposable-artifact cleanup | `bun run dev:clean -- --dry-run` |
| Select checks for a change | `bun run validation:plan -- --intent qa` |
| Run a focused package test | `bun run --cwd packages/client test path/to/example.test.tsx` |

Keep the launcher terminal open. **Ctrl-C stops services that launch owns** and preserves
indexed data. Detached stopping requires the same `GREEN_GOODS_DEV_OWNER` identity;
see [the command guide](scripts/README.md). Selected services do not automatically start
their dependencies.

The default launch checks service and indexer readiness automatically. If replay is still
catching up, services remain running; rerun the smoke check when ready. A reachable page
or healthy container does not establish that data or authenticated actions work.

Fork mode uses disposable Anvil wallets. Its indexer still mirrors live networks and
cannot display fork-only writes; passkey writes are blocked. See
[onboarding mode details](ONBOARDING.md#development-modes) before transaction testing.

## Contribute

Agree on a bounded task with maintainers. Linear holds the backlog; GitHub hosts code
and pull requests. Read [CONTRIBUTING.md](CONTRIBUTING.md) for branches, targeted
validation, and releases. Paid work requires an agreed scope and budget.

## Resources

- [Onboarding](ONBOARDING.md): first run, environment choices, and agent handoff
- [Developer guide](https://docs.greengoods.app/builders/getting-started): find your package
- [Architecture](https://docs.greengoods.app/builders/architecture): system boundaries
- [Commands](scripts/README.md): modes, diagnostics, and migration from old aliases
- [API index](https://docs.greengoods.app/builders/packages/api-index): generated package references
- [Contract operations](packages/contracts/deployments/README.md): simulation, broadcast, and verification
- [Code of conduct](CODE_OF_CONDUCT.md) · [Security policy](SECURITY.md) · [License](LICENSE)
