# RESR-21 · Wallet recovery on an Arbitrum One fork

**Observed** 2026-11-08 UTC  
**Fork** Arbitrum One, chain ID 42161, block 522329710, block hash `0xaacc14f0a962d143f80e6c97fd034fc93109c0463e1627c1596da512ff4dd3fe`  
**Checkout baseline** `ce324c2e9ec33d4e1863be383b91e9972a83b4d9` plus a disposable local rig  
**Browser evidence** Clean-room Chromium 148.0.7778.96, CDP virtual authenticator, empty app storage  
**Environment** Anvil fork with deployed Kernel 0.3.3, EntryPoint 0.7, WebAuthn validator, and reporting policy contracts. The attestation target and paymaster were fixtures. The sign-in binding and guardian executor were prototypes.

| Check | Observed result |
|---|---|
| Guardian enrollment | The original passkey signed enrollment and onchain state identified the EOA guardian. Two independently scoped reporting grants both executed before recovery. |
| Rotation after loss | After the original browser and authenticator closed, the enrolled EOA replaced the key on the same account. EntryPoint rejected the old passkey with `AA24 signature error`. Simulations rejected the wrong guardian, an invalid replacement key, and replay of the consumed authorization. |
| Clean sign-in | A fresh browser verified the replacement passkey and resolved the original address through a prototype binding checked against the validator. The replacement credential independently derived a different factory address. ERC-1271 returned `0x1626ba7e` at the original address. |
| Grant survival and discovery | Both grants still executed after recovery. The rig found them from Kernel `SelectorSet` events and verified their active state. |
| Nonce sweep comparison | On a fork snapshot, `invalidateNonce` stopped both delegates and the recovered owner could still submit a UserOperation. The owner's ERC-1271 check reverted with `InvalidNonce`. |
| Targeted revocation | After restoring the snapshot, the recovered owner removed both grants with `uninstallValidation`. Both guard permissions retired, delegate attempts failed, and the recovered owner retained ERC-1271 and UserOperation signing. |
| Production app boundary | The current grant-management gate refused the 0.3.3 account as `unsupported_account`. The rig supplied the recovery binding that current auth lacks. |

The run completed with exit code 0. This is research evidence from disposable fork accounts. The implementation still needs fresh proof through the production directory and grant-management entry points, a reviewed executor, and a device and sponsorship rehearsal. [Research issue](https://linear.app/green-goods/issue/RESR-21/kernel-guardian-recovery-and-ens-username-recovery-boundary) · [Implementation plan](../plan.todo.md)
