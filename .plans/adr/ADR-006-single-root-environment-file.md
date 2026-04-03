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
