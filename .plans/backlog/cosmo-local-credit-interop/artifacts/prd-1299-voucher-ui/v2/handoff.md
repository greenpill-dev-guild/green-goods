# PRD-1299 voucher design lab, v2: handoff

**Status:** draft for Afo's review. Not approved. PRD-1299 owns design approval, PRD-1297
implements it, PRD-1323 and PRD-1324 own linked rewards, and Gui reviews the Portuguese copy
(PRD-1312). Nothing here changes contracts, live configuration or Linear.

- **Open it:** [`voucher-lab.html`](voucher-lab.html) in any browser, or the published
  [Voucher Lab](https://claude.ai/artifact/3pwUYy43vdb91q6qdH3H9G) (artifact version 4).
- **Start with:** the "Simplified, proposed" group in the left column. Controls sit in the right
  panel, so screens stay in view and don't shift between steps.
- **Sources:** [`lab/`](lab/). See [Rebuild and check](#rebuild-and-check).

v2 supersedes the v1 prototype's direction. v1 stays frozen beside it for comparison.

## For the local session: start here

This cloud session had no access to three things. Check the direction against them before
Afo reviews it.

1. **The design book.** Afo attached *Don't Make Me Think*; the file never reached this session.
   The lab applies Krug's principles from memory: one obvious action per screen, no chain or
   contract words on member screens, copy cut to what a member needs to act. Read the book and
   flag anything the screens get wrong.
2. **Other local work.** Another session owns the contract and integration changes and a staged
   checkpoint. This session did not see them. Compare the five changes in
   [What changes underneath](#what-changes-underneath) with that work, especially the G$ purchase
   escrow, the passkey validator on Gnosis, and acceptance rules in `acceptClaim`.
3. **Local handoffs.** Read any newer files in `../../handoffs/` and the plan hub
   (`../../status.json`, `../../tensions.md`) for decisions made after 22 Oct 2026.

Then, in order:

- [ ] Confirm each architecture change is feasible with the contract session's current work, or
      mark which ones change the design.
- [ ] Check the screens against the design book and the [design audit](design-audit.md).
- [ ] Work the [remaining audit items](design-audit.md#remaining) that need a local checkout or
      a running app.
- [ ] Put the [open questions](#still-open) to Afo.

## Afo's decisions so far

Made in this session, on 22 Oct 2026:

| Topic | Decision |
|---|---|
| Directions for today's screens | Take every suggested pick: Route card (offer), Stepped sheet (pay), Timeline (status), Wallet tabs (where purchases live), Escrow card (holder), Split bar (split), Rows (wallet vouchers), Dialog with checks (steward approval), Funds page card (buyer deposits). |
| Simplify | Simplify the flows, abstract the held funds, and state any architecture change plainly. |
| Architecture | Accept all four changes: G$ purchase escrow, one account everywhere, paying is agreeing, standing approvals. |
| Finishing | Pay out automatically once everything is delivered, after the review window. |
| Naming | Keep **Redeem** for vouchers, the same as CLC, because members may use both apps. Vaults get a new verb. |
| Accounts | Passkey accounts must be verified as gardener or steward accounts. |

Two of these reopen earlier text. `../../spec.md` lines 45 to 50 say "Redeem" keeps its vault
meaning and propose "use" for vouchers; the brief keeps a member's G$ in the buyer garden's
Safe. Both need their owners to update them. This branch doesn't edit them.

## The simplified direction

Members see one idea for G$ and vouchers alike: **a hold**.

> "Your 450 G$ is held for this purchase. Green Goods Community Garden is paid when it's done.
> If it doesn't go ahead, it all comes back to you."

- Buying is one review and one approval.
- A purchase is held, started, then kept, or it comes back.
- Members act only to report a problem or to answer an early end.
- Safes, chains, steward checks and per-chain wallets leave member screens. Stewards still see
  them under Technical details.

| Flow in the lab | Screens | What it shows |
|---|---|---|
| Simplified G$ purchase | `SOffer`, `SPay`, `SPurchase`, `SRequests` | Lina buys a month of the AI assistant with her own G$; Kaya accepts. |
| Simplified voucher course | `SOffer`, `SPay`, `SCourse`, `SIssuer` | Lina redeems 100 Sunroot vouchers for a course that ends early. |
| Redeem on the spot | `SOffer`, `SPay`, `SWallet` | One seed packet voucher, handed over at once. |
| When something goes wrong | `SPurchase`, `SRequests` | Declines, delayed refunds, problem reports, changed terms. |

The lab also keeps the v1 screens ("Today") and before-and-after pairs, so reviewers can see what
each change removes.

## What changes underneath

| # | Change | Removes | Costs |
|---|---|---|---|
| 1 | Each G$ purchase is held in its own escrow on Celo, which reports arrival the way the voucher escrow does on Gnosis. | Choosing a home garden, two manual steps for the buyer garden's stewards, manual refunds. | One new Celo contract and its audit. G$ is still never bridged; payouts still follow the selling garden's payout plan. |
| 2 | One account everywhere, checked once as a gardener or steward account. | The separate Gnosis wallet, the two-accounts step, wrong-wallet errors. | Deploying the passkey validator on Gnosis at the same address (C57 in `../../research/claim-ledger.md`). Outside wallets stay possible. |
| 3 | Paying is agreeing: the payment carries the exact terms version. | One extra approval for G$, two for vouchers. | Pooling and voucher modules accept agreement that arrives with the payment. |
| 4 | Standing approvals: issuers approve an offer once with a place limit; gardens can turn on automatic acceptance. | Waiting for each setup approval and, for routine offers, for a steward. | Offer-level settings and a change to `acceptClaim`, which only a pool steward can call today. |
| 5 | Done by default when everything is delivered, after a 7-day window, unless the member reports a problem. Early ends and partial splits still need the member's yes. | "Confirm it was kept" as a required step. | Timed release in the settlement and voucher modules, and a problem flag that pauses it. |

What stays: G$ on Celo, vouchers on Gnosis, agreements on Arbitrum; the selling garden decides
unless it turns on automatic acceptance; payouts split by the payout plan; issuer caps and pauses
stay published policy until PRD-1315 enforces them.

## Recommendations

Afo asked for these on 22 Oct 2026. The lab's Recommendations page has the same text.

**G$ token fees.** Members see one total and always get the full price back. They pay the price
plus two G$ token fees, one for paying in and one set aside for paying out: 450.00 + 0.45 + 0.45 =
450.90 G$ at an illustrative 0.1%. Refunds and payouts are always the full 450.00 G$. Read the real
fee from the token at payment, as the Celo settlement executor already does with
`getFees(amount, sender, recipient)`. The escrow refuses receiver-paid fees rather than hold less
than it promised, matching the executor (`packages/contracts/src/modules/CeloSettlement/`).

**One approval for vouchers.** Yes, without relying on the voucher token. The Kernel account
batches approve and deposit into one passkey approval with a sponsored network fee. Public sources
don't show EIP-2612 permit support on CLC vouchers, so the design doesn't depend on it. Outside
wallets may see two prompts. Prerequisite: the passkey validator on Gnosis (C57).

**Review window.** 7 days for every offer in the first release. It starts at the end of the
service period or at the last lesson report, sends reminders at the start and the day before it
closes, and pauses on a problem report. No window for vouchers redeemed on the spot. Later, 3 to
14 days per offer if providers ask.

**Naming.** Redeem for vouchers everywhere, as in CLC. Vaults use **Withdraw** with its object
("Withdraw from Endowment"), or "Take Out" if Afo wants no overlap with "Withdraw This Offer".
That touches 23 English strings in `packages/shared/src/i18n/en.json` (22 on vault screens, 1 in
the treasury), plus Spanish and Portuguese.

**Gardener and steward check.** Green Goods checks the role once, on Arbitrum through Hats, when
the member agrees, and records the account address. The escrows on Celo and Gnosis accept money
only from that address. Someone without a garden role sees "Join a garden to pay for yourself"
and a Find a Garden button.

**Swapping vouchers.** Supported within one CLC pool: one admitted asset for another, within its
limits and inventory. Multi-pool routes only quote prices in CLC's current version. G$ is never
swapped for vouchers (locked). A swap isn't a redemption and books nothing.

## Still open

1. **Who settles a reported problem.** Suggestion: the provider has 7 days to refund (in full, or
   in part for a course within its terms) or fix it; after 14 days unresolved, the stewards of the
   pool's garden decide.
2. **The passkey validator on Gnosis** (C57). Changes 2 and 3 depend on it.
3. **The live G$ fee**, read from the token before launch.
4. **Text owners must update** `../../spec.md` lines 45 to 50 and the brief's buyer-garden Safe
   rule, and someone must pick the vault verb before the 23 strings change.

## Plain scenarios

The lab's "How it works, in plain words" page walks seven scenarios with links to each flow:
Lina's G$ purchase; a decline or problem; Lina's voucher course that ends early; a seed packet
redeemed on the spot; a garden promise that pays G$ and vouchers; Kofi buying vouchers at an
exchange; and a garden buying for itself through the ordinary garden promise flow.

## Rebuild and check

```sh
cd .plans/backlog/cosmo-local-credit-interop/artifacts/prd-1299-voucher-ui/v2/lab
node build.mjs     # writes ../voucher-lab.html from shell.html, gg.css, remix-sprite.svg and screens/
node check.mjs     # self-test plus fit checks; uses the repo's @playwright/test
```

- `shell.html`: the lab page, its runtime and all lab text (flows, questions, pairs, docs).
- `gg.css`: the screen kit. The block after "Design-system alignment (v2 audit)" holds the audit
  corrections.
- `screens/*.dc.html`: 27 screens. `S*` files are the simplified direction; the rest are v1's.
- `remix-sprite.svg`: 52 Remix Icon 4.9.0 glyphs from the npm package. Icons by Remix Icon
  (https://remixicon.com), licensed under the Remix Icon License v1.0.

## Evidence

All rendered proof is **CI-style headless Chromium (Playwright 1.x, Chromium 1194) against the
built file**. None of it is authenticated.

| Check | Result |
|---|---|
| `node build.mjs` in this folder | Output is byte-identical to the published artifact version 4. |
| Lab self-test (every screen in every state draws) | 0 errors, no console errors. |
| Fit check: 8 views at 1440×900, 1280×720, 1024×768, 390×844 (`check.mjs`) | Passed: every frame inside the stage, stage above the fold, no sideways scroll. |
| Wider fit sweep: 10 views at the same 4 sizes | 40 of 40 passed. |
| Every icon reference has a sprite glyph | 0 missing. |
| Visual review of screenshots | `SRequests`, `SIssuer`, `SWallet`, `SPurchase`, `Visit`, `Main`, `SOffer`, `SPay` checked by eye at 1440 wide. |

Not done here: authenticated Brave proof (not needed for a design artifact), the design book
review, and comparison with local contract work.

These files are design artifacts. Code, tests and CI must not depend on them.
