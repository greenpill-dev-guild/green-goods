# Messaging integration delivery proposal

**Feature slug:** agent-messaging-channels

**Status:** DRAFT; idea stage; all implementation lanes manually blocked.

**Created:** 2026-04-17

**Last updated:** 2026-09-11 UTC

**Specification:** [canonical architecture](spec.md)

**Evaluation:** [acceptance and failure tests](eval.md)

**Linear project:** [Agent Messaging Channels (WhatsApp + SMS)](https://linear.app/greenpill-dev-guild/project/agent-messaging-channels-whatsapp-sms-71cda634fcf7)

**Mirror:** PRD-339 is stored historical metadata; unresolved during final research. No Linear sync was performed.

This sequence is a delivery design for scope selection. It is not an active dispatch list. The full architecture lives in the spec; accepted implementation slices must be smaller than these workstreams, generally one package and three or four files per session, with exact paths and behavior proof agreed at activation.

## Decision log

| Decision | State | Delivery effect |
| --- | --- | --- |
| Nigeria, English, WhatsApp first for TAS | Accepted A1 | Prove on TAS devices/carriers and actual sender configuration. |
| PWA confirmation for approvals and binding commitments | Accepted A2 | No approval/commitment keys in the messaging runtime. |
| Canonical participant with independent account/channel bindings | Proposed P1 | Shared policy precedes additional adapters; no role union. |
| Reuse accounts; private intake before account creation | Proposed P2 | Explicit provisional-to-established handoff and duplicate detection. |
| Owner signs work in first release | Proposed P3 | No session validator or delegated signer required for baseline. |
| Reporting-only delegation later | Proposed P4 | Separate contract/account compatibility and security gate. |
| One business sender initially | Proposed P5 | Garden scoping belongs in workflow authorization. |

## Gate 0: select a pilot that can be evaluated

- [ ] Resolve O1 with TAS/product and the RESR-75 research owner: browser account setup versus private assisted intake without sign-up. Do not silently rewrite the research criterion.
- [ ] Select O2 using real sender ownership, Nigeria provisioning, template/media tests, support model and cost evidence. Do not purchase or provision as part of this draft.
- [ ] Agree O5 consent, raw/public evidence handling, retention, support owner, cohort and success thresholds.
- [ ] Confirm personal account types/default chain and actual deployed account/factory/module configuration for authentication. Keep total-loss recovery limits explicit.
- [ ] Verify the existing Linear mirror before any separately authorized sync; preserve historical Done issue descriptions.

## Delivery sequence and direct proof

Each numbered workstream has one clear outcome. Split implementation only after the boundary is selected; avoid speculative scaffolding or a new package. Existing files below are starting points, not an instruction to edit them now.

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

Step 10's provider fixture investigation may happen during Gate 0, but transport integration consumes the shared identity/workflow contract. Step 11 spans several packages as a workstream only; never dispatch it as one implementation slice. If any baseline step requires a contract change, stop that slice and update the plan in contract → shared → indexer → consuming application dependency order before resuming.

## Requirements coverage

| User requirement | Architecture | Delivery | Proof |
| --- | --- | --- | --- |
| Report using an existing passkey PWA account | Spec 4–6 | 1–10 | ID-01, ID-02, AUTH-01, WORK-01 |
| Report using an existing EOA | Spec 5–7 | 1–10 | ID-03, ID-04 |
| New WhatsApp user continues in PWA | Spec 5–6 | Gate 0, 2–8 | ID-01, ID-05, UX-01 |
| Switch channels/devices without duplicate work | Spec 8–9 | 5–10, 12 | DATA-01, OPS-01–04 |
| Only intended garden members act | Spec 7 | 3–4, 8–11 | AUTH-02–04 |
| Approve work and make commitments safely | Spec 8 | 9, 11 | WORK-02–03, COM-01–02 |
| Account compromise containment and recovery | Spec 10–12 | 3–6, 13–14 | SEC-01–06, REC-01–05 |
| Provider choice and TAS WhatsApp rollout | Spec 13–14 | Gate 0, 10, 13 | CH-01–05, PILOT-01–03 |
| Telegram and Nigeria SMS path | Spec 5, 13–14 | 12, 14 | MIG-01–02, CH-04 |

## Migration and rollout controls

Use additive migrations that preserve platform IDs, custodial addresses, pending work and operation references. Start with an inventory and recoverable backup; rehearse against a sanitized representative database. Introduce identity backfill without signing changes, then enable new linking/drafts for one garden. Do not silently merge established participants or delete keys while unresolved legacy operations depend on them.

Activate publication, approval and commitment paths separately. Keep reads and reconciliation running when writes are disabled. Preserve a rollback reader for existing records until migration acceptance; do not revert to unsafe key creation or replay old approval handlers.

## Exclusions

No automatic EOA conversion, new custodial identity service, global proof-of-personhood, phone-based wallet recovery, messaging-held owner keys, delegated approvals/commitments/funds, group scraping, new dependency installs, protocol upgrade or broad API-token distribution is authorized. SMS fallback and report delegation remain conditional extensions.

## Validation and handoff

Before any runtime slice, read the nearest package guide and render the validation selector for its exact paths and intent. Shared auth/work/job queue and contract changes retain the critical override. Use repository Bun wrappers and the selected direct tests; do not substitute clean-room browser checks for authenticated local Brave evidence.

Every selected slice must name its acceptance tests from eval.md, exact file boundary, migration/rollback behavior and validation commands before implementation. Record fresh RED/GREEN evidence where behavior changes, then write the lane handoff and machine proof. No lane is ready or completed from this document.

This research pass changes only the five canonical Plan Hub files. Its appropriate proof is Plan Hub validation, document-link/coverage checks and diff hygiene. Runtime tests, provider tests, cryptographic compatibility and browser QA remain unrun; document validation cannot stand in for them.
