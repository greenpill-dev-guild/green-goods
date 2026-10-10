# Agent reporting core: PR #2 capability record

**Date:** 27 September 2026
**Branch:** `feature/agent-reporting-core`, stacked on `chore/whatsapp-prototype-scope-lock` (PR #864) at pinned
parent `8457b8aa2f82b4de41bd8de1551d7d9f5a36da8e`
**Builder:** Opus 5.5 (Claude). **Independent review (Astra):** not yet performed.

PR #2 delivers the transport-independent reporting core: Shared domain rules, the Agent coordinator,
SQLite stores and workers, content processing, browser ceremonies, owner publication, steward review,
restricted delegation (disabled), privacy and recovery, plus a loopback driver. Everything below is
implemented and exercised against real SQLite and the real Hono routes with fixture ports. Nothing
has been live-tested: no WhatsApp number, model provider, wallet prompt, Pinata upload or Arbitrum
transaction was used, and nothing was deployed or broadcast.

## 1. Three-PR boundary

| PR | Branch | Scope |
| --- | --- | --- |
| #1 (#864) | `chore/whatsapp-prototype-scope-lock` | Scope lock, this hub and the accepted brief. Unchanged by PR #2 and not merged. |
| #2 | `feature/agent-reporting-core` | This record: the reporting core, browser ceremonies and reproducible API testing. Synthetic transports only. |
| #3 | next | Chat channels: WhatsApp (Meta webhook verification and ingress, media download, outbound sends and templates, provisioning) and Telegram on the existing bot. See section 6. |

Excluded from all three by the task: EIP-7702, new-account onboarding, passkey or Profile wallet
linking, live SMS, WhatsApp groups, and contract or indexer changes. Telegram was excluded too until
28 September, when it was moved onto this architecture alongside WhatsApp.

## 2. Capability record

*Implemented*: production code path exists. *Fixture-tested*: proven through real SQLite and routes
with fixture ports (chain, catalog, transport, wallets, models). *Live-tested*: exercised against a
real provider, wallet or chain. *State*: how the capability ships.

| Capability | Implemented | Fixture-tested | Live-tested | State |
| --- | --- | --- | --- | --- |
| Story-first drafts, Action clarification, fixed fields, corrections, revisions, confirmation tokens | Yes | Yes | No | Off until an operator turns on the `intake` control |
| Every garden accepts reports: the Agent's chain's gardens from the indexer, without placeholders or gardens hidden everywhere, paged in chat | Yes | Yes (fixture indexer responses) | No | On |
| Durable inbox, conversation leases with fencing, revision CAS, jobs, outbox, retries, restart recovery, operator controls | Yes | Yes | No | On |
| Chat channels: WhatsApp and Telegram in code, intake only while a channel's operator control is on, replies and downloads routed by channel | Yes (adapters in PR #3) | Yes (channel intake and routing) | No | No adapter until PR #3; each channel starts closed |
| Jev typed decisions and OpenAI Responses extraction with deterministic fallback questions | Yes | Yes (scripted responses) | No | Off: no model is pinned in code yet; then a key and the `model_processing` control |
| Photos: byte detection, sanitizing, metadata stripping, private originals | Yes | Yes (real Sharp) | No | On |
| PDF and Word reading with page provenance | Yes | Yes (real Poppler for page counts; scripted extraction) | No | Off (`documents` control) |
| Office-to-PDF conversion | Yes | Orchestration only (fake converter) | No | Unavailable: LibreOffice is not in the image, so Word files are read as native text (decision needed) |
| XLSX and CSV with exact cells, visible-literal arithmetic and hidden-content flags | Yes | Yes (real ExcelJS) | No | On with model processing |
| Voice notes: separate consent, ffmpeg normalization, OpenAI Audio transcription, transcript shown back | Yes | Yes (real ffmpeg; scripted transcription) | No | Off (`voice` control); needs a transcription model pinned in code |
| EOA account proof and pairing through chat | Yes | Yes (real EIP-191 signatures) | No | On |
| Kernel account proof (ERC-1271 and counterfactual ERC-6492) | Yes | Fixture verifier | No | Needs RPC proof on Arbitrum |
| Browser sessions, CSRF, exact Origin, no-store responses | Yes | Yes | No | On |
| Recovery to a new chat with one winning epoch | Yes | Yes | No | On |
| Browser ceremony pages and Shared hooks | Yes | Hook tests, the shipped client against the real API, Storybook and mock-auth localhost render | No | Needs authenticated wallet and passkey signing proof |
| Owner publication: frozen envelopes, independent envelope check, attempts, outcomes, watchdog, receipt and range reconciliation | Yes | Yes (fake chain decoding real EAS calldata) | No | Needs a real Arbitrum receipt and Pinata upload |
| Steward review with human attribution, no self-review, operator role | Yes | Yes | No | Needs a real receipt |
| Kernel reporting and review grants, restricted executor, budgets, pause | Yes (Agent) | Yes (fixture module, signer and chain) | No | **Disabled**: no verified module entry; browser permission setup and section 9.3 owner revocation are not built |
| Consents, withdrawal, 24-hour pre-consent expiry, 7-day draft expiry, receipt-gated cleanup | Yes | Yes | No | On |
| Telemetry: link locators redacted, no recordings on ceremony pages | Yes | Unit tests | No | On |
| Vercel `/api/messaging` proxy and private headers | Configured | Config tests | No | Needs deployed proof |
| Loopback driver, walkthrough, executable requests and samples | Dev only | Yes | Not applicable | Refuses production, binds to 127.0.0.1 |

## 3. Section 12.1 acceptance coverage

| Fixture or interaction | Evidence in this PR |
| --- | --- |
| Story plus photo; ambiguous Action; correction | `report-flow`, `media`, `resilience` (stale model result replanned), `driver` walkthrough |
| Scanned receipt, PDF report and DOCX | `media` (PDF page provenance, over-long PDF, native Word text, Word conversion); `documents` with real Poppler. Scanned-image OCR quality is a live evaluation |
| XLSX/CSV with mixed units, hidden sheet, stale formula | `media-parsing`, `media` (totals from visible literal cells, never a cached formula or the model) |
| EOA publication vs passkey Kernel permission | `publish-owner` (EOA), `resilience` (Kernel owner path by UserOperation), `delegated` (granted path) |
| Steward review and report-only grant | `review-flow` (no self-review, operator role); `delegated` (a reporting grant never stands in for a review or another garden) |
| Duplicate event, delayed model result, restart | `report-flow`, `resilience` |
| Timeout after fake broadcast | `publish-owner` (event scan without a callback, uncertain no-hash attempt, unmined reported hash stays pending) |
| Automatic DOCX/XLSX conversion | Orchestration only. Real conversion fixtures wait on the LibreOffice decision |
| Resource or consent mismatch; revised Action snapshot | `report-flow` (bound revision), `privacy` (signing blocked after withdrawal), Shared report rules |
| Instructions change after reservation or while a send is pending | `resilience` (owner branch) and `delegated` (delegated branch) |
| Recovery from a new chat | `recovery`, `ceremony-client` |
| Rejected versus uncertain send | `publish-owner`, Shared hook tests (declined wallet is "not sent"; unknown stays uncertain) |
| Existing EOA and existing Kernel account | `publish-owner`, `resilience`; no account creation anywhere |
| WhatsApp and synthetic Telegram envelopes | `resilience` (same rules, channel-bound pairing) |
| HMAC rotation and racing identity insert | `resilience` |
| No-hash terminal failure, lost outcome POST and reload | `publish-owner` (late hash), `ceremony-client` (replayed outcome), Shared hook test (undelivered outcome replayed after reload) |
| Prepared or queued operation followed by publication pause | `publish-owner` (owner reservation refused), `delegated` (prepared delegated report held, then sent after resuming) |

The live walkthrough items at the end of section 12.1 (WhatsApp Web, desktop and mobile wallets,
real receipts, removed roles on chain) need the live gates below.

## 4. Remaining live gates

1. The WhatsApp and Telegram channels (PR #3), with WhatsApp provisioning.
2. Authenticated browser proof of wallet and passkey signing on the ceremony pages, in Brave.
3. Real Arbitrum work and review attestations with matching receipts, including a Kernel UserOperation
   found by the bounded event scan within the RPC's log-range limits; Pinata uploads.
4. Kernel ERC-1271 and ERC-6492 proof verification against Arbitrum RPC.
5. Deployed Vercel proxy, cookie, Origin and header proof against the deployed Agent. Vercel's
   request logs record page paths, locator included; confirm their retention and access before live
   links go out.
6. OpenAI and Jev models evaluated on consented or synthetic files, including voice, then pinned in
   code (`PINNED_MODELS` in `packages/agent/src/services/reporting/config.ts`).
7. The indexer's garden list on Arbitrum (names, hidden gardens) and steward review, which reads
   chain roles for every garden in turn.
8. The Agent image built in CI with the pinned Poppler and ffmpeg; its size increase is not yet measured.
9. Delegation: module compatibility, custody, measured gas caps, browser permission setup and
   section 9.3 owner revocation with the Agent unavailable. Delegation stays disabled until all pass;
   its sender will need a bundler setting then.
10. Before tester intake: the support rehearsal, processor terms and the remaining retention schedule.

## 5. Configuration

Only secrets are settings. This branch declares them in an "Agent reporting" section at the end of
the root `.env.schema` (on develop the file becomes `env.schema`, which agents can edit). Their
1Password references still need adding to `.env.template` as `op://` values once the items exist.

```dotenv
AGENT_REPORTING_KEYS=
AGENT_REPORTING_OPENAI_API_KEY=
AGENT_REPORTING_JEV_API_KEY=
```

- `AGENT_REPORTING_KEYS` turns reporting on once a chat channel is available. It takes
  `version:base64key` entries separated by commas, each key 32 bytes, current first. It is plural
  because rotation adds a new first entry while older entries keep earlier data readable. Each
  entry's encryption and lookup keys are derived separately (HKDF). Losing it makes stored reports
  and chat identities unreadable, so keep it and only ever rotate it.
- The OpenAI and Jev keys are used once a model is pinned in code, which none is yet.
- Chat channels bring their own credentials: WhatsApp's arrive with PR #3, and Telegram uses the
  existing `TELEGRAM_BOT_TOKEN`. A channel takes reports only while its operator control is on.
- The browser origin is fixed in code: `https://www.greengoods.app` in production, where people's
  passkeys live, and the Client dev server, `https://localhost:3001`, elsewhere. The loopback driver
  and the tests set their own (`REPORTING_DRIVER_ORIGIN` for the driver).
- Reporting keeps its database and private media beside the Agent's own database (`DB_PATH`, which
  is `/data/agent.db` on the Fly volume). Publication uploads use the existing `PINATA_JWT`, and
  `PINATA_UPLOADS_API_URL` is optional.
- Every garden accepts reports; there is no garden list to configure.
- Operator decisions are controls, not settings: `POST /reporting/ops/controls/:name` with the Agent
  API bearer token and `{ "enabled": true, "reason": "..." }`, for `intake`, `model_processing`,
  `documents`, `voice`, `publication`, `outbound_messages`, `channel_whatsapp` and
  `channel_telegram`. A new database starts with all of them off except `outbound_messages`.

To create the key without printing it, store it in 1Password and stage it on Fly (it applies with
the next deploy):

```bash
op item create --category=password --title="Green Goods agent reporting keys" --vault="<vault>" password="k1:$(openssl rand -base64 32)"
fly secrets set --stage -a green-goods AGENT_REPORTING_KEYS="$(op read 'op://<vault>/Green Goods agent reporting keys/password')"
```

## 6. PR #3 handoff: WhatsApp and Telegram channels

- Register each adapter in `CHANNEL_ADAPTERS` in `packages/agent/src/runtime/reporting-startup.ts`
  under `whatsapp` and `telegram`; its connector returns the adapter when the Agent has the
  channel's credentials. `routeChannels` already sends each reply and download to the channel its
  realm names (`whatsapp:<phone-number-id>`, `telegram:<bot-id>`).
- Inbound: verify the provider request before parsing (WhatsApp's `X-Hub-Signature-256` over the
  raw body; the bot's existing Telegram webhook secret), normalize messages and statuses into the
  existing inbound event types, and hand them to `acceptChannelEvent`. It persists before
  acknowledgement, refuses messages while the channel's control is off (`channel_closed`) and
  always takes delivery statuses, which reach `applyDeliveryStatus`.
- Telegram runs on the existing bot. While `channel_telegram` is on, its direct messages go to
  reporting; on `channel_closed` the bot's current handlers keep serving them. Decide which of the
  bot's own report commands (submit, approve, reject, pending, status) retire once reporting covers
  them; group capture and joining stay with the bot. Telegram's `callback_data` holds at most 64
  bytes, so reply IDs must fit.
- Media: implement `InboundMediaFetcher` per channel (authenticated Graph API media URLs; Telegram
  `getFile` with the bot token) with the byte and time limits the media job passes; refuse
  redirects to other hosts.
- Outbound: implement `OutboundTransport.send` with the outbox idempotency key; map provider
  failures to `retryable`, `terminal` or `uncertain`. Buttons arrive as `choices` with reply IDs.
  WhatsApp lists hold at most 10 rows with short titles, while the core pages choices 10 at a time
  plus "More options" and garden names are steward-editable: set `choicePageSize` to 9 and shorten
  long labels. Add WhatsApp template messages for the 24-hour window.
- Local end-to-end tests: outside production, ceremony links point to `https://localhost:3001`,
  which a phone cannot open; use the loopback driver, or a tunnel for both the Agent and the Client.
- Provisioning: Meta app, test number, webhook subscription and Fly secrets.
- Keep `mountSyntheticIngress` and the driver out of `createServer`; they are test composition.

## 7. Decisions for Afolabi

Decided on 27 and 28 September 2026: every garden accepts chat reports (this replaces the TAS and
Aiyeloja Family Garden prototype choice); the reporting settings shrink to the three secrets above;
chat channels are switched on by operator controls; the browser origin is fixed to
`https://www.greengoods.app`; and Telegram moves onto this architecture with WhatsApp, on the
existing bot.

- LibreOffice: install `libreoffice-writer-nogui` and `libreoffice-calc-nogui` (the approved
  `libreoffice-core` alone cannot convert), or keep Office conversion disabled.
- Pin the OpenAI extraction and transcription models and the Jev model in code after evaluation.
- Which of the Telegram bot's own report commands retire once Telegram reporting is on (section 6).
