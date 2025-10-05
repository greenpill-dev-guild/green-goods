## Green Goods Indexer (Envio)

This package contains the Envio indexer for Green Goods contracts. It exposes a GraphQL API used by the client for gardens, actions, work, approvals, and attestations.

### Run

```bash
pnpm dev
```

Visit http://localhost:8080 to see the GraphQL Playground, local password is `testing`.

### Generate files from `config.yaml` or `schema.graphql`

```bash
pnpm codegen
```

### Pre-requisites

- [Node.js (use v18 or newer)](https://nodejs.org/en/download/current)
- [pnpm (use v9 or newer)](https://pnpm.io/installation)
- [Docker desktop](https://www.docker.com/products/docker-desktop/)

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
pnpm reset
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
4. Start fresh: `pnpm dev`

### Other Common Issues

- **Port 8080 already in use**: Stop other services using port 8080 or change the port in Envio config
- **Database connection issues**: Ensure Docker Desktop is running and containers are healthy
- **Code generation failures**: Run `pnpm codegen` to regenerate after schema changes
