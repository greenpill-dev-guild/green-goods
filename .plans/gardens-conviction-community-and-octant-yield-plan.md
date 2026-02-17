# Gardens Conviction + Octant Yield — Remaining Work

**Branch**: `feature/gardens-conviction-voting-nft`
**Status**: GardensModule + conviction hooks + indexer + admin strategy DONE. Yield wiring remaining.
**Target Chain**: Arbitrum One (42161)
**Created**: 2026-02-12 | **Trimmed**: 2026-02-16

> GardensModule.sol (30KB), 7 conviction voting hooks, indexer events, admin strategy/pool management all shipped.
> See commits: `4310ea36`, `a609b7b7`, `3e1e08df`, `4e6d6e73`, `bf7d7f5d`, `907a8d34`.
> Full decision log (28 decisions), weight scheme specs, and architecture are captured in commit history.

---

## Remaining: Yield Split End-to-End Wiring

### YieldSplitter — Three-Way Split (partially wired, not functional)

| # | Task | Status |
|---|------|--------|
| 1 | Wire Cookie Jar portion: ERC-20 approve + deposit into garden's jar (WETH/DAI, not ETH) | TODO |
| 2 | Wire Fractions portion: read conviction weights → buy fractions via marketplace adapter → garden treasury | TODO |
| 3 | Wire Juicebox portion: swap to ETH if needed → `JBMultiTerminal.pay()` → mints GOODS | TODO |
| 4 | No-hypercerts fallback: re-deposit fractions portion back into vault (re-compound) | TODO |
| 5 | `$7 minimum yield threshold` — accumulate sub-threshold harvests in `pendingYield` mapping | TODO |
| 6 | `setSplitRatio(garden, cookieJarBps, fractionsBps, juiceboxBps)` — operator-adjustable, must sum to 10000 | TODO |
| 7 | Integration test: deposit → harvest → split → verify jar deposit + fractions purchased + JB payment | TODO |
| 8 | Multi-asset test: WETH + DAI yield split independently | TODO |

**Default split**: ~33/33/33 (cookieJarBps=3334, fractionsBps=3333, juiceboxBps=3333).

### GOODS Juicebox Treasury (exists but not live)

| # | Task | Status |
|---|------|--------|
| 9 | `tokens/Goods.sol` exists — wire to JB project so `pay()` mints GOODS | TODO |
| 10 | Configure JB ruleset: weight=1000 GOODS/ETH, reservedPercent=20%, cashOutTaxRate=50% | TODO |
| 11 | Reserved splits: 50% garden airdrop pool, 30% operator incentives, 20% protocol dev | TODO |
| 12 | Bootstrap: seed ETH payment + `JBController.mintTokensOf()` free mint buffer | TODO |
| 13 | Protocol multisig (Gnosis Safe) ownership of JB project | TODO |

### Deployment Steps

| # | Task | Status |
|---|------|--------|
| 14 | Deploy GOODS JB project on Arbitrum Sepolia (testnet first) | TODO |
| 15 | Wire YieldSplitter to OctantModule as donation address | TODO |
| 16 | Deploy MockHypercertMarketplace (testnet) or wire real marketplace adapter | TODO |
| 17 | Full E2E on testnet: deposit → harvest → three-way split → verify all three destinations | TODO |
| 18 | Mainnet deployment (after testnet validation) | TODO |

---

## Key Architecture References

**Yield flow**:
```
Depositors → vault.deposit(WETH/DAI) → Aave V3 → yield accrues
Operator → OctantModule.harvest() → strategy.report()
Yield shares → YieldSplitter (donation address)
YieldSplitter.splitYield():
  1. Redeem shares → ERC-20
  2. Check $7 minimum (accumulate if below)
  3. Cookie Jar portion → ERC-20 deposit into jar
  4. Fractions portion → conviction-weighted marketplace purchases → garden Safe
  5. Juicebox portion → pay() into JB project → mints GOODS
```

**Split config**: Operator-adjustable per garden. Stored as basis points (must sum to 10000).

**GOODS token**: Juicebox v5 treasury-backed ERC-20. Payment-minted, redeemable, reserved rate for airdrops. Voting power comes from Hats/NFTPowerRegistry, NOT GOODS balance.

**Gardens V2 Arbitrum Sepolia addresses**:
- RegistryFactory: `0xf42f88c13804147b2fdda13c093ce14219aea395`
- CVStrategy: `0xed9a35c3a11d258d0d8267c2e64b69929c7ae530`
- 10 active communities, 26 strategies

**Juicebox v5**: Deployed on Arbitrum One + Arb Sepolia. See [docs.juicebox.money/dev/v5/addresses](https://docs.juicebox.money/dev/v5/addresses/).
