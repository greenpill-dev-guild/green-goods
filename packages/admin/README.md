# Green Goods Admin Cockpit

Operator cockpit for Green Goods stewards and deployers.

## Contract

- Admin UI contract: [/Users/afo/Code/greenpill/green-goods/docs/docs/builders/packages/admin.mdx](/Users/afo/Code/greenpill/green-goods/docs/docs/builders/packages/admin.mdx)
- Canonical shell: `CockpitLayout`
- Canonical routes: `/work`, `/garden`, `/community`, `/actions`
- Secondary garden flows stay under `/gardens/create` and `/gardens/:id/...`

## Ownership

- `@green-goods/shared` owns reusable primitives, Storybook-backed foundations, and shared config helpers.
- `packages/admin` owns cockpit shell composition and admin-only workflows.
- Do not add package-local `config/`, `utils/`, `hooks/`, or primitive UI shims when the behavior belongs in shared.

## Commands

```bash
bun --filter admin dev
bun --filter admin test
bun --filter admin build
```
