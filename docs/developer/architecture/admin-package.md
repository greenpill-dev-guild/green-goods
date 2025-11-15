# Admin Package (Dashboard)

> **Audience:** Frontend engineers working on `packages/admin`.
> **Related docs:** [Monorepo Structure](monorepo-structure.md), [packages/admin/README.md](../../../packages/admin/README.md)
> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532). Deployment data: `packages/contracts/deployments/*.json`. Updated November 2024.
> **External references:** For GraphQL client patterns, see [urql documentation](https://formidable.com/open-source/urql/docs/) and XState’s [statecharts guide](https://stately.ai/docs/statecharts) when editing workflows.

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
- Urql (GraphQL with subscriptions)
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

### Real-Time Updates

**Urql subscriptions**:
- Garden creation events
- Work approvals
- Member additions

**Implementation**:
- `src/utils/urql.ts`
- GraphQL subscriptions in views

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

[Theme Guide →](../theming.md)

---

## Complete Documentation

**📖 Full details**: [packages/admin/README.md](../../../packages/admin/README.md)

**Key Files**:
- Access control: `.cursor/rules/access-control.mdc`
- State workflows: `.cursor/rules/state-workflows.mdc`
- GraphQL patterns: `.cursor/rules/graphql-integration.mdc`

