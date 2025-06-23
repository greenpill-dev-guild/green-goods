# Green Goods Local Development Guide

## Prerequisites

- Node.js v20+
- pnpm v9+
- Foundry (for smart contracts)
- PostgreSQL (for indexer) - optional, can use Docker

## Quick Start

```bash
# Install dependencies
pnpm install

# Setup environment
pnpm setup:local

# Start development environment
pnpm dev

# Monitor health
pnpm monitor
```

## Services

| Service | URL | Description |
|---------|-----|-------------|
| Anvil | http://localhost:8545 | Local blockchain fork |
| Client | https://localhost:3001 | React app (accept self-signed cert) |
| Indexer | http://localhost:8080 | GraphQL API |
| Contracts | - | Auto-deployed on startup |

## Development Commands

```bash
# Main commands
pnpm dev          # Start all services (optimized)
pnpm monitor      # Check service health
pnpm test         # Run all tests
pnpm test:e2e     # Run Playwright E2E tests

# Individual services
pnpm --filter client dev         # Start client only
pnpm --filter contracts build    # Build contracts
pnpm --filter indexer dev:local  # Start indexer
```

## Environment Setup

The development environment automatically:
1. Forks Arbitrum mainnet
2. Deploys all contracts
3. Starts the indexer with PostgreSQL
4. Launches the React client

### Database Setup (for Indexer)

```bash
# Option 1: Docker
docker run -d \
  --name greengoods-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=greengoods_indexer \
  -p 5432:5432 \
  postgres

# Option 2: Local PostgreSQL
createdb greengoods_indexer
```

## Testing

### Unit Tests
```bash
pnpm test
```

### E2E Tests (Playwright)
```bash
# Run in headless mode
pnpm test:e2e

# Run with UI
pnpm test:e2e:ui

# Debug mode
pnpm test:e2e:debug
```

## Troubleshooting

### Indexer not starting
- Ensure PostgreSQL is running
- Check database connection in `.env`

### Client certificate warning
- This is normal for local development
- Accept the self-signed certificate in your browser

### Port conflicts
```bash
# Check what's using a port
lsof -i :8545  # Anvil
lsof -i :3001  # Client
lsof -i :5432  # PostgreSQL
```

## Architecture

```
green-goods/
├── packages/
│   ├── client/       # React frontend
│   ├── contracts/    # Smart contracts
│   └── indexer/      # Envio indexer
├── scripts/          # Dev tools
└── docs/            # Documentation
```

## Performance

- Anvil: ~50ms response time
- Memory: ~750MB for full stack
- Startup: ~20 seconds

## Tips

1. Use `pnpm monitor` regularly
2. Restart services if memory > 2GB
3. Check logs for detailed debugging
4. Use Chrome DevTools for frontend debugging 