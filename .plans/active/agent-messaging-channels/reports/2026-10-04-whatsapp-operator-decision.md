# WhatsApp operator decision: Green Goods runs its own channel

**Date:** 4 October 2026. **Authority:** user decision (Afolabi), recorded the same day.
**Author:** Opus 5.5 (Claude), for Afolabi.

Green Goods will not use WEFA's Meta business portfolio for WhatsApp. Afolabi operates the WhatsApp
channel as a sole proprietor doing business as Green Goods, on a Meta business portfolio of its own.
This replaces the decision of 21 September that the WhatsApp Business Account is operated by WEFA
LLC. It also answers the question the
[Telegram-first report](2026-09-29-telegram-first-whatsapp-outlook.md) left open, whether the account
stays under WEFA. That dated report is unchanged.

Telegram stays the live channel. WhatsApp keeps its channel and control, off, and no WhatsApp adapter
is registered. No report has passed through WhatsApp, so no participant notice was owed for the
change of operator.

## What was decided

- **Separate from WEFA.** Afolabi does not want Green Goods mixed with WEFA. WEFA keeps its portfolio
  for its own apps.
- **Its own portfolio.** Meta lets one person create two business portfolios, and Afolabi has two. His
  second portfolio is renamed Green Goods. No new portfolio is created.
- **Legal footing.** A sole proprietorship: Afolabi, doing business as Green Goods. It is not a
  separate legal entity, so he is personally the operator responsible for gardener data on this
  channel until a Green Goods entity exists.
- **Set up now, verify later.** Meta does not require business verification to start.

## The order of setup

1. Read the status of Afolabi's profile, the WEFA portfolio and its WhatsApp Business Account in Meta
   Business Support Home, and record it. Meta's Account Integrity standard lets it restrict assets
   owned by the same person as a disabled account, so no WhatsApp account is added to the new
   portfolio before this is known. Which asset Meta disabled on 29 September, and why, is still not
   recorded.
2. Rename the portfolio and set its business details: Afolabi's legal name, Green Goods as the trading
   name, one address and one phone number. Turn on two-factor authentication and add a second person
   with full control. Meta warns that business details may not be editable once a portfolio is used
   for a WhatsApp Business Account, so this comes first.
3. Register the trade name, get an EIN as a sole proprietor, and open a bank account under the trade
   name.
4. Put an operator line and a privacy policy that covers messaging on the website. Today the site
   names no operator and has no privacy policy page, and `docs/docs/reference/credits.md` says no
   personal data is collected.
5. Create the Meta app, the WhatsApp Business Account and the number, with the display name Green
   Goods.
6. Start unverified, then submit business verification once the trade name filing and the EIN letter
   exist.

Linear tracks this as GROW-60, which blocks the WhatsApp adapter (PRD-943). GROW-57 was canceled.

## What Meta's pages said on 4 October

Read on Meta's own help and policy pages that day. Recheck before relying on any of it.

| Fact | Source |
| --- | --- |
| One person can create at most two business portfolios and can belong to any number. | [Create a business portfolio](https://www.facebook.com/business/help/1710077379203657) |
| Meta may restrict or disable accounts and business assets owned by the same person or entity as a disabled account, or used to evade enforcement or review. | [Account Integrity](https://transparency.meta.com/policies/community-standards/account-integrity) |
| On a verified business, changing the legal name, country, phone, website or tax ID means verifying again. Edit may be unavailable once the portfolio is used for a WhatsApp Business Account. | [Edit business details](https://www.facebook.com/business/help/322526208728282) |
| A display name must have a clear relationship with the business's legal name, evident on its website. | [Display name guidelines](https://www.facebook.com/business/help/757569725593362) |
| Before scaling: 250 business-initiated conversations per portfolio per 24 hours, unlimited replies to people who wrote first, two phone numbers, and no business name shown in chats. Business verification is one of three ways to scale. | [Scale your WhatsApp Business Account](https://www.facebook.com/business/help/595597942906808) |
| Verification documents must show the legal business name and its address or phone. A decision may take up to 14 business days. | [Official documents](https://www.facebook.com/business/help/159334372093366), [Verify your business](https://www.facebook.com/business/help/2058515294227817) |
| A provider such as Twilio still creates the WhatsApp Business Account inside the customer's own Meta portfolio. | [Twilio self sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up) |

## What changes in this hub

- The decision log row "WhatsApp Business Account operated by WEFA LLC" in
  [plan.todo.md](../plan.todo.md) is replaced.
- [brief.md](../brief.md), [spec.md](../spec.md) (O2) and
  [technical-brief.md](../technical-brief.md) (header, sections 1, 10, 10.1, 12 and 13) name the new
  operator.
- The adapter's contract does not change. Section 6 of the
  [capability record](2026-09-27-reporting-core-capability-record.md) remains its spec.

## Still open

- **Legal and fiscal sponsor review.** A sole proprietorship has no liability shield and is not a
  nonprofit form. How it sits beside the fiscal sponsor, and whether to form a Green Goods entity,
  are open.
- **Scope.** Whether the other hosted services and the model processor accounts move with the channel
  is undecided. The technical brief's statement about the TypeSafe account is unchanged.
- **The first number.** PRD-942, which covered registering the Twilio number under the account in
  WEFA's portfolio, was closed on 29 September. Whether Meta lets that number be removed from that
  account, or Green Goods takes a new one, is not known.
- **The research agenda.** [Track 5](../../../../docs/routines/research-agenda.md) still lists "WEFA
  operates WhatsApp" as settled. The Research panel edits that file at cycle boundaries.
- **Who speaks for Green Goods.** The operator and the project lead are now the same person, so the
  operating memo linked on GROW-60 asks for a second person.
