# Green Goods

[![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)](https://github.com/greenpill-dev-guild/green-goods/releases/tag/v0.4.0)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Bringing community and environmental actions onchain to better measure, track and reward impact.**

Green Goods is an offline-first platform for documenting ecological and social work and proving impact on-chain. Operators approve gardener submissions, and the protocol anchors results in Ethereum attestation infrastructure.

## Quick Start

```bash
git clone https://github.com/greenpill-dev-guild/green-goods.git
cd green-goods
bun setup    # Checks deps, installs packages, creates .env
bun dev      # Starts all services via PM2
```

**Services:** Client PWA (localhost:3001) • Admin (localhost:3002) • Indexer (localhost:8080) • Storybook (localhost:6006)

## Documentation

📖 **[docs.greengoods.app](https://docs.greengoods.app)** — Full documentation for users and developers

- [Developer Quickstart](https://docs.greengoods.app/welcome/quickstart-developer) — Detailed setup guide
- [Architecture](https://docs.greengoods.app/developer/architecture) — System design and diagrams
- [API Reference](https://docs.greengoods.app/developer/api-reference) — GraphQL and contract APIs
- [Contributing](https://docs.greengoods.app/developer/contributing) — Guidelines for contributors
- [Dependency Management](.claude/skills/dependency-management/SKILL.md) — Workspace dependencies, lockfile, and audit/update workflow

## Contributing

Run `bun format && bun lint && bun test` before opening PRs.
