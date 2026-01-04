# Monorepo Structure

> **Audience:** Engineers touching multiple packages or coordinating cross-package work.
> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532). Deployment data lives in `packages/contracts/deployments/*.json`. Updated November 2024.

Green Goods is a Bun-based monorepo with four packages working together.

---

## Package Overview

| Package | Purpose | Tech | Port |
|---------|---------|------|------|
| **client** | Gardener PWA | React + Vite | 3001 |
| **admin** | Operator dashboard | React + Vite | 3002 |
| **indexer** | GraphQL API | Envio + PostgreSQL | 8080 |
| **contracts** | Smart contracts | Solidity + Foundry | - |

---

## Dependencies

```
client ──→ contracts (deployment artifacts)
admin ──→ contracts (deployment artifacts)
indexer ──→ contracts (ABIs)
```

**Single Source of Truth**: `packages/contracts/deployments/`

---

## Workspace Commands

```bash
# Run in specific package
bun --filter client dev
bun --filter contracts test

# Run in all packages
bun -r test
bun build

# From package directory
cd packages/client && bun dev
```

---

## Cross-Package Imports

**✅ Allowed**:
```typescript
import deployment from '../../../contracts/deployments/84532-latest.json';
import GardenABI from '../../../contracts/out/Garden.sol/Garden.json';
```

**❌ Forbidden**:
```typescript
import { helper } from '../../client/src/utils/helper'; // Don't import source
```

**Rule**: Only import deployment artifacts, never source code.

---

## Environment

**Single root `.env`**: All packages share the same file at repo root.

**Never** create package-specific `.env` files.

---

## Build Order

1. contracts (generates ABIs)
2. indexer (needs ABIs)
3. client (needs deployment JSON)
4. admin (needs deployment JSON)

**Run**: `bun build` handles order automatically.

---

## Learn More

- [Client Package](client-package.md)
- [Admin Package](admin-package.md)
- [Indexer Package](indexer-package.md)
- [Contracts Package](contracts-package.md)

