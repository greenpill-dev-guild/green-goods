# Contracts Package (Solidity)

> **Audience:** Smart contract engineers and protocol contributors working in `packages/contracts`.
> **Related docs:** [Contracts Handbook](./contracts-handbook), [packages/contracts/README.md](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/contracts#readme)
> **Networks:** Sepolia (11155111), Arbitrum One (42161), Celo (42220).
> **Source of truth:** `packages/contracts/deployments/*-latest.json`.

Green Goods contracts power gardens, attestations, and protocol integrations.

---

## Quick Reference

**Path:** `packages/contracts/`
**Stack:** Solidity 0.8.30 + Foundry + Bun wrapper scripts

```bash
bun --filter contracts build            # Adaptive contract build
bun --filter contracts run test         # Unit + integration tests (scripted)
bun --filter contracts run test:e2e     # End-to-end workflow suite
bun --filter contracts deploy:testnet   # Deploy to Sepolia
bun --filter contracts deploy:celo      # Deploy to Celo
bun --filter contracts deploy:arbitrum  # Deploy to Arbitrum
```

---

## Core Deployments (Current)

These addresses are taken from deployment artifacts and replace older Nov 2024 values.

| Contract | Sepolia | Arbitrum | Celo |
|---|---|---|---|
| `gardenToken` | `0xEcbB6E69BE882d2e4E35CCe0E6637c7e1D64c791` | `0x0a7Ca3203f25c1c028D54C19789e83b401383F92` | `0xDcA639287A392E17cad0deA4E72F5B3cfA429e6B` |
| `actionRegistry` | `0x547e82BF9c8496f41927583793242f6b91C182A6` | `0x042D2b082Cdd4DCBc0aD9dD7c631BC2e45B05cB1` | `0x0747ED4f1915b8f3A6eA8a9d8216E8F53EE80f92` |
| `workResolver` | `0x054814d58b3A160ca0243FFC77f2F5d62709f396` | `0x9acf5C0dEc2f8134AC8C68a41bE3eB659e8430b7` | `0x028ff0640262a1847d512B3690266d0B35d5260F` |
| `workApprovalResolver` | `0x4708E9b199412cc2Cf4d394430BD3DF1f31F2Be5` | `0x0B1Ef706D967820784928c850EFF69E078bcb419` | `0x54b9Dd27d4eD2282D8Cd12CD55ee4B983eC9E3D6` |
| `assessmentResolver` | `0x0000000000000000000000000000000000000000` | `0xDD3567060cEA024dF9D9950A7Af3D8e1F9dB1216` | `0xC81B11e3d199D60678D5fF962F616ab64df73554` |

> A zero address means “not deployed on this chain yet,” not “invalid artifact.”

---

## What the Core Deployment Writes

`deploy.ts core` writes a broad artifact surface (18+ keys), including:

- Core protocol contracts: `deploymentRegistry`, `guardian`, `actionRegistry`, resolvers, `gardenToken`, `gardenAccountImpl`, `accountProxy`, `gardenerAccountLogic`
- Integration modules: `hatsModule`, `karmaGAPModule`, `octantModule`, `gardensModule`, `cookieJarModule`, `yieldSplitter`, `hypercertsModule`, `marketplaceAdapter`
- Ecosystem integrations: `greenGoodsENS`, `unifiedPowerRegistry`, `hypercertMinter`, `hypercertExchange`, `transferManager`, `strategyHypercertFractionOffer`
- Bootstrap + metadata: `rootGarden`, `schemas`, `eas`, and network-specific optional addresses

See `packages/contracts/deployments/{chainId}-latest.json` for complete and chain-specific values.

---

## Contract Areas

- `tokens/` — Garden NFT and protocol tokens
- `accounts/` — token-bound account logic
- `registries/` — deployment, action, ENS, and power registries
- `resolvers/` — EAS attestation validation (`Work`, `WorkApproval`, `Assessment`, `Yield`)
- `modules/` — integrations (Hats, Karma, Octant, Gardens, Cookie Jar, Hypercerts)
- `markets/` + `strategies/` — marketplace and yield strategy adapters

---

## Deployment and Upgrades

Always use the Bun deployment wrappers (never raw `forge script ... --broadcast` for normal deploy flow).

```bash
# Dry run (compile + planning)
bun script/deploy.ts core --network sepolia

# Full deployment
bun script/deploy.ts core --network sepolia --broadcast

# Deploy + schema metadata refresh
bun script/deploy.ts core --network sepolia --broadcast --update-schemas

# Upgrade existing contracts
bun upgrade:testnet
bun upgrade:celo
bun upgrade:arbitrum
```

---

## Schema Management

`packages/contracts/config/schemas.json` is production schema config and treated as immutable during normal development.

- Do not hand-edit schema field definitions in place.
- Use deployment flags (like `--update-schemas`) for metadata refresh flow.
- Use dedicated test files for experiments.

---

## Testing

```bash
bun --filter contracts run test
bun --filter contracts run test:e2e
bun --filter contracts run test:fork
bun --filter contracts lint
```

---

## Related References

- [Contracts Handbook](./contracts-handbook)
- [Karma GAP Integration](./karma-gap)
- [Architecture diagrams](./diagrams)
- `packages/contracts/README.md`
- `.claude/context/contracts.md`
