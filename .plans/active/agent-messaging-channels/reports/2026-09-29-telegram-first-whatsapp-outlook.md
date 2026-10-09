# Telegram first, and the way back to WhatsApp

**Date:** 2026-09-29 · **Author:** Opus 5.5 (Claude), for Afolabi · **Branch:** `feature/agent-reporting-telegram` (PR #3, stacked on #934)

The WhatsApp Business account is disabled, so reporting runs on Telegram, on the Agent's existing
bot. The reporting core was built without depending on a chat provider, so nothing in #934 changes.
WhatsApp stays a defined channel with its control off, and its adapter waits for a working account.

## What happened

Afolabi reported on 29 September that the WhatsApp Business account had been disabled. It follows
the business portfolio restriction of 19 September (GROW-57), whose review had been open since
that day. Still to confirm and record here: which asset Meta disabled (the WhatsApp Business
Account or the whole WEFA portfolio), when, and the reason Meta gave.

## Decisions (29 September, Afolabi)

- The buildathon demo and the reporting channel run on Telegram, as planned on 27 September
  (PRD-1010). WhatsApp is presented as the next channel, not the live one.
- The local demo runs on the **production bot**. PRD-1010 had said a separate demo bot and never
  the production token; this reverses that, with the takeover and restore steps below.
- The demo's browser step happens on the laptop: Telegram Desktop plus Brave with a wallet
  extension at `https://localhost:3001`. No browser-origin setting comes back.
- While `channel_telegram` is on, reporting takes **every private chat**, `/start` included. The
  bot's own `/start` creates a custodial wallet, which this design rules out. Groups stay with the
  bot's capture handlers. Removing the bot's old private-chat code is a later cleanup.

## What PR #3 builds

- `packages/agent/src/platforms/telegram-reporting.ts`: the Telegram channel adapter.
  - Private-chat updates become the core's inbound events, keyed by chat and message ID so an update
    Telegram delivers twice is one event. Button presses carry only the core's reply ID.
  - Slash commands become the core's command words (`/start` is START, `/confirm 1234` is
    CONFIRM 1234). A command the core does not know, such as the old `/approve`, gets the help reply.
  - Replies go through the core's outbox. Choices become buttons, a public link becomes a link
    button, and a local link goes in the text. Text over Telegram's 4096-character limit goes out in
    parts, with the buttons on the last. Rate limits and Telegram failures are retried, refusals are
    final, and a lost response is uncertain.
  - Media downloads through `getFile` within the core's 10 MB and 30-second limits. Redirects and
    files off Telegram's API host are refused.
- `packages/agent/src/platforms/telegram.ts`: the bot runs reporting's middleware first. A storage
  failure is rethrown, so the webhook answers 500 and Telegram delivers the update again.
- `packages/agent/src/runtime/reporting-startup.ts`: the `telegram` adapter registers whenever the
  Agent runs its Telegram runtime, and reports which channels started.
- `packages/agent/src/index.ts`: reporting starts before the bot. Polling now starts after the HTTP
  server. Telegraf 4.16.3's polling `launch()` settles only when polling stops, so an Agent in
  polling mode never started its HTTP API; production runs in webhook mode and was unaffected.
- `packages/client/vite.config.ts`: `REPORTING_AGENT_URL` points the dev proxy at a running Agent
  (it rewrites `/api/messaging` to `/messaging`, as the Vercel rewrite does).

**Fixture-tested, not live-tested.** A loopback Bot API drives the real Telegraf client, bot and
reporting core. No message has passed through Telegram itself.

## Local demo (laptop, production bot)

The demo wallet needs the gardener role in the demo garden on Arbitrum One and some ETH for gas.
Passkeys only work on greengoods.app, so sign with the wallet.

The root `.env` needs the following:
- `TELEGRAM_BOT_TOKEN`: the production bot.
- `AGENT_REPORTING_KEYS`: a local key list, for example `k1:` followed by `openssl rand -base64 32`.
- `BOT_API_TOKEN`: authenticates the operator controls.
- `PINATA_JWT`: uploads the evidence.
- `VITE_CHAIN_ID=42161`, with the Arbitrum RPC and indexer settings the Agent already reads.

Leave `AGENT_DISABLE_TELEGRAM_RUNTIME` unset. Model processing stays off because no model is pinned,
so the chat asks every question itself.

1. Start the Agent on a free port. From this moment the production bot's updates come to the
   laptop, because Telegraf deletes the bot's webhook when polling starts.

   ```bash
   PORT=3100 bun run --cwd packages/agent dev
   ```

2. Turn on intake, publication and the Telegram channel.

   ```bash
   for control in intake publication channel_telegram; do curl -sS -X POST "http://127.0.0.1:3100/reporting/ops/controls/$control" -H "Authorization: Bearer $BOT_API_TOKEN" -H "content-type: application/json" -d '{"enabled":true,"reason":"buildathon demo"}'; done
   ```

3. Start the Client against that Agent.

   ```bash
   REPORTING_AGENT_URL=http://127.0.0.1:3100 VITE_CHAIN_ID=42161 bun run --cwd packages/client dev
   ```

4. In Telegram Desktop, send `/start` to the bot.
   1. Agree to the notice, tell the story, pick the garden and the action, answer the questions and
      send a photo.
   2. Confirm the summary.
   3. The browser links arrive as text because they are local. Open each in Brave: verify the
      wallet, send `PAIR` with its code, send `PUBLISH`, then sign the attestation.
   4. The confirmation comes back in the chat once the attestation is on Arbitrum One.

5. Stop the local Agent, then restart the production Agent. It registers its webhook again when it
   starts.

   ```bash
   fly apps restart green-goods
   ```

While the local Agent polls, everyone's updates to the production bot reach the laptop. Until step
2, other people's private chats reach the bot's own handlers there; afterwards they get the consent
notice from the laptop. Group topic captures land in the local database. Keep the window short. If
the production Agent restarts during the demo, it takes the webhook back, and the local Agent's
polling stops with a conflict and shuts it down.

## The way back to WhatsApp

**Appeal first.** Meta's
[WhatsApp Business Account enforcement guide](https://developers.facebook.com/docs/whatsapp/overview/policy-enforcement)
routes appeals through Business Support Home: select the WhatsApp Business Account, choose the
violation and request a review. A decision usually arrives in Business Manager within 24 to 48 hours,
and not every violation can be appealed. GROW-57's checklist still applies:
- the portfolio's website matches Business Info;
- the privacy policy covers messaging opt-in and opt-out;
- business verification is submitted for WEFA.

GROW-57 also warns that new apps, portfolios or numbers during a review can turn a short hold into a
long one.

**What stays ready.** None of this work is lost.
- The core is provider-independent. `whatsapp` stays a channel with its `channel_whatsapp` control
  off and no adapter registered.
- Section 6 of the
  [capability record](2026-09-27-reporting-core-capability-record.md) remains the adapter's spec:
  `X-Hub-Signature-256` over the raw body, Graph API media, list limits (`choicePageSize` 9), and
  template messages for the 24-hour window.
- Telegram exercises none of those four, and it has no delivery receipts, so the WhatsApp adapter
  still owes its own proof.

**Decisions if the appeal fails.** Confirm with Meta support first whether assets linked to the
disabled account are affected. Meta's guide does not say.
1. **Another business runs the number.** For example, a partner organization in the pilot region,
   with Green Goods as its technology provider. This is GROW-57's open question (does the account stay
   under WEFA for the pilot?), now the main one. Meta's rules for technology providers need
   checking first.
2. **A business solution provider** such as Twilio. It still needs a WhatsApp Business Account under a
   Meta portfolio in good standing, so it does not route around a disabled account.
3. **Stay on Telegram for the pilot.** The Nigeria pilot was WhatsApp-first for TAS (A1), and SMS is
   already ruled out there (two-way SMS is unsupported and MMS cannot carry report photos). Whether
   the pilot's gardeners use Telegram is unknown.

**Buildathon.** The entry described WhatsApp reporting. The submission should present Telegram as
the live channel and WhatsApp as the next one, pending Meta's decision. Registration closes Friday
2 October at 10:01 PT and submission Sunday 4 October at 08:59 PT.

## Open items

| Item | Owner |
| --- | --- |
| Record which asset Meta disabled, when and why; appeal from Business Support Home | Afolabi |
| Live demo run on the production bot, then restore its webhook | Afolabi |
| Linear: PRD-1010 to In Progress with the production-bot decision; GROW-57 outcome; PRD-943 blocked on the account | Drafted for Afolabi's approval, not posted |
| Which of the bot's old private-chat commands and code to delete now that reporting takes private chats | Afolabi, after the demo |
| Telegram's command menu still lists the old commands (the core answers unknown ones with help) | Follow-up with that cleanup |
