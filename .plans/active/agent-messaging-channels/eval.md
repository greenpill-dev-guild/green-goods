# Messaging architecture acceptance

**Status:** Evaluation contract. Every runtime case below is unexecuted. The subset the
Buildathon prototype must pass is listed in [Prototype subset](#prototype-subset-2026-09-21);
everything else is deferred and must not be claimed from a demo.

**Last updated:** 2026-09-21 UTC (prototype subset added 2026-09-21; the gate tables below are
unchanged from the 2026-09-11 research pass).

**Architecture:** [spec.md](spec.md). **Sequence:** [plan.todo.md](plan.todo.md).

These checks define what must be demonstrated before a selected feature is released. They are not
test results. O1 and O2 were resolved on 2026-09-21 (see spec section 1): the no-sign-up reading
is settled, and the prototype provider is Meta Cloud API direct. O5 is **not** waived for the
prototype: invited testers use real WhatsApp accounts, so a real identifier is persisted and real
photos publish irreversibly. Its minimum subset — consent at first contact, abandonment deletion
and a named support owner — is inside the prototype; thresholds, the full retention schedule and
support tooling wait for the pilot. O3 account authentication is
a baseline gate; reporting delegation has an additional optional gate. O4 total-loss recovery
remains a disclosed limitation until independently solved.

## Prototype subset (2026-09-21)

The Buildathon prototype must pass exactly these, and claims nothing else:

| ID | Prototype step | Linear |
| --- | --- | --- |
| `SEC-01` — signature rejection **and** provider-event replay | 1 | PRD-943 |
| `CH-01` — **test-number text and photo only** | 2 | PRD-943 |
| `WORK-01` — through publication, not just storage | 3, 4, 5, 9, 13, 14 | PRD-944 |
| `DATA-03` — attachment bounds only | 4 | PRD-944 |
| `SEC-02` | 6 | PRD-945 |
| `AUTH-01` — includes signed domain/audience, not just an `Origin` header check | 7 | PRD-946 |
| `AUTH-03` — **draft-read path only** | 8 | PRD-946 |
| `UX-01` | 9, 10 | PRD-947 |
| `ID-01` — passkey creation, then admission and publication | 11, 12 | PRD-947 |
| `ID-03` — **continuation journey only**, not WhatsApp linking | 7, 11 | PRD-946 |
| `UX-02` — in-app-browser handoff only | 11 | PRD-947 |
| `OPS-05` | 13, 14 | PRD-948 |
| `DATA-02` — consent notice and deletion only | 5, 14 | PRD-944 |
| `DATA-06` — location sanitization, **images only** (new, see below) | 15 | PRD-956 |

`CH-01` is claimed only for text and photo from a verified tester on the Meta test number. Its
Nigerian-payload and voice requirements are **not** claimed: Nigeria is the pilot setting and voice
notes are stretch. `SEC-01` is claimed for signature rejection and for rejecting a replayed
provider event, which step 1 covers with a leased, durable `(provider realm, external
event ID)` claim — leased rather than a bare claim, so an unfinished one is retryable instead of
swallowing Meta's redelivery. It does **not** carry `OPS-01`: cross-channel duplicates, one-logical-intent
reservation and restart-safe business deduplication all remain deferred and unclaimed.

Everything else below is deferred: all of gate 4, `REC-01` through `REC-05`, `COM-01`, `COM-02`,
`DATA-01`, `ID-02` through `ID-07`, `AUTH-02`, `AUTH-04`, `AUTH-05`, `OPS-01` through `OPS-04`,
`SEC-03` through `SEC-06`, `CH-02` through `CH-05`, and `PILOT-01` through `PILOT-03`. `ID-05`,
`ID-07`, `REC-03` and `MIG-01` are named here because a smooth demo could be mistaken for
evidence of them; it is not. `WORK-01` is mapped through publication because its required observation ends at "reaches
consented published metadata; no empty-media fallback" — tests that stop at the agent's durable
draft can all pass while the browser handoff, upload or attestation drops the attachment, so the
criterion needs an end-to-end assertion against the published metadata.

`AUTH-03` is claimed for the **draft-read path only**. Its canonical observation covers foreign
garden, work, draft and attachment IDs across reads, metadata, signed URLs and mutations; step 8
adds one draft-read route and proves that one denial. The other object paths are unproven here and
must not be reported as covered.

`AUTH-01` requires rejecting a wrong origin or domain. The envelope step 7 generalizes does not
supply that on its own: its signed message carries chain, garden, account, action, nonce and
timestamps but no domain or audience, and the origin check reads an HTTP header a non-browser
caller controls. The criterion is claimed only because step 7 adds signed `Domain` and `Audience`
fields and tests cross-environment replay; reusing the envelope unchanged would leave this row
unearned.

`ID-03` is claimed for the **continuation journey only**: an existing EOA holder opens the link,
signs the draft proof and publishes, with authorship unchanged. The linking half of its canonical
case — binding a WhatsApp identity to that EOA — stays deferred. Without this row the hub's own
success condition, which names both passkey and EOA gardeners, would rest on `AUTH-01` alone, and
`AUTH-01` proves backend signature verification rather than a working EOA journey.

**`DATA-06` is a new criterion, not a relabelled one.** Canonical `DATA-02` is private/public
consent and withdrawal and contains no location requirement, so reporting an EXIF test against it
would mark an unrelated consent gate partly satisfied. Location and metadata sanitization gets its
own required observation: published bytes carry no GPS or camera-identifying metadata, and the
media referenced by the attestation resolves to exactly those bytes. `DATA-02` itself is now
genuinely in prototype scope, but only for the minimum the slice added — the first-contact consent
notice and the abandonment/deletion path — not for withdrawal of an already published record, which
cannot be withdrawn. `DATA-06` is claimed for images only: the publication path returns
video bytes unchanged, so the prototype refuses video rather than claiming to sanitize it.

## Gate 1: identity continuity and real authentication

| ID | Scenario | Required observation |
| --- | --- | --- |
| ID-01 | New WhatsApp intake opens in browser | Photo/description/garden survive; existing-account choice is prominent; provisional draft attaches only after correct account and channel proof; public submission waits for admission and signature. |
| ID-02 | Existing passkey account links WhatsApp in either direction | Same expected Kernel address and history; no new account on cache miss, username lookup or browser handoff. |
| ID-03 | Existing EOA links WhatsApp | EOA signs login and publication; original membership/author remain unchanged. |
| ID-04 | Linked EOA and passkey account share a participant | Allowed private data is explicitly scoped; passkey cannot sign as EOA, inherit its garden roles or manage it by default; switching account does not change a pending job. |
| ID-05 | Same user on another device/browser | Authenticate independently, resume allowed server draft; local-only drafts are labelled unavailable until synced; no cookie/key copying. |
| ID-06 | Shared phone or organizational wallet | No name-menu impersonation; assisted collector and signing author are distinct; one Safe signer does not obtain organizational or personal authority automatically. |
| ID-07 | Both sides already have established participants | Automatic merge blocked; dual fresh authority and explicit private-data scope required; existing history/attribution unchanged. |
| AUTH-01 | EOA, deployed Kernel and counterfactual Kernel backend proof | Verify against actual chain/factory/account configuration; reject wrong origin/domain/chain/nonce/expiry/signature; bounded hostile factory simulation; hosted lookup/local auth flag insufficient. |
| AUTH-02 | Garden invite/currentGarden/local steward flag without role | Private intake follows policy; member publication and operator actions denied until exact account's onchain authority is effective. |
| AUTH-03 | Foreign garden/work/draft/attachment IDs | No unauthorized reads, metadata, signed URLs or mutations; all object paths enforce scope. |
| AUTH-04 | Role removed, owner rotated or permission expired during action | Fresh service checks and final contract enforcement deny unauthorized mutation; queue preserves intent and gives an actionable state. |
| AUTH-05 | Browser session expiry/logout/revocation and CSRF attempt | Host-only secure cookie policy and CSRF/origin checks work in actual deployment; revoked epochs invalidate access; private routine token is never exposed. |

## Gate 2: evidence, approval and binding actions

| ID | Scenario | Required observation |
| --- | --- | --- |
| WORK-01 | Photo plus description submitted through chat | Durable private attachment survives restart, appears in PWA review and reaches consented published metadata; no empty-media fallback. |
| WORK-02 | Gardener publishes, authorized distinct steward approves | Correct separate attesters and exact work UID/garden; no approval before publication receipt; known same-participant self-approval denied. |
| WORK-03 | Steward rejects or requests changes | Honest application/protocol state and notification; no accidental positive approval or duplicate work. |
| COM-01 | Prepare/accept interest in chat | Nonbinding state only; no transaction or hidden financial authorization from “yes.” |
| COM-02 | Each selected commitment lifecycle mutation in PWA | Full current payload and effects displayed; correct actor signs; edited/stale revision requires new review; incompatible role/account rejected. |
| DATA-01 | Same draft edited in PWA and WhatsApp concurrently | Revision conflict visible; no silent overwrite; signed intent remains immutable. |
| DATA-02 | Private/public consent and withdrawal | Publication requires appropriate content/purpose consent; opt-out stops applicable processing/delivery; deletion handles eligible private data and explains public-copy limits. |
| DATA-06 | Location and camera metadata on published media | Published bytes carry no GPS or camera-identifying metadata; the media referenced by the attestation resolves to exactly those bytes; a format that cannot be sanitized is refused rather than published. |
| DATA-03 | Oversized, misleading, redirected or malicious attachment | Bounded fetch/decode, no SSRF/token leak/executable processing; error visible; other gardens retain service capacity. |

## Gate 3: retries, recovery and containment

| ID | Scenario | Required observation |
| --- | --- | --- |
| OPS-01 | Duplicate webhooks/taps across channels and worker restart | One reserved logical intent; no double execution by service; committed ingress and business deduplication survive restart. |
| OPS-02 | Lost broadcast response or replaced UserOperation | submitted_unknown reconciles by persisted identity; no blind fresh publication; replacement and final failure distinguished. |
| OPS-03 | Publication succeeds, approval fails | Persist work UID and receipt; retry only approval; transport deduplication does not strand the action as completed. |
| OPS-04 | Reorg, delayed indexer, expired session and logout | Receipt/finality/index states separated; signer/account frozen; user resumes with required identity. |
| OPS-05 | Outbound provider failure after chain success | Work remains confirmed in PWA; outbox retry respects consent/window and does not rebroadcast transaction. |
| SEC-01 | Invalid Meta/Twilio/Telegram signature or replay | Reject before domain processing; provider-specific raw-body/URL/header fixtures; valid provider event still cannot bypass garden policy. **Prototype reading:** this case was written against Twilio request-signature validation. Under the Meta Cloud API it is `X-Hub-Signature-256`, verified with the app secret over the preserved raw body, and the GET subscription verify token is a separate mechanism that must not be conflated with it. |
| SEC-02 | Forwarded link, preview GET, replay, concurrent consumption | No draft disclosure or account change from GET/locator alone; both proofs and browser binding required; only one consume succeeds. |
| SEC-03 | Stolen phone/SIM change/recycled number | No account recovery, owner change, privileged history claim or session renewal; authorized owner can revoke channel. |
| SEC-04 | Messaging/API credential compromise | No owner signature, approval, commitment or funds authority gained; document accessible private-data/draft exposure and legacy custodial residual risk. |
| SEC-05 | Cross-garden flood and media/AI prompt injection | Per-garden quotas isolate availability; message content cannot select trusted roles, signatures or executable tools. |
| SEC-06 | Kill switch and rollback | Stop new actions independently; keep reconciliation and owner access; no custodial fallback; drain/reconcile old delivery queues. |
| REC-01 | Cache cleared, signed out or hosted credential lookup unavailable | Original account recovered when credential available; explicit retry when unavailable; never auto-register a replacement account. |
| REC-02 | Replacement phone/channel relink | Fresh owner and new-channel proofs; binding epoch increments; old continuations/sessions/grants invalid. |
| REC-03 | Total signer loss | No same-address recovery promise without a preconfigured, successfully tested recovery mechanism; support cannot claim the wallet. |
| REC-04 | Owner credential actually compromised | Distinguish service freeze from onchain ownership power; disclose limits and exercise available rotation/recovery. |
| REC-05 | Unlink/delete/STOP | User can distinguish notifications, channel access and onchain permission; required revocations tracked to effective state; eligible data purged. |

## Gate 4: conditional delegation and legacy migration

Delegation checks apply only if that later feature is selected. They cannot be waived by a smooth WhatsApp demo.

| ID | Scenario | Required observation |
| --- | --- | --- |
| DEL-01 | Installed reporting policy under adversarial calldata | Actual deployed module denies wrong garden/schema/target/value, arbitrary batch/multi-attest/delegatecall, owner changes, approvals, commitments, funds and roles. Selector-only evidence fails this gate. |
| DEL-02 | Stolen reporting key with service checks bypassed | Promised expiry/call/gas ceilings independently enforced; document permitted false-report risk and approval effects. |
| DEL-03 | Owner revokes while messaging backend is down | Independent route available; service disabled and onchain revoked shown separately; key cannot act after effective revoke or expiry. |
| DEL-04 | Expiry or channel-only renewal attempt | Grant stops at expiry; WhatsApp/SMS proof cannot extend onchain authority; owner must approve new policy. |
| MIG-01 | Existing custodial Telegram user has pending work/history | Backfill preserves original IDs/addresses/provenance; no automatic key export, identity merge or ownership relabel. |
| MIG-02 | Legacy user moves future work to passkey account | Both intended identities/authority handled explicitly; garden admission for new account; old records and unfinished operations retained; funds/active commitments separately scoped. |
| MIG-03 | Database migration rollback and multi-worker race | Sanitized representative fixture and backup/restore rehearsal; unique bindings/operation leases hold across restarts and actual deployment topology. |

## Gate 5: provider and Nigeria delivery

| ID | Scenario | Required observation |
| --- | --- | --- |
| CH-01 | Real WhatsApp sender receives Nigerian text/photo/voice payloads used by pilot | Valid signatures and opaque sender mapping, including phone-absent/BSUID fixtures where applicable; actual feature availability recorded separately from mock coverage. |
| CH-02 | Inside/outside customer-service window, rejected template, STOP | Correct free-form/template behavior; no unconsented SMS fallback; retry and support routes available. |
| CH-03 | Sender/provider cutover with pending messages | Preserve participant and operation records; verify identifier continuity or re-pair; one outbound owner; no duplicate chain publication. |
| CH-04 | Proposed Nigeria SMS extension | Provision and prove actual inbound/outbound carrier routes and opt-out; price multipart text; provide authenticated photo handoff. Twilio two-way Nigeria SMS is not assumed available. |
| CH-05 | Human escalation and provider-policy review | Assigned support owner, limited inbox access, billing account and approved use-case/consent/template evidence; commitment/funding experience reviewed as actually offered. |

## Gate 6: user experience and research acceptance

| ID | Scenario | Required observation |
| --- | --- | --- |
| UX-01 | TAS gardeners complete first draft and publication | Clear draft/published/approved labels; exact continuation retained; account setup/installation distinction understood; no-sign-up conflict resolved explicitly. |
| UX-02 | Low bandwidth, interrupted upload, device switch, in-app browser | Visible progress/retry; no lost confirmed draft; supported browser passkey handoff on actual TAS devices. |
| UX-03 | Authenticated PWA and steward journeys | Local evidence uses the authenticated Brave workflow; production device proof supplements it. Capture visible account, scope, error and recovery states without sensitive material. |
| PILOT-01 | Baseline versus pilot reporting/review cycles | Measure gardener, steward and support labor together; consent comprehension, acceptance and correction rates, completion and abandonment; threshold and sample agreed before run. |
| PILOT-02 | Actual invoices and operating effort | Cost per accepted submission includes provider/Meta, media, gas, subscriptions and support; separate estimates from observed costs. |
| PILOT-03 | Research owner/TAS acceptance | RESR-75 entry criteria explicitly accepted or revised by their owner; publish no “successful pilot” claim from delivery counts alone. |

## Evidence recording

For each executed case, record environment, fixture/device/provider, exact account type and deployment version, case ID, expected/actual result and privacy-safe artifact reference. Runtime validation receipts require tested commit, UTC timestamp, exact commands and worktree identity under the repository rules. Do not put phones, wallets, tokens, raw media or private messages in public evidence or ordinary analytics.

Run the validation selector before choosing implementation checks. Use selected Bun wrappers, auth/work/contract critical gates and authenticated browser proof where applicable. Fault injection and real provider/account fixtures complement unit tests; a mock signature or sandbox success is not production compatibility evidence.

Documentation validation for this research update is limited to canonical hub/schema validation, local Markdown links, coverage references and diff hygiene. No case above is marked passed by that validation.
