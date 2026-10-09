# Product requirements: Green Goods community workspace

**Stage 2 · proposed, 8 October 2026.** Follows the [Stage 1 evidence review](eval.md). No software, dependency, deployment, transaction or license change is authorized by this document. Every requirement describes future behavior unless explicitly labeled existing. Sources use the IDs in the [evidence register](evidence-register.md).

**Later exploration, 9 October:** [architecture](architecture.md) records the user's node-free starting requirement and an extension-first vision. [Sensor research](sensor-kit-research.md) identifies possible real equipment. The synthetic recording, deferred mesh/hardware and separately gated pilot below remain the bounded prototype scope until a specific revision is accepted.

## Strategic alignment

The user has accepted Accessibility, Sovereignty, Trust and Reciprocity as Green Goods' four pillars. Privacy, Interoperability and Verifiability remain essential across them. The [current narrative](pitch-revision.md) sets a global vision for communities caring for land and each other, regardless of economic circumstances. These principles govern the proposal; current compliance is not established by accepting them.

## Product decision and first customer

Use **Green Goods OS: a community workspace for land, learning and collective action** as the proposed product description. “OS” describes coordinated knowledge, permissions and integrations; this is not a device operating system and will not manage arbitrary devices or replace farm-management software. The [pitch revision](pitch-revision.md) broadens the framing beyond the first test fixture without expanding the prototype's technical scope.

**Candidate first user:** a land steward working with a trusted coordinator; a mid-sized farmer transitioning practices with an adviser is one concrete candidate. **Buyer hypothesis:** the program or operations lead of the delivery organization purchasing onboarding, support and continuity. A sponsor may fund participation but gains no automatic data rights. Geography, cohort, budget and purchasing authority require discovery. The earlier U.S. conservation-district route is an unaccepted option, not the selected market. **Beneficiary/data authority:** participating people and communities under agreed roles, including the ability to refuse public sharing without losing access. No site or paying partner is secured.

**Candidate question for the bounded prototype:** “Which field plot needs an in-person moisture check today, and why?” The system identifies missing, stale or unusual readings and connects them to notes. A trained human decides what to inspect and any eventual intervention. It does not recommend irrigation quantities, claim soil recovery or certify outcomes. Confirm this question with the first cohort before implementation; another question requires a bounded PRD update. Retain one recording, one question and the original safety/quality scope.

Jobs: preserve what was observed; find its source; correct a draft without rewriting everything; hand over the next check to another steward; choose what another community or supporter can see; recover and leave without losing records. Funder reports are a possible reuse of these records, not a required task for participation.

## Scope and reality labels

| Surface | Two-week prototype | Eight-week pilot | Production readiness |
|---|---|---|---|
| Input | One synthetic CSV recording, manual notes; optional user-selected text capture in one desktop Chromium extension | One named, approved sensor or authorized recording plus manual observations | Supported device/firmware matrix, maintenance and calibration process |
| Data | Fictional people/places, no live gardener evidence | Community-approved minimum data under a written policy | Privacy/legal assessment, retention/service commitments, incident response |
| AI | One pinned small local model comparison with complete template/manual fallback | Enable only on language/device tiers passing quality/review-effort gates | Regression evaluations, update governance, monitoring without private payload collection |
| Green Goods | Real schema-validation/export behavior; **no transaction** | Optional separately authorized test-chain interaction after deployment/role/fee checks | Current release checks, security review, account/transaction recovery |
| AT | Real minimal synthetic public record on an already authorized sandbox PDS; direct retrieval in a separate workspace | Approved records with verified author/audience governance; exact deployed scopes tested | Recovery/migration/SLA and moderation/abuse controls |
| Collaboration | Two isolated browser profiles/workspaces; file-based private handoff and public AT retrieval | Optional managed private sync only if participants need it | Tested authorization/revocation, reliable backup and operational ownership |
| Mesh/satellite/funding | Deferred | Separate experiments only after core value | No implied commitment to implement |

The prototype may fail an AI benchmark and still establish a useful manual product direction. It cannot claim its AT acceptance criterion passed if publication was replaced by a JSON mock. If sandbox authorization or service availability is missing, label the network part **blocked**, demonstrate export only, and do not promote to the pilot.

## Proposed workflow

1. The steward opens a local workspace and imports `SM-01`, a visibly **synthetic** recording: three fictional plots, a seven-day period, timestamped moisture values, missing readings and one outlier. Fixture metadata defines nominal `% volumetric water content`, fictional installation/depth and a synthetic calibration reference. These labels follow every downstream view.
2. Validation preserves the original file, flags invalid rows and shows what is missing. The steward adds a note such as “Plot B probe moved during maintenance.” Source text never runs as instructions.
3. A deterministic view highlights stale/missing/changed readings. Optional local AI drafts a short explanation with citations to specific rows and notes. A missing calibration or contradictory source triggers uncertainty, not fabricated values.
4. The steward corrects the explanation, records the next manual check and saves a reviewed version. No network publication occurs. The original observation remains unchanged; the correction has an author/time/reason.
5. “Share” creates a separate public draft from allowlisted fields. The review shows exact text, any media, destination, publisher identity, dates and visibility. Removing information from the public draft does not erase private sources. Editing after approval invalidates approval.
6. Export a Green Goods Work-shaped packet for a **fictional inspection activity**, clearly marked synthetic and unsubmitted. Validate its schema structure; an arbitrary moisture sample must not be presented as completed work. Test fixtures supply Garden/action/account context without asserting they are valid live deployments.
7. A separately authorized sandbox publisher posts a minimal synthetic AT record. The user confirms the final content and identity. Publication is queued while offline; reconnect never approves previously unapproved content.
8. In a second isolated workspace, a reviewer retrieves the record by its AT URI, sees its synthetic status/context and records whether it answers a practical question. A private response can be exported back; a public reply requires another independent disclosure approval.

## Integration and data contracts

These are proposed boundary contracts, not existing Green Goods schemas or committed API names.

**Observation envelope:** local record ID; workspace ID; source kind (`manual`, `sensor`, `recording`); fixture/real flag; original bytes/file reference; observation and ingestion times; units; installation/placement and calibration reference; quality flags; permissible audiences/purposes; retention rule; author/collector; source lineage. Exact private location and identities are separate optional fields, off by default in exports.

**Interpretation:** input record/version references, local model/runtime/artifact hash or `manual/template`, prompt/template version, generated time, processing location, source-linked statements, uncertainty/abstention and reviewer corrections. Store model output as a draft. It cannot mutate the evidence record or grant any permission.

**Review:** actor/role, reviewed version, accepted/corrected/rejected decision, notes, time and consent-policy version. An edit or changed sharing policy invalidates the prior publication approval. Private review does not equal external verification.

**Disclosure intent:** immutable approved bytes, destination/audience, publisher identity, record key/intent ID, approval actor/time/version, status (`draft`, `approved`, `queued`, `sending`, `unresolved`, `confirmed`, `rejected`), receipt/URI and reconciliation history. A confirmed public record can be superseded or deleted where supported, but the UI must explain that external copies may remain.

**Green Goods export:** schema name/version; target chain/config fingerprint; Garden/action reference; proposed attester/account; exact `title`, `feedback`, `metadata`, `media`; `clientWorkId`; synthetic flag; status `exported-unsubmitted`. Omit private media/CIDs. Reject missing target context for a transaction-ready packet; a schema fixture must explicitly say it is not transaction-ready. Integrate through existing Shared exports and schema/ABI authority after approval, never duplicate contract rules. R06–10.

**Minimal AT prototype record:** use the established `app.bsky.feed.post` Lexicon rather than invent a production Green Goods namespace in two weeks. Include only `$type`, `text` and `createdAt`, subject to the pinned Lexicon. Example approved text: “Green Goods prototype: synthetic field recording SM-01. Missing readings in fictional Plot B prompted a manual sensor check. This is a workflow demonstration, not field evidence or an environmental outcome.” The PDS account identity, record URI and repository metadata are also public and must be explained. No attachment, private hash, exact location, person, wallet, onchain attestation claim or link to a private file. This demonstrates publication/retrieval, not a durable structured evidence standard. W09–13; L05.

Before implementation, verify the actual OAuth scopes, token storage, Lexicon, write/read responses, content limits and conditional write support in the chosen sandbox. Do not assume Certified permits this integration. A later structured Lexicon requires a separate schema/mapping decision with existing GainForest/Hypercert ecosystems considered first.

## Permissions, consent and recovery

Local contributor can create/correct their observations; reviewer can approve operational summaries; designated publisher can approve disclosure; operator can manage services but does not automatically gain consent to publish. A sponsor has only the audience rights explicitly granted. A person may fill multiple roles in a prototype, but the event history must preserve which authority was used. Existing onchain role checks still apply to any future transaction.

Obtain separate choices for local processing, private collaboration, public publishing and secondary use. Community authority does not silently waive an individual's rights; individual consent does not authorize collectively held knowledge. Default AI training permission is absent. Revocation affects future access/use within the system; no promise of retrieving already shared copies.

Encrypt private persistent data and exports using reviewed platform primitives and a documented key policy. Keep keys out of logs/sync payloads. Prototype recovery can use a user-held recovery secret and encrypted bundle; pilot recovery needs a community-approved trustee/succession procedure. Test lost-device, forgotten-password and operator departure separately. A non-exportable device key alone is not sufficient recovery. Warn before profile deletion/uninstall.

Shared-device requirements: visibly identify the current workspace, lock after inactivity, clear session/UI caches at sign-out and prevent another user reopening plaintext previews. Offline access and short locks must be tested with users rather than creating an unusable login loop. Browser/device compromise remains outside the guarantee.

## Measurable requirements

All thresholds are proposed decision rules, not achieved results.

| ID | Requirement | Evidence to pass |
|---|---|---|
| A1 | Core capture/review/export works without AI, extension, wallet or network | Complete the same synthetic task in manual PWA mode after installation and offline reload |
| A2 | Low-bandwidth participation | Core fixture under 1 MB; no automatic model download; interruption/resume test; record actual app/download bytes |
| A3 | Accessible task | Keyboard-only and screen-reader walkthrough; 200% zoom; no essential color-only meaning; 5/6 facilitated users complete core task without facilitator takeover |
| A4 | Language honesty | EN/ES/PT evaluation separated; launch only in community-selected language(s) with a qualified reviewer; no unsupported Indigenous-language claim |
| S1 | Portable records and exit | Export original sources, corrections, policy metadata and readable summary; restore in a clean profile; no subscription gate on own-record export |
| S2 | Meaningful consent | All public fields and publisher identity visible before approval; edit/revoke-before-send invalidates approval; sponsor cannot override |
| T1 | Source fidelity | Every numeric statement matches its source and units/time; zero fabricated measurements/unsafe prescriptions in acceptance set; at least 95% factual entailment before correction |
| T2 | Review effort | Counterbalanced assisted/manual task comparison; at least 20% median review-time reduction before AI becomes default; report per-language errors and all failures |
| T3 | Reliable local state | 50 synthetic observations survive offline restart and interrupted import; no lost acknowledged save |
| T4 | Reconciliation | Two divergent workspace edits converge through explicit conflict review; no silent overwrite of consent or reviewed content; repeat import does not duplicate observations |
| P1 | Privacy | 30 adversarial disclosure fixtures with canary names/locations/EXIF/URLs/instructions: zero canaries in network/export/logs; exact serialized public payload checked |
| P2 | AI isolation | Network capture shows no inference-provider request; model cannot access signing/publishing APIs; no silent cloud fallback |
| V1 | Protocol honesty | Export validates against pinned existing schema; no onchain success state without confirmed transaction evidence |
| I1 | AT network proof | One authorized synthetic record published, read in second isolated workspace, exact approved text matched; lost-response retry yields one logical record |
| R1 | Useful reciprocal exchange | Second steward identifies a relevant insight and a context limitation; records one actionable question/feedback item. Pilot expands to measured bidirectional use |
| C1 | Total cost visibility | Track setup, connectivity, failures, support and reviewer time alongside infrastructure spend; compare a noncustom baseline |

For AI quality use the 60-packet set specified in research. The 30 privacy cases test disclosure paths; they need not be 30 additional model prompts. Zero observed leaks is a finite-test result, never a universal privacy guarantee. Performance target is p95 under 60 seconds on an accepted device tier with recorded peak memory; a failed tier stays manual-only.

## Offline reconciliation and failure behavior

Use append-only observations and versioned corrections in the prototype. Stable source IDs and file/row fingerprints detect repeat imports. Concurrent corrections produce a visible conflict that a reviewer resolves; do not use last-write-wins for permissions or consent. Preserve both versions in history. A later CRDT can merge edits mechanically but cannot choose who is authorized to publish.

Before network side effects persist an approved intent. On reconnect, check current authority, destination and exact approved bytes. On timeout retain `unresolved`, retrieve by intended record key/receipt and compare before retrying. If the destination content differs, stop and require a decision. A closed browser can delay work indefinitely; show that limitation and resume in the foreground. R07; W01/W10.

| Failure | Required experience |
|---|---|
| No WebGPU/out-of-memory/model download fails | Offer manual/template route; retain evidence; no cloud substitution |
| Disk quota/eviction | Explicit failure before claiming save; export/recovery guidance; no silent discard |
| Bad units/calibration/time | Quarantine or flag affected rows; source preserved; no derived recommendation |
| Conflicting sources | Show conflict and ask human to check; do not average away disagreement |
| PDS unavailable/OAuth expired | Keep approved draft; reconnect/re-authenticate; verify approval still valid |
| Response lost after publish | Read/compare before retry; never create a new record key to hide ambiguity |
| Private canary reaches outbound object | Block release/pilot, diagnose the boundary and rerun privacy proof |
| Consent withdrawn before send | Cancel queued intent; prior public disclosure handled separately |
| Wrong wallet/chain/action/fee | No transaction; export stays unsubmitted until authorized correct context |
| Device lost/reviewer leaves | Restore drill and role/key handover; fail pilot gate if recovery depends on that person |

## Two-week prototype schedule

The clock starts only after separate implementation authorization, designated roles, synthetic-data policy and an authorized sandbox PDS/account are in place. No new services, packages or accounts are assumed free to create. The current task does none of those actions.

| Days | Work proposed | Exit evidence |
|---|---|---|
| 1–2 | Validate the field moisture-check question with available consenting participants; choose baseline/manual task; freeze fixture and acceptance set | Agreed task and budget owner hypothesis, or stop/reframe before build |
| 3–4 | Local import, source view, correction/history, backup/restore; minimal optional extension capture | Offline manual path and malformed-input/recovery tests |
| 5–6 | One local-model spike with pinned license/runtime; measure hardware/language quality and review effort | Report results; retain manual-only mode if failing; no second model platform project |
| 7–8 | Exact disclosure preview, Green Goods export and sandbox AT publication/retrieval | Network payload proof, stable intent/retry test; no transaction |
| 9–10 | Second-workspace task, accessibility/failure drills, evaluation and cost review | Prototype report with pass/fail/blocked per requirement; pilot decision |

Cap: US$12,000 as itemized in research. If integration consumes the budget, preserve the manual workflow and report the incomplete network gate. Do not extend the scope by silently adding a gateway, custom DID, new contracts or a private AT layer.

## Pilot and production gates

Proposed eight-week pilot: three communities doing the **same workflow**, ideally two resource-constrained sites and one better-resourced learning peer. Compensate local facilitation/translation; do not call uncompensated labor a software saving. Cohort size supports learning, not statistical proof of broad impact.

Weeks 1–2 establish baseline, permissions, supported devices/language and recovery. Weeks 3–6 run weekly use and facilitated reciprocal exchange. Weeks 7–8 compare effort/decision usefulness, conduct exit/restore drills and seek a paid renewal. A real sensor is optional only after named-device and calibration approval; otherwise keep authorized recordings and label them correctly.

Pilot advancement requires zero unresolved severe privacy/recovery defects, at least two communities using the workflow weekly through week 6, at least one documented useful exchange in **each direction** for each matched pair, no net increase in median task effort, and at least one buyer willing to sign a defined paid continuation. These are decision thresholds, not statistically generalizable effects. A promised letter or friendly interview is weaker than paid demand. Publish failures alongside successes with community permission.

Production additionally requires security/accessibility review, legal agreements and authority, supported language/device matrix, tested upgrades and migration, incident/abuse response, operator succession, measured service costs and current Green Goods release/transaction proof for any enabled onchain path. A working demo is not production readiness. Commitment pooling, vault/endowment interaction, ecological certification, satellite analysis, multi-device mesh, native gateway and automatic actuation remain outside this PRD's initial build scope.
