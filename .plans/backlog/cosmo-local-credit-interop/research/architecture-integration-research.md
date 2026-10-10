# Architecture and integration research

**Observed:** 2026-10-10, against Green Goods commit `06a31dbf5` in this worktree, the reconciled
hub documents in the main checkout (uncommitted 9 October edits), live Linear, and public
Cosmo-Local Credit (CLC) material. Chain reads were taken from public RPC endpoints at Gnosis block
48,683,249 (factory scan) and 48,683,632 (activity), Arbitrum block 513,486,280 and Celo block
79,727,365. Every read was an `eth_call`, `eth_getCode` or `eth_getLogs`; nothing was broadcast.
**Posture:** research only. No runtime code, dependency, deployment, account, spend or outreach.
The clean room held: only the CLC README, `docs/SPEC.md`, `docs/DEPLOY.md`, the docs site, the
GitHub metadata API and on-chain state were read. No AGPL source was opened.

Labels follow the research skill: **ESTABLISHED** (directly supported by current authoritative
evidence), **CORRECTED** (a prior claim is wrong or superseded), **INFERRED** (reasoned from
evidence that does not state it), **UNRESOLVED** (absent, inaccessible or ambiguous).

## 1. Question and decision

Can the two-issuer design in [the architecture](../spec.md) be built and rehearsed against the real
Gnosis infrastructure by 21 October, and what must a design pass settle before PRD-1096 starts?
The answers feed RESR-73 (architecture record), PRD-1096 (rehearsal), PRD-1097 (passport) and the
22 October decision in PRD-1197. One premise needed checking on 10 October: whether Cosmo-Local's
platform is open to third parties yet, and what state its Gnosis network is in. This pass reads
the public terms, the public repositories and the chain.

## 2. Source coverage

| Authority | What was read | Freshness |
|---|---|---|
| Plan hub (main checkout) | `status.json`, `spec.md`, `eval.md`, `brief.md`, `plan.todo.md`, `resources.md`, `tensions.md`, `whitepaper-v8-review.md`, `project-reconciliation.md`, `hackathon-discussion.md`, the research handover | 9 October, uncommitted on `codex/cosmo-local-planning` |
| Linear | RESR-73 and its four comments, RESR-74 and its four comments (22 September findings), PRD-857, PRD-1096, PRD-1097, PRD-1100, PRD-1197, COM-46 | live, 10 October |
| Decision artifact | "Money, credits and pools, the model, 22 Sep" (attached to RESR-73 and PRD-857) | 22 September |
| Green Goods code | chain and account configuration in Shared; the settlement lane (codec, command, configuration, executor authentication and acknowledgment); the garden Safe relay and router; confirmation and terms libraries; interfaces; the local CCIP router; Foundry profiles; `networks.json`; the Celo lane evidence folder; fork and unit test harnesses; indexer config, schema and handlers; the installed `permissionless` 0.2.57 Kernel constants | commit `06a31dbf5` |
| CLC public documentation | smart-contracts page (v1.1.0), network page, docs index, Terms of Service v1.1, protocol `README.md` (v1.0.0 address table), `docs/SPEC.md`, `docs/DEPLOY.md`, GitHub organization repository and tag metadata | 10 October |
| Gnosis, Arbitrum and Celo state | CLC factory events and proxy configuration, CCIP routers and fee quotes, Kernel, Hats, Safe, EntryPoint and verifier bytecode, Kernel address derivation and simulated deployment | blocks above, 10 October |
| Vendor documentation | Pimlico supported chains, Hats supported chains, Envio HyperSync networks, ZeroDev passkey overview, Gnosis developer guide for ZeroDev (July 2024) | 10 October |

Not followed: the CLC application source (not public), any AGPL `src/` (never), the Chainlink
directory web pages (they return 404 to the fetcher; the on-chain router reads replace them), the
Pimlico dashboard (sponsorship policy chain scope), ZeroDev deployment pages (404), the Circles
seam (GROW-55), and the white paper itself (reviewed on 9 October).

## 3. Established context

### 3.1 The Cosmo-Local platform is in public use and mid-migration

- **ESTABLISHED.** The Terms of Service are version 1.1, published and effective 1 October 2026
  "as the initial Terms for public use of the App". Grassroots Economics Foundation operates the
  App and "may also run supporting catalogs, application programming interfaces, storage,
  relayers". It is not the issuer of a user token, the steward of a user pool or a party to a
  swap. Pools can be declined or removed from "an App-operated registry". No public API or
  webhook documentation exists on the docs site or in the public repositories.
- **ESTABLISHED.** Public repositories on 10 October: `docs` (CC-BY-SA-4.0, pushed 10 October),
  `sim` (GPL-3.0), `storage-server`, `eth-indexer` ("Index GE activity on Celo"), `protocol`
  (AGPL-3.0, pushed 8 September, tags `v1.0.0` and `v1.1.0`, no GitHub releases), `gnosis-node`,
  `eth-tracker` and `ens-offchain-resolver`. There is no public application repository. No public
  document states the platform's launch stage or describes a migration; the chain state below
  shows one in progress.
- **INFERRED.** The protocol README still heads its address table "v1.0.0" while listing the
  `OracleRelay` implementation that arrived with v1.1.0; the docs page describes v1.1.0. Treat the
  README table as the current implementation set and verify bytecode before use.

### 3.2 The live Gnosis deployment at block 48,683,249

- **CORRECTED.** The 22 September findings described "everything deployed through the factory is
  still testing" (117 proxies). The factory has now emitted 1,864 `Deployed` events since block
  48,027,888, 1,747 of them after the 16 September scan and 1,631 in the last 100,000 blocks.
  Composition: 1,260 vouchers (`GiftableToken`), 121 pools (`SwapPool`), 121 limiters, 121 fee
  policies, 123 token indexes, 115 relative quoters, one contract registry, one accounts index and
  one protocol fee controller. The last deployment was at block 48,671,800.
- **ESTABLISHED.** Three admin accounts appear in the factory records: one for 1,665 proxies (93
  of the pools), one for 195 (28 pools) and the deployer for four. All three are externally owned
  accounts rather than multisigs or timelocks, and no pool sampled is sealed (`sealState` 0), so
  the configuration of the App's own pools can still change.
- **ESTABLISHED.** Thirty distinct pool owners exist, but one account owns 80 of the 121 pools,
  all of the sixty most recent vouchers and 192 of a 210-voucher stride sample (19 owners in the
  sample). The most recent pools are named after Kenyan savings
  groups and the most recent vouchers carry individual members' names with pre-minted supplies in
  the thousands of units. Names and addresses stay out of this file.
- **INFERRED.** That pattern reads as the Sarafu Network's existing groups being moved onto Gnosis
  by its operator. Most of the instances therefore record a migration in progress, not new
  activity on Gnosis, and the instance count should not be quoted as adoption.
- **ESTABLISHED.** Recent pool configuration: a per-pool `RelativeQuoter` proxy owned by the pool
  owner at a parity index, `FeePolicy` default fee 0, token index with 13 to 19 listed vouchers,
  limiter 100,000 units per listed voucher (`1e11` at six decimals), `feesDecoupled` false, and a
  `ProtocolFeeController` proxy that is active at 20,000 ppm (2 percent) with the deployer as
  owner and recipient. The two September test pools are unchanged: unsealed, zero fees, bare
  inactive controller, empty registries.
- **INFERRED.** With a zero pool fee the published floor rule prices the protocol fee as 2 percent
  of a notional 1 percent of gross, so 0.02 percent of each swap goes to the recipient on the
  migrated pools. Our own instances choose their controller at initialization and need not point
  at this one.
- **ESTABLISHED.** Across all 121 pools since block 48,000,000 there are 77 `Swap` and 77
  `Deposit` events. The on-chain `ContractRegistry` proxy still has no `TokenIndex`, `PoolIndex`
  or `AccountsIndex` identifier set, so there is no on-chain directory; the App keeps its own.
  Pool and voucher owner accounts are EIP-7702 delegated accounts pointing at the Calibur
  implementation, as in September.
- **UNRESOLVED.** Whether the App will list third-party instances in its catalog, and on what
  terms, is a Grassroots Economics decision. Our pools do not depend on it, but discovery inside
  the App does.

### 3.3 Protocol v1.1.0 facts the design relies on

From `docs/SPEC.md` and the docs pages (public; signatures as written there):

- `GiftableToken.initialize(name, symbol, decimals, owner, expiresAt)`; `mintTo(to, amount)` by
  owner or writer; `burn(amount)` owner only, from the owner's own balance; `addWriter`,
  `deleteWriter`; `isWriter` true for writers and the owner; `applyExpiry()` by anyone; public
  state `expired`, `totalMinted`, `totalBurned`. `expiresAt` of 0 means no expiry. There is no
  `expires()` or `expiresAt()` getter: both revert on live vouchers; `expired()` answers.
- `SwapPool.initialize(name, symbol, decimals, owner, feePolicy, feeAddress, tokenRegistry,
  tokenLimiter, quoter, feesDecoupled, protocolFeeController)`; `deposit(token, value)`;
  `withdraw(tokenOut, tokenIn, value, recipient, minAmountOut, deadline)` is the bounded swap;
  the one- and two-argument `withdraw` forms are owner fee collection; `withdrawLiquidity(token,
  to, amount)` owner only; `seal(state)` with bits 1 (fee policy), 2 (fee address), 4 (quoter),
  8 (registry), 16 (limiter), full seal 31; sealing bits 8 or 16 before those slots are set reverts;
  `getQuote`, `getFee(inToken, outToken, value)`, `getAmountOut`, `getAmountIn`. Events `Swap`
  (legacy) and `SwapSettlement`. A sealed slot locks the pointer, not the callee. The protocol fee
  controller cannot be sealed and the specification lists no setter for it.
- `Limiter.setLimitFor(token, holder, value)` by owner or writer; the holder must be a contract;
  a limit of 0 blocks deposits; the limit caps the pool's balance on deposit and swap entry only.
- `FeePolicy.setDefaultFee(fee)`, `setPairFee(tokenIn, tokenOut, fee)` direction sensitive, in
  ppm; a stored pair fee of 0 counts as unset and falls back to the default.
- `TokenUniqueSymbolIndex.register(token)` by owner or writer; symbols unique and at most 32 bytes;
  `remove(token)`; `have(token)` is the check the pool calls. `ContractRegistry.set(identifier,
  address)` owner only, once per identifier.
- `RelativeQuoter.setPriceIndexValue(token, rate)` owner only, in ppm, unset means parity.
- The `ERC1967Factory` is Solady's (MIT): `deployAndCall(implementation, admin, data)`, the admin
  is recorded in the factory (`adminOf(proxy)` returns it on Gnosis), and only the admin upgrades.
  `DEPLOY.md` requires `--admin` to differ from `--owner` and suggests a timelock or multisig; it
  documents no batch upgrade and no admin rotation.
- The protocol fee is additional to the pool fee and is computed on the larger of the actual pool
  fee and a notional 1 percent. Pool deposits create no shares or rights.

### 3.4 The Arbitrum to Gnosis message lane is live, both ways

**ESTABLISHED** by on-chain reads on 10 October:

| Read | Arbitrum One | Gnosis |
|---|---|---|
| Router | `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8`, "Router 1.2.0" | `0x4aAD6071085df840abD9Baf1697d5D5992bDadce`, "Router 1.2.0" |
| Chain selector | `4949039107694359620` | `465200170687744372` |
| `isChainSupported(other)` | true | true |
| `isChainSupported(2^64 - 1)` | not read | false (control) |
| `getOnRamp(other)` | `0x7B73923E101950eFe098C2Eca74C8320b2813f48` (the same OnRamp serves Celo) | `0x7FcD7604e66AD383b82cD899Aa2aa6b1cf41448B` |

Fee quotes for a settlement-shaped message (200,000 destination gas, 400 bytes, no tokens, native
fee token) at the heads above:

| Direction | Quoted fee |
|---|---|
| Arbitrum to Gnosis | 44,138,653,761,532 wei, about 0.000044 ETH |
| Arbitrum to Celo (comparison) | 48,151,258,648,945 wei, about 0.000048 ETH |
| Gnosis to Arbitrum | 140,020,070,476,902,155 wei, about 0.140 xDAI |

A season of fifty issuance commands with acknowledgments therefore needs roughly 0.0025 ETH on
Arbitrum and 8 xDAI on Gnosis before margin. The `feeReserveMinimum` and deferred-acknowledgment
pattern in the settlement lane carries over unchanged. The Celo lane evidence folder shows the
receipt shape to reproduce for Gnosis (router code hash, `typeAndVersion`, OnRamp, block hash).

### 3.5 Member accounts: derivation is identical, deployment is blocked on Gnosis

- **ESTABLISHED.** The Kernel v3.1 artifacts the app uses through `permissionless` 0.2.57 exist
  on Gnosis with the same bytecode as on Arbitrum: factory `0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419`,
  meta factory `0xd703aaE79538628d27099B8c4f621bE4CCd142d5`, implementation
  `0xBAC849bB641841b44E965fB01A4Bf5F074f84b4D`, ECDSA validator
  `0x845ADb2C711129d4f3966735eD98a9F09fC4cE57`, EntryPoint v0.7
  `0x0000000071727De22E5E9d8BAf0edAc6f37da032`.
- **ESTABLISHED.** The WebAuthn validator that `permissionless` selects for version 0.3.1 passkey
  owners, `0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd`, has code on Arbitrum and Celo and **no code
  on Gnosis**.
- **ESTABLISHED.** `KernelFactory.getAddress(initData, salt)` with the same dummy passkey
  initialization data (root validator = the WebAuthn validator, hook zero, a fixed public key and
  authenticator hash, index 0) returns the same address on Arbitrum, Gnosis and Celo. Derivation is
  chain independent, as the specification hoped.
- **ESTABLISHED.** A simulated `createAccount` (an `eth_call`, nothing sent) with that data
  succeeds on Arbitrum and Celo and reverts on Gnosis with `InitializeError()` (`0x90fcc612`). The
  same simulation with the ECDSA validator succeeds on both chains. So a passkey member account
  cannot be deployed or used on Gnosis today, and the sponsored swap in PRD-1096 cannot run from a
  member's own account until the validator exists there.
- **ESTABLISHED.** The secp256r1 precompile (RIP-7212) answers the specification test vector with
  1 on Gnosis as on Arbitrum, and the Daimo verifier `0xc2b78104907F722DABAc4C69f826a522B2754De4`
  has code on Gnosis. The absence is the validator contract alone. A newer ZeroDev passkey
  validator at `0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69` has code on both chains, but choosing a
  different validator changes the initialization data and therefore the account address.
- **ESTABLISHED.** Pimlico lists Gnosis (chain 100) with bundler and paymaster at EntryPoint
  v0.7. Whether the general sponsorship policy covers chain 100 is set in the dashboard and is not
  documented. `PIMLICO_API_ENDPOINTS`, `SUPPORTED_CHAINS`, `CHAIN_REGISTRY`,
  `SETTLEMENT_ACCOUNT_PROFILES` and `DEPLOYED_CHAIN_IDS` all lack chain 100; `getChainConfig(100)`
  silently returns the Sepolia configuration.

### 3.6 Other Gnosis infrastructure

**ESTABLISHED** by bytecode reads: Hats Protocol v1 at `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137`
(the Hats docs list Gnosis Chain); Safe 1.4.1 singleton, proxy factory and 4337 module at the
addresses in `networks.json` `deploymentDefaults`; the ERC-6551 registry; the deterministic
deployer `0x4e59b44847b379578588920cA78FbF26c0B4956C`; Multicall3. Envio HyperSync serves Gnosis
at `https://gnosis.hypersync.xyz`. The Green Goods hat trees exist only on Arbitrum, Sepolia and
Celo, and `HatsLib.isSupported()` is false for chain 100, so a Gnosis-side contract must not
depend on `HatsLib`; authority arrives by authenticated message and by Safe ownership.

### 3.7 Green Goods seams the build can reuse

- **Transport and replay.** `SettlementMessageCodec` (frozen v1 command and acknowledgment),
  `SettlementCommandLib.dispatch` (execution key, stored payload hash, exact fee, reserve floor,
  retry with the same payload), `CeloSettlementExecution._authenticate` (paused check, no tokens,
  source selector, current or previous peer with a grace window, protocol version), duplicate
  handling that re-emits and resends the acknowledgment, stored failure codes, and the
  acknowledgment path with `QuoteFailed`, `FeeReserveLow` and `SendFailed` deferral codes.
  `CeloGardenAccountRelay` adds `processedMessages[messageId]`, an action nonce, a deadline and a
  stored digest; `GardenActionRouter` is the source-side shape with one active action per garden.
- **Local transport.** `LocalCCIPRouter` delivers synchronously on one chain; the executor unit
  tests use an `ExecutorMockRouter` that calls `ccipReceive` with a constructed `Any2EVMMessage`.
  The fork tests create pinned forks with `vm.createFork(rpc, block)` from `ARBITRUM_RPC_URL`,
  `ARBITRUM_FORK_BLOCK_NUMBER`, `CELO_RPC_URL` and `CELO_FORK_BLOCK_NUMBER`, run under
  `profile.fork`, and the fork runner accepts the suites `all`, `protocol`,
  `garden-account-release` and `garden-roles`. `NetworkSelectors.readCcipChainSelector` reads
  selectors from `networks.json` as strings.
- **Authority views.** `IHatsModule.isOperatorOf(garden, account)` and `isStewardOf` answer the
  steward hat on Arbitrum. `ICommitmentPoolingModule.getCommitment(id)` and `getConfirmers(id)`
  expose state, counterparty, lead provider, confirmation count and threshold. The confirmation
  path (`Ordinary`, `PoolFallback`, `ProtocolFallback`) is carried only by the `CommitmentFulfilled`
  event, not by any view.
- **Payment record.** `recordConsiderationPaid(commitmentId, payoutRef)` is one-shot
  (`ConsiderationAlreadyRecorded`), but it requires a `Fulfilled` commitment with a declared
  `ArbitrumExternal` consideration. It records a payment after delivery; it cannot carry a purchase
  made before a service.
- **Indexer.** Entity ids are already `${chainId}-…`; `contractRegister` adds factory-created
  contracts at runtime (the Octant vault pattern); `SettlementDeploymentPinned` is the pattern for
  announcing immutables the indexer needs to key cross-chain rows.

## 4. Corrections and contradictions

| Prior statement | Now | Label |
|---|---|---|
| "Everything deployed through the factory is still testing" (RESR-74 findings, 22 September) | A bulk migration is running from the operator's accounts; public terms since 1 October; 1,864 proxies, 121 pools, 77 swaps | CORRECTED |
| "Protocol fee off on both pools" (12 September read) | True for the two test pools; migrated pools use an active controller at 2 percent | CORRECTED |
| "Gardener Kernel accounts, same address across chains: unproven" (tensions.md) | Same address proven by `getAddress` on three chains; deployment blocked on Gnosis by the missing WebAuthn validator | CORRECTED |
| "Router, RMN, token admin registry addresses are truncated in the rendered docs page" (resources.md) | Router, selectors, OnRamps and fees read on chain; the web page is not needed | CORRECTED |
| "Go or no-go on mainnet, 13 October" (22 September model) | PRD-1197 sets 22 October | CORRECTED |
| README address table "v1.0.0" | The table includes the v1.1.0 `OracleRelay`; the docs page says v1.1.0 | INFERRED |
| `expires()` or `expiresAt()` readable on a voucher | Neither exists; `expired()` does | CORRECTED |

## 5. Gaps and limits

- **UNRESOLVED.** Whether the App offers an integration API. The Terms mention application
  programming interfaces the operator may run, but none is documented publicly. The indexer reads
  chain state directly, so the integration does not depend on one; catalog listing might.
- **UNRESOLVED.** Whether `protocolFeeController` can change after initialization (no setter in
  the specification) and whether `GiftableToken` exposes `transferOwnership` (the specification
  lists none; September saw `renounceOwnership`). Both decide the owner topology below and are
  one fork read each.
- **UNRESOLVED.** Who deploys the WebAuthn validator on Gnosis. ZeroDev deploys its canonical
  contracts on request; the MIT init code could also be replayed through the deterministic
  deployer to the same address. Either is an authorized action with trust implications, not a
  research outcome.
- **UNRESOLVED.** Pimlico policy coverage for chain 100 and paymaster funding on Gnosis.
- **UNRESOLVED.** The migration timetable, whether the v1.0.0 implementations remain the supported
  set for third-party instances, and whether Grassroots Economics expects third-party pools to use
  its protocol fee controller. These are questions for the direct call, not for this pass.
- **Limit.** Fork behavior reflects the pinned block and the published implementations; a later
  upgrade by a proxy admin changes nothing for our instances (we are our own admin) but can change
  the App's pools. The GIP-153 rollup transition is not before 2027 and keeps state and addresses.
- **Limit.** CLC's security review is internal; our issuer and service desk are new code. The
  external-audit gate in PRD-651 is unmet by default.

## 6. Design recommendations

Everything in this section is proposed, not implemented. Interfaces are hand-written from the
public specification and from Green Goods' own patterns.

### 6.1 Ownership topology per issuer (Tech and Sun, Green Goods)

```text
community Safe (3-of-5)            owner of: credit, index, limiter, fee policy, quoter, pool,
   |                               issuer, service desk; feeAddress; receives returned credits
   +-- TimelockController (48 h)   ERC1967 admin of every proxy (admin != owner, per DEPLOY.md)
   +-- CreditIssuer (CCIP receiver) writer on the credit and the limiter only
   +-- ServiceDesk                  holds presented credits until discharge or remedy
```

Seal bits 8 and 16 after wiring (registry and limiter), and 1, 2 and 4 once the fee policy, fee
address and quoter are Safe-owned proxies the Safe is happy to govern through their own setters.
No protocol fee controller at initialization unless the community wants one. `feesDecoupled`
true keeps accrued fees out of `withdrawLiquidity`. The issuer never holds owner rights over the
pool, so it cannot withdraw pool money, which is the authority statement the pitch makes.

### 6.2 The Gnosis issuer

```solidity
/// Proposed. Owned by the community Safe; a CCIPReceiver bound to one source lane.
interface ICreditIssuer {
    enum Kind { Earned, Purchased, LimitUpdate }
    enum Failure { None, Expired, EntitlementConsumed, CapExceeded, UnknownKind, MintFailed, LimitFailed }

    struct Command {          // frozen v1, abi-encoded, data only
        uint8   version;
        uint8   kind;
        address token;        // this issuer's credit, checked against the immutable
        address recipient;    // gardener Kernel account or the pool (inventory)
        uint256 amount;       // base units
        uint32  seasonId;
        bytes32 entitlementId; // keccak(sourceChainId, sourceSender, kind, sourceRef)
        bytes32 sourceRef;    // commitmentId (Earned) or purchaseRef (Purchased)
        uint64  deadline;
        uint64  nonce;        // per source sender
    }

    event CreditIssued(bytes32 indexed entitlementId, uint8 kind, bytes32 sourceRef,
        address indexed recipient, uint256 amount, uint32 indexed seasonId, bytes32 messageId);
    event IssuanceFailed(bytes32 indexed entitlementId, uint8 failure, bytes32 messageId);
    event SeasonCapSet(uint32 indexed seasonId, uint256 cap);
    event LimitWritten(address indexed token, uint256 value, bytes32 messageId);
}
```

Behavior copied from `CeloSettlementExecution`: refuse when paused, refuse token transfers,
require the source selector and the current or previous (grace) source sender, require the
protocol version, dedupe by `messageId`, then refuse a consumed `entitlementId` even on a fresh
message. Business failures are stored and emitted, not reverted, so a retry carries the same
entitlement and can never mint twice, and the passport can show "failed". `seasonCap` is set by
the Safe only; a `LimitUpdate` writes `Limiter.setLimitFor(otherCredit, pool, value)` within a
Safe-set ceiling. An acknowledgment back to Arbitrum reuses the settlement acknowledgment path and
its fee reserve; if it is cut for time, the indexer joins `CreditIssued` to the Arbitrum command
and the passport shows "pending" until it appears.

### 6.3 The Arbitrum sender

A `CreditAuthorizationSender` with no owner powers over value, one per issuer, bound to the
HatsModule, the pooling module, the router and the destination issuer:

- `authorizeEarned(commitmentId, recipient, amount, seasonId)`: caller must pass
  `isOperatorOf(poolGarden, msg.sender)` for the commitment's pool garden; the commitment must be
  `Fulfilled` and belong to the issuer's garden; `authorized[commitmentId]` must be false;
  `entitlementId` is derived, never supplied. Emits the confirmer list and the count and threshold
  from `getCommitment` and `getConfirmers`, so the passport can show who confirmed.
- `authorizePurchase(purchaseRef, recipient, amount, seasonId)`: steward hat; `purchaseRef` is the
  keccak of the off-chain receipt identifier and must be unused. The event labels it a
  steward-recorded receipt, which is what it is.
- Both pay the exact router fee from a funded reserve with a `feeReserveMinimum`, store the
  payload hash and message id, and allow `retry` with the same payload only while unacknowledged.
- The confirmation path cannot be checked on chain (section 3.7). Decision for COM-46: accept any
  `Fulfilled` commitment for earned issuance in October and label the path in the passport from
  the event, or add a stored path to the pooling module later (a critical-surface change).

### 6.4 Purchased issuance has two shapes

1. **Money on Gnosis.** The issuer pre-mints inventory to the pool; a supporter swaps WXDAI for
   credits with `withdraw(credit, WXDAI, value, learner, minOut, deadline)`. The receipt is the
   pool's `SwapSettlement`; no message is needed. This is the protocol's native path and should be
   rehearsed.
2. **Money off chain.** The accepted first-supporter route is a gift through the fiscal sponsor,
   so the money never reaches Gnosis. The steward records the receipt reference on Arbitrum
   (6.3), the issuer mints to the learner, and the passport shows "purchased, receipt recorded by
   the steward". This is the October pilot path.

Both consume one entitlement once. Neither relabels a purchase as a kept promise.

### 6.5 Presentment, discharge and returned credits

A `ServiceDesk` per issuer, Safe-owned, on Gnosis:

- `present(units, serviceRef)` pulls credits from the holder (`approve` and `present` batched in
  the member's account) and records `Presentment{holder, units, serviceRef, status}`.
- `markDelivered(id, deliveredUnits)` by a Safe-set operator (the hub); `confirmReceipt(id)` by
  the holder, who is the person served; then discharge happens once: delivered units move to the
  Safe, undelivered units return to the holder, `Discharged(id, deliveredUnits)` is emitted.
- `remedy(id, reasonRef)` by the operator returns all units and records the failure. Partial
  delivery is units, not a flag.
- Returned and discharged credits sit with the Safe, which owns the token and can `burn()` its
  own balance or re-issue within the cap. `issued - burned` is the outstanding obligation figure;
  the desk's `Discharged` events are the service-delivery figure. A swap or a transfer is neither.

This keeps the published burn authority intact: only the owner burns, only its own balance, and
the issuer never needs burn rights.

### 6.6 Member exchange

The member's own account calls the six-argument `withdraw` with `minAmountOut` from
`getAmountOut` and a short deadline, batched with the approval. Preflight reads: `have()` on the
pool's registry for both tokens, `limitOf(tokenIn, pool)` against the pool's balance plus the
input, the pool's `tokenOut` balance, `getFee`, and `expired()` on both credits. Each failure maps
to a recoverable state the PWA can explain (de-listed, limit reached, inventory exhausted, quote
moved, sponsorship refused). The Tech and Sun swap-back uses `setPairFee(credit, WXDAI, 240000)`
in rehearsal only; the buy direction keeps the default.

### 6.7 Passport projection

Add chain 100 to the indexer with the two issuers, two desks, two credits and two pools (static
addresses after deployment; `contractRegister` if a factory of ours creates them). Entities:
`CreditIssuance` (entitlement, kind, source chain and ref, recipient, amount, season, message id,
status), `CreditPresentment`, `CreditDischarge`, `CreditSeason` (cap, issued, burned,
outstanding), `CreditPoolState` (inventory per token, limits, fees, seal state). Join to
`Commitment` by commitment id and to the Celo settlement rows by commitment id. Every published
figure carries definition, unit, window, source and freshness, and a live-or-rehearsal flag from
the chain id (31337 or 100).

### 6.8 Shared and client seams

Chain 100 in `SUPPORTED_CHAINS`, `CHAIN_REGISTRY` (and stop the silent Sepolia fallback for it),
`PIMLICO_API_ENDPOINTS`, `SETTLEMENT_ACCOUNT_PROFILES` (the 0.3.1 mainnet profile) and
`DEPLOYED_CHAIN_IDS`; a `gnosis` entry in `networks.json` with `ccipRouter`
`0x4aAD6071085df840abD9Baf1697d5D5992bDadce` and `ccipChainSelector` `"465200170687744372"` as a
string; a `100-latest.json`. A credits adapter in Shared with hand-written ABIs for the token,
pool, limiter, fee policy and index, reached through an existing export leaf rather than a new
subpath. The PWA shows balances, presentments and obligations in service units with the
rehearsal label, per RESR-93.

### 6.9 Fork rehearsal plan for PRD-1096

1. **Forks.** `vm.createFork` of Gnosis at a pinned block (`GNOSIS_RPC_URL`,
   `GNOSIS_FORK_BLOCK_NUMBER`; the public endpoint works) and of Arbitrum at a pinned block, under
   `profile.fork`, as a new fork suite beside `protocol`.
2. **Gnosis side.** Deploy a Safe (3-of-5 in the release; a test Safe in the fork), a 48-hour
   timelock, then the six instances through the published factory with `deployAndCall`, the
   published v1.0.0 implementations, admin = timelock, owner = Safe. Deploy the issuer and desk.
   Wire: `addWriter(issuer)` on the credit and the limiter, `register` both credits in each index,
   `setLimitFor(otherCredit, pool, 500 units)`, pair fees, seal, mint inventory. Record owner,
   admin, dependency controllers, fee recipients and seal state as the first acceptance row.
3. **Arbitrum side.** Deploy the sender on the Arbitrum fork against the live HatsModule and
   pooling module; authorize one earned issuance from a real `Fulfilled` commitment and one
   purchase from a recorded reference.
4. **Transport.** Quote fees on both real routers (as `CrossChainSettlementLane` does); capture the
   outbound message on the Arbitrum fork; switch forks and deliver it to the issuer with
   `vm.prank(gnosisRouter)` and a constructed `Any2EVMMessage`, labeled "simulated transport";
   deliver acknowledgments the reverse way. A fork proves the contracts, never DON delivery.
5. **Accounts.** `vm.etch` the Arbitrum WebAuthn validator bytecode onto the Gnosis fork at its
   address, labeled as a stand-in, create a passkey Kernel account with `vm.signP256`, and run the
   sponsored batch (approve, swap; approve, present). Run the same swap from an ECDSA Kernel
   account as the control that needs no stand-in. The live gap stays the live gap.
6. **Negative cases.** Replayed message id; a new message with a consumed entitlement; retry after
   a stored failure; cap exceeded; limiter 0; de-listed credit; exhausted inventory; stale quote;
   expired deadline; paymaster refusal; unauthorized selector, sender and version; a Safe fallback
   call to the issuer under the same cap; failed delivery with remedy; partial delivery; a second
   discharge of the same presentment; expiry left at 0.
7. **Receipts.** Block numbers, implementation addresses, configuration hashes, the exact command,
   and the "fork" label on every row, following the Celo evidence folder's shape.

## 7. Decision implications

- **The lane is not the blocker.** It is live, priced and cheap in both directions. The Celo lane
  code transfers with new immutables.
- **Member accounts are the blocker for a live member swap.** Until a WebAuthn validator exists
  on Gnosis at the address the SDK uses, no passkey member can sign there. A go on 22 October for
  a member-signed live swap needs that deployment first, or a Safe-signed fallback that is not the
  member's own account. The rehearsal can still prove everything else.
- **Cosmo-Local's state changes the words, not the plan.** The platform opened for public use on
  1 October and its network is still being migrated; the App's pools are administered from its
  operator's accounts and none sampled is sealed. Our instances are our own,
  which the design already assumed, so listing in their App is a courtesy to request, not a
  dependency. The pitch's honest-status slide should say so in one line.
- **The audit gate stays unmet by default.** New issuer and desk code plus an internal-only
  review of the venue means PRD-1197 can only go live by recording an explicit substitution. The
  no-go path in the pitch package already holds.
- **COM-46 gains two concrete decisions:** the earned-issuance eligibility rule (any `Fulfilled`
  versus beneficiary path only) and the purchase shape for October (off-chain receipt).

## 8. Remaining human frontier

1. Authorize one of: ask ZeroDev to deploy its passkey validator on Gnosis; replay the MIT init
   code ourselves; or accept no passkey accounts on Gnosis in October.
2. Confirm Pimlico sponsorship policy coverage and paymaster funding for chain 100.
3. Accept the owner topology (Safe owns the token, issuer is a writer, desk holds presented
   credits) and whether the acknowledgment lane is in or out of the October scope.
4. Choose the earned-issuance eligibility rule and the October purchase shape (COM-46).
5. Decide whether to ask Grassroots Economics about App listing, API access and the supported
   implementation set on the next direct call (outreach needs separate authorization).
6. Name the Safe signers and the timelock delay for both communities before PRD-1100.

## 9. Task record

Task record: Cosmo-Local architecture and integration research | Type: investigation | Outcome:
complete for the bounded question; implementation, deployment and outreach not started.
Agent/model: Claude Code, Claude Fable 5.1 (claude-fable-5-1) | Coverage: this segment only.

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | unknown → about 2026-10-10T09:30Z | Hub, Linear, code, public CLC documentation, vendor documentation. No clock was observed during this phase; the end is approximate |
| Verify on chain | about 2026-10-10T09:30Z → about 2026-10-10T10:35Z | Factory scan to block 48,683,249; pool and voucher sampling; router, fee, bytecode, derivation and simulation reads on three chains; all read-only. Approximate: the only hard clock is the Linear comment time below |
| Record | about 2026-10-10T10:35Z → 2026-10-10T10:50Z | This file, ledger rows C51 to C62, README and brief pointers, slide 11 line, memory notes; comments saved on RESR-73 and PRD-1096 at 2026-10-10T10:47Z |

Human corrections: none observed in this segment; attention: unknown.
