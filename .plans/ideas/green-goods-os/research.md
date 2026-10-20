# Green Goods OS: technical and licensing research

**Narrative update, 8 October 2026 Pacific:** [pitch-revision.md](pitch-revision.md) now governs the accepted Green Goods framing and pillars. The original technical/licensing findings below retain their source dates. Cost figures are historical assumptions withdrawn from the next core pitch. New partner-audience sources are P01–P07 in the [evidence register](evidence-register.md#partner-audience-research).

**Stage 1 · 8 October 2026 · proposal, not implementation authorization.** Sources and exact implementation symbols are indexed in the [evidence register](evidence-register.md). References such as R06 and W10 resolve there. Recommendations below are inferences; they are not adopted product or legal decisions.

**9 October technical supplement:** use [architecture.md](architecture.md) for the later node-free, extension-first networking/setup discussion and current Web API boundaries. Use [sensor-kit-research.md](sensor-kit-research.md) for purchasable products, local interfaces and logging/cost gates. This supplement adds research to the vision without replacing the historical baselines or expanding the [prototype](spec.md).

The viable near-term direction is a private community workspace with optional local assistance, deliberate exports and a small public publishing adapter. Green Goods already has useful work, review, identity and funding infrastructure. It does not yet establish the proposed OS, a private AT mesh, broadly compatible local AI, verified ecological outcomes or a proven business model. Retain existing licenses while testing paid support and governed services. Do not base a pilot on an unverified cooperative agreement or on Coop code being MIT-compatible.

**Pitch-revision note:** Technical and licensing findings below remain the research baseline. The nursery setting was a test-fixture recommendation, not validated demand. [Revised positioning](pitch-revision.md) now focuses on a farmer/adviser pair and one field moisture-check question; [new market evidence](market-sizing.md) supplies the buyer-channel model.

## 1. Baseline and evidence quality

Green Goods was inspected first at branch `release/october-2-0-0`, commit `0fc3fd83e9a1c4258e4bcfdf64396a3dbe601778`. Code, contract schemas, ABIs, tests, capability projections, package guides and relevant plan/Linear evidence were read. A concurrent documentation commit advanced HEAD during research; it did not change the inspected implementation. Coop was inspected separately at commit `5b889eea30056877f1e3a0114e0cd4353a36cee4` on `chore/add-agpl-license`. See the register for provenance and pre-existing changes.

| Area | What exists | Status and honest limit |
|---|---|---|
| Browser/PWA | Service-worker shell/media/background-work modules, installable client and update prompt; work submissions can queue locally | Implemented; capability ledger says offline capture available. No fresh installed-browser or eviction/recovery proof in this task. R03–04 |
| Identities | EOA wallet, passkey smart account and embedded wallet address selection; passkey assertion and account adapters | Implemented, with tests/configuration elsewhere in repo. A passkey is an authentication mechanism, not automatically an AT DID or a community governance mandate. R05 |
| Reports/evidence | Work metadata/media, EAS work records, review queue, WorkApproval and assessments | Implemented. A submission, role-authorized review and methodology-based outcome are different claims. Existing media publication is not a ready-made private vault. R06–10 |
| Retries | Stable client work identity, upload checkpoints, broadcast tracking and receipt reconciliation | Mocked unit tests cover meaningful boundaries. Tests were inspected, not run. Unknown transaction outcomes must remain unresolved, not trigger blind resends. R07–08 |
| Commitment pooling | Lifecycle, claims, fulfillment, linked work and cycle operations; protocol/indexer models | Deployed-not-available in capability ledger; product and QA gates remain. Some live issues marked Done do not override owning release evidence. R11–12 |
| Funding/endowment | Direct support/vault flows, ERC-4626 adapters, strategy reporting and configured yield routing | Existing code and dated deployment evidence. Loss, liquidity, fee and operational risks remain. R13–14 |
| Hypercerts/Needs | Integration and ontology projections | Hypercert activation environment-dependent/in-build; community Needs planned. Do not promise a generalized impact certificate pipeline. R03 |
| Evidence Mesh/AT | Evidence envelope, privacy principles, roadmap, Certified exploration | Planned; RESR-69 says no implementation approved or merged and lists third-party dependencies. L02–05 |
| Other research | Evaluator mapping/public metric inventory/PGSP vault routing trackers | Canceled (RESR-50/65/68). Neither completed evidence nor automatically revived scope. L06 |

Internal product documents include ambition and historical forecasts. They are not customer interviews, current usage analytics or audited revenue. The repository's ontology and capability projections are a stronger guide to terminology and availability. This proposal follows the user's priority: useful local records first, supporter reporting downstream. R02–03.

## 2. Customers and the proposed principles

The following market assessment is a hypothesis, not completed customer research.

| Setting | Likely job / buyer | Access and sovereignty constraints | Initial fit |
|---|---|---|---|
| Mid-sized farmer transitioning practices | Compare field observations with interventions; owner/operations manager pays | Existing records, agronomy workflow, liability, integration cost and seasonal time pressure | Stronger ability to pay; prioritize farmOS/import integration over replacement. Too broad for first pilot. |
| Small regenerative farmer | Preserve practical experience and coordinate limited labor; owner or cooperative pays | Thin budget, phone-first use, patchy connectivity, little review time | Valuable comparison user; support must not cost more than the saved effort. |
| Community managing land in the Global South | Maintain shared operational memory despite staff turnover; community steward uses, NGO/cooperative coordinator may buy | Collective authority, local language, shared devices, bandwidth, power, land/sacred knowledge sensitivity; highly varied settings | Recommended first setting if there is a willing community and funded facilitation. Sponsor must not acquire data control. |
| Well-resourced environmental steward | Coordinate staff and expert knowledge; estate, foundation or land trust program lead pays | More equipment and advisory budget; risk of imposing its metrics on others | Potential learning peer and service buyer. Do not make expensive hardware the participation norm. |

Select one community nursery workflow, not four products. Nursery stewardship offers repeated observations and clear human decisions without pretending a two-week experiment can prove soil regeneration. This differs from the Evidence Mesh roadmap's energy-first sensing recommendation: the prototype uses a **synthetic recording** to evaluate understanding and consent. A real sensing program still needs an independent metric/method choice. L04.

Evaluate the proposed pillars as a requirements framework:

- **Accessibility:** complete the core task without AI, extension, wallet or continuous connectivity. Measure cost, setup time, bandwidth, task completion, keyboard/screen-reader use and language-specific error rates. Affordability helps but a free tool requiring expert maintenance may still be inaccessible.
- **Sovereignty:** support usable export, recovery, audience choice, infrastructure choice, revocable future access and a funded exit path. “Ownership” alone does not establish all copyright, collective knowledge, privacy or hosting rights.
- **Trust:** name the source, reviewer, decision and limitations; deliver records reliably. Appropriate transparency means exposing the basis of a claim to an authorized audience, not publishing all raw evidence.
- **Reciprocity:** reward useful contributions and learning in both directions; recognize curation, translation, mentorship and local interpretation. Measure benefits for contributors and noncontributors separately. Do not compel sensitive disclosure in exchange for access to one's own work.

Privacy, interoperability and verifiability are cross-cutting requirements, not optional fifth-to-seventh priorities. Tensions are real: replication improves availability but expands exposure; encryption protects records but complicates recovery and shared devices; local inference avoids a provider disclosure but consumes device resources; public provenance improves auditability while revealing relationships; interoperability can carry harmful interpretations across contexts. Record these choices per audience and workflow rather than promising that all values are maximized simultaneously.

## 3. A — Browser and extension architecture

**Ordinary members:** use the existing-browser workspace/PWA for capture, import, correction, search and export. A desktop extension is optional for user-selected capture from a tab and a convenient review panel. It must not be required for phone participation. A member does not run a PDS, full chain node, AI server or Mac Studio.

**Community operator:** manages onboarding, permission groups, encrypted backups, review authority and (if chosen later) a persistent private sync/gateway service. A public AT publisher also needs a reachable PDS, domain/TLS, monitored storage and recoverable identity. An operator can procure a managed service rather than self-host, with a portable contract and exit test.

**External dependencies that remain:** browser/OS update distribution, optional extension store, initial app/model downloads, DNS/TLS, identity discovery, optional signaling/TURN/sync, AT PDS/relay or application reader, chain RPC/indexer/EAS endpoints, wallet/paymaster and public media gateway where used. Local-first is a failure-tolerance design, not freedom from every centralized dependency.

Use foreground UI/worker execution for long inference; let the extension background worker coordinate short events and persist resumable state. Chrome documents termination after inactivity and limits on long events; a tab, offscreen document or keepalive trick is not a reliable server. Persist job state before side effects, rehydrate after restart, show last successful sync and make reconnect explicit. W01/W03.

Start with `activeTab`/user gesture plus narrowly justified scripting/storage permissions and exact optional host access. Do not copy Coop's broad permissions/CSP wholesale. Capture selected text and source URL only; never silently scan tabs, local files, browsing history or page credentials. Content scripts and page text are untrusted. Cross-context messages need sender/origin validation and size/schema limits. Model executable runtimes should be packaged and versioned; treat remotely downloaded weights as data with hashes, licenses and explicit user consent. W02–03.

Keep small preferences in extension storage; records and large artifacts need an IndexedDB/OPFS strategy with quota checks. Browser sync is unsuitable for bulk private evidence. Deletion, profile clearing, device failure and uninstall can destroy local state. Warn before destructive operations and offer encrypted backups before upgrades. A migration must be resumable and tested with old snapshots; automatic extension updates must not silently publish or grant new processing permissions. W02.

Chromium desktop is a bounded first extension target. Firefox's background scripts and Safari's environments differ; side-panel/offscreen/peripheral APIs cannot be assumed portable. A PWA provides broader access but has its own storage/background limits. Claim support only for tested browser/version/OS combinations. Include focus order, keyboard operation, screen-reader names, 200% zoom, contrast, plain-language review and touch-sized controls in pilot acceptance. W04.

### Coop: useful reference, not dependency selection

Coop's inspected extension uses WXT/Manifest V3; a companion app and shared package support local capture, Dexie/Yjs and optional sync infrastructure. Its accepted Yjs decision cites available persistence/network adapters. These are credible lessons in persistence, recovery and local collaboration. Its inference provider exposes heuristic and local-model modes; the extension has separate Gemma runtime work with a sandbox/cache caveat. A Chrome-oriented prototype with tests is not proof of low-resource deployment readiness. No implemented AT layer was found in the bounded packages search; an onchain research document discusses AT as a possible adapter. C02.

Coop's inspected license is AGPLv3 and the shared package says AGPL-3.0-only. Copying or linking code requires a compatibility/obligation review. General design lessons can inform an independently specified Green Goods feature; that does not justify copying protected implementation while calling the result MIT. Compare contributing to Coop, a separately licensed component and independent implementation after a rights review. C01.

## 4. B — Local AI feasibility and evaluation

Local AI is optional assistance for source-linked draft interpretation. Deterministic validation and human review own correctness. No model may authorize a transaction, change permissions, publish, select payment recipients or decide that a community has consented.

| Candidate | Why investigate | Constraints / disposition |
|---|---|---|
| No generative model | Template summary, numeric checks, source lookup and human notes | Mandatory baseline and complete participation path. Likely best on constrained phones/laptops. |
| Qwen2.5-0.5B-Instruct | Small text candidate; Apache 2.0 model card; a similar candidate appears in Coop | Weak reasoning/field language quality possible. Pin converted artifact, tokenizer, quantization and runtime; model-card multilingual coverage is not acceptance evidence. W08 |
| Gemma 4 E2B | Current small effective-parameter candidate; vendor supports on-device use | Vendor Q4 load estimate ~2.9 GB is not total laptop working memory. Mobile estimate ~0.84 GB uses another runtime. Optional 8 GB benchmark candidate, not a 4 GB guarantee. W05 |
| Gemma 4 E4B / earlier Gemma 3n | Comparative research if the smaller candidate fails | E4B Q4 vendor load estimate ~4.5 GB before full runtime/context; defer constrained-device default. Earlier Gemma families carry different license terms. W05–06 |

Current Google documentation distinguishes Gemma 4's Apache 2.0 license from earlier families covered by Gemma terms. Preserve exact model/version license and notices with distribution. Do not infer the license from the brand name. Browser inference runtimes are independent dependencies: WebLLM requires compatible compiled MLC artifacts; Transformers.js uses ONNX with WASM/WebGPU paths. A GGUF download is not automatically loadable by either. W06–07.

Working memory includes weights, tensor buffers, KV cache, runtime copies, tokenization, UI/storage and the OS. Quantization trades quality for resource use; effective/active parameter count can substantially understate resident weights. Limit prototype input to a bounded evidence packet and short output. Avoid advertising large context windows as free capability.

**Proposed benchmark, not measurements:** test actual 4 GB and 8 GB laptops selected with permission, record CPU/GPU/OS/browser/driver, free disk, available WebGPU, total peak system memory, failures, download bytes, cold/warm latency and battery/energy method. Use a 4 GB no-WebGPU path and 8 GB integrated-GPU path. A Mac Studio is optional development hardware and must not supply the user benchmark. No access to personal hardware occurred here.

Use 60 synthetic/authorized task packets: 20 each in English, Spanish and Portuguese, covering normal values, missing data, contradictory notes, unit changes, stale readings and adversarial text. Freeze a human-reviewed source answer set. Compare manual/template and model-assisted modes with order counterbalancing; record every correction and reviewer time. Test source entailment, exact quantities/units/time, appropriate abstention, unsupported additions and retained uncertainty—not generic chat preference. Do not average away a failing language.

Suggested pilot thresholds: every displayed numeric statement links to a matching source; zero fabricated measurements, unsafe prescriptions or private-output leaks in the acceptance set; at least 95% of factual statements entailed, with all residual errors corrected before sharing; median reviewer time at least 20% below the template/manual control before enabling assistance by default. Small samples cannot prove zero real-world risk. Disable AI if correction effort or language quality is worse. Target p95 completion under 60 seconds on an accepted device tier, but keep the manual route if that target fails. Latency/energy remain unmeasured.

Download only after showing size, storage need, source and license; support interruption/resume and checksum verification. No model auto-download on metered connections. Let users remove weights while retaining their records. No silent cloud fallback. RESR-79 requires a decision on permitted models, data, derivatives, retention/training, regional terms and consent before gardener evidence goes to external inference. Synthetic data does not establish approval for subsequent real data. L01.

## 5. C — Green Goods integration contract

Keep four bounded concepts distinct: **observation** (what was recorded), **interpretation** (a source-linked explanation), **review decision** (who accepted/corrected what) and **protocol publication** (an intentionally disclosed record). A sensor sample is not Work by itself. A future export can describe a gardener's actual inspection activity under a valid action; an unsupported environmental outcome must not be invented to fit a schema. R02/R09.

| Transition | Existing authority / format | Required boundary |
|---|---|---|
| Reviewed inspection → Work export | `work`: `uint256 actionUID,string title,string feedback,string metadata,string[] media` | Valid Garden/action and submitter; time/domain/role checks; exact public metadata/media preview. Synthetic records visibly labeled. |
| Work → review | `workApproval`: actionUID, workUID, approved, feedback, confidence, verificationMethod, reviewNotesCID | Authorized operator/steward, matching recipient/action, no self-review under resolver rules; AI can draft notes only. |
| Reviewed work → assessment | Assessment config reference, domain/time/location; V3 adds kind/cycle/baseline | Appropriate evaluator/methodology; never imply the prototype performs an assessment. |
| Commitment reference → testimony | Commitment ID/title/testimony CID | Narrative evidence does not independently confirm fulfillment or create settlement rights. |
| Approved public subset → AT | New adapter or an approved existing Lexicon; separate DID/OAuth authority | No automatic DID↔wallet equivalence, no hidden public fields, no required private-source hash. |

The inspected schemas are non-revocable; Work's resolver refuses revocation. Even where a later surface supports correction, earlier public copies remain. A CID/reference can expose public content and does not encrypt it. Redaction must happen **before upload**, not merely before sending an onchain transaction. Some resolver schema comparisons are conditional on configured nonzero UIDs; check deployment wiring before relying on that validation. R09.

The Shared EAS readers assemble evidence/review state; Envio models protocol entities separately. Use declared Shared exports and existing ABI/config ownership rather than creating competing schema constants. Resolve one configured chain with `getDefaultChain()`/`DEFAULT_CHAIN_ID`, use `Address`, verify deployment/ABI/schema IDs, Garden/action/role and recipient before a proposed write. R10/R14.

A future write flow must show selected EVM account, chain, action, recipient, full metadata and media, gas estimate, sponsorship status, and what becomes public. A wallet may pay gas; a passkey/paymaster path may sponsor it, but sponsorship is conditional and not an entitlement. Explain fees even when subsidized. Separate prepare, user authorization, broadcast, receipt confirmation and indexed/read visibility. The AI has no signing capability or authority.

The one-default-chain rule does not erase explicit integration exceptions. The inspected campaign-vault redemption hook requires Ethereum mainnet and a connected owning wallet. Keep that path distinct from the Garden module/vault deployment and verify each integration's actual chain/account contract. R14.

Reuse the intent behind `clientWorkId`, upload checkpoints and exact receipt reconciliation. Assign a stable publication intent before side effects; persist transaction/operation IDs, match receipt emitter/schema/recipient/attester/data and chain; retain unresolved states through RPC outages. A retried upload or write must not create a second publication merely because a response was lost. A local lock does not prevent another device from submitting the same intent; a publisher ledger and reconciliation are needed. R06–08.

For the prototype, the Green Goods boundary is an **offline, human-approved export** with schema validation. It is not a claimed onchain attestation. Test transactions are a later explicit option requiring separate authorization, configured sandbox, signing and fee controls. Keep pooling, funding and vault actions outside the prototype.

## 6. D — IoT, field evidence and satellite context

The two-week input is one **synthetic CSV recording** of nursery-bed soil-moisture readings, not a peripheral test. Label each row/graph/export `synthetic`. Use nominal volumetric water content in percent only with an explicit fixture calibration label; it is not a real calibration or agronomic threshold. The output identifies beds needing a manual check due to missing/stale/unusual readings; it never controls irrigation.

Browser connections can be practical for supported peripherals but are not universal. Web Bluetooth is BLE/GATT with user selection; Web Serial and WebUSB have platform/browser and device-class restrictions. USB does not mean every sensor works; drivers, framing and browser permissions matter. A browser can use HTTP or MQTT over WebSockets where a service provides it. Ordinary web pages do not act as arbitrary TCP MQTT brokers or always-on serial gateways. A persistent optional native/LAN gateway can handle vendor drivers, serial/MQTT, buffering and authenticated HTTPS/WSS delivery. W18.

Before a real pilot choose one named sensor/firmware/interface, an owner for battery replacement and calibration, a known reference check and a maintenance log. Do not procure based solely on nominal accuracy. Sensor identity can be a managed installation ID; without signed device measurements it is an assertion, not cryptographic proof of device origin.

Each sample needs source/installation ID, metric definition, raw value, interpreted value if any, unit, device time/timezone, ingestion time, sequence number, location precision, depth/placement, firmware, calibration version/date/method, transport, quality flags, original file digest and importer version. Record clock drift, gaps, duplicate/out-of-order samples, battery problems, replacements and changed units. Preserve original bytes separately from normalized values. Reject NaN/overflow, impossible ranges, oversized payloads, formula injection and executable content. Never fill missing values silently; flag interpolations as derived.

Threats include moved sensors, uncalibrated probes, tampering, replay, selective missingness and a compromised gateway. Cryptographic signatures can improve origin/integrity evidence, but cannot prove correct placement or honest calibration. Pair records with human inspection and explain uncertainty.

Satellite imagery is optional later context: bounded, licensed scenes with acquisition date, resolution, cloud/quality mask, processing version and AOI permission. Sentinel-2 offers useful multispectral imagery, but nominal revisit does not guarantee a clear observation. Pixel scale, canopy and cloud effects make it unsuitable as a direct nursery-bed moisture truth source. An index change is not automatically biodiversity gain, soil-carbon gain or attributable regeneration. No satellite classification is required in the prototype. W19.

## 7. E — AT Protocol and cooperating browser peers

Three layers must remain distinct:

1. **Private collaborative state:** observations, edits, permissions and review history, with appropriate encryption and access policy.
2. **Connectivity:** how authorized devices find each other and exchange permitted updates while awake/reachable.
3. **Authoritative signed public repository:** the current AT account/PDS state and deliberately published records.

AT's current repository/sync architecture is public. A self-hosted PDS does not make its records private. Permissioned-data proposal 0016 is experimental; it cannot be treated as an available privacy solution. Application-encrypted public blobs still disclose metadata, persist as ciphertext copies and create key/revocation risks; exclude that design from the pilot. W09–12.

| Component | Useful role | What it does not solve |
|---|---|---|
| Browser/extension | OAuth client, local draft store, source review, record preparation, retrieval; signing primitives if deliberately designed | Persistent internet availability, unattended public service, safe shared key custody |
| Reference PDS | Authoritative account/repo service, blobs, APIs, identity operations | Private evidence workspace or effortless recovery; operator still manages backups, DNS/TLS and compromise |
| Cocoon / Tranquil | Alternative persistent PDS implementations worth conformance/operations evaluation | Drop-in browser runtime or established lower total support cost. Pin release, license and migration behavior before choice. |
| atcute | Modular AT formats/client/OAuth and repository-related libraries | Complete product, universal PDS interoperability or private mesh policy |
| Yjs / Automerge | Mergeable private draft state, persistence/network adapters | User authorization, semantic correctness, deletion of peer copies, consent conflict resolution or AT commit authority |
| libp2p/WebRTC | Optional browser peer transport and authenticated peer connections when designed | Connectivity with every NAT, always-on peers, collective governance or radio networking |

Sources: W10/W13–17. This is an option comparison, not stack approval.

Automerge's browser storage/sync adapters offer a document/change-history approach; Yjs offers shared types and mature providers, including the pattern Coop chose. Choose neither until concurrent editing is required and representative documents/conflicts are measured. For the prototype, append-only observations plus explicit corrections and a deterministic import/outbox are sufficient. Do not build a CRDT layer merely to demonstrate a mesh.

Two browser peers may communicate by WebRTC, but discovery requires signaling; ICE/STUN and often TURN/relay infrastructure handle NAT/firewall realities. Peers can sleep, close, be partitioned or have no shared connection window. A durable server or store-and-forward export provides availability; relay bandwidth and privacy are real costs. A LAN browser app still depends on a serving origin and local network. Radio mesh needs radios, drivers and gateways outside an extension. W17.

For public AT writes, retain one authoritative publishing path per DID/PDS. Let users authorize scoped writes through OAuth; the PDS signs repository commits with its configured repository key. Do not give every member the same private signing key. A community publisher requires named human authority and recoverable administrative custody distinct from individual authorship. A member's passkey/smart account does not establish control of a Certified DID. RESR-69's existing exploration favors delegated writes to the existing identity and explicitly gates Green Goods-issued DID governance. L05.

Proposed publisher coordination: persist reviewed record bytes/hash and approval version, use a stable record key/intent, serialize writes for a community publisher, and use the installed API's conditional revision/CID preconditions where supported. On a conflict, fetch current authoritative state and require renewed approval for changed content. On an ambiguous response, read and compare before retrying. Exact Lexicon request/response fields and OAuth scopes must be verified against a pinned implementation; endpoint retrieval was incomplete during research. This is a design, not a tested adapter. W10–11.

Back up the public repo CAR **and blobs**, private workspace, key recovery material and DID/domain control through separate protected procedures. Test export/import and identity migration, including adversarial/unavailable old provider. A stolen signing key, lost domain or lost recovery authority can defeat apparent portability. Public deletion/revocation cannot retrieve copied records. AT relay discovery does not guarantee another application understands a new Lexicon; the prototype's second workspace should retrieve a known record directly before claiming wider network distribution.

## 8. Architecture options and recommendation

| Option | Scope / cost drivers | Evaluation |
|---|---|---|
| A. Local workspace + explicit export + optional public PDS | PWA, minimal capture extension, local persistence, human preview; public service only for approved synthetic record | **Recommend for prototype.** Fewest new trust boundaries; portable manual path. Limited asynchronous private collaboration. |
| B. Community-managed private sync/gateway + public publisher | Persistent service, encrypted access, backup, operator support, optional sensor bridge | **Pilot candidate after need is observed.** Improves continuity; adds duty to patch/restore and key governance. Public/private stores remain separate. |
| C. Cooperating extension mesh | A or B plus CRDT, peer authentication, signaling/TURN, revocation, conflict policy | **Research only.** May reduce some server transport, but cannot eliminate availability/support costs or authoritative AT publishing. |
| D. Native community appliance/app | Persistent local service, drivers, local models, optional radio gateway | **Deferred.** Could help poor-connectivity sites with operator capacity; hardware procurement and maintenance threaten affordability. Mac Studio not required. |

Private record → source-linked draft → human correction → audience-specific disclosure preview → approved export/publication → second workspace retrieval/feedback is the proposed boundary. The source remains private unless separately approved. Public records carry approved context and attribution; private evidence identifiers, hashes and locations must not leak through automatic provenance fields.

## 9. Threat model and recovery

Assets: field knowledge, people/location/land-rights information, credentials/keys, consent history, reliable records, community reputation and funds. Adversaries include malicious pages/peers, compromised devices/operators, overreaching sponsors, poisoned imports and an honest participant making a publication mistake. The model is not only an external hacker model.

| Threat / boundary | Control proposed | Proof needed / residual risk |
|---|---|---|
| Shared or stolen unlocked device | Per-person workspace lock, short session, encrypted records, explicit sign-out; separate OS profiles where possible | Another person cannot open prior workspace after lock. Device malware/unlocked memory still sees plaintext. |
| Lost keys or laptop | Encrypted export with version/hash manifest; offline recovery secret; community-approved multi-person recovery procedure | Restore in fresh profile without old device. Recovery trustees can collude; document trust and succession. |
| Prompt injection in page/note/sensor text | Treat source as data; bounded schema; model has no tools/keys/network; citations resolve only to allowed local sources | Adversarial packet cannot trigger network/write or conceal publication fields. Text-only persuasion can still mislead reviewer. |
| Malicious peer or sync host | Authenticated membership, per-workspace keys, quotas, signed/provenanced changes, sandbox parsing, audit of key changes | Reject unauthorized updates/replays; rotate on removal. Prior peer copies cannot be recalled. |
| Poisoned readings/import | Units/time/schema/range checks, file size limits, preserved originals, quarantine unknown calibration | Missingness/tampering visible. A plausible lie needs field review, not merely validation. |
| Accidental public disclosure | Separate private/public representations; allowlist export fields; exact text/media/metadata/destination preview; no upload before approval | Canary identifiers/EXIF/precise locations never appear in network payloads or exported public object. Human error remains possible. |
| Consent changes during review | Approval bound to bytes, audience, policy version and approver; invalidate on edit or authority change | Stale approval rejected; private sync removal prevents future access, not past copying. |
| Compromised publisher/key | Scoped OAuth, no shared signing key, separate recovery/admin roles, public correction procedure | Key rotation/provider migration drills. PDS/service compromise remains a trust dependency. |
| Transaction duplication or wrong account | Separate user signing, chain/account/schema check, persisted intent, receipt reconciliation | No automatic resend after unknown receipt; cancel/reconnect paths. Chain reorgs/provider outages remain. |
| Supply-chain/update compromise | Pinned versions/hashes/notices, least privilege, reviewed migrations, rollback/export | Review dependency and update artifacts. Browser/OS supply chain remains outside local control. |
| Backup/telemetry leaks | Encrypt before backup; exclude private payloads from logs, crash reports, analytics and prompts | Network/log inspection on synthetic canaries; encrypted backup has its own retention/access rules. |

Do not imply encryption alone solves collective rights or that hashing anonymizes small, guessable records. Informed publication needs understandable explanations and the right to decline without losing the core tool. No real gardener evidence was sent to inference providers in this research. RESR-79 remains an active gate. L01–02.

## 10. Alternatives and make/buy/contribute choices

| Alternative | Verified workflow / fit | Recommended response and unresolved questions |
|---|---|---|
| farmOS | Farm assets/logs, API and sensor data streams | Integrate/import or contribute a reviewed-evidence adapter. Do not rebuild farm management. Test current offline needs; historical Field Kit material is insufficient evidence. W20 |
| OpenTEAM | Interoperable agricultural tools and farmer-centered data governance; Common Enrollment/SurveyStack/farmOS connections described | Learn/contribute shared schemas and consent/export approaches. Several components have distinct maturity and agreements; not a single drop-in OS. W21 |
| Hylo | Groups, requests/offers, coordination and shared knowledge | Potential community exchange layer. Check export, rights, moderation and integration before duplicating its social features. Future federation/local features remain roadmap claims. W22 |
| ODK / Kobo | Offline field collection and managed/self-hosted data workflows | Strong lower-complexity baseline, especially Android and enumerated forms. Compare field usability/support before custom capture. Kobo current pricing/eligibility unverified; use quotes, not old free quotas. W23–24 |
| GainForest / Taina | Field observations, storytelling/knowledge archives, public Certs and supporter flows; community governance described | Closest overlap. Investigate interoperability and contribution before inventing another evidence/AI network. Hosting, model processing, rights and maintenance details need direct product/contract review. W25 |
| 5th World | Property assessment/design/build services; Regen Tracker announcement covers site data, expert guidance and monitoring | Evidence that professional interpretation can be a service, not proof of GG willingness to pay. Current homepage and 2024 announcement are different snapshots; no API or current tracker tariff assumed. W26 |
| Ma Earth | Project campaigns, crowdfunding/matching and trust-building updates | Potential downstream export/design discussion; not an assumed sensor/AI operating platform or GG buyer. No partner interest inferred. W27 |

Green Goods' possible differentiation is continuity from locally useful records through community review to its existing protocol. That combination must prove easier than a field form + farmOS/Hylo + manual report. Local AI, AT, community data stewardship and evidence-linked funding are not independently novel. A recommendation to build the full stack would be premature.

## 11. Regen Commons and licensing-options memo

### What the named sources actually establish

The March 2025 brand-stewardship thread is explicitly a draft. The April 2025 RFP commissioned formation/governance work, including legal structure, membership contributions and exits. The April 2026 agentic-organization discussion proposes conditional access to commons services and describes deliberation still needed. These are related Regen Commons leads, but none establishes an adopted replacement software license for Green Goods. W28–30.

Referenced brand agreement, legal memo and multisig responsibilities were located; their bodies were not retrievable through public page/export attempts. Current legal entity/jurisdiction, governing charter, ratification record, signatories, amendment authority, IP schedules, trademark assignments, fees and operative member/service terms remain unverified. A later dated proposal does not prove earlier formation work was adopted. Do not import the royalties or restrictions of similarly named “Regenerative Commons” licenses without a verified legal relationship. W31.

### Rights must be separated

| Layer | Baseline / proposed approach | Missing authority or terms |
|---|---|---|
| Software/dependencies | Root MIT remains. Preserve upstream notices/terms, including AGPL-family vendored contracts. | Complete license inventory, dependency/version closure, source/provenance notices and combined-work analysis. |
| Observations/data | Community-authorized purposes, audiences and retention; separate privacy/collective and database rights | Who can authorize on behalf of subjects/community, third-party sensor/imagery rights, location sensitivity, lawful basis, onward use. |
| Knowledge/education | Private by default where appropriate; optional clear open-content license for deliberately public material | Contributor authority, cultural restrictions, attribution, translations/derivatives, no automatic AI-training permission. |
| Schemas | Prefer permissive interoperable specifications where rights permit | Authorship, upstream spec terms, patent/trademark issues; schema publication does not release underlying records. |
| Model weights | Exact artifact license, notices, distribution conditions; separate from runtime and input rights | Training-data assurances, redistribution rights, conversion provenance and acceptable-use obligations where applicable. |
| Hardware designs | Existing manufacturer terms; consider an open hardware license for original shared designs only after review | Design rights, patents, certification/product liability, calibration/warranty responsibilities. |
| Cooperative membership | Optional services/governance/contribution agreement | Ratified entity, admission/exit, dues, noncash routes, votes, appeals, dispute venue, liability and termination. |
| Brand/certification/hosting | Separate trademark policy, truthful quality marks, explicit service/SLA contract | Mark ownership, inspection authority, appeals, provider obligations and remedies. Membership cannot imply certification of outcomes. |

Open publication can be inappropriate for sacred knowledge, identifiable observations or third-party information regardless of a contributor's enthusiasm. Membership must not assign community data or permit model training by implication. A contractual no-training promise has different enforceability and onward-sharing limits from an open copyright license. A public license cannot promise universal recall of already disclosed material.

### Option comparison

| Option | Reciprocity mechanism | Effects on participants | Assessment |
|---|---|---|---|
| Retain MIT + governed services/brand | Charge for hosting, support, curation, training, reliable gateways and legitimate certification services; community governance by separate agreement | Small commercial farms, cooperatives, installers and educators can use/modify code without revenue restrictions. Competitors can also use it. | **Recommended baseline.** Services must create value; restrictions alone do not create customers. |
| Suitable strong copyleft, e.g. AGPLv3 for defined future components | Source availability obligations for covered distribution/network modifications | Commercial use remains allowed; integrators and hosted modifiers incur compliance duties. May encourage contributions, may complicate proprietary integrations. | Plausible for defined components after rights/dependency/grant review. Not retroactive erasure of MIT permissions. |
| Weaker/file copyleft, e.g. MPL2 | Changes to covered files remain available on distribution | Easier mixed integration than strong copyleft; less network reciprocity | Comparison option if component boundaries justify it; weaker against closed hosted modifications. |
| Source-available / commercial / dual license | Contractual commercial restrictions or paid alternative permissions | Can burden small commercial farmers, coops, local installers and educators; ambiguity over revenue/use thresholds discourages adoption | Defer. Not OSI open source when it restricts users, fields or commercial use. Dual licensing requires sufficient copyright authority and compatibility. |

Sources W32 and inspected licenses R01/C01; legal conclusions are provisional. AGPL does not prohibit commercial farming, and charging for software/services is not itself non-open-source. Conversely, an ethical/commercial-use restriction does not become OSI-compatible because it pursues a beneficial purpose.

For a modified AGPL-covered program, section 13 requires an opportunity for remote network users to obtain Corresponding Source; distribution also has source/notice obligations. Permissive code can be incorporated into a compliant copyleft work, but an upstream AGPL component cannot simply be relabeled MIT. Whether a combined extension, shared library or server constitutes one covered work needs qualified analysis; calling it an API or putting it in a separate repository is not by itself a legal conclusion. File copyleft and strong network copyleft therefore solve different reciprocity problems. A paid alternative license is possible only for rights the licensor actually controls.

### Bounded authority audit and legal gates

The root MIT notice is evidence of the distributed permission, not proof that one entity controls every contribution. A bounded search did not establish a comprehensive CLA, copyright assignment or DCO chain. Git authorship alone does not transfer rights. Vendored sources retain their own licenses: the Solidity source scan found 17 `AGPL-3.0`, one `AGPL-3.0-only` and two `AGPL-3.0-or-later` headers, primarily Octant and a Gardens interface, alongside 145 MIT headers. This is not a package-lock/SBOM audit. R01.

Before any transition, counsel and maintainers should build a file/contributor/rightsholder ledger, verify employment/contractor agreements and explicit relicensing permissions, resolve upstream notices and licenses at pinned versions, and review actual signed grant/IP commitments. Inspect grant agreements, not just a backlog item's funding aspiration. No relevant binding grant terms were supplied here. Previously distributed MIT copies retain the permissions granted with them; a future change is not a recall mechanism. Treat potentially incompatible combinations or missing authority as a component boundary/rewrite/repermission question, not a reason to silently replace headers.

A second bounded check read installed package declarations: React 19.2.8 and viem 2.55.13 at root declare MIT; Shared's permissionless 0.2.57 and `@zerodev/sdk` 5.5.10 declare MIT; Dexie 4.4.6 declares Apache-2.0; Contracts' `@openzeppelin/contracts-upgradeable` 4.9.6 declares MIT. These declarations support a permissive core dependency sample, with notices retained. They do not establish complete transitive compatibility or correspondence of every installed artifact to the lockfile. Missing packages at a searched location were not treated as absent dependencies. The vendored AGPL and possible Coop reuse remain the material copyleft boundaries. No dependency was installed or changed.

A cooperative proposal needs fair entry/exit, graduated dues, accessible noncash contributions (translation, peer help, documentation, governance, local expertise), transparent valuation, conflict-of-interest rules, appeal to an independent panel and an export/transition period. Avoid trading membership for access to contributors' own records. Publish the service benefit bought by each fee. Preserve community decision authority when a sponsor pays. These are proposed requirements, not descriptions of adopted Regen Commons terms.

## 12. Cost assumptions

All figures below are **illustrative US dollars**, excluding taxes, travel, exchange-rate effects and major device replacement. No vendor quote or pilot cost measurement supports them. Existing compatible hardware has zero incremental purchase cost, not zero economic/energy/maintenance cost. Do not claim lower TCO than alternatives without a matched comparison.

TCO = hardware amortization + connectivity/model distribution + setup + ongoing hosting/gateway + maintenance + support + participant/reviewer time + recovery/exit. Separate the payer's cash expenditure from unpaid community labor.

| Proposed budget | Calculation | Amount |
|---|---|---:|
| Two-week prototype: engineering | 80 h × $75 | $6,000 |
| Research/design/review | 24 h × $75 | $1,800 |
| Community facilitation/language review | 20 h × $40 | $800 |
| Accessibility/security review | 12 h × $100 | $1,200 |
| Sandbox/connectivity allowance | Planning ceiling | $200 |
| Contingency | Unallocated ceiling | $2,000 |
| **Prototype cap** | Sum | **$12,000** |
| Eight-week, three-community pilot: product/support engineering | 160 h × $75 | $12,000 |
| Local facilitation | 3 × 40 h × $30 | $3,600 |
| Evaluation, translation, accessibility | Planning allowance | $3,000 |
| Security/legal/privacy review | Planning allowance | $3,000 |
| Hosting/connectivity/optional calibrated kit | 3 × $500; actual kit selection gated | $1,500 |
| Contingency | Unallocated ceiling | $6,900 |
| **Pilot cap, separate decision** | Sum | **$30,000** |

Illustrative ongoing community TCO range: $0–15/month hardware amortization, $0–20 connectivity, $0–15 private/public service allocation, $0–40 maintenance labor, $20–100 paid support, and 20 records/month × 2–10 minutes review × $10–30/hour = **$6.67–100 review labor**. These assumptions imply roughly **$26.67–290/month**, before setup and disruptions, not a price forecast. Setup could consume 4–12 operator hours plus training; validate rather than hide it in a free tier.

At 3 GB/model installation, 30 devices imply 90 GB initial delivery before retries and updates; arithmetic only, not a selected model artifact size. Local transfers may reduce repeated downloads but require integrity/licensing checks. Measure data cost locally. For energy, meter representative sessions or report battery observations with their limitations; do not convert guessed watts into savings. Optional native gateways add power, repairs and someone on call. Model review can cost more than inference.

Compare the same task in paper/spreadsheet + messaging, ODK/Kobo, farmOS and the proposed workspace. Include onboarding, data entry, correction, duplicate effort, waiting, export and support. A local-AI advantage must survive that full comparison. Costs in this package are organizational scenarios; no personal finances or personnel assessments are included.

## 13. Decision gates and Stage 1 conclusion

| Gate | Evidence needed | Blocks |
|---|---|---|
| G1 — usefulness/buyer | Community-owned question; baseline task/time; actual budget owner; consent to participate | Pilot commitment, market claims |
| G2 — data/AI | Synthetic prototype policy; RESR-79 approval before external real-data inference; local policy and model/license/runtime benchmark | Real-data processing and AI default |
| G3 — identity/publication | Human authority, exact preview, minimal Lexicon, authorized sandbox PDS/OAuth; no unconfirmed Certified scopes | Public AT interaction |
| G4 — protocol | Verified chain/ABI/schema/role/fee/retry behavior and user signing | Any transaction; export-only prototype can proceed after separate implementation authorization |
| G5 — sensor/method | Named device/recording, calibration/maintenance and source-quality criteria | Claims of real sensing or environmental outcomes |
| G6 — privacy/recovery | Canary leak tests, encrypted backup restore, removal/shared-device drills | Real community pilot |
| G7 — rights/governance | Dependency/contributor/grant audit; operative cooperative instruments; counsel review | License transition, membership or commercial restriction claims |
| G8 — economics/reciprocity | Paid experiment; measured reviewer/support cost; useful exchange in both directions | Scale and savings claims |

Carry forward Option A, a non-AI baseline, synthetic nursery recording, Green Goods export, an explicitly authorized minimal public AT record and second-workspace retrieval. Carry forward uncertainty about hardware, buyer demand, privacy implementation, operative cooperative terms and current deployment readiness. Defer mesh, new identity issuance, automated actuation, outcome certification, cross-community settlement and license change. Stage 1 review is recorded separately in [eval.md](eval.md).
