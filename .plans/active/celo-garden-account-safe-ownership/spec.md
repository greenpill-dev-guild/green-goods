# Celo GardenAccount Safe Ownership Specification

## Summary

Recreate the reviewed Arbitrum GardenAccount implementation and every required immutable
dependency at the same addresses on Celo, create and initialize each ERC-6551 account from the
immutable Arbitrum token tuple, and control the Celo account through a dedicated authenticated
relay. Deploy each Garden Safe directly in its final 2-of-3 state with the exact GardenAccount and
two reviewed recovery Safes. No deployment EOA, Settlement executor, Zodiac role, module, guard,
or value authority participates in this ownership path.

## Locked Outcome

For every Garden in the finalized 18-Garden inventory:

- `celoAccount == arbitrumAccount` for the exact source tuple;
- the Celo account runtime and implementation dependency closure match the reviewed Arbitrum
  artifacts;
- account initialization is atomic with creation and cannot be front-run;
- the Garden Safe is created directly with three unique owners and threshold two; and
- the GardenAccount can provide one Safe owner slot only through the bounded relay, while one
  independently approved recovery owner provides the second slot.

No temporary owner topology is accepted. If any legacy predicted Safe already has code, the
deployment command stops and requires a separate adoption decision.

## Deterministic Identity Ledger

The account address is derived by the canonical ERC-6551 registry call:

```text
registry.account(
  implementation = 0xE31cAeAc029A60AD17A49278Fdd58032eF9Cf692,
  salt = 0x6551655165516551655165516551655165516551655165516551655165516551,
  chainId = 42161,
  tokenContract = 0xe1Da335110b1ed48e7df63209f5D424d02276593,
  tokenId = <Garden token ID>
)
```

Frozen facts from the 2026-08-14 spike:

| Item | Address / value | Required proof |
|---|---|---|
| ERC-6551 registry | `0x000000006551c19487814612e58FE06813775758` | Same 571-byte runtime on Arbitrum and Celo; code hash `0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735` |
| Arbitrum GardenAccount implementation | `0xE31cAeAc029A60AD17A49278Fdd58032eF9Cf692` | Reconstruct exact creation bytecode, constructor immutables, deployer, and salt; Celo runtime must equal Arbitrum hash `0xa9f4f87514a3328e44e18f11f312b4d9b1c358c94428d9718892734671aba07a` |
| Arbitrum GardenToken | `0xe1Da335110b1ed48e7df63209f5D424d02276593` | Remains the foreign token contract in the immutable tuple; no Celo substitute |
| Root token ID | `0` | Root prediction remains `0xf401f34378384713222d1d21f63359cc4E8a858a` |
| ERC-6551 salt | `0x6551...6551` | Exact 32-byte value above |
| Source chain ID | `42161` | Never replaced by local `block.chainid` on Celo |
| Nick CREATE2 factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` | Verify factory code and the original implementation deployment transaction |
| Candidate implementation salt | `keccak256("greenGoodsCleanDeploy2025:14")` = `0xd80ce91b7f038d4f7097354209f7a70ebd75f10f05468bae191e6d2594854741` | Treat as unproven until the original creation transaction and init-code hash reproduce the live address |

The current `TBALib` in `packages/contracts/src/lib/TBA.sol` deliberately uses
`block.chainid`. It is correct for native accounts and must not be changed globally. The Celo
same-address deployment helper calls the registry directly with the frozen Arbitrum tuple.

Address equality alone is insufficient. The implementation constructor embeds the EntryPoint,
multicall forwarder, registry, guardian, WorkApprovalResolver, and AssessmentResolver. The exact
creation bytecode, compiler settings, linked bytecode, constructor values, CREATE2 deployer, and
salt must be recovered and reproduced. Every immutable dependency whose address is part of the
reviewed runtime must have compatible reviewed code on Celo before the account is called
functional.

## Atomic Account Creation and Initialization

The exact GardenAccount implementation deployment and all ERC-6551 account initialization must
occur in one Celo coordinator transaction. Merely calling account creation and
`GardenAccount.initialize(InitParams)` together after a separately visible implementation
deployment leaves a permissionless initialization race. If any required account initialization
fails, the implementation deployment and every account initialization revert together. The
helper:

1. accepts only the finalized Garden inventory and exact frozen implementation/tuple;
2. deploys or verifies the exact implementation through the reviewed CREATE2 factory;
3. calls the canonical registry with source chain `42161`;
4. verifies the returned address against the reviewed ledger;
5. immediately calls the exact per-Garden initialization calldata; and
6. rereads runtime, token tuple, initialization fields, and implementation code hash.

A canonical account proxy pre-created while the implementation address had no code may be adopted
only when its exact ERC-6551 runtime and zero initialization state are proven. Any already
initialized account or mismatched code stops the whole transaction. A reviewed private atomic
bundle is acceptable only if it provides the same all-or-nothing boundary.

The helper cannot upgrade accounts, execute arbitrary account calls, or initialize an account
whose expected initialization hash is absent from the reviewed artifact.

## Garden-Bound Relay

The foreign account has no local NFT owner because AccountV3 resolves token ownership only when
the bound token chain equals the local chain. Celo control therefore uses two new contracts,
separate from Settlement:

- an Arbitrum Garden action router called through the live Arbitrum GardenAccount; and
- a Celo GardenAccount relay authenticated by the official message router and trusted by the
  exact AccountGuardian only for the reviewed execution path.

The cross-chain pair has no circular constructor dependency. The Arbitrum router is deployed
inert with one reviewed bootstrap binder, the Celo relay is deployed with that exact source router,
and the binder permanently sets the destination relay once. Before binding, every action reverts;
after binding, no address can change the destination. The binder is never an action executor and
retains no ongoing authority.

The release plan is four receipt-separated, zero-value EOA transactions: source router CREATE2,
destination relay CREATE2, one-time source binding, then `AccountGuardian.setTrustedExecutor` for
the exact relay. Each later boundary is reviewed only after the prior receipt and deployed runtime
match the frozen plan. No step grants a Settlement, Zodiac, token, peer, or value permission.

Every action commits to:

- protocol domain and version;
- source EVM chain ID and official source chain selector;
- authenticated source router and sender contract;
- GardenToken, token ID, and exact GardenAccount;
- destination chain ID, official destination router, relay, and Garden Safe;
- complete Safe transaction fields, including target, value, data, Safe operation, gas/refund
  fields, and Safe nonce;
- the exact Safe transaction hash and second-owner signature bundle hash;
- per-Garden action nonce, unique action ID, and deadline; and
- current relay state (`proposed`, `cancelled`, `finalized`, `executed`, or `expired`).

The source router uses propose/finalize semantics only after its one-time destination binding. A
Garden may cancel only before finalization;
the source router then permanently prevents a finalize message for that action. The Celo relay
executes only after authenticated proposal and finalization messages agree exactly, the action is
uncancelled, its nonce is current, and its deadline has not passed. Duplicate, stale, mismatched,
out-of-order, replayed, or expired messages never execute. Finalization is irreversible; the
interface must not imply a post-finalization cancellation that cross-chain delivery cannot honor.

The destination call is fixed to:

```text
GardenAccount.execute(
  destinationSafe,
  0,
  Safe.execTransaction(<fully committed transaction>, <committed signatures>),
  CALL
)
```

The signature bundle uses the GardenAccount prevalidated-owner form plus one independent recovery
Safe EIP-1271 contract signature. Because the Safe threshold is two, relay compromise alone cannot
execute. The relay is never a Safe owner, module, guard, Zodiac member, Settlement executor,
allowance holder, token spender, or arbitrary target bridge. It holds no G$ and no Garden Safe
approval. Any native balance is capped fee sponsorship only and is accounted separately from
value authority.

## Final Safe Topology

Each Safe is predicted and deployed directly through official Safe v1.4.1 contracts with:

- owners: exact GardenAccount, Celo Green Goods protocol recovery Safe
  `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19`, and Celo Greenpill Dev Guild recovery Safe
  `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C`;
- three unique non-zero owners, serialized in one reviewed canonical order;
- threshold `2`;
- compatibility fallback handler only;
- zero setup delegatecall and zero payment;
- nonce `0` after setup;
- zero native and canonical G$ balances;
- no modules, guard, Zodiac role, executor registration, Settlement registration, peer, allowance,
  or value authority.

The direct final initializer replaces both the PR #705 1-of-2 bootstrap and the proposed 1-of-3
threshold-one transition. No `swapOwner` or `changeThreshold` transaction is needed for a new
Safe. Changing any owner or threshold changes the deterministic Safe address and requires a new
reviewed ledger.

Arbitrary ERC-20, ERC-721, and ERC-1155 inventory cannot be proven absent by generic account
reads. The verifier states this limitation explicitly; value activation needs separate indexed or
enumerated inventory evidence.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Exact deployment reconstruction, account helper, relay, Safe tooling, and tests | `contracts` | Critical surface; Bun wrappers only |
| UI | `ui` | Not applicable |
| Shared state / API | `state_api` | Not applicable |
| Independent security review | `qa_pass_1` | Exact committed candidate, no broadcast |
| Adversarial closure and release evidence review | `qa_pass_2` | Exact committed candidate, no broadcast |

## Human Judgment Points and Blockers

1. Recover and approve the exact original GardenAccount creation transaction, init-code hash,
   compiler settings, constructor tuple, deployment factory, and salt.
2. Confirm code-compatible Celo deployments for every immutable dependency, especially the exact
   guardian address and its bounded relay trust configuration.
3. The human owner has designated the exact Celo protocol recovery Safe as
   `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19` and the Dev Guild recovery Safe as
   `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C`. These frozen identities are sufficient for
   deterministic implementation and RED tests. The ownership gate requires both addresses to
   pass live Celo Safe v1.4.1 owner/threshold/module/guard checks plus pinned-fork nested EIP-1271
   and exact runtime-code proof. House of Alignment receiving-address evidence is not part of this
   gate: Afo confirmed that upstream funding is sent to the designated Green Goods Safe on Celo.
4. Reverify official CCIP chain selectors, routers, lane support, and deployed code at the
   implementation and release snapshots using primary Chainlink sources.
5. Obtain an independent critical-surface review with no unresolved Critical or High finding.
6. Authorize deployment, guardian trust, Safe creation, or any later value authority only in a
   separate human release step.

## Primary Standards

- [ERC-6551](https://eips.ethereum.org/EIPS/eip-6551)
- [Safe v1.4.1 contracts](https://github.com/safe-global/safe-smart-account/tree/v1.4.1/contracts)
- [Safe deployment records](https://github.com/safe-global/safe-deployments/tree/main/src/assets/v1.4.1)
- [Chainlink CCIP Router](https://github.com/smartcontractkit/chainlink-ccip/blob/main/chains/evm/contracts/Router.sol)

## Explicit Non-Goals

No production deployment or broadcast. No Safe/Zodiac role. No Settlement executor reuse. No
peer, ping, canary, cap, allowance, unpause, G$ transfer, native-value movement, token bridge,
application UI, package-level environment file, dependency upgrade, or raw Forge command.
