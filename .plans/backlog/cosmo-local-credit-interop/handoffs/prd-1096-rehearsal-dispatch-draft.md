# PRD-1096 rehearsal: Cosmo-Local voucher loop on pinned forks

**Status:** approved by Afo with all eight assumptions as written, 2026-10-21T03:20Z
(20 October Pacific); written 2026-10-21T00:30Z. Not dispatched: the contracts lane stays
manually blocked until Afo dispatches it.
**Owner when dispatched:** Codex, contracts lane (`status.json` `lanes.contracts`). **Reviewer:** Afo.
**Linear:** PRD-1096 (Todo, Product Cycle 12, due 21 October as an evidence checkpoint; carryover is
recorded by 23 October). Parent PRD-857. The rehearsal prototypes the contracts planned in PRD-1317
and PRD-1318 and gives evidence to PRD-1197, the 22 October go/no-go. It is not their production
delivery.

## For Afo before dispatch

1. Done: Afo approved the eight assumptions below as written on 20 October.
2. Save this file as `handoffs/codex-contracts.md`, the lane's reserved path, without this section.
   In `status.json`, clear `lanes.contracts.manual_blocked` and add a human history row naming
   PRD-1096 and the adopted defaults; run `bunx biome format --write` on `status.json` afterwards.
   Update the "implementation handoffs are intentionally absent" sentence in `handoffs/README.md`.
3. Commit step 2's changes with the hub on a local branch for Codex to start from, such as
   `chore/dispatch-cosmo-local-rehearsal` cut from develop once PR #1170 has merged. The dispatch
   script runs `git worktree add` from `--base`, which must be a local branch, so anything
   uncommitted, including the unblocked lane and the reserved handoff, is invisible to Codex. The
   script reads `--prompt-file` from the checkout where it runs, so Codex receives exactly that copy.
4. Dispatch from the repository root, with `--base` set to the local branch that carries that
   commit:

```bash
bash .claude/scripts/dispatch-codex-lane.sh --lane cosmo-rehearsal --base chore/dispatch-cosmo-local-rehearsal --branch feature/cosmo-local-voucher-rehearsal --prompt-file .plans/backlog/cosmo-local-credit-interop/handoffs/codex-contracts.md
```

5. The fork runs need network access to public Arbitrum and Gnosis RPC endpoints, and the pinned
   Gnosis block needs an endpoint that still serves its state. If the Codex sandbox blocks them,
   Codex stops after the unit tests and the fork shard runs from Afo's terminal or a Claude session.

Everything below is addressed to the implementing agent.

## Objective

Write two Green Goods contracts, a service desk, a message codec and hand-written Cosmo-Local
interfaces, then prove on pinned Arbitrum and Gnosis forks that:

- a fulfilled Arbitrum commitment with voucher terms registered and issuer-approved before
  acceptance delivers its vouchers on Gnosis exactly once, through replay, retry, requeue, repair
  and the issuer's fallback;
- supporters buy vouchers through the issuer pool's bounded swap, and members exchange vouchers
  within each pool's limit on the other issuer's voucher;
- exhausted inventory, de-listing, a changed quote and a refused sponsorship fail safely and
  recover;
- a voucher is presented, delivered fully or partly, confirmed by the holder and discharged once,
  or remedied with its outstanding balance shown when the hub cannot deliver;
- every simulated element is labeled in the receipts.

This rehearsal proves the registration window and issuer approval, not the claimant's agreement
to an exact voucher revision. The claimant neither accepts a revision nor signs its hash under
these defaults. The report must label exact-revision claimant consent **unproved**, separately from
M1's steward approvals, until PRD-1315 selects a binding mechanism and that mechanism is exercised.
This limitation does not expand the approved fork scope.

This bounded rehearsal also leaves voucher-accepting Offer payment funding and distinct gardener
issuer identity unproved. Its reserve transfers are earned rewards, and its two organizational
issuers use `issuerGarden`; neither exercises the later claimant-funded or per-gardener design.
Keep those limits in the report alongside consent, issuer-cap enforcement and the live handshake.

## Decided inputs: do not reopen

**Architecture**, accepted by Afo on 20 October as the PRD-1315 candidate: a new Arbitrum voucher
entitlement module and a new Gnosis voucher issuance adapter, reused Cosmo-Local (CLC)
implementations, the G$ rail untouched, and **no change** to CommitmentPooling, its libraries,
SettlementModule, its libraries, CeloSettlementExecutor or CommitmentRegistry. Read sections 1, 5
and 6 and findings F1, F3, F4 and F7 of [the review](claude-architecture-review-results.md).

**Rehearsal defaults**, adopted by Afo on 20 October:

| # | Decision | Rule for this rehearsal |
|---|---|---|
| 1 | Eligibility | Any commitment whose `getCommitment(id).state` is `Fulfilled` qualifies, whatever path fulfilled it. The module does not gate on the confirmation path. The report shows the path from the `CommitmentFulfilled` event and never relabels a fallback or dispute-resolved fulfillment as beneficiary-confirmed. |
| 2 | Issuer budget | The issuer Safe mints a reserve to itself and approves the adapter for a bounded allowance. The adapter delivers with `transferFrom`. It holds no writer, limiter or pool role. |
| 3 | Allocation | One recipient per commitment, derived at dispatch and never supplied: the commitment's `leadProvider`, the person who did the work. See assumption A3 for Requests that a garden claims. |
| 4 | Purchases | Supporters buy with the issuer pool's bounded six-argument `withdraw(tokenOut, tokenIn, value, recipient, minAmountOut, deadline)` from inventory the issuer deposited. There is no purchase message and no off-chain receipt path. These are issuer vouchers outside the PRD-796 wrap boundary, so there is no purchase entitlement to replay. |
| 5 | Acknowledgments | No return CCIP lane. The Arbitrum module records Dispatched; the adapter's stored result on Gnosis is the delivery truth, read by the tests now and by the indexer later. |

**Live-only gates.** Both use labeled stand-ins in the fork and are never presented as live:

- *Member accounts:* the Kernel WebAuthn validator `0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd` has
  no code on Gnosis, and a simulated `createAccount` there reverted with `InitializeError()`
  (10 October read). Copy the validator's runtime code from the Arbitrum fork and `vm.etch` it at
  the same address on the Gnosis fork, labeled "validator stand-in". The Safe-signed member
  fallback that PRD-1096 names belongs to this gate; do not design it here.
- *Proxy admin:* every Cosmo-Local proxy uses a labeled test admin that differs from the owner. No
  timelock delay or Safe signer set is chosen here.

## What PRD-1096 asks and how this rehearsal answers it

| PRD-1096 Done-when (live text, 20 October) | Cases | Reading under the defaults |
|---|---|---|
| Earned issuance checks the agreed fulfillment evidence and confirmer provenance | M1, M6, M8 | Default 1 checks `Fulfilled` and records provenance without gating on it. Gating is PRD-1315 decision 1. |
| Purchased issuance checks a settled purchase entitlement | P1 | Default 4 makes a purchase one atomic swap: payment settles in the same call and no separate entitlement exists. |
| Replays and a new message reusing an entitlement cannot deliver twice | G2, G3, G11 | As written. |
| No limit changes cross chains; caps and allowances are the issuer's | G4, G9, G10 | As written. |
| Season caps and pool holding limits fail safely | G4, G9, P2 | G4 covers short allowance/reserve and repair requeue; G9 covers the adapter season cap and token mismatch; P2 covers the pool holding limit. The issuer's total outstanding-voucher cap remains unproved. |
| A gardener account's same-address derivation and ownership | K1 to K3 | With the validator stand-in. |
| Bounded swaps; exhausted inventory, de-listing, changed quotes and sponsorship failure recover | P1, P3 to P5, P10, K4 | Sponsorship uses a fork-local paymaster (A8). |
| Passkey validator gap rehearsed with a labeled stand-in and the live gap recorded | K2 | The live fix stays a gate. |
| Presentment, full or partial delivery, beneficiary confirmation, discharge once; remedy and outstanding balance | S1 to S6 | Through the service desk (A1). |
| Interfaces from published specifications; fork receipts distinct from live CCIP; swap-back simulated; G$ never a Gnosis rail | Interface headers, L1, P6 | As written. |

Report against this table. The earned-issuance and purchase-entitlement rows read stronger in
Linear than the adopted defaults deliver. If the season-cap row is used to claim the issuer's
total outstanding-voucher cap, that issuer-cap portion also exceeds the proof; G9 does cover the
adapter's season cap. Say so in the report and leave any Linear change to Afo.
Completion of this bounded rehearsal does not close the claimant-consent,
issuer-cap or live-handshake decisions.

## Verified facts to build on

Read [the conformance evidence](claude-conformance-evidence-2026-10-20.md) for method and hashes.

| Item | Value | Status |
|---|---|---|
| GiftableToken implementation | `0x34445d13F112A11f72C1d353a7dcdc407F3df2d8`, runtime keccak `0x074980d5e0e6bfb3afd2faa9f828cf65d65ae7ed568f65b2623fa61190e95d91` | Matches the published v1.0.0 artifact at Gnosis block 48848261 |
| SwapPool implementation | `0x9e694D342Cab02e295262B2290b0E64A0334160D`, runtime keccak `0xc353aac7dd541d1c50c7eeb20a15a44ea9f93524f23a26217a557667ddd87847` | Matches |
| Limiter implementation | `0x258AAd6c933F70D7F071E112800a41Fb60434048`, runtime keccak `0x4703592f66925654d50872a319602d2ec144698515abc9e4df00c36d5b4a3d32` | Matches |
| ERC1967Factory (Solady, MIT) | `0xB286994c648F98fD3a3BA6C43934828a5b88162b`, runtime keccak `0x2e06e9a024d7bd35356833e6fcb9f34c1fbdae8bbd91da3bc55e4cc2ba4d1230` | Matches |
| FeePolicy and TokenUniqueSymbolIndex implementations; DecimalQuoter instance | `0x1b97FfFAF2D2e16C8F7de6826F4F658dc898E5b6`, `0x0CEB18BA6562D3227717D98c044A5849bE8362EF`; `0x336f493d5472FD59e9E05128804E2D05Be89c4B7`, stateless and not a proxy | README table. Not yet checked: compute and record their hashes the same way before use |
| CCIP routers | Arbitrum `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8` (selector `4949039107694359620`); Gnosis `0x4aAD6071085df840abD9Baf1697d5D5992bDadce` (selector `465200170687744372`) | Router 1.2.0 and OnRamp 2.0.0 both ways at Arbitrum block 516507430; `EVMExtraArgsV1` quoted both ways |
| Arbitrum fork block | `ARBITRUM_FORK_BLOCK_NUMBER`, default 466388412 in `script/utils/fork-shards.mjs` | At that block the router reaches Gnosis through `EVM2EVMOnRamp 1.5.0` (read 20 October). Simulated transport is unaffected; record the version |
| Gnosis RPC | `https://rpc.gnosischain.com` | Served state at block 48848261 on 20 October, about 11,300 blocks later. Archive retention is not guaranteed |
| WXDAI | `0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d` | Assert `symbol()` on the fork |
| Kernel v3.1 on Gnosis | factory `0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419`, ECDSA validator `0x845ADb2C711129d4f3966735eD98a9F09fC4cE57`, EntryPoint v0.7 `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | 10 October read; re-check on the pinned fork |

## Assumptions to confirm (Afo)

These go beyond the five defaults. The draft assumes each one; change any before dispatch.

- **A1. Presentment and discharge use a new `VoucherServiceDesk`**, following the 10 October research
  design. The alternative is an off-contract rehearsal: the holder sends units to the issuer Safe
  and delivery is confirmed through a Green Goods Request commitment, which links voucher units to
  the service record only through the indexer. Decided 21 October: the live design replaces the
  desk with presentment as a Green Goods promise, so keep the desk minimal; it is a fork-only
  stand-in.
- **A2. Terms authority:** a steward of the pool's garden registers voucher terms and a steward of
  the issuer's garden approves each revision, both before acceptance. This mirrors the core rule
  that only a pool steward edits G$ terms before acceptance. There is no per-season budget or
  reservation on Arbitrum in this slice; the Gnosis allowance is the hard budget.
- **A3. Requests that a garden claims are refused at registration.** Their `leadProvider` is only
  the steward who claimed for the garden, which is why `recordConsiderationPaid` names the garden
  there, and the garden's account does not exist on Gnosis. A Request's `claimType` is fixed at
  creation and every claim must match it, so the refusal is final before acceptance.
- **A4. The contracts are production-intent** (UUPS proxies, paused at initialize, storage gaps,
  custom errors) but exist only on forks. Storage-layout baselines and deployment tooling wait for
  PRD-1319 and PRD-1325.
- **A5. The fork test gets its own shard, added to `SHARD_ORDER`.** `fork-shards.mjs check` counts
  only shards in `SHARD_ORDER`, so a fork file outside them fails coverage. CI names its fork shards
  explicitly, so it does not run the new one. No workflow or `env.schema` change. The alternative
  is the `settlement-lane` glob, which CI fork readiness runs after every push to `develop`.
- **A6. Passkey ownership by a signed WebAuthn user operation is a stretch.** A signed user operation
  from an ECDSA-validator Kernel account is required as the control.
- **A7. The issuer's fallback delivery**, which PRD-1318 and PRD-1326 require, is an owner-only
  adapter call that applies every check the lane applies except transport authentication. It
  stores its result under the key the lane would use, and the deadline and pause still apply.
- **A8. Sponsorship failure is rehearsed with a fork-local paymaster** that refuses. Recovery is the
  same action as an unsponsored user operation from an xDAI-funded account. No Pimlico policy or
  production paymaster is chosen here.

## Scope

In scope, all under `packages/contracts/` unless noted:

- `src/interfaces/ICosmoLocal.sol`: hand-written interfaces, one per Cosmo-Local contract used and
  flat like `IGardensV2.sol`, with only the functions the rehearsal calls. `src/interfaces/IERC1967Factory.sol`
  for Solady's factory.
- `src/libraries/VoucherMessageCodec.sol`, beside `SettlementMessageCodec.sol`;
  `src/modules/VoucherEntitlementModule.sol` (Arbitrum); `src/modules/VoucherIssuanceAdapter.sol` and
  `src/modules/VoucherServiceDesk.sol` (Gnosis); their interfaces in `src/interfaces/`.
- Unit tests in `test/unit/` for each new contract; one fork test,
  `test/fork/CosmoLocalVoucherRehearsal.t.sol`; a Gnosis entry in `test/fork/helpers/ForkTestBase.sol`;
  shared fork helpers extracted rather than copied.
- `script/utils/fork-shards.mjs`: the new shard (A5) and two Gnosis defaults.
- The ontology sidecar entries for any new public enum, per `.claude/context/ontology.md`.
- A dated report under `.plans/backlog/cosmo-local-credit-interop/reports/`.

Out of scope: the G$ leg and the dual-reward journey (PRD-1326); the acknowledgment lane and
stranded-subject close-out that PRD-1317 keeps, both deferred by default 5; the indexer (PRD-1320);
Shared and apps (PRD-1321 to PRD-1324); deployment tooling and `networks.json` (PRD-1325); the
Safe-signed member fallback; a production paymaster; off-chain purchase receipts; G$ on Gnosis; and
any change to deployed Green Goods contracts.

## Design rules

### Cosmo-Local interfaces (clean room)

- Allowed sources: `README.md`, `docs/SPEC.md` and `docs/DEPLOY.md` of `cosmo-local-credit/protocol`
  at commit `ce090fd3d5a7493c726fb939da39af15ef1c9d7c`; the published `pkg/publish/contracts/*/*.bin`
  build artifacts, for code hashes only; public chain data; public 4-byte signature databases.
- Never open that repository's `src/`, `test/` or `pkg/publish/**/*.go`, or any explorer source
  endpoint. Do not vendor or import its code. Solady's factory is MIT; hand-write
  `deployAndCall(address implementation, address admin, bytes data)` and `adminOf(address proxy)`.
- SPEC names parameters but rarely their types. Settle types only from SPEC and DEPLOY (DEPLOY
  shows `seal(uint8)`, for example), from selectors in public Gnosis transactions such as the
  protocol's own factory deployments, or by probing the deployed implementations on the fork. Test
  every interface call against the fork; a wrong type shows up as a selector mismatch.
- `SwapPool.withdraw` has five overloads: three swaps and two fee collections. Declare the
  six-argument bounded swap explicitly and use no other swap form.
- Each interface names the SPEC section it follows and the pinned commit.

### VoucherMessageCodec

A frozen version-1, data-only command: `version, entitlementId, commitmentId, termsHash,
voucherToken, recipient, amount, seasonId, deadline, attempt`. It is separate from
`SettlementMessageCodec` and never shares its version space.

### VoucherEntitlementModule (Arbitrum)

Follow the SettlementModule and Celo executor shells: UUPS; router and chain selectors pinned in the
constructor; `initialize` leaves it paused; owner-only configuration while paused; a storage gap;
custom errors; an event for every transition. It custodies nothing except native fees, with a fee
reserve floor like SettlementModule's `feeReserveMinimum`.

- Dependencies: the CommitmentPooling module and HatsModule. It reads `getCommitment` and `getPool`.
- Configuration (owner): `setIssuer(issuerGarden, voucherToken, destinationAdapter)` binds an
  Arbitrum issuer garden to its Gnosis token and adapter, so terms can never name an arbitrary
  token; plus route (destination selector, gas limit, command validity window), fee reserve minimum
  and pause.
- Terms can be registered or issuer-approved only while the commitment is `Offered` or
  `Requested`; otherwise revert with the actual state.
  - `registerVoucherTerms(commitmentId, issuerGarden, units, seasonId, termsCID)` by a steward or
    owner hat wearer of `getPool(commitment.poolId).garden`, the test in
    `CommitmentPoolingGuardLib.isGardenSteward`. Refuse a Request whose `claimType` is `Garden`
    (A3). Registering again before acceptance increments the terms revision and clears any approval.
  - `approveVoucherTerms(commitmentId, termsRevision)` by a steward or owner hat wearer of the
    issuer garden. Naming the revision stops an approval from attaching to edited terms. Approval
    snapshots the issuer's current voucher token and destination adapter into that revision.
    Dispatch, retry and requeue use only the snapshot, so a later `setIssuer` change applies to
    later revisions only and can never send one entitlement to a second adapter.
- `dispatch(commitmentId)` by a steward of the pool garden or the issuer garden. It requires state
  `Fulfilled`, approved terms and no earlier dispatch. It derives `recipient = leadProvider`,
  `entitlementId = keccak256(abi.encode(block.chainid, address(this), commitmentId, termsRevision))`,
  `executionKey = keccak256(abi.encode(sourceSelector, address(this), entitlementId, attempt))` and
  `deadline = block.timestamp + validity`. It stores the payload and its hash, pays the exact quoted
  fee and records Dispatched.
- `retry(commitmentId)` resends the stored payload byte for byte, same execution key.
  `requeue(commitmentId)` starts a new attempt with a fresh deadline after an operator has read a
  Failed result on Gnosis. Both are steward-only. Requeue is safe by construction because the
  adapter consumes entitlements, not attempts.
- Pause blocks registration, approval, dispatch, retry and requeue before any state change, fee
  spend or message send, following `Settlement/Lifecycle.sol`'s `_requireNotPaused()` guards.
- No receive path in this slice (default 5). Do not add `ccipReceive`.

### VoucherIssuanceAdapter (Gnosis, one per issuer)

Follow the order in `CeloSettlementExecution._ccipReceive` and `_authenticate`
(`src/modules/CeloSettlement/Execution.sol`).

- Router and local selector pinned in the constructor. `initialize(owner, sourceSelector,
  sourceModule, voucherToken, reserveHolder)` leaves it paused. The owner is the issuer Safe.
- Revert when paused, when tokens are attached, on a wrong source selector, on a sender other than
  the current peer or an unexpired previous peer, on an unsupported version, or on a malformed
  command (decode through an external try/catch boundary like `decodeSettlementCommand`).
- `executionKey = keccak256(abi.encode(message.sourceChainSelector, sender, entitlementId,
  attempt))`. If a result already exists, emit a duplicate event and transfer nothing.
- Otherwise store a result, then check in order: token matches, deadline not passed, entitlement
  not consumed, recipient and amount non-zero, season cap if set. Execute the transfer and its
  balance check together in an external, self-only helper, called through try/catch as in
  `CeloSettlementExecution.executeGdollarSettlementBatch`. The helper calls
  `transferFrom(reserveHolder, recipient, amount)`, requires a successful token return and reverts
  if the recipient's balance did not rise by exactly `amount`. A failed transfer or balance check
  rolls back the entire helper call, including token balances and allowance spending. Only after
  the helper succeeds, mark the entitlement consumed, count the season spend and store Success.
  Preflight failures and caught helper failures store Failed with the matching code and leave the
  entitlement and season spend unchanged. The outer handler does not revert for these business
  failures; a requeue is safe because a failed helper moved no tokens.
- `deliverByIssuer(bytes payload)`, owner only (A7): decode as the lane does, compute the key from
  the configured source selector and source module, then follow the same result-first order and
  checks. A later lane message for the same attempt is a duplicate, and a requeued attempt stores
  `EntitlementConsumed`. Each stored result records its path, lane or issuer fallback, so the report
  never presents a fallback as a lane delivery.
- Owner configuration while paused: peer rotation with a grace window capped at 30 days, copied
  from `CeloSettlementAdmin.setSourcePeer`; an optional season cap; pause.
- Failure codes: `None, TokenMismatch, Expired, EntitlementConsumed, InvalidRecipient, ZeroAmount,
  SeasonCapExceeded, TransferFailed, BalanceDeltaMismatch`.

### VoucherServiceDesk (Gnosis, one per issuer; A1)

- The issuer Safe owns it and sets an operator, the hub.
- `present(units, serviceRef)` by a holder pulls the units with `transferFrom` and opens a
  presentment. `markDelivered(id, deliveredUnits)` by the operator, at most the presented units.
  `confirmReceipt(id)` by the holder requires a positive recorded delivery, records the beneficiary
  confirmation and discharges once: delivered units go to the issuer Safe and the rest return to
  the holder. With no recorded delivery or zero delivered units, confirmation reverts without
  changing balances or closing the presentment. `remedy(id, reasonRef)` by the operator before
  confirmation returns every unit, including when no service was delivered.
- Views report each open presentment's undelivered units and the desk's total outstanding units.
  Every transition emits an event.
- Any second transition on a closed presentment reverts. The desk never mints or burns. SPEC lets
  only the token owner burn, and only from its own balance, so the Safe may later burn what it
  received at discharge.

### Cosmo-Local instances on the Gnosis fork

No new code: configuration through the published factory and implementations.

- Two issuers with neutral test names, a hub and Green Goods. Each has a token, limiter, fee policy,
  token index and pool, created with `deployAndCall`; both pools use the deployed DecimalQuoter.
  Owner: the issuer Safe stand-in; use a 1-of-1 test Safe if `test/fork/CrossChainGardenSafeOwner.t.sol`
  makes that cheap, otherwise a labeled test owner. Admin: the labeled test admin.
- Token: 6 decimals as in DEPLOY's example (COM-46 sets the real unit), `expiresAt` 0.
- Index: register every token a pool accepts. The hub pool accepts its own voucher, the Green Goods
  voucher and WXDAI. The Green Goods pool accepts both vouchers and no WXDAI, because Green Goods
  vouchers have no cash-out.
- Limiter: a limit of 0 blocks deposits, so set a non-zero limit for every accepted token after the
  pool proxy exists. The other issuer's voucher gets 500 units (a labeled proposal); size the rest
  to the test.
- Fee policy: default fee 0. On the hub pool, set the hub-voucher-to-WXDAI pair fee to 240000 parts
  per million, the 24% swap-back Tech and Sun proposed, labeled "simulated swap-back". Pair fees are
  direction-sensitive.
- Pool: DecimalQuoter parity (a labeled proposal), fee address the Safe, fees decoupled, no protocol
  fee controller. Seal the registry and limiter bits (`seal(24)`) after wiring and record the seal
  state.
- Each issuer Safe mints its reserve, approves the adapter's allowance, and approves and deposits
  pool inventory. It approves nothing else.
- This rehearsal does not prove the curated, capped issuance rule decided on 21 October. An
  issuer's outstanding-voucher cap is distinct from a pool's holding limit and from the adapter's
  allowance, and nothing here checks reserve minting or pool deposits against it. The report marks
  issuer-cap enforcement as unproved and leaves its proof to PRD-1318.

### Arbitrum side, transport and accounts

- Drive fresh commitments to `Fulfilled` with the full-stack fork harness: `ForkTestBase` and the
  flow in `test/fork/ArbitrumCommitmentPooling.t.sol` (`_deployFullStackOnFork`,
  `_setupGardenWithRolesAndAction`, real Work and approval attestations). Register and approve terms
  before acceptance, then claim, work, approve and confirm. Cover an Offer and a Request that an
  individual claims. Use a second test garden as the hub issuer garden.
- Forks: Arbitrum is the shard's process fork, resolved as `ForkTestBase._tryChainFork` does.
  Create the Gnosis fork with `vm.createFork` from `GNOSIS_RPC_URL` and `GNOSIS_FORK_BLOCK_NUMBER`,
  resolved the same way, and add chain id 100 to `_expectedForkChainId`. If the endpoint no longer
  serves the pinned block, use an archive endpoint or re-pin to a recent block and re-assert every
  code hash there; record which.
- Transport is simulated and labeled. On Arbitrum, use the real router's `getFee` and `ccipSend`,
  record the on-ramp's `typeAndVersion` at the fork block, then read the stored payload from the
  module. On Gnosis, `vm.prank` the real Gnosis router and call the adapter's `ccipReceive` with a
  constructed `Client.Any2EVMMessage` carrying the sent message id, the Arbitrum selector, the
  abi-encoded module address and the stored payload.
- Accounts: show `KernelFactory.getAddress` returns the same address on both forks for one passkey
  init data; show `createAccount` reverts on Gnosis without the stand-in and succeeds with it; run
  the member actions from that account; run the ECDSA control through EntryPoint `handleOps` with a
  signed user operation.
- Sponsorship (A8): a fork-local paymaster labeled "simulated paymaster" refuses in
  `validatePaymasterUserOp`. Show the sponsored operation fails in `handleOps`, then the same action
  succeeds unsponsored from an xDAI-funded account.

### Tests

- Unit tests prove the logic in process. Reuse `SettlementPayerMockHats` and
  `SettlementPayerMockPooling` from `test/unit/SettlementPayer.t.sol`, `MockERC20` from
  `src/mocks/ERC20.sol`, and the `AsynchronousSettlementRouter` pattern from
  `test/integration/CCIPSettlement.t.sol`.
- The fork test proves wiring against real contracts and skips loudly when either RPC is missing,
  as `test/fork/CrossChainSettlementLane.t.sol` does. Do not repeat unit assertions in it.
- Add the shard `cosmo-voucher-rehearsal` to `SHARDS` in `script/utils/fork-shards.mjs` (chain
  `ARBITRUM`, glob the fork file) and to `SHARD_ORDER` (A5). Add `GNOSIS_RPC_URL:
  "https://rpc.gnosischain.com"` and `GNOSIS_FORK_BLOCK_NUMBER: "48848261"` to `DEFAULTS`.
- Follow the [test budget](../../../../.claude/context/testing.md#test-budget): each test names the
  failure it catches. The lane requires TDD: write the failing tests first and record RED and GREEN
  with `node scripts/harness/plan-hub.mjs record-tdd --feature cosmo-local-credit-interop --lane
  contracts ...`, then run `bunx biome format --write` on `status.json`.

## Required cases

**Arbitrum module**

| Case | Expected |
|---|---|
| M1 | Terms registered and issuer-approved before acceptance; after `Fulfilled`, one dispatch sends one command to the configured adapter with `recipient = leadProvider`: the creator for an Offer, the claimant for an individually claimed Request. Steward approval does not prove the claimant's exact-revision consent. |
| M2 | Register or approve after acceptance reverts. |
| M3 | Register by a non-steward of the pool garden, approve by a non-steward of the issuer garden, or an unconfigured issuer garden reverts. |
| M4 | Editing terms before acceptance bumps the revision and clears approval; approving an old revision reverts. |
| M5 | Registering terms on a Request whose `claimType` is `Garden` reverts (A3). |
| M6 | Dispatch before `Fulfilled`, without approved terms (including a fulfilled commitment that never had terms), or after cancellation or expiry reverts. |
| M7 | A second dispatch reverts; retry resends the identical payload under the same key; requeue is steward-only and increments the attempt. |
| M8 | Fulfillment through `PoolFallback`, `ProtocolFallback` and dispute resolution all qualify (unit test with the mock pooling module). |
| M9 | The exact quoted fee is paid and the reserve floor holds; pause blocks register, approve, dispatch, retry and requeue before any state change, fee spend or message send; the module holds no tokens. |
| M10 | Changing the issuer mapping after approval leaves the approved revision's token and destination unchanged for dispatch, retry and requeue; no entitlement reaches a second adapter. |

**Gnosis adapter**

| Case | Expected |
|---|---|
| G1 | An authenticated command moves `amount` from the reserve to the recipient; result Success; entitlement consumed. |
| G2 | The same message delivered twice: the second is a duplicate and transfers nothing. |
| G3 | A requeued attempt for a consumed entitlement stores `EntitlementConsumed` and transfers nothing. |
| G4 | Short allowance or reserve stores `TransferFailed` and leaves the entitlement unconsumed; after the Safe raises the allowance or replenishes the reserve as appropriate, a requeue delivers once. |
| G5 | An expired deadline stores `Expired`; a requeue with a fresh deadline delivers. |
| G6 | Wrong selector, wrong sender, attached tokens, unsupported version or malformed payload reverts. |
| G7 | A paused adapter reverts, for the lane and for the issuer fallback. |
| G8 | The previous peer is accepted through and including its grace expiry timestamp, and refused strictly after it. |
| G9 | A set season cap stores `SeasonCapExceeded` when exceeded; a token mismatch stores `TokenMismatch`. |
| G10 | The adapter is not a writer of the token or limiter, does not own the pool and holds no balance of its own. |
| G11 | The issuer fallback delivers a stored command once; the same attempt arriving later over the lane is a duplicate; a requeued attempt stores `EntitlementConsumed`; a non-owner call reverts; the result names the fallback path. |
| G12 | Delivery to a member's counterfactual account address, with no code on Gnosis, succeeds. |
| G13 | A token that moves funds but returns false, or whose transfer produces a recipient balance delta other than `amount`, stores `TransferFailed` or `BalanceDeltaMismatch` respectively. The helper rolls back balances and allowance spending; the entitlement and season spend stay unchanged. Cover lane delivery and issuer fallback: repeated requeues under the mismatch move no tokens, and a requeue after repair delivers exactly once. |
| G14 | After same-version A-to-B peer rotation with grace, a new B-to-C rotation before or exactly at A's expiry reverts `PreviousPeerGraceActive` with peer/expiry state unchanged. At expiry plus one second, rotation is allowed, B becomes the previous peer under its new grace and A is rejected. A same-active-peer update retains the previous peer: zero grace leaves its expiry unchanged, a valid extension is allowed and an attempted shortening reverts. Use the referenced Celo admin's paused-owner transition. |

**Pools and exchange (Gnosis fork)**

| Case | Expected |
|---|---|
| P1 | A supporter buys hub vouchers with WXDAI through the bounded swap, delivered to a learner; minimum output and deadline are enforced; inventory falls by the amount received. |
| P2 | A member swaps between the two vouchers at parity within the 500-unit limit; a deposit over the limit reverts `LimitExceeded`. |
| P3 | A minimum above the quote reverts `InsufficientOutput`; a passed deadline reverts `Expired`. |
| P4 | After the index's `remove(token)`, the voucher cannot be swapped in either direction, while wallet transfers still work. |
| P5 | Exhausted inventory reverts `InsufficientBalance`. |
| P6 | The simulated swap-back charges the 240000 parts-per-million pair fee and no protocol fee. The report shows the recipient's actual output and every configured fee, and notes that live pools may add a protocol fee. |
| P7 | `setTokenRegistry` and `setTokenLimiter` revert `Sealed`; the owner's `withdrawLiquidity` still works and is disclosed in the report. |
| P8 | `expired()` is false and `applyExpiry()` changes nothing with `expiresAt` 0. |
| P9 | The factory's `adminOf` each proxy is the test admin, which differs from the owner. |
| P10 | After a quote, the owner raises a pair fee: the bounded swap with the old minimum reverts `InsufficientOutput`, and a fresh quote and swap succeed. |

**Service desk, accounts and labels**

| Case | Expected |
|---|---|
| S1 | Present, deliver fully, confirm: the units reach the issuer Safe and the presentment closes. |
| S2 | Partial delivery then confirmation: delivered units reach the Safe and the rest return to the holder. |
| S3 | Remedy before confirmation returns every unit. |
| S4 | A second confirmation or remedy on a closed presentment reverts; only the operator delivers or remedies and only the holder confirms. |
| S5 | The desk reports undelivered units while a presentment is open, and the report shows the issuer's outstanding supply (total supply minus the Safe's balance) before and after S1 to S3. |
| S6 | Confirmation before any `markDelivered`, or after recording zero delivered units, reverts with balances unchanged and the presentment still open; no confirmation or discharge event is emitted. The operator can still remedy it and return every unit. |
| K1 | The passkey account address is the same on both forks. |
| K2 | `createAccount` reverts on Gnosis without the stand-in, reproducing the live gap, and succeeds with it. |
| K3 | Member actions run from that account; the ECDSA control completes a signed user operation through EntryPoint. |
| K4 | A sponsored operation refused by the simulated paymaster fails; the same action succeeds unsponsored. |
| L1 | Every report row carries "fork", "simulated transport", "validator stand-in", "test admin", "simulated swap-back", "simulated paymaster" or "issuer fallback" wherever it applies. |

## Work order

Risk first. Phases 1 to 4 are the minimum for the 23 October update; later phases may carry over.

1. Interfaces and conformance: write the interfaces, pin the code hash of every implementation and
   instance used, and prove each interface call on the Gnosis fork.
2. Codec and adapter with G1 to G11 and G13.
3. Module with M cases.
4. Fork rehearsal of earned issuance end to end: G1 to G5, G11 and G12 across both forks.
5. Pools and exchange, P cases.
6. Accounts and sponsorship, K cases.
7. Service desk, S cases.
8. Report, TDD records and lane status.

## Validation

From `packages/contracts`:

```bash
bun run test --suite solidity --profile match -- test/unit/VoucherIssuanceAdapter.t.sol
bun run build --mode target -- src/modules/VoucherIssuanceAdapter.sol
bun run check:sizes
bun run lint
bun script/utils/fork-shards.mjs check
bun script/utils/fork-shards.mjs run cosmo-voucher-rehearsal
```

Repeat the first two for each new test file and source file. From the repository root, run
`bun run check --plan -- --intent checkpoint`, execute what it selects and keep the contracts
critical override. After adding sidecar entries, follow the change protocol in
`.claude/context/ontology.md` and run `bun run check --only ontology`. That gate verifies only
vocabularies already declared in the sidecar; it does not discover a new enum, so declaring each one
is a repository rule the gate cannot enforce.

## Boundaries

- Contract source is the critical tier: read every line you touch and keep the full critical
  override the selector reports.
- Forks only: no broadcast, no deployment to any live network, no live CCIP send, no transaction on
  any network.
- Do not change deployed Green Goods contracts or their libraries, deployment artifacts,
  `networks.json`, `env.schema`, the root `.env`, CI workflows, manifests or lockfiles. Install no
  dependencies.
- G$ never appears on the Gnosis fork; the G$ rail stays on Arbitrum and Celo.
- Public repository: neutral test names; no partner contact details, no Cosmo-Local App operator
  addresses or migrated pool names, no private messages.
- Commit on the lane branch only. Do not push, open a pull request or write to Linear unless the
  dispatch message grants it.
- Use the `pragmatic-programming` and `domain-driven-design` skills, the contracts guide
  (`packages/contracts/AGENTS.md`) and `.claude/context/contracts.md`.

## Stop conditions

- **Complete:** every required case passes in its unit or fork run, sizes and lint pass, the shard
  coverage check passes, the selector's checks pass, RED and GREEN are recorded, and the report is
  written.
- **Stop and return to Afo:** a pinned code hash does not match; a needed function or type cannot
  be settled from the allowed sources; any change to a deployed Green Goods contract looks
  necessary; a decision arises beyond the five defaults and A1 to A8; or the RPC endpoints or the
  sandbox block the fork runs.
- **Carryover:** at the 23 October checkpoint, write the report with what passed and what remains.
  Do not widen scope to finish.

## Report

Write `.plans/backlog/cosmo-local-credit-interop/reports/prd-1096-rehearsal-<YYYY-MM-DD>.md` with:
fork blocks, RPC endpoints and the Arbitrum on-ramp version; implementation and instance addresses
with their pinned code hashes; fork-local instance addresses; owner, admin, writer, limit, fee and
seal state; each command with its pass count; the case table with results; the PRD-1096 table above
with each row's evidence; outstanding supply before and after the service cases; the label legend;
what stays live-only or unproved: issuer-cap enforcement, exact-revision claimant consent
(not proved by registration or issuer approval), the live escrow-to-promise handshake,
claimant-funded Offer payments and distinct gardener issuer identity/cap isolation; and a short update Afo can post to
PRD-1096. End with the task record:

```markdown
Task record: PRD-1096 voucher rehearsal | Type: feature | Outcome: <complete/partial/blocked>
Agent/model: <observed agent/model or unknown> | Coverage: <this segment>

| Phase | Start to end (UTC) | Result / evidence or blocker |
|---|---|---|
| implement | <timestamps> | <commits> |
| verify | <timestamps> | <commands and pass counts> |

Human corrections: <count or unknown>; attention: unknown.
```
