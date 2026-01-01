# Green Goods Client

Offline-first PWA for gardeners and operators to submit and manage work.

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
├── components/      # UI components (cards, forms, dialogs)
├── views/           # Route views (lazy-loaded)
├── routes/          # Route guards (RequireAuth, AppShell)
├── styles/          # CSS (colors, typography, animation)
└── config.ts        # Client configuration
```

**All hooks, providers, stores, and modules live in `@green-goods/shared`.**

## Core Concepts

### Offline-First

Work submissions queue locally when offline and sync when online:
- IndexedDB for persistent storage
- Event-driven synchronization (no polling)
- MediaResourceManager for blob URL lifecycle

### Passkey Authentication

Primary auth method using WebAuthn + Kernel smart accounts:
- Biometric authentication (Face ID, Touch ID)
- No seed phrases or private keys
- Wallet connection as fallback for operators

### Design System

Material Design 2-inspired tokens via Tailwind CSS v4:
- Semantic background tokens (`bg-bg-white`, `bg-bg-soft`)
- Semantic text tokens (`text-text-strong`, `text-text-sub`)
- State colors (`success-*`, `error-*`, `warning-*`)

## Key Workflows

### Work Submission

```
Passkey: Form → Queue → Process (if online) → EAS Attestation
Wallet:  Form → IPFS Upload → Direct Transaction → Done
```

### Work Approval

```
Operator reviews → Approve/Reject → EAS Attestation
```

## Cursor Rules

Detailed patterns are documented in `.cursor/rules/`:

| Rule File | Description |
|-----------|-------------|
| `rules.mdc` | **Start here** — Package overview and critical patterns |
| `authentication.mdc` | Passkey + wallet auth flows |
| `offline-architecture.mdc` | Job queue and sync patterns |
| `component-cards.mdc` | ActionCard, GardenCard, WorkCard |
| `component-forms.mdc` | Form inputs, validation, React Hook Form |
| `component-modals.mdc` | ModalDrawer, ConfirmDrawer, ImagePreview |
| `component-radix.mdc` | Radix UI primitives integration |
| `testing.mdc` | Client-specific testing patterns |

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

1. **All hooks from shared** — Never create hooks in client package
2. **Chain from environment** — Use `DEFAULT_CHAIN_ID`, never wallet chain
3. **No polling** — Use event-driven updates via `useJobQueueEvents`
4. **Semantic tokens** — Use design system tokens, not hardcoded colors
5. **Query keys** — Always use `queryKeys` from shared

## Reference

- **Shared package:** `/packages/shared/AGENTS.md`
- **Root guide:** `/AGENTS.md`
- **README:** `/packages/client/README.md`
