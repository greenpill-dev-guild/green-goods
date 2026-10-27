# Green Goods voucher offers: publishing runbook

This publishes Green Goods' two approved voucher offers under terms `pilot-2026-10-27-r2`: ten
45-minute assisted sessions at 2 GGV and ten 30-day Claude Team seats at 10 GGV. It is written for
a UI agent driving the cockpit and Safe{Wallet}. A person approves every wallet prompt; the agent
never signs. Run it after the Gnosis batch that mints 100 GGV to the Green Goods Safe, raises the
pool limit to 120 and approves the adapter for 110.

## How an offer works

An offer is one promise. A steward seeds a steward-reviewed service promise in the Green Goods
Community Garden's pool (pool 1, the protocol pool on Arbitrum). The Green Goods Safe, which owns
the Pooling core, then attaches the voucher terms with `setServiceOfferTerms`. One promise serves
one buyer, so ten seats are ten promises. The terms references written on chain are the keccak256
hashes of the four statements in the [reference](#reference).

## Gates

Stop and ask Afo if a gate fails.

1. **The Gnosis batch is done.** From the repository root:

   ```bash
   bun --no-env-file .plans/backlog/cosmo-local-credit-interop/handoffs/green-goods-offer-terms-batch.mjs --preflight
   ```

   Every line must read `PASS`: 120 GGV issued, a pool limit of 120, an adapter allowance of 110
   and a Safe reserve of at least 110.
2. **Claude seats need permission: met on 27 October 2026.** Afo confirmed that participant seats
   are permitted under Green Goods' supplier terms and that ten seat-periods are funded, so seed the
   Claude set and pass `--with-claude`. If that confirmation is ever withdrawn, publish the sessions
   alone.
3. **The right people.** A Green Goods Community Garden steward is signed in to the cockpit (the
   protocol pool accepts promises only from its stewards and the Safe), and two Safe owners are
   available for step 4.
4. **Before the first booking, not before publishing:** deploy the indexer as
   `packages/indexer/voucher-rollout.md` describes, because the cockpit's voucher console reads
   bookings from it. Members book on <https://beta.greengoods.app> until production is promoted.

## 1. Seed the assisted sessions (cockpit)

Use <https://beta.admin.greengoods.app>, which deploys develop. Production's cockpit was last
promoted on 15 October and predates the voucher work. Both write to the live chain.

Choose **Green Goods Community Garden** in the header, open the **Promises** tab and choose
**Seed Promises** (the dialog lives at `/garden/pool/seed`). Enter:

| Step | Field | Value |
|---|---|---|
| What | What does this promise tie to? | No cycle (runs on its own) |
| What | What type of work is it? | Support |
| What | What is the pool doing? | The pool offers |
| What | Title | `45-minute assisted session` |
| What | Note | the session note below |
| How Much | Promises | 10 |
| How Much | Each promise asks for | 45 |
| How Much | Unit | `minutes` |
| How Much | Due in (days) | the days from today to 28 February 2027 (124 on 27 October) |
| How Much | Contributor policy | Lead-managed team |
| Proof & Confirmation | Confirmers | nobody named (whoever takes it up confirms) |
| Proof & Confirmation | Let the Green Goods team confirm… | leave it on |
| Proof & Confirmation | Claim mode | Steward-reviewed |
| Proof & Confirmation | Reward | No |

Session note:

> One 45-minute session, remote or in person, to set up your garden or document a contribution.
> Costs 2 Green Goods vouchers. Book by 31 December 2026; we confirm within two business days.
> You approve what was delivered, and unused time comes back to you as vouchers.

On Review, check that every promise is due 28 February 2027, then create the set and approve
each wallet prompt; the dialog says how many to expect. Wait until all ten show under
**Offers and Requests**.

Why these values: a season cannot close while it holds live promises, so "No cycle" keeps
Season One free to reconcile. The due date covers the booking window plus a thirty-day seat.
The batch script matches on the unit, the number, the claim mode and the due date, and skips
any promise that differs.

## 2. Seed the Claude seats (cockpit, gate 2 only)

Repeat step 1 with these changes: Title `30 days of Claude Team access`, Each promise asks for
30, Unit `seat days`, and this note:

> A named Claude Team Standard seat in Green Goods' organization for 30 days, starting when you
> can sign in. Costs 10 Green Goods vouchers. No auto-renewal or extra usage. Book by
> 31 December 2026. You approve the days that worked, and the rest comes back to you as vouchers.

## 3. Build the terms batch (terminal)

```bash
bun --no-env-file .plans/backlog/cosmo-local-credit-interop/handoffs/green-goods-offer-terms-batch.mjs
```

Add `--with-claude` only when gate 2 passed. The script repeats the gates and prints the four
statement hashes, which must match the reference. It then lists every seeded promise from #43
upward as `ok`, `hold` or `skip`, test-calls `setServiceOfferTerms` as the Safe for each `ok`, and
writes `output/voucher-offers/green-goods-offer-terms-<time>.json`. It reads the chain only.

Expect ten `ok` session lines, plus ten Claude lines with the flag. Stop on any `skip` you did not
expect. The script refuses to go past ten of either offer, counting offers already published.

## 4. Propose and sign in Safe (Arbitrum)

1. Open <https://app.safe.global> on Arbitrum with the Green Goods Safe.
2. Open **Apps**, then **Transaction Builder**, and drop in the file from step 3.
3. Check that the transaction count equals the `ok` lines, that every transaction goes to the
   Pooling core, and that each decodes as `setServiceOfferTerms`. Create and send the batch.
4. Run the Safe's simulation; it must succeed. Afo signs as one owner. A second owner signs and
   executes, since the threshold is 2 of 5.

## 5. Verify

```bash
bun --no-env-file .plans/backlog/cosmo-local-credit-interop/handoffs/green-goods-offer-terms-batch.mjs --verify
```

Every published promise must read `PASS` at revision 1: 2 GGV for a session, 10 GGV for a Claude
seat. Then open the garden on <https://beta.greengoods.app> as a member and check that the offers
show their voucher prices. Record the Safe transaction hash and the promise numbers on COM-46.

## Undo and later

- Before anyone books, cancel a wrong promise in the cockpit, or set its terms again at the next
  revision. Terms lock when a booking is accepted.
- On 1 January 2027, cancel the offers nobody booked. Booked offers keep their terms.
- Not covered: Tech and Sun's hub-day offers, which wait on their Safe's
  [finalization](tas-steward-safe-finalize-runbook.md) and their issuer acceptance, and booking
  approvals, which the cockpit's voucher console exports as Safe files.

## Reference

| Item | Value |
|---|---|
| Green Goods Safe (Arbitrum and Gnosis, 2 of 5) | `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19` |
| Pooling core (Arbitrum) | `0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a` |
| Green Goods Community Garden (Arbitrum), pool 1 | `0xf401f34378384713222d1d21f63359cc4E8a858a` |
| GGV (Gnosis, 6 decimals) | `0xbaF8c6f7c0cA8310Df725D90023C188FA8f1B590` |

The script holds the canonical statements and prints their hashes; the printed hashes must match
these.

| Statement | keccak256 of the exact text |
|---|---|
| Session service | `0x1616a8f3b5173f56d7c0a7bb7f00c45a64e0e1b4b463d81502d1379f51b20f13` |
| Session remedy | `0x0fe1184e5b2d1f6f38ed6a58872bd3c85673c8598aefef09af3bd45f976b4dd6` |
| Claude service | `0xa18d37ab4b89aac3790bf980f50ae2581d7975899e4fed4c0b5af73afdc0a3c0` |
| Claude remedy | `0x0e13b8482cd3d5d32ba1c72e0e6b8bf72b0da71c5c325d314e50ee554e98aba1` |

**Session service:** Green Goods voucher offer, terms pilot-2026-10-27-r2: 2 Green Goods vouchers
buy one 45-minute remote or in-person session to set up a garden or document a contribution.
Bookings open 28 October 2026 and close 31 December 2026. Green Goods confirms a booking within
two business days. Activation needs accepted terms and full escrow, not proof of delivery.

**Session remedy:** Green Goods voucher remedy, terms pilot-2026-10-27-r2: the holder approves
one final allocation. Delivered vouchers are the approved delivered minutes / 45 x 2, rounded down
at token precision and capped at 2; the rest returns to the holder. A failed connection with no
useful session delivers zero. Changes need mutual consent; a timeout alone decides neither
delivery nor refund.

**Claude service:** Green Goods voucher offer, terms pilot-2026-10-27-r2: 10 Green Goods vouchers
buy thirty consecutive days of a named Claude Team Standard seat in Green Goods' organization,
starting when the participant can sign in and confirms access. No automatic renewal, paid extra
usage, API credits or Premium access. Bookings open 28 October 2026 and close 31 December 2026.

**Claude remedy:** Green Goods voucher remedy, terms pilot-2026-10-27-r2: the holder approves one
final allocation. Delivered vouchers are the approved available days / 30 x 10, rounded down at
token precision and capped at 10; the rest returns to the holder. Normal provider usage limits are
not an outage; losing the seat is. Changes need mutual consent; a timeout alone decides neither
delivery nor refund.

## Rehearsal, 27 October 2026

On local forks of Arbitrum (block 518664374) and Gnosis (block 48965212), with the Safe
impersonated: the Gnosis batch (`mintTo` 100, `setLimitFor` 120, `approve` 110) succeeded and
`--preflight` then passed every gate. Four promises were seeded with the fields above: a session,
a Claude seat, a session with the open claim mode and a seat due 31 December. The script held the
seat without `--with-claude`, skipped the two wrong promises with their reasons, and built and
test-called the two good ones. Executing the file as the Safe succeeded, `--verify` passed both at
revision 1, and a rerun found nothing new to publish. A Tech and Sun HUB member's
`requestServiceClaim` on the published session then succeeded. Not rehearsed: the cockpit's
seeding screen and Safe{Wallet}'s Transaction Builder themselves. The seeded fields match what the
cockpit's creation payload builds, and the file has the same shape as the cockpit's voucher
console Safe export.
