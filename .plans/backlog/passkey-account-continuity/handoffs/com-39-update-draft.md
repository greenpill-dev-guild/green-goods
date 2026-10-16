# COM-39 update

Posted on 2026-10-16 after Afo chose the rewrite: the title and description below. The live
description links PR #1111, and says "the shared Green Goods domain" instead of the bare domain,
which Linear turns into a link. The PRD-1107 mention round-tripped, and the issue stayed in
Backlog.

---

**Proposed title:** Keep older passkey accounts working on every site, without new accounts

About 70 people made a Green Goods passkey before the passkey directory went live in 2.0
(PRD-1107). Their accounts still work, but only where they started:

- **About 45 made in the app, January to early August.** Their passkeys already belong to
  greengoods.app, so a browser offers them on every Green Goods site. But the account record
  lives only in the browser that made it, so nobody can sign in to them by name on admin, on
  another device, or after clearing site data.
- **About 23 made through the hosted passkey server, August to 13 October.** About 15 were made
  on www and 8 on beta, and each passkey works only on the site that made it.
- **Three staging test sign-ups from June and July**, which can no longer sign in by name.

Moving these people to new accounts would cost them their address, gardens, roles, work history
and name, and give stewards re-adding work. A clean-room test on 16 October showed we can keep
every account instead:

1. **Add an older account to the directory** once the person proves they hold the passkey. It
   then signs in by name on every site its passkey reaches, at the same address.
2. **Publish a related-origins file on www and beta**, so a passkey tied to one of them works on
   the other Green Goods sites in browsers that support it. Arbitrum's passkey validator accepts
   those signatures.

The plan, its proof and eight decisions are in `.plans/backlog/passkey-account-continuity`.

**To decide**

- Keep accounts instead of moving them (recommended), with moving kept as a support fallback.
- Add accounts during the next sign-in on their home site, plus one button for people who stay
  signed in.
- Ask for a new name when an older account's name has since been taken.
- Drop the three staging test accounts once their owners are confirmed.

**Done when**

- An older account made on www signs in by name on admin and approves a garden action from the
  same address, on Android and on iPhone.
- A passkey made on beta signs in on www once the related-origins file is live.
- Nobody was asked to make a new account, except through the support fallback.
