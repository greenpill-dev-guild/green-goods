# Messaging identities and garden workflows

**Status:** Active hub. The target architecture below remains a proposal. One slice of it — the
Buildathon prototype in section 15.1 — was scope-locked on 2026-09-21 and is authorized to build.
Everything outside section 15.1 stays unselected.

**Last researched:** 2026-09-11 UTC (2026-09-10 in Los Angeles).

**Repository evidence:** 1031aa78fa93f3adfbdf9820150a79c101282414. Source inspection, not live transaction or authenticated browser proof.

**Supersedes:** [the April architecture at the researched commit](https://github.com/greenpill-dev-guild/green-goods/blob/1031aa78fa93f3adfbdf9820150a79c101282414/.plans/ideas/agent-messaging-channels/spec.md). Historical decisions remain in Git and status history.

**Companion documents:** [brief](brief.md), [proposed delivery sequence](plan.todo.md), [acceptance and failure tests](eval.md).

The proposed design gives a gardener one private Green Goods participant record, with independently verified messaging channels and blockchain accounts attached. A channel lets someone communicate; an account proves who can sign; a garden decides what that account may do. Linking these records must preserve those distinctions.

WhatsApp is the first entry point for TAS in Nigeria, in English. Gardeners can prepare work in a private conversation and continue the same draft in the browser or installed PWA. Final approvals and binding commitments require secure PWA confirmation in the pilot. The proposed first release also requires the gardener to sign each work publication in the browser; optional delegated reporting comes later.

## 1. Decisions and unresolved gates

A1–A3 are accepted user decisions. P1–P5 were recommendations awaiting selection; P2 and P3 were
adopted for the prototype slice on 2026-09-21, and P1, P4 and P5 remain unselected. O1 and O2 were
resolved on 2026-09-21 to the extent stated below; O3, O4 and O5 remain open. Documentation
completion does not close any of them.

| ID | State | Decision or question | Consequence |
| --- | --- | --- | --- |
| A1 | Accepted | WhatsApp first for TAS; Nigeria; English | **This is the TAS pilot setting, not product scope.** Pilot recruitment, carrier proof and costs must reflect it. The criteria themselves are geography neutral (RESR-75), and the prototype runs against a test cohort rather than Nigeria. |
| A2 | Accepted | Final steward approvals and binding commitments use secure PWA confirmation initially | Chat can prepare an action and show its status; it cannot supply final authority. |
| A3 | Accepted | Research and capture continuity across WhatsApp, Telegram, SMS, passkeys and EOAs | This document covers all paths; it does not authorize implementation. |
| P1 | Proposed | Private participant record with separate account and channel bindings | Avoid another custodial identity silo; preserve original transaction authors. |
| P2 | Proposed; **adopted for the prototype slice 2026-09-21** | New users start with private drafts; existing users reuse their current account | Do not generate another wallet merely because someone opens WhatsApp. |
| P3 | Proposed; **adopted for the prototype slice 2026-09-21** | Owner signs each work publication in first release | Avoid a new delegated signer or validator before the core journey is proven. |
| P4 | Proposed | Add narrowly scoped reporting delegation only after independent security proof | Delegation excludes approval, commitments, funds, membership and account management. |
| P5 | Proposed | One Green Goods business sender, garden context inside the application | Separate garden-owned business senders are a later operating model. |
| O1 | **Resolved 2026-09-21** | Is one browser passkey setup acceptable before a new user's first onchain publication? | Yes, under RESR-75 criterion 1 as accepted: zero account steps to reach a saved private draft, then exactly one browser passkey step before that draft becomes a public, gardener-signed record. No custodial wallet is created, and phone access never grants a garden role or recovers an account. |
| O2 | **Resolved for the prototype 2026-09-21; open for the pilot** | Direct Meta, Twilio or another provider; who owns sender, billing and support? | The prototype uses the **Meta WhatsApp Cloud API directly** on the free test number. A Twilio number exists but is held unregistered and, if used, is registered directly with Meta as a phone number only — Twilio is not the provider. The WhatsApp Business Account is operated by **WEFA LLC**. The pilot provider decision still needs actual Nigeria provisioning, media, template, migration and cost evidence. |
| O3 | Open: technical/security | Can the deployed Kernel configuration verify both deployed and counterfactual account proofs and enforce the proposed reporting restriction? | First prove authentication; delegation is a separate optional gate. Generic SDK documentation is insufficient. |
| O4 | Open: recovery | Which preconfigured mechanism can recover the same account after total signer loss? | RESR-21 is unresolved. Do not advertise phone-based wallet recovery. |
| O5 | Open: operations | Consent wording, data retention, pilot budget, support ownership and pass/fail thresholds | Agree before recruitment or production data collection. |

The no-sign-up branch remains private intake with clearly attributed assisted support. It does not become a gardener-signed public record until a real gardener account exists and authorizes publication. Retaining custodial account creation would be a different product and security decision, not an invisible fallback.

## 2. What exists and what needs correction

These are source-established observations at the commit above unless marked otherwise.

| Surface | Evidence | Architectural implication |
| --- | --- | --- |
| Messaging normalization | [InboundMessage](../../../packages/agent/src/types.ts) already models platform, sender, conversation, message ID and multiple content types. [Telegram adapter](../../../packages/agent/src/platforms/telegram.ts) implements the current transport. | Extend this boundary; do not plan a first-time normalization rewrite. Platform enum entries do not prove WhatsApp/SMS adapters exist. |
| Current identity | [Start handler](../../../packages/agent/src/handlers/start.ts), [database schema](../../../packages/agent/src/services/db/schema.ts), [user persistence](../../../packages/agent/src/services/db/users.ts) create/store a random EOA per platform user. Keys are encrypted at rest and decrypted for runtime use. | Current Telegram is custodial. Encryption does not protect users against compromise of the runtime and its decryption authority. |
| Garden selection | [Join handler](../../../packages/agent/src/handlers/join.ts) checks a garden and changes currentGarden. | Conversation context is not membership admission or signing authority. |
| Evidence submission | [Photo handler](../../../packages/agent/src/handlers/index.ts) collects draft photo buffers, but [submit confirmation](../../../packages/agent/src/handlers/submit.ts) creates pending work with an empty media list. | The current path needs durable media preservation; “Telegram only needs polish” understates this workflow gap. No live reproduction was run. |
| Approval | [Approve handler](../../../packages/agent/src/handlers/approve.ts) uses the gardener's custodial key to publish work, then the steward's key to approve it. [Idempotency](../../../packages/agent/src/services/db/idempotency.ts) tracks handler/message completion. | Work and approval are separate transactions and authors. A failed second step must not republish the first. Message deduplication alone is not business-operation recovery. |
| Contract authority | [Work resolver](../../../packages/contracts/src/resolvers/Work.sol) checks attester garden membership; [WorkApproval resolver](../../../packages/contracts/src/resolvers/WorkApproval.sol) requires an operator and distinct work/approval attesters. | Preserve real author accounts; account linking never creates garden roles. Work evidence and approval can affect commitment credit. |
| Agent API | [Hono server](../../../packages/agent/src/api/server.ts) exposes existing read and bounded authenticated routes; [private bearer auth](../../../packages/agent/src/api/http/auth.ts) serves private routines. | There is no general end-user transactional submit/approve API ready to expose. Never distribute BOT_API_TOKEN to gardeners or clients. |
| Signed API precedents | [Saved-offer auth route](../../../packages/agent/src/api/routes/saved-offers.ts), [garden join-request auth](../../../packages/agent/src/api/routes/garden-join-request-auth.ts). | Reuse nonce/audience/chain/owner/time verification patterns through an explicit shared policy; do not treat each route as universal authentication. |
| Saved data | [Saved-offer service](../../../packages/agent/src/services/saved-offers.ts) uses server-managed AES-256-GCM and owner scoping. | Saved offers are not wallet-derived client ciphertext. PWA local drafts, server records and public chain records have different portability boundaries. |
| Passkeys and EOAs | [Auth machine](../../../packages/shared/src/workflows/authMachine.ts), [passkey adapter](../../../packages/shared/src/workflows/auth-passkey-adapters.ts), [auth services](../../../packages/shared/src/workflows/authServices.ts). | Login currently selects wallet or passkey mode. Passkeys build Kernel 0.3.1 accounts with EntryPoint 0.7; changing modes does not link their identities. |
| Passkey continuity | [Passkey configuration](../../../packages/shared/src/config/passkeyServer.ts) uses greengoods.app RP ID; hosted discovery is enabled by default in production. [Session metadata](../../../packages/shared/src/modules/auth/session.ts) includes local state. | Preserve canonical origin/account derivation. Browser metadata or successful credential lookup is not backend authentication. |
| Commitments | [Call builder](../../../packages/shared/src/modules/job-queue/commitment-call-builder.ts), [account profiles](../../../packages/shared/src/modules/commitment-pooling/account-profiles.ts). | Binding payloads include participants, pool/cycle, requirements, due/confirmation times and consideration. Do not reduce them to an unscoped chat “yes.” |

The April spec's Twilio selection, 30-day sessions renewed by SMS, delegated approvals, custom-validator audit dates, SMS-only fallback, Fastify routes and Q2 deadlines are superseded assumptions. No evidence establishes those deliverables as shipped. Template requirements also extend beyond marketing.

## 3. System boundary and ownership

~~~mermaid
flowchart TD
  WA[WhatsApp provider] --> IV[Verify transport and persist ingress]
  TG[Telegram] --> IV
  SMS[Provisioned SMS provider] --> IV
  IV --> CB[Resolve channel binding]
  CB --> WF[Garden workflow service]
  WEB[Browser or installed PWA] --> AUTH[Verify account proof and scoped session]
  AUTH --> WF
  WF --> D[Private drafts, attachments and revisions]
  WF --> INTENT[Immutable action intent and authorization]
  INTENT --> OWNER[Owner signs in PWA]
  INTENT -. Later reporting only .-> LIMIT[Restricted signer]
  OWNER --> CHAIN[Existing contracts and account validation]
  LIMIT --> CHAIN
  CHAIN --> REC[Receipt reconciliation and indexer reads]
  REC --> OUT[Delivery outbox]
  OUT --> WA
  OUT --> TG
  OUT --> SMS
~~~

Keep adapters limited to authenticating transport, normalizing content, fetching bounded media and delivering responses. A single workflow policy resolves the participant, explicit garden, exact signing account, action and revision. It is reused by PWA and chat. It owns authorization and operation state; adapters never create wallets or decide roles.

Account verification and action authorization are separate interfaces. Auth verifies possession and returns an account-scoped principal. Workflow authorization checks resource ownership, current garden/contract roles, permitted session capability and immutable intent. Signer execution accepts only an already-authorized intent and never guesses an account from the active chat.

Within existing packages: transport, persistence and HTTP composition belong in agent; reusable auth/workflow contracts and hooks belong in shared; browser journeys belong in client. Contracts remain the ultimate onchain authority. Extend indexer reads only where new activity/status evidence requires it; do not put phone or identity-link data onchain or in the public index.

This needs no new package, general identity microservice, event bus or self-hosted passkey server by default. Begin with existing persistence conventions plus transactional migrations. A multi-replica deployment requires proven shared durability, uniqueness and worker coordination; a process-local queue or per-replica SQLite file is insufficient. Hosting and volume topology remain deployment checks.

## 4. Identity model and invariants

A participant is a private application record, not proof of a unique human. An account binding proves control of an EOA or supported personal smart account. A channel binding proves current access to a provider-scoped sender. A garden membership associates a particular account with a role under the existing protocol.

| Proposed record | Essential fields and constraints |
| --- | --- |
| Participant | Random opaque ID; provisional/active/suspended state; createdAt; profile version. No phone-derived primary key. |
| AccountBinding | Participant ID; chainId; canonical address; EOA/Kernel type; verifiedAt; proof method; active/revoked state; account-management authority designation. Active (chainId,address) belongs to at most one personal participant. |
| AccountDescriptor | Original address, chain, factory, initialization parameters/salt, account/version, EntryPoint, initial owner public data and RP ID. Preserve original derivation and validated upgrades. Public metadata only. |
| AuthenticatorReference | Credential/provider reference, public key metadata and relationship to a specific account; login-only versus onchain owner distinction. Existing passkey provider remains credential-discovery authority. No private passkey material. |
| ChannelBinding | Participant ID; channel kind; provider realm/business scope; external subject; verifiedAt; consent version; state; monotonically increasing binding epoch. One active personal binding for each scoped external subject. |
| GardenContext | Participant, garden, chain and explicitly chosen signing account; admission state; role-read provenance. Cached roles are display hints, not authorization. |
| LinkAttempt | Random ID; hash of challenge secret; intended operation; source session/browser binding; target channel/account; expiry; proof states; consumedAt; attempt count. Atomic single consumption. |
| AppSession | Hashed opaque ID; participant and authenticating account; granted scopes; authTime; expiry; credential/binding epoch; revokedAt. Capabilities never inferred from participant ID alone. |
| Draft / Revision / Attachment | Owner or provisional intake ID; explicit garden; revision; schema version; author account when selected; private media references and content hashes; consent; retention expiry; source provenance. |
| ActionIntent / Operation | Stable logical ID; exact action payload hash and revision; signing account/chain; authorization evidence; state; transaction/UserOperation references; receipt/finality/index status; retry and failure details. |
| DelegationGrant | Account; garden; channel binding epoch; session public key; policy/module identifier and code version; scope; expiry; sponsorship cap; install/revoke operation references and effective status. |
| Consent / Admission / Audit | Versioned purpose-specific consent and garden admission decisions; actor/account, action, result, timestamp and correlation ID. Do not copy message bodies or secrets into generic logs. |

Encrypt provider identifiers and destination addresses at rest; use a keyed HMAC for searchable identifier indexes, with key versioning and rotation. A plain hash of a phone number is enumerable. Normalize E.164 only when a phone number is actually supplied; retain provider-issued identifiers as opaque strings.

WhatsApp identity must accommodate business-scoped user IDs (BSUID), possibly without a visible phone number. Display names and usernames are not stable keys. Rollout and actual Nigeria payloads need verification. A provider change can alter identifier scope; it does not justify automatically merging people by phone. Telegram uses the numeric user ID, not username or group chat ID. SMS demonstrates access to a number, not continuity of a person. [Twilio identity documentation](https://www.twilio.com/docs/whatsapp/key-concepts)

The following are mandatory if this proposal is adopted:

1. Linking does not union garden roles, transfer balances, change historical attesters or make a passkey able to sign for an EOA.
2. Every mutation freezes one account, one chain, one garden, one action and one revision before authorization.
3. A weak channel proof cannot add a wallet owner, appoint a recovery authority, merge established accounts or broaden permissions.
4. A second verified account may access only the private resources explicitly shared during linking. It does not automatically gain account-management authority.
5. An organizational Safe or garden token-bound account is not a personal login merely because someone controls one signer. Organizational access requires its own account-policy proof.
6. Self-approval is rejected at the contract account boundary. The service additionally rejects known same-participant self-approval across linked accounts; this is not global Sybil resistance.

## 5. Common journeys

### New gardener: WhatsApp to browser to WhatsApp

The gardener opens a private conversation with the official business sender from a TAS invitation. The bot explains what stays private, what publication means and how to reach a person. It records consent, resolves the garden invitation and starts provisional intake. An invitation can nominate a garden; it cannot grant a blockchain role.

The gardener sends a photo and description. The bot confirms the garden and work details, allows corrections, then displays “Draft saved” with a continuation action. Garden admission can be pending while this private draft exists. Do not label this “submitted onchain” or “approved.”

Under proposed P3, the continuation opens the canonical Green Goods browser origin. Present “Use my existing account” prominently, followed by “Create a passkey.” Existing accounts authenticate; new passkeys create one permanent account after an explicit choice. Complete the two-sided link protocol below and attach the provisional draft without changing its content or attribution. First publication waits for account membership and the gardener's signature.

The PWA opens that exact draft, not a generic home screen. The gardener reviews its public content, author account and garden, then signs. Persist the operation before broadcast. WhatsApp shows confirmation only after the defined chain receipt state; it can separately say that indexing is pending. Returning later opens the same record from either channel.

Installing the PWA is optional. The browser should retain the task across authentication and offer installation after successful work, rather than making it a prerequisite. Browser handoff must handle WhatsApp's in-app browser: if passkeys cannot complete there, use a resumable continuation in the supported system browser without copying cookies or private keys. Actual Android/iOS behavior remains a pilot test.

### Existing passkey PWA user: add WhatsApp

From account settings, choose “Connect WhatsApp.” Reauthenticate with the existing account, create a bound link attempt, then open the official WhatsApp sender with an opaque pairing token. The bot resolves the incoming sender and asks for confirmation. The browser shows a masked channel and the intended garden/reporting permissions; the user completes the match. No new wallet or garden membership is created.

If the gardener instead starts in WhatsApp, “I already use Green Goods” launches the same protocol in the reverse direction. Detect an already-bound account after verified authentication and offer to attach the new channel. Never select accounts by phone, display name, hosted passkey username or device cache.

### Existing EOA user

Connect the existing wallet and sign an account-authentication challenge; link WhatsApp using the same two-sided proof. Keep the EOA as the author and retain its existing membership. Draft in chat; sign publication, approval and commitments with that EOA in the PWA.

A linked passkey account is a separate account. It may share explicitly authorized private application data, but its garden membership and balances remain separate. “Use passkey to log in to an EOA-owned profile” would require a deliberately scoped login-only credential and backend verification; current passkey account creation is not that feature. Exclude it from the first slice unless selected.

To move future work to a passkey smart account, prove both accounts, disclose the new address, establish the new account's membership through the garden, and set the future default explicitly. Historical records retain the EOA author. Moving funds, commitments or roles is separate work. EIP-7702 is a possible future path, requiring explicit delegation and compatibility/security review; it is not automatic EOA conversion. [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)

### Multiple accounts, gardens and devices

Store an explicit preferred signing account per garden. Always show it for binding actions. A passkey session cannot silently submit using a linked EOA, and switching gardens must not change an already-authorized job. Offer the correct signer when the active one lacks authority.

Cross-device use authenticates again, retrieves allowed server drafts and checks the expected account address. Synced passkeys may help, but availability depends on the user's credential ecosystem. Local-only PWA drafts remain on their original device until explicitly uploaded; participant linking does not synchronize IndexedDB. Owner-scoped saved offers retain their existing access policy unless a separate migration is authorized.

An ordinary personal phone may link to one participant in a provider scope. Shared household/community phones use an explicitly assisted intake path; choosing a person's name from a menu cannot authorize their account. Record who collected evidence and who later signed it.

### Duplicate accounts and legacy Telegram

If both sides already have established participants, stop automatic linking. Require fresh proofs from both existing authorities, show exactly which private data would be shared, and resolve conflicting channel/garden preferences explicitly. A provisional, unclaimed intake can be attached after its channel proof and target account proof; an established participant cannot be taken over this way.

Backfill existing Telegram records as legacy custodial accounts with original addresses and message provenance. Do not export keys into WhatsApp or relabel them as passkey accounts. Migrate future work through proven user-controlled accounts and new membership where necessary, preserving history and open operation references. Moving balances, role-bearing accounts or active commitments requires a separate migration decision. Rotating database encryption does not remove the authority of a leaked EOA key.

## 6. Linking and backend authentication protocol

Use one versioned protocol for channel linking from either direction. Proposed defaults for testing: at least 128 bits of random secret, 10-minute link expiry, fresh owner proof within 5 minutes for sensitive confirmation, strict per-source and per-attempt limits. These values are recommendations to validate, not accepted settings.

~~~mermaid
sequenceDiagram
  participant B as Browser
  participant S as Green Goods service
  participant C as Verified chat channel
  B->>S: Begin link with fresh account proof
  S-->>B: Browser-bound attempt and opaque challenge
  B->>C: Open official sender with challenge
  C->>S: Authenticated inbound pairing response
  S-->>C: Display pairing context and request confirmation
  S-->>B: Display masked channel and requested access
  B->>S: Confirm exact binding with fresh authorization
  S->>S: Atomically verify both proofs and consume attempt
  S-->>B: Binding active, scoped data available
  S-->>C: Linked; report permissions explained
~~~

The reverse journey starts with an authenticated inbound message and adds the account/browser proof before confirmation. A forwarded link alone is insufficient: the intended channel must approve the browser attempt, and an existing participant must authorize changes with its established account-management authority. Show a matching short phrase/code on both surfaces to reduce accidental pairing; that code is a comparison aid, not the sole secret.

GET requests, link previews and prefetch never consume attempts, authenticate a browser or execute an action. A continuation URL contains no bearer session, key, phone number or sensitive draft payload. Use an opaque locator plus browser-bound exchange; redact query values from logs, remove them from the address bar after exchange and use a strict referrer policy. A stolen unconsumed locator must not yield draft access.

The server creates and consumes authentication nonces. Verify domain/origin, audience, chain, address, issuance/expiry, purpose and nonce. For EOAs, prefer SIWE for login; use a separately specified signed action authorization for linking, delegation or publication when its structured fields exceed the login contract. Freeze the exact bytes/schema and reject ambiguous or conflicting fields. [SIWE](https://eips.ethereum.org/EIPS/eip-4361)

For deployed smart accounts, verify the account's signature policy through ERC-1271 on the intended chain. Counterfactual accounts require a supported ERC-6492 verification path and independently checked factory/address derivation. Bound simulation work and allow only supported factory/code configurations; never execute arbitrary user-supplied factory data as a privileged deployment. Expired, replayed, wrong-chain and changed-owner proofs must fail. [ERC-6492](https://eips.ethereum.org/EIPS/eip-6492)

A passkey authenticates through a verified challenge and supported account-signature path; local auth state or hosted credential retrieval alone never creates a backend session. Validate WebAuthn origin, RP ID, challenge and required user verification using the existing supported implementation. Adding another passkey reference is not an onchain owner update: the existing owner must authorize the account change and its receipt must be checked before advertising the new credential as a signer. Preserve the original account descriptor; do not derive a replacement address from a new credential. [WebAuthn](https://www.w3.org/TR/webauthn/), [Pimlico passkey server](https://docs.pimlico.io/guides/how-to/signers/passkey-server)

Proposed browser session transport is a same-origin backend facade with host-only Secure/HttpOnly cookies, SameSite protection, CSRF/origin checks and server revocation. This requires explicit deployment wiring; it is not current functionality. Do not use broad greengoods.app subdomain cookies or durable localStorage bearer tokens. Proposed initial session limits are 15 minutes idle and 8 hours absolute; fresh account proof is still required for sensitive changes. Channel sessions get a separate scope and never inherit browser cookies.

The workflow boundary should expose the following logical commands. Names describe proposed interfaces, not existing routes. Choose concrete HTTP paths and versioned wire schemas in the selected implementation slice; all mutation requests use validated bodies and a request idempotency key, never authority-bearing query parameters.

| Command | Required input and authority | Result and failure behavior |
| --- | --- | --- |
| Begin/verify account authentication | Server nonce, supported account descriptor and signed login proof | Account-scoped session; one-time nonce consumed atomically; no identity lookup result exposed before proof. |
| Begin/prove/confirm link | Attempt ID, independently verified channel event and fresh existing management-account proof; exact requested sharing/capability scope | Binding and new epoch committed together; expired, consumed or conflicting attempts cannot create another binding. |
| Read/create/update draft | Scoped session or verified intake channel; explicit garden; draft ID; expected revision; validated content/attachment references | New revision or conflict; absent/foreign private resources yield a non-enumerating response. |
| Prepare action | Authorized account, chain, garden, draft revision, action kind and canonical payload | Immutable intent and review summary; current role and content checks; no broadcast. |
| Submit/reconcile operation | Intent ID, exact signed payload or authorized scoped signing request, stable operation identity | Persist before dispatch; return pending/confirmed/failed state; conflicts never silently generate a new intent. |
| Revoke binding/session/grant | Fresh designated management-account proof, target ID and expected epoch | Immediate service revocation plus separate tracked onchain operation where applicable. |

Use explicit error categories for authentication required, forbidden, revision conflict, expired attempt, rate limit, provider unavailable and submitted-but-unresolved. A client must distinguish retrying the same request from requesting a new user signature. Never trust participant IDs, role strings, account addresses or successful transaction hashes supplied by the client without verification.

When bootstrapping a new participant, designate its first verified personal account as management authority in the same transaction. Later changes to that designation require the existing designated authority and the proposed new authority; adding a login/data-access account alone cannot change it. This private-account policy is distinct from each wallet's onchain owner and recovery policy.

## 7. Garden admission and capability policy

Every request passes transport authentication, identity resolution, resource authorization and action-specific account/garden checks. A valid webhook proves its provider sent the event; it does not prove garden membership. A garden invitation, group membership, local steward flag or remembered currentGarden is also insufficient.

Use existing garden admission mechanics and signed join-request patterns. An approved membership must be effective for the exact account on the configured chain before onchain publication. Check roles again when authorizing and executing; the contract provides the final check if roles change in between. Failed or unavailable authority reads fail closed for mutations. Cache only presentation information.

| Authentication/authority | Allowed | Excluded |
| --- | --- | --- |
| Unknown visitor | Public information, consent and bounded intake entry | Private member lists, garden drafts, privileged API |
| Verified channel, provisional participant | Own provisional intake and support | Claiming existing history or member authority |
| Linked channel with active admission | Own permitted drafts, corrections before signing, own status, nonbinding commitment preparation | Other members' private work, final approvals, binding commitments, account management |
| Fresh account proof | Account-scoped reads and authorized draft handoff | Automatic access to every linked account's resources |
| Owner-signed action plus current role | Exact work publication, permitted approval or commitment action | Different revision, account, garden or implicit batch |
| Optional reporting grant plus current role | Only allowed work publication under installed policy | Approvals, commitment mutation, funds, Hats/roles, garden management, arbitrary EAS, owner/recovery changes |

Steward queue access requires a separate browser scope and current operator authority. Chat notifications should disclose minimal status and direct the steward to the protected PWA. Do not include another gardener's full report in an unauthenticated link preview. Garden-specific rate limits, attachment quotas and revocation prevent one community exhausting another's service budget.

## 8. Work, approvals and commitments

Work moves through private draft, ready for review, awaiting author signature, broadcasting, confirmed and awaiting approval. Use distinct user-facing labels for each. Photo plus description is a product evidence requirement; resolver acceptance alone does not establish that the evidence is useful. Validate garden, action, work period, domain, metadata and consent against the existing work rules.

Persist attachments as durable private objects before confirming the draft is saved. Keep immutable content hashes and scan/validation state. Accept only bounded MIME/content combinations, sizes and counts; reject executable content and archive tricks. Fetch provider media through supported authenticated endpoints with host/redirect restrictions, timeouts and size limits to prevent SSRF and token leakage. Remove unnecessary EXIF/location data, while preserving consented evidence needed by the garden. Retry failed media fetches visibly; never silently turn a photo report into text-only publication.

Raw chat media is processed by the transport provider and Green Goods; it is not “local only” or end-to-end hidden from the business processing it. Separate consent for private intake, garden sharing and public publication. Do not put personal identifiers or raw media on public IPFS by default. Before any public upload, show the content and explain that public/chain copies may not be retractable. Retention durations and processor arrangements must be approved under O5; proposed pilot starting point is 30 days for abandoned drafts, with explicit published-evidence retention.

Each edit creates a new revision with compare-and-swap semantics. A PWA and WhatsApp concurrent edit produces a conflict prompt or an explicitly rebased new revision; neither silently wins. Once signed, an intent is immutable. Later corrections become a new authorized action, following existing protocol support, rather than mutating a signed payload.

Steward approval references the confirmed work UID and exact garden/action. The PWA shows the author, evidence and effects; the operator signs the approval with a different authorized account. A rejection or request for changes is recorded with its real protocol/application semantics, not misrepresented as an onchain approval. Approval can affect commitment credit, so it is a consequential action even without a direct transfer.

Chat can help choose or draft a commitment, express interest and collect evidence. The PWA must display the complete binding payload: garden/pool/cycle, parties and their roles, work requirements, quantities, due and confirmation dates, consideration and any asset/amount effects. It authenticates the correct actor for create, claim, evidence/work linking, confirmation and any other supported lifecycle action. Validate each action against current protocol rules; do not expose methods just because a call builder can encode them.

A chat “yes” can confirm draft wording or interest, never an unspecified financial or binding commitment. Keep funding, deposits, withdrawals, transfers and role changes outside reporting delegation. Provider policy review must cover the actual commitment experience; linking to a PWA is not proof of exemption from messaging restrictions. [WhatsApp Business policy](https://www.whatsapp.com/legal/business-policy/)

## 9. Operations, retries and cross-channel continuity

Ingress deduplication uses (provider realm, external event ID), separately from business idempotency. Persist the authenticated event before acknowledgement; process it asynchronously with a bounded retry policy. Distinguish inbound messages from delivery/status callbacks. Store minimal normalized content and privacy-safe correlation, not unbounded raw webhook logs.

One logical ActionIntent survives repeated taps, network retries and channel changes. Reserve its operation atomically and bind account, chain, revision and payload hash. Freeze transaction nonce/UserOperation identity before dispatch where supported; retries rebroadcast/reconcile the same signed operation rather than create a new one. PWA direct signing and server dispatch must use the same reservation protocol.

~~~text
draft -> ready -> awaiting_signature -> authorized -> broadcasting
                                                    |-> submitted_unknown -> reconcile
                                                    |-> confirmed -> indexed
                                                    |-> failed_definite
~~~

Record work-publication and work-approval operations separately, linked by the resulting work UID. If work succeeded and approval failed, retry only approval. If broadcast response is lost, query transaction/UserOperation receipts before offering another signature. Track replacements and finality; a reorg can move confirmed work back to reconciliation. Indexer lag is not transaction failure.

Guarantee idempotent service handling and reconciliation under tested conditions, not universal “exactly once onchain.” A user independently sending another valid transaction outside the service may create duplicates unless contracts enforce a suitable business key. Any stronger uniqueness guarantee needs separate contract analysis.

Use a transactional outbox for response delivery. Publication success remains visible in the PWA even if WhatsApp delivery fails. Delivery retries respect opt-out and the current conversation window/template rules. Reconcile inbound, signing, chain and outbound failures independently; have a dead-letter queue and operator retry tools with narrow access and an audit trail.

Keep PWA jobs tied to the original account and immutable intent on logout, account switch or reconnect. Offer “Resume with this account”; never re-sign another account's queued job. Resume server drafts on another device only after authorization. Private local-only drafts and offline photos need an explicit upload/sync transition with visible pending state.

## 10. Optional reporting delegation

Defer this until first-release owner-signed reporting works and the permission boundary is proven for the actual deployed account modules. Current Kernel session documentation demonstrates a possible mechanism, not a deployment/audit attestation for this repository. [Kernel permissions documentation](https://docs.zerodev.app/sdk/v5_3_x/permissions/transaction-automation)

A gardener would explicitly authorize a dedicated reporting key for one account and garden. Candidate pilot policy: 24-hour expiry, explicit owner renewal, bounded calls and sponsored gas. Longer periods require evidence and selection. No automatic renewal by SMS/WhatsApp challenge. The service must hold no owner key; signer material lives behind a restricted signer interface with separate secrets and least-privilege access.

The enforceable policy must restrict chain, permitted contract, function, zero native value, EAS schema/resolver, encoded garden/action fields and allowed call/batch form. Selector-only access to generic EAS attestation is insufficient: a compromised key could choose a different schema or garden. Prove denial of arbitrary batch, delegatecall, multi-attest, owner/module installation and policy bypass. If deployed policies cannot constrain dynamic calldata sufficiently, do not enable delegation; remain with owner signatures or separately design and review a constrained protocol entry point.

Offchain rate limits are defense in depth. Any promised ceiling under backend compromise must be enforced independently by the account policy, paymaster or an appropriately isolated control. Paymaster sponsorship is a cost control, not ownership or authorization. A reporting key may still fabricate permitted evidence until revocation/expiry, and that evidence can have economic consequences after approval.

Revocation has two observable stages: service disabled immediately, onchain permission revoked after a confirmed owner transaction. Expiry supplies a final limit if onchain revocation cannot be submitted. The PWA must support an owner-controlled revocation route independent of the messaging runtime; document what happens if the frontend, RPC or provider is unavailable. Report “revocation pending” honestly.

## 11. Recovery, compromise and lifecycle

| Event | Required behavior | Limit to communicate |
| --- | --- | --- |
| Lost browser storage / logout | Rediscover credential, authenticate and check original account descriptor/address; restore authorized server data | Local-only drafts may be unavailable. Never auto-create a new account on lookup failure. |
| New device | Use existing credential/sync or supported cross-device authentication; reconnect permitted data | Sync and in-app browser behavior need real-device proof. |
| Hosted passkey service outage | Show retry/recovery guidance and preserve continuation/draft | An unavailable lookup is not evidence that no account exists. |
| Total passkey loss | Use a previously configured, tested recovery mechanism if one exists | RESR-21 remains open; no guaranteed same-address recovery is implemented by this plan. |
| Phone lost/recycled or SIM swap | Revoke channel binding from an authorized account; require fresh two-sided pairing for replacement | A new controller of the number cannot recover the wallet or inherit private history. |
| Channel compromised | Freeze channel writes and associated service grants, increment binding epoch, initiate applicable onchain revocation | Already valid onchain grants remain a risk until revoked/expired. |
| Owner EOA/passkey compromised | Revoke sessions/bindings and use the account's supported onchain recovery/rotation procedure | Offchain unlink cannot remove a stolen owner's onchain power. |
| Backend/database compromised | Disable ingress/signing/sponsorship, rotate credentials, revoke grants using independent owner access, reconcile affected operations and notify users through verified channels | Offchain identity/data can be exposed or corrupted. No owner keys reduces but does not eliminate damage. |
| Participant deletion/unlink | Revoke sessions/grants, remove access and purge eligible private data under retention rules | Public attestations and third-party copies cannot be promised erased. |

Account recovery, channel relinking and account merging are separate user actions with separate authorization. A support agent or garden steward may restore community access through an approved admission process; that does not prove ownership of a lost wallet or permit private-history disclosure.

An ordinary EOA has no same-address private-key rotation. After its key is compromised, supported recovery generally involves a new account and separate asset/role transitions; a service-side freeze cannot prevent the attacker transacting first. Smart-account recovery also depends on an installed, usable mechanism, not merely the presence of a passkey.

Changing a channel binding increments its epoch, invalidating old link attempts, continuation access and channel-scoped grants. A garden role removal blocks new actions even if a channel remains linked. Consent withdrawal stops future delivery/processing within its scope. “STOP messages” and “Revoke reporting access” must have distinguishable effects and clear confirmation; do not imply notification opt-out alone revokes an onchain key.

## 12. Threats and containment checks

| Abuse path | Design control | Residual risk / required proof |
| --- | --- | --- |
| Forged/replayed webhook | Provider-specific verification, durable event uniqueness, bounded parsing | Compromised provider credentials still impersonate channel events; they cannot supply owner signatures. |
| Leaked/forwarded pairing or action link | Two-sided proof, session binding, short expiry, atomic consumption, non-mutating GET | Social engineering remains possible; show account, masked channel and action clearly. |
| Stolen phone/session | Draft-only channel permissions, step-up, binding revoke | Attacker can read/change allowed chat content and submit false private intake. |
| Cross-garden object access | Server resource scoping plus current exact-account role checks | Test every read, attachment URL and mutation with foreign IDs. |
| Backend signer compromise | No owner keys for new architecture; disabled-by-default delegation; onchain limits and independent revoke | Scoped false reports and data exposure remain possible. Legacy custodial keys retain broader risk. |
| Wrong signer or stale ownership | Frozen account/chain, descriptor checks, fresh verification and contract enforcement | Rotation/race behavior must be tested against actual account configuration. |
| Duplicate publish / partial approval | Logical intent reservation, separate operations, reconciliation | External independently signed transactions may bypass service deduplication. |
| Malicious media or prompt text | Sandboxed/bounded media processing; untrusted content; schema validation | AI extraction, if added, may draft only; it never authorizes membership, identity or transactions. |
| Staff/provider account abuse | Least-privilege consoles, MFA, audit access, separate deployment and business ownership | Staff can access data their assigned role permits; retention and oversight still matter. |

For direct Meta, POST authentication uses app-secret signature verification, distinct from the GET subscription verify token; preserve raw bytes for HMAC verification. The official WhatsApp SDK documentation confirms the two mechanisms, but the SDK is historical reference, not a dependency recommendation. The current Meta Graph guide returned HTTP 429 during this pass; validate current production fixtures before rollout. Twilio uses its documented request-signature validator and externally correct URL/parameters; Telegram uses its webhook secret header. None authenticates garden membership. [WhatsApp webhook reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/), [Twilio webhook security](https://www.twilio.com/docs/usage/security), [Telegram setWebhook](https://core.telegram.org/bots/api#setwebhook)

Phone verification must not be the sole recovery or privilege-renewal factor. SIM changes and number reassignment are concrete reasons to separate channel access from account authority. [NIST authenticator guidance](https://pages.nist.gov/800-63-4/sp800-63b.html)

## 13. Provider choice and Nigeria rollout

WhatsApp is the channel and Meta operates its Business Platform. Twilio is one provider through which Green Goods can use that platform. All provider options retain WhatsApp's onboarding, template and policy constraints.

| Option | Advantages for this project | Costs and tradeoffs | Evidence still needed |
| --- | --- | --- | --- |
| Direct Meta Cloud API | Direct platform integration; fewer intermediaries; avoids an additional per-message BSP markup | Team owns webhook reliability, sender setup, templates, support and operational tooling; Meta charges still apply | Business/sender eligibility, actual Nigerian payloads, support workload and current country/category rates |
| Twilio WhatsApp | Documented APIs, request verification, delivery tooling and a familiar multi-channel platform | Published USD 0.005 per inbound/outbound WhatsApp message plus Meta fees; another processor/provider dependency | Real sender onboarding, full workflow invoice estimate, media and template proof |
| Africa's Talking | Published Nigeria coverage for WhatsApp and SMS products; relevant local provisioning discussion | Exact product access, support model, tariffs, sender/shortcode costs and inbound reach are quote/provisioning dependent | Written Nigeria WhatsApp and two-way SMS proposal plus live carrier tests |
| 360dialog | WhatsApp-focused alternative with a direct platform-oriented offering | Recurring plan cost plus Meta charges; does not resolve Nigeria SMS | Current regional quote, support/hosting tier and migration terms |

Sources: [Meta pricing](https://business.whatsapp.com/products/platform-pricing), [Twilio WhatsApp pricing](https://www.twilio.com/en-us/whatsapp/pricing), [Africa's Talking country coverage](https://help.africastalking.com/en/articles/2727792-which-countries-are-africa-s-talking-products-in), [360dialog pricing](https://360dialog.com/pricing). Prices and coverage were reviewed on the research date and must be rechecked before purchase. No provider account, sender or paid service was provisioned.

Twilio's Nigeria guidelines currently say two-way SMS is unsupported. Therefore the old “SMS fallback is ready if WhatsApp slips” assumption is contradicted for this proposed provider/country. A Nigeria SMS reporting pilot needs a separately proven inbound route, operator coverage, sender/shortcode provisioning and cost. SMS cannot carry report photos; collect text as draft and use an authenticated browser upload or explicitly attributed assisted intake. [Twilio Nigeria guidelines](https://www.twilio.com/en-us/guidelines/ng/sms)

A useful cost model is: provider inbound/outbound charges + Meta billable templates by category/country + numbers/shortcodes/subscriptions + media/storage/transcription + gas sponsorship + support labor, divided by accepted submissions. At Twilio's observed markup, 1,000 total WhatsApp messages add USD 5 before other costs; this is not the cost of 1,000 accepted reports.

WhatsApp free-form replies use the customer-service window opened by an inbound message; outside it, approved templates are required. Build status delivery around actual timestamps and consent, including utility notifications. Maintain template state/version and delivery outcomes; do not automatically switch to SMS without consent and proven reach. [Twilio messaging window documentation](https://www.twilio.com/docs/whatsapp/key-concepts)

Use private business conversations for the pilot. TAS's existing community group can distribute an approved invite to the official sender; do not assume access to group history, group membership or group messages. Group features or Business App coexistence require separate eligibility and behavior checks. Human support needs an assigned inbox/process with access limited to the relevant garden.

The existing Telegram adapter treats private work commands separately from group feedback capture. Preserve that separation: a group feedback record is not a consented personal work submission and cannot be attached to a participant or published through this workflow without the required authorization.

Provisioning sequence: choose business/sender ownership; confirm applicable Meta/provider eligibility and use-case policy; establish production credentials and webhook verification; obtain required message templates and consent copy; prove actual TAS-device inbound/media/outbound flows; validate billing and support; then recruit. There is no substantiated fixed onboarding lead time in this plan.

Provider migration must preserve Green Goods participant IDs while explicitly mapping provider identities only when authoritative continuity is available. Otherwise re-pair with owner proof. Drain old queues, reconcile outstanding operations, designate one outbound sender per transition and deduplicate overlap. Losing provider delivery context must not lose work state or create duplicate publication.

## 14. Rollout, observability and rollback

Use explicit per-garden rollout flags and independent switches for intake, publication, approvals, commitments and any later delegation. Start with owner-signed work; add commitment actions only after their own acceptance proof. Telegram adapter reuse follows identity and media recovery work; Nigeria SMS follows real provisioning evidence.

Proposed research cohort is 10–20 gardeners, at least two stewards and two complete reporting/review cycles; TAS/research must approve numbers and success thresholds. Measure gardener time, steward/support time, abandoned onboarding, link failures, duplicate-account creation, accepted evidence rate, correction rate, cost per accepted submission and unsafe-action attempts. A reduction in gardener taps is insufficient if support labor increases.

Emit privacy-safe events into the correct existing telemetry surface: Agent for messaging, App for PWA, Admin for steward cockpit where used. Use opaque correlation IDs; exclude phone numbers, wallet addresses, signatures, pairing tokens, raw messages and media URLs from routine analytics. Restricted incident evidence has separate access and retention.

Rollback disables new actions while preserving drafts, operation records and receipt reconciliation. Keep PWA owner access and independent revoke available. Do not revert to custodial account creation or raw bot approval as an outage fallback. Drain/deduplicate outbound queues before switching provider or re-enabling a garden.

"Release" here means the **TAS pilot**, not the Buildathon prototype. Pilot release requires all applicable tests in [eval.md](eval.md), approved O1/O2/O5 decisions, actual auth compatibility proof and operator incident rehearsal. The prototype in section 15.1 is gated only on its own subset in [eval.md](eval.md), and it is not a release. O5 is **not** waived for it, however: a test garden is not the same as no personal data, and invited testers use real WhatsApp accounts, so a real provider identifier is persisted and real photos are published irreversibly. A minimum subset — consent at first contact, abandonment deletion, a named support owner — is inside the prototype; thresholds, the full retention schedule and support tooling wait for the pilot. Optional delegation and total-loss recovery cannot be described as shipped merely because baseline messaging launches.

## 15. Prior research and evidence limits

The [messaging project](https://linear.app/greenpill-dev-guild/project/agent-messaging-channels-whatsapp-sms-71cda634fcf7) is research-gated. [RESR-75](https://linear.app/greenpill-dev-guild/issue/RESR-75) required no-sign-up identity/verification, country-specific cost, comprehensible consent, fallback and total labor evidence. As of this 2026-09-11 research pass it was Todo and no acceptance was found; **it was accepted on 2026-09-21**, which is what section 15.1 records. Read this paragraph as a dated observation, not as the current gate state. [RESR-21](https://linear.app/greenpill-dev-guild/issue/RESR-21) leaves same-address total-passkey-loss recovery open.

[PRD-290](https://linear.app/greenpill-dev-guild/issue/PRD-290/epic-agent-on-whatsapp-and-sms) is a historical Done epic; that status is not implementation evidence. [Community Evidence Mesh](https://linear.app/greenpill-dev-guild/document/community-evidence-mesh-12-month-roadmap-dependencies-and-measures-a51e5ecc2c1a) supports private intake, correction, consent and total community labor measurement. Its “local” media direction must not be confused with WhatsApp provider processing.

The stored Plan Hub mirror is PRD-339. Fetching it did not resolve during this pass; preserve the existing ID and sync timestamp until it can be verified. No Linear descriptions, comments or statuses were written.

This pass establishes a source-grounded architecture proposal and explicit verification plan. It does not establish production provider eligibility, actual Nigerian delivery/cost, current deployed account-module compatibility, restored-wallet behavior, browser handoff reliability, cryptographic implementation correctness, or pilot success. Those require the named decision and acceptance gates rather than more general documentation.

## 15.1 Buildathon prototype slice (scope-locked 2026-09-21)

[RESR-75](https://linear.app/greenpill-dev-guild/document/resr-75-entry-criteria-for-reporting-impact-over-whatsapp-3bddbab8b48b)
was accepted on 2026-09-21, clearing the research gate. This section records the one slice of the
architecture above that is authorized to build, for the Arbitrum buildathon milestone "Buildathon
prototype" (target 2026-10-02, submission 2026-10-04). The delivery steps are in
[plan.todo.md](plan.todo.md); the acceptance cases are the existing IDs in [eval.md](eval.md).

**The journey.** A gardener sends a photo and a description to the official WhatsApp sender. The
agent saves a private draft with no account step and replies with a single-use link. The link opens
the gardener's exact draft in Chrome or Safari, where they use an existing account or create one
passkey, review the public content, and sign the work attestation on Arbitrum One. After the chain
receipt — not the submit — the agent confirms in the chat.

**What the slice adopts from the proposals above.** P2 (private drafts first, existing accounts
reused) and P3 (the owner signs each publication). Nothing else. P1's participant record, P4's
reporting delegation and P5's per-garden senders stay unselected.

**Four deliberate narrowings of this document, for the prototype only.**

1. **No participant record.** Section 4 models Participant, AccountBinding, ChannelBinding,
   AccountDescriptor, AuthenticatorReference, GardenContext, DelegationGrant and Consent/Audit. The
   slice adds four tables instead — a webhook event claim, a draft, its attachments, and a link
   attempt — and binds a draft directly to the account that proves ownership of it. The invariants in section 4 still
   hold: linking unions no garden roles, every mutation freezes one account, chain, garden, action
   and revision, and a channel proof never broadens permissions.
2. **No browser session.** Section 6 proposes a same-origin backend facade with host-only cookies
   and CSRF checks. The prototype uses a **signed proof on each request** instead, reusing the
   envelope already in production at
   `packages/agent/src/api/routes/garden-join-request-auth.ts:40-104` — nonce, expiry, chain
   allowlist, action binding, resource binding and one-time claim — with the EOA, ERC-1271 and
   ERC-6492 verification already in production at
   `packages/agent/src/services/profile-avatars.ts:90-127`. This is smaller than the facade, has no
   CSRF surface, and needs no deployment wiring.
   To correct an earlier version of this section: `www.greengoods.app` and `agent.greengoods.app`
   are **different HTTP origins**. A host-only cookie set by one is not shared with the other, and
   the WebAuthn RP ID changes none of the origin, CORS, cookie or CSRF rules — it governs credential
   scope only. The two hosts are same-*site* under the same registrable domain, which is what
   `SameSite` keys on, but that is a narrow point and does not remove the facade's need for explicit
   cross-origin controls. The facade remains the right answer for the pilot, when sessions outlive
   one action, and it is a deployment choice that must carry those controls rather than inherit
   them.
3. **Membership is pre-arranged, not solved.** Section 7 requires an approved membership effective
   for the exact account before publication, and `WorkResolver.onAttest` enforces it, reverting
   `NotGardenMember` for a non-member attester
   (`packages/contracts/src/resolvers/Work.sol:19-20,106-110`). A freshly created passkey account is
   not a gardener, and no one can pre-admit an address that does not exist yet — so pre-admission
   alone would leave the first-run journey reverting at publication. The prototype therefore runs
   its test garden with `openJoining` enabled, and the new account calls the existing
   `GardenAccount.joinGarden()` itself before attesting
   (`packages/contracts/src/accounts/Garden.sol:224-243`), sponsored for passkey users. That is one
   extra on-chain transaction, not one extra account step, which is what the no-sign-up criterion
   constrains; say so in the demo rather than implying a single transaction. Testers with existing
   accounts are still admitted ahead of time. Live steward approval for an invite-only garden stays
   stretch.
4. **Media is held privately, then published once.** Section 8 forbids raw media reaching public
   IPFS before the gardener publishes. The agent stores bytes on its own volume and they move to
   Pinata only at publication. Section 8's EXIF requirement is **not currently met by the codebase**:
   there is no dedicated strip step, and compression re-encodes only files over roughly 1 MB, so
   smaller images and all videos publish with location intact
   (`packages/shared/src/modules/work/media-processing.ts:239,244,253`). Closing that gap is inside
   the slice **for images only**: videos are passed through unchanged by that same path, and
   stripping a video container needs a parser or transcoder well outside a prototype step, so the
   prototype refuses video rather than claiming to sanitize it.

**What the prototype does not establish.** Production provider eligibility, actual Nigerian delivery
or cost, pilot success, recovery after total signer loss, delegation safety, or Telegram migration.
A working demo is not evidence for `ID-05`, `ID-07`, `REC-03` or `MIG-01`, and none of those may be
claimed from it. The prototype also does not authorize production data collection or a pilot
provider decision: RESR-75 acceptance explicitly withholds both.

**Boundary correction worth recording.** The architecture above says the April spec's Twilio
selection is superseded. The prototype makes that concrete in one place that matters for testing:
eval `SEC-01` was written against Twilio request-signature validation and, under the Meta Cloud API,
becomes `X-Hub-Signature-256` verified with the app secret over the preserved raw body. Section 12
already anticipated this. The existing HMAC webhook verifier at
`packages/agent/src/api/funding/thirdweb.ts:158-186` is the closest working model in the repository.
