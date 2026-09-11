# Onboarding to Green Goods

Use this procedure with a coding agent or follow it yourself. The [README](README.md)
explains the product; [AGENTS.md](AGENTS.md) owns repository rules. Run commands from
the repository root unless a command specifies `--cwd`.

## Before setup

1. Read `AGENTS.md`, inspect the current branch and working-tree changes, and preserve
   work belonging to other sessions. Do not switch branches during shared-checkout work.
2. Check Node, Bun, Git, and existing dependencies. Use the versions in
   [.mise.toml](.mise.toml); Node must be version 22. Use WSL2 on Windows.
3. Inspect existing services with `bun run dev -- status`. Reuse compatible services;
   only the owning session may stop them. Missing dependencies may prevent status from running.
4. Choose the public-contributor path without shared credentials, or the team path
   with 1Password access and Docker. Do not print environment values or credentials.

Setup may install dependencies and missing tools. Agents must honor the installation
permissions in `AGENTS.md`; if installation is not authorized, report that dependency
before proceeding. An existing root `.env` is preserved on setup reruns.

## Public contributor path

The isolated profile works on a local machine as well as in a worktree or container.
It avoids host-tool installation and writes non-secret defaults only when `.env` is absent.

```bash
npm run setup -- --profile isolated
bun run dev:health -- prod
bun run dev -- prod
```

When Bun is already available, `bun run setup -- --profile isolated` uses the same setup.
The hosted mode starts local client, admin, docs, and Storybook, using production APIs.
It needs neither team secrets nor a local indexer for public browsing. Missing credentials
for passkeys, wallets, or uploads remain capability limits, not proof of a broken public setup.

Open the printed client URL and browse public gardens. The admin sign-in/access gate is
expected without steward credentials. Do not claim privileged workflows are verified.
**Hosted mode permits real wallet-confirmed Arbitrum transactions; browsing verification
must not submit transactions.**

## Team path

Start OrbStack or Docker Desktop before launching local indexer services.

Existing `.env` files are kept. Review readiness before explicitly replacing local credentials.
**Confirmed transactions affect live Arbitrum.**

```bash
npm run setup -- --profile host
test -f .env || bun run env:sync
bun run env:check
bun run dev:health
bun run dev
```

Host setup reports how to configure the environment; it does not fetch shared secrets.
If `.env.template` is absent, use `bun run env:template:init`, populate the required team
references, and then sync. The [environment guide](https://docs.greengoods.app/builders/env-management)
explains 1Password access and personal credentials. Never create package-level env files.

The default stack starts local client, admin, agent, and Docker indexer against **live
Arbitrum One**. Confirmed wallet and passkey transactions are production transactions.
`ENVIO_API_TOKEN` supports reliable indexer replay; service health alone does not prove
that replay has caught up. Uploads and messaging require their own service credentials.

## Development modes

Use `bun run dev -- <mode>`, with the same mode for health and smoke:

| Mode | Local services | Chain and data |
|---|---|---|
| `local` | admin, client, agent, indexer | Default; live Arbitrum and local APIs |
| `full` | docs, admin, client, agent, indexer, storybook, browser | Live Arbitrum and local APIs |
| `fork` | anvil-arbitrum, admin, client, agent, indexer | Local Arbitrum fork; indexer still reads live networks |
| `web` | docs, admin, client, storybook, browser | Live chain; local APIs must already be available |
| `prod` | docs, admin, client, storybook, browser | Live chain and hosted APIs |
| `prod-mirror` | docs, admin, client, indexer, storybook, browser | Live chain, hosted agent, local live-data indexer |

Service names select a narrower launch: `bun run dev -- client admin` does not start
its agent or indexer dependencies. Stop the owning launcher before changing modes.

For fork testing, use a dedicated browser profile and a disposable Anvil-funded wallet.
Local account details are in `packages/contracts/.generated/runtime/arbitrum-fork.json`.
Configure RPC `http://127.0.0.1:3009`, chain `42161`. The file redacts the upstream fork
endpoint. Restarting Anvil resets local chain state; the indexer does not ingest these
local writes. Passkeys are blocked in fork mode. Mock authentication does not sign transactions.

## Verify and hand off

Run `bun run dev:smoke -- <mode>` after startup. Automatic smoke checks reachability and,
for connected modes, chain/indexer readiness. It submits no transactions. If replay is
behind, leave the owning launcher running and rerun smoke after catch-up.

For local agent browser verification, follow `AGENTS.md` and use the authenticated Brave
extension path. If it cannot be reached, report browser proof as blocked. Do not substitute
an isolated browser profile or report HTTP checks as authenticated UI proof.

Keep the launcher in the foreground; Ctrl-C stops only its services. A detached stop uses
`GREEN_GOODS_DEV_OWNER=<same-owner> bun run dev -- stop`. Never stop an unknown listener.

Finish onboarding by reporting:

- The setup path, selected mode, and URLs that were actually verified.
- Missing credentials, services, or browser access and the workflows they block.
- The package that owns the contributor's first task and its nearest `AGENTS.md`.
- The next targeted check selected with `bun run validation:plan -- --intent qa`.

Use [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution process and
[the command reference](scripts/README.md) for specialist tooling. Agent-specific harness
notes belong in [CLAUDE.md](CLAUDE.md), not in this procedure.
