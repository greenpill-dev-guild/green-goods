# Grove dependency map

**Status:** proposed choices, inspected 11 October 2026. No packages or model weights were installed. “Existing” means present in the inspected Green Goods manifests, not automatically available to a future extension bundle. New dependencies require task-specific approval and the repository's release-age gate before pinning.

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
| [Dexie](https://dexie.org/docs/Dexie/Dexie.transaction()) (`dexie`) / IndexedDB | Local source, entity and assertion revisions; jobs; atomic change batches | Existing Shared declaration `4.4.6`; Grove builds its own DB schema, history and replay |
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
| OpenJev | Possible fast scoring of a fixed set of relevance/category candidates before richer extraction | Optional research candidate, exact intended repository unresolved; not a graph renderer and not required for the first slice |

Several independent projects use the name OpenJev. For example, [kw2828/OpenJev](https://github.com/kw2828/OpenJev) describes candidate scoring and a browser Qwen demo, while [zhihz/openjev](https://github.com/zhihz/openjev) is another local decision preview. Neither link is claimed to be the user's intended package.

If adopted later, a candidate scorer would sit after capture/normalization and before expensive enrichment: rules → candidate set → scorer → enrich or abstain. Compare it with rules and the already-loaded Gemma on labeled examples. Its relative score is not calibrated confidence or evidence; it cannot approve knowledge or write to the graph. A second model/server is justified only by measured quality or resource savings and a browser-compatible package. Do not conflate OpenJev with ONNX Runtime.

## Browser facilities and Green Goods integration

| Component | Role | Decision |
|---|---|---|
| MV3 service worker + `runtime` messaging | Short-lived coordinator and validated requests | Built-in browser APIs; persist jobs because the worker can suspend |
| Offscreen document + isolated sandbox | Model lifecycle independent of the open graph tab | Browser facilities plus code to build; packaged CSP/message proof required |
| WebGPU / WASM | Inference and renderer execution capabilities | Feature-detect and benchmark; WASM availability does not promise usable Gemma performance |
| Cache Storage / browser storage facilities | Model asset caching and small settings | Separate from graph revisions; inspect quotas and recovery; no cloud sync implied |
| Green Goods garden/work readers + new Hub bridge | Bounded public snapshots, garden binding and same-device digest | Reuse readers; build snapshot, origin checks and digest contract; credentials stay in Hub |
| Vitest, IndexedDB test substitute and existing browser tooling | Storage, mapping, lifecycle and UI proof | Reuse installed repository tooling; approve any missing test dependency; Brave for installed-extension proof |

No Neo4j server, LangChain, vector database, embedding model, CRDT, cloud inference service or autonomous crawler is required for this MVP. These are not implicit transitive features of “AI” or “knowledge graph.” Model downloads and public resource retrieval still require a network; already-cached local knowledge remains usable offline.
