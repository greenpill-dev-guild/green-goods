# ADR-010: UUPS Upgrade Strategy

**Date**: 2026-04-02
**Status**: Accepted

## Context

Contracts need to be upgradeable for iterating on module logic post-deployment (adding new integration modules, fixing bugs in power calculation, updating role logic), but the transparent proxy pattern adds admin complexity and gas overhead for every call. Transparent proxies require an admin contract that adds a storage slot check on every delegatecall, and managing a separate ProxyAdmin introduces operational overhead for a solo-dev project.

## Decision

All upgradeable contracts use OpenZeppelin's `UUPSUpgradeable` pattern with `onlyOwner` authorization on `_authorizeUpgrade()`. The upgrade function body is intentionally empty -- the modifier is the guard:

```solidity
function _authorizeUpgrade(address) internal override onlyOwner {}
```

Every upgradeable contract follows this initialization discipline:

1. **Constructor calls `_disableInitializers()`** -- prevents the implementation contract from being initialized directly, closing the uninitialized-implementation attack vector.
2. **`initialize()` replaces the constructor** -- called once through the proxy, protected by OpenZeppelin's `initializer` modifier.
3. **`reinitialize(uint64 version)`** -- used for upgrade-time state migrations when new storage variables need default values.

Key files: All modules (`packages/contracts/src/modules/*.sol`), registries (`packages/contracts/src/registries/*.sol`), tokens (`packages/contracts/src/tokens/*.sol`), and resolvers (`packages/contracts/src/resolvers/*.sol`) that are upgradeable.

Deployment uses ERC-1967 proxies created via `deploy.ts`, which deploys the implementation, then deploys the proxy pointing to it, then calls `initialize()` through the proxy.

## Consequences

- **Enables**: Cheaper calls than transparent proxy (no admin slot check per delegatecall, saving ~2100 gas per transaction). Upgrade logic lives in the implementation itself, which is simpler to reason about. Adding new modules or fixing calculation bugs can be done without redeploying the entire system.
- **Constrains**: The implementation contract must never be left uninitialized -- `_disableInitializers()` in the constructor is mandatory, not optional. Every new upgradeable contract must follow this pattern; a missed `_disableInitializers()` is a critical vulnerability.
- **Trade-off**: If the implementation is bricked (e.g., `_authorizeUpgrade` is removed or ownership is renounced), the proxy is permanently bricked -- no external admin can swap it. This is an acceptable risk given the single-owner deployment model, but it means ownership management is a high-stakes operation.
