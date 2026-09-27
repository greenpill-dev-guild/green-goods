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
| #3 | next | WhatsApp transport: Meta webhook verification and ingress, media download, outbound sends and templates, provisioning. See section 6. |

Excluded from all three by the task: EIP-7702, new-account onboarding, passkey or Profile wallet
linking, live Telegram or SMS, WhatsApp groups, and contract or indexer changes.

## 2. Capability record

*Implemented*: production code path exists. *Fixture-tested*: proven through real SQLite and routes
with fixture ports (chain, catalog, transport, wallets, models). *Live-tested*: exercised against a
real provider, wallet or chain. *State*: how the capability ships.

| Capability | Implemented | Fixture-tested | Live-tested | State |
| --- | --- | --- | --- | --- |
| Story-first drafts, Action clarification, fixed fields, corrections, revisions, confirmation tokens | Yes | Yes | No | On with the intake switch |
| Durable inbox, conversation leases with fencing, revision CAS, jobs, outbox, retries, restart recovery, operator controls | Yes | Yes | No | On |
| Jev typed decisions and OpenAI Responses extraction with deterministic fallback questions | Yes | Yes (scripted responses) | No | Off until keys, a pinned model and the model-processing switch |
| Photos: byte detection, sanitizing, metadata stripping, private originals | Yes | Yes (real Sharp) | No | On |
| PDF and Word reading with page provenance | Yes | Yes (real Poppler for page counts; scripted extraction) | No | Off (`AGENT_REPORTING_DOCUMENTS_ENABLED`) |
| Office-to-PDF conversion | Yes | Orchestration only (fake converter) | No | Off; LibreOffice is not in the image (decision needed) |
| XLSX and CSV with exact cells, visible-literal arithmetic and hidden-content flags | Yes | Yes (real ExcelJS) | No | On with model processing |
| Voice notes: separate consent, ffmpeg normalization, OpenAI Audio transcription, transcript shown back | Yes | Yes (real ffmpeg; scripted transcription) | No | Off (`AGENT_REPORTING_VOICE_ENABLED`), needs a pinned transcription model |
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

1. WhatsApp transport and provisioning (PR #3).
2. Authenticated browser proof of wallet and passkey signing on the ceremony pages, in Brave.
3. Real Arbitrum work and review attestations with matching receipts; Pinata uploads.
4. Kernel ERC-1271 and ERC-6492 proof verification against Arbitrum RPC.
5. Deployed Vercel proxy, cookie, Origin and header proof against the deployed Agent. Vercel's
   request logs record page paths, locator included; confirm their retention and access before live
   links go out.
6. Pinned OpenAI and Jev models evaluated on consented or synthetic files, including voice.
7. The Agent image built in CI with the pinned Poppler and ffmpeg; its size increase is not yet measured.
8. Delegation: module compatibility, custody, measured gas caps, browser permission setup and
   section 9.3 owner revocation with the Agent unavailable. Delegation stays disabled until all pass.
9. Before tester intake: the support rehearsal, processor terms and the remaining retention schedule.

## 5. Configuration to add to the root `.env.schema`

Agents cannot edit `.env.schema`. These are the settings the Agent reads; secrets should follow the
file's existing `_OP_REF` pattern, and every switch starts off.

```dotenv
AGENT_REPORTING_ENABLED=false
AGENT_REPORTING_TRANSPORT=
AGENT_REPORTING_DB_PATH=data/reporting.db
AGENT_REPORTING_MEDIA_DIR=data/reporting-media
AGENT_REPORTING_ENCRYPTION_KEYS=
AGENT_REPORTING_ENCRYPTION_KEY_VERSION=
AGENT_REPORTING_LOOKUP_KEYS=
AGENT_REPORTING_LOOKUP_KEY_VERSION=
AGENT_REPORTING_BROWSER_ORIGIN=https://www.greengoods.app
AGENT_REPORTING_GARDENS=
AGENT_REPORTING_SUPPORT_CONTACT=afo@wefa.world
AGENT_REPORTING_INTAKE_ENABLED=false
AGENT_REPORTING_JEV_API_KEY=
AGENT_REPORTING_JEV_BASE_URL=https://api.typesafe.ai
AGENT_REPORTING_JEV_MODEL=jev-latest
AGENT_REPORTING_OPENAI_API_KEY=
AGENT_REPORTING_OPENAI_BASE_URL=https://api.openai.com/v1
AGENT_REPORTING_OPENAI_MODEL=
AGENT_REPORTING_OPENAI_TRANSCRIPTION_MODEL=
AGENT_REPORTING_BUNDLER_RPC_URL=
AGENT_REPORTING_DOCUMENTS_ENABLED=false
AGENT_REPORTING_CONVERSION_ENABLED=false
AGENT_REPORTING_VOICE_ENABLED=false
AGENT_REPORTING_WORKER_INTERVAL_MS=2000
```

`AGENT_REPORTING_GARDENS` takes `key|0xaddress|Label` entries separated by `;`. The encryption and
lookup key settings take `version:base64key` entries separated by commas, each key 32 bytes, and the
`_VERSION` setting names the one used for new writes. Publication uploads use the existing
`PINATA_JWT`; `PINATA_UPLOADS_API_URL` is optional and defaults to `https://uploads.pinata.cloud/v3`.

## 6. PR #3 handoff: WhatsApp transport

- Implement a `TransportAdapter` and register it in the `TRANSPORTS` map in
  `packages/agent/src/runtime/reporting-startup.ts`; `AGENT_REPORTING_TRANSPORT` selects it and
  startup refuses to run reporting without one.
- Inbound: verify `X-Hub-Signature-256` over the raw body before parsing, normalize messages and
  statuses into the existing inbound event types, and hand them to `acceptInboundEvent`, which
  persists before acknowledgement. Statuses reach `applyDeliveryStatus` in `delivery-status.ts`.
- Media: implement `InboundMediaFetcher` against authenticated Graph API media URLs with the byte and
  time limits the media job passes; refuse redirects to other hosts.
- Outbound: implement `OutboundTransport.send` with the outbox idempotency key; map provider
  failures to `retryable`, `terminal` or `uncertain`. Buttons arrive as `choices` with reply IDs.
  Add template messages for the 24-hour window.
- Provisioning: Meta app, test number, webhook subscription and Fly secrets.
- Keep `mountSyntheticIngress` and the driver out of `createServer`; they are test composition.

## 7. Decisions for Afolabi

- LibreOffice: install `libreoffice-writer-nogui` and `libreoffice-calc-nogui` (the approved
  `libreoffice-core` alone cannot convert), or keep Office conversion disabled.
- Pin the OpenAI extraction and transcription models after evaluation.
- The canonical browser origin; ceremonies work only on the origin the Agent is configured with, so
  the beta frontend cannot run them against the production Agent.
