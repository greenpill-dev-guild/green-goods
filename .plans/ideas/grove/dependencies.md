# Grove dependency map

**Updated:** 13 November 2026. [Community sharing](community-sharing.md) supersedes earlier graph-only scope. Existing G0 installed versions and limitations are in its [immutable report](reports/2026-10-24-g0-feasibility.md); entries below remain architectural choices, not installation approval.

## Community identity, encryption and device sharing

| Component | Role | Decision |
|---|---|---|
| Offline identifiers, signed community policy and per-device grants | Local author/member identity and controller succession | Required; exact DID method/credential format gated by C0. Separate from wallet, WebID and ATProto login. |
| Reviewed envelope/key-wrapping library plus Web Crypto | Vault unlock, authenticated encrypted revisions, recipient key distribution | Required C1 selection; compare EDV patterns and standard envelopes/HPKE. No handwritten crypto protocol or copied provider-derived content key. |
| Existing WebAuthn credential plus supported PRF/local recovery implementation | Optional local vault unlock; existing Kernel account remains a separate binding | [C0a/E24](collaboration-passkey-spike.md#pass-a-existing-passkey-offline-unlock-and-recovery) proves actual credential/RP reuse, offline unlock and recovery. No direct P-256-to-Ed25519 substitution, signature-derived key or automatic account migration. |
| Solid browser client and community-selected Pod | Preferred optional encrypted storage adapter | C1a/C3 and E18/E22 prove client encryption, MV3 auth, provider independence and local key custody. Server runs outside the extension; no Pod account needed for local/direct use. |
| EDV client/server | Research storage alternative | Retain the same two-device comparison criteria; no selected implementation, installed dependency or requirement alongside Solid. |
| Encrypted export/import and WebRTC | Offline fallback and direct active-device transfer | C2/C4. Authenticated pairing/signaling; explicit STUN/TURN and LAN-only proof. |
| Phone browser/PWA companion | Local capture/review independent of desktop availability | Candidate; exact support and trusted app/update boundary unproven. Not a universal mobile extension promise. |
| Yjs / y-indexeddb / encrypted authenticated adapter | Preferred optional concurrent draft convergence | C5/E20: encrypted updates, verified writers, audience/history isolation and recovery. Yjs IDs grant no identity or authority; stock server-readable y-websocket is insufficient. |
| Automerge Repo + Keyhive | Experimental research alternative to Yjs | [C5/E25](collaboration-passkey-spike.md#pass-b-yjs-versus-automerge--keyhive) retains synthetic comparison, upstream-gap and recovery proof. No production adoption or dual authoritative stores. |
| MLS implementation | Optional group key epochs for justified collaboration/membership churn | Evaluate against simpler per-resource recipient wrapping. Not required alongside it in the initial pilot. |
| Web Bluetooth | Optional consented BLE sensor input | Later device-specific spike; not general browser-to-browser mesh. |
| ATProto/Certified, Ethereum, KOI and IPFS/Filecoin adapters | Deliberate public identity/publication, selected knowledge exchange or archive | Individually scoped optional C6 outputs; no private identity/root-key dependency. |

[Sharing research](sharing-research.md) records sources and alternatives: W3C Linked Web Storage, EDVs, DIF DWNs, remoteStorage and Willow. None is an implicit dependency installation. Old graph/runtime choices below remain conditional on the actual feature slice.

**Status:** proposed choices, Green Goods/Coop inspected 11 October; KOI and Pi Durable revisions added 16 October 2026. No packages or model weights were installed. “Existing” means present in the inspected Green Goods manifests, not automatically available to a future extension bundle. New dependencies require task-specific approval and the repository's release-age gate before pinning.

See [identity/role contracts](identity-role-mapping.md) and [local-first candidates](local-first-options.md). Automerge/Keyhive, Loro, RxDB and Classic Jazz are research options, not selected or installed dependencies. Pi's [capture/review ownership](durable-execution.md#where-pi-belongs-in-capture--review--share) separates durable enrichment from saving and human authority.

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
| [Dexie](https://dexie.org/docs/Dexie/Dexie.transaction()) (`dexie`) / IndexedDB | Local source, entity and assertion revisions; dispatch and command receipts; atomic change batches | Existing Shared declaration `4.4.6`; Grove builds its own DB schema, history and replay |
| [Zod](https://zod.dev/) (`zod`) | Validate bridge input, imports, model proposals, exports and per-type schemas | Existing Shared declaration `^4.4.3`; use the repository's resolved compatible release |
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
| `@earendil-works/pi-durable` | Custom-task investigation phases, persisted control state and recovery in Extension | Selected architecture; new install requires approval/release-age checks and P0 browser proof. Research baseline 1.3.0 / commit `8efd314…`, not a claimed browser build |
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
