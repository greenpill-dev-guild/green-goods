# Messaging integration delivery proposal

**Feature slug:** agent-messaging-channels

**Stage:** `active`

**Status:** `ACTIVE — Buildathon prototype slice locked 2026-09-21; target architecture remains a proposal`

**Created:** 2026-04-17

**Last updated:** 2026-09-22 UTC

**Specification:** [canonical architecture](spec.md) — section 15.1 holds the prototype slice

**Evaluation:** [acceptance and failure tests](eval.md)

**Linear project:** [Agent Messaging Channels (WhatsApp + SMS)](https://linear.app/greenpill-dev-guild/project/agent-messaging-channels-whatsapp-sms-71cda634fcf7)

**Linear milestone:** Buildathon prototype — target 2026-10-02, submission 2026-10-04

**Mirror:** PRD-339 is stored historical metadata, unresolved during the 2026-09-11 research pass.
The live slice issues are PRD-943 through PRD-948 under the Buildathon prototype milestone. The
manual Linear writes described in [Linear changes](#linear-changes) **were applied on 2026-09-22**;
what remains deliberately unrun is `linear-sync` and `record-linear`, the Implementation Start Gate.
Do not repeat the manual writes.

The **Buildathon prototype** section below is an active dispatch list. The
[target delivery sequence](#target-delivery-sequence-post-prototype) after it remains a design for
scope selection, not a dispatch list.

## Gate status

RESR-75 was accepted on 2026-09-21, clearing the research gate for build. That acceptance authorizes
**the prototype only**. It does not authorize production data collection, a pilot provider decision,
reporting delegation, custodial accounts, or any SMS work.

| Gate | State | Note |
| --- | --- | --- |
| O1 no-sign-up reading | **Resolved** | RESR-75 criterion 1: zero account steps to a private draft; one browser passkey step before a gardener-signed public record. |
| O2 provider | **Resolved for the prototype** | Meta Cloud API direct, test number. Pilot provider stays open. |
| O5 consent, retention, support, thresholds | **Minimum subset required; the rest deferred** | A test garden is not the same as no personal data. Invited testers use real WhatsApp accounts, so step 3 persists a real provider identifier, steps 4 and 5 retain real photos and descriptions, and step 15 publishes that evidence irreversibly to IPFS and chain. "No production data" describes the garden, not the people. A minimum of consent-at-first-contact, abandonment deletion and a named support owner is therefore above the cut line, folded into steps 5 and 14 rather than a sixteenth step. Thresholds, the full retention schedule and support tooling stay deferred to the TAS pilot. |
| O3 deployed account-proof compatibility | **Largely answered by existing code** | See step 7. |
| O4 total-loss recovery | **Open** | RESR-21. Unchanged; the prototype makes no recovery claim. |
| O6 inference processors | **Open — not reached by this slice** | Added 2026-09-22 with spec proposal P6. No inference provider is called anywhere in steps 1 through 16: step 16 walks the action schema in code. The gate blocks P6, including a shadow-mode trial on real messages, and stays open until retention, training and regional terms are settled for every provider that would see a gardener's own description of their work. |
| Passkey server in production | **Open — blocks `ID-01`** | `isPasskeyServerEnabled` returns `false` whenever `VITE_PASSKEY_SERVER_ENABLED` is the string `false`, and defaults to `Boolean(env.PROD)` only when unset (`config/passkeyServer.ts:42-48`). The prototype's headline journey is a first-run passkey, so a deployed client bundle carrying `false` makes `ID-01` unreachable regardless of what any test reports. Decide the production value, record it here, configure the client build, and show the deployed setting before the UI lane leaves `blocked`. This is a deployment decision, not a coding step. |

## Decision log

| Decision | State | Delivery effect |
| --- | --- | --- |
| Nigeria, English, WhatsApp first for TAS | Accepted A1 | Pilot setting, not prototype scope. The prototype runs against a test cohort. |
| PWA confirmation for approvals and binding commitments | Accepted A2 | No approval or commitment keys in the messaging runtime. |
| Canonical participant with independent account/channel bindings | Proposed P1 | **Deferred past the prototype**; the slice binds a draft directly to a proven account. |
| Reuse accounts; private intake before account creation | Proposed P2, **adopted for the slice** | Explicit provisional-to-established handoff; no wallet generated because someone opened WhatsApp. |
| Owner signs work in first release | Proposed P3, **adopted for the slice** | No session validator, no delegated signer, no custodial key. |
| Reporting-only delegation later | Proposed P4 | Out of scope. Separate contract and security gate. |
| One business sender initially | Proposed P5 | Meta test number; garden scoping stays in workflow authorization. |
| WhatsApp only; SMS and MMS excluded | Locked 2026-09-21 | Twilio two-way SMS is unsupported in Nigeria; MMS cannot carry report photos. |
| Meta Cloud API direct, not Twilio | Locked 2026-09-21 | The Twilio number is only a phone number registered directly with Meta. `SEC-01` becomes `X-Hub-Signature-256`, not Twilio signature validation. |
| No custodial wallets, no delegation | Locked 2026-09-21 | `submitWorkBot` and the agent's custodial `users.privateKey` path are excluded from this slice. |
| Legacy Telegram custodial accounts out of scope | Locked 2026-09-21 | No migration, no reuse, no relabelling. |
| WhatsApp Business Account operated by WEFA LLC | Locked 2026-09-21 | Recorded in RESR-75. The entity question reopens before the pilot, not for the prototype. |
| Browser session uses a per-request signed proof, not a cookie | Locked 2026-09-21 | Supersedes the section 6 same-origin-facade proposal for this slice. See step 7. |
| Correction happens in chat; the browser authenticates, shows and signs | Locked 2026-09-22 | Steps 9 and 10 hydrate a read-only review instead of the composer, dropping share-target hydration and draft-resume wiring. New step 16 walks the garden action's required inputs in chat. |
| The action's own `Action.inputs` schema drives the walk | Locked 2026-09-22 | `options` and `bands` become WhatsApp interactive replies; `number` is validated against its declared `unit`; `text` is verbatim; `repeater` is refused. No per-garden question set is authored beside the published action. |
| Model-assisted interpretation is proposed, not built | Proposed P6 | Deferred past the prototype. Step 16 is its deterministic floor, and P6 only changes which questions the walk asks. Blocked on O6 before it may touch a real message. |

## Buildathon prototype

One builder, 2026-09-25 to 2026-10-02. Steps are in dependency order. Each is one session, at most
three or four files, with a one-sentence verification.

**Command form.** The root `bun run test` accepts only `--cache` and `--force`
(`scripts/dev/test.js:5`) and there is no root `typecheck` script, so every proof below is
package-scoped with `--cwd`. The package runner does accept positional paths
(`scripts/dev/package-commands.mjs:94,107`).

Environment added once, at step 1, as Fly secrets, never the repository, per PRD-941:
`META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID`,
`META_SYSTEM_USER_TOKEN`, `META_GRAPH_BASE_URL`, `WHATSAPP_SUBJECT_KEYRING` for step 3, and
`WHATSAPP_PROTOTYPE_GARDEN` for step 5 — the last validated at startup against the deployed chain
ID **and against its on-chain `openJoining` state**, so the agent refuses to start with intake
enabled and no garden to file drafts into. Checking the chain alone is not enough: a same-chain but
invite-only garden would pass configuration validation and then fail the headline first-run journey
at `joinGarden`, which step 12 depends on. Read `openJoining` from the garden at startup and refuse
to enable intake when it is false, so the failure surfaces as a deployment error rather than as a
gardener's first report reverting. **Capacity counts too**: `joinGarden()` reverts `GardenFull`
when `maxGardeners > 0 && gardenMemberCount >= maxGardeners`
(`packages/contracts/src/accounts/Garden.sol:233`), so an open garden that is already full fails
exactly the same way. Readiness validation checks available capacity as well as `openJoining`, and
the test covers a full open garden, not only an invite-only one.

**The subject key must be its own keyring, not a reused secret.** `ENCRYPTION_SECRET` is a single
fixed key that also protects custodial private keys (`services/crypto.ts:56-89`) and falls back to
deriving from `TELEGRAM_BOT_TOKEN` when unset, so rotating it for WhatsApp subjects would break
unrelated ciphertext. Model the new value on `JOIN_REQUESTS_ENCRYPTION_KEY` instead, which is
validated as required when its feature is enabled (`config.ts:346`), but make it a **versioned
keyring** so a subject index can be re-keyed without a rewrite: `{version, key}` entries, newest
used for writes, all retained for reads. Step 1 adds it to the root environment schema, to
`config.ts` alongside `joinRequestsEncryptionKey`, and to production validation, so the service
refuses to start with intake enabled and no key.

**Rollout switches are part of step 1, not an afterthought.** The rollout contract below promises
that intake, publication and confirmation can each be disabled while receipt reconciliation keeps
draining. That is three configuration flags plus three guard points, and nothing else in steps 2
through 15 adds them, so step 1 adds the flags and each owning step adds its guard: intake at the
webhook route (step 1), publication at the **submit boundary** (step 13), confirmation at the
outbox drain (step 14) — with the receipt reconciler explicitly outside the confirmation switch.
The publication guard must sit where the attestation is dispatched, not at the continuation-link
mint: a link minted, or a draft already hydrated into the PWA, before an incident would otherwise
still queue and broadcast an irreversible attestation after publication was disabled. Guarding the
mint only stops new links, which is not what "disable publication" means.

**Any new user-facing string lands in `en`, `es` and `pt`.** `AGENTS.md:73` admits no exception for
an English-only test cohort, and `packages/shared/src/__tests__/i18n/locale-coverage.test.ts`
enforces it. Every step that introduces chat or composer copy — draft receipt (5), media failure
(4), link confirmation (6), browser handoff (11), video refusal (15), chain outcome (14) — edits the
agent message catalog and `packages/shared/src/i18n/{en,es,pt}.json` in the same step, and runs the
locale-coverage test as part of its proof — `src/__tests__/i18n.test.ts` for agent copy,
`locale-coverage` for shared copy, both appended to those steps' commands below rather than left as
an intention. No inline literals, no fallback-only strings.

The agent has no migrations directory. Schema changes follow the existing idempotent
`initSchema()` plus `ensureColumn()` convention in `packages/agent/src/services/db/schema.ts` and
bump `PRAGMA user_version`.

**The test garden must have `openJoining` enabled.** See step 12 for why.

### Lane: agent ingress

- [ ] **1. Verify and deduplicate Meta webhooks.** `package:agent`. New
  `src/platforms/whatsapp/signature.ts`, new `src/api/routes/whatsapp-webhook.ts`, edit
  `src/api/server.ts`, edit `src/config.ts`. New route `GET|POST /webhooks/whatsapp` (GET is Meta's
  subscription challenge, a separate mechanism from the POST signature and must not be conflated
  with it). Migration: a `webhook_events` claim table, because the existing
  helper is not safe here. `claimIdempotencyKey` returns `false` for any existing row regardless of
  status (`services/db/idempotency.ts:59-60`), so a process that dies after the claim insert and
  before the domain work completes would treat Meta's redelivery as a duplicate success and lose
  the gardener's report. Use a lease with a status and an expiry: an unfinished claim past its lease
  is retryable, and only a completed claim answers a redelivery idempotently. **A retryable lease
  needs fencing.** Domain processing can outlive the lease — fetching provider media is the obvious
  case — and a Meta redelivery would then reclaim the expired row while the first worker is still
  running, so both create a draft and both reply, against the process-once claim `SEC-01` makes.
  Give each claim an owner epoch that the domain commit checks conditionally, so a worker whose
  lease was reclaimed cannot commit; or make the domain write transactionally idempotent.
  **Fencing the commit alone still lets the loser speak.** A stale worker can fail its conditional
  commit and then send its WhatsApp reply anyway, after the winner has already replied — so the
  gardener is answered twice for one message, which is the half of this the paragraph above names
  and the epoch does not reach. Step 14's outbox is no help: it carries chain-receipt
  confirmations, not this ingress reply. So persist the reply **intent** in the same transaction as
  the successful epoch-checked commit, keyed by `(provider realm, event ID, reply kind)`, and
  dispatch it from that record with a provider idempotency key. A worker whose commit fails has no
  record and therefore nothing to send. The test races a live slow worker against a reclaimed
  delivery — not just a restart — and asserts one draft **and one reply**.
  `createServer` imports and calls every registrar explicitly (`src/api/server.ts:170-209`); nothing
  is auto-discovered, so the route is unreachable until it is registered there.
  HMAC alone authenticates a body but gives no freshness, so persist the event claim **before**
  acknowledging, process each event once, and answer a duplicate delivery with an idempotent success
  rather than a signature error. Model the HMAC on `src/api/funding/thirdweb.ts:158-186`; Meta signs
  the raw body as `sha256=<hex>`, so preserve raw bytes before parsing. **Bound the body first.**
  Verifying the HMAC means materializing the raw bytes, so an unauthenticated caller could otherwise
  stream a large or chunked body and consume memory before the signature is even checked. Reuse
  `readLimitedTextBody` (`src/api/http/body.ts:64`), which rejects both an oversized declared
  `Content-Length` and an over-limit stream, exactly as `src/api/funding/webhook.ts:21-25` does
  before it verifies.
  *Proves `SEC-01`: a bad or missing signature is rejected before any domain processing, a replayed
  event is not processed twice, an oversized body is refused before hashing — with both a declared
  `Content-Length` case and a no-length stream — and the route answers over HTTP.*
  `bun run --cwd packages/agent test -- src/__tests__/whatsapp-signature.test.ts src/__tests__/webhook-events.test.ts && bun run --cwd packages/agent typecheck` — PRD-943
- [ ] **2. Normalize WhatsApp messages and reply.** `package:agent`. New
  `src/platforms/whatsapp/index.ts`, new `src/platforms/whatsapp/client.ts`, edit
  `src/api/routes/whatsapp-webhook.ts`. No new route, no migration. `Platform` already includes
  `"whatsapp"` (`src/types.ts:19`); reuse `InboundMessage` rather than introducing a second shape.
  Treat the sender as an opaque provider subject, since WhatsApp may supply a business-scoped ID
  with no visible phone number.
  *Proves `CH-01` for text and photo on the test number: both arrive as `InboundMessage` and the
  agent can reply inside the 24-hour window. Nigerian payloads and voice are not claimed.*
  `bun run --cwd packages/agent test -- src/__tests__/whatsapp-adapter.test.ts` — PRD-943

### Lane: durable drafts and media

- [ ] **3. Add the draft tables.** `package:agent`. Edit `src/services/db/schema.ts`, new
  `src/services/db/whatsapp-drafts.ts`, edit `src/services/db/core.ts`, edit `src/config.ts`.
  Migration: `whatsapp_drafts`, `draft_attachments`, `draft_link_attempts` — the second, third and
  fourth of this slice's four tables, counting `webhook_events` from step 1; step 14 adds outbox
  columns to `whatsapp_drafts` rather than a fifth table. **The WhatsApp subject is a provider user or phone
  identifier and must not be stored or indexed in the clear** — section 4 requires encryption at
  rest plus a keyed HMAC for any searchable identifier index, because a plain hash of a phone
  number is enumerable. Store the subject as ciphertext and index the uniqueness constraint on a
  versioned keyed HMAC of it, reusing the AES-256-GCM helpers the agent already has
  (`services/crypto.ts`) and reading the `WHATSAPP_SUBJECT_KEYRING` provisioned in step 1 — **not**
  `ENCRYPTION_SECRET`, which is one fixed key shared with custodial private keys. Cover key version
  and rotation. **Rotation must not be able to duplicate a sender.** If the uniqueness index is the
  versioned HMAC itself, the same subject produces a different value under a new key, so the
  constraint no longer collides with the existing row and a write or a concurrent delivery after
  rotation creates a second active record for the same person — splitting their draft ownership,
  consent state, deletion and outbox. Keep uniqueness on a **stable** subject key that does not move
  with the keyring, and let the versioned HMAC serve lookup only; rotation then reindexes rows
  atomically rather than silently forking them. The rotation test covers an **insert** after
  rotation, not just a lookup: the second delivery from the same sender must find the existing row.
  Bump `PRAGMA user_version`.
  *Proves part of `WORK-01`: the tables and their unique index survive a database reopen.*
  `AGENT_SQLITE_INTEGRATION=1 bun run --cwd packages/agent test -- storage.sqlite` — PRD-944
- [ ] **4. Fetch WhatsApp media safely.** `package:agent`. New `src/services/whatsapp-media.ts`,
  edit `src/platforms/whatsapp/client.ts`. No new route, no migration. A Cloud API photo arrives as
  a media ID, so fetch through the authenticated Graph endpoint with host and redirect restrictions,
  a timeout, a size cap and a MIME allowlist — the SSRF and token-leak boundary in section 8.
  *Proves `WORK-01` and part of `DATA-03`: an oversize or malicious attachment is rejected, and a
  failed fetch is reported to the gardener in chat rather than silently dropped.*
  `bun run --cwd packages/agent test -- src/__tests__/whatsapp-media.test.ts src/__tests__/i18n.test.ts` — PRD-944
- [ ] **5. Persist the draft across a restart, ahead of the legacy account gate.** `package:agent`.
  New `src/handlers/whatsapp-draft.ts`, edit `src/handlers/index.ts`, edit
  `src/services/db/whatsapp-drafts.ts`, edit `src/handlers/submit.ts`. No new route, no migration.
  **This step must route around the existing account gate, or the slice contradicts its own locked
  decision.** `handleText` and `handlePhoto` both return `common.startFirst` when no legacy `users`
  row exists (`handlers/index.ts:344-349,377-383`), and following `/start` calls
  `generatePrivateKey()` and `db.createUser({..., privateKey})` (`handlers/start.ts:25-31`) — the
  custodial EOA this slice explicitly forbids. A first-time gardener's first photo therefore cannot
  reach a provisional draft today. Wire WhatsApp provisional intake **ahead of** that gate in the
  explicit router, so an unknown WhatsApp sender gets a draft rather than a sign-up instruction, and
  leave the Telegram path untouched.
  **Routing around the `users` row removes the only garden source, so name a new one.**
  `InboundMessage` carries no garden (`types.ts`), and garden selection today lives solely in
  `users.currentGarden`, which the legacy `/join` path sets. A provisional draft therefore has no
  garden unless this step supplies one. For the prototype the source is a single configured
  `WHATSAPP_PROTOTYPE_GARDEN` (the test garden from step 12), validated at startup against the
  deployed chain ID, and echoed to the gardener in the consent reply so the destination is never
  implicit. The draft stores that garden explicitly rather than resolving it later. Multi-garden
  selection in chat is out of scope: the prototype has one garden. `submit.ts:159` still writes `media: []` at HEAD, so the
  empty-media defect the spec found is live; fix it or keep the new path clear of it, but do not
  leave both.
  **Consent belongs at first contact, not at publication.** The first reply to an unknown sender
  states in one line what is stored, that publication is public and permanent, and how to stop — and
  the draft records that the notice was delivered. Nothing is published from a draft whose notice
  was never sent. This and the deletion path in step 14 are the minimum O5 subset; they are folded
  into existing steps to hold the fifteen-step cap.
  *Proves `WORK-01`: a draft with photo, description and garden is readable after the agent
  restarts — and, at HTTP level, that a first message from an unknown WhatsApp sender creates
  neither a `users` row nor a private key, and receives the consent notice before any draft is
  retained.*
  `bun run --cwd packages/agent test -- src/__tests__/whatsapp-draft.test.ts src/__tests__/whatsapp-first-message.test.ts src/__tests__/i18n.test.ts` — PRD-944

### Lane: continuation link

- [ ] **6. Mint a single-use link and confirm it in the chat.** `package:agent`. New
  `src/services/draft-links.ts`, edit `src/api/routes/whatsapp-webhook.ts`, edit
  `src/services/db/whatsapp-drafts.ts`. Uses `draft_link_attempts` from step 3. At least 128 bits of
  randomness, hashed at rest, 10-minute expiry, atomic single consumption. A GET must never consume
  an attempt, authenticate a browser, or execute an action, so link previews and prefetch stay safe.
  Reuse the one-time claim shape at `src/api/routes/garden-join-request-auth.ts:106-111`.
  **The link alone is not sufficient proof.** For a new gardener there is no pre-bound account, so
  whoever holds a forwarded link could present a valid signature from their own account and win the
  single consume. Single-use semantics stop races and replays; they do not identify the intended
  gardener. So after the browser proves an account, the agent asks for confirmation **back in the
  original WhatsApp conversation**, and the draft attaches only once that confirmation arrives —
  the two-sided proof section 6 already requires.
  **A generic confirmation is not enough, though.** "Someone is trying to attach an account, approve
  or deny?" can be approved by a gardener who assumes it is their own browser, which attaches the
  forwarder instead — the very attack this step exists to stop. Mint an **attempt-specific
  comparison code** when the browser presents its proof, persist it on the attempt with the account
  context, show it in the browser, and put the same code in the chat prompt. The attempt is consumed
  only when the gardener confirms that exact code, and a mismatch or a second concurrent attempt is
  refused. This is the matching short phrase the canonical protocol in section 6 specifies, not an
  extra invention.
  *Proves `SEC-02`: a forwarded link, a preview GET, a replay and two concurrent consumes disclose
  nothing and change no binding; the chat prompt carries a code that matches only the browser
  attempt that generated it, and approving a prompt whose code does not match the gardener's own
  screen attaches nothing.*
  `bun run --cwd packages/agent test -- src/__tests__/draft-links.test.ts src/__tests__/i18n.test.ts` — PRD-945

### Lane: account proof

- [ ] **7. Generalize the signed-proof envelope to a draft resource.** `package:shared`,
  `package:agent`. New `packages/shared/src/public-contracts/draft-proof.ts`, new
  `packages/agent/src/api/routes/whatsapp-draft-auth.ts`, edit
  `packages/shared/src/public-contracts/index.ts`. New route: proof exchange for a draft locator.
  No migration. This is reuse, not new cryptography: `garden-join-request-auth.ts:40-104` already
  does nonce, expiry, chain allowlist, action binding, resource binding and one-time claim, and
  `services/profile-avatars.ts:90-127` already verifies an EOA, a deployed ERC-1271 account and a
  counterfactual ERC-6492 Kernel account. Bound any hostile-factory simulation.
  **The existing envelope is not origin-bound, so generalizing it verbatim would not deliver the
  origin rejection `AUTH-01` requires.** `buildGardenJoinProofMessage`
  (`packages/shared/src/public-contracts/join-request-auth.ts`) signs chain, garden, account,
  action, nonce and timestamps and **no domain or audience**, while `checkOrigin` reads the HTTP
  `Origin` header, which a non-browser caller sets freely. A proof harvested in one environment is
  therefore replayable into another by a caller that simply supplies the production origin — and
  the one-time nonce claim does not stop it, because each environment keeps its own claim store.
  The draft-proof contract adds **signed `Domain` and `Audience` fields**, verified against this
  deployment's configured values, so the signature itself names where it may be spent.
  *Proves `AUTH-01`: an EOA, a deployed Kernel account and a counterfactual Kernel account all prove
  ownership server side; wrong chain, nonce or expiry are rejected; and a proof signed for another
  domain or audience is rejected even when the caller supplies a correct `Origin` header —
  cross-environment replay, not just a header check.*
  `bun run --cwd packages/agent test -- src/__tests__/whatsapp-draft-auth.test.ts` — PRD-946
- [ ] **8. Scope the draft read to the proven account.** `package:agent`. New
  `src/api/routes/whatsapp-drafts.ts`, edit `src/api/server.ts`. New route: read one draft by
  locator. No migration. Keep the existing origin allowlist and per-route rate limiter
  (`src/api/http/public.ts`).
  **A proven account plus a locator is not enough to read the draft.** Step 6 stops a forwarded
  link from *attaching* an account, but disclosure happens earlier: whoever holds the link can
  satisfy step 7 with their own account and then read the gardener's photo and description here,
  before any confirmation is asked for. `SEC-02` promises a forwarded link discloses nothing, so
  the read and the attachment bytes are gated on a **consumed, chat-confirmed attempt whose stored
  account matches the presented proof** — the same attempt and comparison code step 6 mints. Until
  that confirmation lands the route answers exactly as it does for an absent draft.
  *Proves `AUTH-03`: a foreign or absent draft id returns the same non-enumerating response, and no
  attachment URL or metadata leaks — and a holder of a forwarded link who proves their own account
  but has no confirmed attempt gets that same empty answer, which is the `SEC-02` disclosure case.*
  `bun run --cwd packages/agent test -- src/__tests__/whatsapp-drafts-route.test.ts` — PRD-946

### Lane: browser handoff and signature

- [ ] **9. Add the draft review port.** `package:shared`. New
  `src/modules/whatsapp-drafts/transport.ts`, new
  `src/hooks/client-ui/work/useWhatsAppDraftReview.ts`, edit `src/hooks/client-ui/work/index.ts`.
  No new route, no migration. Model the transport on
  `src/modules/garden-join-requests/transport.ts:117-154`.
  **This is a review port, not an intake port, and the difference is the point.** The draft arrives
  already complete: step 16 finished its required fields in chat and the gardener approved it there.
  So this hook fetches the draft and exposes it for display and signature — it does not hydrate the
  composer, does not create a local draft the gardener could diverge from, and offers no field
  editing. That drops the `useShareTargetIntake.ts:31-190` hydration shape an earlier revision of
  this step reused; the Share Target pattern solves a problem this slice no longer has, because a
  Share Target payload has never been through a field walk. A gardener who wants a change returns to
  the chat, per spec section 15.1 narrowing 5.
  *Proves part of `UX-01`: a token fetches the server draft and renders exactly the fields that will
  publish — and no path in the hook can mutate one.*
  `bun run --cwd packages/shared test -- useWhatsAppDraftReview` — PRD-947
- [ ] **10. Wire the link into a read-only review route.** `package:shared`, `package:client`. Edit
  `src/hooks/client-ui/work/useWorkSubmissionFlowController.ts`, edit
  `packages/client/vercel.json` for the response headers,
  and the agent's request-logging configuration for redaction — **a shared hook can set neither an
  edge header nor a proxy log's redaction**, so naming only hooks would let a builder finish this
  step with `?wa=` still reaching edge logs and leaving in a referrer. Proof includes a deployed
  header check and a log-redaction check, not only the shared Vitest suite. No new route: `/home/garden` already reads `?draftId=` and
  `?shareTarget=`, so add `?wa=<token>` beside them and strip it from the address bar after
  exchange. No migration.
  **`?wa=` lands on review and signature, not on the composer.** `useDraftResume.ts` is no longer
  edited by this step: resuming an editable local draft is the composer's behaviour, and this route
  has no editable draft to resume. The controller shows the draft's fields, media and destination
  garden read-only, states that publishing is public and permanent as section 8 requires, and offers
  one action — sign. Anything that would let this route write a field belongs to the chat walk in
  step 16 instead.
  **Address-bar cleanup is the last of three protections, not the only one.** Section 8 requires
  redacting query values from logs, removing them from the address bar after exchange, **and** a
  strict referrer policy; a locator in `?wa=` is already in the application, proxy and edge logs by
  the time the route runs, and can leave as a `Referer` on any subresource the route loads. So this
  step also adds query-value redaction on the serving edge and the agent's request logging, and a
  `no-referrer` policy on the continuation route. Without those the single-use locator is single-use
  only against someone who did not read a log.
  *Proves `UX-01` and `UX-04`: the link opens that exact draft rather than a generic screen, the
  rendered fields match the draft the gardener approved in chat with no editable control among them,
  and the locator appears in no request log and is sent in no referrer.*
  `bun run --cwd packages/shared test -- useWorkSubmissionFlowController` — PRD-947
- [ ] **11. First-run passkey from the link.** `package:shared`. Edit
  `src/hooks/client-ui/auth/useLoginScreenController.ts`, edit the install-guidance surface, edit
  `src/hooks/client-ui/work/useWhatsAppDraftIntake.ts`, edit
  `packages/client/src/views/Login/index.tsx` — `package:client` is touched here too. No new route,
  no migration. "Use my existing account" comes first, "Create a passkey" second — **and that
  ordering is rendered in the client view, not in the shared hook**
  (`packages/client/src/views/Login/index.tsx:176-209`), where a device with no stored credential
  currently makes "Create Account" primary and wallet sign-in secondary. A shared-hook test cannot
  see that mismatch, so this step carries an interaction test on the view itself. The in-app-browser block already exists
  (`useLoginScreenController.ts:83-95` with `utils/app/browser.ts:64-84`, which matches WhatsApp at
  line 75), so the work is a resumable handoff into Chrome or Safari that keeps the draft, not a new
  detector. **Blocked on a production decision — see the gate table.** `isPasskeyServerEnabled`
  (`config/passkeyServer.ts:42-48`) returns `false` whenever `VITE_PASSKEY_SERVER_ENABLED` is the
  string `false`, and defaults to `Boolean(env.PROD)` only when it is unset. If the deployed client
  bundle carries `false`, passkey creation is off and `ID-01` is unreachable no matter what this
  step's hook test reports. The decision, the client build-time configuration and evidence of the
  deployed value all have to land before the UI lane is marked ready.
  **The EOA variant of this journey is a named case, not an assumption.** `ID-03` is claimed for
  the continuation journey, but step 7 proves only backend signature verification and everything
  else in this step is the first-run passkey path, so nothing currently exercises an existing EOA
  holder opening the link and publishing. An earlier revision of this plan deferred that case; two
  independent reviewers flagged it, and they were right — a claimed criterion with no proof path is
  the same defect as a mislabelled one. The journey needs a real wallet, so it is a QA pass 1 case:
  an existing EOA holder opens the continuation link, signs the draft proof, publishes, and the
  attestation's attester and the garden's membership are unchanged from before the run.
  *Proves part of `ID-01`: a new gardener creates a passkey with no other account step, and
  WhatsApp's in-app browser is refused with a handoff that preserves the draft. Publication is
  step 12. `ID-03` is proven by the QA pass 1 EOA case, not by this step's hook tests.*
  `bun run --cwd packages/shared test -- useLoginScreenController locale-coverage && bun run --cwd packages/client test -- src/__tests__/views/Login.test.tsx` plus authenticated Brave proof — PRD-947
- [ ] **12. Admit the new account before it publishes.** `package:shared`. Edit
  `src/hooks/client-ui/work/useWhatsAppDraftIntake.ts`, reuse
  `src/modules/garden/join-garden-command.ts:35-88`. No new route, no migration.
  **`WorkResolver.onAttest` reverts `NotGardenMember` for a non-member attester**
  (`packages/contracts/src/resolvers/Work.sol:19-20,106-110`), and a passkey account created during
  the continuation flow has no address anyone could have pre-admitted. Pre-admission only covers
  accounts that already exist, so the first-run journey would revert at publication.
  Resolution: the test garden runs with `openJoining` enabled, so the new account calls the existing
  `GardenAccount.joinGarden()` itself (`packages/contracts/src/accounts/Garden.sol:224-243`) before
  the attestation, sponsored for passkey users. No steward is in the critical path.
  This is one extra on-chain transaction, not one extra *account* step, which is what `ID-01`
  constrains. State that plainly in the demo narration rather than claiming a single transaction.
  **Awaiting the join command is not the same as being a member.** `joinGarden-command.ts:41,55`
  returns the submitted transaction hash without waiting for a receipt, while the work executor
  simulates the attestation against current chain state immediately
  (`job-executors.ts:150-159`), so a job dispatched straight after the join can still revert
  `NotGardenMember`. Gate the work job on **receipt-backed membership**: confirm the join receipt,
  then a chain read showing the account is a member, before the job is allowed to simulate or
  publish. The proof is the join-to-publication ordering, not a unit test of the join command.
  *Proves the rest of `ID-01`: a brand-new passkey account reaches a signed on-chain publication
  without a second account step, and the attestation does not revert.*
  `bun run --cwd packages/shared test -- join-garden-command useWhatsAppDraftIntake` — PRD-947

### Lane: confirmation

- [ ] **13. Report the outcome back to the agent.** `package:shared`, `package:agent`. New
  `packages/agent/src/api/routes/whatsapp-draft-outcome.ts`, edit
  `packages/shared/src/modules/whatsapp-drafts/transport.ts`, edit
  `packages/agent/src/api/server.ts`, edit `packages/shared/src/modules/job-queue/db-schema.ts`,
  edit `packages/shared/src/modules/job-queue/db.ts`, edit
  `packages/shared/src/modules/job-queue/ports.ts`, edit
  `packages/shared/src/modules/job-queue/process-job.ts`, edit the submission path that queues work.
  This step is larger than one session and should be split at the package boundary if it does not
  fit; what it must not do is declare a narrow file list and then require changes outside it.
  **Two** new routes: a pre-queue submission hold, and authenticated outcome registration for a
  draft.
  Migration: add the operation and hold columns to `whatsapp_drafts` through `ensureColumn()`.
  **The hold is registered before the job is queued, not after it completes.** Step 14's retention
  sweep skips held drafts, but a hold nothing ever sets is not a remedy: an offline job can sit
  local past the seven-day window and the sweep would still delete the server draft its eventual
  outcome needs to authenticate against. So this step defines the hold explicitly — a `held` state
  with the signed authorization and an expiry, released on a registered outcome or a terminal
  failure, and renewable while the job is still retryable.
  **It cannot be registered at queue time, because queue time may be offline.** The existing path
  enqueues straight into IndexedDB when connectivity is already gone
  (`packages/shared/src/modules/work/submit-work-command.ts:198-203`), so a server call before
  queue insertion would either fail or disable offline submission for imported WhatsApp drafts —
  and renewal has the same problem during a long outage. Register the hold **while the draft is
  still being hydrated and the browser is online**, at the same point the authorization is signed,
  and carry it with the job. A submission that begins offline with no hold is refused for this
  slice rather than queued unheld; say so in the composer. The test covers a submit that starts
  offline, not only a clock advanced after a successful hold. The advanced-clock test drives a submission into a hold, advances past the
  sweep window, runs the sweep, and asserts the draft survives and its outcome still reconciles.
  **`ClientWorkIdMapping` is a Dexie table in the browser's IndexedDB**
  (`packages/shared/src/modules/job-queue/db-schema.ts:1-22`) and nothing sends `clientWorkId` to
  any server today, so the agent cannot read it.
  **The client also has no attestation UID to report.** The field named `attestationId` in that
  mapping actually holds a transaction hash — `db.ts:381` stores `transactionHash: attestationId`
  and `process-job.ts:62` passes `completedTxHash` — and when the device is offline that value can
  be a synthetic hash from `createOfflineTxHash`. So the client reports the **transaction hash
  only**, and step 14 derives the UID from the receipt. Wire the call into the submission
  completion path rather than leaving the route unused — but **not from a route-scoped hook**.
  `useWhatsAppDraftIntake` unmounts when the flow navigates away, while queued and offline work can
  complete much later, and the `job:completed` event is not itself durable.
  **The queued job is not a durable home for the correlation either.** `completeJob` calls
  `deleteJob(jobId)` and only then emits `job:completed`
  (`packages/shared/src/modules/job-queue/process-job.ts:65-79`), so by the time any consumer runs
  the job row is gone and the event has no replay. If the outcome POST fails, or the page closes
  between chain success and delivery, nothing remains to retry from and step 14 never fires.
  Carry the correlation in the job payload at submission time **and** write a separate
  `whatsapp_outcome_callbacks` record in the same Dexie transaction that marks the job synced. That
  record is the retry unit: a long-lived consumer drains it with backoff and clears it only on an
  acknowledged, idempotent registration, so repeated delivery of the same transaction hash is
  harmless.
  **That store does not exist yet, so this step owns creating it.** Every store is declared in
  `packages/shared/src/modules/job-queue/db-schema.ts` and reached through `db.ts`/`ports.ts`, and
  the sync transition lives in `process-job.ts`. Add the Dexie version upgrade and an owning-store
  operation that marks synced and writes the callback in one transaction — otherwise the crash
  window this record exists to close is still open. Cover the upgrade from a database with no such
  store, and the downgrade path of a client that has not upgraded.
  **The retry also needs a credential, which it cannot obtain later.** The prototype has no browser
  session and requires a signed proof per request (step 7), and a background retry cannot start a
  passkey ceremony unattended — so a callback persisted with only a correlation and a hash is
  undeliverable the moment the first POST fails. Capture an **action-bound signed authorization
  while the signer is still present**, at submission, and persist it with the callback: bound to
  this draft, this action and a nonce, with an expiry long enough to outlive a queued submission.
  The agent accepts it once — **and spends it in the same transaction that records the outcome**.
  If the nonce is claimed and the process then crashes, or the write fails, before the transaction
  hash is stored, the durable browser callback retries with an authorization that is already spent
  and can never register a successful publication: the work is on chain, the agent never learns it,
  and the restart-safe path `OPS-05` promises is defeated by the very credential meant to protect
  it. Consume the nonce and persist the outcome atomically, and let an exact replay of an
  already-recorded outcome return success rather than a spent-nonce rejection. Treat it as a bearer
  capability on the device and scope it to nothing but registering this draft's outcome.
  **Give the job and the authorization the same deadline.** A connectivity-blocked job stays pending
  without spending retries and this plan lets it remain retryable well past seven days, while the
  authorization expires on its own clock. If connectivity returns after expiry the job would publish
  irreversibly and then have every outcome registration rejected, so the gardener's work lands on
  chain and WhatsApp never says so — the worst of both. The publication path therefore checks the
  authorization deadline **before** it submits: past it, the job stops and surfaces as a failure the
  gardener can act on rather than publishing blind. Renewal, if the builder adds one, must happen
  before execution and with the signer present; a background renewal would defeat the binding.
  *Proves the input `OPS-05` needs: the agent learns the transaction hash for a draft from an
  authenticated caller that actually runs on submission; a failed POST followed by a reload still
  delivers, and a second delivery of the same hash changes nothing; and an unauthenticated,
  synthetic or foreign report is refused.*
  `bun run --cwd packages/agent test -- src/__tests__/whatsapp-draft-outcome.test.ts && bun run --cwd packages/shared test -- whatsapp-outcome-callbacks job-queue-upgrade` — PRD-948
- [ ] **14. Confirm in chat only after the chain receipt.** `package:agent`, `package:shared`. New
  `src/services/work-receipts.ts`, new `src/services/whatsapp-outbox.ts`, edit
  `src/platforms/whatsapp/client.ts`, edit `src/api/routes/whatsapp-webhook.ts`, edit
  `packages/shared/src/modules/job-queue/process-job.ts`. No new route. **The deletion path this
  step proves runs in the browser, not the agent.** Revoking the hold server-side only helps if the
  shared dispatch boundary rechecks it, so an agent-only proof can pass while a queued job
  reconnects and publishes withdrawn evidence. The consent recheck and its test live in
  `packages/shared`.
  Migration: add the outbox columns through `ensureColumn()`. Resolve the transaction receipt with the existing viem client and take the
  attestation UID from the EAS `Attested` log. **Attester and garden alone are not enough**: a
  gardener could otherwise register a transaction carrying an unrelated work attestation, or an
  `Attested` event from another emitter or schema, and have the chat confirm work that was never
  published from the saved draft. Require all of: a successful receipt, the log emitted by the
  configured EAS contract, the deployed Work schema UID, and decoded work fields matching the frozen
  draft revision — compare a canonical payload hash rather than field-by-field.
  **The agent cannot compute that hash from the chat draft alone.** The PWA chooses the action and
  may edit or re-encode the media after fetching the draft, so the agent knows only the
  pre-browser content; comparing against it would either reject legitimate submissions or compare
  against an incomplete expectation.
  **But the finalized bytes do not exist at submission either, so do not bind to them.**
  `encodeWorkData` performs the IPFS upload and produces the attestation data during job execution
  (`packages/shared/src/modules/job-queue/job-executors.ts:163`), which for queued or offline work
  happens long after the signer is present. An authorization bound to the final attestation bytes
  could therefore never be produced for exactly the offline case step 13 exists to serve.
  Bind instead to a **canonical pre-upload preimage** that is fully determined at submission —
  the draft revision, the chosen action, the garden, and a content digest of each selected image
  before upload — and have step 14 check that the on-chain payload derives from that preimage.
  Establishing that derivation is the builder's first task in this step, because `encodeWorkData`
  owns the transformation and its determinism has not been verified here. **If it is not derivable,
  this step fails closed and the slice re-plans — it does not proceed on a weaker binding.** An
  earlier revision of this plan offered draft-revision-and-attester as a fallback, which was wrong:
  with only those two bound, the same attester can register any unrelated valid work transaction and
  the chat confirms work that was never published from the saved draft. Stating a weaker guarantee
  plainly does not make it safe to ship, because the gardener reads the confirmation, not the
  caveat. No confirmation is better than a false one. Never trust a
  client-supplied UID, and reject a hash that resolves to no receipt, which is what a synthetic
  offline hash does. Persist the receipt and enqueue the reply in one transaction, then let a
  restart-safe consumer drain the outbox, so a process that dies between receipt and send still
  delivers. Model the reconciliation on the funding-intent tables (`db/schema.ts:178-256`).
  **Say what happens when the 24-hour service window has closed.** The queue deliberately lets
  offline work complete much later, so publication and its retries can cross that boundary, and an
  approved template is stretch work that may not exist by 2026-10-02. Without a rule the outbox
  would silently fail. For the prototype the outbox holds such a reply as `pending_window` and
  delivers it on the gardener's next inbound message, which reopens the window; it does not drop it
  and does not pretend to have sent it. The confirmation claim is narrowed to match: proactive
  within the window, deferred-until-next-contact outside it. **That delivery needs an inbound-side
  wake-up**, so this step also edits `src/api/routes/whatsapp-webhook.ts`: any verified inbound
  message drains `pending_window` rows for that subject. Without it the rows sit queued forever even
  after the gardener reopens the window. **Classify stop and delete commands first**, though: if the
  first message after the window is the `delete` the consent copy invited, draining before applying
  the withdrawal would send confirmations the gardener just asked to stop. Apply opt-out, then drain
  only what is still permitted.
  *Proves `OPS-05`: the confirmation follows the verified chain receipt rather than the submit, it
  still arrives after a restart between the two, a receipt landing outside the 24-hour window is
  held as `pending_window` and delivered on the next inbound message rather than dropped, and a
  failed submit tells the gardener what to do next. Also proves the abandonment path: a tester who
  sends `delete` while a job is already queued has that job stopped, not merely the server copy
  removed: the browser's Dexie job and its signed authorization both outlive the server draft, so a
  reconnect would publish the very evidence the gardener asked to delete, irreversibly, and its
  callback would then have nothing to reconcile against. Deletion invalidates the hold and the
  authorization, and the publication dispatch boundary re-checks per-draft consent before
  submitting, so a queue-then-delete-then-reconnect sequence publishes nothing. A tester who
  sends `delete` or abandons a draft past its retention window has the draft, its attachments and
  its subject index removed, and the command is refused for anything already published, which cannot
  be withdrawn. The retention window for an abandoned draft is **7 days** for the prototype —
  deliberately shorter than the 30 days the spec proposes for the pilot, because these are test
  records — and a startup sweep plus a daily interval deletes what has passed it, proven with an
  advanced clock rather than a real wait. **A queued submission is not an abandoned draft**: an
  offline browser job stays retryable longer than seven days and reports nothing until it completes,
  so the sweep would delete the draft, its attachments and its subject index out from under a live
  submission, and the later outcome callback would have nothing left to reconcile. Step 13 registers
  a server-side pending-submission hold before queueing, the sweep skips held drafts, and the
  advanced-clock test covers exactly that interaction.*
  `bun run --cwd packages/agent test -- src/__tests__/work-receipts.test.ts src/__tests__/whatsapp-outbox.test.ts src/__tests__/i18n.test.ts && bun run --cwd packages/shared test -- whatsapp-consent-revocation` — PRD-948

### Lane: publication safety

- [ ] **15. Strip location metadata before publication.** `package:shared`. Edit
  `src/modules/work/media-processing.ts`, edit `src/modules/work/heic-conversion.ts`, edit
  `src/hooks/client-ui/work/useWhatsAppDraftIntake.ts`. No new route, no migration.
  **The video refusal is scoped to WhatsApp intake, not applied repository-wide.**
  `normalizeWorkMediaFiles` and `prepareMediaForUpload` are shared by ordinary work submission
  (`modules/work/submission-flow.ts:45`), admin submission
  (`hooks/admin-ui/garden/useSubmitWorkMediaController.ts:62`), draft autosave
  (`hooks/work/useDraftAutoSave.ts:216`), the PWA share target
  (`hooks/client-ui/work/useShareTargetIntake.ts:95`) and the commitment proof composer
  (`hooks/client-ui/commitment/useProofComposerController.ts:159`) — all of which accept video
  today. A blanket refusal in the shared helper would silently remove video from every one of them.
  Add a source-scoped policy option instead, default permissive, and set it only at the WhatsApp
  intake boundary. The stripping itself is safe to apply everywhere; only the refusal is scoped. Today there is no dedicated strip step: compression re-encodes only files over about
  1 MB, so smaller images and all videos publish with EXIF and GPS intact
  (`media-processing.ts:239,244,253`). Section 8 requires removing unnecessary EXIF and location
  while preserving consented evidence the garden needs.
  **Videos are rejected for this prototype, not stripped.** The current path accepts any
  `video/*` and returns its bytes unchanged (`media-processing.ts:140-146,239,252`), and stripping a
  video container needs a parser or transcoder that is well outside a prototype step. Claiming
  `DATA-06` while a GPS-bearing video reaches permanent IPFS would be a false claim, so the
  prototype refuses video with a clear message in the chat and the composer. Lifting that limit is
  its own issue. **The chat half of that refusal lives in the agent, not here.** A video sent
  straight to the WhatsApp webhook never traverses `useWhatsAppDraftIntake`, so the browser-side
  policy cannot produce a chat message. The agent's media handler from step 4 refuses `video/*` at
  intake with a catalogued message in `en`, `es` and `pt`, and that refusal is proven on the agent
  side; the shared policy covers only a video arriving through the composer on an imported draft.
  *Proves `DATA-06`, and proves the refusal does not leak outward: a video imported from a
  WhatsApp draft is refused while a video attached through the ordinary composer, the share target,
  the admin form and the proof composer still succeeds. The test follows the publication path far
  enough to assert that the bytes
  uploaded to Pinata carry **neither GPS nor camera-identifying metadata** — the fixture is a
  sub-1 MB image carrying representative `Make`, `Model`, `BodySerialNumber` and `Software` tags
  alongside coordinates, and the assertion is that none of them survive — and that the media
  references on the attestation resolve to those bytes; and that a video is refused rather than
  published. Asserting only the absence of GPS would let an image reach permanent IPFS still
  naming the device that took it, which is the identifying half of the criterion. A helper-only
  assertion does not prove this for an irreversible public path.*
  **`upload-queued-work` does not prove this and must not be cited as if it did.** That suite mocks
  the attestation (`upload-queued-work.test.ts:78`) and exercises queue and transaction behaviour;
  it names Pinata nowhere and asserts nothing about uploaded bytes. This step therefore adds a
  publication-path test of its own — `whatsapp-publication-path` — which drives a WhatsApp-origin
  draft through upload and asserts on the bytes Pinata actually received and on the media
  references the attestation carries resolving to exactly those bytes.
  `bun run --cwd packages/shared test -- media-processing whatsapp-publication-path locale-coverage` — PRD-956

### Lane: chat correction

Numbered 16 because it was added on 2026-09-22, after steps 1 through 15 were cross-referenced from
spec.md, eval.md and the live Linear issues. At runtime it sits between step 5 and step 6: the draft
is persisted, then walked, then linked. Renumbering to place it there would have silently broken
every existing reference to "step 6" through "step 15".

- [ ] **16. Walk the garden action's required inputs in chat.** `package:shared`, `package:agent`.
  New `packages/shared/src/modules/work/action-field-walk.ts`, new
  `packages/agent/src/handlers/whatsapp-walk.ts`, edit `packages/agent/src/handlers/index.ts`, edit
  `packages/agent/src/services/db/whatsapp-drafts.ts`. No new route. Migration: the structured-field
  and provenance columns on `whatsapp_drafts` described in spec section 8.1 — fold them into step
  3's migration if step 3 has not shipped, and bump `PRAGMA user_version` again if it has.
  **The shared module holds the rule; the agent holds the conversation.** `action-field-walk.ts` is
  a pure function of an `Action`, the draft's current structured layer and an inbound answer: it
  returns the next unanswered required input, or the completed set. It calls no provider, touches no
  database and knows nothing about WhatsApp, so it is testable without either. The agent handler
  renders each returned input as a WhatsApp message and records the answer.
  **Render each input from its own declaration, not from a hand-written script.** `select` and
  `band` become interactive replies built from that action's published `options` and `bands`;
  `multi-select` accumulates across replies until the gardener says they are done; `number` accepts
  a numeric reply and is validated in code against the declared `unit`, with a non-numeric reply
  re-asked rather than coerced; `text` and `textarea` are stored verbatim with no rewriting.
  `repeater` is **refused with a catalogued message** — no prototype garden action uses one, and
  guessing at a nested shape would publish something the gardener never confirmed.
  **Write the source layer before the structured layer.** Every inbound message appends an immutable
  source entry first; each structured field records which entry it came from and that the gardener
  set it. Nothing in this step derives a field from free text — that is P6, and it is not built.
  The walk ends with a summary of every field and an explicit approval, and only an approved draft
  reaches step 6's link.
  **Interactive replies are capped by the provider, and the caps are tighter than they look.** The
  Cloud API allows at most three reply buttons with 20-character labels, or a list of at most ten
  sections carrying **ten rows in total across all sections combined** — not ten per section — with
  24-character row titles. An action whose `options` exceed ten, or whose `optionLabels` do not fit
  24 characters, must page or fall back to a numbered text prompt; silently truncating a gardener's
  available choices would publish a report they could not have corrected. Check the configured
  prototype action's option count and label lengths against these caps before building, and prove
  whichever path it actually needs.
  [Reply buttons](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages),
  [list messages](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages).
  *Proves `UX-04`: an unknown sender's first photo reaches a draft, the walk asks only for required
  inputs the draft does not already hold, a `select` is answered from the action's own published
  options, a non-numeric answer to a `number` is re-asked rather than stored, a `repeater` action is
  refused with a catalogued message in `en`, `es` and `pt`, and an unapproved draft yields no link.
  Also proves that the walk writes a source entry per inbound message and gardener provenance on
  every field it sets.*
  `bun run --cwd packages/shared test -- action-field-walk && bun run --cwd packages/agent test -- src/__tests__/whatsapp-walk.test.ts src/__tests__/i18n.test.ts` — PRD-970

## Cut line

**Must work for the 2026-10-02 demo:** steps 1 through 16.

Step 15 is above the line deliberately. The slice publishes to public IPFS and to a permanent
on-chain record, so shipping GPS-tagged photos of a gardener's location is not an acceptable demo
artifact and cannot be retracted afterwards.

Step 16 is above the line by consequence, not by preference, and the accounting is worth stating
plainly because it moved on 2026-09-22, ten days out. Locking correction into the chat made the
browser a read-only review, which took work **out** of steps 9 and 10 — no composer hydration, no
share-target payload shape, no `useDraftResume` edit, no editable-field surface to secure. It also
made a chat-side walk mandatory: with no composer and no interpretation, a gardener whose first
message omits a required field would otherwise have no way to supply it, and the draft could never
become publishable. Net effect is roughly one step's worth of new work in exchange for two smaller
ones, concentrated in a pure shared module that needs no provider, no network and no deployed
surface to test. If the window tightens, step 16 is not the piece to drop — dropping it strands
every incomplete draft. Reverting steps 9 and 10 to composer hydration is the honest fallback, and
it costs the target flow rather than the demo.

**Stretch, in priority order:**

1. Live steward approval on stage, for an **invite-only** garden: a tester requests to join and a
   steward welcomes them during the demo. The flow already exists — the steward's own wallet sends
   `addGardener` on chain, then the API reconciles by reading the chain and returns `202
   pendingOnchainMembership` until membership is effective. Step 12 uses `openJoining` self-join
   instead, so this is a showcase of the invite-only path rather than the demo's critical path.
2. An approved template for replies past the 24-hour window, upgrading step 14's `pending_window`
   hold into a proactive send. Template review can take up to 24 hours, so it must be submitted days
   ahead or dropped — the baseline deferred-until-next-contact behaviour stands either way.
3. Voice notes. `Xenova/whisper-tiny.en` already runs in-process (`services/ai.ts:156-182`).
4. PRD-942 owned-number registration, only if the five-tester cap on the Meta test number blocks a
   live judge demo. Registration allows ten attempts per number per 72 hours and then locks for 72
   hours, so two-step verification and the display name must be settled first.

**PRD-946 fallback.** If account proof runs long, sign in through the existing PWA auth without a
new server session. Because step 7 is reuse rather than new work, this is now unlikely to be needed.
Taking it costs `ID-01` and `AUTH-03`: the draft read would no longer be bound to a proven account,
so a forwarded link plus any signed-in account could open another gardener's draft. Decide it with
Afo before taking it, per PRD-946.

## Evaluation coverage for the slice

| Must pass | Step | Linear |
| --- | --- | --- |
| `SEC-01` — signature and provider-event replay | 1 | PRD-943 |
| `CH-01` — test-number text and photo only | 2 | PRD-943 |
| `WORK-01` — through publication, not just storage | 3, 4, 5, 9, 13, 14 | PRD-944 |
| `DATA-03`, attachment bounds only | 4 | PRD-944 |
| `SEC-02` | 6 | PRD-945 |
| `AUTH-01` | 7 | PRD-946 |
| `AUTH-03` | 8 | PRD-946 |
| `UX-01` | 9, 10, 16 | PRD-947 |
| `UX-04` — chat field walk and approval (new, see below) | 16 | PRD-970 |
| `ID-01` — passkey creation, then admission and publication | 11, 12 | PRD-947 |
| `UX-02`, in-app-browser handoff only | 11 | PRD-947 |
| `OPS-05` | 13, 14 | PRD-948 |
| `DATA-02`, consent notice and deletion only | 5, 14 | PRD-944 |
| `DATA-06`, location sanitization, images only | 15 | PRD-956 |

**Deferred, and not claimed by the demo.** All of gate 4 (`DEL-01` through `DEL-04`, `MIG-01`
through `MIG-03`); recovery `REC-01` through `REC-05`; commitments `COM-01` and `COM-02`; `DATA-01`;
identity continuity `ID-02` and `ID-04` through `ID-07` — **`ID-03` is claimed**, see the
evaluation contract; authority `AUTH-02`, `AUTH-04` and `AUTH-05`;
operations `OPS-01` through `OPS-04`; containment `SEC-03` through `SEC-06`; provider `CH-02`
through `CH-05`; and all of `PILOT-01` through `PILOT-03`. `ID-05`, `ID-07`, `REC-03` and `MIG-01`
are called out explicitly because a smooth demo could be mistaken for evidence of them.

## Target delivery sequence, post-prototype

The workstreams below remain a delivery design for scope selection, not a dispatch list. Prototype
steps consume parts of workstreams 1, 2, 3, 7 and 10; the rest are untouched.

| Step | Outcome and owning surface | Starting points | Required direct proof |
| --- | --- | --- | --- |
| 1 | Shared account-proof and action-intent contract | shared workflows/authMachine.ts, workflows/authServices.ts, public-contracts signed-auth patterns | Exact account/chain/purpose/revision representation; EOA, deployed Kernel and counterfactual verification fixtures; reject malformed/replayed proofs. |
| 2 | Agent transactional identity persistence | agent services/db/schema.ts, services/db/users.ts | Unique active bindings, atomic link consumption, epochs and restart-safe migrations; preserve legacy rows/addresses without creating new keys. |
| 3 | Agent verification and scoped browser sessions | agent api/routes/saved-offers.ts and garden-join-request-auth.ts patterns, api/http/auth.ts, api/server.ts | Independent backend proof; expiry/revocation/CSRF; public callers cannot use private-routine bearer access; hostile factory verification bounded. |
| 4 | Agent channel pairing and admission policy | agent handlers/start.ts, handlers/join.ts; bounded new service chosen after seam review | Both directions require two-sided possession; forwarded link and cross-garden requests fail; garden context grants no role. |
| 5 | Shared resumable account/link state | shared auth workflows and client auth hooks | Return to exact draft after login, distinguish existing/new account, preserve original Kernel address and EOA authority; no queue signer switch. |
| 6 | Client linking and continuation journey | client profile/account and existing auth/draft views, with exact files selected before edits | Browser-to-chat and chat-to-browser happy/failure paths; in-app browser handoff; visible scope and signer; authenticated Brave proof plus TAS devices. |
| 7 | Agent durable drafts and attachments | agent handlers/index.ts, handlers/submit.ts, services/db/schema.ts | Photo survives restart and correction; compare-and-swap edit conflicts; bounded media downloads; unauthorized attachment reads fail. |
| 8 | Shared work-intent/queue integration | shared modules/work/bot-submission.ts and existing work/job-queue paths | Frozen payload/account/garden/revision; same logical operation through PWA/chat; lost broadcast response reconciles before another signature. |
| 9 | Client work review and steward confirmation | client work review/approval views; shared mutations only in their owning package | Exact work UID, evidence and author displayed; gardener publishes and distinct authorized steward approves; partial success retries approval alone. |
| 10 | Agent WhatsApp transport and delivery outbox | agent types.ts, platforms/telegram.ts as reference, api/server.ts; new adapter/service paths selected in slice | Real provider signatures, event deduplication, media, templates/window, opt-out, rate limits and dead-letter recovery. |
| 11 | Commitment preparation and PWA confirmation, split by package | shared modules/job-queue/commitment-call-builder.ts; existing client commitment views; agent draft workflow | Each selected lifecycle action shows full binding terms and verifies its actual actor; chat affirmation never executes it. |
| 12 | Telegram continuity and legacy transition | agent platforms/telegram.ts, handlers/start.ts, handlers/approve.ts, services/db/users.ts | Link existing records without changing original authors; no new custodial creation under enabled new flow; unresolved pending work reconciles. |
| 13 | TAS staged rollout and incident rehearsal | Existing deployment/telemetry controls, with exact changes separately scoped | All applicable eval gates, real costs and total labor, kill switches, independent access/revoke, queue drain and rollback. |
| 14 | Optional later extensions, each separately selected | Reporting permission proof in contracts/shared before agent signer; Nigeria SMS adapter only after inbound provisioning | Delegation's onchain negative cases and independent revoke; or actual Nigerian two-way SMS and photo handoff. Neither is a baseline release dependency. |
| 15 | Model-assisted interpretation (spec P6), gated on O6 | shared modules/work/action-field-walk.ts from prototype step 16; the two-layer draft in spec section 8.1 | Labelled examples covering completed versus planned work, corrections, ambiguous units, multiple activities and support requests in the pilot's actual language mix. Three configurations measured on the same set — walk alone, walk plus extraction, walk plus extraction plus bounded judgment — reporting questions avoided, wrong values proposed, unsupported additions, latency, fallback rate and provider cost. Provider terms settled under O6 before a single real message is sent; an approved-synthetic set until then. Pinned model versions, so a rerun means something. |

If any prototype step turns out to require a contract change, stop that slice and update this plan
in contract, shared, indexer, consuming-application order before resuming. No contract change is
expected: `WorkResolver` and `WorkApprovalResolver` are unchanged by this slice.

## Requirements coverage

| User requirement | Architecture | Delivery | Proof |
| --- | --- | --- | --- |
| New WhatsApp user continues in PWA and signs | Spec 5, 6, 15.1 | Prototype 1 through 13, 16 | ID-01, UX-01, UX-04, WORK-01, AUTH-01 |
| Complete and correct a report without leaving the chat | Spec 8.1, 15.1 | Prototype 16 | UX-04 |
| Not be asked again for what the gardener already wrote | Spec 8.1, P6 | Target 15, blocked on O6 | INT-01 through INT-04, PILOT-01 |
| Report using an existing passkey PWA account | Spec 4 through 6 | Prototype 7 through 11 | ID-01, AUTH-01 |
| Report using an existing EOA | Spec 5 through 7 | Prototype 7 | ID-03 partial, AUTH-01 |
| Only intended garden members act | Spec 7 | Prototype 8; target 3, 4, 8 through 11 | AUTH-02 through AUTH-04 |
| Switch channels or devices without duplicate work | Spec 8, 9 | Target 5 through 10, 12 | DATA-01, OPS-01 through OPS-04 |
| Approve work and make commitments safely | Spec 8 | Target 9, 11 | WORK-02, WORK-03, COM-01, COM-02 |
| Account compromise containment and recovery | Spec 10 through 12 | Target 3 through 6, 13, 14 | SEC-01 through SEC-06, REC-01 through REC-05 |
| Provider choice and TAS WhatsApp rollout | Spec 13, 14 | Target 10, 13 | CH-01 through CH-05, PILOT-01 through PILOT-03 |
| Telegram and Nigeria SMS path | Spec 5, 13, 14 | Target 12, 14 | MIG-01, MIG-02, CH-04 |

## Migration and rollout controls

The prototype adds four tables — `webhook_events`, `whatsapp_drafts`, `draft_attachments` and
`draft_link_attempts` — plus outbox columns on `whatsapp_drafts`, and does not touch `users`,
`sessions`, `pending_works` or any Telegram row. It must not merge established participants, export or relabel a custodial key, or
delete anything unresolved legacy operations depend on.

The agent is a single Fly machine in `jnb` with SQLite on the `agent_data` volume
(`min_machines_running = 1`, `auto_stop_machines = 'off'`). The volume attaches to one machine, so
single-replica operation is enforced by the storage topology rather than by convention. Do not scale
the agent horizontally while draft state lives in that file. Watch the 1 GB volume against stored
media: cap attachment size and count, and move bytes to Pinata at publication rather than retaining
them.

Keep intake, publication and confirmation behind independent switches. These are not aspirational:
the three flags are provisioned in step 1 and guarded at the webhook route (step 1), the
continuation-link mint (step 6) and the outbox drain (step 14), and each step's proof exercises its
own disabled state. Receipt reconciliation sits outside the confirmation switch deliberately, so a
disabled confirmation still records what landed on chain and drains once re-enabled. Rollback
disables new actions while preserving drafts, operation records and receipt reconciliation. Do not
fall back to custodial account creation or raw bot approval during an outage.

## Exclusions

No SMS or MMS, automatic EOA conversion, new custodial identity service, phone-based wallet
recovery, messaging-held owner keys, delegated approvals, commitments or funds, group scraping,
Telegram migration, protocol upgrade, or broad API-token distribution is authorized by this slice.
Production data collection and a pilot provider decision remain out of scope: RESR-75 acceptance
does not grant them.

Model-assisted interpretation is excluded specifically, not merely unbuilt. No step calls an
inference provider, no gardener's message leaves Green Goods and Meta, and O6 is not reached. Spec
proposal P6 stays unselected, and a demo of step 16 is evidence for a deterministic walk only.
Reusing the legacy `services/ai.ts` regex parser is excluded on the same grounds: it belongs to the
custodial Telegram path this slice routes around, and its `ParsedWorkData` shape does not meet
`WorkSubmission` (spec section 2).

## Linear changes

Written on 2026-09-22. The live records are PRD-941 through PRD-948 plus PRD-955 and PRD-956, under
the Buildathon prototype and WhatsApp number working milestones.

- The retired `claude` label was removed from PRD-941 through PRD-948 and GROW-57. It was retired on
  2026-09-12, and `AGENTS.md` lists `ai:claude` among the retired families. RESR-75 still carries it
  and was left alone, being Done and outside this slice.
- `package:agent` was added to PRD-943, PRD-944, PRD-945, PRD-946 and PRD-948. **Only one
  `package:*` label is allowed per issue** — the workspace rejects a second one from the same group
  — so PRD-946 carries `agent` alone despite also touching shared, and PRD-947 keeps its existing
  `pwa` rather than gaining `shared`. Each of those two issues says so in its body.
- The validation command for each step went into the existing `Done when` block rather than a new
  heading: the Accepted Product Work structure is three blocks with headings capped at 6, and the
  issue lint bans citing plan-hub filenames in a body.
- PRD-955 records this hub promotion and scope lock. PRD-956 covers step 15, location stripping,
  which was split out because it affects app submissions too and is not specific to this prototype.
- PRD-944 and PRD-946 were **not** split further. After the review rounds their remaining scope is
  coherent — PRD-944 is steps 3 through 5 and 14, since `DATA-02`'s consent notice and deletion path
  span both ends; PRD-946 is steps 7 and 8 — and splitting mid-review would
  have orphaned the bodies that now carry the corrections.
- PRD-970 was written on 2026-09-22 and owns step 16, the chat field walk, added when correction
  moved into the conversation and steps 9 and 10 became a read-only review. It sits under the
  Buildathon prototype milestone, blocked by PRD-944 for the draft tables, and related to PRD-947
  and PRD-955. It carries `package:agent` under the one-`package:*`-per-issue rule even though the
  pure walk module lands in shared, matching how PRD-946 and PRD-947 already resolve that
  constraint, and its body says so.
- **Two Linear writes remain owed.** PRD-947's body still describes composer hydration and the
  `useWhatsAppDraftIntake`/`useDraftResume` commands, which steps 9 and 10 no longer do; it needs
  the read-only review reflected. And spec proposal P6 with gate O6 needs a **Research** team issue,
  not a Product one — P6 is unselected, so it must not appear under the Buildathon prototype
  milestone or read as accepted work.
- `linear-sync` has **not** been run, deliberately. The hub is `parent_only`; with an empty lane map
  an `lane_issues` sync would have created duplicate canonical lane issues under the historical
  PRD-339 parent instead of using the live slice issues. Run the Implementation Start Gate only once
  a builder is named and the lanes come off `blocked`.

## Validation and handoff

Each step names its acceptance test, file boundary, migration behaviour and validation command
above. Record fresh RED/GREEN evidence where behaviour changes, then write the lane handoff and the
machine proof with `record-tdd`.

Shared auth, work and job-queue changes retain the critical override; steps 9, 10, 11, 13 and 16
touch shared surfaces and take it. Use the repository Bun wrappers. Authenticated local Brave evidence on
the appropriate deployed origin is required for step 11: a passkey ceremony cannot be proven by
localhost mocks, and no clean-room browser check substitutes for it.

Runtime, provider, cryptographic-compatibility and browser proof remain unrun as of this revision.
Document validation does not stand in for them.
