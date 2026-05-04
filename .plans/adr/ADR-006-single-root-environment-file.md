# ADR-006: Single Root Environment File

**Date**: 2026-04-02
**Status**: Accepted

## Context

In a monorepo with 6+ packages, per-package `.env` files create a maintenance nightmare: duplicate keys drift out of sync, developers forget which package needs which variable, and CI pipelines need N separate env configurations. A previous iteration had this problem -- variables defined in the client's `.env` were missing from admin, causing silent build failures.

## Decision

A single `.env` file lives at the repository root. No package may create its own `.env` file. The schema is defined in `.env.schema` (using varlock), which serves as the source of truth for all environment variables.

How it works:

- Vite-based packages (client, admin) access variables via `import.meta.env.VITE_*` -- Vite's env loading walks up to find the root `.env`.
- The shared package uses `varlock` (`ENV.VITE_CHAIN_ID`) for type-safe access with validation.
- The indexer and contracts packages read from `process.env`, which `bun` populates from the root `.env`.
- `bun setup` generates the `.env` from `.env.schema` during initial setup.

Key variables: `VITE_CHAIN_ID` (target chain), `VITE_WALLETCONNECT_PROJECT_ID`, `VITE_PIMLICO_API_KEY`, `VITE_POSTHOG_KEY`, RPC URLs.

## Consequences

- **Enables**: One place to update secrets, one schema to validate, one CI env block. New developers run `bun setup` once and all packages work.
- **Constrains**: Variables must use the `VITE_` prefix if they need to be available in browser bundles, even for the indexer package (which doesn't need the prefix). This is a Vite convention leak.
- **Trade-off**: The root `.env` contains variables that some packages don't need (e.g., the indexer doesn't need `VITE_WALLETCONNECT_PROJECT_ID`). This is acceptable -- unused variables are inert, and the alternative (splitting) is worse.

## Implementation update — 2026-05-04

The single-root-`.env` decision is unchanged. The resolution mechanism has been swapped: `varlock` is removed in favor of a `.env.template` + `op inject` pipeline.

How it now works:

- `.env.schema` remains the key contract — every required variable must be declared here.
- `.env.template` (committed, no secrets) holds the team-shared overlay: `op://Vault/Item/field` references for shared secrets, plain values for non-secret defaults (URLs, ports, feature flags).
- `bun run env:sync` runs `op inject` against `.env.template` to materialize `.env`. Touch ID prompts once via the 1Password desktop app integration; the resolved `.env` is then read natively by Bun, Vite, and Node.
- `bun run env:check` validates `.env` against `.env.schema`.
- All shared package code reads via `import { ENV } from "@green-goods/shared/lib/env"` (a thin Proxy over `import.meta.env` / `process.env`); the Vite/Bun runtimes load `.env` natively, no per-command secret fetch.

Why the swap: varlock's per-command fetch model required Touch ID per shell session, which broke long dev sessions and caused silent env-resolution failures (e.g. `if($X, ...)` schema expressions leaking into runtime as literal strings). The `op inject` pipeline materializes once, then stays out of the way until the next sync.

References: `scripts/dev/env-template-init.js`, `scripts/dev/env-sync.js`, `scripts/dev/env-bootstrap.js`, `scripts/dev/env-check.js`, `packages/shared/src/lib/env.ts`.
