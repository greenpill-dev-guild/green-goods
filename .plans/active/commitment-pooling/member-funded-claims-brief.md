# Member-Funded Claims with Refund — Design Brief (Option B)

**Feature Slug**: `commitment-pooling` (companion brief)
**Status**: approved for the reopened release increment by decision register #103; implementation
remains blocked on the Phase 1–3 review checkpoint
**Created**: 2026-08-11 (founder request after the architecture-realignment review)
**Companions**: `contract-spec.md` (commitment lifecycle, claim machinery, consideration model),
`settlement-spec.md` (payout plans, disbursement lifecycle, command/ack rail),
`.plans/active/commitment-credit-follow-on/spec.md` (the closest recent increment in shape and size)

## 1. The goal, in one story

Maria fulfills a commitment from her garden's pool and earns 40 G$. Ben, another gardener in the
same pool, has a steward-approved Offer: design work, priced at 40 G$. Maria wants to claim it,
**put her 40 G$ in, give up custody of it while the promise is live, and get it back if Ben never
delivers**. When Ben fulfills, he is paid from what she put in.

This is the circulation loop — earn from the pool, spend back into the pool — made first-class.
GoodDollar confirmed on 2026-08-08 that they want to see circulation happen; today the loop is
only possible as steward-coordinated bookkeeping that the protocol neither enforces nor records.

The semantics being asked for are **escrow semantics**: deposit, hold, conditional release,
refund. This brief designs them without adding any new custody surface.

## 2. The posture: garden-Safe custody, sequencing over locks

Two architecture facts shape the design:

1. **Fulfillment truth lives on Arbitrum; G$ lives on Celo.** They talk only through the
   authenticated command/acknowledgment rail. "Held until fulfilled" therefore means *something on
   Celo holds the funds and moves them only when the rail says so*.
2. **The system already trusts exactly one thing with custody**: the garden's registered Celo Safe
   — write-once registration, 2-of-3 recovery, spendable only through the bounded, capped,
   Zodiac-scoped canonical-G$ route.

Option B uses that existing custodian. Maria's deposit goes **into the garden Safe, earmarked
against the commitment**. Release to Ben is the existing payout machinery. Refund to Maria is a
new disbursement kind that runs through the identical command → Celo execution → authenticated
acknowledgment rail, with the same caps, idempotency, and only-a-receipt-confirms rules.

What this is *not*: trustless escrow. Maria trusts the same steward-accountable, recoverable Safe
the whole system trusts. The trustless version (a dedicated escrow vault holding member funds) is
deliberately out of scope here — it is the full value-tier surface (external audit, timelock,
soak) and belongs to the gated bounded-pool stage (D29) if evidence ever demands it.

## 3. The flow

1. **Ben's Offer exists and is priced.** Unchanged: the steward declares the G$ consideration
   pre-acceptance (records-only, `CeloSettlement` rail, source/token derived — never a wallet).
2. **Maria files the claim herself.** The approval-gated claim machinery already implements
   request → steward decision. Delta: a member may *request* a priced Offer — the
   `PricedOfferClaimRequiresSteward` gate moves from request-time to **accept-time**. Nothing is
   committed by a request.
3. **A funding record is pledged.** Filing the claim on a priced Offer creates a
   `CommitmentFunding` record: funder, expected amount, refund account, state `Pledged`. The app
   shows Maria the garden Safe address and exact amount.
4. **Maria deposits.** An ordinary Celo transfer from her wallet to the garden Safe. The steward
   (or the app, reading the Safe balance client-side) records the deposit reference on the funding
   record → state `DepositRecorded`. Recording is a records-only act, like every consideration
   fact in the system.
5. **The steward accepts the claim.** Operational rule: accept only after `DepositRecorded` (or
   knowingly front it from the Safe). Acceptance marks the funding `Consumed` — the commitment now
   carries "funded by Maria, 40 G$, tx X" as indexed fact. **Deliberately not an on-chain gate**:
   pooling never reads settlement state (layering runs contracts → settlement-reads-pooling, and
   this brief preserves that direction), so the deposit check is a steward checkpoint, not a
   contract dependency. The refund right below does not depend on it.
6. **The promise runs its ordinary life.** Nothing else changes: roster, evidence, confirmation.
7. **Terminal state resolves the money — mechanically:**
   - **Fulfilled** → the existing payout plan pays Ben from the garden Safe. Already built.
   - **Cancelled / Expired / dispute resolved to Cancelled or Expired** → the funding becomes
     **refund-eligible**. A refund disbursement (new `DisbursementKind.Refund`) is queued to
     Maria's recorded refund account, executes over the existing rail, and is `Confirmed` only by
     the authenticated acknowledgment. One refund per funding record, ever; requeue-on-failure and
     cancellation follow the standard disbursement machine (D22) unchanged.
   - **Declined or superseded after deposit** → same refund eligibility. A `Pledged` record with
     no recorded deposit simply closes with nothing owed.

Every trigger is a state the lifecycle already guarantees is terminal and unambiguous; delay
alone never refunds, exactly as delay alone never confirms.

### Funding record state machine

`Pledged → DepositRecorded → Consumed → Closed (fulfilled) | RefundQueued → Refunded`
with `Pledged → Withdrawn/Closed` (no deposit, nothing owed) and
`DepositRecorded → RefundQueued` (declined/superseded/withdrawn after deposit). All states
on-chain except any read-model conveniences; the refund leg reuses the disbursement lifecycle
rather than duplicating it.

## 4. Exact delta inventory

**Contracts (~350–550 new Solidity LOC + ~800–1,200 test LOC):**

- `CommitmentPooling` — move the priced-claim gate from `claimCommitment` to `acceptClaim`
  (~20–40 LOC + tests). No other pooling change; no new pooling storage.
- `SettlementModule` — owns `CommitmentFunding` (money facts live settlement-side, like payout
  plans): storage + `recordFunding` / `recordFundingDeposit` / `queueFundingRefund` (steward-gated,
  eligibility checked via the existing settlement→pooling commitment read), `DisbursementKind.Refund`
  appended last (ordinal-safe; `SourceStranded` precedent; indexer enum has the `UNKNOWN`
  fail-closed member), events (`FundingPledged`, `FundingDepositRecorded`, `FundingConsumed`,
  refund via existing `DisbursementQueued` + relationship), ~6–10 new errors, ERC-7201 storage
  entries + layout baselines (~250–400 LOC).
- `CeloSettlementExecutor` — accept the `Refund` kind on the typed route (per-kind handling
  exists; ~20–40 LOC). This is a Celo-side change → paused executor upgrade path.
- Explicitly zero: no new custody contract, no bridging, no change to caps/recovery/Zodiac scope,
  no change to the confirmation or recognition machinery.

**Indexer (~150–250 LOC + tests):** `CommitmentFunding` entity + handlers, refund-child linkage,
boundary-check update. The deposit itself stays a recorded reference — the
don't-index-raw-G$-transfers boundary is untouched.

**Shared + client (~400–700 LOC):** claim-with-deposit flow (request → deposit instructions →
pending-acceptance → funded chip), refund status surfaces reusing the D23 pattern with calm copy
("held by the garden" / "returned to you" — no banned vocabulary), hooks in shared, en/es/pt
strings.

**Admin (~200–400 LOC):** record-deposit + accept-funded-claim in the steward console; refund
queue action; earmark visibility (spendable = balance − open earmarks).

**Docs/plan-hub cascade (known exactly from this week's realignment):** contract-spec §5.3/§6.1
and settlement-spec §3/§6 sections; permission-table rows; a funding state machine + D20/D22
additions in `diagrams.md` (+ build-script counts); closure-matrices rows — the new events change
the canonical 54-event count, so Matrix A1 and both validator literals move; ontology sidecar
(`funding-state` vocabulary + `DisbursementKind` member) + regenerated docs; acceptance-matrix
rows. Roughly a day of the same gate-driven editing just completed, with the harness now proving
it.

## 5. Time, honestly

Closest comparable: the commitment-credit increment (records-only registry + settlement seam +
indexer + adversarial review cycles) ran spec-to-merged in roughly a week of focused solo+agents
work. This is smaller contract-side but adds an executor delta and a real client UX flow.

| Phase | Estimate |
|---|---|
| Decision + spec + diagrams | 1–2 days |
| Contracts + tests (incl. invariant/fork additions) | 3–5 days |
| Indexer | 1–2 days |
| Client + admin UX (i18n, stories) | 3–5 days |
| Adversarial review + hardening cycles | 2–4 days |
| **Total to release-candidate quality** | **~2–3 weeks calendar** |

**Schedule interaction — the real decision:** riding the current release means reopening the
frozen candidate: re-freeze the ABI, redo storage baselines, re-run the committed-range review,
re-pin phase-a — call it **+3–5 days** on top, and it widens the review the current Critical's
`registerPool` increment would otherwise keep tiny. Landing in **upgrade window 1** (with the
pool-pause candidate, PRD-813) costs none of that and delays the refund right by weeks, not
months. Option A (member claim-requests + funded-by record, no refund machinery) remains
separable as a this-release slice if visible circulation cannot wait.

## 6. Open decision points

1. **Custodian**: garden-Safe custody acceptable for the pilot (this brief), or must it be
   trustless (→ D29 stage, different year)?
2. **Deposit detection**: steward/app-confirmed (this brief) vs automatic Celo-side deposit
   function reporting over the ack rail (fully automatic claims; new Celo surface + message
   machinery — pushes toward the value-tier review).
3. **Refund trigger**: automatic queue on terminal state vs steward-triggered but
   protocol-enforceable (this brief drafts steward-triggered with mechanical eligibility; automatic
   requires a keeper or piggybacking terminal transitions with settlement writes — a layering
   change).
4. **Amount rules**: exact-amount deposits only, or ≥ price with excess treated as garden top-up.
5. **Refund destination**: the depositing address vs the funder's derived same-address account
   (contributor-payout consistency).
6. **Ship vehicle**: reopen this release vs upgrade window 1 (see §5).

## 7. Risks and residuals

- **Safe balance below obligations**: earmarks are accounting, not locks — a garden could spend
  below its refund obligations. Mitigations: earmark-aware spendable display for stewards, the
  existing failed-disbursement requeue machinery (a refund that fails retries like any payment),
  and steward accountability. This is *the* residual that distinguishes B from a trustless vault;
  it must be stated plainly in steward onboarding.
- **Deposit attribution**: a transfer with no recognizable reference needs steward judgment;
  mis-recorded deposits are corrected by the ordinary records-correction posture (new record,
  never rewritten history).
- **Funding races**: two members funding the same Offer — first accepted consumes; the other's
  deposit is refund-eligible by the declined/superseded rule. Needs one UI guard (show "already
  funded") and one test family.
- **Vocabulary/UX**: copy must stay calm and honest ("held by the garden until the promise
  resolves"); no urgency framing; localization in the same change.
