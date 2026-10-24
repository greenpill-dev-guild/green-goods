# G0 feasibility: Grove's four parts on one machine

**Date:** 2026-10-24. **Scope:** the G0 row of the prototype build order in [`prototype.md`](https://github.com/greenpill-dev-guild/green-goods/blob/d7cd0a00f/.plans/ideas/grove/prototype.md) (on the `research/grove-prototype-spec` branch at that commit), authorized as a disposable spike by decision 17. **Code:** `packages/extension` on branch `research/grove-g0-feasibility`; the measurement rig is `packages/extension/g0/`, and every raw observation sheet it wrote stayed in the gitignored `g0/out/`. **Surface:** the prototype connects through the Admin Hub (decisions 18 to 21). The local test page in item 4 registers a tool shaped like the Hub's `green_goods_get_garden_snapshot`; nothing here touches `packages/client`.

Everything measured here used synthetic text. No real garden, person or source appears in the fixtures. This report is immutable; corrections go in a new dated report.

## Results at a glance

| # | Item | Result | Headline numbers |
|---|---|---|---|
| 1 | Bare MV3 extension with a Sigma graph tab | Pass | 50 nodes, 54 edges; Graphology build 2 ms; Sigma mount 487 ms; the extension id survived two reload paths and a browser restart |
| 2 | Gemma 4 E2B in a dedicated worker | Pass, with the generation cap raised once | First download 2.98 GB in 171 s; later session loads 16.5 s and 8.1 s; 642 prompt tokens prefilled in 5.7 to 6.2 s; 331 new tokens at 9.2 to 11.2 tokens per second; 3 of 3 accepted proposals per pass, every quote exact; peak 3.4 to 4.3 GiB of process memory over a 1.3 to 1.8 GiB baseline |
| 3 | Pi Durable three-phase task | Pass in Node and in the browser, on in-memory storage only | Harness opens with an empty model catalog; a crash after chunk 2 resumed at chunk 3 with no rework; a crash after `apply` replayed the receipt and left one effect. The tab-close proof on `IndexedDbStorage` did not run: the release-age gate held Pi at 1.3.0 |
| 4 | WebMCP content script in Brave Beta | Pass | An isolated-world content script sees `document.modelContext`, lists the page's tool and runs it (295 ms headless, 6 ms headed); the main world does the same; nothing is exposed without the flag |

[Failed gates](#failed-gates) lists every gate that failed with its measurement. [What G1 should know](#what-g1-should-know) is the hand-over.

## Observation sheet

### Machine, browser and flags

| Field | Value |
|---|---|
| Device | Apple M4, 10 cores, 24 GiB unified memory, macOS 27.0 (build 26A428), Darwin 27.0.0 |
| Browser | Brave Browser Beta 156.1.99.44 (Chromium 156.0.8078.25), `/Applications/Brave Browser Beta.app`; Brave's Leo is not involved |
| Launch | `--headless --user-data-dir=<scratch under packages/extension/g0/out/profiles/> --remote-debugging-port=0 --no-first-run --no-default-browser-check --enable-blink-features=WebMCP --load-extension=.output/chrome-mv3 --disable-extensions-except=<same> --disable-background-timer-throttling --disable-renderer-backgrounding --window-size=1200,800`; the port is read from `DevToolsActivePort`; `g0/cdp.mjs` drives the browser over CDP with Node's WebSocket; `--headed` drops `--headless` |
| Real profiles | Never opened. Every run used a profile directory the rig created under `g0/out/profiles/` |
| WebGPU | Adapter vendor `apple`, architecture `metal-3`, `shader-f16` present, `maxBufferSize` and `maxStorageBufferBindingSize` 4294967292 bytes; `chrome://gpu` reports WebGPU hardware accelerated in headless and headed runs. `navigator.gpu` is absent on a CDP-created `about:blank` target (not a secure context) and present on extension pages |
| WebGL | Hardware accelerated through ANGLE Metal in headless mode; Sigma renders, with one `GL_INVALID_OPERATION` warning about draw buffers on the first frame |
| Toolchain | Bun 1.4.2 for installs and package scripts; Node v24.20.0 (the shell's) ran the rig |
| Machine load | 1-minute load average 65 on 10 cores during the first model round (sibling sessions were running test suites) and 13 at the start of the second round. Both rounds are reported |

### Versions and the release-age gate

| Package | Installed | Note |
|---|---|---|
| `wxt` / `@wxt-dev/module-react` | 0.21.4 / 1.2.2 | Vite 8.2.4 through the root override; WXT's peer range accepts it |
| `sigma` / `graphology` / `graphology-types` | 4.0.3 / 0.26.0 / 0.24.8 | Sigma 4 no longer accepts the v3 settings in the plan sketches (`renderEdgeLabels`, `labelRenderedSizeThreshold`, `defaultEdgeType`, `labelFont`); defaults were used |
| `@huggingface/transformers` | 4.2.0 | The `packages/agent` pin. Bundles `onnxruntime-web` 1.26.0-dev.20260416-b7804b056c and selects its `asyncify` WebAssembly for WebGPU. Gemma 4 support arrived in 4.0.1; 4.3.0 lists a WebGPU KV-cache fix for Gemma 4 that this spike did not test |
| `@earendil-works/pi-durable` / `chord` / `pi-ai` | 1.3.0 / 1.3.0 / 1.3.0 | See the gate below; `pi-codemode` 1.3.0 and `pi-telemetry` 1.3.0 arrive transitively |

**Gate.** `bun install` with the three Pi packages pinned to 1.4.0, run at 2026-10-24T05:37Z, stopped with `No version matching "@earendil-works/pi-durable" found for specifier "1.4.0" (blocked by minimum-release-age: 259200 seconds)` and the same line for `chord` and `pi-ai`. The three were published on 2026-10-21 at 22:43:49Z (`pi-ai`), 22:44:09Z (`pi-durable`) and 22:44:25Z (`chord`): 54.9 hours before the install, against the 72-hour rule in `bunfig.toml`. They become eligible at 2026-10-24T22:44:26Z. Per the task rule, the newest allowed version, 1.3.0 (published 2026-10-15), was pinned. 1.3.0 ships `MemoryStorage`, JSONL and SQLite storages only; `IndexedDbStorage` arrived in 1.4.0.

The install added 199 lockfile entries (the Pi packages pull `openai`, `@anthropic-ai/sdk`, `@google/genai` and the AWS Bedrock SDK; WXT pulls its tooling) and re-resolved ten existing root entries within their declared ranges: `confbox` 0.1.8 to 0.2.4, `css-select` 5.2.2 to 7.0.0, `diff` 7.0.0 to 8.0.4, `filesize` 10.1.6 to 11.0.26, `http-proxy-agent` 7.0.2 to 9.1.0, `https-proxy-agent` 7.0.6 to 9.1.0, `mlly` 1.8.0 to 1.8.2, `nth-check` 2.1.1 to 3.0.1, `pkg-types` 1.3.1 to 2.3.1, `ufo` 1.6.2 to 1.6.4. Bun kept nested copies of the previous versions for their old consumers (`svgo/css-select@5.2.2`, `cheerio-select/css-select@5.2.2`, `mocha/diff@7.0.0`, `gaxios/https-proxy-agent@7.0.6`, `@chromatic-com/storybook/filesize@10.1.6`, `mlly/pkg-types@1.3.1`, `ofetch/ufo@1.6.2`, `unstorage/ufo@1.6.2` and the proxy-agent chains).

### Model artifact

| Field | Value |
|---|---|
| Repository | `onnx-community/gemma-4-E2B-it-ONNX`, revision `6f21c99d7e18237f8d2ce92aadfdbfeba877f63a` (last modified 2026-10-13T18:55:48Z) |
| Config | `model_type: gemma4`, architectures `Gemma4ForConditionalGeneration`; loaded through Transformers.js `AutoModelForCausalLM`, which maps `gemma4` to `Gemma4ForCausalLM` (text only: no vision or audio encoder was fetched) |
| Files fetched at `dtype: "q4f16"` | `onnx/decoder_model_merged_q4f16.onnx` (0.6 MB, sha256 `73c0f1fe04f9a3a048fb3319c0671b6cf0346bf33a3a8624c853bcffe01c24a4`) with `onnx/decoder_model_merged_q4f16.onnx_data` (1449.3 MB, sha256 `3b27245a7396cb7039a4e4118bd2a8aa35106bae381522edf7c4867b5f22bb10`); `onnx/embed_tokens_q4f16.onnx` (sha256 `d7ca53f6a169471b5699b2f57ee4c7aa2c73732b0152f3909e64b71384444825`) with `onnx/embed_tokens_q4f16.onnx_data` (1517.0 MB, sha256 `024b199e6358ed42970f807686add5f9430d7e254ca7ce22fc9c83f015b9c517`); `tokenizer.json` (18.5 MB, sha256 `47bd35616c7c782aaca6ccf48c75f3461d5877170984b8836b375107d0a9f566`); `config.json`, `generation_config.json`, `tokenizer_config.json`. The extension's Cache Storage held exactly these eight `resolve/main/...` URLs after the run |
| Download | 2.98 GB into the extension origin's Cache Storage (`transformers-cache`), reused by every later load, reload and browser restart |
| Runtime assets | The ONNX runtime's WebAssembly is copied into the build at `ort/` by a WXT `build:publicAssets` hook (about 100 MB across the asyncify, jsep, jspi and plain variants) and selected through `env.backends.onnx.wasm.wasmPaths`; MV3 pages cannot fetch it from the default CDN |

## Item 1: the extension and its graph tab

**Build.** `wxt build` produces `.output/chrome-mv3` in 1.3 to 2.5 s: a 991 kB graph chunk, a 518 kB model worker chunk, two content scripts (4.9 kB isolated, 1.9 kB main world), a 706-byte background worker and the runtime WebAssembly. The manifest declares `permissions: ["storage"]`, host permissions for the Hugging Face hub, `script-src 'self' 'wasm-unsafe-eval'`, `cross_origin_embedder_policy: credentialless` and `cross_origin_opener_policy: same-origin`; the page is cross-origin isolated, so `performance.measureUserAgentSpecificMemory()` works.

**Graph.** The synthetic garden has 50 nodes (1 garden, 6 actions, 24 work items, 6 sources, 7 concepts, 6 questions) and 54 edges (30 `partOf` plus 24 edges across the four predicates), placed on concentric rings. Graphology builds it in 1.7 to 2.7 ms; constructing Sigma, which draws the first frame synchronously, took 368 to 514 ms across five runs (487 ms in the recorded lifecycle run), and a scheduled refresh confirmed a frame about 10 ms later. No layout algorithm and no interaction were measured.

**Loads unpacked.** `--load-extension` works in Brave Beta 156 headless; the service worker target appears within a second and the extension id is `hiajmfbjjefjnicdgknlndphbdcbmifj`, derived from the output path.

**Reload and identity.** From one fresh profile, then a restart:

| Step | Worker | State | Id |
|---|---|---|---|
| `chrome.runtime.reload()` with developer mode off (a fresh profile's default) | absent | `DISABLED`, reason `unsupportedDeveloperExtension` | unchanged |
| Developer mode turned on through the extensions page's own API (`chrome.developerPrivate.updateProfileConfiguration`), then its Reload (`developerPrivate.reload`) | restarted | `ENABLED` | unchanged; graph tab ready |
| `chrome.runtime.reload()` with developer mode on | restarted | `ENABLED` | unchanged; graph tab ready |
| Browser quit and relaunched on the same profile | started | `ENABLED` | unchanged |

Chromium 156 treats both `--load-extension` (location `COMMAND_LINE`) and CDP `Extensions.loadUnpacked` (location `UNPACKED`) as developer extensions: a reload with developer mode off disables them, and a hand-written `extensions.ui.developer_mode` preference is reset by the browser's tracked-preference protection. Developer mode set through the page's API persists in the profile. The installation identity survived every path, and the model cache under that identity fed every later load.

## Item 2: Gemma 4 E2B in a dedicated worker

**Setup.** `src/model/gemma.worker.ts` is a module worker owned by the graph tab. It sets `env.allowLocalModels = false`, keeps the browser cache on, points `wasmPaths` at the extension's `ort/`, loads `AutoTokenizer` and `AutoModelForCausalLM` with `dtype: "q4f16"` and `device: "webgpu"`, builds the prompt with `apply_chat_template` (`add_generation_prompt`, `enable_thinking: false`) from `src/model/prompt.ts`, and generates greedily (`do_sample: false`) with a `TextStreamer` that timestamps the first token. The fixed packet (`src/model/packet.ts`) has four synthetic chunks (c3 is a distractor), ten allowed targets and the four predicates. `src/model/validate.ts` accepts a proposal only when its target id, predicate and chunk id are known and its quote is an exact substring of that chunk; it dedupes by target and predicate and caps the list at three.

**Two rounds.** Round 1 asked for pretty JSON with free-form reasons and capped generation at 320 new tokens; round 2 asked for compact one-line JSON with reasons of at most twelve words and a 448-token cap, and the validator learned to read the complete items of an array cut off at the cap.

| Round | Load average | Load (tokenizer + model session) | Prompt tokens | Prefill | New tokens | Decode | Accepted of proposed |
|---|---|---|---|---|---|---|---|
| 1, first download, pass 1 | 65 | 170,735 ms (9,819 + 160,916, including the 2.98 GB download) | 617 | 18,365 ms | 320 (cap) | 55,730 ms, 5.7 tok/s | 0: the array was cut mid-third item, see failed gates |
| 1, same session, pass 2 | 65 | - | 617 | 7,452 ms | 320 (cap) | 42,520 ms, 7.5 tok/s | 0, same output |
| 1, page reloaded, passes 1 and 2 | 65 | 18,230 ms | 617 | 8,647 and 7,071 ms | 320 (cap) | 6.6 and 7.0 tok/s | 0, same output |
| 2, first load of the session, pass 1 | 13 | 16,546 ms (712 + 15,834, from cache) | 642 | 5,838 ms | 331 | 35,725 ms, 9.2 tok/s | 3 of 4 |
| 2, same session, pass 2 | 13 | - | 642 | 6,185 ms | 331 | 32,154 ms, 10.3 tok/s | 3 of 4 |
| 2, page reloaded, pass 1 | 13 | 8,075 ms (611 + 7,464) | 642 | 5,733 ms | 331 | 29,572 ms, 11.2 tok/s | 3 of 4 |
| 2, page reloaded, pass 2 | 13 | - | 642 | 5,653 ms | 331 | 31,480 ms, 10.5 tok/s | 3 of 4 |

Tokens per second is decode throughput: new tokens after the first, divided by the time from first token to last. Prefill of 642 tokens in 5.7 s is about 110 prompt tokens per second. Greedy decoding gave byte-identical output across the four round-2 passes.

**What the model proposed (round 2, every pass).** Four items, all with quotes copied exactly from the chunks: `action:mulch-beds` `informedBy` c1 (the mulch depth passage), `question:mulch-depth` `addresses` c1 (the same passage), `concept:nitrogen-fixation` `informedBy` c2 (the Frankia passage) and `question:hedgerow-nitrogen` `addresses` c2 (the same passage). The validator accepted the first three and rejected the fourth as `more than 3 proposals`; it was the strongest candidate. The distractor chunk c3 was never cited, and no quote was rejected as inexact in any pass of either round: all 16 complete items of round 2 (four per pass) passed the exact-quote check before the cap applied, and the three complete items of each round-1 pass carried the same exact passages. The predicate choices are loose: `informedBy` where `relevantTo` fits better.

**Memory.** Process resident set sizes sampled with `ps` every 500 ms over the whole run (load, two passes) for the browser launched on the spike's profile, and the page's own measurement:

| Run | Baseline total RSS | Peak total RSS | Peak by process | `measureUserAgentSpecificMemory()` before load, after load, after generation |
|---|---|---|---|---|
| Round 1, first download | - | 4.18 GiB | - | 45 MB, 147 MB, 847 MB |
| Round 1, page reloaded | 1,172 MB | 3,295 MB | extension renderer 2,047 MB, GPU process 788 MB, browser 256 MB, utility 271 MB, other renderers 283 MB | 45 MB, 143 MB, 956 MB |
| Round 2, first load of the session | 1,793 MB | 3,500 MB | extension renderer 2,028 MB, GPU process 935 MB, browser 363 MB, utility 366 MB, other renderers 537 MB | 45 MB, 143 MB, 872 MB |
| Round 2, page reloaded | 1,290 MB | 4,282 MB | GPU process 2,269 MB, extension renderer 2,269 MB, browser 290 MB, utility 264 MB, other renderers 347 MB | 45 MB, 142 MB, 872 MB |

The model costs 2 to 3 GiB of resident memory over the browser's baseline, split between the extension's renderer and the GPU process on this unified-memory machine; the JavaScript heap stays under 15 MB. The 24 GiB machine was never under memory pressure.

## Item 3: Pi Durable

**Setup.** `src/execution/dummy-task.ts` defines `grove.g0.investigation` (version 1) with `defineTask`: `prepare` commits the `work` checkpoint; `work` processes one chunk per invocation, sleeps the configured delay, commits `{ nextChunk + 1, processed }` and only then reports the chunk; `apply` calls `EffectStore.applyEffectOnce(commandId)`, an IndexedDB transaction that writes an effect counter and a receipt together or returns the existing receipt, optionally holds until the invocation's signal aborts, then commits the terminal outcome with the receipt. `src/execution/harness.ts` registers the task with `createRegistry().install({ name, tasks })` and opens `Harness.open(storage, { models: createModels(), registry }, context)` with pi-ai's `createModels()` and no provider. The storage is injected behind the `Storage` interface; 1.3.0 offers `MemoryStorage`, which closes with the session, so a `RetainedMemoryStorage` subclass keeps its records through `close()` for the reopen tests.

**Harness without a model provider.** Opened and ran custom tasks in Node (Vitest) and in the graph tab, in every run. Bundling pi-ai into the extension raised no runtime error; its `createModels()` imports nothing Node-only on the path used.

**Node proofs** (`src/__tests__/dummy-task.test.ts`, 4 cases, about 20 s): prepare, work and apply complete with one effect; a simulated crash after two chunks (context cancelled, Harness closed) and a second Harness over the retained storage resumes at chunk 3 and completes without reprocessing; a crash while `apply` holds after its effect committed resumes with `replayedReceipt: true` and one effect; a second task with the same run id reuses the receipt.

**Browser proofs** (graph tab, headless, round 2):

| Demo | Harness A | Crash | Harness B over the same storage | Outcome |
|---|---|---|---|---|
| Resume mid-work (5 chunks, 400 ms each) | `prepare` at 8 ms; chunk 1 at 410 ms; chunk 2 at 811 ms; 1 live task | context cancelled and session closed after chunk 2 | chunk 3 at 1,242 ms, chunk 4, chunk 5 at 2,045 ms; `apply` effect at 2,048 ms (`replayed: false`, count 1); terminal at 2,049 ms | `completed`, `processed` lists all five chunks once, effect count 1 |
| Crash after `apply` | chunks 1 to 5; effect committed at 2,016 ms (count 1); `apply` held | cancelled and closed while held | `apply` reran at 2,034 ms and found the receipt (`replayed: true`, count 1); terminal at 2,035 ms | `completed`, `replayedReceipt: true`, effect count 1 |

**Not run.** Closing the graph tab mid-`work` and reopening it, and the crash after `apply` across a tab close, both need `IndexedDbStorage` (Pi 1.4.0) and were blocked by the release-age gate. The in-page reopen exercises Pi's reservation, checkpoint and resume path but not storage durability across a document.

**Contract notes measured on 1.3.0.** A phase reruns from its top after a crash, so work done before a commit that never landed is redone: when the chunk event fired before its commit, a crash in between produced a duplicate chunk in the log (the test caught it; the event now follows the commit). A wait inside a phase must observe `runtime.signal`, or `harness.close()` cannot join the invocation and hangs; the held `apply` phase rejects on abort for that reason. `runtime.memo` exists for durable per-task memos but was not needed because the receipt lives with the effect.

## Item 4: WebMCP in Brave Beta 156

**Setup.** A loopback static server (`g0/serve-page.mjs`) serves `g0/webmcp-page/index.html` on `http://127.0.0.1:<port>/`. The page registers one tool named `green_goods_get_garden_snapshot` with a description, a JSON Schema input (`includeWork: boolean`), `annotations: { readOnlyHint: true }` and `execute(input, { signal })` returning a JSON string of synthetic garden data. The extension's two content scripts match `http://127.0.0.1/*` and `http://localhost/*` at `document_idle`: `webmcp.content.ts` in the default isolated world and `webmcp-main.content.ts` with `world: "MAIN"`. Each polls `getTools()` until a `green_goods_` tool appears (up to 4 s), runs it through `executeTool(tool, { includeWork: true }, { signal })` and writes its result to a data attribute on `<html>` that the rig reads.

**With `--enable-blink-features=WebMCP`** (fresh profile `webmcp`; headless, then headed):

| World | `document.modelContext` | Methods on its prototype | `getTools()` | `executeTool()` | Time, headless | Time, headed |
|---|---|---|---|---|---|---|
| Page | object | `ontoolchange`, `ontoolactivated`, `ontoolcancel`, `executeTool`, `getTools`, `registerTool` | lists its own tool with `annotations { readOnlyHint: true, consequentialHint: false, untrustedContentHint: false, debugging: false }` | not called by the page | registration finished before the content scripts ran | same |
| Isolated-world content script | object | the same six | 1 tool: name, description, annotations, inputSchema | ok, JSON result | 295 ms | 6 ms |
| Main-world content script | object | the same six | the same tool | ok, JSON result | 298 ms | 9 ms |

The rig had all three results 367 ms after the headless page loaded. `provideContext`, `unregisterTool` and `clearContext` are not on the prototype in this build; registration is `registerTool`, and the Chrome documentation's `AbortSignal` option is the way to unregister. The isolated world sees the tools a page registered: no main-world injection is needed for the bridge.

**Control without the flag** (fresh profile `no-flag`, headless and headed): `document.modelContext` is `undefined` for the page, the isolated world and the main world; the page reports `document.modelContext is undefined` and registers nothing.

**Not run.** The visible-profile variant through `brave://flags/#enable-webmcp-testing`, which needs a person at the keyboard; the command-line flag is the documented equivalent and the headed run used it.

## Failed gates

| Gate | Measurement | Consequence |
|---|---|---|
| Release-age gate on `@earendil-works/pi-durable`, `chord`, `pi-ai` 1.4.0 | Published 2026-10-21T22:43:49Z to 22:44:25Z; 54.9 h old at the 2026-10-24T05:37Z install; the rule is 72 h (`minimumReleaseAge = 259200`) | Pinned 1.3.0. `IndexedDbStorage` is absent, so item 3's tab-close resume and its crash-after-apply across a tab close were not run; in-page reopen over retained memory storage stood in, labeled as such. Eligible from 2026-10-24T22:44:26Z |
| Round 1 generation cap (320 new tokens) | The pretty-printed array with long reasons needed more than 320 tokens; the output ended inside the third item's `reason`, and the parser found no closing bracket; 0 accepted in four passes although the three complete items had exact quotes and known ids | Round 2 asks for compact JSON and twelve-word reasons with a 448 cap (331 used), and the validator keeps the complete items of a truncated array. Both rounds are reported; only round 2 counts as the pass |
| Proposal cardinality | The model returned four items against an instruction of at most three in all four round-2 passes | Validation enforced the cap and dropped the best candidate; G2 should rank candidates rather than truncate them |
| Machine load during round 1 | 1-minute load average 65 on 10 cores | 5.7 to 7.5 tokens per second and 7 to 18 s prefills, against 9.2 to 11.2 and 5.7 to 6.2 s at load 13 in round 2 |
| Reload with developer mode off | `chrome.runtime.reload()` left the extension `DISABLED` (`unsupportedDeveloperExtension`) | Identity kept; developer mode on (or a browser relaunch) is required for the developer loop. Not a G0 failure, a G1 requirement |

Not measured at all: transformers 4.3.x against 4.2.0 (the KV-cache fix), model quality on real guides (D2 belongs to G2), a layout algorithm or interaction on the graph, and the Admin Hub origin itself.

## What G1 should know

- **The bridge can be an ordinary content script.** In Brave Beta 156 with the flag, the isolated world sees `document.modelContext` with `registerTool`, `getTools`, `executeTool` and the `toolchange` event, lists page tools with their annotations and runs them with `executeTool(tool, input, { signal })` (the tool object from `getTools()`, not a name). Match the Admin Hub's origins, feature-detect the object, and keep the no-WebMCP direct adapter at parity because nothing exists without the flag.
- **Gemma 4 E2B fits this machine and is usable, not fast.** One 2.98 GB download cached under the extension's origin; 8 to 17 s to open a session afterwards; about 110 prompt tokens per second and 9 to 11 generated tokens per second on transformers 4.2.0 with the asyncify runtime; 2 to 3 GiB of resident memory over baseline. A three-proposal packet of about 640 prompt tokens takes 35 to 42 s end to end. Budget 30 to 60 s for **Finding connections** per source, keep packets near 700 prompt tokens, cap generation near 450 tokens and demand compact JSON. Test 4.3.1 before pinning the extension's own version: it names a WebGPU KV-cache fix for Gemma 4 and a runtime upgrade.
- **Validation in code is doing real work.** Across both rounds every complete item the model produced carried an exact-substring quote (16 of 16 in round 2), it never cited the distractor, but it over-returned against the cap and picked loose predicates. Keep the exact-quote rule, add ranking before the cap, and consider a predicate glossary with one example each.
- **Pi 1.4.0 is one swap away.** The task code targets the `Storage` interface; after 2026-10-24T22:44:26Z install 1.4.0 and replace `createRetainedMemoryStorage()` in `src/execution/harness.ts` with `IndexedDbStorage.open(name)` under a Web Lock, then rerun `bun run --cwd packages/extension g0 -- --only pi` and add a tab-close step to the rig. The Harness opens and runs custom tasks with `createModels()` and no provider. Emit events after `runtime.commit`, make every wait observe `runtime.signal`, and expect a phase to rerun from its top after a crash.
- **Developer loop in Brave.** Headless rigs load with `--load-extension`; a person's profile needs Developer mode on in `brave://extensions` before Load unpacked, or the first `chrome.runtime.reload()` disables the extension (its id and cache survive either way). Right after a reload, an extension page can land on `chrome-error://` for a moment; navigate again.
- **Bundle hygiene.** The spike copies four ONNX runtime variants (about 100 MB); a real build ships only the asyncify pair (about 23.6 MB) or whichever the pinned runtime selects. `cross_origin_embedder_policy: credentialless`, `script-src 'self' 'wasm-unsafe-eval'` and Hugging Face downloads through `fetch` coexisted without trouble.
- **Probe WebGPU on an extension page.** A CDP-created `about:blank` reports no `navigator.gpu`; the extension origin does, headless included, with `shader-f16`.

## How to rerun

```bash
bun run --cwd packages/extension build
bun run --cwd packages/extension test
bun run --cwd packages/extension g0 -- --only lifecycle,webmcp,model,pi
```

The rig writes `g0/out/observations-<steps>-<timestamp>.json` and `g0/out/run.log`; `--fresh` wipes the persistent `main` profile and its 3 GB model cache; `--headed` opens visible windows on the same scratch profiles. The Node tests take about 25 s; the model step takes about four minutes on a cached model (two loads, four passes) and adds the download the first time.
