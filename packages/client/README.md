# Green Goods client

The client is the public website and installed PWA for Green Goods. People browse gardens,
join communities, document work, and follow reviewed contributions. Public browser routes and
the signed-in application use separate shells; see [AGENTS.md](./AGENTS.md) before changing them.

## Start here

Follow [onboarding](../../ONBOARDING.md) once from the repository root. Public contributors use
hosted APIs with `bun run dev -- prod`. Team members use `bun run dev` for connected local services.
Both target live Arbitrum; confirmed transactions are real. Public browsing does not prove that
authentication, uploads, or write actions are configured.

For a client-only launch after dependencies and environment are ready:

```bash
bun run dev -- client
```

Open [the website](https://localhost:3001/?presentation=website) or
[the PWA presentation](https://localhost:3001/?presentation=pwa).
A narrow launch keeps local API URLs and does not start the Agent or indexer.

## Working in this package

- Routes and presentation selection: [src/config](./src/config).
- Screens and components: [src/views](./src/views) and [src/components](./src/components).
- Reusable hooks, providers, stores, and domain logic: [Shared](../shared/README.md).
- Vite and PWA build configuration: [vite.config.ts](./vite.config.ts).

Use the root `.env` only. Shared imports must use declared package exports.

## Validate a change

Commands below run from the repository root. Replace the test path with a real affected test.

```bash
bun run validation:plan -- --intent qa
bun run --cwd packages/client test src/path/to/changed.test.tsx
```

For build or route risk, select the application build through the validation plan. The root
`build:client` command builds upstream dependencies first. Package-native `dev`, `test`, and
`build` remain available for focused work and process supervision.

For visible changes, follow the authenticated Brave proof procedure in [AGENTS.md](./AGENTS.md).
See the [validation policy](../../.claude/context/validation-pipeline.md) for broader checks and
[the generated command inventory](../../docs/docs/builders/packages/commands.mdx) for all scripts.
