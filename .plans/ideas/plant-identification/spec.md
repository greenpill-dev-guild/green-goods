# Plant Identification — Candidate Design

**Status**: Draft for design exploration  
**Last Updated**: 2026-09-29

## Purpose and authority

Reduce manual plant data entry during gardener work capture and preserve useful, attributable evidence. The [brief](brief.md) owns confirmed choices and open product questions. This document proposes behavior and records research; it is not an approved production specification.

The five launch actions, optional health on Survival Check/Maintenance, per-species/per-crop measurements, offline queuing and separately attached late updates are confirmed. Other proposals remain reviewable in mocks. Community verification judges the work; an AI prediction does not approve a submission or establish a botanical fact.

## Capture flow

1. The gardener adds a photo in Media. Enabled actions show a sibling **Identify plant** button within the image box. Do not nest this control in the existing photo-preview button.
2. Before the first request, explain that the selected photo is sent to Kindwise. Make credit consequences visible before requesting analysis, without adding a repetitive confirmation dialog.
3. Show identifying, queued offline, suggested result, ambiguous result, no plant, failure and credit-limit states. Failure never blocks manual entry or work capture. Identification and health are proposed optional assists, not submission gates.
4. A usable suggestion produces a compact light overlay: common name when available, scientific name, **Suggested by Kindwise**, Details and Change. Ambiguity requires choosing a suggestion; calibrate thresholds rather than inventing provider guarantees.
5. Fill supported empty plant fields in Details and show **Added to Details**. Preserve gardener-entered values. Changing an AI-derived name retains quantities and notes; conflicting manual names need a visible choice.
6. **Check health** is a separate deliberate request on Survival Check and Maintenance only in the first release. Show assessment status, possible issue, source and editable observation. Suggested care is reference information; it never becomes evidence that treatment occurred.
7. Review shows final plant entries, selected health observations and source photos. Submission freezes a snapshot. Viewing saved work never reruns identification.

Removing identification and removing a photo are separate operations. Photo removal visibly resolves unsupported results and rows, preserving manual entries or offering to remove solely generated rows. Reordering preserves links. Replacing/editing photo bytes invalidates the associated analysis; a crop records its analysis derivative. Multiple photos do not imply multiple plants.

## Default Details by action

Start from [agro templates](../../../packages/shared/src/utils/action/templates/agro.ts) and [canonical action configuration](../../../packages/contracts/config/actions.json). Preserve existing required measurements and categories.

| Action | Existing Details | Proposed plant section / automatic fill | Gardener supplies |
|---|---|---|---|
| Site Assessment & Species Plan | `plannedSeedlings`, `siteAreaBand`, `speciesTags` | **Existing plants**: names, taxon and source photos. Explicit **Add to planting plan** copies a selected taxon into **Planned plants**. | Intent to plant, planned quantities and site area. Observed does not automatically mean planned. |
| Planting Event | `seedlingsPlanted`, `participants`, `speciesTags` | **Species planted**: names, taxon and source photos; optional per-species quantities. | Actual quantities and participants. Photos cannot allocate the overall total. |
| Survival Check | `aliveCount`, `checkedCount`, `checkpoint` | **Plants checked**: names and source photos; requested health appears separately. | Alive/checked counts and checkpoint. Per-species survival needs explicit per-species counts; cohort links are later work. |
| Maintenance Activity | `areaMaintainedBand`, `activityTags`, `activityCount` | **Plants worked on**: names, photos and requested health observation. | Actual work, area and notes. Disease suggestions do not select Pest control or assert treatment. |
| Harvest & Yield Record | `yieldKg`, `harvestCount`, `cropTags` | **Crops harvested**: names, taxon and photos; optional per-crop weights. | Actual yield/count. Health assessment of harvested produce needs separate suitability validation. |

`speciesTags` are categories such as Fruit tree, not species names; `cropTags` are crop categories. Keep them separate from taxa. An explicit curated mapping could prefill a category; do not infer native status, medicinal use or nitrogen-fixing behavior from an identification name or provider filter. Unmapped categories remain manual.

Proposed measurement validation: planting counts are nonnegative integers and weights are nonnegative values with explicit units. Reject allocations exceeding the submission total; smaller allocations leave a visible unallocated remainder. An empty optional measurement stays unknown rather than becoming zero.

Learning Reflection is deferred. Unrelated solar, education and waste actions do not display identification. Paid capability is explicitly enabled by action and stable field IDs, not translated titles or fallback instructions.

## Candidate metadata model

Separate final gardener entries from provider predictions. Taxon identity/rank support grouping; a provider taxon ID does not identify an individual plant or planting cohort.

| Record | Proposed content | Purpose |
|---|---|---|
| `details.plants` | Local row ID; relationship (`observed`, `planned`, `planted`, `checked`, `maintained`, `harvested`); selected names, rank and taxon reference when known; optional measurements/units; field origins; supporting identification references. | Editable final submission data consumed by views/reports. Manual entries may lack provider IDs. |
| `plantIdentifications` | Local ID; source attachment reference, resolved CID, content hash and analysis derivative; selected public-safe suggestions/probabilities; model version/timestamps; gardener selection/correction provenance. | Explains suggested identity. Preserve the original prediction when corrected. |
| Health evidence | Separate assessment linked to photo/plant row; healthy/issue predictions and scores; gardener inclusion and observation. | Distinguishes suggested condition from field observation and work actually performed. Public fields/acceptance UI remain proposals. |

These names/shapes are proposals, not a schema contract. Set versioning and validation during implementation planning. Draft/photo identifiers must survive reload and reordering; upload resolves local references to CIDs before metadata freezes. A File object's in-memory identity alone is insufficient.

The envelope is currently `work_metadata_v2`. [Work types](../../../packages/shared/src/types/domain.ts), [form schema construction](../../../packages/shared/src/hooks/work/useWorkForm.ts) and [the encoder](../../../packages/shared/src/utils/eas/encoders.ts) need explicit integration: unknown form fields may be stripped, and identification evidence is not currently encoded at the top level. Types alone do not publish new metadata. Old submissions stay readable; missing plant data means unknown.

## Offline and late results

An explicit tap while offline saves a pending identification intent tied to the draft, selected photo bytes and request mode. The UI makes queued spending clear. On reconnection, recheck eligibility, limits and unchanged photo content before dispatch. A gardener may cancel queued analysis. Removing/replacing evidence cancels or invalidates its pending request.

Queue state is distinct from work signing/upload. Reconnection must not lose manual edits or issue duplicate paid requests. Persisted work draft/job identifiers are preferable to component state; confirm ownership with current Work/JobQueue code before implementation.

The user confirmed that analysis finishing after submission appears as a clearly labeled later result, with the option to attach a separate update. Never silently rewrite submitted metadata. The mock demonstrates this interaction; the update schema, authorization, linkage and reporting inclusion still need implementation design. This is not an existing corrective-attestation capability.

## Viewing and reporting

| Surface | Proposed display |
|---|---|
| Capture photo | Light overlay with name, source/status, Details and Change; requested health separately. Preview and remove remain reachable. |
| Details / Review | Editable rows with names, measurements and source marker. Long descriptions/care remain in disclosure. |
| Work list | Compact plant names where present, without probabilities or long care text. |
| Saved work / steward review | Plants section linking photos/measurements; disclose original prediction, gardener correction and health suggestion. Work approval is separate from botanical confirmation. |
| Garden / reports | Filters by relationship, taxon/date and certainty; explicit inclusion rules and contributing-work drill-through. This is future design, not an existing report feature. |
| Export / future funding evidence | Final entries, units, provenance and work references; define aggregate semantics before publishing metrics. |

The [admin metadata helper](../../../packages/admin/src/views/Garden/WorkDetail/helpers.tsx) flattens arrays/values and needs a specific renderer for plant objects. [Client WorkView](../../../packages/client/src/components/Features/Work/WorkView.tsx) needs structured display. The [public stats hook](../../../packages/shared/src/hooks/public/usePublicStats.ts) lacks a structured species source. [Hypercert extraction](../../../packages/shared/src/modules/data/hypercerts-metadata.ts) and [aggregation](../../../packages/shared/src/lib/hypercerts/aggregation.ts) do not provide these plant semantics; reporting integration must be explicitly scoped.

Rules for mocks and future reports:

- Keep observed/planned/planted/checked/maintained/harvested distinct. A photo does not prove planting occurred.
- Group by explicit taxon identity and rank. Retain unresolved/manual names without treating them as verified species. Define genus/cultivar handling deliberately.
- Sum quantities/weights only with entered species/crop allocations. Show unallocated totals. Missing historical data is unknown, never zero.
- Per-species survival requires compatible alive/checked counts, checkpoint and cohort context. Do not average confidence as community certainty or sum survival percentages as impact.
- Repeated photos, maintenance and identification do not count as more plants. Longitudinal health needs a plant/plot/cohort link beyond a shared species name.
- Display snapshots without spending credits. Later taxonomic reconciliation retains historical labels and provenance.

## Privacy and credit boundary

Publish only selected plant evidence useful to the submitted work. Keys, provider access tokens/custom retrieval IDs, temporary URLs, logs, billing data and raw responses stay backend-private. Do not send gardener/wallet/garden identities to Kindwise. Strip embedded location metadata from analysis images and omit GPS by default. Work-location consent is separate from vendor-location sharing.

Explain third-party processing before the first request, and publication of included photos/plant data at Review. Hiding a field in UI does not make an IPFS document private; IPFS contents are public unless encrypted. See [IPFS privacy](https://docs.ipfs.tech/concepts/privacy-and-encryption/).

Verify applicable Kindwise terms, retention/reuse/deletion limitations and consent wording before a real pilot. Historical published terms describe storage/service improvement; the deletion endpoint alone does not prove removal of all copies/reuse. The user's current account terms/configuration have not been inspected.

A protected backend verifies caller and garden/action eligibility, body/image limits, quotas and deduplication before spending credits. Agent server auth is not automatically browser auth; do not expose its shared bot token. Analysis must preserve the separate attestation/signing/upload lifecycle.

A successful identification costs one credit; combined species/health uses another. Health-only is supported; retrieval/deletion are free. Reconcile uncertain timeouts before another paid request. Out-of-credits is a spending failure; custom IDs are not a verified exactly-once guarantee. See [Kindwise FAQ](https://www.kindwise.com/faq) and [plant.health](https://www.kindwise.com/plant-health).

## Research evidence

Primary references from the design conversation; core references revisited 2026-09-29:

- [plant.id](https://www.kindwise.com/plant-id) and [user-supplied API documentation](https://documenter.getpostman.com/view/24599534/2s93z5A4v2).
- [Official v3 OpenAPI](https://plant.id/api/v3/openapi.yaml): request/retrieval/deletion, model metadata and health modes. Confirm parameters where prose/schema differ in a later live spike; none has run.
- [Handbook](https://www.kindwise.com/handbook): taxon IDs, names/ranks, external references, languages and nullable details. Request minimal details; descriptions/representative images may require attribution, so do not republish them by default.
- [FAQ](https://www.kindwise.com/faq): group at most five photos of the same subject, with recommended 1–2 megapixel inputs. Do not group unrelated species. Existing compression needs a dedicated analysis-image limit.
- [plant.health](https://www.kindwise.com/plant-health): local suitability needs a field pilot; do not assume coverage for every crop or harvested product.
- [Published API terms](https://uploads-ssl.webflow.com/64876ae345f1e27598fafc02/6655c1c02d61d2759bc47c3b_Kindwise%20API%20T%26C.pdf): historical research input; verify the terms applicable to the user's account before production.

No API key, balance/expiry or live identification was inspected. Mocks use synthetic fixtures and spend no credits.

## Decisions before production

| ID | Decision | Current state / recommendation |
|---|---|---|
| Q1 | Queued result arriving after submission | Confirmed: separate labeled result and deliberate update; preserve original snapshot. Technical design remains open. |
| Q2 | Initial health-enabled actions | Confirmed: Survival Check and Maintenance only initially. |
| Q3 | Credit eligibility and numerical limits | Deferred until pilot scope. Configurable garden/gardener limits plus provider hard caps. |
| Q4 | Low-confidence thresholds and correction rules | Calibrate on local photos. Proposed usable auto-fill; ambiguity requires selection; manual edits stay protected. |
| Q5 | Applicable terms and first-use consent | Verify retention/reuse and wording before real photos. |
| Q6 | Category mappings and taxon/counting semantics | Manual categories in initial mock; define curated ownership and evidence before automation. |

Q3–Q6 are deliberately deferred until mock/pilot review. Individual/cohort inventory, multi-provider reconciliation and production report delivery are later work.

## Implementation boundaries after approval

Shared owns hooks, draft state, validation and serialization. Client owns gardener capture/views; Admin owns steward presentation. Agent is a candidate for the protected provider adapter; confirm runtime constraints. Off-chain snapshots likely need no contract/indexer change, but the selected late-update design may alter this assessment.

Before implementing, review action normalization/projection, HEIC/media identity, queue preparation, metadata readers, both submission surfaces and report consumers. Read nearest guides and select critical Work/JobQueue proof. No implementation lanes are active yet.
