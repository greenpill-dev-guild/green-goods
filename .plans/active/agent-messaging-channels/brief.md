# Messaging access for gardeners

**Status:** ACTIVE. The target architecture remains a proposal; the Buildathon prototype slice
(spec section 15.1) was scope-locked on 2026-09-21 and is authorized to build.

**Last updated:** 2026-09-22 UTC.

**Canonical architecture:** [Identity, garden workflows and provider design](spec.md).

**Delivery and proof:** [proposed sequence](plan.todo.md), [acceptance tests](eval.md).

Let gardeners prepare work in WhatsApp and continue the same activity in Green Goods, using their existing passkey or EOA where they have one. Keep the gardener's identity and history consistent across channels while each account retains its own signing authority.

The first community is TAS in Nigeria, using English — that is the pilot setting, not product
scope; the criteria are geography neutral and the prototype runs against a test cohort. The user
has accepted secure PWA confirmation for final steward approvals and binding commitments. The
proposed initial reporting path also asks the gardener to review and sign each onchain work
publication in the browser. A browser visit does not require PWA installation.

## The proposed experience

A new gardener sends a photo and description to the official WhatsApp sender. The bot saves a private draft, confirms the garden, and asks in chat for whatever the garden's chosen activity still needs — one field at a time, offering that activity's own published choices where there are any. The gardener approves the finished draft in the conversation, then follows a browser continuation. They can use an existing account or explicitly create a passkey account. After secure pairing and garden admission, they see exactly what is about to be published and sign it; the browser does not edit, because correction already happened in the chat. WhatsApp and the PWA then show the same draft and publication status.

An existing PWA user connects WhatsApp from account settings. Both the account and channel must prove possession. This creates a channel binding, not another wallet. An existing EOA user keeps the EOA as author; a passkey linked to the same profile does not gain control of that EOA.

Stewards receive minimal notifications and approve the exact published work in the PWA with their authorized account. Commitments can be prepared in chat, but the full binding terms and actual actor's signature stay in the PWA initially.

## Decisions resolved on 2026-09-21

1. **First-time account setup:** Resolved. RESR-75 criterion 1 was accepted as: zero account steps
   to reach a saved private draft, then exactly one browser passkey step before that draft becomes a
   public, gardener-signed record. No custodial wallet is created.
2. **Provider, for the prototype:** Meta WhatsApp Cloud API direct, on the free test number. The
   Twilio number is held unregistered; if used, it is registered with Meta as a phone number only.
   The WhatsApp Business Account is operated by WEFA LLC. SMS and MMS are out of scope entirely —
   Twilio does not support two-way SMS in Nigeria and MMS cannot carry report photos.
3. **Scope:** WhatsApp only, test garden, team plus invited testers, no production data, no success
   claim.

## Decisions that remain open

1. **Provider for the pilot:** Still open. Needs actual Nigeria provisioning, media, template,
   migration and cost evidence.
2. **Technical proof:** Backend account authentication against the deployed and counterfactual
   Kernel configuration is largely satisfied by code already in production for join requests and
   profile avatars, but it has not been exercised against a draft resource. Narrowly scoped report
   delegation stays a later, separately reviewed option.
3. **Recovery and operations:** Total-passkey-loss recovery remains unresolved (RESR-21). Consent,
   retention, support ownership, budget and pilot thresholds must be agreed before any production
   collection — the prototype does not need them because it collects no production data.
4. **Reading what the gardener wrote:** Whether a model should interpret a gardener's own
   description, so they are not asked again for what they already said, is proposed and unselected
   (spec P6). It is blocked on settling which inference providers may receive that text, under what
   retention and training terms (spec O6). The prototype asks its questions deterministically and
   calls no model, so nothing a gardener writes leaves Green Goods and Meta.
5. **Operating entity:** The WhatsApp Business Account sitting under WEFA is recorded, not settled.
   Whether it stays there, moves to the fiscal sponsor or a Greenpill entity, or WEFA acts as a
   named service provider, is a decision owed before the pilot.

## Architecture boundaries

The private participant record connects separately verified accounts and channels. Garden permissions stay attached to the exact authorized blockchain account. Phone access cannot recover a wallet, grant a garden role, change an owner or renew signing permission.

New users do not receive custodial wallets by default in this proposal. Existing Telegram users require an explicit legacy migration path: today's bot creates EOAs and holds their keys. Work/media persistence and independent work/approval recovery also need changes; this exceeds transport polish.

The first release introduces no bot authority over approvals, commitments, funds or membership. Optional reporting delegation requires demonstrable onchain restrictions and independent owner revocation. Expiry and offchain rate limits alone do not establish an adequate permission boundary.

## Success

Prove one continuous report journey across WhatsApp and PWA for both passkey and EOA users, correct garden/account authorization, recoverable failures and comprehensible consent. Measure accepted reports and total gardener, steward and support effort. Proposed pilot size and thresholds remain for TAS/research to approve.

This hub replaces the April assumptions. The research pass that produced it verified nothing at
runtime; the prototype slice is the first work authorized to change behaviour, and its own proof
is still unrun. See the spec's evidence map and the evaluation gates for the distinction.
