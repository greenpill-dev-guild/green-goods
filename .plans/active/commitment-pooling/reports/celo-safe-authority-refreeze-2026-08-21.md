# Celo Safe authority re-freeze — 2026-08-21

Closure artifact for the resume point in
[`celo-garden-safe-ceremony-checkpoint-2026-08-20.md`](./celo-garden-safe-ceremony-checkpoint-2026-08-20.md).
That report is the record of the ceremony and stays as written; this one records the repository
re-freeze it asked for. The re-freeze is done. Do not re-run it.

## What changed

`packages/contracts/config/commitment-pooling-release.json` now carries the completed ceremony:
`safeAuthority.enabled` is `true`, `gardenSafes` names all 18 Garden boundaries, and
`zodiacRoles` carries the module, module factory, role key, allowance key, and condition hash.
`caps`, `feePolicy`, and `chains.arbitrum.destinationGasLimit` were not touched, and every byte
outside the `safeAuthority` block is unchanged.

The manifest hash moved from `0xa8be2ac177a457d2636d1ef705a8b05dac00d18198672eefb00dc75e97d85392`
to `0x2c7fd3ec4e7dc461af193e2eda2635042e63b5e2342592c3360c193705d7df6a`. That is the **only** line
that changed in `commitment-pooling-release.lock.json`: no library, implementation, proxy, or other
contract address moved, and the identity count stayed at 31.

## How the values were established

The ceremony receipts, not the prose of the earlier report, are the source. Both live verifications
were re-run against Celo first and both passed:

```text
Verified 18 Roles modifiers: avatar, target, ownership, membership, allowance, and module state.
All 18 Garden routes match the reviewed plan.
```

Each of the 18 rows in the earlier report's inventory table was then diffed field by field against
`.generated/runtime/42220-garden-roles.json` — token id, Garden, Safe, modifier, and permission
configuration hash — with no mismatch.

`conditionsHash` was **derived**, not transcribed, as the earlier report required. It is
`keccak256(encodeConditions(buildTransferConditions()))`, and a test in
`script/utils/release-manifest.test.ts` now recomputes it from those two exported functions on every
run, so the manifest cannot drift from the condition tree the ceremony actually scoped.

## One shape decision worth knowing

`zodiacRoles.module` is a single field but the ceremony deployed 18 modifiers, so `module` holds the
shared Roles v2 mastercopy (`0x9646fDAD06d3e24444381f44362a3B0eB343D337`) and each Garden's own
modifier proxy lives in its `gardenSafes` entry. A test asserts no Garden's modifier is ever the
mastercopy itself.

## Gates that had to move

The earlier report's seven-step procedure did not account for these. Three places hard-asserted the
disabled state and would have failed or lied once authority was enabled:

- `script/release-verify.ts` checked `manifest.safe-authority-disabled` against a literal `false`.
  It now proves the opposite property that still has teeth: authority is frozen and the freeze names
  all 18 boundaries, so a nineteenth Garden cannot inherit authority without its own ceremony.
- `script/utils/release-manifest.test.ts` proved authority *could not* be enabled. It now proves the
  enabled shape fails closed — clearing any one Zodiac identity is still rejected, and disabling
  authority while garden Safes stay listed is still rejected.
- Two strings in `script/deploy/release.ts` told the operator authority was disabled. Both now
  reflect the real state.

A fourth fix is unrelated to authority but was found on the way: the "production artifact missing"
error told the operator to run `bun run build:full`, which compiles the test profile and leaves
`out/production` empty, so following it reproduces the same error. It now names
`FOUNDRY_PROFILE=production bun run build`.

## What this does not authorize

Enabling authority in the manifest records that the ceremony happened. It does not authorize
settlement. Every remaining step moves value or sends a transaction and belongs to the release
owner, in order:

1. Fund the Arbitrum SettlementModule at `0x15c8F6CF25abA2161cc04719b4C4a93c4146935D` above the
   frozen reserve floor.
2. Fund the CeloSettlementExecutor at `0xB8a7F3c3DfA407c45e05b7B2381233101938a84F` above the frozen
   reserve floor.
3. Execute and verify the Arbitrum `setCcipRoute` boundary at the frozen 3,000,000 destination gas
   limit.
4. Run the separately authorized message-only ping/ack, then the minimum-value canary, before any
   broader settlement.

Ownership transfer, cap increases, and unpause remain behind their own authorizations.
