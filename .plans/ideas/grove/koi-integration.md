# KOI foundation for Grove

**Decision:** selected architecture direction, 16 October 2026; implementation and interoperability unproven. Grove is a local-first **partial KOI node**. An optional community-operated **full node** provides persistent exchange and later connectors. A gardener needs only the extension for local capture, inference, graph exploration and history.

The [KOI project](https://github.com/DynamicalSystemsGroup/koi), [KOI Pond](https://metagov.org/projects/koi-pond/project-details) and [architectural article](https://blog.block.science/architecting-knowledge-organization-infrastructure/) establish the broader distributed knowledge approach. Wire decisions below come from the [v1 draft specification](https://dynamicalsystemsgroup.github.io/koi-net-spec/v1.0-draft-release.html) and pinned implementation sources. Package release numbers, protocol versions and ontology versions are separate. Do not promise interoperability from the name KOI alone.

## What KOI supplies, and what Grove owns

| Concern | Reuse or adapt | Grove responsibility |
|---|---|---|
| Identity | RID references, manifests and bundles from `rid-lib` | Stable chain/entity identities and source identity policy; RID is not a URL, label or proof of ownership |
| Exchange | Signed envelopes, node/edge profiles, `NEW`, `UPDATE`, `FORGET`, fetch and poll contracts | Browser adapter, schema/size limits, origin permissions, retries and compatibility tests |
| Processing | KOI's staged RID → manifest → bundle → network → final pipeline as a design pattern | Local capture, deterministic domain mapping, model proposals and human review; do not reproduce every Python component |
| Semantics | JSON-LD and vocabulary extension patterns | Versioned Green Goods + Commons application profile, allowed predicates and explicit mappings |
| Persistence | Reference cache patterns | Dexie revisions, durable inbox/outbox, history, projections, deletion and recovery |
| Trust | Node identity and signature checks | Garden authorization, recipient scope, content policy, local review and provenance quality |
| Experience | No prescribed garden UI | The living graph, simple navigation, source inspection, timeline and accessible query results |

Keep three graphs distinct: **garden knowledge** (work, questions, resources and relationships), **provenance** (source revisions and derivations), and **KOI network topology** (nodes and subscription edges). The first two power Grove's workspace. Network topology belongs in connection diagnostics; it is not the garden's mycelium view. A KOI edge marked `APPROVED` is a subscription decision, not accepted knowledge or Green Goods WorkApproval.

## Browser and optional full-node boundary

The partial-node pattern fits MV3: the extension initiates outbound HTTPS requests and polls a full node while it is active. It does not expose a web server or promise to run while the browser is closed. The core protocol does not provide partial-to-partial delivery. A continuously available garden service is optional infrastructure, not a required local Python process on each gardener's machine.

Build one extension and one controlled full-node fixture for the spike. Proposed `packages/extension/src/koi/` owns the TypeScript wire adapter and node lifecycle; the existing `knowledge/` owner keeps all graph and revision rules. Protocol parsing and crypto stay independent of React. Shared owns Hub/domain contracts, not the Python runtime. Keep the reference Python fixture outside the extension bundle; decide its durable service/package placement separately if the spike justifies a production service. Do not place it in the messaging Agent by convenience.

| Mode | Available | Unavailable or conditional |
|---|---|---|
| Local only | Cached graph, timeline, review, local capture and cached model | New remote records/resources; model first download |
| Hub connected | Bounded public garden snapshot and same-device digest | Background private refresh after Hub closes |
| Full node connected | Allowlisted resource subscriptions and explicitly shared objects | Automatic upload of browser history, raw notes or the whole graph |
| Browser closed | Previously persisted state survives | Extension ingestion/inference; an optional full node may continue its own authorized connectors |

The full node starts with public resource fixtures and a disposable explicitly shared object. Production requires a durable store, authenticated garden/recipient policy, retention, operations ownership and revocation design. Connecting to a public KOI network is not part of the spike.

## Wire adapter contract

Use a narrow internal interface: connect a configured peer, receive validated bundles, publish an explicitly selected projection, reconcile the subscribed collection, disconnect. Its implementations are the real HTTP adapter and a deterministic fault-injection peer. The boundary earns its place because network, signature and restart behavior differ from local database transactions.

- Implement only the needed node/edge handshake and `/events/broadcast`, `/events/poll`, `/rids/fetch`, `/manifests/fetch`, `/bundles/fetch` POST contracts. Pin the schema versions and reject unsupported payloads without losing captured content. Pin the intended peer public key or require explicit first-use acceptance; a self-consistent key/RID is not sufficient trust.
- `rid-lib` hashes bundle contents using RFC 8785 canonical JSON and SHA-256. Signed envelopes use the protocol's compact JSON serialization. These are different byte contracts. Cross-language vectors must cover Unicode, number representation, optional/null fields and key ordering; never replace both with an assumed `JSON.stringify` rule.
- Use native Web Crypto for P-256/SHA-256 signing and verification, with tested raw `r || s` signatures and SPKI public-key encoding. The installation's KOI identity is separate from wallet/passkey identities. Persist keys locally; exclude private keys and Hub grants from portable knowledge exports. Await verification before any state change or content processing.
- Validate sender identity, intended target, signature, manifest/content hash, schema, byte limits and requested workspace/collection. Check read authorization separately for RIDs, manifests and bundles; metadata can disclose private knowledge too. A valid node signature establishes neither garden membership nor truth.
- Requests originate from the extension with exact optional host permissions, never an arbitrary URL proxy exposed to pages. Bind each peer/collection to the local workspace before reading, counting, indexing or rendering. Cross-garden imports require an explicit new scoped copy/reference, not an unfiltered global cache.

No protocol-specific network field replaces `GardenSnapshotV1` coverage or the composed ontology profile. Preserve the original RID, source version and hash beside any locally mapped domain identity. Same RID with changed content is a revision, not a new Garden. Changed timestamps alone do not create a new-knowledge highlight. Publisher authority and expected prior revision govern updates; ambiguous or out-of-order revisions remain unresolved instead of silently overwriting a reviewed claim.

## Delivery and recovery are application work

The pinned upstream [event buffer](https://github.com/DynamicalSystemsGroup/koi-net/blob/7a4d631bcfec86a162d07d8f1b0a004b671c0f0f/src/koi_net/components/event_buffer.py) is in memory; [poll handling](https://github.com/DynamicalSystemsGroup/koi-net/blob/7a4d631bcfec86a162d07d8f1b0a004b671c0f0f/src/koi_net/components/response_handler.py) flushes it while constructing the response. The [cache](https://github.com/DynamicalSystemsGroup/koi-net/blob/7a4d631bcfec86a162d07d8f1b0a004b671c0f0f/src/koi_net/components/cache.py) stores the current object per RID. None is Grove's durable history or an exactly-once delivery guarantee.

1. Persist validated incoming object identity/version and queued mapping work before advancing local progress. Deduplicate by workspace, publisher, RID, content hash and operation/revision. A network retry must not append the same graph change again.
2. Commit mapped records, local sequence and job completion atomically. Network/model awaits happen outside Dexie transactions. Recover expired leases after worker termination; acknowledge a user save only after commit.
3. Persist an explicit outbound projection before sending. Retain pending state until the controlled peer proves that object version was stored. A successful send alone is insufficient; retry with stable identity/hash and verify through authorized state fetch.
4. Reconcile current manifests after reconnect. The spike adds a **Grove collection inventory bundle**: generation, scoped member RIDs/current hashes and explicit withdrawal revisions. Fetch the inventory through ordinary KOI bundle APIs and fetch changed members. This is an application profile addition, not a claim that KOI supplies a cursor/ack protocol.
5. Apply an inventory only when its generation is complete and authorized. The controlled fixture publishes member updates and inventory consistently; retain explicit withdrawal records long enough for reconnecting clients. A missing record, partial page, failed read or absent event is never a deletion signal. Gaps that cannot be reconciled remain visibly stale.

This deliberately tests loss of a poll response before local commit, not just duplicate receipt. A later production service may implement a durable per-recipient cursor/ack feed, but must specify and prove it independently. The Regen processor's confirm endpoint is useful reference material, not evidence that every unconfirmed delivery is retried.

`FORGET` is a peer's signal about a referenced object. Check authority and scope before recording withdrawal; do not let one peer erase independent sources. Local erasure removes protected text, evidence spans, derived indexes and cached exports, including history. A tombstone retains only permitted identifiers/state, never deleted private content. Remote copies cannot be promised erased by broadcasting `FORGET`. The spike tests a public fixture withdrawal; confidential peer deletion remains a production gate.

## Ontology, inference and time

KOI transports the versioned [Grove application profile](ontology-alignment.md); it does not unify Green Goods and Commons meanings automatically. Pin local JSON-LD contexts and schema/mapping digests. Disable arbitrary remote context resolution. Unknown vocabulary stays unresolved; an approved Commons mapping remains a prerequisite to a conformance claim.

Structured Work and WorkApproval imports bypass inference. The model receives bounded source spans, allowed terms and a small garden neighborhood and returns proposals only. Acceptance changes a local review revision, not protocol approval or the activity's evidence class. An accepted plan is still planned.

Keep `recordedAt`/local sequence, source observation/activity time, and optional planned time separate. KOI manifest timestamps and event arrival do not establish when garden work occurred. The timeline defaults to **what Grove knew**, with planned work explicitly labeled and filterable. Source corrections create later revisions. Historical private content may disappear after erasure; the UI explains that limitation.

## Pinned evidence and reuse limits

| Reference | Inspected revision | Reuse decision |
|---|---|---|
| [koi-net](https://github.com/DynamicalSystemsGroup/koi-net/tree/7a4d631bcfec86a162d07d8f1b0a004b671c0f0f) | `7a4d631…`, package 2.1.2, MIT | Python conformance peer and pipeline reference; add policy and recovery before garden sharing |
| [rid-lib](https://github.com/DynamicalSystemsGroup/rid-lib/tree/fde77926d5972eace5527c79881c57648f00c56a) | `fde7792…`, package 3.3.0, MIT | RID/bundle/hash vectors; a small browser implementation needs cross-language proof |
| [Metagov Obsidian plugin](https://github.com/metagov/koi-obsidian-plugin/tree/5135f06a1e68ea713007b394df2cf31cedc6b8d4) | `5135f06…`, MIT | TypeScript partial-node reference; replace Obsidian/Node storage and transport. Source inspection found unawaited async verification calls; require negative signature tests, not wholesale import |
| [KOI graph extension](https://github.com/DynamicalSystemsGroup/koi-net-graph-extension/tree/426bdba418e480b189f711a814300d094617155b) | `426bdba…`, package 0.1.3, MIT | Python RDF/named-graph pattern, optional later server projection; not a browser extension or historical store |
| [Regen KOI processor](https://github.com/gaiaaiagent/koi-processor/tree/b500615b192cc90dc0a7a614d4d18b9db163c338) | `b500615…`, branch `regen-prod` | Compare durability/access extensions; do not import its service stack or cloud inference into Grove |
| [Regen ontology research](https://github.com/regen-network/koi-research/blob/42b3ca8922efa721f7196245507309f5f404b30f/docs/ONTOLOGY-AS-KNOWLEDGE-GRAPH.md) | `42b3ca8…` | Versioned ontology assets and transformation receipts as patterns, not Commons authority |

Repository names and exact dependency licenses must be rechecked at the selected build revision. No dependency or model was installed for this plan; no interoperable browser node has yet been demonstrated. The Obsidian findings are source inspection, not a running security assessment.

Browser constraints: [worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [network permissions](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [offscreen documents](https://developer.chrome.com/docs/extensions/reference/api/offscreen), [packaged executable code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code). Persist resumable work; do not keep a worker alive artificially. Bundle JS/WASM, treat weights as data, and make local model failure recoverable without cloud fallback.
