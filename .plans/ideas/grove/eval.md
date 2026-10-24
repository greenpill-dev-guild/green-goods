# Grove: acceptance and planning evidence

**Status:** product gates unrun. **Updated:** 2026-10-16.
**Scope:** [architecture](spec.md) and [implementation sequence](plan.todo.md).

## Product acceptance gates

These are proposed acceptance criteria, not observed performance or product receipts. Run Vida Verde and TAS as isolated workspaces on one desktop profile using source-backed public inputs; retain separately labeled synthetic negatives. The [spike](first-spike.md) selects the first-slice gates; E7 capacity and E8 broader passive/portability proof follow for the complete MVP. Record exact versions and dataset sizes with every result.

| Gate | Proof | Acceptance |
|---|---|---|
| E1 — Domain and provenance | Direct contract/mapper tests using Green Goods fixture plus pinned commons draft | Distinct Garden/Action/Work/WorkApproval identities; 100% stored model assertions have valid endpoint/predicate IDs and exact evidence references; unknown terms remain quarantined; Garden is not automatically Organization, Work is not CaseStudy, and local acceptance is not Commons publication or WorkApproval; historical views retain profile/mapping versions |
| E2 — Durable history | IndexedDB integration tests plus real-browser reload/interruption | No acknowledged save lost in the interruption set; duplicate retry changes neither graph size nor freshness; review expected-revision conflict is visible |
| E3 — Temporal correctness | Four deterministic histories | (a) Week-1 activity imported week 3 is absent in the week-2 knowledge view; (b) edge added between existing nodes is new; (c) proposed -> accepted -> corrected reconstructs each state; (d) failed/partial snapshot does not delete records or reset known approvals |
| E4 — Local model and useful links | Real model on 20 labeled source packets (10 per garden), including irrelevant sources, false identity matches and malicious instructions; report every failure | No stored invalid IDs or fabricated evidence spans; at least 16/20 packets yield the human-labeled relevant connection or correct abstention. Report schema failures separately. No remote inference fallback. A failed quality gate keeps automatic proposals off; it does not pass the AI slice. |
| E5 — Connection and disclosure | Hub/extension integration with wrong-origin, iframe, wrong-garden, replay, oversized, expired and disconnected messages | Reject unauthorized exchanges; repeated valid imports are idempotent; no signer/cookie transfer; digest contains only allowed included fields; other workspace records cannot affect results or counts |
| E6 — Visible graph behavior | Actual Brave extension; keyboard and pointer walkthrough | Garden overview → Soil care/topic → source → Back works without losing camera/filter/time. New nodes and edges, inspector evidence, filter/query, timeline and saved positions work. Empty, loading, failed-enrichment and unsupported-model states remain usable; text results are available within the graph workspace. |
| E7 — Declared capacity | Start at 500 nodes / 1,500 edges; exercise a 50-record delta and then 5,000 / 15,000 as a stress probe; run with model loaded and unloaded | Proposed supported-tier targets: warm graph open p95 <= 2 s; ordinary filter/query and committed-delta display p95 <= 250 ms over 20 runs. Record pan/zoom smoothness, available memory evidence and model contention. Stress size is not a support promise. Reduce visible neighborhood or supported bound if measured targets fail. |
| E8 — Passive capture and recovery | Research-session domain cases; disconnect, browser close/reopen, storage quota failure, model cancellation, bundle restore | No capture outside enabled scope; source save precedes model success; expired jobs resume without duplicates; export/restore preserves graph semantics; quota error never reports a successful save; revoked bindings remain revoked after restore |
| E9 — KOI wire and authorization | Pinned Python ↔ TypeScript vectors and controlled HTTP peer; malformed, invalid-signature, wrong-target, wrong-hash, unknown-publisher and unauthorized garden cases | Matching hashes/signature verification for Unicode, numeric and optional-field cases; await verification; reject unauthorized RID/manifest/bundle reads and outgoing projections before disclosure. Do not count node signature as membership or truth. |
| E10 — Scoped recovery | Drop poll response before local commit; duplicate, reordered update, peer/browser restart, interrupted outbound write, complete vs partial inventory, authorized withdrawal | No acknowledged local save lost, no duplicate revision/freshness; reconcile missed update and withdrawal through the scoped inventory; do not erase independent evidence. Verify peer stored the selected version before reporting shared. Denied/private data never enters the exported object. |
| E11 — Two gardens and projected work | Real bounded Vida Verde and TAS Hub imports plus the walkthrough in `first-spike.md` | Record source/chain/coverage; no substituted garden or fabricated Work. Queries, counts, model packets and Hub/peer output remain scoped. An accepted planned trial stays Planned; old reported activity is not backdated knowledge. Withdrawal and later correction remain inspectable without claiming ecological results. |
| E12 — Pi browser storage and lifecycle | Packaged Brave extension, upstream storage conformance cases applied to the new adapter, two graph clients, host kill/reopen, one supported prior-version migration | Atomic Pi batches and detached reads; IDs/keyed task admission survive reopening; one runner owner and one active investigation; no Node-only bundle path or unapproved executable fetch; reopening restores pending phase; no promise of work while browser is closed. Record exact compatible package versions and migration outcome. |
| E13 — Pi/graph effect recovery | Forced interruption after source save, admission, model step, prepared command, graph commit and Pi checkpoint; duplicate IDs and stale/erased input cases | No lost admitted intent, duplicate task or duplicate graph sequence; existing command receipt returns after graph-commit/checkpoint gap; changed payload under same ID rejects. Inference may rerun only before a prepared result exists. Human review admits one keyed follow-up; transport retry never broadens approved sharing. |
| E14 — Run scope, privacy and meaning | Both garden runs; inspect persisted Pi records/export/diagnostics; erase source during inference and resume; failed/quota-limited storage | No cross-workspace reads/writes or raw source text/spans in Pi state; removal invalidates tasks/prepared commands and late output cannot restore content. Errors never report successful save. Ready/completed run status does not convert Planned/Reported to recorded Work, and Pi sequences never replace garden timeline sequences. |

The local graph can function with the model unavailable, but this is a degradation mode. Completing the requested AI slice requires E4 and the real model step in E6. A mock-auth Hub or fixture-only snapshot is useful development proof; it cannot establish authenticated connection or live garden-reader compatibility.

## First-slice observation sheet

The [Mesh mapping](mesh-alignment.md) adds explicit cases for E1/E5/E11/E14: local acceptance is not community review or WorkApproval; ordinary articles need no fabricated metric; signatures and completed runs confer no evidence authority; pending inference cannot restore withdrawn content. These cases remain unrun with the other product gates.

- Browser/OS/device/RAM/GPU: pending.
- Extension version and artifact hash: pending.
- Model repository revision, tokenizer/runtime versions and artifact hashes: pending.
- Gardens: Vida Verde and TAS; live snapshot compatibility, configured chain, source coverage and capture manifests pending.
- Ontology/commons pack version and approval status: pending.
- Captured source URL/revision/digest: pending.
- Change sequences for import/capture/proposal/review: pending.
- Browser proof class: none for this plan; authenticated Brave required for the extension/Hub path under repository rules.
- Model response, recorded evidence quote, review and historical comparison: pending.
- Restart/retry/restore observations: pending.
- KOI peer/schema revision, node key fingerprint, conformance vectors and collection generation: pending.
- Lost-response reconciliation, withdrawal, outbound-object verification and garden-isolation proof: pending.
- Recorded/reported/planned classification and separate timeline clocks: pending.
- Pi/Durable/Chord build pins, adapter conformance, owner/host identity and migration proof: pending.
- Run/admission/command IDs, payload digests and graph-commit-before-checkpoint recovery: pending.
- Review follow-up, serialized-state privacy and erasure during inference: pending.
- Known limits and failed gates: pending measurement.

## Planning evidence

Source inspection on 11 October 2026 established existing Green Goods ontology queries, Garden/Work readers, partial-data semantics and Shared dependency versions. The existing public-impact response is bounded and summarized, so it is not treated as a complete graph API. Coop inspection established capture helpers, a document-hosted Gemma bridge, packaged ONNX handling and replacement-snapshot persistence. It did not establish that these run in Green Goods.

Coop source was read at remote `901f57871ec578b0a31bb38c1eacdd0a85eed83a`. The local checkout is a different revision, `5b889eea30056877f1e3a0114e0cd4353a36cee4`; its manifests declare AGPL-3.0-only. The remote root license lookup returned 404, so exact reuse rights remain unresolved. No source was copied into application code.

The earlier interactive example was a synthetic illustration. Its browser checks are not Sigma, Gemma, bridge, IndexedDB, authenticated Brave or production-extension proof.

## Design and source follow-up

On 11 October 2026, the linked Regen Coordination Knowledge Commons v0 draft was read through the Google Drive connector. It supports per-class schemas with shared versioned integration points; a ratified machine-readable pack and mapping approval remain unresolved. The new [alignment proposal](ontology-alignment.md) records this distinction.

Public Sigma and Cytoscape demo screenshots were captured in the Codex in-app Chromium browser and are included in [visual-design.md](visual-design.md). They are reference images with different data/viewport sizes, not Grove runtime, benchmark, authenticated Brave or installed-extension proof. The Claude Code prompt is prepared, not executed. The user subsequently clarified OpenJev / OJV. Its exact package identity remains unverified; the prior scorer assumption is withdrawn and no package was installed or tested.

## Planning PR validation

This hub is published separately from the earlier OS research. All implementation steps and product gates remain unrun. Validation of this planning PR covers hub structure, local links, formatting, scope and the repository-selected push checks. Current results are recorded in the draft PR; they do not establish runtime or model readiness.

No dependency was installed, no application source was changed and no implementation lane was marked complete. Grove runtime browser proof: none. Public-demo reference screenshots are labeled separately above. The 23 October follow-up also publishes [standalone interactive design source](artifacts/demos/README.md), with synthetic replacements for private-note-derived records. Static-demo browser proof is separate from all product gates.

## KOI planning revision

On 16 October 2026 this plan incorporated the prior source inspection of KOI, `rid-lib`, the Metagov TypeScript partial node, the RDF extension and Regen variants. [Pinned evidence and limitations](koi-integration.md#pinned-evidence-and-reuse-limits) distinguish protocol contracts from application work. No Python/TypeScript interoperability, signature rejection, peer durability or Brave extension test has run for Grove. Repository documentation checks do not satisfy E9–E11.

The scope now includes two isolated garden workspaces and optional controlled KOI exchange. The plan retains local-first storage/inference, provenance, private-note exclusion and explicit sharing. Product lanes remain todo/blocked exactly as before; this is a plan revision, not implementation completion.

## Pi Durable planning revision

On 16 October 2026 the user selected Pi Durable for local investigation execution. [The execution contract](durable-execution.md) records the pinned source, published-release distinction and unbuilt browser adapters. P0–P2 / E12–E14 add storage, lifecycle, command-receipt, review-continuation and privacy proof. They replace the investigation path's bespoke lease-based scheduler, while deterministic intake/delivery workers retain distinct ownership. No package was installed and no upstream or Grove runtime test was run for this plan revision. All implementation lanes remain pending.
