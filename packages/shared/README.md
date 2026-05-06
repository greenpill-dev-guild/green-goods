# @green-goods/shared

`@green-goods/shared` is the shared platform package for Green Goods. It owns the cross-app
hooks, providers, stores, modules, types, i18n catalogs, and Storybook-backed UI foundations
used by `client`, `admin`, and `agent`.

## Import Policy

- Prefer the root barrel: `@green-goods/shared`
- Use supported domain subpaths when they materially help testing, style imports, or operational
  boundaries: `components`, `hooks`, `providers`, `modules`, `stores`, `utils`, `types`,
  `styles`, `testing`, `mocks`, `workflows`
- Treat leaf entrypoints such as `cards`, `display`, `badge`, and `toast` as legacy
  compatibility paths. Keep existing usage working, but do not add new imports there.

```ts
import { AuthProvider, Surface, queryKeys, useAuthState } from "@green-goods/shared";
```

## Validation

From `packages/shared/`:

```bash
bun run typecheck
bun run test
bun run check:stories
```

When shared exports or public contracts move, also run from the repo root:

```bash
node scripts/dev/ci-local.js --quick
```

## Architecture Map

The canonical package contract lives in
[`src/MODULES.md`](./src/MODULES.md). Use that document for:

- current public entrypoints
- internal module boundaries
- provider, workflow, and store structure
- import policy and compatibility rules
