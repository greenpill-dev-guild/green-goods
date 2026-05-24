---
name: dev-surface
description: Use when working in Green Goods and needing to start, reuse, open, inspect, validate, or clean up this repo's local development surfaces through the shared dev-surfaces workbench.
---

# Green Goods Dev Surface

Use the global workbench CLI instead of starting duplicate servers manually:

```sh
dev-surfaces status
dev-surfaces up green-goods
dev-surfaces open green-goods
dev-surfaces logs green-goods:<surface>
dev-surfaces down green-goods
```

Stable fallback path: `/Users/afo/Code/dev-surfaces/bin/dev-surfaces.js`.

## Surfaces

- `client`: client PWA + editorial website on `3001`
- `admin`: admin UI on `3002`
- `docs`: docs on `3003`
- `storybook`: Storybook on `3004`
- `agent`: agent/API on `3005`
- `indexer-graphql`: indexer GraphQL/Hasura plus service/Postgres on `3006`, `3007`, `3008`
- `anvil`: Anvil/local chain on `3009`

## Validation Notes

- Open `green-goods:client` for both PWA and editorial website review URLs.
- Storybook lives in `packages/shared` and aggregates shared, admin, and client stories.
- The workbench starts `agent` in local HTTP API-only mode on `3005`; it does not register Telegram webhooks or start polling.
- `indexer-service` and `indexer-postgres` are provided by `indexer-graphql`; start `green-goods:indexer-graphql` when the indexer stack is needed.
- Use `dev-surfaces down green-goods` for cleanup instead of killing ports.
- After changing local port docs or dev scripts, run `dev-surfaces doctor`.

Never kill unknown port occupants. If a port is busy and not owned by dev-surfaces, report the PID/command and ask for direction.
