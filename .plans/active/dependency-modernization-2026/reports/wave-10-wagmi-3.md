# Wave 10 — Wagmi 3 Compatibility Gate

**Branch**: `chore/dependency-upgrades`
**Status**: held by the plan's official-adapter-support condition; no dependency or source changes

## Decision

Do not upgrade Wagmi in this modernization program. Keep the current exact AppKit/adapter 1.8.22
checkpoint with Wagmi 2 and the load-bearing `multiformats`/`uint8arrays` compatibility strategy.
Revisit Wagmi 3 only after Reown publishes an adapter release and official example or migration
guidance that explicitly uses Wagmi 3.

This is the planned safe outcome when the compatibility condition is not met. It is not a failed
implementation attempt, and no peer range will be forced.

## Evidence

1. The installed `@reown/appkit-adapter-wagmi` 1.8.22 package declares open-ended minimum peers:
   `wagmi >=2.19.5`, `@wagmi/core >=2.21.2`, and `viem >=2.45.0`. That range does not constitute an
   explicit Wagmi 3 support statement or migration contract.
2. Reown's current official React example uses AppKit 1.8.21 with Wagmi 2.19.5 and Core 2.22.1.
3. Reown's current official Next.js example uses AppKit 1.8.20 with Wagmi 2.12.31.
4. Reown's current adapter source retains the same minimum-only peer declarations and its official
   documentation/examples do not publish a Wagmi 3 migration path.
5. Green Goods has a broad shared Web3 surface: public hooks, wallet restoration, chain switching,
   WalletConnect, passkeys, simulations, signatures, and local-Anvil writes. A peer-range-only
   experiment would not meet the plan's proof threshold for those contracts.

## Safety implications

- Do not install Wagmi 3.7.1, Core 3.6.1, or Permissionless 0.3.7 in this wave.
- Do not add or force connectors merely to make the graph resolve.
- Do not remove the root compatibility shim, overrides, `fix-multiformats.js`, `multiformats`, or
  `uint8arrays` until a future supported graph proves they are unnecessary.
- Do not adapt shared hook exports speculatively. Their public contracts remain unchanged.
- Final certification should record Wave 10 as `held_supported_adapter_unavailable`, not as an
  incomplete dependency update.

## Re-entry gate

A future Wagmi 3 lane may begin only when all of the following are true:

1. A release-age-eligible Reown adapter explicitly supports Wagmi 3 in official release notes,
   documentation, or a maintained official example.
2. Its peer graph resolves without forced ranges and requires only connectors Green Goods uses.
3. RED/GREEN tests preserve shared hook results and wallet/passkey transaction lifecycles.
4. Fresh-install proof covers EOA, WalletConnect, passkey, and local-Anvil writes before the
   compatibility shim is considered for removal.

## Primary sources

- [Reown AppKit adapter repository](https://github.com/reown-com/appkit)
- [Reown React Wagmi example](https://github.com/reown-com/appkit-web-examples/blob/main/react/react-wagmi/package.json)
- [Reown Next.js Wagmi example](https://github.com/reown-com/appkit-web-examples/blob/main/nextjs/next-wagmi-app-router/package.json)
- [Wagmi v2 to v3 migration contract](https://wagmi.sh/react/guides/migrate-from-v2-to-v3)
