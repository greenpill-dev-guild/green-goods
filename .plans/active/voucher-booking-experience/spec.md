# Voucher booking experience Spec

## Summary

The approved proposal from the 18 November 2026 review, built for real. The visual spec is the
pair of proposal stories (`client-commitments-voucher-hub-day-proposal--hub-day`,
`admin-pool-voucher-hub-day-proposal--hub-day`) and the walkthroughs beside them; each build PR
deletes its proposal story once the real surface matches. Design decisions are ledger rows
DL-191 to DL-196.

## Users

- Primary: a member booking a service with vouchers (installed app).
- Secondary: a steward of the issuing garden (Hub).

## Functional Requirements

1. Tracker (DL-191): `FormProgress` in the booking page's top bar and in every booking sheet;
   markers Book, Deposit, Service, Done; a clock marker when the step waits on someone else;
   `ServiceStepStrip` retired.
2. Booking page (DL-192): one status, the facts that matter now, a Booking details disclosure,
   one action bar; no Team, History, or Progress and proof before delivery. Bookings only.
3. Member moments (DL-192, DL-193): Book, Deposit, Confirm Your Visit. The steward's Accept and
   Start sends the start; the member's Start the Booking is a fallback.
4. Needs you (DL-194) on the booking's row in the wallet's Vouchers tab and in Your Promises.
5. Hub (DL-195): Review Promises holds every booking act; the list folds copies with counts;
   Your Reserve leads with three numbers; the queue comes first below the two-column width.
6. Words (DL-196): Offer and Request; Ask to Take Up; Ask to Join; Book. English, plus every Portuguese join and take-up string that still says pedido (to solicitação); Spanish already separates them.

## Research Evidence

- Existing patterns: `FormProgress` (Submit Work, compose), `CommitmentDetailShell`,
  `WaitingForApprovalRow` and `useWaitingForApproval`, `groupCommitmentsForDisplay`, `StatTile`.
- Reviewed: `GardenCommitment.tsx`, `ServicePromise.tsx`, `ServiceAccessSection.tsx`,
  `serviceBooking*.ts`, `PoolClaimsCard.tsx`, `PoolCommitmentsCard.tsx`,
  `VoucherReserveCard.tsx`, `useVoucherConsole.ts`, `service-access-live-commands.ts`,
  `service-access-voucher.ts`, `GnosisVoucherEscrow.sol`, `VoucherRedemptionModule.sol`.
- Confirmed: `finalizeActivation` has no caller check, so anyone may send the start once a
  booking is accepted; `dispatchSetupCommand` is payable by its sender.
- Confirmed gap: Report Visit and Raise Allowance throw in the live `useVoucherConsole`.

## Human Judgment Points

- Ruled on 19 November 2026, kept as built: the fallback start shows 15 minutes after
  acceptance; Home's "Your Requests" becomes "Waiting to Join" and the steward's join queue
  "Asking to Join"; Accept goes through on an empty steward wallet and the fallback covers it.
- Protected surface: Accept and Start sends transactions from Shared (critical tier).

## Non-Functional Constraints

- Package boundaries: hooks stay in Shared; admin ledger rows never ride with admin code.
- Security: no new signing path; the steward's sends reuse `serviceLiveCall` and its checks.
- Offline / sync: every pending, failed and declined send keeps its recovery act.
- Localization: new strings in en, es and pt; the wording sweep covers English and the Portuguese join and take-up strings.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| App booking page (PR C), Hub tab (PR D) | `ui` | Parallel side sessions |
| Accept and Start, closing sheet (PR E) | `state_api` | Critical tier, after C and D |
| Contracts | `contracts` | n/a: studied in RESR-119 |
| QA | `qa_pass_1` | Orchestrator verifies each PR in Storybook |

## Risks

- Report Visit is not wired live; PR D measures the gap before building the queue around it.
- Accept and Start is three sends; a failure between them must leave a clear state on both apps.
- Several 2.1.0 sessions edit the locale catalogs; whoever merges second syncs first.
