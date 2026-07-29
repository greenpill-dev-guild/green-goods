# HatsModule upgrade plan review

## Ethereum Sepolia

- Plan: `packages/contracts/deployments/tx-plans/11155111-hats-module-1785229089037-plan.json`
- Existing proxy: `0x8dF31575A30765d7cca6D788644fD0d4FE33a433`
- Baseline implementation: `0x75cab68f8a0c42d580c32750968760bfdd2c3fd3`
- Simulated new implementation: `0xc69fdc14f8b7b1c9133f398d33590c40d5a9cda7`
- Sender: `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`
- Transactions: 2 (`CREATE HatsModule`, then proxy `upgradeTo(address)`)
- Simulated sender nonces: `0xc2`, `0xc3`

### Broadcast result

- Executed: `2026-07-28`, Sepolia block `11370084`
- New implementation:
  `0xC69FDc14f8b7B1C9133f398D33590c40D5A9cdA7`
- Implementation deployment:
  `0xe40f7a3df4c54def14467998565559f375eaed667bcdc05383d02c24be5b9a31`
- Proxy `upgradeTo(address)`:
  `0x08f9133733ab7b0052dfa75a825dd9e25a1b7530004893224ff1162e27f41c3b`
- Both receipts succeeded; total paid `0.003715001812422588 ETH`
- The focused post-upgrade verifier passed against
  `steward-upgrade-baseline-11155111-11367374.json`: the implementation changed to the reviewed
  address, owner and Hats references were preserved, every configured garden retained its hat IDs,
  and `isStewardOf` matched the deprecated `isOperatorOf` alias for live wearers and non-wearers.
- Fresh-garden proof transaction:
  `0xee7f0572ac86d6aec0f97ac12a68b610595667566e2bdf844b5a6a09c12be946`
  at block `11370209`
- Fresh Garden token ID `3`: `0x5F786EEE7FA81F9FacCcbFc98C904d25f50eE5A5`
- The Garden is configured and its live Steward hat is mutable and active with one wearer. Hats
  Protocol returns the exact details `Steward Upgrade Proof Steward`.
- `isStewardOf(garden, 0xFBAf…6ad6)` and the deprecated `isOperatorOf` alias both return `true`;
  `isStewardOf(garden, 0x0000…dEaD)` returns `false`.

## Arbitrum One

- Final reviewed plan:
  `packages/contracts/deployments/tx-plans/42161-hats-module-1785266128454-plan.json`
- Existing proxy: `0x5b943088ecdDBF8E4ae387348A88A654aC5F7266`
- Baseline implementation: `0x94de91835fdc320862c3c44c6843834e957e2536`
- Simulated new implementation: `0xe5e5cbeda7dc1139af2e04bd4a6784b42b4becd2`
- Sender: `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`
- Transactions: 2 (`CREATE HatsModule`, then proxy `upgradeTo(address)`)
- Simulated sender nonces: `0x36f`, `0x370`

### Broadcast result

- Executed: `2026-07-28`
- Implementation deployment:
  `0x9f198611736800de26ff5b876123e4956d96fc63d983b1a6d097dc7063e694cb`
  at Arbitrum block `488767418`
- Proxy `upgradeTo(address)`:
  `0x309db01d9ae1b7ecd2eafeaebd5fdd316f9fec1b722da3ce853f379ca7706808`
  at Arbitrum block `488767422`
- New implementation:
  `0xE5E5cbEDa7DC1139AF2e04Bd4a6784B42B4BeCD2`
- Both receipts succeeded; total paid `0.000070675496836 ETH`
- The focused post-upgrade verifier passed against
  `steward-upgrade-baseline-42161-488705295.json`: owner and Hats references were preserved, all
  18 configured gardens retained their hat IDs, and `isStewardOf` matched the deprecated
  `isOperatorOf` alias for live wearer and non-wearer probes.

## Review boundary

The Sepolia and Arbitrum HatsModule simulations, broadcasts, and focused post-upgrade verification
are complete. The Arbitrum password-gated PRD-748 relabel also completed: all 18 transactions
succeeded, and a fixed-block re-read at block `488774048` confirmed the exact `... Steward` details
while preserving active and mutable status for every target. Full execution evidence is recorded in
`post-execution-evidence.md`.

Three rendered spot checks in the official Hats Protocol app subsequently showed the exact Steward
labels for Green Goods Community Garden, TAS HUB, and AgroforestDAO. PRD-747 and PRD-748 acceptance
is complete; only branch review and merge hygiene remain.

## Adjacent onchain prerequisite findings

### GreenWill (PRD-575)

- Live Arbitrum preflight at block `488682069` confirmed proxy
  `0x6e6895580b386eB3aB9efe228f79cdBe5B61F5e7` still points to implementation
  `0x2F1D6BF292A24c0698D1Dc16099296833f9d8C96`.
- The proxy owner is Safe `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C`, with threshold 2 and owners
  `0x04D60647836bcA09c37B379550038BdaaFD82503`,
  `0x2aa64E6d80390F5C017F0313cB908051BE2FD35e`, and
  `0xD2838aCb302F40E06f3FDC05f5b357034113262E`.
- The current deployer wrapper attempts both the implementation deployment and `upgradeTo(address)`
  from `0xFBAf…6ad6`. Live-state transaction-plan simulation correctly reverted with
  `Ownable: caller is not the owner`; the published wrapper must not be broadcast as written.
- The focused pinned-block Arbitrum fork test passed:
  `test_fork_claimsFirstSupportFromLiveVaultPosition()` (1 passed, 0 failed).
- The release path must be split: deploy the reviewed implementation from the deployer EOA, then
  import and execute a Safe Transaction Builder call from the 2-of-3 owner Safe to the proxy's
  `upgradeTo(address)`. Pointer verification and the low-stakes badge-claim smoke follow Safe
  execution.

### ENS avatar (PRD-663)

- At Ethereum block `25633034`, the current receiver
  `0x742c8935d314363e8c16df5b0791525109Fb9387` was live and wired to ENS Public Resolver
  `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63` plus NameWrapper
  `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`. The resolver reports support for both address and
  text records, and the parent `greengoods.eth` name already resolves an `avatar` text record.
- NameWrapper reports `0xFBAf…6ad6` as the wrapped parent owner and confirms the receiver remains an
  approved operator. The receiver's L2 sender is
  `0x4fAD8Db8e04005884D484eC730aDae10d7A2e491`, matching the live Arbitrum
  `GreenGoodsENS.l1Receiver()` read at block `488683918`.
- `ResolverStub.sol` is unrelated to this ENS path. Resolver storage is not the blocker.
- Neither deployed contract exposes an avatar/text-record CCIP action. Both `GreenGoodsENS` and
  `GreenGoodsENSReceiver` are constructor-deployed rather than UUPS proxies, so PRD-663 is not a
  ready-to-broadcast upgrade. It needs an architecture decision and contract implementation for
  the sponsored sender/receiver path, plus redeployment, rewiring, migration, and propagation
  verification.

## Remaining release sequence

1. Finish branch review and merge hygiene for PRD-747/PRD-748.
2. Complete PRD-762's signed offchain app-avatar path.
3. Complete Afo's final PRD-649 architecture fine-comb, then dispatch PRD-721 Commitment Pooling
   contracts.
4. Coordinate the deferred PRD-575 GreenWill Safe release separately with the Green Pill Dev Guild
   Council, and leave PRD-663's eventual ENS-record architecture deferred.
