# Grove: implementation sequence

**Status:** proposed; no implementation started. **Created / updated:** 2026-10-11.
**Architecture and decision log:** [spec.md](spec.md).
**Acceptance gates:** [eval.md](eval.md).

Each unchecked step is a future independently verifiable checkpoint. Proposed new paths below are not existing APIs. Sequence the first slice before passive capture and larger resource discovery. Each step owns at most three or four implementation files; its focused behavior test is part of the checkpoint. Split a step again if the actual change exceeds that boundary.

## Before execution

Confirm the bounded build and dependencies, select the isolated implementation checkout without changing another session's branch, and resolve the Coop source revision/license. This planning request is not an instruction to install dependencies or start product code.

This is Grove's canonical idea-stage hub. Once product execution is explicitly accepted, promote this hub and update its lane statuses. Run `node scripts/harness/plan-hub.mjs linear-sync --feature grove --json` and follow its actual create/update/preserve instructions under the repository's implementation start gate. Do not create a second active plan for the same extension feature. No Linear change is part of this planning PR.

Before committing to the graph composition, use the [Claude Code design exploration](handoffs/claude-design-exploration.md). Its reviewable prototypes do not mark an implementation checkpoint complete. Compare the same garden fixture in both renderer candidates during S0, including label/edge readability as well as performance.

## Milestone A: one real capture-to-graph loop

- [ ] **S0 — Prove runtime feasibility before feature build.** In a disposable approved extension fixture, evaluate one Gemma artifact in the packaged sandbox/offscreen arrangement and a Sigma graph in Brave. Record device, browser/runtime/model versions, cold/warm load, peak available memory evidence, completion, teardown and interrupted-job recovery. Test bundled code under the intended CSP. Use synthetic text. Exit: a reproducible local proposal with valid source IDs, or an explicit failed AI gate. Dependency/runtime choice is not finalized from source inspection alone.

- [ ] **S1 — Create the extension's minimal composition.** New `packages/extension/package.json`, `wxt.config.ts`, `entrypoints/background.ts`, `entrypoints/graph/index.html`. Register build/test/source-structure coverage through existing owning configurations as a separate bounded follow-up if necessary. Follow root env, i18n and package rules; no broad capture permissions. Exit: an unpacked Brave extension opens one graph page and reloads without losing installation identity. The tiny spike does not become an unreviewed production manifest.

- [ ] **S2 — Define the shared contracts and fixture.** Proposed Shared files: `modules/garden-knowledge/contracts.ts`, `modules/garden-knowledge/ontology.ts`, a focused contract test and declared export update. Define GardenSnapshotV1, edge provenance, personal review vocabulary and the composed profile/pinned pack format from [ontology alignment](ontology-alignment.md). Preserve upstream IDs and independent protocol, Commons editorial and local review states; replace the earlier Source/Claim placeholders with explicit draft mappings. Split profile/schema mapping into its own bounded checkpoint if the file budget requires it. Fixture has Garden, Action, Work and WorkApproval with distinct IDs. Exit: reject unknown predicate/type mappings and preserve all four identities. Do not hand-edit generated ontology output.

- [ ] **S3 — Build durable revision storage.** Proposed Extension files: `knowledge/schema.ts`, `knowledge/store.ts`, `knowledge/store.test.ts`. Add transactions for source/entity/assertion revisions, changes and idempotent jobs; expected-revision checks own review conflicts. Exit: duplicate ingestion is a no-op, failed transactions are invisible, and acknowledged revisions survive reopening.

- [ ] **S4 — Add temporal projection and query.** Proposed files: `knowledge/query.ts`, `knowledge/query.test.ts`, `knowledge/view-state.ts`. Implement as-known-at-sequence, compare sequences, two-hop selection, source/review/type filters and explicit seen cursor. Exit: late imports, new edges between old nodes, corrections and workspace filtering pass the temporal cases in E2/E3.

- [ ] **S5 — Build graph canvas and subscription.** Proposed files: `graph/GraphCanvas.tsx`, `graph/renderer.ts`, Shared `hooks/knowledge/useKnowledgeProjection.ts`, a consumer test. Use a supplied projection subscription rather than a Shared import of Extension internals. Deterministic initial placement and saved coordinates precede force layout. Exit: committed changes patch the graph without resetting camera/selection; opening another tab sees the committed sequence.

- [ ] **S6 — Add graph controls and review inspector.** Proposed files: `graph/GraphView.tsx`, `graph/GraphControls.tsx`, `graph/GraphInspector.tsx`, focused interaction test. Wire query, filters, timeline, evidence quote, proposed/accepted/rejected state, correction and text results. Add required translations in a bounded accompanying checkpoint. Exit: keyboard user can inspect/review the same result as a pointer user; a stale review is rejected visibly.

- [ ] **S7 — Connect the Hub through a bounded snapshot.** Shared `modules/garden-knowledge/snapshot.ts` and its test own the mapping from existing readers; Shared `hooks/knowledge/useGardenKnowledgeBridge.ts` owns the React transport subscription. Extension `entrypoints/hub-bridge.content.ts` owns the restricted relay. Split Admin connect/open wiring into its own checkpoint in `views/Garden/components/` plus the existing garden composition. Exit: origin and garden-scope rejection tests pass; connected Hub transfers one bounded snapshot, repeats safely, and reports partial coverage. S7 completes the real garden-data path, not merely a fixture import.

- [ ] **S8 — Capture, infer and review one source.** Split into two bounded checkpoints: (a) `runtime/capture.ts`, `knowledge/ingest.ts`, their behavior test; (b) `runtime/inference.ts`, offscreen entrypoint, packaged sandbox entrypoint and message-validation test. Adapt only the justified Coop code after source rights are resolved. The source commits before enrichment. Exit: real local inference creates a validated, evidenced proposal in the graph; accept/correct creates history; reopening offline preserves it. A fixture inference stub cannot pass E4.

- [ ] **S9 — Return reviewed insight to the Hub.** Shared digest contract/mapping, an Admin digest component and its consumer test, plus the existing bridge handler. Show only included accepted items, source references and graph links under the exact garden binding. Exit: an accepted item appears as **On this device**; rejected/raw/private items do not escape by default; disconnect stops exchange. No backend mutation is introduced.

**Milestone A demonstration:** connect -> source capture -> real proposal -> graph review -> temporal comparison -> offline reopen -> same-device Hub digest. A useful graph-only checkpoint exists after S8, but the full first slice includes S9.

## Milestone B: complete the bounded MVP

- [ ] **S10 — Add bounded research capture and commons resources.** Separate checkpoints for research-session permission policy/capture triggers, pinned resource-pack import/lookup, and user-selected text/Markdown notes through the existing source-ingestion contract. Add local keyword indexing when needed. Exit: enabled domains capture within the chosen session; denied domains and incognito do not; repeat navigation deduplicates; known resources connect through explicit versioned concepts; local notes stay excluded from Hub output unless individually included. This is curated sourcing, not autonomous web search.

- [ ] **S11 — Add portability and failure recovery.** `knowledge/transfer.ts`, transfer tests, job recovery handler and graph connection/settings state. Export/import a versioned local bundle, validate before applying, preserve source IDs/review history, and never include Hub grants or model caches. Handle quota failure, interrupted model work, unsupported WebGPU, upgrade/reload and delete-workspace cleanup. Exit: restore produces the same graph and does not generate false new-knowledge signals for identical records.

- [ ] **S12 — Run the integrated acceptance gates.** Complete E1–E8, choose/render the measured supported graph size, document failures and the manual fallback, inspect permissions/bundle contents, and run repository-selected verification. Keep a named authenticated Brave proof for Hub connection and the installed extension. Exit: the first slice and bounded passive behavior work at the declared scope; unresolved tests remain pending, never implicitly green.

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
| Mostly passive operation | S10–S12 | Selected research scopes capture while enabled, with recoverable enrichment |

## Verification and change boundaries

Before each behavior change, select proof using `bun run check --plan -- --intent qa`; use `checkpoint` for the coherent cross-package milestone. Use Bun test wrappers and the actual package test entrypoints established in S1. Add RED/GREEN evidence for meaningful storage, temporal, ingestion, isolation and review behavior. Do not write tests merely to mirror a file layout.

Existing Shared exports or cross-package contracts require the owning package checks and repository quick verification selected by policy. Sensitive manifest, dependency, harness and configuration changes are explicit review items; no guard/debt-baseline bypass is allowed. No contract, indexer or Agent runtime changes are planned. The user authorized a planning branch and draft PR. Product implementation, merge, deployment and external product publication require their own scope.

Detailed receipts belong in the owning lane handoff with tested commit, UTC timestamp, exact commands and clean validated paths. Implementation lanes must not be marked passed on the basis of this planning artifact.
