# Commitment Pooling: G$ Split-State Settlement Spec (August)

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-04
**Companions**: `contract-spec.md` (the pooling module + register this attaches to — **zero changes to those contracts here**), `diagrams.md` D8–D10 (fund-flow topology, settlement sequence, disbursement state machine), `uiux-spec.md` (surface grammar), `corrections-log.md`.
**Decision basis**: Architecture 2 (split-state) locked in the Linear doc "G$ in Green Goods: Bridged vs. Split-State Settlement", re-affirmed by the Architecture 3 re-score; user decisions 2026-07-04 (plan decision log #14–#17): settlement enters the **August release**, **one Celo Safe per garden (1:1 with the garden account, every garden in the protocol, deployed on demand)**, member receipt via same-address smart accounts, app goes multi-chain this iteration.

**What stays true from the locked register**: no bridged G$, ever. No bridge holds value authority in August. Sarafu integration stays deferred (hybrid option, post-August). Model B vouchers stay gated on [PRD-651](https://linear.app/greenpill-dev-guild/issue/PRD-651). Gardeners never sign cross-chain transactions in the field — member *sends* are explicit wallet actions on the settlement chain, never part of the offline field loop.

---

## 1. The model in one paragraph

All commitment truth stays on Arbitrum. A NET-NEW **`SettlementModule`** on Arbitrum is the settlement control plane: it registers each garden's Celo settlement account (a Safe), queues disbursements against Fulfilled commitments, owns the settlement state machine (including failure/retry), and records Celo execution references back. Authorization happens where Hats already lives (Arbitrum, garden-account-anchored); execution happens on Celo from garden-attributed Safes whose signers are scoped by Safe modules (Zodiac Roles + Allowance). The human executor is the bridge in August; a bridge-executor Safe module is the named post-August upgrade path if operator burden binds. Canonical G$ (`0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`, Celo) never leaves Celo.

## 2. Fund-flow topology (diagrams.md D8)

```text
House of Alignment stream (Celo, G$)
  → Dev Guild Working Capital Safe (Celo, exists, receiving today)
    → Green Goods protocol Safe (Celo, exists)              ← settlement account of the PROTOCOL pool (root garden)
      → Garden Celo Safes (NET-NEW, ONE per garden, 1:1)     ← settlement accounts of garden pools, deployed on demand
        → Members (same-address smart accounts on Celo)
```

- Each hop below HoA is a Safe-to-Safe G$ transfer executed by scoped signers; every hop that fulfills a queued disbursement records its tx hash back into the `SettlementModule`.
- The protocol pool's declared rewards reference the GG protocol Safe as source; garden pool rewards reference that garden's Celo Safe.
- Top-ups flow down the chain (WC → GG → garden) as **funding transfers** (not commitment-bound); they are recorded as funding events in the module so exposure reporting stays honest.

## 3. `SettlementModule` (NET-NEW `packages/contracts/src/modules/Settlement.sol`)

Scaffold conventions copied from `contract-spec.md` §6.1: UUPS + Ownable + ReentrancyGuard, `_disableInitializers`, steward gate copied from the pooling module (`_requirePoolSteward` shape — garden operator/owner via hatsModule, module owner fallback, protocol pool → root-garden Hats), CookieJar-style storage comment + 50-slot accounting.

### 3.1 Storage (slot accounting)

| # | Entry | Type |
|---|---|---|
| 1 | `hatsModule` | `IHatsModule` |
| 2 | `commitmentPoolingModule` | `ICommitmentPoolingModule` (reads commitment/pool state) |
| 3 | `nextDisbursementId` | `uint256` (starts at 1) |
| 4 | `nextBatchId` | `uint256` |
| 5 | `settlementAccounts` | `mapping(address garden => SettlementAccount)` |
| 6 | `executors` | `mapping(address garden => mapping(address => bool))` (back-office keys that are also Celo Safe signers) |
| 7 | `disbursements` | `mapping(uint256 => Disbursement)` |
| 8 | `batches` | `mapping(uint256 => Batch)` |
| 9 | `commitmentDisbursed` | `mapping(uint256 commitmentId => uint256 disbursementId)` (0 = none; one live disbursement per commitment) |

Gap: `uint256[41] private __gap;` (9 named + 41 reserved = 50 total).

### 3.2 Types

```solidity
enum DisbursementState { None, Queued, Executing, Settled, Failed, Cancelled }
enum DisbursementKind { CommitmentReward, Funding }   // Funding = Safe top-up hop, not commitment-bound

struct SettlementAccount {
    uint64 chainId;        // 42220 in August; field exists so a future venue never needs migration
    address account;       // the garden's Celo Safe
    bool active;
}

struct Disbursement {
    uint256 commitmentId;  // 0 for Funding kind
    address garden;        // pool garden (Arbitrum garden account)
    DisbursementKind kind;
    address recipient;     // Celo address (member smart account, garden Safe, or GG Safe)
    address token;         // G$ on Celo for August
    uint256 amount;
    DisbursementState state;
    uint256 batchId;       // 0 = unbatched
    bytes32 executionRef;  // Celo tx hash once Settled
    string reasonCID;      // failure/cancel reason (IPFS), empty otherwise
    uint32 attempts;
}

struct Batch { address garden; uint32 count; DisbursementState state; bytes32 executionRef; }
```

### 3.3 Interface + permission matrix

| Function | Authorized caller | Gates |
|---|---|---|
| `registerSettlementAccount(garden, chainId, account)` / `setAccountActive(garden, bool)` | steward or module owner | one active account per garden; event `SettlementAccountRegistered` / `SettlementAccountStatusChanged` |
| `addExecutor(garden, addr)` / `removeExecutor(garden, addr)` | steward | executor is the module-side identity of a Celo Safe signer; event `ExecutorUpdated` |
| `queueDisbursement(commitmentId, recipient, token, amount)` | steward | commitment `Fulfilled` (read from pooling module), pool garden has an active settlement account, no live disbursement for that commitment (`commitmentDisbursed`); event `DisbursementQueued` |
| `queueFunding(garden, recipient, token, amount)` | steward or module owner | the WC→GG→garden top-up hops; event `DisbursementQueued(kind=Funding)` |
| `createBatch(garden, ids[])` | steward or executor | all ids Queued + same garden; event `BatchCreated` |
| `markExecuting(batchId)` | executor | Queued → Executing (batch + members); event `BatchExecuting` |
| `recordSettled(id, executionRef)` / `recordBatchSettled(batchId, executionRef)` | executor or steward | Executing (or Queued for single manual) → Settled; ref mandatory; events `DisbursementSettled` / `BatchSettled` |
| `recordFailed(id, reasonCID)` | executor or steward | Executing → Failed; reason mandatory; event `DisbursementFailed` |
| `requeue(id)` | steward | Failed → Queued, `attempts++`; event `DisbursementRequeued` |
| `cancelDisbursement(id, reasonCID)` | steward | Queued or Failed → Cancelled; frees `commitmentDisbursed`; event `DisbursementCancelled` |
| admin setters (`setHatsModule`, `setCommitmentPoolingModule`, `setPaused`) | module owner | pause blocks all mutations except `recordFailed`, `cancelDisbursement` |
| views (`getDisbursement`, `getBatch`, `settlementAccountOf`, `disbursementOfCommitment`, `isExecutor`) | public | — |

**Deliberate non-couplings**:
- The module **never custodies funds and never calls Celo** — it is a ledger with teeth (state machine + permissions), exactly the shape the split-state doc recommends.
- It does **not** call `commitmentPoolingModule.recordRewardPaid`. `rewardPaid` on the pooling module remains the record for **Arbitrum rails** (jar/treasury); `DisbursementSettled` is the record for **Celo G$ legs**. Shared selectors present one "reward status" per commitment by precedence: settlement-module record if a disbursement exists, else pooling-module `rewardPaid`. Never double-count.
- `Pool.settlementEnabled` / `Pool.settlementAdapter` on the pooling module **stay reserved for Model B vouchers and stay untouched** (false/zero). August settlement presence is derived from `settlementAccounts[garden].active` on this module. Implementers must not flip the pooling-module flag.

### 3.4 Acceptance criteria

- Full state-machine unit coverage: queue → batch → executing → settled; executing → failed → requeue (attempts increments) → settled; cancel frees the commitment for a fresh queue; double-queue on one commitment reverts.
- Gating tests: non-steward queue reverts; non-executor recordSettled reverts; queue against a garden with no active settlement account reverts; queue against a non-Fulfilled commitment reverts.
- Storage-layout test (9 named + 41 gap) + `check-storage-layout.sh` entry.
- `bun run test` green in `packages/contracts`; fork test proves queue→settle round-trip against a Fulfilled commitment created through the pooling module.

## 4. Celo side (ops + Safe modules, no new GG contracts)

- **Safes — one per garden, 1:1, every garden in the protocol**: GG protocol Safe (exists) covers the protocol pool; each garden gets exactly one Celo Safe owned by (attributed to) its garden account. Deployment is **on-demand, not launch-blocking**: a checked-in **script path** (batch-capable — the 13 live gardens can be rolled out in one ops pass) and an **admin trigger** ("Set up settlement account" on the Garden Pool tab settlement card) both call the same deploy-then-register flow. Deploy via the Safe proxy factory with a **salt derived from the garden account address**, so every garden's Safe address is deterministic and predictable before deployment. `registerSettlementAccount` records it — that registration is the canonical garden↔Safe mapping (gap 2 from the audit, closed).
- **Owner set at deployment**: `[gardenAccount, executor key(s)]`, threshold 1. The garden account is a **structural owner** — it cannot sign on Celo today, but listing it makes the 1:1 ownership real on-chain and becomes actionable the day the bridge-executor module lands (the garden account then literally commands its Safe cross-chain). Executor keys do the signing in August, scoped by the modules below.
- **Signer scoping (Zodiac Roles Modifier)**: executor keys may only call `transfer` on the G$ token from the Safe — no arbitrary execution. **Allowance module**: per-period spending caps per Safe, the Celo-side twin of the register's exposure caps. Configuration is ops work with a checked-in runbook (one-shot doc in this folder at execution time, per repo script policy).
- **Ownership nuance (named honestly)**: an Arbitrum ERC-6551 account cannot sign on Celo. "Owned by the garden account" is realized as: authorization anchored on the garden account + Hats on Arbitrum (the module), execution by Zodiac-scoped signers on Celo. The post-August upgrade named now: a **bridge-executor Safe module** (Hyperlane/LayerZero-validated messages from the SettlementModule) makes garden-account triggering literal — gated on the locked "no bridge value authority until operator burden binds" rule, and bounded by the same Allowance caps when it comes.
- **Gas**: executor keys hold CELO; funding source = GG protocol Safe ops budget. Member receipts are pure ERC-20 transfers (no member gas). Member *sends* use sponsored gas (§5).

## 5. Member receipt + multi-chain app

**Decision (#16)**: members receive at **same-address smart accounts on Celo** — the same passkey-owned account address they have on Arbitrum, counterfactually deployable on Celo.

- **Verification spike (first week of the August track, blocking for this leg)**: confirm our AA stack on Celo — account factory deployable at same addresses, bundler + paymaster support (Pimlico or equivalent) on 42220, passkey signature validation parity. Exit: one testnet/mainnet round-trip — receive G$ at the counterfactual address, deploy on first send, sponsored send succeeds.
- **Named fallback if the spike fails**: garden-custody accounting — disbursements rest in the garden Safe, member claims tracked by disbursement records, cash-out on request to a member-provided address. Counsel flag attaches only if this fallback activates (gardens become custodians of member value).

**Multi-chain app (decision #17)** — the Single Chain principle amends to: **primary chain (`VITE_CHAIN_ID`) + settlement chain (Celo, 42220) for value legs**. The CLAUDE.md principle edit rides the implementation PR, not this spec. August scope, all tiers:

| Tier | What ships | Notes |
|---|---|---|
| Reads | Celo Safe balances (admin funding views), member G$ balance (WalletDrawer), disbursement/settlement status everywhere | Status reads come from the **indexer** (SettlementModule events), not Celo RPC; balance reads are direct Celo RPC via a second viem public client. Shared already imports the 42220 artifact + EASscan map. |
| Operator writes | Batch execution flow: admin surfaces deep-link the queued batch into the Safe app for signing in August (in-app Safe SDK execution is post-August polish); `markExecuting`/`recordSettled` are normal Arbitrum module writes from admin | Keeps August build small without blocking the flow. |
| Member writes | Send G$ from the wallet on Celo: chain-aware send flow with **sponsored gas** (members never hold CELO) | Explicit online wallet action; never enters the offline field queue. New job kind `transfer` (chain-aware payload `{ chainId, token, to, amount }`) — brings the August job-kind count to six. |

Shared substrate additions (extends PRD-674's scope via this spec): settlement chain registry (`{ primary, settlement }` chain config), second public client, G$ token config, `queryKeys.settlement.*` family, settlement/disbursement hooks + selectors (including the reward-status precedence rule from §3.3), `transfer` job kind.

## 6. Indexer

Within the existing boundary (SettlementModule is Green Goods core; **G$ transfers on Celo are NOT indexed** — the executionRef ties records to Celo txs for auditors). New config block (Arbitrum + Sepolia, zero-address placeholders pre-broadcast) and entities:

```graphql
enum DisbursementState { QUEUED EXECUTING SETTLED FAILED CANCELLED }
enum DisbursementKind { COMMITMENT_REWARD FUNDING }

type SettlementAccount { id: ID! chainId: Int! garden: String! accountChainId: Int! account: String! active: Boolean! updatedAt: Int! }
type Disbursement {
  id: ID! # chainId-disbursementId
  chainId: Int! disbursementId: BigInt! garden: String! commitmentId: BigInt
  kind: DisbursementKind! recipient: String! token: String! amount: BigInt!
  state: DisbursementState! batchId: BigInt executionRef: String reasonCID: String
  attempts: Int! createdAt: Int! updatedAt: Int!
}
```

Handlers follow `commitmentPool.ts` patterns (create-if-not-exists, dedup, composite IDs, `bun codegen`). Pool-level derived gauge for admin: `queuedDisbursementValue` computed in shared selectors from Queued+Executing disbursements (not stored).

## 7. Surface impact (deltas to `uiux-spec.md` / `wireframes.md`, wireframe pass to follow)

- **W2 commitment detail (PWA)**: reward row gains settlement status from the precedence rule — "support on its way" (Queued/Executing), "support arrived" + Celo ref (Settled), "still arranging support — your promise is recorded" (Failed; mutual-aid copy, never an error tone).
- **W5 WalletDrawer**: G$ balance section (Celo) + received-support rows; send action → chain-aware transfer flow.
- **W7 admin Garden Pool tab**: settlement account card (Safe address, active, allowance snapshot) + disbursement queue section.
- **W10 commitment dialog**: "Queue disbursement" replaces/precedes "Record payout" for G$-rewarded commitments; batch actions.
- **W12 Pools workspace funding view**: WC→GG→garden funding hops, Safe balances, batch console.
- Editorial/community: no change (aggregates only; settlement is not a public story in August).

i18n families extend `app.pool.*`, `cockpit.garden.pool.*`, `cockpit.pools.*` with `settlement.*` keys (en/es/pt, same gate). Banned-vocab rules apply to all new copy.

## 8. August sequencing (amends plan Track B)

SettlementModule work runs as **PR chain 2.5** — parallel with PRD-673/674 once PRD-672's interfaces freeze (the module only *reads* the pooling module):

1. Week 1 spike: Celo AA verification (§5) + GoodDollar written confirmations (token address, reporting expectations — the two still-open items now that the HoA→WC Safe flow is confirmed fact).
2. `Settlement.sol` + tests + deploy plumbing (artifact keys `settlementModule`) + indexer block/entities.
3. Safe deployment tooling: the deterministic deploy-then-register script (batch-capable for the 13 live gardens) + the admin "Set up settlement account" trigger; Zodiac config + executor keys; `registerSettlementAccount` for the protocol pool post-broadcast, garden Safes rolled out on demand.
4. Shared substrate (chain registry, hooks, `transfer` kind) → admin queue/batch surfaces → PWA reward-status + wallet G$.
5. Exit criteria added to Milestone 2: first real G$ disbursement queued on Arbitrum, executed from an on-demand-deployed garden Safe on Celo, `recordSettled` with the Celo tx hash, status visible in the PWA.

**Honest risk note**: this widens the August hard commitment by roughly a contracts sub-lane + a shared/admin increment. The two highest-risk externalities (Celo AA support; GoodDollar written confirmations) are front-loaded as week-1 gates with named fallbacks, so a failed gate degrades the member-receipt leg without threatening the pooling release itself.

## 9. Out of scope (unchanged by this spec)

Bridged G$ (never). Bridge value authority (post-August, capped, only if operator burden binds). Sarafu pool integration (deferred hybrid — Phase-1.5 experiment gated on GE conversation + ERC-777 audit). Model B vouchers and `settlementAdapter` activation (PRD-651, all its hard gates stand). Indexing Celo/G$ state. Settlement controls in the September community interface.
