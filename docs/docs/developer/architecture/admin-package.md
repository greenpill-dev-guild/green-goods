# Admin Package (Dashboard)

> **Audience:** Frontend engineers working on `packages/admin`.
> **Related docs:** [Monorepo Structure](monorepo-structure), [packages/admin/README.md](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/admin#readme)
> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532). Deployment data: `packages/contracts/deployments/*.json`. Updated November 2024.
> **External references:** For GraphQL patterns, see [TanStack Query documentation](https://tanstack.com/query/latest/docs/react/overview) and XState's [statecharts guide](https://stately.ai/docs/statecharts) when editing workflows.

Web dashboard for operators to manage gardens and validate work.

---

## Quick Reference

**Path**: `packages/admin/`
**Port**: http://localhost:3002
**Stack**: React 18 + TypeScript + Vite

**Commands**:
```bash
bun --filter admin dev       # Start dev server
bun --filter admin test      # Run tests
bun --filter admin build     # Production build
```

---

## Tech Stack

### Core
- React 18
- TypeScript (strict)
- Vite
- React Router v7

### State Management
- TanStack Query (data fetching, caching)
- graphql-request (lightweight GraphQL client)
- Zustand (global state)
- XState (workflow orchestration)
- React Hook Form (forms)

### UI
- Tailwind CSS v4
- Radix UI primitives
- React Hot Toast

### Web3
- Viem + Wagmi
- Wallet connection (MetaMask, etc.)
- EAS SDK

---

## Key Features

### Role-Based Access

**Three roles**:
- **Admin (Deployer)**: Create gardens, full access
- **Operator**: Manage assigned gardens only
- **Unauthorized**: Read-only or denied

**Implementation**:
- `src/hooks/useRole.ts`
- `src/config.ts` (admin allowlist)

### Data Fetching

**TanStack Query + graphql-request**:
- Cached garden and work queries
- Automatic refetching on focus
- Offline-first support

**Implementation**:
- `@green-goods/shared/modules/data/graphql-client.ts`
- Query hooks in views

### Garden Management

**Admin features**:
- Create gardens (deployers only)
- Add/remove members
- Create actions
- View statistics

**Implementation**:
- `src/components/Garden/`
- `src/hooks/useGardenOperations.ts`

### Work Review

**Operator features**:
- View pending work
- Review media/details
- Approve/reject with feedback
- Toast notifications for all transactions

**Implementation**:
- `src/views/Gardens/Detail.tsx`
- `src/hooks/useToastAction.ts`

---

## State Management

### Zustand Store

```typescript
useAdminStore: {
  selectedChainId
  selectedGarden
  pendingTransactions
  sidebarOpen
}
```

### XState Workflows

Complex flows with retry:
- Garden creation workflow
- Member management flows

---

## Theme System

CSS variables-based theming:
- Light/dark mode support
- Semantic tokens (bg-white, text-strong, etc.)
- No hardcoded colors
- Automatic adaptation

[Theme Guide →](../theming)

---

## Complete Documentation

**📖 Full details**: [packages/admin/README.md](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/admin#readme)

**Key Files**:
- Access control: `.cursor/rules/access-control.mdc`
- State workflows: `.cursor/rules/state-workflows.mdc`
- GraphQL patterns: `.cursor/rules/graphql-integration.mdc`

