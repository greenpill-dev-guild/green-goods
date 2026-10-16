# First end-to-end spike: Vida Verde and TAS

**Status:** scoped, unstarted. **Updated:** 16 October 2026.
**Purpose:** demonstrate that a local-first KOI partial node turns one relevant resource into an inspectable garden connection, keeps its history offline, and exchanges only an explicitly selected object with a controlled full node.

Build one reusable flow and run it first for **Vida Verde** (agroforestry), then **TAS HUB / Tech and Sun** (education and solar context). Keep two isolated workspaces on one desktop profile, with only one active garden view. This is not a merged cross-garden graph, a multi-user pilot, a migration or evidence of environmental impact.

## Evidence fixtures

| Garden | Internal anchor | External source | Proposed work, clearly labeled |
|---|---|---|---|
| Vida Verde | Public garden registration and bounded Hub snapshot; available Work/Action/WorkApproval records only when actually returned | [Agroforestry: a guide for field practitioners](https://ccafs.cgiar.org/resources/publications/agroforestry-guide-field-practitioners), a reference requiring local adaptation | A small agroforestry observation/trial plan with baseline questions; no invented planting dates, species suitability, survival, area or carbon figures |
| TAS | Public garden identity and bounded Hub snapshot; [Tech and Sun's public site](https://techandsun.com/) as garden-reported context | [Geode grants](https://geode.build/grants) as a potential education/community resource; relevance is a proposal, not eligibility or an award | A learning-session or solar-maintenance documentation plan; no inferred training completion, installation or funding outcome |

Resolve garden identities from [public curation](../../../packages/client/src/content/publicCuration.ts) and the selected chain's authoritative deployment/reader data. The curation addresses are lookup candidates, not cross-chain identity proof. Preserve origin-chain attestations separately from any later mirrored garden identity. Use `getDefaultChain()`/`DEFAULT_CHAIN_ID` in production adapters, and explicit chain IDs in fixtures. Confirm both gardens on the chosen environment before the live run; an unavailable garden is a blocked integration case, not permission to switch chains silently.

Public source evidence includes Vida Verde's [Arbitrum registration transaction](https://arbiscan.io/tx/0x36311d9124a0ddc7af496032184db5c92a734682d7d48edbf77ba356ef682df4). It establishes a registration event, not planting or agroforestry results. Re-read public sources at fixture capture time and record URL, retrieved time, digest, declared source/activity date and reuse limits. A dated garden website report remains **reported**, even if locally accepted.

The fixture manifest records garden ID, chain, source RID/URL, provenance class, captured digest, profile/mapping version, coverage and license/redistribution decision. Bound each Hub snapshot to at most 100 selected Work records; use a smaller representative subset in the demonstration. When no Work or approval is returned, show “not available in this snapshot”; never manufacture a record to complete the scene. Keep synthetic Work/approval cases separately labeled for mapper tests.

Private sync notes may be selected locally only when authorized, with local-only disclosure. Do not commit note excerpts, private links, personal details or internal per-garden metrics to this public repository. The tracked fixture should use public-safe metadata and permitted excerpts, or redacted synthetic negatives. A reviewer must be able to reproduce the public flow without private Drive access.

## The walkthrough

1. **Connect Vida Verde.** Import a real bounded Hub snapshot, record coverage and open the garden overview. Import existing public evidence deterministically. Introduce “Soil care / agroforestry” as a local topic/question when it is not a canonical Action; do not pretend a display cluster is a protocol record.
2. **Receive a resource.** Subscribe to the controlled full node's public agroforestry collection; receive a signed bundle and verify it. Also exercise explicit page capture of the selected source, with local deduplication preserving transport and capture provenance. The saved source appears before inference.
3. **Open Soil care.** Focus a small neighborhood. Local Gemma proposes at most three allowed, source-backed links to actual imported entities or the local question. No relevant evidence means abstention. The new connection is labeled **Suggested** and links to the exact captured passage.
4. **Follow the connection and return.** Open its inspector, follow the source passage, and use **Back to Soil care** and the garden breadcrumb. Preserve camera, selection, filter and timeline position. Mycelium curves express relationships; labels and usable hit targets do the navigation.
5. **Review and plan.** Accept/reject/correct the proposed link, then add one **Planned** trial record. Its planned date may be unset. Keep activity classification independent from local acceptance: “accepted by you” never converts a plan into recorded Work.
6. **Watch knowledge grow.** Scrub through before import, source saved, proposal added and reviewed states. Show new edges between existing nodes. A source with an older activity date appears only after its actual import in the knowledge-time view. Planned work uses a distinct labeled treatment and filter; it is not counted as completed activity.
7. **Recover locally.** Terminate/restart the worker, reopen offline, retry an identical capture, and interrupt a model job. Sources, review, positions and history survive without false new-node signals. Model unavailable leaves saved content queryable and permits manual linking, while the AI gate remains incomplete.
8. **Share deliberately.** Preview and approve one public-safe accepted projection for the controlled full node; persist it in the outbox. Verify the peer stored that exact version. No raw browsing history, local notes, private keys or unselected objects leave. Read the separate same-device Hub digest, labeled **On this device**.
9. **Exercise loss and withdrawal.** Drop a poll response before local commit, update one resource, then withdraw it through the authorized publisher. Reconnect and reconcile the collection inventory. Show source withdrawal and affected evidence without erasing independent records or accepting an incomplete inventory as deletion.
10. **Repeat for TAS.** Switch to its isolated workspace and run the same receive/capture → proposal → review → timeline → offline → explicit-share loop. Querying, graph counts, model context, outbound objects and Hub digests must contain no Vida Verde private or unselected data. Deliberately send a wrong-workspace object and reject it.

## Scope, artifacts and stop conditions

The spike delivers an unpacked Brave extension, one pinned local-model configuration, one controlled Python KOI peer with durable fixture state/collection inventory, source-backed public fixture manifests for both gardens, protocol conformance vectors, and a short evidence record. A local isolated peer is sufficient; no public service deployment is required. The local HTTPS/permission arrangement must be explicit, with no blanket certificate-verification bypass.

Use implementation checkpoints S0–S9 and K1–K2 in [the sequence](plan.todo.md), split across reviewable PRs. The controlled peer is test infrastructure, not an accepted production full-node service. Dependency installation and product implementation need their own task authorization; this PR updates the plan only.

A successful spike requires E1–E6 and E9–E11 in [the acceptance gates](eval.md), plus the targeted restart/isolation cases above. Record latency, memory and graph sizes; the broader E7 capacity and E8 passive-session/portability gates belong to the subsequent MVP. Declare every failed or unavailable case. Fixture-only tests cannot pass live Hub compatibility, and manual links cannot pass the real-model gate.

Do not broaden the spike to autonomous search, private Drive synchronization, a Neo4j deployment, browser-wide passive capture, CRDT replication, public Commons publishing, onchain writes or new ecological metrics. If wire compatibility, local-model quality or scoped recovery fails, retain the local graph and report that specific failed gate before expanding the build.
