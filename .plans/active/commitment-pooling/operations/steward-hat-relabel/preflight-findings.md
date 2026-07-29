# Steward hat relabel preflight findings

## Reviewed live inventories

- Ethereum Sepolia at block `11367374`: 3 configured gardens, 3 unique mutable and active
  operator hats, and 3 current GardenAccount controllers. Mint discovery used 243 bounded log
  queries from GardenToken deployment block `10292042`.
- Arbitrum One at block `488539541`: 18 configured gardens, 18 unique mutable and active operator
  hats, and 15 current GardenAccount controllers. The full-range mint query succeeded.
- Every current label has an exact ` Operator` suffix and therefore maps deterministically to
  ` Steward`.
- Both inventories have zero validation errors.

The deployment artifacts on both networks record the root garden as token ID 1, while the live
root garden address is derived from token ID 0. The relabel inventory resolves the live address
correctly and includes it. Correcting the deployment artifact is outside PRD-747/PRD-748.

## Arbitrum authorization finding

The configured Green Goods Safe is `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19`.
It is neither the current GardenAccount controller nor a direct effective admin for the 18 target
hats. `preflight-42161-488542582.json` records zero direct-admin matches and zero controlled
GardenAccounts, then fails closed. No `safe-batch-*.json` was emitted. A single Safe batch from
that address would revert.

The Safe result is not the full Hats hierarchy result. A fresh direct read at Arbitrum block
`488652431` confirmed that the HatsModule owner and deployment account
`0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6` is an effective ancestor admin for all 18 target
hats. The same read reconfirmed the Green Goods Safe at 0/18 and
`0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C` at 0/18.

The preferred execution path is therefore one direct common-admin plan from `0xFBAf…`, not
coordination across 15 GardenAccount controllers. `prepare.ts` now emits
`direct-admin-plan-*.json` automatically whenever the live HatsModule owner remains an effective
admin for every target. Controller partitions remain a fail-closed fallback artifact only.

The Safe stop condition still holds: no Safe Transaction Builder batch should be emitted for the
configured Safe unless a future live preflight proves its authorization.

## Reviewed artifacts

- `preflight-11155111-11367374.json`
- `steward-upgrade-baseline-11155111-11367374.json`
- `execution-partitions-11155111-11367374.json`
- `preflight-42161-488539541.json`
- `steward-upgrade-baseline-42161-488539541.json`
- `execution-partitions-42161-488539541.json`
- `preflight-42161-488542582.json` (failed candidate-Safe authorization assessment)

The direct-admin plan must be regenerated from a fresh inventory immediately before execution; an
older fixed-block plan is intentionally not persisted here. No broadcast, Safe import, signature,
or execution was performed.
