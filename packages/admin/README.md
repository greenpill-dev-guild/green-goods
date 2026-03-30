# Green Goods Admin Cockpit

Administrative cockpit for Green Goods operators and deployers.

## Quick Start

From the monorepo root:

```bash
bun install
bun --filter admin dev
```

The admin app runs on `http://localhost:3002`.

## Design System Contract

- Design-system baseline: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- Shared foundations and tokens live in `packages/shared`
- Admin owns shell composition and domain workflows
- Canonical shell: `CockpitLayout`
- Legacy for new work: `DashboardLayout`, `Sidebar`, `Header`
- Preferred building blocks: `TopContextBar`, `FloatingToolbar`, `GardenChip`, `CommandPalette`, `SettingsSheet`, `SideSheet`, `PageHeader`, `ListToolbar`, `SortSelect`, `Card`, `Alert`, `StatusBadge`, `FormField`, `DialogShell`

The admin is intentionally `Material 3 grounded` and `Green Goods distinct`:

- Material 3 defines structure, hierarchy, surfaces, forms, dialogs, and states
- Apple HIG influences restraint, density, and motion polish only
- Green Goods shows up in brand tone, garden hero treatments, impact framing, and treasury transparency

## Features

### Admin Features

- Garden management
- Contract and deployment operations
- Global operator workflows across gardens
- Deployment registry and status surfaces

### Operator Features

- Garden-scoped management for assigned gardens
- Member and role management within permitted gardens
- Impact and operations visibility for assigned gardens
- Limited scope compared with global admin access

### Reporting Notes

- Impact data is queried via Karma GAP SDK, not the Green Goods indexer.
- Use the cockpit list, detail, and operational page families before inventing new reporting layouts.

## Access Control

### Admin Access

- Admin access is allow-list driven and configured in `src/config.ts`.

### Operator Access

- Operator access is derived from garden membership returned by the indexer.

### Role Detection

The `useRole` hook resolves permissions by:

1. Checking the admin allow list.
2. Querying operator gardens from the indexer.
3. Falling back to `unauthorized` when neither path applies.

## Current Architecture

### Ownership

- `packages/shared`
  - semantic tokens and theme aliases
  - reusable UI foundations
  - hooks, data access, auth, and shared utilities
  - Storybook documentation
- `packages/admin`
  - admin shell and cockpit composition
  - page-specific workflows and feature views
  - route wiring and admin-only feature modules

### Package Structure

```text
packages/admin/
├── src/
│   ├── components/
│   │   ├── Action/
│   │   ├── Assessment/
│   │   ├── Dashboard/
│   │   ├── Form/
│   │   ├── Garden/
│   │   ├── Layout/
│   │   ├── Vault/
│   │   ├── Work/
│   │   └── ui/                # admin import shims over shared foundations
│   ├── config/
│   ├── routes/
│   ├── styles/
│   ├── utils/
│   └── views/
└── README.md
```

Notably, admin no longer owns package-local `hooks/`, `providers/`, `stores/`, or `workflows/` directories as first-class architecture layers. Those concerns now live primarily in `packages/shared`, with admin consuming them through the shared barrel.

### Technology Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 + Radix UI
- Zustand + XState workflows
- TanStack Query + GraphQL clients
- Viem + Reown AppKit authentication
- React Router v7
- React Hot Toast

## Page Families

- List pages use `PageHeader + ListToolbar + filters/sort + loading/empty/error + results`.
- Detail/workbench pages use `PageHeader` or a garden hero plus `main / rail` composition.
- Operational pages use `PageHeader + tabs + status workspace cards`.

If a new screen does not fit one of those patterns, document the reason before introducing a new layout model.

## Development Notes

- Use `bun` only.
- Run validation with `bun run test`, `bun lint`, and `bun build` from the repo root.
- Add all new user-facing runtime strings to `packages/shared/src/i18n/{en,es,pt}.json`.
- Prefer `@green-goods/shared` barrel imports over deep shared paths.
- Keep generic UI primitives in `packages/shared`; keep admin-only composites in `packages/admin`.

## Development Workflow

### Local Development

```bash
bun --filter admin dev
bun dev
bun --filter admin test
bun --filter admin build
```

### Environment Variables

- Use the root `.env` only.
- The root `.env` is loaded by Vite, builds, and package scripts.
- Admin-relevant variables typically include `VITE_WALLETCONNECT_PROJECT_ID`, `VITE_CHAIN_ID`, `VITE_ALCHEMY_API_KEY`, and `VITE_ENVIO_INDEXER_URL`.

### Testing

- Unit loop: `bun --filter admin test`
- Watch loop: `bun --filter admin test:watch`
- Repo validation: `bun run test`, `bun lint`, and `bun build`

### Deployment

- Production build: `bun --filter admin build`
- Before production deploys, verify environment variables, deployment registry state, and target-network contract availability.

## Storybook

Shared Storybook is the design-system source of truth. It includes shared foundations and curated admin shell stories:

```bash
bun --filter shared storybook
```

Coverage is enforced by `scripts/check-story-coverage.ts`.

## Security Considerations

### Access Control

- Admin functions are restricted to allow-listed addresses.
- Operator functions are restricted to permitted gardens.
- All blockchain transactions require wallet signature.
- Role detection should remain consistent with route and action gating.

### Transaction Safety

- Use shared toast workflows for contract interactions.
- Track pending transaction state to avoid duplicate submissions.
- Keep failure states explicit and actionable.

## Troubleshooting

### Common Issues

#### Unauthorized State

- Verify the wallet is allow-listed or assigned to at least one operator garden.
- Confirm the expected network is selected.

#### Contract Interaction Failures

- Verify contract deployments on the active network.
- Check wallet gas and permissions.
- Confirm the current role is allowed to perform the action.

#### GraphQL or Indexer Issues

- Verify `VITE_ENVIO_INDEXER_URL`.
- Check network connectivity and indexer health.

### Debug Mode

- Use browser DevTools, React DevTools, and TanStack Query DevTools in development.

## Documentation

- [Admin Package Documentation](https://docs.greengoods.app/developer/architecture/admin-package)
- [System Architecture](https://docs.greengoods.app/developer/architecture)
- [Operator Quickstart](https://docs.greengoods.app/welcome/quickstart-operator)
- [Managing Gardens Guide](https://docs.greengoods.app/guides/operators/managing-gardens)

## Related Resources

- [Smart Contracts Package](https://docs.greengoods.app/developer/architecture/contracts-package)
- [GraphQL Indexer Package](https://docs.greengoods.app/developer/architecture/indexer-package)
- [Client Application Package](https://docs.greengoods.app/developer/architecture/client-package)
