# Celo Garden Safe ceremony checkpoint — 2026-08-20

## Status

The Celo Garden Safe, Zodiac Roles, module-enablement, and executor-route ceremony is complete for
all 18 Gardens. The onchain work can remain parked while UI work continues.

The repository has **not** completed the post-ceremony re-freeze. The committed release manifest
still has `safeAuthority.enabled: false`, `safeAuthority.gardenSafes: []`, and unset
`zodiacRoles.module`, `roleKey`, `conditionsHash`, and `allowanceKey`. Until that re-freeze is
reviewed and merged, no settlement, canary, fee-reserve funding, or Arbitrum `setCcipRoute`
transaction is authorized by this checkpoint.

The Roles, enablement, and route stages ran through the release operator pinned to commit
`32e25d621065d34d062a6943e506b3e0aed3a7da`. The frozen manifest hash at that commit is
`0xa8be2ac177a457d2636d1ef705a8b05dac00d18198672eefb00dc75e97d85392`.

## Completed onchain stages

| Stage | Completion | Plan hash | Final transaction | Final block |
|---|---:|---|---|---:|
| Garden Safe deployment | 18 / 18 | `0x0ef63587413b6286f4ada725d83145413c85e6380aa477e085d61a2a9793a81d` | `0x89709d11d4acada891449c3d9a6171fe16f9af9684ab6a500b3532d7411e6548` | 75135804 |
| Zodiac Roles configuration and ownership transfer | 126 / 126 | `0x89fbc39bf16328517a1e1b84ab9d78e5de1f474f0cc790386383d52f1773ae95` | `0xb9b394e5aa97dc759d9b080088ad874bde9762bebce467c293d326ffd0b82c51` | 75388274 |
| Safe module enablement | 18 / 18 | `0x5be22d3f099a6ce4bb7bbebf8a14a0099a24586df88d8fcd3761099f890d7b50` | `0x12dea5004e6ad3393049187988b3ce67df6e01a344eaa1de5f9852bb65d81f64` | 75389631 |
| Executor Garden route binding | 18 / 18 | `0xab7110ccb459664c4021dab5a67c9d776b25c20ea0ed5e5c64bdd35e69016704` | `0xad5962f29a9195c3fc7cd7093141e1477775df391010c669e49a2bd1963878e2` | 75390218 |

After module enablement, the operator ran `bun run settlement:garden-roles:verify` and received:

```text
Verified 18 Roles modifiers: avatar, target, ownership, membership, allowance, and module state.
```

After route configuration, the operator ran `bun run settlement:garden-routes:verify` and
received:

```text
All 18 Garden routes match the reviewed plan.
```

## Frozen authority identities

- Safe singleton: `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762`
- Safe factory: `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67`
- Roles v2 mastercopy: `0x9646fDAD06d3e24444381f44362a3B0eB343D337`
- Roles factory: `0x000000000000aDdB49795b0f9bA5BC298cDda236`
- Role key: `0x53905249f34c6420380224324b0c3e1521b717a2c165dfab931f8121c5160ce5`
- Allowance key: `0x675d2ce2e7ee2d674ee28f4a96615cf1d706e9a055fabe883e7d69472108302b`
- Canonical target: `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`
- Canonical selector: `0xa9059cbb`
- `keccak256(conditionsEncoded)`: `0xa1a076f78edfb7f6af43f202947371d2c6d449c7f5c789cc3a31a94bfd006a00`
- Celo settlement executor: `0xB8a7F3c3DfA407c45e05b7B2381233101938a84F`

The condition hash above is derived from the reviewed plan's exact encoded condition tree. The
post-ceremony re-freeze must revalidate its intended mapping to
`safeAuthority.zodiacRoles.conditionsHash` instead of copying it without a test.

## Garden, Safe, and Roles inventory

| Token | Garden | Safe | Roles modifier | Permission configuration hash |
|---:|---|---|---|---|
| 0 | `0xf401f34378384713222d1d21f63359cc4E8a858a` | `0xe41a1e446644034f24a4B2E1bfB28Fd414dBc66d` | `0x679AEB80a481772Df85E2b93F8fDc5180EF422e1` | `0x209742b923570909ea2d3e411472c811312da1438a26428f674d2344d7b948bf` |
| 1 | `0xF7b892886998DAe960D64a9db488336684F137A0` | `0xa23716F7B0DBBB0387Fb1274f1Ae8247670dCC37` | `0x2E99B81149226dc97397cdF1d8A75498700b29E0` | `0x6e0ae964b5610e21c55f498a92781517b2fe14bcac58b11b8b8061b89bdd3f84` |
| 2 | `0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3` | `0x67828f64f6D33522679F40D9f1BE1F53c9eb71cB` | `0xBfFE452892Ae484727D51073c796bbC32791a318` | `0xb0f75be63f56312073572eaf97559b68ee30477dc1c5af512a76c705136ad941` |
| 3 | `0x4055530dB392FB2B56037065A512c5b283D90A10` | `0xCFfADc80904b760F1588D0Ebfd53f4c307691A86` | `0xbdF9c2Ef74097eD6b96b198B7745A6ec314b20BD` | `0x4fc97aa512a6cf6096de5148956a14b9d82079384981e22f68798fce4a3b69a8` |
| 4 | `0x51499A44BB7793647e67ed827bd17367d7e55314` | `0xC9D5bF40a49a0a5A60E1677aAA06342655025c94` | `0xD8661E8Ba898cf94e8cc0ce72E5aC55e032D7a6b` | `0xa7310d66898ed1c2a0d97084e21a270728144567226c985bc00e3ccfdd423c58` |
| 5 | `0xbcCE994513615988690aBCA373B1368218E4957C` | `0x6640D2809aA4989192F1caaF6D9614BaD9aA5518` | `0x7dF7Ada423B3A4a9f740976c7513EB319480A222` | `0x66a95601163f1fad425be9a1acef8e47aedada3c832c408f693338544c6a41b1` |
| 6 | `0xFDa72CE1D75b735d6595E5814DDF23b97516caEf` | `0x6e64e6bB9977BF1d5db40f71bCBb194269cE503B` | `0xE5b6B19195973e5480EaFA4144F52237d22DB94b` | `0xe41721692f85af26f47f0f98c8804fb910eef582ae24680de9505d61adf6a897` |
| 7 | `0xD1F8e787a325F91F5d4Be2D30ea1E67B19e28b30` | `0x0092904e7c33e04EcAc35E2e45cD6D1D1571EE81` | `0xc916ceDDf02749931E6d68670720b8307bBDf54d` | `0x2b3594997a8defc74182e178d83ca2cb3e7abdb804d02540b5b96d165faa63f2` |
| 8 | `0x4f11FB4c255D3eDC7C44a461ab45fBC421Aacb09` | `0x1295E5F1D78e0f1904A78798bA494d2Bb996E23b` | `0xd50C59Eb4611C3ea247BF72DB29d65b0F8B6FC08` | `0xd7b2a9102b7e0423c55cc963999dd7fe5737cb93280e3a76a0ce0baa5b626d9e` |
| 9 | `0x636962584b1F492B06151Fee87810281372879b6` | `0x3EB95Adb3B603945C3a422fe564aAAB605d27a4b` | `0x05102eAA437eFe9f3E68f8d58C4AdA5945135Aae` | `0x60fa8de81f1ae68aed6c30a7308295dc0030afa80c364ed5bcd957b015df4a96` |
| 10 | `0x1121218D5e017B57c6DF3B5a001a991BDB910338` | `0x94706E563B94980EDe33bd7A538B3D24a53ef010` | `0xd42142f56a7D6390Ed827fC4D98C03165cb239DE` | `0x06f32d42a5cdae3c727ca8a7f3609adb6d4811c72af04d76effc892d363359e1` |
| 11 | `0x3f0f1551C7E08a2cf6800BD7D72aBfE23E3E32a0` | `0x7Cf45A3205CE3FFC3e552bc0b49B3bF3aA090241` | `0x8CEd80d759da8A0D73Dd1A8Ee2c31fF724C22F9C` | `0x489a500b338b822fd90ec735de958259e6e4f7ce7be01ce6a790e8635acb8051` |
| 12 | `0x3F22568aE0deAA24dA7b8c669AfDcBD72A6A7fd8` | `0x8d759c89f82A8eCE6e45164Ba9cDD32fE498f2D9` | `0x617DDcaED815DabbA0348b94642d52AB9bbf060d` | `0xb6c2329cd0d828daa69b60781f85b1fac9a428d2eb36ac8d3a70bf2c1100cc7c` |
| 13 | `0x26c32E54F23af9F9fcC757414c76E56e3fB176E2` | `0x15F104203570BC53B5349EE888e02B0DB100E4F7` | `0x9fbe57F793151dEB8b969413Bf3780D6aD84a345` | `0x80496183f9f61a2496ab9e32b61a3060404a498a829dce30ab4fe63a4e647ded` |
| 14 | `0x35077CaF6fBef1d5677d318a198C9c47C61bb976` | `0x14094635AdA852bCd740AdF546D2ef0dd79Ad4DB` | `0x1b03f8722c2649f605482748C0072e6D79812Ea6` | `0xd9eda50eba02271fb91cc6dc7e49eb340f62ed4d3d4ee8fadbe2acf1acb104b5` |
| 15 | `0x7bE6eAeb2FB5842Da06A34Af4fAe418347427cd1` | `0x82EFf72CB9A33fC6F74422146Ae04F8629097db9` | `0x4e68c3dC1fb7877a88Ba392839845E05C17c87E3` | `0x8720bee862f9f31f71368f6c80b6abbeb5fd7a5a5a9c4feeeb7c97b71e1c2613` |
| 16 | `0x35722eEdf3F7566A23FA871f0a04267AEe78E0dB` | `0x6516E0051D95b6C6B3a8Fa051b1bF51821e9697c` | `0xEac98FCF7793897F4aafF77B1a7A167317Ee5D1D` | `0xf747d7f99620ea3a3000c83e918914bcf16db4dfdcccfc6da17128610ba3da72` |
| 17 | `0x749F84CA070cD2F98d9353F49eCE77C1A3fED532` | `0xB2C312402dbaabBe0cDB91aD387A4b46689f35B5` | `0xC1F06bFE2b8264750d2B092F8BE582d178eC7834` | `0x2ce4ef3508c6ac363c90e4fa9b485ba37cc24a5f81c8ab67406f19477c7ad380` |

## Local receipt ledgers

The complete receipt ledgers and reviewed plans remain in ignored runtime files:

- `packages/contracts/.generated/runtime/42220-garden-safe-final.json`
- `packages/contracts/.generated/runtime/42220-garden-safe-final.checkpoint.json`
- `packages/contracts/.generated/runtime/42220-garden-roles.json`
- `packages/contracts/.generated/runtime/42220-garden-roles.checkpoint.json`
- `packages/contracts/.generated/runtime/42220-garden-roles-enable.checkpoint.json`
- `packages/contracts/.generated/runtime/42220-garden-routes.json`
- `packages/contracts/.generated/runtime/42220-garden-routes.checkpoint.json`

These files are useful local evidence, but this committed report is the durable restart record. Do
not pop the older broad pre-ceremony stash to recover them; it contains obsolete contract copies.

## Resume point: post-ceremony re-freeze

Resume from current `develop` on a dedicated branch such as
`chore/celo-safe-authority-refreeze`. This is repository work, not another transaction ceremony.

1. Re-read the live state with `bun run settlement:garden-roles:verify` and
   `bun run settlement:garden-routes:verify` from `packages/contracts` using a working Celo RPC.
2. Populate `safeAuthority.gardenSafes` and the receipt-backed
   `safeAuthority.zodiacRoles.{module,roleKey,conditionsHash,allowanceKey}` representation in
   `packages/contracts/config/commitment-pooling-release.json`, then set
   `safeAuthority.enabled: true`. All fields must flip together.
3. Keep `safeAuthority.caps.maxBatchSize: "2"` and
   `chains.arbitrum.destinationGasLimit: "3000000"` unchanged.
4. Run `bun run release:manifest:write` from `packages/contracts`.
5. Diff `packages/contracts/config/commitment-pooling-release.lock.json`. A manifest-only
   re-freeze may change `manifestHash`; it must not change a library, implementation, proxy, or
   other contract address.
6. Run the repository Ship Gate: `bun format && bun lint && bun run test && bun run build`.
7. Commit only the manifest, lock, and any focused manifest tests required to prove the enabled
   authority shape. Open and merge that PR before authorizing settlement.

Do not rerun the completed release stages. The next onchain work happens only after the re-freeze
merges and the release owner separately authorizes it.

## Remaining live gates after the re-freeze

- Fund the Arbitrum SettlementModule at `0x15c8F6CF25abA2161cc04719b4C4a93c4146935D`
  with enough ETH to remain above the frozen reserve floor.
- Fund the CeloSettlementExecutor at `0xB8a7F3c3DfA407c45e05b7B2381233101938a84F`
  with enough CELO to remain above the frozen reserve floor.
- Execute and verify the Arbitrum `setCcipRoute` boundary with the frozen 3,000,000 destination
  gas limit.
- Run the separately authorized message-only ping/ack and minimum-value settlement canary before
  any broader settlement.

This checkpoint grants no new broadcast, funding, canary, value-movement, cap-increase, ownership,
or unpause authority.
