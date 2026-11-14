# Grove dependency map

**Updated:** 14 November 2026. [spec.md](spec.md#decision-log) owns the decisions cited here as D-numbers and R-numbers. Versions installed by the G0 spike are in its [immutable report](reports/2026-10-24-g0-feasibility.md). Entries below are architectural choices, not installation approval.

## Community identity, encryption and device sharing

| Component | Role | Standing |
|---|---|---|
| Device keys through Web Crypto | Sign what a device sends and open what is addressed to it | MVP. Sets the device floor; see the table below |
| Member list | Membership, devices, roles and controllers, as one signed history | MVP. Grove's own small format (R3): no maintained browser library provides it. No identifier scheme is selected (R2) |
| One multi-recipient file format | Encrypt each shared file under a fresh key, wrapped to recipient devices | MVP. C1 chooses between age v1 and HPKE (R1, O3). No handwritten cryptographic protocol |
| Existing WebAuthn credential with PRF | Unlock the vault where the provider supports it | MVP (D19), gated by [C0a](collaboration-passkey-spike.md#pass-a-existing-passkey-offline-unlock-and-recovery). Never the only wrap, never a device identity (R4) |
| Passphrase and recovery code | Unlock everywhere else; open a recovery export | MVP (D18, D19) |
| Encrypted file export and import | The carrier between devices | MVP (D21) |
| Phone web app | Capture, review and share on a phone | MVP (D2). Home open (O2); keys only when installed (R13) |
| Generic store interface, then a Solid client and a community-selected Pod | Asynchronous delivery of ciphertext | Next lane (D12, D21). Proved first with a plain folder; Solid is the preferred adapter. See [C1a](storage-comparison-spike.md) |
| EDV client and server | Research storage alternative | Research. No selected implementation |
| Yjs core | Merging when two people edit one draft | Later lane (D16, R9). Its stock persistence and WebRTC providers are replaced, not reused |
| Automerge Repo + Keyhive | Research alternative to Yjs | Backlog research (R11) |
| MLS implementation | Group keys with forward secrecy | Research, until live collaboration or frequent membership change justifies it |
| WebRTC | Live transfer between open devices | Research |
| Web Bluetooth | Consented sensor input | Later, device-specific. Not a mesh |
| ATProto/Certified, Ethereum, KOI and IPFS/Filecoin adapters | Attribution, protocol actions, exchange and archive | Later lanes, scoped one at a time. No private identity or key depends on them |

### Versions, maturity and licenses

Read by the security review on 13 November from package registries and project pages, except where a row says otherwise. This is a starting point for selection, not a pin: re-read each before installing, under the repository's approval and release-age gate.

| Technology | Version and date | Maturity | License | Gives Grove, and does not | Standing |
|---|---|---|---|---|---|
| WebAuthn PRF extension | WebAuthn Level 3 | Shipping, uneven by passkey provider | W3C | A per-credential secret for a local unlock key. Not a device identity or public-key decryption | MVP, gate C0a |
| Extension use of a site's relying-party ID | Chrome 122, Firefox 150 (verified 14 November) | Shipping | n/a | Lets the extension call an existing `greengoods.app` credential with host permission. The recorded origin is the extension's | MVP, gate C0a |
| Web Crypto Ed25519 and X25519 | Ed25519 in Chrome 137, Safari 17, Firefox 130. Stable X25519 versions not confirmed | Recent | n/a | Device keys that cannot be exported. Absent on older phones | MVP; sets the proposed floor of Chromium 137 and iOS 18.4 |
| age v1, `age-encryption` | 0.3.1; README read 14 November | Reference TypeScript implementation by the format's author. No audit stated | BSD-3-Clause | Many recipients, passphrase and passkey recipients, works with keys that cannot be exported. No sender authentication | Candidate A for C1 |
| HPKE, `hpke` and `@hpke/core` | 1.1.8 and 1.10.1; RFC 9180 | Maintained. No audit found | MIT | Wraps a key to a recipient with context binding, on P-256 or X25519. No file format | Candidate B for C1 |
| noble cryptography libraries | `@noble/curves` 2.3.0 | Audited | MIT | The primitives under candidate A | With candidate A |
| MLS, `ts-mls` | 1.6.2; RFC 9420 | Its README says unaudited | MIT | Group keys with forward secrecy. Not storage, governance or recovery | Research |
| `@localfirst/auth` | Archived 8 October 2026 (verified 14 November) | Unmaintained | MIT | A team signature chain and invitations | Pattern only |
| Dexie | 4.4.7 declared in Shared (verified 14 November) | Mature | Apache-2.0 | Local transactions and indexes. No encryption or sync | MVP |
| Yjs | 13.6.33 | Mature merge engine | MIT | Convergence. No encryption, identity or authorization | Later lane |
| `y-webrtc`, `y-indexeddb` | 10.3.0, 9.0.12 | Release dates not checked | MIT | A password that protects signalling only; plaintext persistence | Not used as they are |
| secsync | Beta | Unaudited | Apache-2.0 | Encrypted, signed snapshots and updates over a relay | Reference design if writer checks are needed |
| Solid Protocol, Community Solid Server, Inrupt browser auth | 0.11.0 (12 May 2024); 7.3.0; 5.0.3 | A Community Group report, "not a W3C Standard". The software is maintained | MIT for the software | HTTP storage, WebID and access rules. No end-to-end encryption | Next lane |
| Linked Web Storage | W3C Working Draft, 2026 | Draft | W3C | The standards path that grew from Solid | Watch |
| Encrypted Data Vaults | v0.2, which calls itself transitional | Draft | Specification | Encrypted documents and blinded indexes. Revocation unspecified | Research |
| Automerge Repo + Keyhive | 2.6.0-alpha.3; Keyhive pre-alpha | Experimental; its README warns against production use | MIT; Apache-2.0 | Document capabilities and group keys. Unaudited, no recovery | Backlog research |
| ATProto | Spaces alpha, August 2026 | Production for public data | n/a | Public attributable records and migration between hosts. No private end-to-end encryption | Later lane |
| Certified | Documentation read 13 November | An operated service | n/a | A PDS with email sign-in and delegated group writes. It holds the group's credentials | Later lane; never an identity root |
| Pi Durable | 1.5.2 on npm (10 November); 1.5.0 pinned by the spike (verified 14 November) | Experimental; the API changes between releases | MIT | Checkpointed tasks. No atomicity across two stores and no encryption | MVP, workspace lane (D14) |
| WebRTC | n/a | Mature | n/a | Live transport. Needs signalling and often a relay | Research |
| Web Bluetooth | n/a | Chromium only; absent on iOS | n/a | Sensor peripherals. No mesh | Later |
| IPFS through Pinata | In this repository | Production | n/a | Public pinning that cannot be recalled | Public outputs only, in a later lane |

Dexie's license was not in the review's notes and is stated from its repository; confirm it at selection with the others.

[Sharing research](sharing-research.md) records sources and alternatives: W3C Linked Web Storage, EDVs, DIF DWNs, remoteStorage and Willow. None is an implicit dependency. See [identity and roles](identity-role-mapping.md) and [local-first candidates](local-first-options.md); Loro, RxDB and Classic Jazz are research options, not selected or installed. Pi's [capture and review ownership](durable-execution.md#where-pi-belongs-in-capture--review--share) separates durable enrichment from saving and human authority.

The graph and runtime choices below were proposed on 11 October, with KOI and Pi Durable revisions on 16 October. They stand for the workspace lane; the KOI and Hub rows describe next lanes. "Existing" means present in the inspected Green Goods manifests, not automatically available to an extension bundle. New dependencies require task-specific approval and the repository's release-age gate before pinning.

## Platform and presentation

| Component | Role / where it runs | Decision |
|---|---|---|
| [WXT](https://wxt.dev/) + its React integration | Builds MV3 background, content, graph and offscreen entrypoints | New; preferred extension framework, informed by Coop |
| React + TypeScript | Graph controls, inspector, typed messages and adapters | Existing toolchain; reuse compatible repository versions |
| Green Goods Warm Earth tokens, Shared primitives, i18n and logger | Visual identity, accessible controls, translations and diagnostics | Existing; consume declared exports, inspect bundle cost |
| [Sigma](https://www.sigmajs.org/get-started/quickstart/) (`sigma`) | WebGL graph rendering in the graph tab | New; leading candidate. Current site documents v4; do not mix v3 snippets or extensions with v4 APIs |
| [Graphology](https://graphology.github.io/) (`graphology`) | In-memory typed multigraph for the visible temporal projection | New; Sigma companion, not the persistent database |
| [Cytoscape.js](https://js.cytoscape.org/) (`cytoscape`) | Alternative renderer plus graph querying/styling/layout ecosystem | Benchmark alternative, not a second shipped engine |
| `graphology-layout-forceatlas2` | Optional automatic node placement in a worker | Later; deterministic placement and saved coordinates first |

The renderer does not supply the timeline, permission logic, evidence inspector or Grove's visual identity. Those are Grove responsibilities. Choose one renderer using the [visual comparison and acceptance brief](visual-design.md).

## Persistence, contracts and search

| Component | Role / where it runs | Decision |
|---|---|---|
| [Dexie](https://dexie.org/docs/Dexie/Dexie.transaction()) (`dexie`) / IndexedDB | Local source, entity and assertion revisions; dispatch and command receipts; atomic change batches | Existing Shared declaration `4.4.7` on 14 November; Grove builds its own DB schema, history and replay |
| [Zod](https://zod.dev/) (`zod`) | Validate bridge input, imports, model proposals, exports and per-type schemas | Existing Shared declaration `^4.6.7` on 14 November; use the repository's resolved compatible release |
| [MiniSearch](https://lucaong.github.io/minisearch/) (`minisearch`) | Rebuildable local text index over eligible records | Conditional; exact-ID/label filtering works first; no vector DB needed for the slice |
| Green Goods ontology query API + pinned Commons draft + Grove profile | One allowed vocabulary and explicit cross-source mappings | Data/contracts to compose, not a new graph server or automatic reasoner |
| [SKOS](https://www.w3.org/TR/skos-reference/) / [PROV-O](https://www.w3.org/TR/prov-o/) conventions | Concept alignment and provenance semantics | Standards reused in the mapping contract, not mandatory runtime packages |

**Dexie stores the history; Graphology holds the view; Sigma draws it.** MiniSearch is disposable derived state. Schema validation checks shape and supported relationships; it cannot establish that a research conclusion is true.

## Capture and local intelligence

| Component | Role / where it runs | Decision |
|---|---|---|
| Bounded Coop capture adapter | Extract a permitted page snapshot; conservative deduplication | Adapt only after exact source license/compatibility check |
| [Mozilla Readability](https://github.com/mozilla/readability) (`@mozilla/readability`) | Optional readable article extraction from a DOM copy | Compare against Coop extractor; choose one path. Render stored text as text, not imported HTML |
| [Transformers.js](https://huggingface.co/blog/transformersjs-chrome-extension) (`@huggingface/transformers`) | Tokenization and local model execution API in isolated inference host | New; leading runtime candidate, based on Coop/Hugging Face pattern |
| [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) (`onnxruntime-web`) | Underlying WASM/WebGPU execution used by the selected runtime | Runtime dependency; pin compatible assets, avoid duplicate incompatible direct installs |
| [Gemma](https://ai.google.dev/gemma/docs/core) model artifact | Local relationship proposals, source quotes and contextual explanation | Model weights, not a JS library. Gemma E2B is the benchmark candidate; exact model revision, quantization, tokenizer, license and digests remain pending S0 |
| OpenJev / OJV | User-confirmed name in the visualization discussion | Exact repository/API remains unverified; not selected or required for the spike |

The earlier decision-scorer assumption is withdrawn. Do not install an unrelated package with the same name or add a Neo4j service to satisfy a guessed dependency.

## Durable execution

| Component | Role / where it runs | Decision |
|---|---|---|
| `@earendil-works/pi-durable` | Custom-task investigation phases, persisted control state and recovery in Extension | Selected architecture (D14). The G0 spike pins 1.5.0 and runs it on in-memory storage; P0's browser proof on persistent storage is owed. Research baseline 1.3.0 / commit `8efd314…`, not a claimed browser build |
| `@earendil-works/chord` | Pi's document/context/delta machinery | Required compatible Pi dependency; internal execution state, not garden federation or ontology authority |
| `@earendil-works/pi-ai` | Pi runtime dependency; optional future custom Gemma provider | Use compatible version set and narrow imports. First workflow calls the existing Gemma bridge from a task, without a new conversation/tool loop or cloud fallback |
| TypeBox | Pi's argument/runtime validation dependency | Transitive; Grove's domain contracts remain authoritative in their existing schemas, with explicit mapping if tools are later exposed |
| Grove Pi `Storage` over Dexie/IndexedDB | Browser execution persistence, IDs, scans, documents and atomic Pi batches | Superseded on 23 October 2026: Pi Durable 1.4.0 ships `IndexedDbStorage`, which the [prototype](prototype.md) uses; a Grove-built adapter is no longer planned |
| Grove knowledge commands + receipts | Idempotent graph mutations across Pi/knowledge commits | Build; source/profile/model preconditions, payload digest and stable operation ID |
| Pi Node SQLite / Cloudflare adapters | Potential later full-node scheduling | Deferred; no service is required for local execution. Node defaults do not imply power-loss guarantees |

The [execution contract](durable-execution.md) owns version evidence, lifecycle, scheduling and privacy. Do not import coding-agent tools, code mode, shell/file capabilities, subagent workflows or all provider catalogs into the Grove runtime. Inspect the actual transitive bundle and packaged code in P0; declaring a dependency does not establish its browser cost.

## KOI interoperability and optional service

| Component | Role / where it runs | Decision |
|---|---|---|
| KOI protocol schemas + a small TypeScript adapter | RID/manifests/bundles, signed exchange and partial-node lifecycle in Extension | Build; pin wire fixtures and prove against the Python reference before claiming interoperability |
| Native Web Crypto | P-256/SHA-256, raw signatures and key encoding | Built-in; independent local node keys, never wallet keys |
| RFC 8785 canonical JSON implementation | Deterministic content hashes | Select/pin an audited browser-compatible implementation or narrowly verified adaptation; distinct from envelope serialization |
| `koi-net` 2.1.2 + `rid-lib` 3.3.0 reference revisions | Controlled Python full-node fixture and cross-language oracle | Optional runtime outside browser; baseline versions, not approved installs |
| Metagov KOI Obsidian plugin | TypeScript partial-node design reference | Adapt only inspected pieces; replace host-specific APIs and verify async crypto correctly |
| Grove collection inventory + durable peer fixture store | Recovery after missed events, explicit withdrawals and outgoing-object verification | Build application contract; not a base KOI cursor/ack guarantee |
| `koi-net-graph-extension`, RDFLib / pySHACL | Optional named-graph projection/validation at a future full node | Deferred; no Python/RDF engine or Neo4j required in the extension |

Exact commits, licenses, reference limitations and [reuse decisions](koi-integration.md#pinned-evidence-and-reuse-limits) govern this list. Dexie owns local inbox/outbox and history; the optional peer never becomes a prerequisite for local graph use. The first spike selects one controlled peer, not the Regen processor's entire service stack.

## Browser facilities and Green Goods integration

| Component | Role | Decision |
|---|---|---|
| MV3 service worker + `runtime` messaging | Short-lived coordinator and validated requests | Built-in browser APIs; persist capture/dispatch intent, reopen/resume the single runner at supported wake points |
| Offscreen document + isolated sandbox | Isolated model lifecycle; any background runner host requires its own valid browser reason | Browser facilities plus code to build; packaged CSP/message proof required |
| WebGPU / WASM | Inference and renderer execution capabilities | Feature-detect and benchmark; WASM availability does not promise usable Gemma performance |
| Cache Storage / browser storage facilities | Model asset caching and small settings | Separate from graph revisions; inspect quotas and recovery; no cloud sync implied |
| Green Goods garden/work readers + new Hub bridge | Bounded public snapshots, garden binding and same-device digest | Reuse readers; build snapshot, origin checks and digest contract; credentials stay in Hub |
| Vitest, IndexedDB test substitute and existing browser tooling | Storage, mapping, lifecycle and UI proof | Reuse installed repository tooling; approve any missing test dependency; Brave for installed-extension proof |

No Neo4j server, LangChain, vector database, embedding model, CRDT, cloud inference service or autonomous crawler is required for this MVP. These are not implicit transitive features of “AI” or “knowledge graph.” Model downloads and public resource retrieval still require a network; already-cached local knowledge remains usable offline.
