# PRD-1299 design v1: implementation handoff

**Version:** PRD-1299 design v1, 22 October 2026. **Status:** ready for Afo's review. Not approved,
and nothing here authorizes implementation, deployment, a live configuration change or a Linear
update. PRD-1299 owns design approval; PRD-1297 owns the UI implementation that follows;
PRD-1323 (cockpit) and PRD-1324 (app) own the linked voucher and G$ reward slice in 2.1.0. Gui's
member-journey and Portuguese feedback belongs to PRD-1312.

Open [`prototype.html`](prototype.html) in a browser (no build, no server), or the published copy,
[Cosmo-Local Voucher Design](https://claude.ai/artifact/3XWy9GQoAPSsJjikSzomWZ) (artifact version 1,
private until shared). It is generated from
[`src/`](src) by [`build.mjs`](build.mjs), which also writes [`matrices.md`](matrices.md) (every
screen and state, the role and action matrix, decisions, walks) and [`copy-sheet.md`](copy-sheet.md)
(terminology and every string in EN, ES and PT). The rendered evidence and its limits are in
[`evidence/`](evidence/README.md).

## 1. What the design covers

| Area | Member app | Steward cockpit |
|---|---|---|
| Entry | M01 Home, M02 visiting a provider garden, M13 Wallet › Purchases, M16 Promises sheet | S01 provider garden › Promises, S03 buyer garden › Promises, S07 issuer garden › Promises, S12 Community › Members |
| Personal G$ purchase across gardens | M03 offer, M04 garden and consent, M05 Celo send review, M06 purchase status and recovery | S02 guarded approval, S04 deposit attestation, S05 apply deposit, S06 payout, refund and access |
| Voucher service | M07 offer that takes vouchers, M08 setup across two accounts, M09 holder's page, M10 final split | S08 guarded acceptance, S09 split proposal, S10 escrow legs and recovery |
| Holdings and exchange | M12 Wallet › Vouchers, M14 voucher exchange | |
| Linked rewards | M15 request that pays G$ and vouchers, M16 payment terms on rows | S13 rewards in the inspector |
| Issuer policy (proposed) | M07 paused issuer | S11 admit a gardener issuer, S12 caps and recorded pause |

28 screens and 165 states, with loading, empty, unavailable, stale, paused, rejected, delayed,
failure, recovery, offline and permission states where each applies. Ten walks start from real
entry screens; [`matrices.md`](matrices.md#walks) lists them.

## 2. Sources and their status

| Status | Fact | Source |
|---|---|---|
| Approved requirement | 21 October voucher direction: Offers take vouchers, Requests pay in them, presentment opens a promise, curated gardener issuance, "voucher" named with issuer and unit, curated capped issuance | [`spec.md`](../../../spec.md#voucher-direction-decided-2026-10-21); Linear PRD-1315 |
| Approved requirement | Voucher and G$ terms bind at acceptance; one commitment can carry both, with separate receipts | Linear architecture document (20 Oct); PRD-1299, PRD-1323, PRD-1324 |
| Approved requirement | Locked A, B and C: escrow before promise activation; exact consent enforced before core acceptance; one immutable final split per escrow | `handoffs/codex-voucher-reconciliation.md` as summarized in the 22 Oct session brief |
| Approved requirement | Cross-garden personal G$ purchase, as described in section 5 | 22 Oct session brief, summarizing the three `codex-service-access-*` handoffs |
| Approved requirement | Garden-scoped Home; sheets never mix gardens; visiting never switches the active garden; locked card picks | `pwa-interface-simplification/spec.md`; `app-cockpit-unification/spec.md`; design decision log to DL-096 |
| Selected design, not built | The contract inventory in section 3 | 22 Oct session brief |
| Selected design, not built | Member funding states and the payout plan split by recognition | `commitment-pooling/settlement-spec.md` §3 |
| Live today | G$ commitment pooling with Celo settlement (offers, requests, claims, confirmation, payout plans) | Arbitrum and Celo; last snapshot 20 Oct, not refreshed |
| Live today | Cosmo-Local v1.0.0 contracts on Gnosis, deployed by CLC | `handoffs/claude-conformance-evidence-2026-10-20.md` |
| Not implemented | Nothing voucher-related on `develop` (`20d8c812`) or any pushed branch; no cockpit screen calls the existing `recordFundingDeposit` hook | Search of every remote branch, 22 Oct |
| Local only, not inspected | Another session's checkpoint may hold voucher contracts, stories and walkthroughs from the older lifecycle (acceptance before escrow, incremental release). Its presentation was not reused because it could not be read; it is not the target lifecycle | 22 Oct session brief |
| Open | PRD-1197 go or no-go (due 22 Oct); COM-46 issuer terms; PRD-651 release gates unchanged | Linear, read 22 Oct |

**Limits of this reading.** The reconciliation handoff and the three service-access handoffs live
in another session's local checkout and could not be read from this cloud environment. The design
follows the session brief's summary of them. Every place where the exact contract behavior must
be confirmed is marked "confirm" in the notes and in section 10. The committed `spec.md` and
PRD-1315 still record the 20 October no-core-upgrade boundary; the brief's inventory (upgraded
CommitmentPooling and SettlementModule) supersedes them, and that drift is for the contract
session to reconcile, not this one.

## 3. Architecture boundaries and contract inventory

Arbitrum owns promises, parties, consent and authorization. Celo owns G$ custody and transfers.
Gnosis owns vouchers, pool swaps and voucher escrow. Cross-chain messages carry authorization and
results; G$ is never bridged. This inventory belongs in this handoff and in the cockpit's
technical details, never as clutter on member screens (DL-094).

| Contract | Chain | Treatment in this scope | Used by |
|---|---|---|---|
| CommitmentPooling | Arbitrum | Upgraded: opted-in service offers (the personal G$ route on an approval-gated Individual Offer) and the voucher acceptance guard | M03, M04, S01, S02, S08 |
| SettlementModule | Arbitrum | Upgraded: personal G$ funding recorded by the buyer garden; exclusive payout or refund | M06, S03 to S06 |
| VoucherEntitlementModule | Arbitrum | New: voucher terms, exact consent, setup, reward entitlements | M07, M08, M15, S13 |
| VoucherRedemptionModule | Arbitrum | New: escrow evidence, activation, holder approval and the frozen split | M09, M10, S09, S10 |
| GnosisVoucherAdapter | Gnosis | New: authenticated reward delivery from the issuer reserve, once | M15, S13 |
| GnosisVoucherEscrow | Gnosis | New: one escrow per promise, setup refund before activation, one final split, independent legs | M08 to M10, S07 to S10 |
| CommitmentRegistry, Hats | Arbitrum | Reused, unchanged | identity and roles everywhere |
| CeloSettlementExecutor, canonical G$, registered Safes | Celo | Reused, unchanged | M05, M06, S04, S06 |
| CCIP | Arbitrum, Celo, Gnosis | Reused, unchanged | every cross-chain step |
| CLC GiftableToken, SwapPool and pool policy | Gnosis | Reused, unchanged (CLC components) | M12, M14 |

```mermaid
sequenceDiagram
  participant B as Buyer (Green Goods account)
  participant S as Buyer garden Safe (Celo)
  participant BS as Buyer-garden steward
  participant A as Pooling + Settlement (Arbitrum)
  participant P as Provider steward
  participant X as Celo executor
  B->>A: Agree to exact terms; pledge
  B->>S: Send G$ (gross, token fee, net)
  BS-->>S: Read the transfer
  BS->>A: Record deposit (attestation)
  P->>A: Guarded acceptance
  BS->>A: Apply deposit (funding consumed)
  Note over P: Access set up outside Green Goods; status reported
  B->>A: Confirm kept
  alt Payout
    BS->>A: Finalize payout plan; dispatch
    A-->>X: Payout command
    X->>S: Safe pays contributors by recognition
    X-->>A: Acknowledgment; funding closed
  else Refund (decline, withdrawal, cancellation or expiry; never after kept)
    BS->>A: Queue refund of the full recorded amount
    A-->>X: Refund command
    X->>B: Safe refunds the immutable refund account
  end
```

```mermaid
sequenceDiagram
  participant H as Holder (Green Goods account)
  participant W as Holder (Gnosis wallet)
  participant A as Pooling + voucher modules (Arbitrum)
  participant P as Provider steward
  participant I as Issuer Safe (Gnosis)
  participant E as Voucher escrow (Gnosis)
  participant R as Issuer reserve (Gnosis)
  H->>A: Exact consent; setup prepared
  A-->>E: Setup command
  I->>E: Approve the setup
  W->>E: Allowance and deposit (exact amount)
  E-->>A: Authenticated escrow evidence
  Note over H,E: Before acceptance: cancel, authenticated abort, setup refund. One outcome only.
  P->>A: Guarded acceptance (consent, evidence, window)
  A-->>E: Activate; acknowledgment back
  P->>A: Delivery evidence; proposed split
  I->>E: Authorize the return
  H->>A: Approve delivered units; freeze split
  A-->>E: Frozen allocation
  E->>R: Release leg (40)
  E->>W: Refund leg (60)
  E-->>A: Per-leg results; closed when both settle
```

## 4. Rules every screen follows

1. **Six things stay distinct:** a promise, a voucher balance, service capacity, a payment, a
   delivery confirmation and a financial settlement. One commitment can earn G$ and vouchers with
   separate amounts and receipts; a service purchase is its own promise.
2. **G$ is G$.** No dollar sign, no USD equivalent, no universal rate. Gross, token fee and net
   arrival are separate lines (M04, M05). `build.mjs` fails on a dollar figure in any render.
3. **Custody is described, not dressed up.** A member's G$ waits in the buyer garden's Safe, held
   by its stewards: never "escrow", never "trustless" (T10). Vouchers wait in the voucher escrow,
   a contract keyed to the promise (T6).
4. **Source, destination and acknowledgment are three facts.** "Sent" is never shown as done;
   "done on Gnosis" is never shown as confirmed (M05, M08, M09, S08, S10).
5. **Unknown or stale data never enables a payment or implies a failure.** Stale reads disable
   consequential acts and show their time (M03, M12, S01, S03, S04).
6. **Money never queues offline.** Consent, sends, deposits and swaps are disabled offline; the
   job queue is not used for them (M04, M05).
7. **Uncertain results look up before retrying.** Send, deposit and swap replace their primary
   with a lookup after an uncertain result (M05, M08, M14).
8. **Policy is not enforcement.** Issuer admission, caps and pauses are policy records with
   "policy" chips and "Record" verbs until PRD-1315 enforces them (S11, S12, S07).
9. **Personal spending is not garden spending.** Every G$ purchase surface says whose money it
   is; the buyer-garden steward's dialog says it isn't garden money (M06, S03, S04).
10. **External access is its own status,** dated and sourced; payment never sets it (M06, S06).

## 5. The cross-garden personal G$ purchase

Fictional example: Lina, a gardener at Riverside Commons Garden, received 300 G$ for a course the
garden requested, and buys a one-month AI assistant membership offered through Green Goods
Community Garden's pool (the protocol pool) for 450 G$.

| Requirement | Where it is designed |
|---|---|
| Provider opts in to the personal route on an approval-gated Individual Offer | M03 route card and chips; S01 "Own G$ route" chip; M03@routeoff |
| Buyer picks a home garden where they are a member; joining the provider garden isn't required | M04@garden, M04@none, M03@nogarden |
| Provider, buyer garden, recipient, exact terms, units, price and refund destination before consent | M04@details, M04@review |
| G$ sent on Celo to the buyer garden's registered Safe; custody explained | M04@review custody card, M05 |
| Gross debit, expected net, fees, expressly approved excess as a top-up | M04@details checkbox (off by default), M04@review, M05, S04@excess |
| Payment sent, steward-verified deposit, acceptance, funding consumption, delivery and payout are separate states | M06 ladder; S03 scopes; S05 |
| Verification is a steward attestation, not automatic proof | M06 step meta, S02 check source, S04 subtitle |
| Acceptance alone doesn't make funding available; no hidden treasury subsidy | M06@accepted, S02@unverified (D1) |
| Existing payout allocation preserved, not a lump sum to the provider Safe | S06@payout, M06@payout, sequence above |
| Full settlement or a full refund of the recorded net deposit; no partial G$ settlement | M06 outcome fact, S05 consequence |
| Underpayment, stale terms, withdrawn claims, late deposits, verification waits, refund recovery | M06@underpaid, @stale, @late, @sent, @refundfail; S04@short, @late; S06@refundfail |

## 6. The revised voucher service

Fictional example: Sunroot Skills Hub offers a 10-lesson solar course for 100 Sunroot vouchers.
Three lessons are delivered; the frozen split sends 40 vouchers to Sunroot's reserve and returns
60. Sunroot's voucher is menu-priced, so the example shows no per-lesson conversion. The older
incremental 20 + 20 + 60 walkthrough is not used.

Sequence and where each step lives: discover (M02@sunroot, M07) → exact terms and consent (M08@terms)
→ setup prepared and accounts (M08@accounts) → issuer approval (S07) and holder deposit
(M08@deposit) → authenticated escrow evidence (M08@wait, M09@proof) → guarded acceptance (S08) →
activation (S08@done, M09@started) → delivery and evidence (S09@delivered, M09@lessons) → holder
approves delivered units and freezes the split (M10) → release and refund legs (M09@moving,
S10@inflight) → financial closure (M09@settled, S10@settled).

| Locked rule | Design |
|---|---|
| An offer or pending request can exist before deposit; deposit alone doesn't accept or activate | M09@ready shows "Waiting for Sunroot" after deposit; S07 says approval is not acceptance |
| Source buyer and Gnosis holder are distinct; which account acts is shown; no passkey assumption on Gnosis | M08@accounts, M07@nowallet, M12@nowallet (D8) |
| Revised terms need fresh consent; the UI can't bypass missing consent or escrow readiness | M09@revised, S08@stale, S08@noproof |
| Before activation, cancellation or expiry leads to an authenticated setup refund; no timer refund | M09@cutoff, M09@cancelpending, M09@canceled |
| Acceptance cutoff disclosed; pending cancellation explained; acceptance and abort resolve to one outcome | M08@terms, M09@cancelpending, M09@crossed, S08@race |
| After acceptance, the service remedy path; no setup cancellation | M09@started "Report a Problem" |
| Holder approval of delivered units is explicit; core Fulfilled, swaps or returned vouchers can't stand in | M10 first checkbox, separate from the split |
| The split fits the remedy and the issuer's authorization | M10@outside, S09@outside |
| One full discharge, full return or partial split frozen before either transfer; consequence explained | M10 "Freezing is final", M10@full, M10@none |
| After freeze, read-only; recovery retries the same allocation | M10@frozen, M09@legfail, S10@legfail |
| Release and refund have independent states; closure needs both | M09@moving, S10@ackwait |
| Closure doesn't mark the promise fulfilled or activate an external membership | M09@settled, S10@settled (D14) |
| Discharged vouchers return to the issuer reserve for reuse within its budget; no burn | M10 reserve sub-line, S10 note |

## 7. Surface decisions and component mapping

Compose from shipped components; flag the missing ones. Nothing here invents a parallel pattern.

| Design piece | Shipped component it uses or extends | New? |
|---|---|---|
| Purchase and voucher promise pages (M06, M09) | `GardenCommitment` page, `CommitmentStateLadder`, `FixedBar`, notice anatomy (DL-057) | Ladder gains a meta line per step (source and time) |
| Payment, setup, split and exchange sheets (M04, M05, M08, M10, M14) | `PwaSheet` tiers (DL-014), `SheetHeader`, `SheetActions` (DL-016), step markers (DL-058) | No |
| Transaction review card | Facts rows (locked "Facts" card pick) inside the sheet | No; the content contract is new (section 8) |
| Split bar (M10) | None | New primitive: two labeled segments with an `aria-label` restating both numbers |
| Account cards (M08, M04) | `AddressDisplay` inside a card | Small composition, flag for Shared |
| Wallet › Vouchers and Purchases tabs (M12, M13) | `WalletSheet` tabs beside Tokens and Cookies | New tabs (D2) |
| Review rows with funding and escrow chips (S01, S07) | `WaitingForApprovalRow`, `PoolClaimsCard` | Adds one state chip; no new row variant |
| Member Deposits card (S03) | `AdminCard` with `AdminFilterChip` scopes and decision rows | New card (D3) |
| Guarded approval and deposit dialogs (S02, S04, S05, S07, S08) | `AdminConfirmDialog`, `PoolTarget` (DL-066), `FlowStatusRow` (DL-072) | No |
| Split proposal and issuer admission flows (S09, S11) | `AdminDialog` variant flow with `ActionFlowShell` rail | No |
| Inspector sections (S06, S10, S13) | `CommitmentDialog` sections: `CommitmentSettlement`, `CommitmentSettlementFacts`, `CommitmentRecovery` | New Vouchers, Rewards and Access sections |
| Voucher Issuers card (S12) | `AdminCard` with record rows | New card, placement proposed (D12) |

## 8. Transaction review and the irreversible split

Every transaction review names, in this order: the network; the acting account; the destination
(registered Safe, escrow for this promise, or exchange); the exact amount; fees and sponsorship;
for swaps the minimum output, deadline and recipient; a reference that binds it to the request;
and how many prompts are coming. The primary restates the amount ("Send 452.26 G$").

The final split (M10) asks for two confirmations, delivered units and the allocation, before the
one destructive-weight action, "Freeze Split", in the error fill (DL-053). Focus lands on the
first checkbox. The split bar is labeled with both numbers and a text alternative; color is never
the only cue. After freezing, the same sheet becomes read-only with a lock and Done returns to
the promise page, where the two legs show their own states.

## 9. Responsive layouts, accessibility and motion

- **App:** 390 and 360 phones; at tablet and desktop widths the page keeps a 600px column and
  sheets become centered dialogs (`DialogShell`'s desktop form). **Cockpit:** desktop with the
  37.5% rail (DL-068); on phones dialogs become bottom sheets, decision rows stack their acts
  under the meta, and the alert card leads (DL-051).
- **Keyboard and focus:** real buttons everywhere; focus trap and return in sheets and dialogs;
  Escape closes except while signing; step headings take focus on step change; disabled primaries
  are described by the failed check or notice.
- **Screen readers:** each state's announcement is in [`matrices.md`](matrices.md#screen-notes);
  waits use polite status, new blockers use assertive alerts, timers announce at 10 seconds and
  at expiry only.
- **Contrast:** the state pairs used are AA in both themes (computed in the prototype's
  Accessibility view). Status always carries a word, never color alone.
- **Reduced motion:** sheets appear without sliding, spinners stop and the status line carries the
  state; no countdown pressure, streaks or urgency.
- **Long text:** row titles stay one line (locked card pick); notices and facts wrap; fixed bars
  never wrap a button to a second row. An automated sweep of every state in EN, ES and PT at
  390, 360, tablet, cockpit desktop and cockpit phone found no clipped content outside designed
  truncation (see evidence).

## 10. Implementation mapping

Order of work, each after its contract and data prerequisites exist and this design is approved:

1. **PRD-1324 and PRD-1323 (2.1.0, linked rewards):** M16 row terms, M15, S13. Needs PRD-1321
   per-reward status and PRD-1322 actions; nothing here depends on voucher escrow.
2. **PRD-1297, voucher holdings and exchange:** M12, M14. Needs the Gnosis wallet connection and
   reads; WXDAI stays rehearsal-labeled until PRD-1197 and COM-46 pick a live asset.
3. **PRD-1297, voucher service:** M07 to M10, S07 to S10. Needs PRD-1317 and PRD-1318 under the
   reconciled lifecycle.
4. **PRD-1297, personal G$ purchase (may warrant its own issue):** M03 to M06, M13, S01 to S06.
   Needs the CommitmentPooling and SettlementModule upgrades and decisions D1 to D4.
5. **Issuer policy surfaces:** S11, S12, only as policy records until PRD-1315 decides enforcement.

### Contract and projection facts by screen

These name expected reads and acts. Function and entity names marked "confirm" must be checked
against the reconciliation and service-access handoffs before implementation.

| Screens | Reads (indexer or chain) | Acts (contract) |
|---|---|---|
| M03, M04, S01 | Offer with route flag and approval gate at its terms revision; buyer's garden roles; buyer garden settlement account | Claim with exact-revision consent and pledge (upgraded CommitmentPooling and SettlementModule; confirm names) |
| M05 | Registered Safe; live canonical G$ fee; Celo transfer lookup by sender, Safe and amount window | Canonical G$ transfer on Celo |
| M06, M13 | Funding record (Pledged, DepositRecorded, Consumed, Closed, RefundQueued, Refunded, Withdrawn), claim state, payout plan and children, refund child and attempts, access report | Withdraw; confirm kept (existing) |
| S03, S04 | Pledges naming this buyer garden; fresh Celo transfer reads | Record deposit (`recordFundingDeposit`, extended for the buyer-garden route; confirm) |
| S02, S08 | Consent record; funding record; escrow evidence receipt; acceptance window | Guarded `acceptClaim` / `claimCommitment` (the guard covers both paths) |
| S05 | Pooling acceptance with counterparty; funding record | `consumeFunding` (may become automatic at acceptance; confirm) |
| S06 | Payout plan, recognition snapshot, children, refund child | Existing payout acts; `requeue` of the same refund child |
| M07, M08, S07 | Voucher terms record; holder's Gnosis balance; setup and issuer approval records | Consent and setup (VoucherEntitlementModule); issuer approval and deposit (GnosisVoucherEscrow or Adapter; confirm) |
| M09, S10 | Escrow state, evidence receipt, activation acknowledgment, frozen allocation, per-leg execution and acknowledgment | Cancel setup (authenticated abort); retry the same leg |
| M10, S09 | Delivery evidence, remedy terms, issuer authorization | Propose split with authorization; holder approval and freeze (VoucherRedemptionModule; confirm account) |
| M12, M14 | GiftableToken balances; escrowed amounts; entitlement and swap receipts; pool quoter, inventory and limits | Allowance and bounded swap on the CLC SwapPool |
| M15, M16, S13 | Commitment G$ terms; voucher terms and source; entitlement and stored delivery result; payout plan | Consent at acceptance; retry the same entitlement |
| S11, S12 | Policy records; issuer supply outside the reserve | Policy records only |

Shared owns these projections and acts as hooks (`packages/shared/src/hooks`), the indexer
projects the receipts with chain, contract and record identity, and both apps only present.

## 11. Decisions and dependencies

Afo's decisions, with recommendations, are D1, D2, D3, D12, D14 and the wording batch T2 to T5.
The full list with owners is in [`matrices.md`](matrices.md#decisions-and-dependencies) and the
prototype's Handoff view. Unresolved contract dependencies that the UI must not paper over:
issuer-cap enforcement, gardener issuer identity and cap isolation, independent steward
suspension, Gnosis member accounts, the acknowledgment lane, the acceptance window length and
abort authority, leg retry permission, the freezing account, and real issuer terms (COM-46).

## 12. Evidence

See [`evidence/README.md`](evidence/README.md). In short: the screenshots are a labeled render of
the hand-built prototype (headless Chromium through Playwright, cloud session, mock data), not
product proof. Product rendered proof is none, because none of these screens is implemented.
`build.mjs` checked every screen, state and language for render errors, missing strings, broken
links, em dashes and dollar figures; a browser sweep checked clipping.
