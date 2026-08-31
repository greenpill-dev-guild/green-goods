# Green Goods Admin Canvas

Operator canvas for Green Goods stewards and deployers.

## Contract

- Admin UI authority: [`AGENTS.md`](./AGENTS.md), [`DESIGN.md`](./DESIGN.md), exported primitives, and guard tests. The [Admin Builder guide](https://docs.greengoods.app/builders/packages/admin) is the public navigation layer.
- Canonical shell: `CanvasLayout`
- Canonical routes: `/hub`, `/garden`, `/community`, `/actions`, `/profile`
- Secondary admin flows stay under `/garden/create`, `/garden/impact/*`, and `/community/*`
- Public garden URLs (`/gardens`, `/gardens/:id`, `/gardens/:id/*`) redirect to the client app

## Ownership

- `@green-goods/shared` owns reusable primitives, Storybook-backed foundations, and shared config helpers.
- `packages/admin` owns canvas shell composition and admin-only workflows.
- Do not add package-local `config/`, `utils/`, `hooks/`, or primitive UI shims when the behavior belongs in shared.

## Commands

```bash
bun --filter admin dev
bun --filter admin test
bun --filter admin build
```

## Deployment

Admin is a static Vite SPA. Use the root environment only, select the target chain explicitly,
and build from the repository root so contract and shared dependencies resolve first:

```bash
VITE_CHAIN_ID=42161 bun run build:admin
```

Deploy `packages/admin/dist/` and preserve the SPA rewrite in `packages/admin/vercel.json` so
client-side routes serve `index.html`. The app enforces steward access through onchain Hats checks;
it has no separate authentication backend.

The Vercel project runs the ordinary production build. PostHog source maps are produced, uploaded,
and removed only by the trusted `admin.yml` workflow on `main`. Do not set
`GG_ENABLE_SOURCEMAPS` in Vercel, because that would publish browser source maps.
