# Community Needs Interface: Implementation Spec

**Feature Slug**: `community-interface`
**Stage**: `active`
**Created**: 2026-07-04
**Sources**: research pass (compass artifact, 2026-07-04) corrected by `corrections-log.md`; alignment session with Afo 2026-07-04 (8 locked decisions, §1). Companion specs: `.plans/active/commitment-pooling/{contract-spec.md,uiux-spec.md}` (August substrate this layer rides).

Community members name what better looks like before any commitment exists. A **Need** (statement + mandatory desired outcome) is the object at the start of the flywheel: community names the need, the garden assesses the baseline, a commitment carrying `needUID` promises improvement, work proves it, delta + testimony close it, the cycle Hypercert lists the needs its fulfilled commitments addressed. One sponsored human write; everything downstream is derived or already exists.

---

## 1. Canonical decisions (locked 2026-07-04)

| # | Decision | Rationale |
|---|---|---|
| 1 | Vocabulary is **Need**, never "problem": tab Needs, schemas `Need`/`NeedSignal`/`NeedStatus`, field `needUID`, es *Necesidades*, pt *Necessidades*. Code and copy use the same word. | Positive-agency framing; pairs with the mandatory desired outcome; Afo call on connotation. |
| 2 | Linear home: **Community Signals & Engagement** project builds the needs layer (own milestones); PRD-682/683 remain the September delivery records in Green Goods Commitment Pooling, amended in place. | Keeps the August MVP project undisturbed; the needs vision has a runway past September. |
| 3 | Spec home: this hub. The commitment-pooling hub gains only the additive `needUID` amendment + a §8 pointer. | One hub per Linear project, mirroring house convention. |
| 4 | App IA: **Needs / Create (center, voice-first) / Profile**. Pool story folds into the Needs board header + per-need promise-work-proof threads. Solution-proposal objects dropped: solutions arrive as commitments. | Creation must feel like taking action; the detail thread is the retention mechanic. |
| 5 | Fund action: embedded **direct donation + endowment** (same paths as `/fund`) in need context; **`FundingAttribution` attestation ships in v1** so funding-per-need is durable. Totals display on the need detail only — never board sort/rank. No per-need escrow; funding goes to the garden. | Funders never direct yield; ranked-by-funding is banned; Afo wants funding-per-need trackable. |
| 6 | Voice: audio is always stored as evidence. Dictation with transcription on **both** the statement and desired-outcome steps; local/on-device first, server transcribe at flush as fallback (reuse agent transcription), never blocking submission. | Authorship barrier is the point; audio is the durable artifact, transcript the convenience. |
| 7 | Discovery: **global read-only browse** of other gardens' needs for members and funders; my garden is the scoped default experience. Signal rights always same-garden (Community Hat). | Inspiration across gardens is powerful; the same-garden signal gate is the brigading guard. |
| 8 | No claim flow in v1 (view / signal / confirm / testify). The need→operator binding is first-class instead: urgent alerts + triage queue + seed-from-signal. Raise-hand ping parked (§16). | Matches PRD-682's locked cut; operators capture offers via analog capture. |

Sub-decisions: (a) `Need` + `NeedSignal` are **revocable** — EAS revocation is attester-only, so this grants self-retraction and un-signal, nothing more; operator moderation is never revocation (§4). `NeedStatus` + `FundingAttribution` non-revocable. (b) `NeedStatus` uses clean enum numbering (§3.1), not the research doc's sparse 1/5. (c) FundingAttribution has no hat gate (public funders) and is spam-guarded at read time (§10). (d) Status derivation is an app-side join, never Envio EAS indexing (§4).

## 2. Scope

**In**: four EAS schemas + resolvers + standalone registration; shared substrate (job kinds, hooks, derivation join, voice); `packages/community` PWA per amended PRD-682; admin triage + batch-mint console + gathering view; funder lens in client public views; paymaster policy extension; docs; TAS dogfood instrumentation.

**Out (deferred, §16)**: eligibility module, raise-hand ping, on-chain seeding gate, push notifications, deeper on-chain funding, ActionSignalPool wiring, solution objects, claim flow, settlement anything.

## 3. Need object model

### 3.1 EAS schemas (thin, CID-heavy, recipient = garden account, following house convention)

**`Need`** — attester: member smart account (the author); revocable **true** (self-retraction only).

| Field | Type | Purpose |
|---|---|---|
| `garden` | `address` | Garden TBA; scopes the Community Hat check and the board. |
| `statementCID` | `string` | IPFS: statement text + optional audio CID + transcript + `transcriptionSource` (`none\|dictation\|server`). |
| `desiredOutcomeCID` | `string` | IPFS: mandatory desired outcome (text + optional audio + transcript). Locked framing: a need always arrives paired with what better looks like. |
| `horizon` | `uint8` | 0 week, 1 month, 2 season, 3 years. Routes (§6), does not just describe. |
| `mediaCID` | `string` | Optional photos manifest; `""` = none. In-step attachment, never a separate step. |

No `domain` field — domain is protocol vocabulary the operator tags at triage (`NeedStatus`). No `author` field — the attester is the author.

**`NeedSignal`** — attester: member smart account; revocable **true** (un-signal). EAS `refUID` also set to `needUID`.

| Field | Type | Purpose |
|---|---|---|
| `needUID` | `bytes32` | The Need being supported. |
| `garden` | `address` | Same-garden enforcement (resolver checks signer wears THIS garden's Community Hat). |

**`NeedStatus`** — attester: operator; revocable **false**. Latest-by-time wins reader-side; multiple over a need's life are expected.

| Field | Type | Purpose |
|---|---|---|
| `needUID` | `bytes32` | The Need. |
| `status` | `uint8` | 1 acknowledged · 2 merged · 3 hidden · 4 declined. (Research doc's 1/5 numbering superseded.) |
| `domain` | `uint8` | 0–3 (Schemas.sol enum: SOLAR/AGRO/EDU/WASTE); meaningful on acknowledged, resolver bounds it always. |
| `noteCID` | `string` | Merge target needUID, dignified-decline reason, or hide rationale. `""` allowed on acknowledge. |

**`FundingAttribution`** — attester: funder wallet (app-composed, post-tx); revocable **false**; no hat gate.

| Field | Type | Purpose |
|---|---|---|
| `needUID` | `bytes32` | The Need this funding was given toward. |
| `txHash` | `bytes32` | The donation/deposit transaction being attributed. |
| `token` | `address` | Asset funded. |
| `amount` | `uint256` | Raw amount (display verifies against the tx, §10). |
| `rail` | `uint8` | 0 direct donation · 1 endowment (vault deposit). |

### 3.2 Resolvers (house conventions from `packages/contracts/src/resolvers/{Work,WorkApproval,Assessment}.sol`)

All four follow: security-critical validation-order comment, flat-tuple `abi.decode`, `setSchemaUID` zero-bypass deployment window, UUPS + storage gap sized to 50 slots. Hat checks go through **`IGardenAccessControl` on the garden TBA** (`isCommunity`, `isOperator` — `packages/contracts/src/interfaces/IGardenAccessControl.sol:30,45`), never raw Hats helpers.

- **NeedResolver**: (1) garden is a valid garden account; (2) attester `isCommunity(garden)`; (3) `statementCID` and `desiredOutcomeCID` non-empty; (4) `horizon <= 3`. `onRevoke` → **true** (attester self-retraction; readers already filter `revoked`).
- **NeedSignalResolver**: (1) garden valid; (2) attester `isCommunity(garden)`; (3) `needUID != 0` and `_eas.getAttestation(needUID)` returns an attestation whose schema is the Need UID and whose recipient equals `garden` (baselineUID-validation precedent, commitment-pooling contract-spec §6.4). No open-status check on-chain (status is derived off-chain); no per-member dedup in resolver storage — the write stays dumb and cheap because it is sponsored. `onRevoke` → **true**.
- **NeedStatusResolver**: (1) attester `isOperator(garden of the referenced need)`; (2) need exists (same getAttestation check); (3) `status` in 1–4; (4) `domain <= 3`. `onRevoke` → **false**.
- **FundingAttributionResolver**: (1) need exists; (2) `txHash != 0`. No hat gate. `onRevoke` → **false**. Trust model: attribution is a claim; the read path verifies it against the referenced tx before displaying (§10).

### 3.3 Registration

Standalone script `packages/contracts/script/deploy/need-schemas.ts` cloned from the `badge-schemas.ts` template — **never `--update-schemas`** (it re-registers everything and clobbers artifact keys). Entries added to `packages/contracts/config/schemas.json`; UIDs land in `deployments/{chainId}-latest.json` as `needSchemaUID`, `needSignalSchemaUID`, `needStatusSchemaUID`, `fundingAttributionSchemaUID`. Registration sequenced after the August commitment-schemas chain (PRD-671) so conventions and helpers are settled.

## 4. Status lifecycle and the two-source read path

Six member-facing statuses + two moderation states. **Only acknowledge/merge/hide/decline are human-written** (operator, `NeedStatus`). Everything else derives.

| Status | Source | Derived from |
|---|---|---|
| open | implicit | Need exists; no NeedStatus; no commitment carries its `needUID` |
| acknowledged | attested | latest NeedStatus.status = 1 |
| committed | derived | ≥1 commitment record carries this `needUID` (`CommitmentCreated`) |
| in progress | derived | that commitment reached `CommitmentAccepted` or counted approved work (`ApprovedWorkCounted`) |
| addressed | derived | ≥1 such commitment reached `CommitmentFulfilled` |
| declined | attested | latest NeedStatus.status = 4 |
| merged (moderation) | attested | latest NeedStatus.status = 2; board hides it, detail links the canonical need from `noteCID` |
| hidden (moderation) | attested | latest NeedStatus.status = 3; hidden from all public reads |

Precedence when signals conflict: hidden > merged > addressed > in progress > committed > declined > acknowledged > open.

**Read path (hard boundary: Envio never indexes EAS).** A shared hook family joins two sources:
1. **easscan GraphQL** (`packages/shared/src/modules/data/eas.ts` conventions, `arbitrum.easscan.org/graphql`): Need/NeedSignal/NeedStatus/FundingAttribution content, filtered `revoked: false`. Signal counts = **distinct attesters per needUID, app-side** (one member re-signaling never double-counts).
2. **Envio commitment entities** (August, PRD-673): carry `needUID` from `CommitmentCreated`; the hook maps needUID → commitment states for committed/in progress/addressed.

The board and detail views consume only the joined result, so moderation, dedup, and derivation live in exactly one place (`useNeeds` / `useNeed` / `useNeedSignals`, shared).

## 5. Creation flow (voice-first, Create tab)

Three steps, mirroring the MDR draft grammar (`DraftStep` precedent `intro|media|details|review`); the interface never says attestation, wallet, or transaction.

1. **State the need** — big record button primary; live dictation where available; typing always offered; photos as in-step attachment. States: `idle`, `recording` (waveform, elapsed, stop), `transcribing` ("we're writing down what you said"), `editing` (transcript editable, audio retained), `offline-queued` ("saved, will send when you're back online").
2. **Desired outcome + horizon** — the outcome field is voice-capable too (same dictation/transcription treatment); horizon chips in plain language (this week / this month / this season / years). The horizon routes silently (§6).
3. **Review** — your words, your desired outcome, horizon, photos; **similar-need nudge** ("is this the same as…?" — soft, never blocking; client-side match against the garden's open needs, FixMyStreet lesson).

**Transcription strategy (decision 6).** Local first: Web Speech dictation during capture (on-device recognition where the language pack exists — availability is user-agent/device dependent, es/pt offline not guaranteed; a feasibility spike on TAS-class Android devices is part of the shared workstream, including whether a WASM route is viable). Fallback: at queue flush, if the payload has audio but no text and the device is online, one **pre-attest server transcription call** (reusing the agent package's existing transcription capability behind a small authenticated endpoint); on any failure or timeout the attestation proceeds audio-only — transcription never blocks. Because `statementCID` is immutable once attested, the reviewed-transcript rule is: text captured live (typed or dictated, member-editable in `editing`) rides the CID; a flush-time server transcript rides the CID marked `transcriptionSource: "server"`; anything transcribed after attestation is display-layer only and labeled auto-generated. Subtitle-first: every audio clip renders with its transcript or an explicit "audio only" chip.

**Queue behavior**: submission enqueues a `need` job (IndexedDB, existing retry semantics: 1s base ×2, cap 60s, 5 retries, flush mutex); optimistic "shared with your garden" card; if the member's Community Hat hasn't landed yet from the batch mint, the normal backoff holds the write — no new machinery.

## 6. Signal mechanics and horizon routing

A signal is a `NeedSignal` attestation — lightweight, sponsored, offline-queueable (`needSignal` job kind), revocable to un-signal. Counted as distinct attesters (§4). Signal button active only for the need's own garden's Community Hat wearers; global browse is read-only (§8).

Horizon routes:
- **Week (urgent)** → straight to the operator triage queue as an alert; no signal accumulation gate.
- **Month+** → signals accumulate toward the cycle-2 seeding gate: the seeding console's signals panel (amended PRD-683) orders by support count + recency, alphabetical tiebreak, no contributor rankings; **seed-from-signal** prefills the commitment form and sets `needUID`; the need's author is default-included in the confirmer group (operator-adjustable at seeding). The gate is a workflow, not a contract rule — signals inform, nothing on-chain blocks seeding. Traceability recorded ("seeded from need" chip; share-of-commitments-carrying-needUID per cycle).

Distinct from yield conviction (HypercertSignalPool) — the two never mix. ActionSignalPool stays dormant (§16).

## 7. Onboarding (QR, lazy join, batch mint)

Browse is free: the QR from a gardener opens the garden's needs board read-only, in-browser, no install. Join happens lazily on first action (signal or need): passkey prompt → one biometric → counterfactual ERC-4337 smart account (Pimlico, sponsored) → join request lands in the operator's queue → first write queues locally. Operator batch-mints Community Hats from the admin console (`Hats.batchMintHats` on the singleton — the module mints individually today, the console calls the protocol directly); the held job flushes on normal retry once the hat lands. PWA install is an optional prompt after the first successful action, never a precondition. Per-inviter caps and revocation are **operator policy off-chain in v1**; the on-chain eligibility module is a hardening milestone (§16).

## 8. App IA — `packages/community` (amends uiux-spec §8)

Three tabs (client AppBar convention): **Needs · Create · Profile**.

| View | Purpose | Content | Primary actions |
|---|---|---|---|
| Needs (landing) | My garden's needs board + pool story header | Garden header strip (pool state banner + cycle progress + aggregate stats, thresholded per uiux-spec §7.2); need cards (author's words, desired outcome, horizon chip, status pill from §4, distinct-signal count, signal button); filters: status, horizon. Never ranked by funding. | Signal; open detail; switch to Explore |
| Explore (within Needs) | Global read-only discovery | Other gardens' needs (domain/horizon/garden filters); no signal buttons ever | Browse; open read-only detail |
| Need detail | The retention mechanic | Promise-work-proof thread: your words → the promise (commitment via `needUID`) → the work (MDR submissions) → the proof (assessment delta) → testimony; author's confirm CTA appears at `ReadyForConfirmation` (shared confirmation grammar); funded-toward line when attributions exist | Signal; confirm (author, when named); add testimony (any Community Hat wearer of this garden) |
| Create (center) | §5 flow | Voice-first three steps | Record / dictate / type; submit |
| Profile | Account + history | Passkey block; my needs; my signals; my confirmations; my testimonies; language | Sign out; manage passkey |

Confirmations inbox and testimony history live in Profile (uiux-spec §8 grammar preserved). No work submission, no claiming, no wallet drawer, no settlement surface.

## 9. Admin additions (`packages/admin`)

- **Need triage queue** (Community workspace): incoming needs; urgent (week-horizon) items alert-styled at top; one-tap **acknowledge** (writes NeedStatus 1 + domain tag AGRO/WASTE/SOLAR/EDU); **dignified decline** (status 4 + reason noteCID); **merge** (status 2 + canonical needUID in noteCID); **hide** (status 3, moderation). Status writes are online admin actions (wallet), not offline-queued.
- **Private-lane intake**: grievances naming individuals never touch the chain — an off-chain note channel to the operator, attested later only if generalized into a need. v1 = documented operator practice + a "capture privately" affordance that stores nothing on-chain.
- **Need-to-commitment linking at seeding**: the PRD-683 signals panel + seed-from-signal prefill (sets `needUID`, prefills domain from the NeedStatus tag, adds author to confirmers).
- **Batch-mint console**: join-request queue view → select → `batchMintHats`; per-inviter caps + revocation as operator policy. Sub-decision owned by this workstream: where the join-request queue persists (it is off-chain state; nothing exists today).
- **"For the gathering" view**: pending confirmations + recent status changes + fresh needs, print-legible — the operator is the human notification layer; the physical gathering is the loop, not push.

## 10. Funder lens (client public views, editorial system)

One responsive surface, two lenses (per PRD-678 grammar): mobile community lens = the community app; desktop funder lens = editorial needs gallery inside `packages/client` public views.

- **Gallery**: needs across all gardens with domain/horizon/garden filters and garden context. **Never ranked by funding** (unglamorous needs must not starve); default order recency + status.
- **Need detail (funder)**: promise-work-proof thread + garden context + cycle + **funded-toward line** (sum of verified FundingAttributions; detail view only, never a board sort key).
- **Fund actions**: embedded **direct donation** and **endowment** — the same components/paths as `/fund`, opened with need context. After a confirmed tx the app composes the `FundingAttribution` attestation for the funder to sign (wallet write, their gas). Skipping the attribution never blocks the funding itself.
- **Attribution trust**: display sums only attributions whose `txHash` resolves to a real matching transfer/deposit (indexer `GardenVault` entities or receipt lookup); unverified ones are ignored, not shown as errors.
- **Route decision** (owned by the funder-lens workstream): prefer a needs section within existing public surfaces to respect commitment-pooling decision #21 ("no new public routes"); if a dedicated route proves necessary, record a register amendment there.
- Editorial guardrails inherited: aggregates only, small-community thresholds (uiux-spec §7.2), no participant-level data, nothing implying funders direct yield.

## 11. Commitment + Hypercert linkage

- `bytes32 needUID` on the commitment record (0 = none), `CreateCommitmentParams`, and `CommitmentCreated` event — **amended into the August contract-spec 2026-07-04** (additive reference field beside `assessmentUID`; no state-machine change). A commitment can carry both: anchored to an assessment (baseline), motivated by a need.
- Cycle Hypercerts (PRD-679) list the needUIDs their fulfilled commitments addressed; community testimony (PRD-671 schema) attaches as witness evidence and never gates payout.

## 12. Metrics and instrumentation (no leaderboards)

PostHog routing: community app + funder lens → App (163591); admin triage → Admin (262122). Properties are enums/counts/booleans only — never statement text, addresses, or reporter identity.

Events: `need_created {horizon, has_audio, has_photos, transcription_source}` · `need_signal_created` / `need_signal_revoked` · `need_status_set {status, domain}` (admin) · `need_detail_viewed {is_author}` · `need_confirmed_by_author` · `testimony_attested` · `fund_from_need {rail}` · `funding_attribution_recorded {rail, verified}` · `seeded_from_need` (admin) · `need_merged` (admin). Offline queue health rides existing job analytics automatically.

Derived measures (TAS dogfood): needs raised/addressed per garden per cycle; time-to-acknowledge (Need → first NeedStatus); signal participation (distinct signalers ÷ Community Hat wearers); share of commitments carrying `needUID`; author return visits; author confirmation participation; funding attributed per need. Benchmark: if under a threshold share of cycle-2 commitments carry a needUID, tighten the signals panel or the gathering ritual before adding machinery.

## 13. i18n and accessibility

Every string ships en+es+pt through the shared 4-part coverage gate; family `community.*` (reserved in uiux-spec §10) plus `cockpit.community.*` for admin triage and `public.needs.*` for the funder lens. All copy passes `bun run lint:vocab`. Create prompt: "What does your community need?" (es/pt equivalents natural: *¿Qué necesita tu comunidad?* / *O que a sua comunidade precisa?*). Accessibility: subtitle-first for all audio; stepper states announced via `aria-live`; no time-outs in the creation flow (patience modes); status never by color alone (StatusBadge); 44px touch targets; reduced-motion respected.

## 14. Package wiring (`packages/community`)

Port **3010**. Touch list: `turbo.json` tasks, `ecosystem.config.cjs` app entry, `scripts/dev/stack.js` (`portByApp` + `groups.web`/`groups.full`), `biome.json` includes, `.github/workflows/community.yml` (client.yml template) + `ci-gate.yml` REQUIRED array, package skeleton from the client template (Vite, vite-plugin-pwa, shared theme tokens, Passkey login flow reuse). All hooks from `@green-goods/shared`; the package has no hooks of its own. Root workspaces wildcard already covers it.

## 15. Risks and mitigations

- **Noise/duplicates** → similar-need nudge, operator merge, mandatory desired outcome raising the floor.
- **Grievances naming individuals** → private lane; never on-chain unless generalized.
- **Brigading** → same-garden signal gate; global browse is read-only.
- **Literacy/language** → voice-first, subtitle-first, es/pt day one, no time-outs.
- **Triage/batch-mint burnout** → one-tap actions, urgent alerts, gathering view, batch operations.
- **Notification gap** → design for the gathering; operator is the notification layer.
- **Paymaster drain** → policy caps per account/window; gathering-burst test before first sponsored community write.
- **Attribution spam** → read-time tx verification; detail-only display; non-revocable schema keeps the record auditable.
- **Transcript immutability** → CID rule in §5; post-attest transcripts are display-layer and labeled.

## 16. Deferred (parked, not September)

On-chain eligibility module (gardener-signed EIP-712 invites, per-inviter caps/revocation via HatsModuleFactory) — promoted only when off-chain caps become operational pain. Raise-hand ping ("I want to help"). On-chain seeding-gate rule. Push notifications. Deeper on-chain funding attribution / fund actions (build on v1 attestation data). ActionSignalPool app wiring. Solution-proposal objects. Claim flow (revisit after one full cycle of signal data).

---

## Appendix: verified anchors

| Anchor | Path |
|---|---|
| Access control checks | `packages/contracts/src/interfaces/IGardenAccessControl.sol:20,25,30,45` |
| Resolver conventions | `packages/contracts/src/resolvers/{Work,WorkApproval,Assessment}.sol` |
| Schema registry + registration template | `packages/contracts/config/schemas.json`; `packages/contracts/script/deploy/badge-schemas.ts` |
| Commitment struct + events (amended) | `.plans/active/commitment-pooling/contract-spec.md` §6 (Commitment, CreateCommitmentParams, CommitmentCreated) |
| Job queue kinds + retries | `packages/shared/src/types/job-queue.ts:89-95`; `packages/shared/src/modules/job-queue/index.ts` |
| EAS read path | `packages/shared/src/modules/data/eas.ts`; `arbitrum.easscan.org/graphql` |
| Paymaster policy | `packages/shared/src/workflows/authServices.ts` (`VITE_PIMLICO_SPONSORSHIP_POLICY_ID`) |
| Audio primitives | `packages/shared/src/components/Audio/{AudioRecorder,AudioPlayer}.tsx`; `packages/shared/src/hooks/utils/useAudioRecording.ts` |
| Client tabs + login reuse | `packages/client/src/components/Layout/AppBar.tsx:35-59`; `packages/client/src/views/Login/` |
| Indexer boundary | `packages/indexer/config.yaml`; corrections-log (Envio never indexes EAS) |
