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

After `bun run dev` is up, run `bun run dev:smoke:full` for a current
full-local proof. It checks both client presentations, admin, docs, Storybook,
local agent `/health`, Anvil chain id `42161`, deployed Arbitrum bytecode on the
fork, funded Anvil accounts, local Envio/Hasura GraphQL, local indexer service
health, and the Postgres TCP listener. It never submits transactions.

For production-backed local review, use `bun run dev:prod` from the repo root.
It starts the local client, admin, docs, and Storybook against Arbitrum One, the
hosted production indexer, and `https://agent.greengoods.app`. It does not start
local Anvil, the local indexer, the local agent, or a tunnel. Wallet-confirmed
transactions are real Arbitrum writes in this mode; the automatic smoke is
read-only. Expected ports are `3001`-`3004` only; `3005`-`3009` should stay
free. From the shared workbench, inspect this mode with
`dev status green-goods:prod` or `dev health green-goods:prod`. Use
`dev launch green-goods:prod` only when you want the workbench to start and open
that explicit mode.

For indexer work against live Arbitrum, use `bun run dev:prod:mirror`. It starts
the same browser surfaces plus local Postgres/Hasura/Envio on ports `3006`-`3008`
while keeping the chain target at Arbitrum One. Expected ports are `3001`-`3004`
plus `3006`-`3008`; Anvil on `3009` should stay stopped. From the shared
workbench, inspect this mode with `dev status green-goods:prod-mirror` or
`dev health green-goods:prod-mirror`. Use `dev launch green-goods:prod-mirror`
only when you want the workbench to start and open that explicit mode.
`bun run dev:prod:mirror:health` requires `ENVIO_API_TOKEN`; without it, the
containers can start but HyperSync may rate-limit and the smoke should fail on
mirror lag.

`dev health all` still checks the default full-local Green Goods surface. When
production-backed Green Goods is the intentional active mode, use
`dev health green-goods:prod coop portfolio greenpill-network wefa`.

`bun run dev:prod:smoke` verifies local browser ports, Arbitrum RPC chain id
`42161`, deployed Arbitrum contract bytecode, production agent `/health`, indexer
GraphQL metadata, and indexer lag against Arbitrum head. It never submits
transactions. Use `--max-indexer-lag-blocks <blocks>` only when intentionally
debugging a stale indexer mirror.

Useful native commands:

```sh
bun run dev
bun run dev:web
bun run dev:smoke:full
bun run dev:prod
bun run dev:prod:health
bun run dev:prod:mirror
bun run dev:prod:mirror:health
bun run dev:prod:smoke
bun run dev:prod:smoke -- --mode mirror
bun run dev:health
bun run dev:stop
bun run dev:contracts:arbitrum-fork
```

For cross-repo orchestration from anywhere, use the global workbench:

```sh
dev launch green-goods
dev launch green-goods:client
dev launch green-goods:prod
dev launch green-goods:prod-mirror
dev status green-goods:prod
dev health green-goods:prod
dev status green-goods
dev health green-goods
dev stop green-goods
```

Do not call `.dev-surfaces/run.mjs`; this repo should not have that wrapper.
