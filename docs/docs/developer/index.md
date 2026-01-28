# Developer Documentation

Quick navigation for Green Goods developers organized by your learning journey.

---

## Getting Started

New to the codebase? Start here.

- [Quick Start](getting-started.md) — Setup in 5 minutes
- [Full Installation](installation.md) — Detailed setup options and troubleshooting

---

## Architecture

Understanding how the system fits together.

- [System Overview](architecture.md) — How all packages connect
- [Diagrams](diagrams.md) — Visual architecture and data flows

**Packages:**

| Package | Description |
|---------|-------------|
| [Shared](shared.md) | Hooks, modules, types — **start here for feature work** |
| [Client](client.md) | Offline-first PWA for gardeners |
| [Admin](admin.md) | Dashboard for operators |
| [Contracts](contracts.md) | Solidity smart contracts |
| [Indexer](indexer.md) | Envio GraphQL API |
| [Agent](agent.md) | Multi-platform bot |

**Feature Deep Dives:**

- [Hypercerts](hypercerts.md) — Impact certification (architecture and minting flow)
- [Gardener Accounts](gardener-accounts.md) — ERC-4337 smart accounts with Pimlico

---

## Building Features

Patterns and guides for implementation.

- [Shared Package Guide](shared.md) — Hooks, modules, query keys (read first!)
- [Error Handling](error-handling.md) — Categories, toasts, recovery patterns
- [Testing Guide](testing.md) — Test patterns and coverage targets
- [Theming](theming.md) — CSS variables and theme system
- [Offline Patterns](client.md#offline-first) — Job queue and sync (in Client docs)

---

## Data & APIs

Consuming Green Goods data.

- [API Reference](api-reference.md) — Contract interfaces and GraphQL schemas
- [Karma GAP](karma-gap.md) — Impact attestation integration

---

## Deployment & Operations

Going to production.

- [Releasing](releasing.md) — Release process and versioning
- [Contracts Handbook](contracts-handbook.md) — Deployment, upgrades, schemas
- [IPFS Deployment](ipfs-deployment.md) — Storacha/W3UP setup
- [Monitoring](monitoring.md) — Operations and observability

---

## Contributing

- [Contributing Guide](contributing.md) — How to contribute
- [Documentation Guide](docs-contributing.md) — Writing and updating docs
- [Docs Deployment](docs-deployment.md) — Publishing documentation

---

## Quick Links

| Need to... | Go to... |
|------------|----------|
| Set up dev environment | [Installation](installation.md) |
| Understand the codebase | [Architecture](architecture.md) |
| Add a React hook | [Shared Package](shared.md) |
| Work with Hypercerts | [Hypercerts](hypercerts.md) |
| Query data | [API Reference](api-reference.md) |
| Deploy contracts | [Contracts Handbook](contracts-handbook.md) |
| Run tests | [Testing Guide](testing.md) |
| Make a release | [Releasing](releasing.md) |
