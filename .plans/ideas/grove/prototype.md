# Grove prototype: four parts, one loop

**Status:** proposed prototype scope; nothing built. **Updated:** 23 October 2026.
**Relation to the plan:** this narrows the [MVP architecture](spec.md) and the [implementation sequence](plan.todo.md) to the smallest build that shows Grove's four core parts working together. Where it departs from the architecture, the [decisions](#decisions) say so. The product gates in [eval.md](eval.md) stay as they are; the prototype has its own [demo checks](#demo-checks).

Grove is a browser extension that keeps a garden's living knowledge graph on the steward's own device. The prototype proves one loop: connect a garden, save a source, let a local model propose how it relates to the garden's work, resume that work after an interruption, review it, share one accepted piece with another garden, and let any browser agent ask the graph questions.

The four core parts and their one job each:

- **Gemma** is the intelligence: on-device proposals with exact quotes, never a cloud call.
- **KOI** is the exchange: a node identity per garden and signed, scoped knowledge objects between nodes.
- **Pi Durable** is the execution: investigations as checkpointed tasks that survive a closed tab.
- **WebMCP** is the interface: pages expose tools, agents call them, and Grove does both.

## What the prototype demonstrates

| Problem today | What the demo shows | Part that proves it |
|---|---|---|
| Useful research is read and lost. Nothing links a guide or a grant to the garden's Actions and Work | Save a page from the browser. The graph shows a suggested connection to a real Action, with the exact passage that supports it | Gemma, Grove memory |
| AI help arrives without provenance and without a person in charge | Every proposal carries a quote, a source revision and a model version. The steward accepts, rejects or corrects it. Acceptance never becomes protocol approval | Gemma plus validation in code |
| Long-running work in a browser is brittle. A closed tab loses progress or repeats it | Close the Grove tab during an investigation, reopen it, and the task continues from its last checkpoint with no duplicate edge | Pi Durable |
| Each garden learns alone. Sharing means sending files or giving up control | Vida Verde's node publishes one accepted connection. TAS's node receives it signed and labeled with its origin, and reviews it locally | KOI |
| Agents reach Green Goods by scraping screens or through one-off bridges | The public garden page exposes a snapshot tool. Grove exposes graph tools. One standard interface serves Grove, DevTools and any browser agent | WebMCP |

## The shape

```mermaid
flowchart LR
  subgraph Pages["Web pages"]
    GG["Green Goods public garden page<br/>WebMCP tool: garden snapshot"]
    SRC["Any research page<br/>Save to Grove"]
  end
  subgraph Ext["Grove extension, one browser profile"]
    BR["Bridge content script<br/>finds and runs page tools"]
    MEM[("Grove memory<br/>Dexie: sources, nodes, edges,<br/>changes, reviews, receipts")]
    PI["Pi Durable harness<br/>IndexedDbStorage<br/>grove.investigation task"]
    GEM["Gemma 4 E2B worker<br/>Transformers.js on WebGPU"]
    UI["Graph tab<br/>Sigma canvas, inspector, review<br/>WebMCP tools: grove_*"]
    KOI["KOI partial node<br/>keys, RIDs, signed bundles"]
  end
  PEER["Community KOI node<br/>koi-net, Python, runs locally"]
  AGENT["Any browser agent<br/>Tool Inspector, DevTools pane,<br/>a browser assistant"]
  GG -->|"executeTool"| BR
  SRC -->|"readable text"| BR
  BR --> MEM
  MEM -->|"keyed task"| PI
  PI -->|"bounded packet"| GEM
  GEM -->|"JSON proposals"| PI
  PI -->|"validated command, receipt"| MEM
  MEM <--> UI
  MEM <--> KOI
  KOI <-->|"poll, broadcast"| PEER
  AGENT -->|"executeTool"| UI
```

| Part | What we use | What we build |
|---|---|---|
| WebMCP | `document.modelContext` (Chrome 149 and later behind the origin trial, a flag for local work); the client's existing `packages/client/src/webmcp.ts` | One garden snapshot tool on the public garden route; a bridge content script on Green Goods origins; four `grove_*` tools on the graph tab |
| Gemma | Gemma 4 E2B instruction-tuned ONNX at q4f16; `@huggingface/transformers` (already pinned in `packages/agent`); WebGPU | A worker that loads once, takes a bounded packet and returns JSON; validation that drops anything that is not an exact quote or a known ID |
| Pi Durable | `@earendil-works/pi-durable` 1.4.0 with its `IndexedDbStorage` | One `grove.investigation` task with five phases; a Web Lock so one tab owns the harness; idempotent apply with receipts |
| KOI | koi-net 2.1.2 and rid-lib 3.3.0 (Python, MIT) as the community node; the KOI-net wire contracts | A TypeScript partial node: a P-256 key pair, RID forms (the node is `orn:koi-net.node:<name>+<hash>`), envelope signing, `/events/poll` and `/events/broadcast`, an inbox and an outbox |
| Grove memory and graph | Dexie (already in Shared); Sigma with Graphology | Six core tables (sources, nodes, edges, changes, reviews, receipts) plus the KOI inbox and outbox; an append-only change log with a seen cursor; a graph tab with an inspector |

Grove memory is not one of the four parts. It is the floor they stand on: what the garden knows, what changed, and who decided.

## The loop, step by step

1. **Connect.** The steward opens Vida Verde's public garden page. Grove's bridge sees the garden snapshot tool through `document.modelContext.getTools()` and offers **Connect this garden**. One click runs the tool. Garden, Actions and approved Work land in Grove memory with their chain, IDs and coverage. The graph tab opens on the garden overview.
2. **Save.** On the agroforestry guide, the steward clicks **Save to Grove**. The readable text is extracted on the page, hashed and stored as a source revision. The source node appears at once, labeled **Saved**.
3. **Investigate.** Saving admits a `grove.investigation` task in Pi, keyed by source hash and garden. Its phases are `prepare` (pick source chunks and the garden neighborhood), `infer` (Gemma, in the worker), `validate` (IDs, predicates, exact quotes), `apply` (one idempotent graph command, one receipt) and `ready`. The graph shows **Finding connections**, then at most three **Suggested** edges, each with its quote.
4. **Interrupt and resume.** Close the Grove tab during `infer`. Reopen it. The harness reopens its IndexedDB storage, finds the task mid-phase and reruns that phase from its checkpoint. If the tab died after `apply`, the stored receipt comes back and no second edge is written.
5. **Review.** In the inspector the steward accepts one connection, rejects one and corrects the third's target. Each decision is a new revision with actor and time. Acceptance is personal garden memory; it is not WorkApproval and it records no work. The steward adds one **Planned** trial. It is drawn as planned and stays planned. A **New since your last visit** strip lists what changed, computed from the change log and a seen cursor.
6. **Share.** The steward picks the accepted connection and previews the projection: source URL, quote, predicate, target Action ID, and nothing else. Grove signs it as a KOI bundle and broadcasts it to the community node. It stays **Pending** until the node confirms it stored that version.
7. **Receive.** In a second browser profile, TAS's Grove polls the community node, verifies signature, target and hash, and shows the object as **Suggested by another garden's node** with its origin. TAS reviews it like any other suggestion. A bundle addressed to a different node is rejected and logged.
8. **Ask.** With the Grove tab open, a browser agent (Chrome's Model Context Tool Inspector, the DevTools WebMCP pane, or a browser assistant where available) calls `grove_query_graph` with "what does this garden know about soil care?" and gets a structured answer: nodes, edges, sources and review states. No scraping and no special bridge.

Step 1 needs the public page and step 2 the page being saved. Steps 3 to 5 run with the browser offline once the model is cached. Steps 6 and 7 need the community node. Step 8 needs only the open tab.

## Code we will add

Keep each piece small enough to replace.

### Green Goods client and Shared

| File | Change |
|---|---|
| `packages/client/src/webmcp.ts` | Register on `document.modelContext` first, with `navigator.modelContext` as the fallback for older builds. Give `execute` the `(input, { signal })` shape. Register the garden tool only on `/gardens/:id`. Keep the public-only rule |
| `packages/client/src/views/Public/gardenSnapshotTool.ts` (new) | `green_goods_get_garden_snapshot`: garden identity, Actions, approved Work (id, title, Action, created and approved times) and provenance, from the readers the page already uses (the public garden detail hook and the public impact readers). `readOnlyHint: true`. No private data, no writes |
| `packages/shared/src/public-contracts/garden-snapshot.ts` (new) | `GardenSnapshotV1` type and Zod schema, exported through the existing `./public-contracts` entry. No new export subpath |
| `packages/client/src/__tests__/webmcp.test.ts` | Route gating, the `document` object first, schema shape, the partial-data flag |

### Grove extension: `packages/extension/` (new; WXT, React, TypeScript)

| Area | Files | Owns |
|---|---|---|
| Entrypoints | `entrypoints/background.ts`, `entrypoints/graph/index.html` and `main.tsx`, `entrypoints/greengoods.content.ts`, `entrypoints/capture.content.ts`, `entrypoints/gemma.worker.ts` | MV3 wiring, the graph tab, the WebMCP bridge on Green Goods origins, on-demand page capture, the model worker |
| `src/knowledge/` | `schema.ts`, `store.ts`, `commands.ts`, `query.ts`, `vocabulary.ts` | Dexie tables; `applyKnowledgeCommand` with receipts; "new since" queries; the allowed types and predicates with labels from the Shared ontology API |
| `src/execution/` | `harness.ts`, `investigation.task.ts`, `packet.ts`, `validate.ts` | The Pi harness over `IndexedDbStorage` behind a Web Lock; the five-phase task; packet building; proposal validation |
| `src/model/` | `gemma-client.ts`, `prompt.ts` | Worker protocol, load progress, cancellation, the JSON contract |
| `src/koi/` | `identity.ts`, `rid.ts`, `envelope.ts`, `bundle.ts`, `wire.ts`, `exchange.ts` | Keys in IndexedDB, RID forms, canonical hashing and signing, the five KOI-net endpoints, inbox and outbox |
| `src/webmcp/` | `bridge.ts`, `tools.ts` | Finding and executing page tools; Grove's own `grove_query_graph`, `grove_list_sources`, `grove_save_source`, `grove_review_connection`. The two read-only tools carry `readOnlyHint: true`; the two that change the graph do not, so an agent asks the person first |
| `src/graph/` | `GraphView.tsx`, `GraphCanvas.tsx`, `Inspector.tsx`, `ConnectionPanel.tsx`, `NewSinceStrip.tsx` | Sigma rendering, review, connection state, freshness |
| `fixtures/` | `vida-verde.json`, `tas.json`, `sources/` | Public-safe source manifests from the [first-spike contract](first-spike.md); synthetic negatives labeled as such |
| `peer/` (development only) | `pyproject.toml`, `community_node.py`, `README.md` | A koi-net full node configured as the community node. Outside the extension bundle, never shipped |

Rough size: 3,000 to 4,000 lines of TypeScript in the extension, under 300 in the client and Shared, under 100 of Python.

Rules: Shared never imports the extension. The extension consumes Shared through declared exports only. Pi and KOI types stay inside the extension. Every UI string goes through i18n. No new Shared export subpath. The garden tool never runs on an authenticated route.

### The data the parts pass around

| Object | Shape | Who writes it |
|---|---|---|
| Garden snapshot | garden (chain, address, name), Actions (uid, id, title, domain), approved Work (id, title, Action, created, approved), provenance (partial, unavailable sources, fetched at) | The public page's tool |
| Source revision | URL, title, content digest, readable text, captured at, source date when known | Capture |
| Investigation packet | at most eight source chunks, the garden's Actions and open questions, the allowed predicates, the model and vocabulary versions | `prepare` phase |
| Proposal | target ID, predicate, quote, one-sentence reason; at most three | Gemma, then `validate` |
| Knowledge command | command ID, payload digest, expected revisions, edges to add | `apply` phase, review, KOI intake |
| Shared projection | source URL and digest, quote, predicate, target Action ID, publisher node RID, signature | Share preview, then the outbox |

## Demo checks

| # | Check | Passes when |
|---|---|---|
| D1 | Connect | From the live public page, the tool returns a snapshot and the graph shows the garden's Actions and Work with chain and coverage. On any other route the tool answers `not_available` |
| D2 | Propose | On ten labeled Vida Verde packets, the real local model yields the labeled connection or a correct abstention on at least eight. No stored edge has an unknown ID, an unknown predicate or an inexact quote |
| D3 | Resume | Kill the tab during `infer`, during `validate`, after `apply` and before `ready`. After each reopen there is one task, one edge set and one receipt |
| D4 | Review | Accept, reject, correct and plan; reload offline; all four survive. The planned item never counts as work. The WorkApproval shown is the imported one |
| D5 | Exchange | Vida Verde shares one projection; the community node stores it; TAS receives and verifies it. A wrong-target or tampered bundle is rejected. Nothing unselected leaves the device |
| D6 | Ask | An external agent lists Grove's tools and gets a structured answer from `grove_query_graph` that matches what the graph shows |

Record with every run: browser build and flags, model artifact revision, Pi and koi-net versions, device, cold and warm load times, tokens per second. A fixture inference stub cannot pass D2. A mock page cannot pass D1.

## Decisions

| # | Decision | Why | Departs from the plan? |
|---|---|---|---|
| 1 | Connect through the public garden page's WebMCP tool, not an Admin Hub bridge | Public records are what the MVP imports anyway. The page already registers tools. No nonce, origin-locked relay or credential boundary to build | Yes: D5 and S7 move to the MVP |
| 2 | Use Pi Durable's own `IndexedDbStorage` | Shipped in 1.4.0 on 21 October 2026. Removes the P0 adapter and its conformance suite | Yes: P0 shrinks to a bundle and lifecycle check |
| 3 | The graph tab owns the harness; Gemma runs in a dedicated worker of that tab | Pi wants one owner. WebGPU runs in workers. Closing the tab pauses, reopening resumes. No service worker keepalive | No |
| 4 | Custom task phases, not a model tool loop | A 2B model is dependable at one bounded JSON step and not at planning. Validation in code keeps the trust story | No |
| 5 | The community node is a stock koi-net full node | Partial nodes cannot deliver to each other. The Python framework gives a full node in a few lines. Nothing to reimplement | No |
| 6 | Sigma with Graphology, no renderer benchmark | The hub's leading candidate. The prototype needs one working canvas, not a comparison | Narrows S0 |
| 7 | Freshness is "new since your last visit"; no time scrubber | A seen cursor over the change log is cheap and shows learning. As-of reconstruction waits for the MVP | Yes: S4 deferred |
| 8 | Two gardens are two browser profiles on one machine | Proves workspace isolation and a real exchange without multi-user sync | No |
| 9 | A short fixed vocabulary | Garden, Action, Work, Source, Question, Planned activity, Concept; predicates `informedBy`, `relevantTo`, `addresses`, `aboutConcept`; labels from the Shared ontology API | Narrows S2 |
| 10 | No Admin Hub digest | Agent access through the `grove_*` tools is the return path to show | Yes: S9 deferred |

## Honesty rules the prototype keeps

- Local acceptance is garden memory. It is never WorkApproval, community review or verified impact.
- A planned activity stays planned. Neither acceptance nor time completes it.
- A proposal whose quote is not an exact substring of the saved text is discarded.
- No cloud inference and no fallback. With the model unavailable the graph stays usable and manual links work.
- A KOI signature proves which node sent an object. It does not prove garden membership or truth.
- The garden tool exposes public data only. Grove's own tools expose this device's graph, only while its tab is open and only to the agent the person is driving.

## Build order

Five pull requests, each demoable on its own.

| PR | Builds | Exit | Hub checkpoints it covers |
|---|---|---|---|
| G0 Feasibility | A bare extension with a graph tab; the Gemma worker answers a fixed packet; the Pi harness runs a three-phase dummy task across a tab close | Timings and memory recorded; one valid proposal from synthetic text; the task resumes | S0, P0 |
| G1 Connect | The client tool and the `document.modelContext` fix; the bridge; memory tables; a graph of Garden, Actions and Work | D1 on the live public page | S1, S5, S7 as a tool; S2 and S3 narrowed |
| G2 Investigate | Capture, the investigation task, the Gemma step, validation, idempotent apply, the inspector, "new since" | D2, D3, D4 | S6, S8, P1, P2 |
| G3 Exchange | Node identity, the community node, share, receive, reject | D5 | K1; K2 narrowed |
| G4 Ask and demo | Grove's own tools, driven from the Tool Inspector and DevTools; the TAS run; a recorded demo | D6 and the whole loop on both gardens | The first-spike walkthrough, narrowed |

Each PR keeps the [plan's file budget](plan.todo.md): three or four implementation files per checkpoint, with its behavior test.

## Out of scope

Passive capture, Admin Hub integration, the time scrubber, export and import, a production community node, public KOI networks, Commons publishing, onchain writes, sensors, encryption at rest, a chat UI, a provider marketplace.

## Device and browser requirements

- A Chromium build that exposes `document.modelContext`: Chrome 149 or later with the origin trial token on the Green Goods origin, or the `enable-webmcp-testing` flag for local work. Edge 150 runs the same origin trial. Brave's support is experimental and lives in Leo; verify a build before promising a Brave demo.
- WebGPU with `shader-f16` and about 4 GB of GPU or shared memory for Gemma 4 E2B at q4f16. The first download is between 1.5 and 3 GB depending on the bundle, then cached in Cache Storage.
- Python 3.11 or later with `uv` for the community node, on the same machine or network, over HTTPS or an explicit loopback exception. No blanket certificate bypass.

## Risks

- Pi Durable is experimental and broke its API in three October releases; another storage change is already queued on its main branch. Pin one version and keep Pi types inside `src/execution`.
- WebMCP is an origin trial over a draft spec, and the client still registers on the older object name. Feature-detect, and keep the bridge to two calls: `getTools` and `executeTool`.
- Gemma's quality on real guides is unmeasured, so D2 may fail. A failed D2 keeps automatic proposals off and leaves the rest of the loop intact.
- koi-net signs the SHA-256 of its unsigned envelope's compact JSON, as Pydantic serializes it, with ECDSA on P-256 and SHA-256, and sends the raw `r||s` signature in base64. Matching those bytes from Web Crypto needs vectors exported from the Python node before any interoperability claim.
- Pi's Harness requires a `models` option. The prototype passes an empty model catalog because tasks call Gemma directly; G0 confirms that a Harness opens and runs custom tasks without a provider.
- The Shared ontology API ships from the Shared root. If bundling it pulls unrelated modules, add a narrow leaf export rather than deep-importing.
- The public garden page lists approved Work only. Pending Work and private notes never enter the prototype; the demo must not imply otherwise.

## Open questions

1. Is the public garden page the right first connection surface, or must the prototype demo include the Admin Hub?
2. Which browser carries the demo: Chrome with the flag, or a Brave build once it exposes `document.modelContext`?
3. Is TAS still the second garden for the exchange demo, or should both profiles run Vida Verde to keep one fixture?
4. Does the prototype count toward the Grove project's A0 to A4 milestones, or is it recorded as its own line?

## Sources

- WebMCP: [specification draft](https://webmachinelearning.github.io/webmcp/), [Chrome's imperative API page](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [Chrome's overview](https://developer.chrome.com/docs/ai/webmcp) (content scripts may query and execute tools; local flag), [implementation status](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md) (Chrome 149 origin trial, Edge 150, Brave experimental), [Google's example extension](https://github.com/GoogleChromeLabs/webmcp-extension).
- Pi Durable: [changelog](https://github.com/earendil-works/pi/blob/main/packages/durable/CHANGELOG.md) (1.4.0, `IndexedDbStorage`), [README](https://github.com/earendil-works/pi/tree/main/packages/durable) (one owner, Web Lock, custom tasks).
- KOI: [koi-net](https://github.com/DynamicalSystemsGroup/koi-net) (envelope, API paths), [rid-lib](https://github.com/DynamicalSystemsGroup/rid-lib), [KOI-net specification](https://dynamicalsystemsgroup.github.io/koi-net-spec/v1.0-draft-release.html).
- Gemma: [Transformers.js in a Chrome extension](https://huggingface.co/blog/transformersjs-chrome-extension) (Gemma 4 E2B, q4f16, WebGPU), [the ONNX model](https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX).
