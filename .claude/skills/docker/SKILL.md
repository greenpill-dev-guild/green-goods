---
name: docker
description: Docker and Docker Compose patterns - containerized services, volume management, networking, health checks, dev vs prod configs. Use for indexer Docker workflow, container debugging, and service orchestration.
version: "1.0"
last_updated: "2026-02-09"
last_verified: "2026-02-09"
status: proven
packages: [indexer]
dependencies: [deployment]
---

# Docker Skill

Docker and Docker Compose guide for Green Goods: containerized indexer stack, volume management, networking, health checks, and debugging.

---

## Activation

When invoked:
- Check existing `docker-compose.indexer.yaml` in `packages/indexer/` before creating new configs.
- Docker is primarily used for the indexer stack (PostgreSQL + Hasura + Envio indexer).
- On macOS, Docker is **required** because the native Envio indexer crashes due to a Rust `system-configuration` crate panic.

## Part 1: Indexer Stack Architecture

### Service Overview

```
┌─────────────────────────────────────────────────────────┐
│  Docker Compose Network: green_goods_indexer_network     │
│                                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │  PostgreSQL   │  │    Hasura     │  │   Indexer    │ │
│  │  :5433→5432   │←─│  :8080→8080  │←─│  :9898→9898  │ │
│  │  (storage)    │  │  (GraphQL)    │  │  (Envio)     │ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
│         ↓                                               │
│  indexer_db_data                                        │
│  (persistent volume)                                    │
└─────────────────────────────────────────────────────────┘
```

### Services

| Service | Image | External Port | Internal Port | Purpose |
|---------|-------|---------------|---------------|---------|
| `envio-postgres` | `postgres:17.5` | 5433 | 5432 | Indexed blockchain data storage |
| `graphql-engine` | `hasura/graphql-engine:v2.43.0` | 8080 | 8080 | GraphQL API over PostgreSQL |
| `indexer` | Custom (Dockerfile) | 9898 | 9898 | Envio indexer processing events |

### Dependency Chain

```
envio-postgres (healthy) → graphql-engine (healthy) → indexer
```

Each service waits for its dependency to be healthy before starting.

## Part 2: Commands

### Daily Development

```bash
# Start the full indexer stack
cd packages/indexer
docker compose -f docker-compose.indexer.yaml up --build

# Or use PM2 (recommended — handles macOS Docker automatically)
bun dev  # From root — starts all services including Docker indexer

# View logs
docker compose -f docker-compose.indexer.yaml logs -f indexer
docker compose -f docker-compose.indexer.yaml logs -f graphql-engine

# Stop everything
docker compose -f docker-compose.indexer.yaml down

# Stop and remove data (fresh start)
docker compose -f docker-compose.indexer.yaml down -v
```

### Debugging

```bash
# Check service status
docker compose -f docker-compose.indexer.yaml ps

# Check health status
docker inspect --format='{{.State.Health.Status}}' packages-indexer-envio-postgres-1

# Execute commands in running container
docker compose -f docker-compose.indexer.yaml exec envio-postgres psql -U postgres -d envio-dev

# View PostgreSQL data
docker compose -f docker-compose.indexer.yaml exec envio-postgres psql -U postgres -d envio-dev -c "SELECT count(*) FROM raw_events;"

# Check Hasura console
# Open http://localhost:8080/console (admin secret: "testing")

# View indexer container logs with timestamps
docker compose -f docker-compose.indexer.yaml logs -f --timestamps indexer
```

### Rebuilding

```bash
# Rebuild after Dockerfile changes
docker compose -f docker-compose.indexer.yaml up --build

# Force full rebuild (no cache)
docker compose -f docker-compose.indexer.yaml build --no-cache

# Rebuild only the indexer service
docker compose -f docker-compose.indexer.yaml build indexer
```

## Part 3: Volume Management

### Persistent Data

The PostgreSQL data is stored in a named volume `indexer_db_data`:

```yaml
volumes:
  indexer_db_data:  # Persists across container restarts
```

### Development Hot Reload

Source files are mounted read-only for hot reloading:

```yaml
volumes:
  - ./src:/app/src:ro              # Indexer source code
  - ./config.yaml:/app/config.yaml:ro  # Envio config
  - ./schema.graphql:/app/schema.graphql:ro  # GraphQL schema
```

The `:ro` flag prevents the container from modifying host files.

### Volume Operations

```bash
# List volumes
docker volume ls | grep indexer

# Inspect volume (see mount point)
docker volume inspect packages-indexer_indexer_db_data

# Remove data volume (clean slate)
docker compose -f docker-compose.indexer.yaml down -v

# Backup database
docker compose -f docker-compose.indexer.yaml exec envio-postgres pg_dump -U postgres envio-dev > backup.sql

# Restore database
cat backup.sql | docker compose -f docker-compose.indexer.yaml exec -T envio-postgres psql -U postgres envio-dev
```

## Part 4: Health Checks

### PostgreSQL

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 5s
  timeout: 5s
  retries: 5
```

### Hasura

```yaml
healthcheck:
  test: timeout 1s bash -c ':> /dev/tcp/127.0.0.1/8080' || exit 1
  interval: 5s
  timeout: 2s
  retries: 50
  start_period: 5s
```

Hasura has a longer retry count (50) because it needs to apply migrations on first start.

### Monitoring Health

```bash
# Quick health check for all services
docker compose -f docker-compose.indexer.yaml ps --format "{{.Name}}: {{.Status}}"

# Expected output:
# envio-postgres: Up (healthy)
# graphql-engine: Up (healthy)
# indexer: Up
```

## Part 5: Environment Variables

### Variable Flow

```
Root .env → docker-compose.indexer.yaml → Container environment
```

Docker Compose reads from the host environment (which includes root `.env` via PM2):

```yaml
environment:
  # Uses host env with fallback defaults
  ENVIO_PG_PORT: ${ENVIO_PG_PORT:-5433}
  ENVIO_PG_PASSWORD: ${ENVIO_PG_PASSWORD:-testing}
  ENVIO_PG_USER: ${ENVIO_PG_USER:-postgres}
  ENVIO_PG_DATABASE: ${ENVIO_PG_DATABASE:-envio-dev}

  # RPC URLs from host (no defaults — must be set)
  ARBITRUM_RPC_URL: ${ARBITRUM_RPC_URL:-}
  SEPOLIA_RPC_URL: ${SEPOLIA_RPC_URL:-}
```

### Default Credentials (Development Only)

| Variable | Default | Used By |
|----------|---------|---------|
| `ENVIO_PG_PASSWORD` | `testing` | PostgreSQL |
| `ENVIO_PG_USER` | `postgres` | PostgreSQL, Hasura, Indexer |
| `ENVIO_PG_DATABASE` | `envio-dev` | PostgreSQL, Hasura, Indexer |
| `HASURA_GRAPHQL_ADMIN_SECRET` | `testing` | Hasura console auth |

## Part 6: Networking

### Docker Network

All services communicate on a shared bridge network:

```yaml
networks:
  indexer-network:
    name: green_goods_indexer_network
```

### Service Discovery

Containers reference each other by service name (not `localhost`):

```yaml
# Hasura connects to PostgreSQL
HASURA_GRAPHQL_DATABASE_URL: postgres://postgres:testing@envio-postgres:5432/envio-dev

# Indexer connects to Hasura
HASURA_GRAPHQL_ENDPOINT: http://graphql-engine:8080
```

### Port Mapping

| Service | Container Port | Host Port | Access |
|---------|---------------|-----------|--------|
| PostgreSQL | 5432 | 5433 | `localhost:5433` from host |
| Hasura | 8080 | 8080 | `localhost:8080` from host |
| Indexer | 9898 | 9898 | `localhost:9898` from host |

PostgreSQL uses port 5433 on the host to avoid conflicts with any local PostgreSQL instance on 5432.

## Part 7: macOS Workaround

### The Problem

The native Envio indexer binary crashes on macOS due to a Rust `system-configuration` crate panic. This is a known upstream issue.

### The Solution

PM2 (`ecosystem.config.cjs`) detects macOS and automatically uses Docker Compose:

```javascript
// In ecosystem.config.cjs
{
  name: "indexer",
  script: process.platform === "darwin"
    ? "docker compose -f docker-compose.indexer.yaml up --build"
    : "npx envio dev",
  cwd: "packages/indexer",
}
```

### Developer Experience

From the developer's perspective, `bun dev` works identically on macOS and Linux — PM2 handles the Docker abstraction transparently.

## Part 8: Troubleshooting

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Port already in use | Another service on 5433/8080 | `lsof -i :5433` and stop the conflicting process |
| Hasura won't start | PostgreSQL not healthy yet | Wait for `retries: 50` or check PG logs |
| Indexer can't connect | Network DNS issue | `docker compose down && docker compose up` |
| Stale data after schema change | Old migrations cached | `docker compose down -v && docker compose up --build` |
| Permission denied on volume | macOS file sharing | Check Docker Desktop → Resources → File sharing |
| Build fails | Cached layers with old deps | `docker compose build --no-cache` |

### Nuclear Reset

When everything is broken and you need a completely fresh start:

```bash
cd packages/indexer

# Stop everything and remove volumes
docker compose -f docker-compose.indexer.yaml down -v

# Remove any orphaned containers
docker compose -f docker-compose.indexer.yaml down --remove-orphans

# Rebuild from scratch
docker compose -f docker-compose.indexer.yaml up --build
```

## Anti-Patterns

- **Never hardcode credentials in Dockerfile** — Use environment variables with defaults in compose
- **Never use `latest` tag for production images** — Pin specific versions (`postgres:17.5`, `hasura/graphql-engine:v2.43.0`)
- **Never mount source code as read-write in dev** — Use `:ro` to prevent container from modifying host files
- **Never skip health checks** — Services must wait for dependencies; remove health checks and you get race conditions
- **Never use `docker compose down -v` without thinking** — This deletes all indexed data; you'll need to re-index
- **Never commit Docker credentials** — Even dev defaults should come from environment
- **Never bypass the PM2 abstraction on macOS** — Use `bun dev`, not direct Docker commands (unless debugging)

## Quick Reference

```bash
# Start (recommended way)
bun dev                   # From root — PM2 handles Docker on macOS

# Manual Docker control
cd packages/indexer
docker compose -f docker-compose.indexer.yaml up --build      # Start
docker compose -f docker-compose.indexer.yaml down             # Stop
docker compose -f docker-compose.indexer.yaml down -v          # Stop + delete data
docker compose -f docker-compose.indexer.yaml logs -f indexer  # Stream logs
docker compose -f docker-compose.indexer.yaml ps               # Check status
```

## Related Skills

- `indexer` — Envio event handlers and schema design that run inside the container
- `deployment` — Production deployment of the indexer stack
- `monitoring` — Health checks and sync lag monitoring for running containers
- `debug` — Troubleshooting indexer issues through container logs
