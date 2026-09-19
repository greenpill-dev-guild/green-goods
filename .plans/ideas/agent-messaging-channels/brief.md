# Messaging access for gardeners

**Status:** DRAFT; idea stage; implementation not authorized.

**Last updated:** 2026-09-11 UTC.

**Canonical architecture:** [Identity, garden workflows and provider design](spec.md).

**Delivery and proof:** [proposed sequence](plan.todo.md), [acceptance tests](eval.md).

Let gardeners prepare work in WhatsApp and continue the same activity in Green Goods, using their existing passkey or EOA where they have one. Keep the gardener's identity and history consistent across channels while each account retains its own signing authority.

The first community is TAS in Nigeria, using English. The user has accepted secure PWA confirmation for final steward approvals and binding commitments. The proposed initial reporting path also asks the gardener to review and sign each onchain work publication in the browser. A browser visit does not require PWA installation.

## The proposed experience

A new gardener sends a photo and description to the official WhatsApp sender. The bot saves a private draft, confirms the garden and offers a browser continuation. The gardener can use an existing account or explicitly create a passkey account. After secure pairing and garden admission, they review and sign the work. WhatsApp and the PWA then show the same draft and publication status.

An existing PWA user connects WhatsApp from account settings. Both the account and channel must prove possession. This creates a channel binding, not another wallet. An existing EOA user keeps the EOA as author; a passkey linked to the same profile does not gain control of that EOA.

Stewards receive minimal notifications and approve the exact published work in the PWA with their authorized account. Commitments can be prepared in chat, but the full binding terms and actual actor's signature stay in the PWA initially.

## Decisions that remain open

1. **First-time account setup:** Is a one-time browser passkey setup acceptable before publication? The user has not answered this question. RESR-75 requires verification without sign-up, so the proposed flow cannot yet claim to satisfy that criterion.
2. **Provider:** Compare direct Meta, Twilio and Africa's Talking using actual Nigeria provisioning and workflow costs. WhatsApp is the channel; Twilio is one provider. Twilio's published Nigeria guidance does not support two-way SMS, so SMS fallback is unproven.
3. **Technical proof:** Verify backend account authentication with the deployed/counterfactual Kernel configuration. Treat narrowly scoped report delegation as a later, separately reviewed option.
4. **Recovery and operations:** Total-passkey-loss recovery remains unresolved. Agree consent, retention, support ownership, budget and pilot thresholds before production collection.

## Architecture boundaries

The private participant record connects separately verified accounts and channels. Garden permissions stay attached to the exact authorized blockchain account. Phone access cannot recover a wallet, grant a garden role, change an owner or renew signing permission.

New users do not receive custodial wallets by default in this proposal. Existing Telegram users require an explicit legacy migration path: today's bot creates EOAs and holds their keys. Work/media persistence and independent work/approval recovery also need changes; this exceeds transport polish.

The first release introduces no bot authority over approvals, commitments, funds or membership. Optional reporting delegation requires demonstrable onchain restrictions and independent owner revocation. Expiry and offchain rate limits alone do not establish an adequate permission boundary.

## Success

Prove one continuous report journey across WhatsApp and PWA for both passkey and EOA users, correct garden/account authorization, recoverable failures and comprehensible consent. Measure accepted reports and total gardener, steward and support effort. Proposed pilot size and thresholds remain for TAS/research to approve.

This hub replaces the April assumptions without promoting the work from ideas. Research is captured; runtime, provider provisioning and user journeys have not been implemented or verified by this documentation pass. See the spec's evidence map and the evaluation gates for the distinction.
