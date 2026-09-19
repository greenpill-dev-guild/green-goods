# Exact GardenAccount Address and Code Derivation

**Research date**: 2026-08-15  
**Arbitrum account-state snapshot**: block `494723355`, hash
`0xa8742380f0f81521afc93d2a42ac07281da303d3df9a7edabe74280fab057e1e`  
**Celo absence snapshot**: block `74877942`, hash
`0x2fa5b357de77d2d91e826cb4d92dfde6e635ba46ea2fb074be0433a3d60954fb`

## Result

The exact Arbitrum GardenAccount implementation address **is reproducible on Celo**. The live
Arbitrum deployment transaction was recovered, every CREATE2 input recomputes the live address,
the CREATE2 factory has identical code on Arbitrum and Celo, and the same deterministic dependency
and implementation addresses already exist byte-for-byte on Sepolia.

Address equality is not yet release readiness. Celo is missing the exact ResolverStub, Guardian,
two resolver proxies, GardenAccount implementation, and all 18 account proxies. The Garden Safe
predictions also cannot be frozen until PRD-733 names the exact Celo protocol and Dev Guild
recovery Safes.

Machine-readable evidence:

- `deterministic-deployments-42161-2026-02-19.json`: original deployment transactions and CREATE2 inputs;
- `historical-garden-account-rebuild-2026-08-15.json`: independent historical-source production-profile rebuild and exact bytecode comparison;
- `garden-account-initializers-42161-494723355.json`: all 18 tuples, runtime hashes, and initializer hashes;
- `celo-account-absence-42220-74877942.json`: matching Celo predictions and absence proof; and
- `ccip-arbitrum-celo-lane-2026-08-15.json`: current official router and bidirectional lane reads.

## CREATE2 deployment ledger

Every row uses Nick's deterministic deployment proxy
`0x4e59b44847b379578588920cA78FbF26c0B4956C`. Its 69-byte runtime hash is
`0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989` on both
Arbitrum and Celo.

| Artifact | Target | Salt | Init-code hash | Init bytes | Original Arbitrum transaction |
|---|---|---|---|---:|---|
| AccountGuardian | `0x05F486E3161F895Ad99f041065224F78bDf580a7` | `0xd80ce91b7f038d4f7097354209f7a70ebd75f10f05468bae191e6d2594854741` | `0xf8dfa357377f7fa9605cf12e9a6d77c5ff70adfeb96b569c1863b39e43c0cac0` | 1,371 | [`0x886e…c896`](https://arbiscan.io/tx/0x886e68f7f9654bc3411849a9108ee05a94936b594448b511d60e9fb703b0c896) |
| ResolverStub | `0x74c96fCEa9ad0345D476f0e4feF3D8Ef29C157d9` | `0xb8e2b4839a4bcb20a701002667aff37c6970ddf6973f15640db4596fe770a85b` | `0x96fb6b8979f6cd563e9d88555b850957b3ae8e1e6fba2e650d38a7e724ed1296` | 3,325 | [`0x6338…9d68`](https://arbiscan.io/tx/0x63389e34d2fa3577a973900a670ca3122b55eb60dc53d152b8a251c0a6039d68) |
| WorkApprovalResolver proxy | `0x166732eD81Ab200A099215cF33F6A712309B69F7` | `0x080469a2df89af45a71882c2e2c8da445ba6b25c409b18d8420d9dfd66dfa2ca` | `0x8934c32aa8b4f8b160873ea9ce72aaa371be43d0d8134ef56374d29a5b48ff61` | 1,077 | [`0xe955…b146`](https://arbiscan.io/tx/0xe9556e392bb829f265d2b8df8f1c5563e7197fead20c8e86ad0343d03142b146) |
| AssessmentResolver proxy | `0x0646B09bcf3993F02957651354dC267c450CFE58` | `0xf7f59a27ff12eaee7bf0324ac79182547ea079b89528ee84911b8a128edfd4f7` | `0x8934c32aa8b4f8b160873ea9ce72aaa371be43d0d8134ef56374d29a5b48ff61` | 1,077 | [`0x087a…da4e`](https://arbiscan.io/tx/0x087a21164b2eaf790ded3a4f6398bf028a64ec099e234c3e43e911efc908da4e) |
| GardenAccount implementation | `0xE31cAeAc029A60AD17A49278Fdd58032eF9Cf692` | `0xd80ce91b7f038d4f7097354209f7a70ebd75f10f05468bae191e6d2594854741` | `0x3a708bd560aa01c10c0bdca56f9865aa66b32948bdb8325e877ed2d83ac46e98` | 20,463 | [`0x7e9f…e19b`](https://arbiscan.io/tx/0x7e9f70b7539e5e4dc87ca8752ff036a130dfc8355a32ff6444b7ef0815dce19b) |

The GardenAccount transaction was sent by
`0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6` at nonce `430` in Arbitrum block
`433714044`. Its 20,271-byte creation-code hash is
`0xe5881fadca477b56a383c92f06857d810cffb66727c806bde69e03ff06d2ff81`.
The 192-byte constructor-argument hash is
`0xee57f40296390b8cf6e691ae5df17b2f83642ce1b4aa9567227ecdcd158ec648`.
The resulting 19,623-byte runtime hash is
`0xa9f4f87514a3328e44e18f11f312b4d9b1c358c94428d9718892734671aba07a`.

The recovered compiler metadata is Solidity `0.8.28+commit.7893614a`, Cancun EVM, optimizer
enabled with one run, Yul and IR enabled, and metadata bytecode hash disabled. No external linked
library addresses are reported. An independent rebuild from repository commit
`175469f2fc699712a9fa8016d6aa25390282989d`, with tokenbound commit
`2bd70ff3fb5f1c0e562425b4d5312f619d9f2720`, reproduced the exact 20,271-byte creation code,
192-byte constructor arguments, 20,463-byte init code, factory input, and CREATE2 address. Modern
Foundry required the two path-only OpenZeppelin remappings later committed in `da1ab42f5`; no
Solidity source or compiler setting changed, and the exact byte-for-byte artifact match closes the
historical rebuild gate. See `historical-garden-account-rebuild-2026-08-15.json`.

## Exact constructor and proxy inputs

GardenAccount constructor addresses, in order:

1. EntryPoint `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`;
2. Multicall3 forwarder `0xcA11bde05977b3631167028862bE2a173976CA11`;
3. ERC-6551 registry `0x000000006551c19487814612e58FE06813775758`;
4. AccountGuardian `0x05F486E3161F895Ad99f041065224F78bDf580a7`;
5. WorkApprovalResolver proxy `0x166732eD81Ab200A099215cF33F6A712309B69F7`; and
6. AssessmentResolver proxy `0x0646B09bcf3993F02957651354dC267c450CFE58`.

EntryPoint, Multicall3, and the registry already have byte-for-byte matching runtime on Celo.
The other three immutable targets are absent. The Guardian constructor fixes its initial owner to
`0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`; that same EOA owns the existing Celo Guardian, so
the required key path exists, but relay trust and any ownership transfer remain separately
reviewed release transactions.

Both exact resolver proxies use the same 917-byte ERC1967Proxy creation code, the same
`0x74c9…57d9` stub, and initializer
`initialize(0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6)`. After deterministic proxy deployment, the owner
must upgrade each proxy to a reviewed Celo implementation whose constructor immutables point to
Celo EAS and ActionRegistry. The proxy address and 154-byte runtime remain exact while the
implementation slot becomes Celo-specific.

## Eighteen Garden accounts

At the Arbitrum snapshot, token IDs `0` through `17` all round-trip through the canonical registry
with the immutable tuple `(42161, 0xe1Da…6593, tokenId)`. On Celo, the same call returns the exact
same 18 addresses and all 18 have no code at the pinned Celo block. The per-account runtime and
initializer hashes are frozen in `garden-account-initializers-42161-494723355.json`.

`TBALib` must keep its native `block.chainid` behavior. The new helper must call the registry with
source chain `42161` explicitly.

Account creation and initialization need stronger atomicity than merely calling those two
functions together after implementation deployment. Because ERC-6551 proxy creation is
permissionless, the exact GardenAccount implementation deployment and initialization of all 18
accounts must occur in one coordinator transaction, or through an equivalently reviewed private
atomic bundle. A pre-created but uninitialized canonical proxy may be adopted only after its exact
runtime and zero initialization state are proven. Any initialized or mismatched account stops the
transaction.

## CCIP lane snapshot

The official Celo CCIP directory lists selector `1346049177634351622`, router
`0xfB48f15480926A4ADf9116Dca468bDd2EE6C5F62`, and an outbound Arbitrum lane. Read-only router
calls also prove both directions at the evidence snapshot:

- Arbitrum selector `4949039107694359620`, router
  `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8`, Celo on-ramp
  `0x68647D235262873Be5a30fceaA6CAA318a750773`, Celo off-ramp
  `0x0eA1070B08757Da69a0762ae38D037cdd08C5e98`;
- Celo router, Arbitrum on-ramp `0xf27b5D3205fEa8aD6Ce8Fbe3b6178867428E5732`, Arbitrum off-ramp
  `0x3980b6e3d2f23AF4D700d12C42af1B92AB8ea933`.

These identities must be reread at the release snapshot. The relay still needs independent tests
for router-only entry, authenticated source selector and sender, exact Garden/Safe/action binding,
deadline, nonce, cancellation, finalization, and replay.

## Open gates

1. **PRD-733 recovery identities are designated and live-state verified.** Afo designated the Celo
   Green Goods protocol recovery Safe as `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19` and the Celo
   Greenpill Dev Guild recovery Safe as `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C` on
   2026-08-15. Official Safe Wallet reads now show both are v1.4.1+L2 with the reviewed owners,
   thresholds, fallback handler, no modules, and no guard. Pinned-fork runtime hashes and nested
   EIP-1271 behavior remain to be proven. House of Alignment evidence is not an ownership gate:
   Afo confirmed those funds land in the designated Green Goods Safe on Celo.
2. **Historical-source rebuild proof is closed.** The pinned source/compiler/submodule rebuild
   exactly matches the recovered creation code, constructor arguments, init code, factory input,
   and implementation prediction.
3. **No contract implementation starts before gate 1.** Final Safe addresses, canonical owner
   order, Safe initializer hashes, and RED fixtures all depend on the two exact recovery owners.
4. **No evidence here authorizes broadcast.** Dependency deployment, resolver upgrade, Guardian
   trust, ownership transfer, account creation, Safe creation, or value authority each remains a
   separately approved release boundary.
