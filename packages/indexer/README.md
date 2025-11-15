## Green Goods Indexer (Envio)

This package contains the Envio indexer for Green Goods contracts. It exposes a GraphQL API used by the client for gardens, actions, work, approvals, and attestations.

### Run

**First, ensure Docker Desktop is running:**
```bash
open -a Docker
# Wait 30 seconds for it to fully start
```

**Then start the indexer:**
```bash
bun dev
```

This command:
1. Checks Docker is accessible (fails fast with clear instructions if not)
2. Stops any running indexer instances
3. Installs ReScript dependencies in the `generated/` folder
4. Builds the ReScript code
5. Starts the indexer

Visit http://localhost:8080 to see the GraphQL Playground, local password is `testing`.

**Alternative commands:**
```bash
# Stop the indexer
bun stop

# Just setup ReScript dependencies
bun run setup-generated

# Start without automatic setup (assumes already setup)
bun run dev:manual
```

**If you get "Docker is not running" error:**
```bash
open -a Docker
# Wait 30 seconds
docker ps  # Verify it's working
bun dev
```

### Generate files from `config.yaml` or `schema.graphql`

```bash
bun codegen
```

After codegen, run `bun run setup-generated` to rebuild ReScript.

### Pre-requisites

- [Node.js (use v18 or newer)](https://nodejs.org/en/download/current)
- [bun (use v9 or newer)](https://bun.io/installation)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) - **Required** (script auto-starts it)

### Environment Variables

**All environment variables are configured in the root `.env` file** (at the monorepo root, not in this package).

The indexer automatically loads configuration from:
- Root `.env` file (shared across all packages)
- `config.yaml` (indexer-specific configuration)

**Indexer-relevant environment variables:**
```bash
# Optional - only needed if indexer requires specific API keys or overrides
# Most configuration is handled via config.yaml
```

The root `.env` is automatically loaded by the indexer's Docker Compose setup and development scripts.

### Entities (from `schema.graphql`)

- Gardens and Actions
- Work Submissions and Approvals
- EAS Attestations

### Client Configuration

- Default dev endpoint: `http://localhost:8080/v1/graphql`
- Override in client via `VITE_ENVIO_INDEXER_URL`

## Troubleshooting

### Docker Overlay Filesystem Errors

If you encounter errors like `failed to mount /var/lib/docker/rootfs/stargz` or `no such file or directory` with Docker:

**Quick Reset:**
```bash
bun reset
```

Or directly run:
```bash
./reset-indexer.sh
```

**Manual Reset:**
1. Restart Docker Desktop completely (Quit → Reopen)
2. Wait for Docker to fully start (check menu bar icon)
3. Run the reset script or manually clean up:
   ```bash
   # Stop containers and remove volumes
   docker compose down -v
   
   # Remove any lingering Envio containers
   docker ps -a --filter "name=generated-envio" --format "{{.ID}}" | xargs docker rm -f
   
   # Remove Envio volumes
   docker volume ls --filter "name=generated" --format "{{.Name}}" | xargs docker volume rm
   
   # Clean Envio state
   rm -rf generated/persisted_state.envio.json .envio
   
   # Prune Docker system
   docker system prune -f
   ```
4. Start fresh: `bun dev`

### ReScript Compilation Errors

If you encounter `Error: Cannot find module 'rescript-envsafe/src/EnvSafe.res.js'` or similar ReScript errors:

**Solution:**

The `bun dev` command now automatically handles this. If you still encounter issues:

```bash
# Reset and setup
bun reset
bun run setup-generated
bun run dev:manual
```

**Manual fix:**
```bash
cd generated
pnpm install
pnpm run build
cd ..
bun run dev:manual
```

**Why this happens:** ReScript needs dependencies installed locally in the `generated/` folder. Envio uses pnpm for proper Node.js module resolution, while bun's workspace hoisting puts dependencies at the root.

### Other Common Issues

- **Port 8080 already in use**: Stop other services using port 8080 or change the port in Envio config
- **Database connection issues**: Ensure Docker Desktop is running and containers are healthy
- **Code generation failures**: Run `bun codegen` to regenerate after schema changes
