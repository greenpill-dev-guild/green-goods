# ADR-002: Single-Chain Design

**Date**: 2026-04-02
**Status**: Accepted

## Context

Multi-chain dApps pay a heavy complexity tax: chain-switching UI, per-chain contract addresses, bridging flows, and RPC failover logic. Green Goods targets a specific community (regenerative gardeners) rather than DeFi power users. The user base does not benefit from chain optionality -- they need one reliable chain with low fees where their work evidence lives.

## Decision

The target chain is set at **build time** via `VITE_CHAIN_ID`. There is no runtime chain switching.

In `packages/shared/src/config/blockchain.ts`:

- `DEFAULT_CHAIN_ID` is resolved once from `ENV.VITE_CHAIN_ID` through `resolveChainId()`, which validates the chain has both a deployment config and network config, falling back to Sepolia (11155111) if invalid.
- All downstream consumers (`getEASConfig()`, `getNetworkConfig()`, `getDefaultChain()`) use this resolved chain ID.
- Deployment artifacts are imported statically per chain (31337, 11155111, 42161, 42220) and looked up by string key -- no dynamic loading.

The job queue stamps each job with `chainId` at creation time, and the auth machine initializes with `DEFAULT_CHAIN_ID` in its context.

## Consequences

- **Enables**: Simpler UX (no chain-switching prompts), deterministic contract addresses, smaller bundle (only one chain's config is active).
- **Constrains**: Deploying to a new chain requires a code change (add import + map entry), not just configuration. Moving the production chain means a new build + redeploy.
- **Trade-off**: The `SUPPORTED_CHAINS` array and per-chain deployment imports suggest the code is structurally ready for multi-chain, but the runtime enforces single-chain. This is intentional scaffolding, not dead code.
