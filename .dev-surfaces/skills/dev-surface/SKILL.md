---
name: green-goods-dev-surface
description: Use when working in Green Goods and needing the local client, admin, docs, Storybook, agent, indexer, or Anvil Arbitrum fork.
---

# Green Goods Dev Surface

Inside this repo, use the repo-native command:

```sh
bun install
# configure .env from .env.template/.env.schema
bun run dev
```

`bun run dev` runs `node scripts/dev/stack.js full`. It starts the full PM2-backed local stack, streams logs in the foreground, opens review URLs through the repo browser helper, and cleans up PM2 services on Ctrl-C.

Expected ports:

- `3001`: client PWA and editorial website
- `3002`: admin UI
- `3003`: docs
- `3004`: Storybook
- `3005`: agent/API
- `3006`: indexer GraphQL/Hasura
- `3007`: indexer service
- `3008`: indexer Postgres
- `3009`: Anvil Arbitrum fork

Local chain mode defaults to Arbitrum fork mode. For transaction QA, add RPC `http://127.0.0.1:3009` with chain id `42161` to a dedicated dev browser wallet and use an Anvil-funded private key from the Anvil logs. Mock-auth URLs do not sign transactions.

Useful native commands:

```sh
bun run dev
bun run dev:web
bun run dev:health
bun run dev:stop
bun run dev:contracts:arbitrum-fork
```

For cross-repo orchestration from anywhere, use the global workbench:

```sh
dev launch green-goods
dev launch green-goods:client
dev status green-goods
dev health green-goods
dev stop green-goods
```

Do not call `.dev-surfaces/run.mjs`; this repo should not have that wrapper.
