# Green Goods Admin

Garden management and contract deployment dashboard for administrators and operators.

## Quick Reference

| Command | Description |
|---------|-------------|
| `bun dev` | Start development server |
| `bun build` | Production build |
| `bun test` | Run tests |
| `bun lint` | Run linter |

## Architecture

```
src/
├── components/      # Admin UI components
│   ├── Action/     # Action configuration
│   ├── Assessment/ # Assessment workflow steps
│   ├── Garden/     # Garden management
│   └── Layout/     # Dashboard layout
├── views/           # Main views (lazy-loaded)
├── routes/          # Route guards (RequireRole, DashboardShell)
├── config.ts        # Admin configuration
└── router.tsx       # Route configuration
```

**All hooks, providers, stores, and workflows live in `@green-goods/shared`.**

## Core Concepts

### Role-Based Access

Three user roles with different permissions:

| Role | Access | Source |
|------|--------|--------|
| **Deployer** | Full access, create gardens, deploy contracts | Allowlist |
| **Operator** | Manage assigned gardens only | Indexer query |
| **User** | Unauthorized | Default |

### Garden Management

- Create gardens (deployers only)
- Add/remove gardeners and operators
- Update garden metadata
- View garden statistics

### Contract Deployment

- View deployed contracts
- Deploy new contracts
- Verify contracts on explorer

## Key Workflows

### Garden Creation

```
Select type → Configure details → Add members → Deploy → Done
```

### Member Management

```
Check permissions → Add/Remove via modal → Toast feedback
```

## Cursor Rules

Detailed patterns are documented in `.cursor/rules/`:

| Rule File | Description |
|-----------|-------------|
| `rules.mdc` | **Start here** — Package overview and critical patterns |
| `access-control.mdc` | Role detection, permissions, route guards |
| `component-workflows.mdc` | Modal patterns, form validation, toast notifications |
| `testing.mdc` | Admin-specific testing patterns |

### Shared Package Rules

Cross-cutting patterns in `shared/.cursor/rules/`:

| Rule File | Description |
|-----------|-------------|
| `design-system.mdc` | Colors, typography, spacing, icons |
| `hook-architecture.mdc` | All hooks live in shared |
| `state-patterns.mdc` | Providers, stores, query keys |
| `testing-patterns.mdc` | Vitest, mocks, coverage targets |
| `appkit-integration.mdc` | Wallet connection via Reown |
| `cross-package-imports.mdc` | Import boundaries |

## Critical Rules

1. **All hooks from shared** — Never create hooks in admin package
2. **Toast for all transactions** — Wrap contract calls with `useToastAction`
3. **Permission checks** — Always verify with `useGardenPermissions` before actions
4. **Role-based routing** — Use `RequireDeployer`, `RequireOperatorOrDeployer` guards
5. **Semantic tokens** — Use design system tokens, not hardcoded colors

## Reference

- **Shared package:** `/packages/shared/AGENTS.md`
- **Root guide:** `/AGENTS.md`
- **README:** `/packages/admin/README.md`
