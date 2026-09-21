# Messaging integration delivery proposal

**Feature slug:** agent-messaging-channels

**Stage:** `active`

**Status:** `ACTIVE — Buildathon prototype slice locked 2026-09-21; target architecture remains a proposal`

**Created:** 2026-04-17

**Last updated:** 2026-09-21 UTC

**Specification:** [canonical architecture](spec.md) — section 15.1 holds the prototype slice

**Evaluation:** [acceptance and failure tests](eval.md)

**Linear project:** [Agent Messaging Channels (WhatsApp + SMS)](https://linear.app/greenpill-dev-guild/project/agent-messaging-channels-whatsapp-sms-71cda634fcf7)

**Linear milestone:** Buildathon prototype — target 2026-10-02, submission 2026-10-04

**Mirror:** PRD-339 is stored historical metadata, unresolved during the 2026-09-11 research pass.
The live slice issues are PRD-943 through PRD-948 under the Buildathon prototype milestone. No
Linear writes have been performed; proposed changes are in [Linear changes](#linear-changes-proposed).

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
| O5 consent, retention, support, thresholds | **Not required for the prototype** | Test garden, team plus invited testers, no production data, no success claim. Required before the TAS pilot. |
| O3 deployed account-proof compatibility | **Largely answered by existing code** | See step 7. |
| O4 total-loss recovery | **Open** | RESR-21. Unchanged; the prototype makes no recovery claim. |

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

## Buildathon prototype

One builder, 2026-09-25 to 2026-10-02. Steps are in dependency order. Each is one session, at most
three or four files, with a one-sentence verification.

Environment added once, at step 1, as Fly secrets, never the repository, per PRD-941:
`META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID`,
`META_SYSTEM_USER_TOKEN`, `META_GRAPH_BASE_URL`.

The agent has no migrations directory. Schema changes follow the existing idempotent
`initSchema()` plus `ensureColumn()` convention in `packages/agent/src/services/db/schema.ts` and
bump `PRAGMA user_version`.

### Lane: agent ingress

- [ ] **1. Verify Meta webhooks.** `package:agent`. New `src/platforms/whatsapp/signature.ts`, new
  `src/api/routes/whatsapp-webhook.ts`, edit `src/config.ts`. New route `GET|POST /webhooks/whatsapp`
  (GET is Meta's subscription challenge; POST carries events). No migration. Environment as above.
  Model on the existing HMAC verifier at `src/api/funding/thirdweb.ts:158-186`. Meta signs the raw
  body as `sha256=<hex>`, so preserve raw bytes before parsing.
  *Proves `SEC-01`: a webhook with a bad, missing or replayed signature is rejected before any
  domain processing.*
  `bun run test -- src/__tests__/whatsapp-signature.test.ts && bun run typecheck` — PRD-943
- [ ] **2. Normalize WhatsApp messages and reply.** `package:agent`. New
  `src/platforms/whatsapp/index.ts`, new `src/platforms/whatsapp/client.ts`, edit
  `src/api/routes/whatsapp-webhook.ts`. No new route, no migration. `Platform` already includes
  `"whatsapp"` (`src/types.ts:19`); reuse `InboundMessage` rather than introducing a second shape.
  Treat the sender as an opaque provider subject, since WhatsApp may supply a business-scoped ID
  with no visible phone number.
  *Proves `CH-01`: a text and a photo from a verified tester arrive as `InboundMessage`, and the
  agent can reply while the 24-hour window is open.*
  `bun run test -- src/__tests__/whatsapp-adapter.test.ts` — PRD-943

### Lane: durable drafts and media

- [ ] **3. Add the draft tables.** `package:agent`. Edit `src/services/db/schema.ts`, new
  `src/services/db/whatsapp-drafts.ts`, edit `src/services/db/core.ts`. Migration: `whatsapp_drafts`,
  `draft_attachments`, `draft_link_attempts`, with a unique index on one active draft per
  `(channel, externalSubject)`. Bump `PRAGMA user_version`.
  *Proves part of `WORK-01`: the tables and their unique index survive a database reopen.*
  `AGENT_SQLITE_INTEGRATION=1 bun run test -- storage.sqlite` — PRD-944
- [ ] **4. Fetch WhatsApp media safely.** `package:agent`. New `src/services/whatsapp-media.ts`,
  edit `src/platforms/whatsapp/client.ts`. No new route, no migration. A Cloud API photo arrives as
  a media ID, so fetch through the authenticated Graph endpoint with host and redirect restrictions,
  a timeout, a size cap and a MIME allowlist — the SSRF and token-leak boundary in section 8.
  *Proves `WORK-01` and part of `DATA-03`: an oversize or malicious attachment is rejected, and a
  failed fetch is reported to the gardener in chat rather than silently dropped.*
  `bun run test -- src/__tests__/whatsapp-media.test.ts` — PRD-944
- [ ] **5. Persist the draft across a restart.** `package:agent`. New
  `src/handlers/whatsapp-draft.ts`, edit `src/services/db/whatsapp-drafts.ts`, edit
  `src/handlers/submit.ts`. No new route, no migration. `submit.ts:159` still writes `media: []` at
  HEAD, so the empty-media defect the spec found is live; fix it or keep the new path clear of it,
  but do not leave both.
  *Proves `WORK-01`: a draft with photo, description and garden is readable after the agent
  restarts.*
  `bun run test -- src/__tests__/whatsapp-draft.test.ts` — PRD-944

### Lane: continuation link

- [ ] **6. Mint and consume a single-use link.** `package:agent`. New `src/services/draft-links.ts`,
  edit `src/api/routes/whatsapp-webhook.ts`, edit `src/services/db/whatsapp-drafts.ts`. No new route
  beyond the link locator. Uses `draft_link_attempts` from step 3. At least 128 bits of randomness,
  hashed at rest, 10-minute expiry, atomic single consumption. A GET must never consume an attempt,
  authenticate a browser, or execute an action, so link previews and prefetch stay safe. Reuse the
  one-time claim shape at `src/api/routes/garden-join-request-auth.ts:106-111`.
  *Proves `SEC-02`: against a forwarded link, a preview GET, a replay and two concurrent consumes,
  exactly one succeeds and nothing about the draft is disclosed.*
  `bun run test -- src/__tests__/draft-links.test.ts` — PRD-945

### Lane: account proof

- [ ] **7. Generalize the signed-proof envelope to a draft resource.** `package:shared`,
  `package:agent`. New `packages/shared/src/public-contracts/draft-proof.ts`, new
  `packages/agent/src/api/routes/whatsapp-draft-auth.ts`, edit
  `packages/shared/src/public-contracts/index.ts`. New route: proof exchange for a draft locator.
  No migration. This is reuse, not new cryptography: `garden-join-request-auth.ts:40-104` already
  does nonce, expiry, chain allowlist, action binding, resource binding and one-time claim, and
  `services/profile-avatars.ts:90-127` already verifies an EOA, a deployed ERC-1271 account and a
  counterfactual ERC-6492 Kernel account. Bound any hostile-factory simulation.
  *Proves `AUTH-01`: an EOA, a deployed Kernel account and a counterfactual Kernel account all prove
  ownership server side, and wrong chain, origin, nonce or expiry are rejected.*
  `bun run test -- src/__tests__/whatsapp-draft-auth.test.ts` — PRD-946
- [ ] **8. Scope the draft read to the proven account.** `package:agent`. New
  `src/api/routes/whatsapp-drafts.ts`, edit `src/api/server.ts`. New route: read one draft by
  locator. No migration. Keep the existing origin allowlist and per-route rate limiter
  (`src/api/http/public.ts`).
  *Proves `AUTH-03`: a foreign or absent draft id returns the same non-enumerating response, and no
  attachment URL or metadata leaks.*
  `bun run test -- src/__tests__/whatsapp-drafts-route.test.ts` — PRD-946

### Lane: browser handoff and signature

- [ ] **9. Add the draft intake port.** `package:shared`. New
  `src/modules/whatsapp-drafts/transport.ts`, new
  `src/hooks/client-ui/work/useWhatsAppDraftIntake.ts`, edit `src/hooks/client-ui/work/index.ts`.
  No new route, no migration. Model the transport on
  `src/modules/garden-join-requests/transport.ts:117-154` and the intake on
  `src/hooks/client-ui/work/useShareTargetIntake.ts:31-190`. The PWA Share Target already does this
  exact shape: opaque token, external payload, composer hydration, draft persisted only once garden
  and action are chosen.
  *Proves part of `UX-01`: a token fetches the server draft and populates the composer, and the
  draft persists once garden and action are chosen.*
  `bun run test -- useWhatsAppDraftIntake` — PRD-947
- [ ] **10. Wire the link into the composer route.** `package:shared`. Edit
  `src/hooks/client-ui/work/useWorkSubmissionFlowController.ts`, edit
  `src/hooks/work/useDraftResume.ts`. No new route: `/home/garden` already reads `?draftId=` and
  `?shareTarget=`, so add `?wa=<token>` beside them and strip it from the address bar after
  exchange. No migration.
  *Proves `UX-01`: the link opens that exact draft rather than a generic screen.*
  `bun run test -- useDraftResume` — PRD-947
- [ ] **11. First-run passkey from the link.** `package:shared`. Edit
  `src/hooks/client-ui/auth/useLoginScreenController.ts`, edit the install-guidance surface, edit
  `src/hooks/client-ui/work/useWhatsAppDraftIntake.ts`. No new route, no migration. "Use my existing
  account" comes first, "Create a passkey" second. The in-app-browser block already exists
  (`useLoginScreenController.ts:83-95` with `utils/app/browser.ts:64-84`, which matches WhatsApp at
  line 75), so the work is a resumable handoff into Chrome or Safari that keeps the draft, not a new
  detector. **Before starting, resolve whether the passkey server is on in production:**
  `config/passkeyServer.ts:42-48` defaults it to `true`, `.env.schema:86-90` sets it `false`.
  *Proves `ID-01` and part of `UX-02`: a new gardener creates a passkey and signs with no other
  account step, and WhatsApp's in-app browser is refused with a handoff that preserves the draft.*
  `bun run test -- useLoginScreenController` plus authenticated Brave proof — PRD-947

### Lane: confirmation

- [ ] **12. Confirm only after the chain receipt.** `package:agent`. New
  `src/services/work-receipts.ts`, edit `src/services/db/whatsapp-drafts.ts`, edit
  `src/platforms/whatsapp/client.ts`. No new route. Migration: add the operation and outbox columns
  to `whatsapp_drafts` through `ensureColumn()`. Correlate on `clientWorkId`, which is already the
  stable submission identity (`shared/src/modules/job-queue/draft-snapshot.ts:82`) and is already
  mapped to the attestation UID by `ClientWorkIdMapping`
  (`shared/src/modules/job-queue/db-schema.ts:17-22`). Verify the UID on chain; never trust a
  client-supplied transaction hash. Model reconciliation on the funding-intent tables
  (`db/schema.ts:178-256`).
  *Proves `OPS-05`: the confirmation follows the chain receipt rather than the submit, and a failed
  submit tells the gardener what to do next.*
  `bun run test -- src/__tests__/work-receipts.test.ts` — PRD-948

### Lane: publication safety

- [ ] **13. Strip location metadata before publication.** `package:shared`. Edit
  `src/modules/work/media-processing.ts`, edit `src/modules/work/heic-conversion.ts`. No new route,
  no migration. Today there is no dedicated strip step: compression re-encodes only files over about
  1 MB, so smaller images and all videos publish with EXIF and GPS intact
  (`media-processing.ts:239,244,253`). Section 8 requires removing unnecessary EXIF and location
  while preserving consented evidence the garden needs.
  *Proves part of `DATA-02`: published media carries no GPS, including files under 1 MB.*
  `bun run test -- media-processing` — PRD-944

## Cut line

**Must work for the 2026-10-02 demo:** steps 1 through 13.

Step 13 is above the line deliberately. The slice publishes to public IPFS and to a permanent
on-chain record, so shipping GPS-tagged photos of a gardener's location is not an acceptable demo
artifact and cannot be retracted afterwards.

**Stretch, in priority order:**

1. Live steward approval on stage: a tester requests to join and a steward welcomes them during the
   demo. The flow already exists — the steward's own wallet sends `addGardener` on chain, then the
   API reconciles by reading the chain and returns `202 pendingOnchainMembership` until membership
   is effective. It adds an on-chain admission transaction to the critical path, which is why it is
   not the default.
2. An approved template for replies past the 24-hour window. Template review can take up to 24
   hours, so it must be submitted days ahead or dropped.
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
| `SEC-01` | 1 | PRD-943 |
| `CH-01` | 2 | PRD-943 |
| `WORK-01` | 3, 4, 5 | PRD-944 |
| `DATA-03`, attachment bounds only | 4 | PRD-944 |
| `SEC-02` | 6 | PRD-945 |
| `AUTH-01` | 7 | PRD-946 |
| `AUTH-03` | 8 | PRD-946 |
| `UX-01` | 9, 10 | PRD-947 |
| `ID-01`, and `UX-02` handoff only | 11 | PRD-947 |
| `OPS-05` | 12 | PRD-948 |
| `DATA-02`, location only | 13 | PRD-944 |

**Deferred, and not claimed by the demo.** All of gate 4 (`DEL-01` through `DEL-04`, `MIG-01`
through `MIG-03`); recovery `REC-01` through `REC-05`; commitments `COM-01` and `COM-02`; `DATA-01`;
identity continuity `ID-02` through `ID-07`; authority `AUTH-02`, `AUTH-04` and `AUTH-05`;
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

If any prototype step turns out to require a contract change, stop that slice and update this plan
in contract, shared, indexer, consuming-application order before resuming. No contract change is
expected: `WorkResolver` and `WorkApprovalResolver` are unchanged by this slice.

## Requirements coverage

| User requirement | Architecture | Delivery | Proof |
| --- | --- | --- | --- |
| New WhatsApp user continues in PWA and signs | Spec 5, 6, 15.1 | Prototype 1 through 13 | ID-01, UX-01, WORK-01, AUTH-01 |
| Report using an existing passkey PWA account | Spec 4 through 6 | Prototype 7 through 11 | ID-01, AUTH-01 |
| Report using an existing EOA | Spec 5 through 7 | Prototype 7 | ID-03 partial, AUTH-01 |
| Only intended garden members act | Spec 7 | Prototype 8; target 3, 4, 8 through 11 | AUTH-02 through AUTH-04 |
| Switch channels or devices without duplicate work | Spec 8, 9 | Target 5 through 10, 12 | DATA-01, OPS-01 through OPS-04 |
| Approve work and make commitments safely | Spec 8 | Target 9, 11 | WORK-02, WORK-03, COM-01, COM-02 |
| Account compromise containment and recovery | Spec 10 through 12 | Target 3 through 6, 13, 14 | SEC-01 through SEC-06, REC-01 through REC-05 |
| Provider choice and TAS WhatsApp rollout | Spec 13, 14 | Target 10, 13 | CH-01 through CH-05, PILOT-01 through PILOT-03 |
| Telegram and Nigeria SMS path | Spec 5, 13, 14 | Target 12, 14 | MIG-01, MIG-02, CH-04 |

## Migration and rollout controls

The prototype adds three tables and does not touch `users`, `sessions`, `pending_works` or any
Telegram row. It must not merge established participants, export or relabel a custodial key, or
delete anything unresolved legacy operations depend on.

The agent is a single Fly machine in `jnb` with SQLite on the `agent_data` volume
(`min_machines_running = 1`, `auto_stop_machines = 'off'`). The volume attaches to one machine, so
single-replica operation is enforced by the storage topology rather than by convention. Do not scale
the agent horizontally while draft state lives in that file. Watch the 1 GB volume against stored
media: cap attachment size and count, and move bytes to Pinata at publication rather than retaining
them.

Keep intake, publication and confirmation behind independent switches. Rollback disables new actions
while preserving drafts, operation records and receipt reconciliation. Do not fall back to custodial
account creation or raw bot approval during an outage.

## Exclusions

No SMS or MMS, automatic EOA conversion, new custodial identity service, phone-based wallet
recovery, messaging-held owner keys, delegated approvals, commitments or funds, group scraping,
Telegram migration, protocol upgrade, or broad API-token distribution is authorized by this slice.
Production data collection and a pilot provider decision remain out of scope: RESR-75 acceptance
does not grant them.

## Linear changes (proposed)

Not yet written. Proposed, pending approval:

- Remove the retired `claude` label from PRD-941 through PRD-948 and GROW-57. It was retired on
  2026-09-12, and `AGENTS.md` lists `ai:claude` among the retired families.
- Add `package:agent` to PRD-943, PRD-944, PRD-945, PRD-946 and PRD-948; add `package:shared` to
  PRD-946 and PRD-947. PRD-947 already carries `package:pwa`.
- Add a Validation section to PRD-943 through PRD-948 carrying the exact command and evaluation ID
  from the step table above, so each meets the Codex-ready gate.
- Split PRD-944, which currently carries schema, media fetch and draft persistence as one issue
  (steps 3, 4 and 5) plus location stripping (step 13). Proposed: keep PRD-944 for media fetch and
  storage; add "Persist WhatsApp drafts across a restart" and "Strip location metadata before
  publication".
- Split PRD-946 into proof verification (step 7) and draft-scoped read (step 8).
- Add one issue covering the hub rebase and promotion, labelled `source:plans` and `package:docs`.
- After approval, run the Implementation Start Gate:
  `node scripts/harness/plan-hub.mjs linear-sync --feature agent-messaging-channels --json`, respect
  `manifest.laneSyncMode`, then `record-linear`.

## Validation and handoff

Each step names its acceptance test, file boundary, migration behaviour and validation command
above. Record fresh RED/GREEN evidence where behaviour changes, then write the lane handoff and the
machine proof with `record-tdd`.

Shared auth, work and job-queue changes retain the critical override; steps 9, 10, 11 and 13 touch
shared surfaces and take it. Use the repository Bun wrappers. Authenticated local Brave evidence on
the appropriate deployed origin is required for step 11: a passkey ceremony cannot be proven by
localhost mocks, and no clean-room browser check substitutes for it.

Runtime, provider, cryptographic-compatibility and browser proof remain unrun as of this revision.
Document validation does not stand in for them.
