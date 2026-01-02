# Green Goods

Green Goods is an offline-first, single-chain platform for documenting conservation work and proving impact on-chain. Operators approve gardener submissions, and the protocol anchors the results in Ethereum attestation infrastructure.

## Quick Start

```bash
git clone https://github.com/your-org/green-goods.git
cd green-goods
npm setup                     # Checks deps, installs packages, creates .env from template

vi .env                       # Populate keys (Base Sepolia is the default chain: 84532)

bun dev                       # Starts client, admin, indexer via pm2
```

> **Note**: `npm setup` checks for required dependencies (Node 20+, Bun, Git, Docker, Foundry), installs them if possible, runs `bun install`, and copies `.env.example` to `.env`. If you prefer manual setup, see [Installation Guide](./docs/developer/installation.md).

Useful follow-ups:

- `bun dev:stop` — stop the pm2 services
- `bun exec pm2 logs <service>` — stream logs for `client`, `admin`, or `indexer`

## Common Commands

```bash
# Format, lint, test across the workspace
bun format && bun lint && bun test

# Build everything or target a package
bun build
bun --filter client build

# Contracts: compile, test, deploy through the wrappers
bun --filter contracts build
bun --filter contracts test
bun --filter contracts deploy:testnet    # runs deploy.js with the correct profile
```

Scripts live in `package.json`; contract-specific flows are described in the Contracts Handbook.

## Documentation

- [System Architecture](./docs/developer/architecture.md) — full system map and package summaries (GitBook canonical doc)
- [Developer Getting Started](./docs/developer/getting-started.md) — environment setup, testing, troubleshooting
- [Contracts Handbook](./docs/developer/contracts-handbook.md) — deployment, upgrades, schema care, validation
- [IPFS Deployment](./docs/developer/ipfs-deployment.md) — decentralized app deployment via Storacha + Pinata
- [Product Overview](./docs/features/overview.md) — product architecture and data flow
- [Karma GAP Integration](./docs/developer/karma-gap.md) — appendix for the GAP attestation bridge

Package-specific READMEs:

- `packages/client/README.md` — offline-first PWA
- `packages/admin/README.md` — operator dashboard
- `packages/indexer/README.md` — Envio indexer
- `packages/contracts/README.md` — foundry project layout and scripts

## Contributing

- Stick to conventional commits (`feat(client): …`)
- Run `bun format && bun lint && bun test` before opening PRs
- Keep environment-only secrets in the root `.env` and never add package-level `.env` files

For more project background, automation guidelines, and tooling policies see `AGENTS.md` and the package-specific agent guides.
