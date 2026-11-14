# Grove: local-first package options

**Research date:** 13 November 2026. **Accepted preference:** Yjs for optional co-editing; encrypted record exchange remains the baseline. Automerge + Keyhive is an experimental research alternative. No installation or runtime proof. **14 November:** co-editing is a later lane (D16 in [spec.md](spec.md#decision-log)), and the Keyhive comparison is backlog research that gates nothing (R11). [Community sharing](community-sharing.md) owns confidentiality; [the comparison](collaboration-passkey-spike.md) owns C0a/C5 and E24/E25.

## Keep the jobs separate

| Job | Current Grove direction | What it does not provide |
|---|---|---|
| Local durable records | Dexie/IndexedDB with encrypted payloads and explicit revision/command semantics | Community membership, peer discovery or automatic E2EE |
| Recovery of multi-step processing | Pi Durable custom tasks | Shared database replication, encryption or review authority |
| Concurrent document editing | Yjs only when needed; compare one challenger | Identity or permission merely from a client ID |
| Moving data | Encrypted files, authenticated WebRTC, optional HTTPS storage | Approval to share or rights to decrypt |
| Community authorization | Verified policy, scoped grants and local keys | A universal public identity graph |

Do not add a CRDT merely to keep an immutable capture and its review decisions on two devices. First prove encrypted record exchange. The package decision starts when that simpler design fails a concrete collaboration or replication requirement.

## Shortlist

| Candidate / packages | Established capability | Grove opportunity and cost | Recommendation |
|---|---|---|---|
| Existing Dexie + a bounded encrypted outbox | IndexedDB transactions and indexed local records are already the planned persistence boundary | Least model migration; Grove still builds record exchange, conflict rules and key policy | Keep for local capture/review and comparison baseline |
| Yjs core, with Grove's own encrypted persistence and carrier | Offline document merging and a provider ecosystem; Coop has an inspected implementation | Use the core for merging only. `y-indexeddb` stores plaintext and `y-webrtc`'s password protects signalling, so both are replaced, not reused. Yjs cannot tell who wrote an update, so every key holder can write; a writer check needs a signed update log such as secsync's. Server-readable y-websocket is outside the host privacy boundary | Preferred engine for the later co-editing lane; C5/E20 proof remains unrun |
| `@automerge/automerge-repo` + IndexedDB/network adapters, with `@automerge/automerge-repo-keyhive` in the comparison | Repo composes storage/network adapters. Keyhive adds document membership, access levels and ciphertext relay | Potentially less custom permission/sync work; Grove still owns identity binding, protected key storage and recovery. New readers receive history. Different document model; no dual-written authority | Accepted C5 challenger; experimental, synthetic data only; no production adoption |
| Loro CRDT (`loro-crdt`) + `loro-websocket` / `loro-adaptors` | Document update/snapshot import/export; protocol supports Loro and Yjs adapters, multiplexed rooms and experimental E2EE | Possible Yjs transport experiment without replacing the whole app. Protocol compatibility does not mean Loro and Yjs document formats merge with one another | Secondary bounded comparison; encryption/room authority must be proven |
| RxDB + WebRTC replication plugin | Browser database replication with checkpoints/conflict handling and a WebRTC path | May reduce custom database-sync work, but is a persistence/model commitment alongside the already planned Dexie. Transport encryption is not sufficient for host-blind stored content | Revisit only if record replication becomes more costly than adopting its database model |
| Classic Jazz / CoJSON | Its classic documentation describes account/group-based signed, encrypted values and local/offline sync | Broader app-model replacement could reduce custom work but binds persistence, identity and permissions together. Current Jazz documentation also describes a different server-enforced policy model | Research-only; pin the exact generation, packages and threat model before comparing |

## Evidence and maturity limits

- [Automerge local storage/sync](https://automerge.org/docs/tutorial/local-sync/) and [core concepts](https://automerge.org/docs/tutorial/concepts/) establish Repo storage/network adapters and CRDT documents. The inspected [Keyhive integration README](https://github.com/automerge/automerge-repo-keyhive), blob `8af94b2c484421cbaf0eff1248f9f5c761164f6a`, explicitly says alpha, changing API and an upcoming TypeScript-to-WASM refactor. It warns that `repo.create2` creates protected documents while `repo.create` bypasses that factory. This is a concrete negative test, not production readiness evidence.
- Follow-up [integration guide](https://github.com/automerge/automerge-repo-keyhive/blob/main/docs/automerge-repo-keyhive-api-guide.md), blob `5c55314e0eab4f8266fd36b309aa172980846597`, describes Ed25519 identities, stored identity/prekey secrets, no built-in recovery and full history for new readers. The [core threat model](https://github.com/inkandswitch/keyhive/blob/main/design/threat_model.md), blob `b66e57afaf9aa48328cf6c0b79cde67d49a20c15`, records unaudited intended properties and unresolved revocation/reconciliation gaps. Pin the actual package/core source before deciding applicability; source observations do not establish a tested release. [Comparison source notes](collaboration-passkey-spike.md#keyhive-experimental-boundary-and-source-observations) retain the manifest observation and mandatory negative cases.
- [Loro sync](https://loro.dev/docs/tutorial/sync), [protocol overview](https://loro.dev/blog/loro-protocol) and [protocol source](https://github.com/loro-dev/protocol) distinguish document updates from network adapters. Its published E2EE path is experimental. Test authorization, key rotation, epoch/history handling and encrypted persistence; do not claim confidentiality from CRDT convergence.
- [RxDB WebRTC replication](https://rxdb.info/replication-webrtc.html) expressly notes that peers still need discovery/signaling and that this is not a full offline mesh. Exact storage/plugin licensing, package/bundle cost and encryption behavior remain selection prerequisites.
- [Classic Jazz encryption](https://classic.jazz.tools/docs/react/reference/encryption) and [classic sync/self-hosting](https://classic.jazz.tools/docs/react/core-concepts/sync-and-storage) describe CoValues/groups and an encrypted collaboration approach. The current [Jazz policy documentation](https://jazz.tools/docs/schemas/policies) describes server-enforced declarative row permissions. These must not be blended into a claim that any current `jazz-tools` version provides classic client-enforced E2EE. Current-line migration and compatibility are unresolved.
- [Yjs updates](https://docs.yjs.dev/api/document-updates) are transport-independent; [awareness](https://docs.yjs.dev/getting-started/adding-awareness) is a separate ephemeral data path. Coop source observations and their confidentiality limits remain in [sharing-research.md](sharing-research.md).

These are first-party documentation/source observations, not measured Grove performance, security audits or proof of mobile extension support. Exact release versions, licences, maintenance, migration and browser/WASM/CSP behavior require review before installation. Candidate names are not an approved dependency list.

## Bounded evaluation

Run [the two-device comparison](collaboration-passkey-spike.md) with encrypted records as the baseline and Yjs as the preferred optional co-editing path. Retain Automerge Repo + Keyhive as an experimental research variant, not a required second engine. Pass A proves passkey reuse, offline unlock and recovery independently. Solid is the preferred optional storage adapter; EDV/native-relay alternatives stay research. Shipping co-editing still requires E20 and a demonstrated need; E25 research does not block a passing Yjs slice.

Use a shared draft plus private source material that must never enter that draft. Exercise offline divergent edits, reconnection, duplicate/reordered updates, denied writer, expelled member, fresh audience projection, historic deleted text and private presence. Capture stored/wire bytes, recovery/export behavior, actual dependencies/services, device resource use and new Grove-owned code. Authoritative consent/role history stays outside an ordinary mutable document unless the chosen system supplies an independently validated equivalent.

Plain local capture and privacy cannot depend on a CRDT benchmark. The accepted preferences are Solid for optional storage and Yjs for optional co-editing, subject to their security/recovery gates. EDV and Automerge + Keyhive remain research alternatives; a successful comparison does not make Keyhive production-ready. Record availability, attachments, export/migration and remaining build work explicitly.

## Browser community network

Pairing establishes trust. WebRTC establishes an active connection through a separately authenticated signaling path; STUN/TURN can assist cross-network reachability. HTTPS storage supports peers that are not online together. Encrypted files support intervals without reachable services. [WebRTC connection model](https://webrtc.org/getting-started/peer-connections).

Neither a CRDT nor a replication library supplies automatic browser radio discovery, always-running phone relays or multi-hop delivery. Bluetooth remains a consented GATT sensor adapter where supported. A dedicated node is optional, but some reachable replica is needed for unattended asynchronous delivery. Record these availability limits instead of calling every peer connection a mesh.
