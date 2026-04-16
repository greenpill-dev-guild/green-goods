# ADR-003: Hook Boundary Rule

**Date**: 2026-04-02
**Status**: Accepted

## Context

With three frontend packages (client, admin, agent) sharing domain logic, hooks that fetch data, manage mutations, or orchestrate workflows were at risk of diverging. Duplicate `useGardens()` implementations in client and admin would inevitably drift -- different query keys, different error handling, different cache invalidation. Bug fixes would need to land in multiple places.

## Decision

**ALL React hooks MUST live in `@green-goods/shared`**. The client and admin packages contain only components (presentation) and views (page-level composition). They import hooks exclusively from `@green-goods/shared`.

The shared package exports approximately 200+ hooks from `packages/shared/src/index.ts`, covering:

- Data fetching: `useGardens`, `useWorks`, `useActions`, `useHypercerts`, etc.
- Mutations: `useWorkMutation`, `useJoinGarden`, `useVaultDeposit`, etc.
- Auth: `useAuth`, `useTransactionSender`, `usePrimaryAddress`
- Forms: `useWorkForm`, `useCreateGardenForm`, `useAssessmentForm`
- Utilities: `useTimeout`, `useAsyncEffect`, `useEventListener`, `useDebouncedValue`

Consumer packages depend on `@green-goods/shared` via workspace protocol and import from the barrel (`import { useAuth } from '@green-goods/shared'`).

## Consequences

- **Enables**: Single source of truth for all data-fetching logic, query key management, and cache invalidation. Bug fixes propagate to all consumers immediately.
- **Constrains**: The shared package becomes large and has many peer dependencies (wagmi, xstate, tanstack-query, react-hook-form, etc.). Adding a hook requires understanding the shared package's conventions.
- **Trade-off**: The fat barrel export in `index.ts` means tree-shaking quality depends on the bundler. All exports are explicit (not `export *`) to aid tree-shaking, but unused hooks still appear in the dependency graph during development.
