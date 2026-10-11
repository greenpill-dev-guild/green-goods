# Grove: acceptance and planning evidence

**Status:** product gates unrun. **Updated:** 2026-10-11.
**Scope:** [architecture](spec.md) and [implementation sequence](plan.todo.md).

## Product acceptance gates

These are proposed acceptance criteria, not observed performance or product receipts. Begin with one garden, one desktop profile and synthetic/public inputs. Record exact versions and dataset sizes with every result.

| Gate | Proof | Acceptance |
|---|---|---|
| E1 — Domain and provenance | Direct contract/mapper tests using Green Goods fixture plus pinned commons draft | Distinct Garden/Action/Work/WorkApproval identities; 100% stored model assertions have valid endpoint/predicate IDs and exact evidence references; unknown terms remain quarantined; Garden is not automatically Organization, Work is not CaseStudy, and local acceptance is not Commons publication or WorkApproval; historical views retain profile/mapping versions |
| E2 — Durable history | IndexedDB integration tests plus real-browser reload/interruption | No acknowledged save lost in the interruption set; duplicate retry changes neither graph size nor freshness; review expected-revision conflict is visible |
| E3 — Temporal correctness | Four deterministic histories | (a) Week-1 activity imported week 3 is absent in the week-2 knowledge view; (b) edge added between existing nodes is new; (c) proposed -> accepted -> corrected reconstructs each state; (d) failed/partial snapshot does not delete records or reset known approvals |
| E4 — Local model and useful links | Real model on 20 labeled source packets, including irrelevant sources, false identity matches and malicious instructions; report every failure | No stored invalid IDs or fabricated evidence spans; at least 16/20 packets yield the human-labeled relevant connection or correct abstention. Report schema failures separately. No remote inference fallback. A failed quality gate keeps automatic proposals off; it does not pass the AI slice. |
| E5 — Connection and disclosure | Hub/extension integration with wrong-origin, iframe, wrong-garden, replay, oversized, expired and disconnected messages | Reject unauthorized exchanges; repeated valid imports are idempotent; no signer/cookie transfer; digest contains only allowed included fields; other workspace records cannot affect results or counts |
| E6 — Visible graph behavior | Actual Brave extension; keyboard and pointer walkthrough | New nodes and edges, inspector evidence, filter/query, timeline and saved positions work. Empty, loading, failed-enrichment and unsupported-model states remain usable; text results are available within the graph workspace. |
| E7 — Declared capacity | Start at 500 nodes / 1,500 edges; exercise a 50-record delta and then 5,000 / 15,000 as a stress probe; run with model loaded and unloaded | Proposed supported-tier targets: warm graph open p95 <= 2 s; ordinary filter/query and committed-delta display p95 <= 250 ms over 20 runs. Record pan/zoom smoothness, available memory evidence and model contention. Stress size is not a support promise. Reduce visible neighborhood or supported bound if measured targets fail. |
| E8 — Passive capture and recovery | Research-session domain cases; disconnect, browser close/reopen, storage quota failure, model cancellation, bundle restore | No capture outside enabled scope; source save precedes model success; expired jobs resume without duplicates; export/restore preserves graph semantics; quota error never reports a successful save; revoked bindings remain revoked after restore |

The local graph can function with the model unavailable, but this is a degradation mode. Completing the requested AI slice requires E4 and the real model step in E6. A mock-auth Hub or fixture-only snapshot is useful development proof; it cannot establish authenticated connection or live garden-reader compatibility.

## First-slice observation sheet

- Browser/OS/device/RAM/GPU: pending.
- Extension version and artifact hash: pending.
- Model repository revision, tokenizer/runtime versions and artifact hashes: pending.
- Garden: synthetic fixture initially; named public-record test garden pending.
- Ontology/commons pack version and approval status: pending.
- Captured source URL/revision/digest: pending.
- Change sequences for import/capture/proposal/review: pending.
- Browser proof class: none for this plan; authenticated Brave required for the extension/Hub path under repository rules.
- Model response, recorded evidence quote, review and historical comparison: pending.
- Restart/retry/restore observations: pending.
- Known limits and failed gates: pending measurement.

## Planning evidence

Source inspection on 11 October 2026 established existing Green Goods ontology queries, Garden/Work readers, partial-data semantics and Shared dependency versions. The existing public-impact response is bounded and summarized, so it is not treated as a complete graph API. Coop inspection established capture helpers, a document-hosted Gemma bridge, packaged ONNX handling and replacement-snapshot persistence. It did not establish that these run in Green Goods.

Coop source was read at remote `901f57871ec578b0a31bb38c1eacdd0a85eed83a`. The local checkout is a different revision, `5b889eea30056877f1e3a0114e0cd4353a36cee4`; its manifests declare AGPL-3.0-only. The remote root license lookup returned 404, so exact reuse rights remain unresolved. No source was copied into application code.

The earlier interactive example was a synthetic illustration. Its browser checks are not Sigma, Gemma, bridge, IndexedDB, authenticated Brave or production-extension proof.

## Design and source follow-up

On 11 October 2026, the linked Regen Coordination Knowledge Commons v0 draft was read through the Google Drive connector. It supports per-class schemas with shared versioned integration points; a ratified machine-readable pack and mapping approval remain unresolved. The new [alignment proposal](ontology-alignment.md) records this distinction.

Public Sigma and Cytoscape demo screenshots were captured in the Codex in-app Chromium browser and are included in [visual-design.md](visual-design.md). They are reference images with different data/viewport sizes, not Grove runtime, benchmark, authenticated Brave or installed-extension proof. The Claude Code prompt is prepared, not executed. OpenJev project identity remains unresolved; no scorer was installed or tested.

## Planning PR validation

This hub is published separately from the earlier OS research. All implementation steps and product gates remain unrun. Validation of this planning PR covers hub structure, local links, formatting, scope and the repository-selected push checks. Current results are recorded in the draft PR; they do not establish runtime or model readiness.

No dependency was installed, no application source was changed and no implementation lane was marked complete. Grove runtime browser proof: none. Public-demo reference screenshots are labeled separately above; this change contains planning documents and reference assets only.
