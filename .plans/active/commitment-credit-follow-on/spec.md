# Commitment Credit — August Borrow-and-Repay Companion Spec (`CreditRegistry`)

**Feature Slug**: `commitment-credit-follow-on`
**Stage**: `active — stage-2 contracts increment (dispatch gates cleared 2026-08-09)`
**Created**: 2026-07-05
**Companions**: `../../active/commitment-pooling/contract-spec.md` (the pooling module + register this attaches to — **zero changes to those contracts here**), `../../active/commitment-pooling/settlement-spec.md` (the records-only, no-custody state-machine template this copies, and the G$ leg), `../../active/commitment-pooling/diagrams.md`, `../../active/commitment-pooling/uiux-spec.md`, `../../active/commitment-pooling/reports/corrections-log.md`.
**Decision basis**: User decision 2026-07-05 — Green Goods should carry GE's **borrow-and-repay** loop, scoped now as a **dedicated `CreditRegistry`** (over the lighter reuse-the-commitment-machinery alternative), because gardens already run mutual credit with installments and default tracking. Grounded finding: borrow-and-repay was a **consciously-deferred** choice, not an oversight — the 5th action domain "Mutual Credit and Farmer Verification" was an explicit *build-vs-drop* deferral (`docs/docs/builders/specs/v1-0.mdx:184`, never given an enum value or action set; `../../active/commitment-pooling/reports/corrections-log.md:82` confirms never built), and the deliberate no-custody posture (decision #8, `../../active/commitment-pooling/contract-spec.md:54`) structurally discouraged lending. The pooling module models promise→confirm→consideration (mutual aid of *labor*) and never modeled capital borrowing. The 2026-08-01 scope lock moved this companion chain into the August wave. The three contracts dispatch gates cleared on 2026-08-09; exact evidence and ABI coverage live in [coverage-ledger.md](coverage-ledger.md).

**What stays true from the locked architecture**: the module **never custodies funds** (`../../active/commitment-pooling/contract-spec.md` §3 decision 8); the register exposes no transfer surface (`../../active/commitment-pooling/contract-spec.md` §6.2 Interface); and the `SettlementModule` is a records-only control plane (`../../active/commitment-pooling/settlement-spec.md` §2–3). `CreditRegistry` is the same shape: it **records and gates, it never holds capital**. Disbursement rides the existing rails. Interest-free. No revolving corpus. No per-borrower credit score, ever.

---

## 0. 2026-08-09 interface revalidation and stage boundary

Revalidated against merge-base `c60b38dea` and branch HEAD `238e4e218`. Stage 1 renamed every promise-side `Reward*` concept to `Consideration*`, added immutable `payerGarden`, emitted both settlement deployment identities, restricted acknowledgments to the live route with `failStrandedSubject` as the owner-only stranded exit, and steward-gated priced Offer claims. This spec therefore uses the implemented `ContributorConsideration`/`GardenBeneficiary` vocabulary and treats a loan principal as its own commitment-independent child.

The exact settlement addition is `queueLoanPrincipal(uint256 loanId) returns (uint256 disbursementId)` on `ISettlementModule`. It reads the single paused-configured `creditRegistry`, derives the Approved loan and current pool, requires a current pool steward, and derives every value-moving fact: pool garden and executor garden, active garden Safe source, borrower recipient, canonical G$, principal, `FundingRoute.None`, and the loan relationship. The generic `Disbursement` row stays ABI- and storage-identical to stage 1. ERC-7201 namespaced loan state holds the configured registry, registry+loan reverse lookup, and disbursement relationship; `loanPrincipalDisbursementOf(creditRegistry, loanId)` makes queueing idempotent and `loanPrincipalRelationshipOf(disbursementId)` gives `CreditRegistry` the authenticated relationship. `LoanPrincipalQueued(disbursementId, creditRegistry, loanId)` is the indexable relationship marker; the existing generic queue event and the four `DisbursementKind` ordinals do not change.

`createBatch` and dispatch revalidate the snapshotted credit registry, Approved loan, Open/enabled pool, reserved cap exposure, garden, borrower, canonical token, principal, and current dependency identity. Approval reserves the loan's exposure in ERC-7201 namespaced credit state, so two in-flight G$ principals cannot independently consume the same cap headroom; recording converts that reservation to outstanding exactly once. Retry, acknowledgment, stranded close-out, cancellation, and upgrade preserve the stored relationship. The Celo executor accepts ordinal 2 through its existing bounded G$ transfer path; it does not gain a caller-controlled target, token, or calldata surface.

This stage implements and proves contracts only. Every deploy target, `DeploymentResult`/artifact and recovery path, courier, Safe/Zodiac setup, live configuration, post-deploy command, and broadcast ceremony is stage 3 after this contracts increment merges.

## 1. The model in one paragraph

A NET-NEW **`CreditRegistry`** on Arbitrum is the borrow-and-repay control plane: it records a `Loan` per borrower against a pool, owns the loan state machine (Requested → Approved → Disbursed → Repaid / Defaulted / Cancelled; **Repaying is derived**), enforces a per-borrower outstanding cap (GE's "limiting" primitive applied to credit), and accumulates installment repayments. It is the **twin of the `SettlementModule`** (`../../active/commitment-pooling/settlement-spec.md` §3): records-only, reads the pooling module, never holds value. **Principal disbursement rides an existing rail** — a Cookie Jar or garden-treasury transfer on Arbitrum (`CookieJar.sol:243-296`, pull-based; `Yield.sol:391-400` garden treasury), or a G$ leg through the `SettlementModule` on Celo (`../../active/commitment-pooling/settlement-spec.md` §2-3). **Repayment is record-only** and requires a unique non-zero execution reference for Jar/Treasury. The borrower returns value on the same rail off-chain and a steward or registered pool executor records it. G$ repayment remains disabled because the current settlement protocol has no authenticated upward receipt. **Interest-free** by default (GE mutual-aid; the register's "valuing" primitive is deferred, `../../active/commitment-pooling/contract-spec.md:695`; interest + custody is the legal tripwire), with a reserved flat-fee seam fixed to zero.

## 2. Where value moves — no new corpus, no new custody

Green Goods gets GE's borrow-and-repay **loop without a revolving corpus**. GE's corpus is a single pooled fund that lends and reclaims; Green Goods instead **references the existing payout rails** and records against them:

```text
Advance (down):  garden rail  ── principal ──▶  borrower
                 (Cookie Jar / treasury / G$ Safe via SettlementModule)
                 CreditRegistry records: LoanDisbursed(rail, amount, executionRef)

Repayment (up):  borrower  ── returns value ──▶  same garden rail
                 CreditRegistry records: RepaymentRecorded(amount, executionRef)   [record-only]
```

- The Cookie Jar (`CookieJar.sol`) already custodies and disburses (per-asset 1Hive jars, gardener-Hat-gated, rate-limited pull withdrawal). An advance drawn from the jar and repaid back into it makes **the jar itself the revolving fund** — the `CreditRegistry` never holds a cent.
- Every hop that moves value is an already-executed rail transfer; `recordDisbursed` / `recordRepayment` write its reference (tx hash) back into the loan for auditors.
- Top-ups of a garden's rail are ordinary funding (jar donation, treasury transfer, or `SettlementModule` `queueFunding`) — not part of this module.

## 3. `CreditRegistry` (NET-NEW `packages/contracts/src/registries/Credit.sol`)

Scaffold conventions copied from `../../active/commitment-pooling/contract-spec.md` §6.1 / `../../active/commitment-pooling/settlement-spec.md` §3: UUPS + Ownable + ReentrancyGuard, `_disableInitializers`, steward gate copied from the pooling module (`_requirePoolSteward` shape — garden operator/owner via hatsModule, module-owner fallback, protocol pool → root-garden Hats; `../../active/commitment-pooling/contract-spec.md:163`, ultimately `Hypercerts.sol:282-287`), CookieJar-style storage comment + 50-slot accounting (`CookieJar.sol:55-59`).

**Placement rationale (why a companion module, not the pooling module).** `../../active/commitment-pooling/contract-spec.md:1330` (risk #1) instructs reviewers to "challenge any FURTHER on-chain state before it lands" on `CommitmentPoolingModule` — it already carries more transition logic than the repo's thin-module convention. A loan state machine there walks into exactly that review resistance. The `SettlementModule` proved the companion pattern works: a records-driven state machine that reads the pooling module and never custodies, added as an additive PR chain with **zero changes to the pooling module or register** (`../../active/commitment-pooling/settlement-spec.md:6`, plan decision #14). `CreditRegistry` copies that seam. The contract name follows the house registry pattern (`registries/Action.sol` → `ActionRegistry`), while the file stays the noun `registries/Credit.sol`. The GE “register” grammar remains prose vocabulary; the struct is `Loan`.

### 3.1 Storage (slot accounting)

| # | Entry | Type |
|---|---|---|
| 1 | `hatsModule` | `IHatsModule` |
| 2 | `commitmentPoolingModule` | `ICommitmentPoolingModule` (reads pool/garden; optional commitment link) |
| 3 | `settlementModule` | `address` (reads the disbursement id for the G$ leg; 0 until settlement ships) |
| 4 | `nextLoanId` | `uint256` (starts at 1; 0 = null sentinel) |
| 5 | `loans` | `mapping(uint256 loanId => Loan)` |
| 6 | `poolCreditConfig` | `mapping(uint256 poolId => PoolCreditConfig)` (borrower cap + enable flag) |
| 7 | `borrowerOutstanding` | `mapping(uint256 poolId => mapping(address borrower => uint256))` (live open principal minus repaid) |
| 8 | `commitmentLoan` | `mapping(uint256 commitmentId => uint256 loanId)` (0 = none; one live loan per linked commitment) |
| 9 | `executors` | `mapping(uint256 poolId => mapping(address => bool))` (rail-side identities that record disbursement/repayment) |
| 10 | `executionRefLoan` | `mapping(bytes32 executionRef => uint256 loanId)` (global replay guard) |
| 11 | `paused` | `bool` (initialized true) |

Gap: `uint256[39] private __gap;` (11 named + 39 reserved = 50 total). Inherited upgradeable contracts maintain their own layouts independently.

ERC-7201 namespace `green.goods.credit.cap-reservation` stores per-borrower Approved exposure and the
per-loan reservation bit outside the frozen linear layout. Approval creates the reservation;
Jar/Treasury or authenticated G$ recording converts it to outstanding; an Approved cancellation
releases it only after any linked settlement child is itself Cancelled.

`PoolCreditConfig` (packed): `{ uint256 borrowerCap; bool enabled; }`. `borrowerCap == 0` = uncapped (matches the register's `providerExposureCap` "0 = uncapped" convention, `../../active/commitment-pooling/contract-spec.md:714`).

**Ownership / upgrade:** `OwnableUpgradeable` owner = protocol multisig for `_authorizeUpgrade` (repo-wide UUPS convention, `CookieJar.sol:302-304`; register upgrade-authority note `../../active/commitment-pooling/contract-spec.md:719`).

### 3.2 Types

```solidity
enum LoanState { None, Requested, Approved, Disbursed, Repaid, Defaulted, Cancelled }
// Repaying is DERIVED (0 < repaidAmount < principal); never stored (hybrid-state discipline, decision #6 / ../../active/commitment-pooling/contract-spec.md:49).
enum LoanRail  { None, Jar, Treasury, GDollarSettlement } // None is the pre-disbursement sentinel

struct PoolCreditConfig { uint256 borrowerCap; bool enabled; }

struct Loan {
    uint256 poolId;            // borrowing pool (garden pool or protocol pool)
    address borrower;          // the member/garden receiving principal
    address requestedBy;       // self or the steward using the explicit onBehalfOf path
    uint256 commitmentId;      // OPTIONAL link: seed -> BORROW -> REPAY loop; 0 = standalone
    address token;             // asset denominated (WETH/DAI on Arbitrum, or G$ on Celo)
    uint256 principal;         // amount lent
    uint256 repaidAmount;      // accumulates across installments (native partial repayment)
    uint256 feeAmount;         // RESERVED: flat fee, 0 in MVP (interest-free); repaid on top of principal
    LoanRail rail;             // disbursement rail used
    uint256 disbursementId;    // SettlementModule disbursement id for the G$ leg; 0 otherwise (§5)
    LoanState state;
    uint64  dueDate;           // 0 = pool/cycle-governed; single bullet due date in MVP
    uint32  installmentsTotal; // informational schedule hint; 0 = open-ended
    uint32  installmentsPaid;  // increments per recordRepayment
    uint32  attempts;          // disbursement retry counter (mirrors Disbursement.attempts)
    bytes32 executionRef;      // rail/Celo tx hash once disbursed (mirrors Disbursement.executionRef)
    string  termsCID;          // IPFS: schedule, purpose, mandate artifact (onboarding survey output)
    string  reasonCID;         // default/cancel reason (IPFS); empty otherwise
}

struct RequestLoanParams {
    uint256 poolId;
    uint256 commitmentId;   // 0 = standalone
    address token;
    uint256 principal;
    uint64  dueDate;
    uint32  installmentsTotal;
    string  termsCID;
    address onBehalfOf;     // zero for self; non-zero distinct member requires current steward authority
}
```

`repaidAmount` + `installmentsPaid` are the headline reason for the dedicated record: decision #11 (`../../active/commitment-pooling/contract-spec.md:1340`) defers partial fulfillment on the commitment path (units convert all-or-nothing at Fulfilled), but repayment is inherently partial and iterative. `commitmentId` (0 = standalone) realizes GE's **seed → BORROW → REPAY** loop: a `SeasonCampaign`/`DomainImpact` commitment can motivate a loan whose repayment is expected once the commitment fulfills. `dueDate == 0` + no pool/cycle window is the "can-never-default" corner — mirror expiry-timing risk #8 (`../../active/commitment-pooling/contract-spec.md:1337`): seeding UX must require one of the two.

### 3.3 Interface + permission matrix

| Function | Authorized caller | Gates |
|---|---|---|
| `configurePoolCredit(poolId, borrowerCap, enabled)` | steward | per-pool credit enablement + cap; event `PoolCreditConfigured` |
| `addExecutor(poolId, addr)` / `removeExecutor(poolId, addr)` | steward | rail-side identity that records disbursed/settled; event `ExecutorUpdated` |
| `requestLoan(params)` | pool member requests for self; steward may name a distinct current member through `onBehalfOf` | pool Open + credit enabled; non-zero token/principal; future non-zero due date; non-empty terms; optional commitment exists in the same pool; requested principal ≤ remaining `borrowerCap`; event `LoanRequested` |
| `approveLoan(loanId)` | **steward** (never the borrower) | state Requested; revalidates the original self-member or `onBehalfOf` steward authority; re-checks and reserves cap exposure; `SelfApproval` revert when approver == borrower (mirrors `SelfAttestation`, `WorkApproval.sol:153-156`); event `LoanApproved` |
| `recordDisbursed(loanId, rail, executionRef)` | steward or pool executor | state Approved with its cap reservation; rechecks Open/enabled pool. Jar/Treasury recheck current committed exposure and require a unique steward-attested external execution reference. G$ derives the exact Confirmed settlement child through `loanPrincipalDisbursementOf(address(this), loanId)` and requires `executionRef == keccak256(abi.encode(executionKey, disbursementId))`; the settlement dispatch already rechecked the reserved cap before value moved. Recording converts the reservation to `borrowerOutstanding` exactly once; event `LoanDisbursed` |
| `recordRepayment(loanId, amount, executionRef)` | steward or pool executor | state Disbursed/Defaulted; Jar/Treasury only; unique non-zero reference; amount is positive and cannot exceed `principal + feeAmount - repaidAmount`; decrements `borrowerOutstanding`; emits `RepaymentRecorded` (+ `LoanRepaid` on exact clearance). G$ reverts `GDollarRepaymentDisabled` |
| `markDefaulted(loanId, reasonCID)` | steward | past `dueDate` (or pool/cycle window when 0), else `NotDue`; reason mandatory (stays visible, mutual-aid tone); event `LoanDefaulted` |
| `cancelLoan(loanId, reasonCID)` | borrower (from Requested) · steward (from Requested/Approved) | never from Disbursed (principal is out); a linked settlement child must already be Cancelled, so Queued/Dispatched/Confirmed/Failed children cannot be orphaned; releases the Approved cap reservation and frees `commitmentLoan`; allowed while module paused (winddown); event `LoanCancelled` |
| admin setters (`setHatsModule`, `setCommitmentPoolingModule`, `setSettlementModule`, `setPaused`) | module owner | dependency changes and upgrade require pause; settlement replacement also requires zero Approved-loan cap reservations so it cannot orphan a queued/dispatched principal; pause blocks all mutations except `markDefaulted` and `cancelLoan` |
| views (`getLoan`, `outstandingOf`, `amountDue`, `loanOfCommitment`, `poolCreditConfig`, `isExecutor`, `loanOfExecutionRef`) | public | — |

**Deliberate non-couplings** (stated the way the SettlementModule states its own, `../../active/commitment-pooling/settlement-spec.md:97-100`):
- The module **never custodies funds and never moves value.** `recordDisbursed`/`recordRepayment` record already-executed rail transfers.
- It does **not** call `commitmentPoolingModule` mutators. The optional `commitmentId` is a one-way reference (like `needUID` on the commitment record, `../../active/commitment-pooling/contract-spec.md:295`); the loan never transitions a commitment and a commitment never transitions a loan.
- `Pool.settlementEnabled` / `settlementAdapter` (reserved for the transferable-voucher layer, `../../active/commitment-pooling/contract-spec.md:253`) stay untouched (false/zero). Credit-enablement is derived from `poolCreditConfig[poolId].enabled` on this module.

### 3.4 Acceptance criteria

- Full state-machine unit coverage: request → approve → disburse → repay (single and **installment**: repaidAmount accumulates, state stays Disbursed until cleared); approver ≠ borrower and original request authority are revalidated; cap is checked at request/approval/disbursement and Approved exposure is reserved across asynchronous settlement; `NotDue` before `dueDate`; default → later repayment (recovery) → Repaid; double-borrow on one commitment reverts; cancellation clears the live commitment link and cannot orphan a live settlement child; replay/zero reference reverts.
- Storage-layout test (11 named + 39 gap) + generated `CreditRegistry` baseline and upgrade-from-old-layout proof.
- `bun run test` green in `packages/contracts`; fork test disburses from a jar/treasury on an Arbitrum fork and records a repayment round-trip.

## 4. State machine (one event per transition)

On-chain hard states: `Requested → Approved → Disbursed → Repaid / Defaulted / Cancelled`. **`Repaying` is DERIVED** (`0 < repaidAmount < principal`) — hybrid-state discipline (decision #6, `../../active/commitment-pooling/contract-spec.md:49`): store only hard transitions, derive the review-soft overlay. `RepaymentRecorded.newOutstanding` is the remaining balance of that loan, not the borrower's aggregate pool exposure, so the indexer can flip the Repaying overlay without re-summing or confusing concurrent loans.

- **Anti-farming** (decision #14, `../../active/commitment-pooling/contract-spec.md:60`): borrower cannot approve their own loan; repayment is recorded by steward/executor, never self-attested by the borrower (a borrower claiming "I repaid" is the self-attestation the commitment path blocks); default requires a visible reason; the per-borrower cap is a hard limiting gate; disputes reuse the pooling pool's pause + `markDefaulted`/`cancelLoan` (Sarafu-precedent reclamation posture, risk #9 `../../active/commitment-pooling/contract-spec.md:1338`) rather than a duplicate dispute machine.
- **Default is not terminal.** A defaulted loan can still be repaid (`recordRepayment` from Defaulted → `LoanRepaid`); the ledger tracks reality. Default counts against the pool's aggregate `defaultRate`; a recovered default still shows in history.
- **Pause** (twin of SettlementModule, `../../active/commitment-pooling/settlement-spec.md:94`): module-wide `setPaused` blocks every mutation except `markDefaulted` and `cancelLoan`. No pool-level pause of its own — it reads the pooling pool state and refuses `requestLoan`/`approveLoan` when the pool is not Open.

## 5. The G$ micro-loan (settlement-spec touchpoint) — the disburse/repay asymmetry

Split-state, no bridge (`../../active/commitment-pooling/settlement-spec.md:15`): commitment and loan truth stay on Arbitrum; only value legs move on Celo. The asymmetry is the crux — **G$ disbursement can ride the `SettlementModule`, but G$ repayment cannot** (there is no upward disbursement primitive and no bridge).

- **Disbursement (down, has a rail):** a current pool steward calls `SettlementModule.queueLoanPrincipal(loanId)`. The configured registry and Approved loan determine the pool garden, active garden Safe, borrower, canonical G$, principal, and persistent loan relationship. `commitmentId` and `payoutPlanId` stay zero because this is neither consideration nor a payout-plan child. Only an authenticated `Confirmed` settlement child can later be recorded by `CreditRegistry`; its reference is the domain-separated `keccak256(abi.encode(executionKey, disbursementId))`, which stays unique even when multiple loan children share one batch execution key. The former generic `commitmentId == 0` alternative remains rejected.
- **Repayment (up, no disbursement primitive):** **record-only on Arbitrum** — the member sends G$ back to the garden Safe on Celo as an explicit online wallet action; the module never moves G$ or calls Celo. The pre-dispatch interface-revalidation gate must freeze a bounded authenticated repayment-receipt policy compatible with the implemented settlement architecture. Chainlink Functions is retired and is not an available verifier. `recordRepayment` cannot count a human-reported hash by itself, and there is no human verification fallback. If no bounded policy passes the revalidation plus legal/operations gates, the G$ repayment path stays disabled while Jar/Treasury borrow-and-repay can proceed. **No bridge value authority is introduced.**
- **Status precedence:** a loan is not a reward, so credit adds a parallel, non-overlapping axis to the reward-status precedence (`../../active/commitment-pooling/settlement-spec.md:99`); the shared selector presents "loan status" and "reward status" as distinct rows on a commitment that has both.

## 6. Indexer

Within the existing boundary (`CreditRegistry` is Green Goods core; **G$ transfers on Celo are NOT indexed** — `executionRef` ties records to Celo txs for auditors). New config block (Arbitrum + Sepolia, zero-address placeholders pre-broadcast, like OctantVault `config.yaml:81-82`) and entities; handlers follow `commitmentPool.ts` / `greenWill.ts` dedup-counter patterns (`../../active/commitment-pooling/contract-spec.md:1181`).

```graphql
enum LoanState { REQUESTED APPROVED DISBURSED REPAYING REPAID DEFAULTED CANCELLED }  # REPAYING derived in selectors
enum LoanRail  { JAR TREASURY GDOLLAR_SETTLEMENT }

type Loan {
  id: ID! # chainId-loanId
  chainId: Int! loanId: BigInt! poolId: BigInt! garden: String!
  borrower: String! recordedBy: String! commitmentId: BigInt
  token: String! principal: BigInt! repaidAmount: BigInt! outstanding: BigInt! feeAmount: BigInt!
  rail: LoanRail disbursementId: BigInt state: LoanState!
  dueDate: BigInt! installmentsTotal: Int! installmentsPaid: Int! attempts: Int!
  executionRef: String termsCID: String reasonCID: String
  createdAt: Int! updatedAt: Int!
}
type LoanEvent { id: ID! chainId: Int! poolId: BigInt! loanId: BigInt eventType: String! actor: String! amount: BigInt data: String txHash: String! timestamp: Int! }
```

Credit stats use **numerator/denominator only** (no floats, no leaderboards; same discipline as `promiseKeptRate`, `../../active/commitment-pooling/contract-spec.md` §8.4), on a sibling `CreditPoolStats`: `creditIssued`, `creditRepaid`, `creditOutstanding`, `repaymentRate`, and `defaultRate`. `newOutstanding` rides every mutating event so handlers never re-sum. `bun codegen` follows schema/config edits.

## 7. Surface impact (deltas to `../../active/commitment-pooling/uiux-spec.md`; implementation remains post-dispatch-gates)

- **Admin — Garden Pool / Pools workspace:** a credit console (enable credit + set `borrowerCap`; request/approve/disburse/record-repayment/mark-default queue; outstanding-per-borrower for the steward only — operational, never published). Mutual-aid copy: "advance", "repayment", "still arranging repayment" (never a shaming or credit-score tone; `../../active/commitment-pooling/settlement-spec.md:156` grammar).
- **Client PWA — wallet surface:** a "your credit" row (advance received, amount outstanding, next repayment); repayment as an explicit online action (jar/treasury deposit on Arbitrum, or a G$ send on Celo via the existing online wallet `transfer` action).
- **Editorial / community:** aggregates only (`creditIssued`/`repaymentRate` at pool/garden level); **never** per-borrower listings (decision #21; `../../active/commitment-pooling/uiux-spec.md` §7.2 privacy rules).
- i18n: extend `cockpit.*` + `app.pool.*` with `credit.*` keys (en/es/pt, same coverage gate). Banned-vocab rules apply.

## 8. Sequencing — stage 2 contracts, then stage 3 deployment

Runs after stage 1 at `c60b38dea` and the branch interface hardening at `238e4e218`. The three dispatch gates are cleared. **No change to the pooling module, `CommitmentRegistry`, their storage, or their lifecycle.**

1. `Credit.sol` + `ICreditRegistry.sol` + unit/fork tests (§3.4).
2. Storage-layout baseline, old-layout upgrade proof, adversarial/fuzz/invariant/fork coverage, and exact contract ship gates.
3. The locked §5 `LoanPrincipal` selector in the settlement lane; do not reopen the rejected generic `commitmentId == 0` alternative.
4. Stop for human review and merge.

Stage 3 separately adds deploy targets, artifacts/recovery, courier, Safe/Zodiac and dependency configuration, live addresses, post-deploy verification, and any authorized broadcast. Indexer, shared, admin, client, and agent work remain downstream lanes outside this PR.

## 9. Ripples into siblings (owned elsewhere, noted here)

- **Onboarding survey** (the "Mutual Credit" offering gardens already pick): the scoping survey should capture per-garden **credit terms** — unit/token, `borrowerCap`, repayment window, forgiveness policy — which land in each loan's `termsCID`. No new schema; credit config is set per pool at enablement.
- **Brief framing** (canonical synthesis v5, "Commitment Pooling × Green Goods — Grassroots Economics Learnings, and the Full Flywheel We're Building", on Linear): "four rails, not GE's single revolving corpus" is **kept but sharpened** — GG adds the loop without a corpus. The old "the jar is a rate-limited faucet without GE's repayment loop" tradeoff is replaced: this loop closes it.
- **Dropped Domain-5 "Mutual Credit and Farmer Verification"** (`docs/docs/builders/specs/v1-0.mdx:184,308-334` — offered in Season-1 onboarding, never given an enum value or action set; its "Credit Enabled = value of credit lines enabled" metric at `:332`; `../../active/commitment-pooling/reports/corrections-log.md:82` confirms never built): realized here as a **cross-cutting credit layer** over any domain, **not** a resurrected 5th `Domain` enum value (domains stay SOLAR/AGRO/EDU/WASTE; the immutable Work/Assessment domain fields are unaffected). Farmer-verification maps to the assessment-v3 / testimony gates, not here. The `creditIssued` aggregate (§6) is the on-chain realization of that "Credit Enabled" metric.

## 10. Out of scope (MVP)

Interest / rates (interest-free; only a reserved zero flat-fee seam). In-kind repayment (needs the deferred "valuing" primitive, `../../active/commitment-pooling/contract-spec.md:695` — same-token repayment only). A dedicated loan-dispute state machine (reuse pool pause + `markDefaulted`/`cancelLoan`). Credit-as-collateral transferable vouchers (the reserved `settlementAdapter` seam, all the transferable-voucher gates stand). Garden-to-garden lending (reserved the way the commitment path reserves `counterpartyPoolId`, `../../active/commitment-pooling/contract-spec.md:59`; MVP is member↔pool). Permissionless default (default is steward-called with a reason — it carries reputational weight). **Any per-borrower public creditworthiness score, ranking, or leaderboard** — a per-borrower outstanding *cap* is a limiting gate and aggregate repayment/default *rates* are fine, but a mutual-aid credit system must never become a credit bureau.

## 11. Grassroots Economics grounding (clean-room)

Design vocabulary comes from Ruddick's "Commitment Pooling" (IJCCR) and the public GE docs only, never the AGPL Sarafu source (decision #17, `../../active/commitment-pooling/contract-spec.md:691`). Borrow-and-repay is GE's actual core (seed → borrow principal → repay in-kind, vouchers as collateral). With the 2026-08-01 scope lock granted, this spec ships the **borrow-and-repay** and **limiting** pieces after its three dispatch gates clear; it keeps **valuing** deferred (so repayment is same-token, and in-kind repayment waits for relative pricing) and keeps **vouchers-as-collateral** deferred (the transferable-voucher layer). Gardens already run the pattern by hand — a garden pairing agroforestry with a mutual-credit cycle "issued, traded, redeemed"; another tracking "credit issued, fulfillment, and default rates" — which is the evidence this belongs in the protocol, not the invention of a new product.
