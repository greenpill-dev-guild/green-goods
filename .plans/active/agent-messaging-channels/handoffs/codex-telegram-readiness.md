# Telegram-first implementation and live-session handoff

**Updated:** 2026-10-02
**Owner:** Codex; Afolabi owns live testing and deployment
**Branch:** `feature/agent-reporting-telegram` (PR #949, stacked on #934 and #864)
**State:** implementation and integration validation in progress; deployment unrun

This is the current execution handoff. It supersedes the laptop polling demo in the
[earlier Telegram handoff](claude-telegram-channel.md). Keep the production bot in webhook
mode and use the deployed browser origin for live testing. Do not start local polling with
the production bot token: that would displace its webhook.

## Accepted behavior

- Existing gardeners send private Telegram text, photos, PDF, DOCX, CSV or XLSX evidence.
  Corrections and the final report confirmation stay in chat. OpenAI extracts content;
  Jev makes bounded routing judgments; the deterministic field walk handles provider failure.
- The browser provides account proof, same-chat pairing, exact publication/review signing,
  optional verified Kernel permission installation, outcome checking, and recovery.
  PWA installation is unnecessary. A wallet proof or paired session never grants membership
  or signing authority by itself.
- A person can attach one active Telegram and one active WhatsApp channel to the same proven
  account. Pairing transfers only a provisional identity with no account/signing history.
  Replacing a chat requires recovery and does not replace the other channel's conversation.
- New reporting databases enable intake, documents, model processing, publication and Telegram.
  Existing operator decisions survive upgrades. Voice and WhatsApp stay off.
- Kernel reporting remains limited to five publications in 24 hours, for one garden and channel.
  Review is a separate permission and needs its own effects/work-reference proof. No grant is
  offered until the deployed module registry, full cost budget and signer custody gates pass.

## Models and root environment

Pinned snapshots are `gpt-4.1-mini-2025-04-14`,
`gpt-4o-mini-transcribe-2025-12-15`, and `jev-1.13.0`. Environment values cannot change
those model versions. The transcription snapshot is prepared; voice remains disabled.

Use the root `env.template` and `env.schema`. Required reporting/provider values are:

| Variable | Purpose |
| --- | --- |
| `AGENT_REPORTING_KEYS` | Versioned wrapping/HMAC key ring for private reporting state; absence keeps reporting off |
| `AGENT_REPORTING_OPENAI_API_KEY` | OpenAI extraction, document/photo interpretation, and optional transcription |
| `AGENT_REPORTING_JEV_API_KEY` | Jev bounded routing |
| `AGENT_REPORTING_SIGNER_KEYS` | Separate versioned wrapping ring for per-grant delegated signer files; required only for delegation |

Store references to actual approved 1Password fields, not plaintext secrets, in the template.
The 1Password lookup was dismissed in this session; no references were discovered and no live
model credentials were installed. Do not invent vault items. Before `bun run env:sync`, reconcile
the root template with existing settings because that command rewrites the root `.env`.
Do not create package environment files. Keep old wrapping versions during key rotation so
existing records remain readable; never reuse the reporting wrapping material as signer material.

The provider-only walkthrough evaluates synthetic English, Spanish and Portuguese examples,
including corrections, unstated values and status requests. Record latency, usage, accepted values,
fallback rate and the command's estimated OpenAI text cost. Jev cost is not measured by that estimate.
Run from the repository root after the key references are resolved:

```sh
bun --env-file=.env packages/agent/src/__tests__/reporting/driver/walkthrough.ts --models
```

Delegation also needs the existing `VITE_PIMLICO_API_KEY` (or server `PIMLICO_API_KEY`)
and `VITE_PIMLICO_SPONSORSHIP_POLICY_ID` (or server `PIMLICO_SPONSORSHIP_POLICY_ID`).
These are already declared; do not invent a sponsorship policy. Deployed policy/paymaster pins
and measured gas/wei budgets come from the verified module registry, never arbitrary environment values.
No quality or optimization claim is established without the real provider run.

## Remote API and browser flow

The Client proxies `/api/messaging/:path*` to the Agent's `/messaging/:path*` routes.
Deploy both the Agent and Client changes; the current production Agent has not loaded this feature.

1. Telegram stores the event/draft, asks for missing Action inputs, and issues a purpose-bound link.
2. An explicit browser action creates a challenge with the expected Origin and bootstrap header.
3. The connected account proves ownership through the existing EOA/ERC-1271/ERC-6492 verifier.
4. A code entered in the source chat binds that proof to the channel. The browser receives a
   short-lived scoped session; state changes require its CSRF header.
5. The browser reads the named draft/review and private media, validates the exact prepared
   envelope, and uses the existing owner sender. An approved Kernel installation instead saves
   its public revocation descriptor before asking the owner to install the permission.
6. Durable attempt references and independent receipt reconciliation determine publication.
   An uncertain send stays reserved; refreshing a page or restarting the Agent cannot create
   a second publication or another budget reservation.

Relevant route families: `/messaging/challenges`, `/messaging/access`,
`/messaging/drafts/:id`, `/messaging/reviews/:id`, `/messaging/media/:id`,
`/messaging/operations/:id`, `/messaging/execution-grants`, and `/messaging/recovery/:id`.
Browser pages are `/agent/reporting/:requestId`, `/agent/reporting/recover/:requestId`,
and `/agent/reporting/permissions`. The permissions page reads public RPC and uses the owner
sender without an Agent connection. Kernel nonce invalidation affects all non-root permissions,
including those from other applications; the confirmation discloses this before signing.

## Deployment and bot checklist

1. Finish current-head local/CI validation; keep all three PRs as drafts until reviewed.
2. Provision the reporting/provider secrets in the existing Fly application and Client configuration.
   Retain the existing bot token, webhook secret, Pinata configuration, encrypted `/data` volume,
   single-machine topology, and chain `42161`. Ensure volume capacity for bounded private media.
3. Build and smoke-test the pinned Office image. Verify that the Fly runtime supports the
   bubblewrap namespaces, convert a synthetic DOCX and XLSX, and inspect the resulting PDF.
   Converter unavailability preserves native extraction; unsafe files never run unsandboxed.
   This host has no Docker/LibreOffice, so actual container conversion is still pending.
4. Deploy the Agent and Client and verify HTTPS, no-store/security headers, the Client proxy,
   private preview scope and origin/cookie behavior. A 200 HTML SPA fallback is not API proof.
5. Use authenticated `/reporting/ops/health` and
   `POST /reporting/ops/controls/:name` (`enabled`, `reason`) to inspect persisted controls.
   Enable the intended Telegram controls explicitly if an earlier database has them paused.
6. Verify the existing bot's webhook points to `https://agent.greengoods.app/webhook/telegram`.
   The bot remains `@green_goods_bot`. No BotFather update or token rotation is needed:
   startup refreshes its private menu with the Telegram commands `start`, `status`, and `help`. Groups retain the existing path.
7. For delegation, deploy the new guard separately, record the code hash, verify the entire pinned
   Kernel/SDK/policy stack, measure gas/cost caps, prove adversarial execution and independent
   revocation, then add the verified registry entry. Source tests alone do not authorize activation.

## Aiyeloja two-account acceptance

Use Aiyeloja Family Garden `0xF7b892886998DAe960D64a9db488336684F137A0` on Arbitrum One.
Recheck actual roles for both accounts at the start of the session.

- Gardener: text plus photo, missing-field question, correction, account pairing, exact owner
  publication, durable receipt and return to chat. Declining a signature must leave a usable draft.
- Steward: find the gardener's published work, prepare approval/rejection, confirm the exact
  decision, sign as the steward and reconcile. Never approve one's own work.
- Repeat the browser flow on desktop and mobile, including reload after a reported send and
  an uncertain provider response. Record authenticated signing evidence; Storybook is layout proof.
- After the Kernel compatibility gate, install a bounded reporting grant and publish a confirmed
  report through it. Exercise expiry, fifth/sixth publication, wrong garden/channel, pause during
  an RPC read, restart, lost bundler response and direct owner removal with the Agent unavailable.
- WhatsApp needs access restored **and its live transport adapter**. The dual-channel identity
  architecture and synthetic tests do not constitute a deployed WhatsApp integration.

## Validation receipt

Pending the final integration commit and current-head gate. Focused development runs and
Storybook (Codex in-app browser) desktop/mobile evidence are recorded by the implementation team;
they are not authenticated wallet/passkey proof or live model/Telegram proof.
