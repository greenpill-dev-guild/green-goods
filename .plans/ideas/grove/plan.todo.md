# Grove: implementation sequence

**Status:** proposed; no implementation started. **Created:** 2026-10-11. **Updated:** 2026-10-23.
**Architecture and decision log:** [spec.md](spec.md).
**Acceptance gates:** [eval.md](eval.md).

Each unchecked step is a future independently verifiable checkpoint. Proposed new paths below are not existing APIs. Sequence the first slice before passive capture and larger resource discovery. Each step owns at most three or four implementation files; its focused behavior test is part of the checkpoint. Split a step again if the actual change exceeds that boundary.

## Before execution

Confirm the bounded build and dependencies, select the isolated implementation checkout without changing another session's branch, and resolve the Coop source revision/license. This planning request is not an instruction to install dependencies or start product code.

The [prototype specification](prototype.md) proposes a thinner first build, G0 to G4: it collapses S0 and P0, narrows S2 to S9 and K1 to K2 to one demo loop, and connects through a read-only WebMCP tool on the Admin Hub (S7's surface, with WebMCP as the transport), with a direct adapter on the Shared readers when WebMCP is unavailable. Read it before scoping A0. If it is accepted, G0 replaces A0 and the receipts each slice records count toward the checkpoints it names. On 24 October 2026 the prototype scope was agreed and G0 was authorized as a disposable spike in its own session (prototype decisions 11 to 17); this hub stays in ideas and is not promoted by it.

This is Grove's canonical idea-stage hub. The [Grove project](https://linear.app/green-goods/project/grove-garden-knowledge-8582c2970974) is connected to Community Evidence Mesh; RESR-103 remains parent-only tracking, and the five project milestones mirror the table below. Once product execution is explicitly accepted, promote this hub and update its lane statuses. Run `node scripts/harness/plan-hub.mjs linear-sync --feature grove --json` and follow its actual create/update/preserve instructions under the repository's implementation start gate. Do not create a second active plan for the same extension feature.

Review the [Mesh mapping](mesh-alignment.md) before defining S2 contracts. A0 can use synthetic fixtures to test runtime mechanics without claiming Mesh evidence conformance. A real evidence pilot still requires the initiative's applicable metric, authority, consent and correction gates; personal graph review cannot satisfy them.

Before committing to the graph composition, use the [Claude Code design exploration](handoffs/claude-design-exploration.md). Its reviewable prototypes do not mark an implementation checkpoint complete. Compare the same garden fixture in both renderer candidates during S0, including label/edge readability as well as performance.

## Delivery order

Use five implementation PRs after build authorization, followed by the broader MVP. The 18 checkpoints are split so no PR becomes an unbounded integration batch:

| PR | Checkpoints | Boundary proved |
|---|---|---|
| A0 — Runtime feasibility | S0, P0 | Actual local Gemma + graph and portable Pi browser execution/storage |
| A1 — Domain storage and commands | S1–S4, P1 | Scoped snapshots, history and idempotent command receipts |
| A2 — Graph and Hub | S5–S7 | Simple navigation, review UI and actual bounded garden imports |
| A3 — Durable local investigation | S8–S9, P2 | Pi task → real Gemma → graph mutation → review follow-up / local digest |
| A4 — KOI and both gardens | K1–K2 | Scoped exchange, loss recovery and full Vida Verde/TAS proof |

The existing labels remain stable. Each checkbox is a checkpoint group; its explicitly split sub-checkpoints remain independently committable and at most four implementation files. K1 may start after S2/S3/P1; K2 requires the full local path. Passive capture and broader portability remain Milestone B. A0 may use a disposable approved fixture; S1 integrates only the proven composition.

The [first spike](first-spike.md) is the acceptance scenario for Vida Verde and TAS. It uses two isolated workspaces and one active garden, public-source fixtures, one actual local model and one controlled full node. It includes Pi custom tasks with one runner owner, browser storage, command receipts and review continuation. It does not require general multi-user sync or a production hosting decision.

## Milestone A: the local garden loop

- [ ] **S0 — Prove runtime feasibility before feature build.** In a disposable approved extension fixture, evaluate one Gemma artifact in the packaged sandbox/offscreen arrangement and a Sigma graph in Brave. Record device, browser/runtime/model versions, cold/warm load, peak available memory evidence, completion, teardown and interrupted-job recovery. Test bundled code under the intended CSP. Use synthetic text. Exit: a reproducible local proposal with valid source IDs, or an explicit failed AI gate. Dependency/runtime choice is not finalized from source inspection alone.

- [ ] **P0 — Prove Pi browser execution and storage.** Follow [the execution contract](durable-execution.md). Split into (a) packaged portable-core/Chord bundle and single-owner host proof, (b) Dexie-backed Pi `Storage` plus its conformance tests, (c) reopen/termination and one prior-version migration fixture. Each is at most four files, with the adapter internal to Extension. Use a pinned compatible approved version set; source commit and release are distinct. Exit: storage conformance and Brave stop/reopen pass without Node shims, cloud fallback or competing Harness writers; serialized Pi state has references only. A failure blocks Pi product integration.

- [ ] **S1 — Create the extension's minimal composition.** New `packages/extension/package.json`, `wxt.config.ts`, `entrypoints/background.ts`, `entrypoints/graph/index.html`. Register build/test/source-structure coverage through existing owning configurations as a separate bounded follow-up if necessary. Follow root env, i18n and package rules; no broad capture permissions. Exit: an unpacked Brave extension opens one graph page and reloads without losing installation identity. The tiny spike does not become an unreviewed production manifest.

- [ ] **S2 — Define the shared contracts and fixture.** Proposed Shared files: `modules/garden-knowledge/contracts.ts`, `modules/garden-knowledge/ontology.ts`, a focused contract test and declared export update. Define GardenSnapshotV1, edge provenance, personal review vocabulary and the composed profile/pinned pack format from [ontology alignment](ontology-alignment.md). Preserve upstream IDs and independent protocol, Commons editorial and local review states; replace the earlier Source/Claim placeholders with explicit draft mappings. Split profile/schema mapping into its own bounded checkpoint if the file budget requires it. Prepare source-backed public fixture manifests for Vida Verde and TAS, plus separate synthetic mapper cases for Garden, Action, Work and WorkApproval when live records are unavailable. Define activity class and optional planned time separately from review; pin domain/profile and wire versions independently. Exit: reject unknown predicate/type mappings and preserve all four identities. Do not hand-edit generated ontology output.

- [ ] **S3 — Build durable revision storage.** Proposed Extension files: `knowledge/schema.ts`, `knowledge/store.ts`, `knowledge/store.test.ts`. Add transactions for source/entity/assertion revisions, changes, dispatch intent and prepared commands. Reserve scoped inbox/outbox and peer-state transactions for K1. Pi owns investigation scheduling; deterministic intake/delivery workers retain only their own leases. Expected-revision checks own review conflicts. Exit: duplicate ingestion is a no-op, failed transactions are invisible, and acknowledged revisions survive reopening.

- [ ] **S4 — Add temporal projection and query.** Proposed files: `knowledge/query.ts`, `knowledge/query.test.ts`, `knowledge/view-state.ts`. Implement as-known-at-sequence, compare sequences, two-hop selection, source/review/type filters and explicit seen cursor. Exit: late imports, new edges between old nodes, corrections and workspace filtering pass the temporal cases in E2/E3.

- [ ] **P1 — Add idempotent graph commands and dispatch.** Proposed `knowledge/commands.ts`, `knowledge/commands.test.ts`, `execution/dispatch.ts` and its admission test, split again if store integration exceeds four files. Atomically write graph revisions with command receipts, and source/review changes with dispatch intent. Bind stable run/command keys to workspace and input/payload digests. Atomically pair the Pi run-index key with `tx.createTask` in one Pi commit; custom-task admission must not invoke built-in model generation. Exit: crash after graph commit but before Pi checkpoint returns the same receipt; a different payload under that ID, stale revision, or erased source rejects; interrupted admission creates one run. Prerequisite: S2–S4 and P0.

- [ ] **S5 — Build graph canvas and subscription.** Proposed files: `graph/GraphCanvas.tsx`, `graph/renderer.ts`, Shared `hooks/knowledge/useKnowledgeProjection.ts`, a consumer test. Use a supplied projection subscription rather than a Shared import of Extension internals. Deterministic initial placement and saved coordinates precede force layout. Exit: committed changes patch the graph without resetting camera/selection; opening another tab sees the committed sequence.

- [ ] **S6 — Add graph controls and review inspector.** Proposed files: `graph/GraphView.tsx`, `graph/GraphControls.tsx`, `graph/GraphInspector.tsx`, focused interaction test. Wire the garden → Soil care/topic → source path and Back control, query/filter, timeline, evidence quote, independent planned/reported/recorded labels, review/correction and text results. Add required translations in a bounded accompanying checkpoint. Exit: keyboard user can inspect/review the same result as a pointer user; a stale review is rejected visibly.

- [ ] **S7 — Connect the Hub through a bounded snapshot.** Shared `modules/garden-knowledge/snapshot.ts` and its test own the mapping from existing readers; Shared `hooks/knowledge/useGardenKnowledgeBridge.ts` owns the React transport subscription. Extension `entrypoints/hub-bridge.content.ts` owns the restricted relay. Split Admin connect/open wiring into its own checkpoint in `views/Garden/components/` plus the existing garden composition. Exit: origin and garden-scope rejection tests pass; connected Hub transfers a bounded snapshot for each named garden, repeats safely, and reports partial coverage. Unavailable garden records remain an explicit integration blocker; do not fabricate them. S7 completes the real garden-data path, not merely a fixture import.

- [ ] **S8 — Capture, infer and review one source.** Split into two bounded checkpoints: (a) `runtime/capture.ts`, `knowledge/ingest.ts`, their behavior test; (b) `runtime/inference.ts`, offscreen entrypoint, packaged sandbox entrypoint and message-validation test. Adapt only the justified Coop code after source rights are resolved. The source commits before enrichment. Exit: the real local model produces bounded schema-valid candidates from the selected fixture packet; P2 owns Pi task integration and mutation recovery. Accept/correct creates history; reopening offline preserves it. A fixture inference stub cannot pass E4.

- [ ] **P2 — Run a durable local investigation and review continuation.** Proposed `execution/investigation.ts`, its interruption test, `execution/gemma-step.ts`, and a scoped progress projection; split UI wiring/erasure proof into a separate bounded checkpoint. Use custom phases and the existing Gemma bridge, not a built-in tool loop. Checkpoint references to prepared commands, apply through P1, and finish as ready for review. A human review dispatches a new keyed follow-up without a live wait. Exit: E13/E14 pass for source-save/admit, inference, prepared-result, graph-commit and Pi-checkpoint interruptions; one owner remains; erased source text never enters/restores through Pi records. Prerequisites: P0/P1, S6/S8.

- [ ] **S9 — Return reviewed insight to the Hub.** Shared digest contract/mapping, an Admin digest component and its consumer test, plus the existing bridge handler. Show only included accepted items, source references and graph links under the exact garden binding. Exit: an accepted item appears as **On this device**; rejected/raw/private items do not escape by default; disconnect stops exchange. No backend mutation is introduced.

**Local checkpoint:** connect → source capture → keyed Pi investigation → real proposal → idempotent graph command → graph review/follow-up → temporal comparison → offline resume → same-device Hub digest. P0–P2 are required for this selected architecture. This proves the local path, not the KOI spike.

## Milestone A4: KOI exchange and the complete spike

- [ ] **K1 — Prove the partial-node wire and durable intake.** Proposed Extension `koi/protocol.ts`, `koi/crypto.ts`, a cross-language conformance test and its public vectors; split subsequent HTTP/node-lifecycle integration and store changes into a separate bounded checkpoint. Use the pinned Python reference, native Web Crypto and scoped persisted inbox/outbox. Exit: TS/Python hashes and signatures agree; invalid signature/target/hash and unauthorized metadata/content reads are rejected; a valid duplicate produces one local revision. A reference peer's response is not itself an authorization check.

- [ ] **K2 — Reconcile a controlled peer and run both gardens.** First checkpoint: peer fixture collection inventory, durable fixture store and loss/restart tests; second: Extension reconciliation adapter and its test; third: graph connection/share preview wiring and integration proof. Each remains at most four files. Use the application inventory contract in [KOI integration](koi-integration.md); no invented core-protocol cursor. Exit: the [complete walkthrough](first-spike.md) passes for Vida Verde and TAS, including lost poll response, update/withdrawal, restart, explicit single-object sharing, offline operation and garden isolation. Record E9–E14 and retain any failed gates.

**First spike complete:** local checkpoint + controlled receive/share/recovery + both named gardens. The graph remains usable with the peer disconnected. No public network publication or production full-node service follows automatically.

## Milestone B: complete the bounded MVP

- [ ] **S10 — Add bounded research capture and commons resources.** Separate checkpoints for research-session permission policy/capture triggers, pinned resource-pack import/lookup, and user-selected text/Markdown notes through the existing source-ingestion contract. Add local keyword indexing when needed. Exit: enabled domains capture within the chosen session; denied domains and incognito do not; repeat navigation deduplicates; known resources connect through explicit versioned concepts; local notes stay excluded from Hub output unless individually included. This is curated sourcing, not autonomous web search.

- [ ] **S11 — Add portability and failure recovery.** `knowledge/transfer.ts`, transfer tests, job recovery handler and graph connection/settings state. Export/import a versioned local bundle, validate before applying, preserve source IDs/review history, and never include Hub grants or model caches. Pi execution storage and active task IDs are device-local and excluded from portable knowledge bundles; restored knowledge may create explicit fresh investigations through normal admission, without replaying prior sharing approvals. Handle quota failure, interrupted model work, unsupported WebGPU, upgrade/reload and delete-workspace cleanup. Exit: restore produces the same graph and does not generate false new-knowledge signals for identical records.

- [ ] **S12 — Run the integrated acceptance gates.** Complete E1–E14, choose/render the measured supported graph size, document failures and the manual fallback, inspect permissions/bundle contents, and run repository-selected verification. Keep a named authenticated Brave proof for Hub connection and the installed extension. Exit: the first slice and bounded passive behavior work at the declared scope; unresolved tests remain pending, never implicitly green.

## Requirement coverage

| User requirement | Owning steps | Done when |
|---|---|---|
| Ontology-grounded AI | S0, S2, S8, S10 | Valid candidate IDs/predicates and exact source provenance; commons draft status remains visible |
| Garden entity/relationship graph | S2–S7 | Canonical garden records appear with distinct domain identities |
| Living graph is the core interface | S5–S6 | Capture, query, inspection and review are available in one graph workspace |
| New nodes and edges are clear | S3–S6 | Separate edge changes and seen cursor survive restarts |
| Graph can be viewed over time | S3–S4, S6 | Before/after and late-import cases reconstruct correctly |
| Query and filter | S4, S6, S10 | Deterministic search/filter/path queries work without the model |
| Knowledge sourcing | S8, S10 | Consented capture and curated resources relate to garden work/questions |
| Internal feedback | S3, S6, S8 | Review/correction is versioned and guides later retrieval |
| Connect through Admin Hub | S7 | Bounded origin-checked snapshot exchange; no credential transfer |
| Insights in the Hub | S9 | Included local accepted items surface with graph links and device-local labeling |
| Durable local investigations | P0–P2, S8 | Pi storage conforms; actual Gemma run resumes through idempotent commands; review follow-up and source erasure remain safe |
| KOI as optional exchange foundation | K1–K2 | Cross-language wire proof, authorized scoped reads/writes and recovery after loss |
| Vida Verde and TAS with distinct projections | S2–S9, K2 | Both real-source flows work; planned work never becomes recorded by acceptance; no cross-garden leakage |
| Mostly passive operation | S10–S12 | Selected research scopes capture while enabled, with recoverable enrichment |

## Verification and change boundaries

Before each behavior change, select proof using `bun run check --plan -- --intent qa`; use `checkpoint` for the coherent cross-package milestone. Use Bun test wrappers and the actual package test entrypoints established in S1. Add RED/GREEN evidence for meaningful storage, temporal, ingestion, isolation and review behavior. Do not write tests merely to mirror a file layout.

Existing Shared exports or cross-package contracts require the owning package checks and repository quick verification selected by policy. Sensitive manifest, dependency, harness and configuration changes are explicit review items; no guard/debt-baseline bypass is allowed. No contract, indexer or Agent runtime changes are planned. Pi integration stays in Extension, with its types behind the execution boundary. No implementation lane is complete until actual browser/model/storage/command proof is recorded. The user authorized a planning branch and draft PR. Product implementation, merge, deployment and external product publication require their own scope.

Detailed receipts belong in the owning lane handoff with tested commit, UTC timestamp, exact commands and clean validated paths. Implementation lanes must not be marked passed on the basis of this planning artifact.
