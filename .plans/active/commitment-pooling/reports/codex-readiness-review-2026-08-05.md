# Commitment Pooling implementation-readiness and gallery correctness review

**Audit date:** 2026-08-05  
**Posture:** read-only audit; this report is the only repository write  
**Snapshot:** branch `polish/finalize-commitment-pooling-architecture`, HEAD `9f4fd207c11a15b1641a6ae9cfe5b65fb184c697`

## Executive verdict

No P0 drift was found: the architecture-closure gate passed at the requested 54 / 26 / 86 / 8 / 56 / 6 / 6 / 7 baseline, and the gallery prerender parsed all 43 gallery Mermaid blocks with zero failures.

The three implementation lanes are not all specification-ready. The intentional `blocked` / `manual_blocked` process gates are not findings here; the verdicts below concern only whether the lane could be implemented without an unresolved specification choice after those gates clear.

| Lane | Verdict | Single blocking specification gap |
|---|---|---|
| Contracts (PRD-721) | **Not specification-ready to build** | `Commitment.creationPayloadHash` is required by downstream recovery and indexing, but the canonical `CommitmentCreated` ABI omits it and the exact commitment-hash preimage is not frozen. The contract implementer must choose an ABI/preimage that the plan currently does not choose. |
| Indexer (PRD-722) | **Not specification-ready to build** | The schema/handler contract requires `creationPayloadHash`, while no core event supplies it and RPC backfill is forbidden. The required field has no legal materialization path. |
| State/API (PRD-723) | **Not specification-ready to build** | The PoolMemberHistory privacy rule appears only as prose input/UI guidance. It is absent from the handoff's named outputs, acceptance criteria, and RED/GREEN tests, so the lane can satisfy its written gate without proving viewer/steward/self filtering or the raw-entity binding prohibition. |

The dependency chain itself is represented honestly: contracts → indexer → state/API in `status.json` (`status.json:271-279`, `status.json:309-318`, `status.json:329-338`) and in the ordered plan (`plan.todo.md:719-721`). Core indexing does not depend on settlement events; settlement remains a separate later slice in the indexer and state/API handoffs (`handoffs/codex-indexer.md:9-12`, `handoffs/codex-state-api.md:9-19`).

## Gallery verdict

**The Architecture tab is not fully correct.** Its section count, reading order, aliases, Mermaid parsing, ERD cardinality keys, mixed-arrow keys, and content boundaries are correct. It fails two stated correctness contracts:

1. 16 of the 42 Architecture Mermaid blocks have no colour key.
2. The Reference-tab sensitive-action permission table claims to be exact but omits current operational functions and excludes the accountable lead provider from `submitForConfirmation`.

### 42 versus 43, resolved

- `diagrams.md` contains **29 named D-sections, D1–D29, rendering 42 Mermaid blocks**. The declared count and mapping are current in `plan.todo.md:30`, `diagrams.md:25-59`, and `visual-assets.md:4`.
- The gallery has **43 Mermaid blocks overall** because `wireframes.md` contributes the one Screens-flow block. `visual-assets.md:168` states this distinction exactly.
- The fresh prerender confirmed: `diagrams to freeze: 43`, `rendered 43, failed 0`.

Therefore **42 is the Architecture-tab count; 43 is the whole-gallery prerender count**. The 2026-08-04 statement in `visual-assets.md:54-56` is correct for whole-gallery scope, not discrepant with the Architecture count.

## Findings

### P1 — implementation blockers

#### P1-1 — `creationPayloadHash` has no event materialization path and no exact frozen preimage

**Evidence:** `contract-spec.md:438`, `contract-spec.md:447`, `contract-spec.md:585-611`, `contract-spec.md:2791-2799`, `contract-spec.md:3287-3297`, `handoffs/codex-indexer.md:48-61`, `handoffs/codex-state-api.md:54-59`.

**What is wrong:** the contract storage model requires a replay-conflict `creationPayloadHash`, the GraphQL `Commitment` row exposes it, and the handler plan says `CommitmentCreated` initializes the “stored `creationPayloadHash`” directly without RPC reads. The canonical event signature does not include that field. It also does not emit the complete original `CreateCommitmentParams` needed to reproduce the hash independently: confirmer, fallback, reward, and other facts arrive through companion events or derived state. Unlike the series hash rule at `contract-spec.md:1315`, the commitment rule at `contract-spec.md:1318` says only “full normalized payload hash” and does not freeze an exact typed preimage.

**What it should be:** choose and freeze one cross-lane contract. The direct option is to define the exact typed hash preimage and emit `creationPayloadHash` in `CommitmentCreated`, then update the canonical ABI/config, event matrix, handoffs, and validator. An alternative would have to remove it from event-only indexer materialization and explicitly move recovery to an onchain getter with corresponding nullable/query semantics. The current mixture is not implementable as written.

**What breaks if it ships as-is:** a contracts implementation can freeze an ABI that the indexer cannot satisfy; the indexer must invent a hash, perform a prohibited RPC backfill, or leave recovery data null; state/API replay binding can then accept the wrong record or fail to recover an exact prior creation. The “specification-ready” claims in `status.json:271-288` and `handoffs/codex-indexer.md:9-12` are stale until this is resolved.

#### P1-2 — PoolMemberHistory disclosure is stated but not acceptance- or test-bound

**Evidence:** `handoffs/codex-state-api.md:15-18`, `handoffs/codex-state-api.md:25-35`, `handoffs/codex-state-api.md:126-169`, `handoffs/codex-state-api.md:171-188`, `uiux-spec.md:747-762`, `contract-spec.md:3153-3177`.

**What is wrong:** the input paragraph correctly states that a shared selector requires a viewer account plus current pool-steward capability, returns another participant only to that steward or the member themself, forbids client/admin raw-entity binding, and exposes editorial aggregates only. But `PoolMemberHistory` is not named in the handoff outputs, no acceptance bullet asserts the four disclosure cases, and the RED/GREEN list contains no privacy-selector or consumer-boundary test. This is a requirement statement, not an enforceable lane-completion contract.

**What it should be:** name the shared selector and its typed inputs/results; add acceptance and RED tests for unauthenticated viewer, ordinary viewer requesting another member, self, current pool steward, stale/non-current steward, editorial aggregate-only access, no client/admin raw entity import/binding, and exact-basis value aggregation. The raw Envio row may remain public event-derived data; the product disclosure rule still needs executable proof.

**What breaks if it ships as-is:** PRD-723 can turn GREEN while participant rows are exposed to the wrong signed-in user, a stale steward, or a raw client/admin query. It can also accidentally introduce per-person comparisons even though the prose says “never a score.”

### P2 — correctness and cross-document drift

#### P2-1 — the gallery's “exact” sensitive-action table is incomplete and one row is wrong

**Evidence:** `diagrams.md:2270-2276`, `diagrams.md:2283-2293`, `contract-spec.md:1284-1304`, `contract-spec.md:1315-1327`, `contract-spec.md:1334`, `contract-spec.md:1264`.

**What is wrong:** the Reference table calls itself the exact authorization source and a copy of the canonical matrices. It omits 12 current operational mutations: all five series functions, `setDeclaredValue`, `acceptExchange`, and the five contributor join/leave/add/remove/assignment functions. It also omits the initializer even though the canonical matrix says it covers every mutating entry point. More importantly, its `submitForConfirmation` row authorizes only creator/counterparty/steward, while the canonical permission matrix explicitly includes the accountable lead provider so a human lead can submit a Garden-claimed Request.

**What it should be:** either synchronize the table to every canonical mutating function and exact caller/gate, including the accountable lead, or stop calling it the exact/only function-level source. The gallery contract requested here requires synchronization.

**What breaks if it ships as-is:** a reviewer or implementer following the gallery can omit current surfaces, gate a valid Garden lead out of submission, or treat the August exchange/value/contributor permissions as undefined.

#### P2-2 — 16 Architecture diagrams lack the promised per-diagram colour key

**Evidence:** `visual-assets.md:4`, `visual-assets.md:168`, `visual-assets-artifact.build.ts:118-121`, `visual-assets-artifact.build.ts:170-201`.

**What is wrong:** fresh source/artifact inspection found 42 Architecture blocks: 17 flowcharts, 9 state diagrams, 11 sequence diagrams, 4 ERDs, and 1 class diagram. The generated Architecture pane contains only 26 colour keys. `diagramKey()` emits colour keys only for flowcharts and state diagrams; it returns early for ERDs and all other diagram types. The 11 sequences, 4 ERDs, and D24 class diagram therefore have no colour key.

**What it should be:** every block needs a local colour/status key appropriate to its treatments, including an explicit default/onchain or actor/planned explanation where the Mermaid type cannot carry flowchart classes. Keep the existing cardinality and arrow keys as additional keys, not replacements.

**What breaks if it ships as-is:** the Architecture tab fails its own stated self-contained-reading contract. A reader cannot determine status/colour meaning locally on 16 diagrams, even though the asset index says every diagram can be read without remembering a global legend.

#### P2-3 — EvidenceAttributionIndex ordering has two incompatible canonical rules

**Evidence:** `contract-spec.md:3002-3010`, `architecture-closure-matrices.md:86-88`, `contract-spec.md:3493-3510`.

**What is wrong:** the GraphQL field comment says `attributionEntityIds` uses stable event order. The binding closure matrix requires unique sorted IDs, and the handler plan says evidence relationships are lexically sorted and that only pending lifecycle projections preserve event-position order.

**What it should be:** make the schema field comment say unique deterministic lexical order, matching ER-17 and the handler plan, or explicitly exempt this field everywhere if event order is actually meaningful. Nothing currently consumes evidence order semantically, so the sorted rule is the coherent existing choice.

**What breaks if it ships as-is:** reverse delivery produces different array order depending on which paragraph the handler implementer follows, creating replay-test churn and unstable query/cache output.

#### P2-4 — `Expired` is called terminal while an explicit transition leaves it

**Evidence:** `architecture-closure-matrices.md:224-232`, `contract-spec.md:197-203`, `contract-spec.md:223-225`.

**What is wrong:** LC-04 labels Fulfilled, Cancelled, and Expired terminal, but the canonical machine explicitly permits `Expired -> Disputed`, re-increments live counts, and later returns to Expired or Cancelled. The transition mechanics are otherwise complete and reachable; the defect is the unqualified terminal label.

**What it should be:** describe Expired as closed for capacity/live-count accounting but dispute-reopenable, reserving unconditional terminal language for states with no outgoing transition. Preserve the exact reversal/reapplication rules.

**What breaks if it ships as-is:** a generic terminal-state guard or selector can reject a valid dispute, fail to restore the live count, or hide the wind-down action even though the detailed contract table requires it.

#### P2-5 — the document map and handoff README are not the bidirectional indexes they claim to be

**Evidence:** `plan.todo.md:15-17`, `plan.todo.md:19-49`, `handoffs/README.md:1-10`, `handoffs/README.md:28-37`.

**What is wrong:** the audit snapshot contains 130 files: 21 at the hub root, 42 under `artifacts/`, 19 under `handoffs/`, 17 under `hifi/`, 20 under `operations/`, and 11 under `reports/`. The document map has no row for five root files (`prototypes-artifact.build.ts`, `prototypes-coverage.md`, `session-state-admin-canvas.md`, `visual-assets-artifact.build.ts`, `visual-assets-prerender.ts`) and no inventory for the artifact, hi-fi, or operations trees. Its one `handoffs/` row says `README.md` is the index, but that README describes source order and mentions only two Claude artifact handoffs plus the lane issue list; it does not enumerate the 19 actual handoff files.

**What it should be:** either make the map genuinely exhaustive in both directions, with explicit subtree indexes, or narrow the promise from “Every file in this hub” to a document-authority map and add real indexes for generated assets, hi-fi sources, operations evidence, and all handoffs.

**What breaks if it ships as-is:** implementers and reviewers can miss active dispatch files, generators, operational evidence, or the source owning a rendered artifact while still believing the index is exhaustive.

### P3 — stale guidance

#### P3-1 — the live indexer checklist still says “Envio v2”

**Evidence:** `plan.todo.md:704`, `plan.todo.md:798-817`, `packages/indexer/package.json:37`, `handoffs/codex-indexer.md:9-12`.

**What is wrong:** the current plan correctly records PR #649 merged and Envio 3.2.1 pinned, but the Indexer lane's living planning-readiness sentence still says “Envio v2 multichain behavior.”

**What it should be:** refer to the Envio 3.2.1 multichain/replay behavior proven by PR #649.

**What breaks if it ships as-is:** the stale version label can send an implementer to obsolete generated-layout or handler assumptions. This does not invalidate the dependency: live GitHub state shows PR #649 merged into `develop` at merge commit `8fd89e660e2271f835b6d04d3ab1c834587f99e4`, and that commit is an ancestor of the audited `origin/develop`.

## Verified clean checks

- **54-event inventory and exact event ownership:** all Matrix A event names resolve to the canonical pooling/register or settlement signatures; no unnamed or settlement-only event is needed by the pooling-core dependency chain. The one exception is not a missing declared event but P1-1's missing downstream hash parameter (`contract-spec.md:535-625`, `architecture-closure-matrices.md:13-68`).
- **State-machine reachability:** Pool, cycle, series, claim-request, and commitment transitions have entry and wind-down paths. No stored state is unreachable. The only terminology defect is P2-4's dispute-reopenable Expired state (`contract-spec.md:159-225`, `architecture-closure-matrices.md:222-242`).
- **Indexer boundary:** pooling entities index Green Goods module/register events plus minimal Hypercert claim linkage. They do not re-index EAS, Gardens V2, marketplace, ENS lifecycle, cookie jars, or raw Celo/G$ transfers (`contract-spec.md:2490-2502`, `handoffs/codex-indexer.md:20-27`, `handoffs/codex-indexer.md:74-87`).
- **Sparse materialization:** all eight A3 rows have a representable path. PM-01 through PM-07 have explicit seen markers and nullable owner-event facts; PM-08 explicitly requires the owning event to carry the complete row or use the typed lifecycle buffer (`architecture-closure-matrices.md:100-115`, `handoffs/codex-indexer.md:41-47`).
- **Retry/idempotency and persistence:** all six offline kinds have durable identity, recovery, retry/failure behavior, and restart semantics. Celo wallet transfer is never retried automatically; command retry and acknowledgment retry use distinct identities and neither can execute G$ twice. All six persistence truth states have explicit durable locations and exits (`architecture-closure-matrices.md:134-158`, `architecture-closure-matrices.md:185-208`, `handoffs/codex-state-api.md:32-72`).
- **CPP-alignment amendment:** `counterCommitmentId`, `declaredUnitValue`/`declaredValueBasis`, `CommitmentCounterIndex`, and counts-only `PoolMemberHistory` appear across the contract/schema, both handoffs, and ER-24/ER-26 (`contract-spec.md:473-477`, `contract-spec.md:608-620`, `contract-spec.md:3122-3177`, `architecture-closure-matrices.md:94-96`, `handoffs/codex-indexer.md:31-74`, `handoffs/codex-state-api.md:15-18`). P1-2 concerns proof of the privacy selector, not omission of the data model.
- **Exact-label aggregation:** unlike labels never merge; value sums are permitted only within one exact basis and no per-person value/ranking output is authorized (`architecture-closure-matrices.md:73-75`, `uiux-spec.md:730-732`, `contract-spec.md:3153-3160`).
- **PR #649 dependency:** current GitHub state is MERGED, base `develop`, merged 2026-07-28, merge commit `8fd89e660e2271f835b6d04d3ab1c834587f99e4`; the commit is present in audited `origin/develop`, and `packages/indexer/package.json:37` pins `envio` 3.2.1. No core pooling handler depends on settlement events (`plan.todo.md:704`, `handoffs/codex-indexer.md:9-12`).
- **Exchange boundary:** the August core adds exactly `acceptExchange`; Pool `settlementEnabled` remains false and `settlementAdapter` zero, the later adapter/voucher design adds no initial ABI/storage, and `ICommitmentRegistry` explicitly exposes no transfer/approval surface (`contract-spec.md:380-388`, `contract-spec.md:1004-1016`, `contract-spec.md:1760-1766`, `contract-spec.md:1785-1797`, `contract-spec.md:1878-1880`, `handoffs/codex-contracts.md:34-57`).
- **D-section order and content:** the actual D1–D29 order matches the required seven reading groups, including D13 bilateral exchange, D28 the three-identity boundary, and D29 the staged full-pool path (`diagrams.md:25-59`, `diagrams.md:1029-1074`, `diagrams.md:2419-2458`, `diagrams.md:2460-2498`, `visual-assets.md:48-50`).
- **Aliases:** the preamble old→new table covers 27 old numbers; D1 and D11 retained their live IDs, and the remaining 25 old slugs are injected as aliases. The build asserts every declared alias applied and no alias collides with a live section ID (`diagrams.md:42-59`, `visual-assets-artifact.build.ts:431-514`). No alias is missing or misrouted.
- **Diagram structural keys:** all four ERDs have cardinality keys, and all 18 diagrams that mix arrow styles have arrow-meaning keys. P2-2 is limited to colour keys (`visual-assets-artifact.build.ts:132-167`, `visual-assets-artifact.build.ts:170-201`).
- **Mermaid parsing:** the fresh prerender rendered all 43 gallery blocks and failed zero. No semicolon/note parse defect exists in the audited source.
- **Gallery content constraints:** Architecture is garden-agnostic; no fourth garden is named; operator appears only in implementation-permission context; D21–D23 preserve Queued, Dispatched, derived delay, executed/acknowledgment-pending, authenticated Confirmed/Failed, and cancellation origins; command and acknowledgment retry are separate; no architecture diagram contains banned engagement vocabulary or ranking imagery (`diagrams.md:10`, `diagrams.md:1840-1962`, `diagrams.md:1975-2038`, `visual-assets.md:21`).
- **Asset-index descriptions:** the three `diagrams.md` rows accurately describe D13, D28, and D29 (`visual-assets.md:48-50`, `diagrams.md:1029-1074`, `diagrams.md:2419-2498`).
- **Recent decision citations:** the audited `origin/develop...HEAD` additions name Decision Log versus register for ambiguous 1–54 references. No new bare ambiguous citation was found. Existing dated history and `reports/audit-2026-07-20.md` were left untouched (`plan.todo.md:58-76`, `plan.todo.md:634`, `plan.todo.md:38`).
- **Status/dependency ownership:** Codex owns all three reviewed execution sub-lanes; statuses remain intentionally blocked/manual; dependencies are contracts → indexer → state/API. The superseding 2026-08-02 amendment in `status.json:287` correctly overrides the older “two commits/slots” wording in `status.json:288`; it is not an active exchange defect.

## Evidence

### Architecture closure gate

Command:

```text
bun .plans/active/commitment-pooling/architecture-closure.validate.ts
```

Output, verbatim:

```text
Architecture closure validation passed: 54 events, 26 indexed entities, 86 classified module functions, 8 sparse-event materialization rows, 56 executable calls, 6 offline kinds, 6 persistence states, and 7 lifecycle subjects.
```

### Visual asset prerender

Command:

```text
bun .plans/active/commitment-pooling/visual-assets-prerender.ts
```

Successful output, verbatim:

```text
1/4 building fresh outputs (read-only run of visual-assets-artifact.build.ts)…
local preview: /tmp/cp-visual-local.DO-NOT-PUBLISH.html (3,416,478 bytes, embedded Mermaid 11.12.2)
Artifact body: /tmp/cp-visual-artifact-body.DO-NOT-PUBLISH.html (647,874 bytes, host-rendered Mermaid)
sections: story 21 · architecture 30 · screens 51 · reference 5
mermaid blocks: 43 · ascii frames: 51 · wireframe screens: 42 · wf-only tags: 6

┌───────────────────────────────────────────────────────────────────────────┐
│  NEITHER FILE ABOVE MAY BE PUBLISHED.                                     │
│  Both carry <pre class="mermaid">, which the Artifact host renders at      │
│  view time — public viewers cannot, so the share is refused and readers    │
│  are told the latest version can't be viewed.                             │
│                                                                           │
│  Deploy step (writes the publishable file):                               │
│    bun .plans/active/commitment-pooling/visual-assets-prerender.ts        │
└───────────────────────────────────────────────────────────────────────────┘
    diagrams to freeze: 43
2/4 rendering Mermaid via playwright chromium (light + dark)…
    render status: ready (rendered 43, failed 0)
3/4 freezing each diagram to inline SVG (both themes) and splicing…
3.5/4 hardening preview pan/zoom (open oversize diagrams pannable; scroll-to-pan)…
    open-zoom fix already present upstream — skipping patch
    scroll-to-pan fix already present upstream — skipping patch
4/4 flipping the sentinel and verifying shareable invariants…

✅ shareable body: /tmp/cp-visual-shareable.PUBLISH-THIS.html
   9,547,084 bytes · froze 43 diagrams (light+dark) · total <svg>=160 · host-rendered Mermaid blocks=0
   verified publishable — publish THIS path to artifact 007ef090:
     /tmp/cp-visual-shareable.PUBLISH-THIS.html
   re-check any candidate path with:  bun /Users/afo/Code/greenpill/green-goods/.plans/active/commitment-pooling/visual-assets-prerender.ts --verify <file>
   local visual validation (never publish this one): open /tmp/cp-visual-local.DO-NOT-PUBLISH.html with file://
```

No artifact was published, no lane was dispatched, no branch was switched, and no source or immutable audit input was edited.
