# ADR-008: Barrel Exports from Shared

**Date**: 2026-04-02
**Status**: Accepted

## Context

The shared package exports approximately 500+ symbols (types, hooks, components, utilities, modules). Without a clear import strategy, consumers would use deep imports (`@green-goods/shared/src/hooks/auth/useAuth`), creating tight coupling to internal file structure. Any refactoring (moving a file, renaming a directory) would break imports across client, admin, and agent packages.

## Decision

`@green-goods/shared` uses a **fat barrel export** at `src/index.ts` with **explicit named exports** (no `export *`). Additionally, `package.json` defines sub-path exports for domain-specific entry points.

Barrel structure in `packages/shared/src/index.ts`:

- Organized by category: COMPONENTS, CONFIG, HOOKS, I18N, MODULES, PROVIDERS, STORES, TYPES, UTILITIES, WORKFLOWS
- Every export is individually named -- types use `export type`, values use `export`
- No re-exports from deep paths; everything surfaces at the root level

Sub-path exports in `packages/shared/package.json` (15 entry points):

- `.` -> `src/index.ts` (main barrel)
- `./components`, `./cards`, `./display`, `./badge` -> component sub-barrels
- `./config`, `./hooks`, `./modules`, `./providers`, `./stores`, `./types`, `./utils`, `./workflows` -> domain barrels
- `./i18n`, `./i18n/en`, `./i18n/es`, `./i18n/pt` -> locale files
- `./mocks`, `./mocks/browser`, `./mocks/server` -> test utilities
- `./testing` -> test helpers

The rule: consumers use `import { x } from "@green-goods/shared"` for the common case. Sub-path imports (e.g., `@green-goods/shared/components`) are available for bundle-splitting scenarios but are not required.

## Consequences

- **Enables**: Internal refactoring (moving hooks between files, renaming modules) doesn't break consumer imports. The explicit export list serves as a public API contract.
- **Constrains**: Every new public symbol requires adding it to the barrel file. Forgetting this step means the symbol is inaccessible to consumers (a good forcing function for API review).
- **Trade-off**: The barrel file is ~900 lines and growing. IDE auto-import sometimes suggests deep paths -- the lint rule for barrel import enforcement (Rule 11 in `.claude/rules/typescript.md`) catches this, but it requires developer awareness. Tree-shaking depends on bundler quality; the explicit exports help but don't guarantee dead code elimination in all configurations.
