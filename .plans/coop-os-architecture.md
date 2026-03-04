# Coop OS Architecture

**Status**: DRAFT v2
**Created**: 2026-03-01
**Updated**: 2026-03-03
**Scope**: Browser PWA + Browser Extension (hardware tier is future — architecture is modular to port)

---

## Vision

Coop is a browser-based OS for regenerative coordination. TypeScript-first, skills-based, bioregional, voice-first. Communities capture impact, coordinate governance, build knowledge commons, and discover funding — all through a P2P mesh where every browser is a node.

**Scope boundary**: This plan covers the PWA and browser extension. The architecture is modular so that skills, state, and mesh protocols can port to hardware runtimes (OpenClaw, DappNode, bare metal) in the future without rewriting core logic.

## Design Goals & Tensions (Staying Relevant as AI Changes)

Coop should stay useful as **models, agent SDKs, and UIs churn**. The way to avoid “outdated in 6 months” is to keep a stable *thin waist* and make everything else swappable.

- **Thin-waist kernel**: `CoopKernel` + `PlatformAdapter` + `Skill` contracts + versioned state schemas. Everything else (models, SDKs, transport, UI shell) is pluggable.
- **Progressive enhancement**: baseline value works on low-end devices (PWA, offline, lightweight AI). “Power tier” emerges when a community has extension/hardware nodes (persistent background, automation, relays).
- **Local-first by default**: member devices are the source of truth; network services are optional accelerators (relays, pinning, hosted bots, hosted AI).
- **Heterogeneous compute**: route tasks to the cheapest available execution (tiny local → WebGPU → community node → paid API), with explicit budgets and graceful degradation.
- **Human legibility**: community memory should be exportable to formats people already know (Markdown, Git) so it survives tool churn and stays auditable.
- **Clear trust boundaries**: integrations and autonomous actions are opt-in skills with permissions, logs, and “human review” points where it matters.

## Four Pillars (Lenses, Not Categories)

Pillars are **query lenses** into a shared capability mesh, not skill containers.

1. **Impact Reporting** — evidence capture, verification, attestation
2. **Coordination & Governance** — proposals, voting, roles, messaging
3. **Knowledge Commons** — docs, data, AI-assisted curation, community memory
4. **Capital Formation** — grants, staking yield, impact certificates, treasury

## Core Entity Model (Coop / Member / Node)

- **Coop (shared brain)**: a set of community-scoped CRDT documents + policies + skills + identifiers. This is the “hive” layer.
- **Member (human)**: has a personal device state (drafts, preferences, private notes), plus permissioned access to one or more coops.
- **Node (runtime on a device)**: runs the Coop kernel in a specific shell (PWA, extension, future hardware). Nodes replicate shared coop state and can volunteer compute/relay/pinning depending on capabilities.
- **Skills (integrations)**: capability providers with typed interfaces (funding search, governance, posting, wallet ops, etc.). Skills are *the unit of adaptability* as the ecosystem changes.

**Terminology note**: this plan uses **“coop”** (the product) and **“community”** (Green Goods naming) interchangeably. A single coop instance is keyed by `community_id` / `communityId` throughout storage + routing.

### Multi-coop Membership (One Person, Many Coops)

Yes — the plan is designed for a person to participate in multiple coops at once:

- **Identity**: membership is represented by a **per-coop** `member_did` (privacy; no cross-coop correlation by default). One device stores a local mapping: `{ communityId → memberDid + roles }`.
- **State isolation**: each coop has its own shared Yjs state (`community:{id}`) and its own coop config (skills enabled, credential refs, roles). Personal state is coop-scoped (`user:{did}`) plus optional **device-global** prefs.
- **Storage namespacing**:
  - SQLite tables include `community_id` columns so a single device DB can index many coops.
  - OPFS/binary store is partitioned by `community_id` (e.g., `/coop/{communityId}/blobs/...`) to keep quotas and exports clean.
- **Runtime**: a single node can join multiple meshes by running multiple sync instances (e.g., one libp2p topic/sync provider per `communityId`) and routing jobs by `communityId`.

### Dormancy, Re-Activation, and Persistence Anchors

Pure P2P has an availability cliff: if *every* peer for a coop goes offline, the coop is dormant and shared state becomes temporarily unreachable. The architecture should support optional “anchors” so coops can go dormant without losing durability:

- **Always-on nodes**: extension super-peers and future hardware nodes keep the coop reachable and preserve state.
- **Content pinning**: IPFS/Helia → optional **Storacha (Filecoin-backed)** and/or self-hosted IPFS pinning for durable blobs (media, attachments).
- **Snapshot exports (“long memory”)**: periodic deterministic export of curated knowledge + indexes, published to **Git (GitHub or self-hosted)** and/or **Filecoin (via Storacha)** for durable, decentralized backup and easy seeding of new nodes.
- **Hosted bridge services (optional)**: hosted relays/bots for communities without always-on devices (kept minimal and replaceable).

---

## Identity Model (Node / Member / Coop / Mesh)

Coop needs identity for **attribution**, **authorization**, and **durable public presence** without falling back to centralized accounts.

Design principle: keep identity **layered** and **least-privilege**:
- Transport identity (who is on the wire) is not governance identity (who is allowed to act).
- External channel identities (Bluesky, Telegram) are *credentials owned by the coop*, not shared join secrets.
- Everything here is exposed as `identity:*` and `social:*` interfaces so skills can swap implementations without changing core logic.

### Identity Types (Inventory)

#### A) Node Identity (Runtime / Transport)

Each device running Coop is a node.

- **`peer_id` (libp2p PeerId)**: transport-level identity for encrypted mesh sessions + routing.
  - Ephemeral in PWA unless explicitly persisted; persistent in extension/hardware tier.
- **`node_id` (UUID)**: local stable label for analytics-free ops (capabilities, uptime, storage quotas).

**Why**: `peer_id` answers “who am I talking to on the wire?” but not “who is allowed to vote / publish official outputs?”

#### B) Member Identity (Human)

- **`member_did`**: **per-coop DID** (privacy; avoids cross-coop correlation).
- **DID method**: **`did:key` in the browser tier** (no server required). Upgrade path to `did:web` later if a coop wants domain anchoring.
- **Key type**: P‑256 / ES256 in early phases (browser-friendly; works widely with WebCrypto).

**Storage & unlock model (pilot-friendly)**:
- Member signing key is stored locally (IndexedDB/OPFS/extension storage), encrypted at rest.
- A **passkey** (WebAuthn) or device gate is used to unlock a session key that decrypts the local signing key.
- Coop does not require a cloud account or phone number to join.

#### C) Coop Identity (The “Hive”)

- **`coop_did`**: coop’s public identity for “official” outputs:
  - signing curated snapshot manifests (published to Git and/or Filecoin),
  - signing announcements/digests,
  - signing credential attestations the coop chooses to publish.
- **DID method**: start with `did:key`, upgrade to `did:web` when the coop has a domain and stable service endpoints.

**Custody**:
- Coop signing keys live only on trusted **anchor nodes** (extension/hardware/minimal hosted worker).
- Joining a coop must never grant the ability to impersonate the coop publicly.

#### D) Coop Mesh / Network Identity (Namespace + Discovery Contract)

Represent the mesh as a stable namespace and public descriptor (not as another “account”):

- **`community_id`**: deterministic ID derived from `coop_did` (e.g., `base32(sha256(coop_did))`).
  - This is the ID used everywhere else: `community:{id}` doc IDs, SQLite `community_id`, OPFS namespaces, mesh routing, etc.
- **`mesh_topic`**: derived from `community_id` for PubSub/rendezvous/doc prefixes (e.g., `coop/community/{community_id}/v1`).
- **`coop_descriptor` (public JSON)**: publishable and seedable via **long memory** (Git and/or Filecoin archives) and linkable from Bluesky.

Example:

```json
{
  "coop_did": "did:key:z6Mkh...",
  "community_id": "b32:7k2m... (sha256)",
  "mesh_topic": "coop/community/7k2m.../v1",
  "bootstrap_multiaddrs": ["/dns4/relay.coop.earth/tcp/443/wss/p2p/12D3KooW..."],
  "seed_repo": "https://github.com/<org>/<community>-garden (optional)",
  "latest_snapshot": {
    "export_hash": "sha256:... (deterministic export bundle hash)",
    "git_ref": "refs/tags/2026-03 (optional)",
    "filecoin_root_cid": "bafy... (optional)"
  },
  "bluesky_handle": "inlandempire.coop",
  "telegram_bot_username": "inlandempirecoop_bot"
}
```

#### E) External Identities (Kept Separate)

External identities are integration credentials (skills), **not** the coop membership identity:

- **Bluesky/ATProto**: coop’s public presence and discovery surface.
- **Telegram**: coop bot identity for group posting + intake.
- **OpenCred verifier DID (`did:web`)**: identity of the hosted verification checkpoint (for VC proof provenance).

### Key & Secret Management (Viability)

Non-negotiable rule: **never reuse external-channel credentials as coop join secrets**.

Pilot-friendly hierarchy:
- **Member signing key**: signs member actions; stored locally; unlockable with passkey/session gate.
- **Coop signing key**: signs “official coop” outputs; stored only on anchor nodes.
- **Channel tokens** (Bluesky app password/OAuth, Telegram bot token): stored only on anchor nodes; never replicated into shared CRDT state.

Rotation & recovery:
- **Member key loss**: member generates a new `member_did`; operator approves a “rotate DID” event (revokes old DID permissions).
- **Coop key rotation**: publish a `coop_did_rotated` event signed by the old coop key; update `coop_descriptor`.

### Bootstrap Flows (Create Coop / Join / Add Anchor / Connect Channels)

These flows make the identity model implementable in a browser-first world.

#### Flow A: Create a Coop (founder)

1. Founder chooses: `name`, `bioregion`, initial skills, retention policy.
2. Founder node generates a coop keypair via WebCrypto and creates:
   - `coop_did` (`did:key:...`)
   - `community_id` (derived) + `mesh_topic`
3. Initialize shared state: create `community:{id}` Yjs doc with `config`.
4. Founder node generates their per-coop `member_did` and writes:
   - `MemberProfile` (public display info)
   - `NodeBinding` (PeerId ↔ member DID + capabilities)
5. Founder creates invite(s):
   - `invite_code` is a short-lived join secret that bootstraps member DID creation + initial permissions.
   - Invites are *not* channel credentials and can be revoked/rotated independently.

**Note on coop key custody**:
- Preferred: create the coop while running an **anchor node** (extension/hardware), so the coop signing key is held in `SecretVault`.
- If a coop is created from a PWA-only node, it can still mint `coop_did`, but outbound “official” actions should remain manual until an anchor node is added (or the coop rotates to a new `coop_did` held by an anchor).

#### Flow B: Join a Coop (new member)

1. Member opens `invite_link` (PWA or extension UI).
2. Client generates a per-coop `member_did` (`did:key`) and stores the private key locally (encrypted; passkey unlock).
3. Client announces presence on the mesh and syncs `community:{id}`.
4. Client writes:
   - `MemberProfile` (minimal by default; optional later)
   - `NodeBinding` (bind this node’s `peer_id` to `member_did`)
5. Optional: member requests roles (e.g. `reviewer`, `publisher`) and (optional) runs OpenCred verification for “verified local” badges.

#### Flow C: Add an Anchor Node (upgrade capabilities)

1. Member installs extension on a laptop/desktop and joins the coop (Flow B).
2. Member requests an elevated role (e.g. `anchor`) via governance/roles skill.
3. Once approved, the node publishes an updated `NodeBinding.capabilities` that includes:
   - `persistentBackground=true`, channel posting caps, and optional `canAutomateBrowser=true`.
4. Only anchor nodes can hold long-lived channel secrets and execute outward actions.

**Important**: nodes should never receive other members’ private keys. A node only holds:
- its own member signing key(s) for coops the human joined, and
- optional coop/channel secrets *only if* it is an approved anchor.
All other member identities are represented by public DIDs + signatures + `NodeBinding` records.

#### Flow D: Connect Channel Identities (email/social/telegram)

These are always **CredentialRef + SecretVault** operations:

- **Email (OAuth)**:
  - Anchor uses `chrome.identity` to connect a mailbox → stores refresh token in `SecretVault` → publishes `CredentialRef` in shared config.
- **Bluesky**:
  - Anchor stores app password/OAuth token in `SecretVault` → publishes `CredentialRef` with `accountHandle`.
- **Telegram**:
  - Operator creates bot via BotFather → anchor stores `bot_token` in `SecretVault` → coop stores `{ chat_id, bot_username }` linkage in shared config.

Security rule: only `credentialRefId` is replicated; secrets never enter `community:{id}` or Git exports.

### Binding: Node ↔ Member (PeerId → Member DID)

Nodes must prove which member they represent so peers can:
- attribute actions,
- route tasks to capable nodes,
- gate high-risk skills (posting, treasury ops, governance execution).

**`NodeBinding` record** (stored in shared state; indexed locally for fast queries):

```ts
type NodeBinding = {
  communityId: string;
  peerId: string;                 // libp2p PeerId string form
  nodeId: string;                 // UUID
  memberDid: string;              // did:key:...
	  capabilities: {
	    persistentBackground: boolean;
	    relay: boolean;
	    canPostTelegram: boolean;
	    canPostEmail: boolean;
	    canPostBluesky: boolean;
	    canAutomateBrowser: boolean;   // CDP/content-script automation (high-trust)
	    hasWebgpu: boolean;
	  };
  issuedAt: number;               // unix ms
  expiresAt: number;              // unix ms
  signature: string;              // signature by memberDid key
};
```

### Signed Shared-State Envelope (Batch-Signed CRDT Updates)

To make “every Yjs update is signed” implementable:
- sign **transactions/batches** (not per keystroke),
- verify **before apply**,
- drop invalid signatures (untrusted network boundary).

```ts
type SignedYjsUpdate = {
  docId: string;                  // community:{id} (shared) or user:{did} (personal)
  yjsUpdate: Uint8Array;          // binary Yjs update
  authorMemberDid: string;
  authorPeerId: string;
  createdAt: number;              // unix ms
  signature: string;              // authorMemberDid signature over {docId, sha256(yjsUpdate), createdAt}
};
```

---

## Architecture: PWA + Extension


### Why Two Surfaces

| Capability | PWA (coop.earth) | Extension |
|---|---|---|
| Onboarding | URL → instant access | Store install (friction) |
| Mobile | Full support (iOS/Android) | Chrome Android only, no iOS |
| Background runtime | Killed after ~5 min idle | **Best-effort while browser open** (MV3 offscreen doc + alarms) |
| Cross-origin access | Same-origin only | **Any website** |
| Inject into existing tools | Impossible | **Content scripts on GitHub, Drive, etc.** |
| Native messaging | Impossible | **Bridge to local hardware services** |
| P2P relay duty | Only while tab is open | **While browser is open** (hours/day) |
| Storage quota | ~2-10GB (origin-scoped) | ~10GB+ (extension-scoped + OPFS) |
| Tab/window management | Cannot create/manage | **Can open side panel, manage tabs** |
| System notifications | Push API (requires server) | **chrome.notifications (local)** |

**The pattern**: PWA is the universal front door (zero friction, mobile, offline). Extension is the power tier (persistent mesh node, cross-site integration, background processing).

### Extension Architecture (Manifest V3)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Coop Extension (MV3)                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Background Service Worker (ephemeral event router)       │   │
│  │                                                           │   │
│  │  ┌──────────────┐ ┌───────────────────────────────────┐ │   │
│  │  │ Alarms +     │ │ UI + content-script message bus    │ │   │
│  │  │ lifecycle    │ │ (routes events to offscreen)       │ │   │
│  │  └──────────────┘ └───────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐  │   │
│  │  │ Storage  │ │ Identity │ │ Native Messaging Bridge  │  │   │
│  │  │ Manager  │ │ (Passkey │ │ (future: Ollama, signal- │  │   │
│  │  │ (OPFS +  │ │  + DID)  │ │  cli, IPFS daemon)      │  │   │
│  │  │  SQLite) │ │          │ │                          │  │   │
│  │  └──────────┘ └──────────┘ └──────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌───────────────────┐  ┌─────────────────┐  │
│  │ Side Panel   │  │ Content Scripts   │  │ Popup           │  │
│  │              │  │                    │  │                  │  │
│  │ Main Coop UI │  │ Injected overlays: │  │ Quick actions:  │  │
│  │ (React app)  │  │ · GitHub: link     │  │ · Record impact │  │
│  │ Same as PWA  │  │   issues to Coop   │  │ · Ask Coop      │  │
│  │ components   │  │ · Google Drive:    │  │ · Mesh status   │  │
│  │              │  │   tag documents    │  │ · Node peers    │  │
│  │              │  │ · Grants.gov:      │  │                  │  │
│  │              │  │   save to Coop     │  │                  │  │
│  │              │  │ · Bluesky: cross-  │  │                  │  │
│  │              │  │   post from Coop   │  │                  │  │
│  └──────────────┘  └───────────────────┘  └─────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Offscreen Document (long-lived anchor runtime)            │  │
│  │ Best-effort while browser is open; recreated if closed.   │  │
│  │ Hosts: mesh + sync, job loop, pollers, AuthBroker, vault. │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Key MV3 patterns:**

```typescript
	// manifest.json (Manifest V3)
	{
	  "manifest_version": 3,
	  "name": "Coop",
	  "permissions": [
	    "storage",           // extension-scoped storage
	    "alarms",            // wake SW to ensure offscreen runtime + scheduled jobs
	    "offscreen",         // long-lived anchor runtime (mesh, pollers, auth)
	    "sidePanel",         // main UI surface
	    "notifications",     // local system notifications
	    "identity",          // OAuth flows for platform auth (email, Drive, etc.)
	    "nativeMessaging",   // future: bridge to local services
	    "activeTab"          // content script injection
	  ],
	  "optional_permissions": [
	    "tabs",              // persistent tab management (automation workspace)
	    "scripting",         // dynamic script injection (site adapters)
	    "tabGroups",         // keep automation scoped to a tab group
	    "debugger"           // OPTIONAL (high-trust): CDP automation (click/type/screenshot)
	  ],
	  "host_permissions": [
	    "https://github.com/*",
	    "https://drive.google.com/*",
	    "https://www.grants.gov/*",
	    "https://bsky.app/*"
	  ],
	  "optional_host_permissions": [
	    "<all_urls>"         // request per-site if enabling general browser automation
	  ],
	  "background": {
	    "service_worker": "background.ts",
	    "type": "module"
	  },
  "side_panel": {
    "default_path": "sidepanel.html"  // full Coop UI
  },
  "content_scripts": [{
    "matches": ["https://github.com/*"],
    "js": ["content-scripts/github.ts"]
  }, {
    "matches": ["https://www.grants.gov/*"],
    "js": ["content-scripts/grants.ts"]
  }]
}
```

```typescript
// Offscreen document — long-lived anchor runtime (best-effort while browser is open)
// MV3 service workers are ephemeral; do NOT rely on them for WebRTC/libp2p sessions.
// Use alarms to recreate offscreen + rejoin mesh if the runtime is suspended/closed.

// background.ts
chrome.offscreen.createDocument({
  url: 'offscreen.html',
  reasons: ['WEB_RTC'],   // Maintaining WebRTC connections for mesh sync
  justification: 'Maintaining P2P mesh connections for community sync'
});

// offscreen.ts — hosts the anchor runtime
import { createCoopMeshNode } from '@coop/mesh';
import { createYjsSyncEngine } from '@coop/sync';

const mesh = await createCoopMeshNode();
const sync = await createYjsSyncEngine(mesh);

// Best-effort while the browser is open:
// - Maintains mesh connections + Yjs sync
// - Runs the agentic loop + job queue
// - Runs pollers (email, telegram) + AuthBroker token refresh
```

### Shared Code Between PWA and Extension

The core logic is identical — only the shell differs:

```
packages/
├── coop-core/              ← Shared (skills, state, mesh, AI)
│   ├── skills/             ← Skill loader + interface registry
│   ├── state/              ← Yjs + SQLite + storage manager
│   ├── mesh/               ← libp2p node + sync engine
│   ├── ai/                 ← Whisper, embeddings, LLM routing
│   ├── identity/           ← Passkey + DID
│   └── templates/          ← Bioregional template engine
│
├── coop-pwa/               ← PWA shell (vite-plugin-pwa, SW, manifest)
│   ├── src/App.tsx         ← React app using coop-core
│   └── sw.ts               ← Service worker (Workbox + mesh bootstrap)
│
├── coop-extension/         ← Extension shell (MV3 manifest, content scripts)
│   ├── background.ts       ← SW: lifecycle + alarms + message router (ephemeral)
│   ├── offscreen.ts        ← Anchor runtime: mesh + sync + job loop + AuthBroker
│   ├── sidepanel.tsx        ← React app using SAME components as PWA
│   ├── popup.tsx            ← Quick actions
│   └── content-scripts/    ← GitHub, Drive, Grants.gov overlays
│
└── coop-shared-ui/         ← Shared React components (Orb, feeds, forms)
    ├── Orb.tsx
    ├── RecordingFlow.tsx
    ├── CommunityFeed.tsx
    └── ...
```

**The modularity contract**: `coop-core` has zero browser API dependencies — it uses injected adapters for storage, networking, and platform APIs. This means the same `coop-core` can run in a Node.js/Bun process (future OpenClaw skill) or a WASM runtime without changes.

```typescript
// coop-core/platform.ts — thin-waist contract (injected by shell)
//
// Keep coop-core portable: no direct browser APIs (chrome.*, DOM, IDB types) here.
// Concrete shells (PWA/extension/daemon) provide implementations for these adapters.
// See "Hardware Portability Contract" for the full adapter interfaces.

interface PlatformAdapter {
  storage: StorageAdapter;
  network: NetworkAdapter;
  ai: AIAdapter;
  auth: AuthAdapter;
  capabilities: PlatformCapabilities;
}

type PlatformCapabilities = {
  persistentBackground: boolean;    // PWA: false; extension/offscreen: best-effort while browser is open
  crossOrigin: boolean;             // PWA: same-origin only; extension: content scripts
  nativeMessaging: boolean;         // extension can bridge to a local daemon
  camera: boolean;
  notifications: 'push' | 'local' | 'none';
};
```

---

## Data Storage Architecture

### Storage Layers

```
┌──────────────────────────────────────────────────────────────────┐
│                     Coop Data Storage                             │
│                                                                   │
│  Layer 1: Yjs Documents (CRDT — conflict-free, P2P synced)       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ What: Collaborative state that multiple peers edit          │  │
│  │ Persisted to: IndexedDB via y-indexeddb                     │  │
│  │ Synced via: y-webrtc / libp2p (P2P, no server)             │  │
│  │ Size: ~1-50MB per community (text + metadata)               │  │
│  │                                                              │  │
│  │ Documents:                                                   │  │
│  │   community:{id}        → shared coop state (Y.Doc)         │  │
│  │     · feed, members, proposals, knowledge, jobs, approvals  │  │
│  │     · node_bindings, attestations, config                   │  │
│  │   user:{did}            → personal state (Y.Doc)            │  │
│  │     · calibration, drafts, prefs                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Layer 2: wa-sqlite on OPFS (Local queries — NOT synced P2P)     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ What: Structured data for complex queries, aggregations     │  │
│  │ Persisted to: OPFS via wa-sqlite VFS                        │  │
│  │ Populated from: Yjs document changes + API fetches           │  │
│  │ Size: ~10-500MB (grows with usage)                           │  │
│  │                                                              │  │
│  │ Tables:                                                      │  │
│  │   impact_logs       → denormalized work submissions          │  │
│  │   community_members → member profiles + roles                │  │
│  │   proposals         → governance proposals + vote tallies    │  │
│  │   knowledge_docs    → full-text searchable document index    │  │
│  │   funding_sources   → cached grant/program data              │  │
│  │   ai_embeddings     → vector embeddings for semantic search  │  │
│  │   sync_state        → last-seen timestamps per peer          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Layer 3: OPFS Binary Store (Media files)                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ What: Photos, optional audio attachments, video clips       │  │
│  │ Persisted to: OPFS (fast, quota-managed, no IndexedDB bloat)│  │
│  │ Referenced by: CID (content hash) in Yjs documents          │  │
│  │ Synced via: Helia (IPFS) when peers request content          │  │
│  │ Size: ~100MB-2GB+ (auto-prune *cache class* when near quota)│  │
│  │                                                              │  │
│  │ Directory structure:                                         │  │
│  │   /coop/blobs/{communityId}/{cid}       → original media     │  │
│  │   /coop/blobs/{communityId}/{cid}.thumb → thumbnails         │  │
│  │   /coop/cache/models/                  → cached ML models    │  │
│  │   /coop/cache/skills/                  → cached skills       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Layer 4: Cache API (HTTP responses — ephemeral)                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ What: API responses from external services                  │  │
│  │ Managed by: Service Worker (Workbox strategies)              │  │
│  │ Strategies:                                                  │  │
│  │   StaleWhileRevalidate: Grants.gov, USAspending (24h)       │  │
│  │   CacheFirst: ML models, skill bundles (versioned)           │  │
│  │   NetworkFirst: blockchain RPC, indexer queries              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Layer 5: “Long Memory” Publish (Git / Filecoin — optional)      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ What: Curated snapshots (Markdown + JSON) + archive (CAR)   │  │
│  │ Persisted to: local export folder; optionally Git + Filecoin │  │
│  │ Published via: git push/GitHub API; Storacha upload (CID)    │  │
│  │ Purpose: durability, auditability, easy seeding, decentral. │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### User Mental Model (Create → Share → Find → Export)

From a user standpoint, Coop data lives in three buckets:

1. **My device (private)** — drafts, preferences, personal notes, AI calibration memory.
2. **Our coop (shared)** — the community feed, member list, proposals, and knowledge *references* (metadata + CIDs).
3. **Published snapshots (optional)** — curated “long memory” publishes to a local folder and optionally **Git** and/or **Filecoin**.

**Create** (offline-safe): anything you generate is saved locally first.

- Voice note → transcription + metadata saved immediately (raw audio discarded by default; attachments are opt-in).
- Photo / doc / field log → stored locally (OPFS) immediately.
- A “draft” is private until you explicitly share/submit.

**Share** (what makes it “in the coop”): sharing creates a signed, append-only entry in the coop’s shared CRDT state.

- The shared state stores *metadata + references*, not giant blobs.
- Large content (photos/docs and optional audio attachments) is content-addressed (CID) and fetched on-demand from peers/pinning.

**Find** (instant, offline-first): search and filters run against the local query index (SQLite) and work without internet.

- Results can show availability: “local”, “available from peers”, or “needs network/pin”.

**Export** (durability + legibility): “Publish snapshot” writes a deterministic folder (Markdown/JSON) that can be pushed to GitHub (or self-hosted Git) and/or archived to Filecoin (via Storacha) as a content-addressed CAR.

**Important distinction**: mesh sync is the *live* shared state; Git/Filecoin publishes are *long memory* (snapshots), not the primary sync mechanism.

### Query, Caching, and Offline (User View)

- **Search is local-first**: Coop writes structured data into SQLite and maintains:
  - Full-text search for knowledge (`knowledge_fts`)
  - Filters (tags, member, time, location, grant deadlines, proposal status)
  - Optional semantic search (embeddings) for “show me related”
- **Caches are transparent**:
  - Web sources (grants listings, docs previews) are cached by the Service Worker with explicit “freshness” timers.
  - Content scripts (extension) can capture structured metadata so the coop can query it even if the source site changes.
- **Offline behaviors feel natural**:
  - You can always create (record, write notes, tag items).
  - Sharing queues/syncs when peers appear; the UI shows “synced to X peers”.
  - Missing blobs are lazy-fetched later (from peers or pins) without blocking the main experience.

### Backup & Seeding (Git + Filecoin)

Coop supports **two optional long-memory stores** for durability and portability:
- **Git (GitHub or self-hosted)**: best for human legibility, diff/PR workflows, and community curation.
- **Filecoin (via Storacha)**: best for decentralized, content-addressed archival of immutable snapshot bundles (and durable media pinning).

These options are independent and can be used together. The unifying object is the deterministic snapshot export hash (`export_hash`), which can be referenced by both a Git ref and a Filecoin root CID.

**Publishing options (can coexist)**:

1) **Git-only**
- Manual export → human pushes with normal Git workflows, or
- GitHub API sync (extension/power node) → commits/PRs via API (no local `git` required), or
- Native `git` (power node) → best for signed commits and automation.

2) **Filecoin-only**
- Export deterministic snapshot → package as a **CAR** → upload via Storacha → record the **root CID** in shared state and/or `coop_descriptor`.
- Treat Filecoin as **public by default**. For private archives, encrypt the bundle client-side before generating the CAR (keys shared only inside the coop).

3) **Dual (recommended for many coops)**
- Git for the readable “knowledge garden” + Filecoin for the immutable archive of the same snapshot bundle.
- Both references point to the same `export_hash` so clients can verify consistency.

Seeding a new coop/node:
- From Git: pull a seed repo snapshot (templates, curated docs, indexes) → then join the mesh for live CRDT state.
- From Filecoin: fetch the snapshot CAR by CID (via IPFS/gateway/Storacha retrieval) → expand/import → then join the mesh.
- Seed stores should avoid secrets/private tokens; large media stays CID-addressed and can be pinned separately.

### SQLite Schema

```sql
-- Core tables populated from Yjs document changes

CREATE TABLE impact_logs (
  id TEXT PRIMARY KEY,            -- UUID
  author_did TEXT NOT NULL,       -- DID of person who recorded
  community_id TEXT NOT NULL,     -- which Coop community
  recorded_at INTEGER NOT NULL,   -- unix timestamp
  transcription TEXT,             -- raw voice transcription
  perceived_impact TEXT,          -- AI's initial classification
  actual_impact TEXT,             -- user-corrected classification
  action_type TEXT,               -- "water_monitoring", "planting", etc.
  location_name TEXT,             -- human-readable location
  location_geo TEXT,              -- "lat,lng" if available
  media_cids TEXT,                -- comma-separated IPFS CIDs
  synced_at INTEGER,              -- null = not yet synced to chain
  attestation_uid TEXT,           -- EAS UID once attested on-chain
  FOREIGN KEY (community_id) REFERENCES communities(id)
);

CREATE TABLE communities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bioregion_id TEXT,
  template_id TEXT,
  created_at INTEGER NOT NULL,
  member_count INTEGER DEFAULT 0
);

CREATE TABLE community_members (
  community_id TEXT NOT NULL,
  did TEXT NOT NULL,
  display_name TEXT,
  roles TEXT,                     -- JSON array of hat IDs
  joined_at INTEGER NOT NULL,
  last_active_at INTEGER,
  PRIMARY KEY (community_id, did)
);

-- Node ↔ Member bindings (for attribution, routing, and capability gating)
CREATE TABLE node_bindings (
  community_id TEXT NOT NULL,
  peer_id TEXT NOT NULL,          -- libp2p PeerId
  node_id TEXT NOT NULL,          -- UUID (device-local label)
  member_did TEXT NOT NULL,       -- did:key:... (per-coop)
  capabilities TEXT NOT NULL,     -- JSON (persistent_background, relay, etc.)
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  signature TEXT NOT NULL,        -- member signature
  PRIMARY KEY (community_id, peer_id)
);

-- Local mesh sync state (NOT shared) — used for fast routing and last-seen metrics
CREATE TABLE sync_state (
  community_id TEXT NOT NULL,
  peer_id TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,  -- unix ms
  last_rtt_ms INTEGER,            -- optional
  notes TEXT,                     -- JSON (implementation-defined)
  PRIMARY KEY (community_id, peer_id)
);

-- Agentic loop orchestration (local durable queue + idempotent execution)
-- Shared job/claim/approval metadata lives in Yjs; SQLite provides restart-safe scheduling, retries, and dedupe.
CREATE TABLE job_queue (
  job_id TEXT PRIMARY KEY,        -- matches shared Job.id
  community_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,           -- "queued", "running", "done", "failed"
  input_refs TEXT NOT NULL,       -- JSON array (pointers into Yjs/SQLite/OPFS)
  run_after INTEGER,              -- unix ms; null = runnable now
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Outbound action dedupe (prevents double-posting across retries or failover)
CREATE TABLE outbound_actions (
  action_id TEXT PRIMARY KEY,     -- UUID
  community_id TEXT NOT NULL,
  channel TEXT NOT NULL,          -- "telegram" | "email" | "bluesky"
  idempotency_key TEXT NOT NULL,  -- derived from (jobId, destination, contentHash)
  request_hash TEXT NOT NULL,     -- hash of redacted request payload for audit
  status TEXT NOT NULL,           -- "queued" | "sent" | "failed"
  provider_message_id TEXT,
  created_at INTEGER NOT NULL,
  executed_at INTEGER
);

CREATE UNIQUE INDEX idx_outbound_dedupe
  ON outbound_actions(community_id, channel, idempotency_key);

-- On-chain execution tracking (local; shared state stores only drafts + public results)
CREATE TABLE chain_transactions (
  tx_hash TEXT PRIMARY KEY,       -- 0x...
  community_id TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  kind TEXT NOT NULL,             -- "impact_attest" | "safe_execute" | ...
  draft_id TEXT,                  -- shared OnchainActionDraft.id (if applicable)
  to_address TEXT NOT NULL,
  value TEXT,                     -- wei (string for bigint)
  data_hash TEXT,                 -- sha256(calldata) for audit without leaking details
  status TEXT NOT NULL,           -- "queued" | "sent" | "confirmed" | "failed"
  created_at INTEGER NOT NULL,
  sent_at INTEGER,
  confirmed_at INTEGER,
  block_number INTEGER,
  receipt_json TEXT
);

CREATE INDEX idx_chain_tx_status
  ON chain_transactions(community_id, status, created_at);

-- Inbound polling cursors (per provider + credentialRefId) to avoid duplicates
CREATE TABLE inbound_cursors (
  provider TEXT NOT NULL,         -- "google_gmail" | "microsoft_graph" | "telegram"
  credential_ref_id TEXT NOT NULL,
  cursor TEXT NOT NULL,           -- historyId / lastMessageId / update offset
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, credential_ref_id)
);

-- Optional VC-derived attestations (store only minimized claims, never PII)
CREATE TABLE credential_attestations (
  id TEXT PRIMARY KEY,            -- UUID
  community_id TEXT NOT NULL,
  member_did TEXT NOT NULL,
  kind TEXT NOT NULL,             -- "residency", ...
  region_code TEXT,               -- e.g. "US-CA-IE-RIV"
  verifier_did TEXT,              -- did:web:...
  verified_at INTEGER NOT NULL,
  expires_at INTEGER,
  proof_hash TEXT
);

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  proposer_did TEXT NOT NULL,
  voting_method TEXT NOT NULL,    -- "conviction", "simple", "quadratic"
  status TEXT DEFAULT 'active',   -- "active", "passed", "failed", "executed"
  created_at INTEGER NOT NULL,
  closes_at INTEGER,
  conviction_pct REAL,            -- current conviction percentage
  FOREIGN KEY (community_id) REFERENCES communities(id)
);

CREATE TABLE knowledge_docs (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,                   -- full text for FTS
  content_type TEXT,              -- "markdown", "pdf", "link"
  source_skill TEXT,              -- which skill created this
  author_did TEXT,
  created_at INTEGER NOT NULL,
  tags TEXT                       -- JSON array
);

-- Full-text search index for knowledge
CREATE VIRTUAL TABLE knowledge_fts USING fts5(
  title, content, tags,
  content=knowledge_docs,
  content_rowid=rowid
);

-- Funding source cache (populated from API skills)
CREATE TABLE funding_sources (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,           -- "grants_gov", "sam", "retropgf", "candid"
  title TEXT NOT NULL,
  description TEXT,
  amount_min INTEGER,
  amount_max INTEGER,
  deadline INTEGER,               -- unix timestamp, null = rolling
  eligibility TEXT,               -- JSON array of criteria
  url TEXT,
  bioregion_match REAL,           -- 0-1 relevance score for this bioregion
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER              -- when to re-fetch
);

-- AI calibration (per-user, local only, never synced)
CREATE TABLE ai_calibration (
  did TEXT NOT NULL,
  pattern_key TEXT NOT NULL,      -- "location_alias", "activity_cluster", etc.
  pattern_value TEXT NOT NULL,    -- JSON
  confidence REAL DEFAULT 0.5,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (did, pattern_key)
);

-- Vector embeddings for semantic search
CREATE TABLE ai_embeddings (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,      -- "impact_log", "knowledge_doc", "funding"
  source_id TEXT NOT NULL,
  embedding BLOB NOT NULL,        -- Float32Array serialized
  model TEXT NOT NULL,             -- "all-MiniLM-L6-v2"
  created_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_impact_community ON impact_logs(community_id, recorded_at DESC);
CREATE INDEX idx_impact_author ON impact_logs(author_did, recorded_at DESC);
CREATE INDEX idx_impact_action ON impact_logs(action_type);
CREATE INDEX idx_node_bindings_member ON node_bindings(community_id, member_did);
CREATE INDEX idx_cred_attest_member ON credential_attestations(community_id, member_did, kind);
CREATE INDEX idx_funding_deadline ON funding_sources(deadline);
CREATE INDEX idx_funding_bioregion ON funding_sources(bioregion_match DESC);
CREATE INDEX idx_embeddings_source ON ai_embeddings(source_type, source_id);
```

### Yjs Document Design

```typescript
// Yjs documents are the P2P-synced source of truth
// SQLite is a local query cache populated FROM Yjs changes

import * as Y from 'yjs';

// One Yjs Doc per community — keeps sync scope bounded
function createCommunityDoc(communityId: string): Y.Doc {
  const doc = new Y.Doc();

  // Activity feed — append-only log of community activity
  const feed = doc.getArray<ActivityEntry>('feed');

  // Member profiles — keyed by DID
  const members = doc.getMap<MemberProfile>('members');

  // Node bindings (PeerId ↔ Member DID) — attribution, routing, capability gating
  const nodeBindings = doc.getMap<NodeBinding>('node_bindings');

  // Governance proposals
  const proposals = doc.getArray<Proposal>('proposals');

  // Knowledge index (not full content — just metadata + CIDs)
  const knowledge = doc.getMap<KnowledgeRef>('knowledge');

  // Optional minimized credential attestations (no PII)
  const attestations = doc.getArray<CredentialAttestation>('attestations');

  // Agentic loop coordination (shared job registry + approvals)
  const jobs = doc.getMap<Job>('jobs');
  const jobClaims = doc.getMap<Y.Array<JobClaim>>('job_claims');
  const jobResults = doc.getMap<Y.Array<JobResult>>('job_results');
  const approvals = doc.getMap<ApprovalGate>('approvals');

  // Community config (template, roles, governance settings)
  const config = doc.getMap<unknown>('config');

  return doc;
}

// Personal doc — per-user, NOT shared with community
function createPersonalDoc(did: string): Y.Doc {
  const doc = new Y.Doc();

  // AI calibration memory (patterns, corrections, confidence)
  const calibration = doc.getMap<CalibrationEntry>('calibration');

  // Draft recordings (in-progress, not yet submitted)
  const drafts = doc.getMap<DraftRecording>('drafts');

  // Notification preferences
  const prefs = doc.getMap<unknown>('prefs');

  return doc;
}

// Types
interface ActivityEntry {
  id: string;
  type: 'impact_logged' | 'member_joined' | 'proposal_created' |
        'proposal_passed' | 'funding_matched' | 'knowledge_added' |
        'message_sent' | 'message_received' | 'credential_attested';
  authorDid: string;
  timestamp: number;
  summary: string;        // human-readable summary
  data: Record<string, unknown>;  // type-specific payload
  mediaCids?: string[];   // references to OPFS binary store
}

Payload conventions (for dedupe + audit):
- `message_sent.data` SHOULD include: `{ actionId, channel, idempotencyKey, destination, contentHash, credentialRefId?, providerMessageId?, url? }`
- `message_received.data` SHOULD include: `{ sourceMessageId, channel, from, threadId?, snippet, credentialRefId? }`

Rule: `CredentialRef` identifiers are safe to share; secrets/tokens are never included in feed entries.

interface MemberProfile {
  did: string;
  displayName: string;
  bioregionFocus: string[];
  roles: string[];         // Hats Protocol hat IDs
  joinedAt: number;
  traits: string[];        // onboarding traits
}

interface Proposal {
  id: string;
  title: string;
  body: string;
  proposerDid: string;
  votingMethod: 'conviction' | 'simple' | 'quadratic';
  status: 'active' | 'passed' | 'failed' | 'executed';
  votes: Map<string, number>;  // did → weight
  createdAt: number;
  closesAt?: number;
}

interface KnowledgeRef {
  id: string;
  title: string;
  contentType: string;
  contentCid?: string;     // IPFS CID for full content
  sourceSkill: string;
  authorDid: string;
  tags: string[];
  createdAt: number;
}

interface NodeBinding {
  peerId: string;
  nodeId: string;
  memberDid: string;
  capabilities: Record<string, boolean>;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

interface CredentialAttestation {
  memberDid: string;
  kind: 'residency';
  regionCode?: string;
  verifierDid?: string;
  verifiedAt: number;
  expiresAt?: number;
  proofHash?: string;
}
```

### Data Flow: Yjs → SQLite Sync

```typescript
// Yjs changes automatically populate SQLite for local queries
// This is a REACTIVE PIPELINE, not a batch job

import { observeDeep } from 'yjs';

function bindYjsToSqlite(
  communityDoc: Y.Doc,
  db: SqliteDatabase
): void {
  const feed = communityDoc.getArray<ActivityEntry>('feed');

  // When a new activity is added to Yjs...
  feed.observeDeep((events) => {
    for (const event of events) {
      if (event.type === 'add') {
        for (const item of event.changes.added) {
          const entry = item.content.getContent()[0] as ActivityEntry;

          if (entry.type === 'impact_logged') {
            // Insert into SQLite for queryable access
            db.run(`
              INSERT OR REPLACE INTO impact_logs
              (id, author_did, community_id, recorded_at, transcription,
               actual_impact, action_type, location_name, media_cids)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              entry.id, entry.authorDid, communityDoc.guid,
              entry.timestamp, entry.data.transcription,
              entry.data.actualImpact, entry.data.actionType,
              entry.data.locationName, entry.data.mediaCids?.join(',')
            ]);
          }
        }
      }
    }
  });

  // Same pattern for members, proposals, knowledge...
}

// Query examples that SQLite enables (impossible with Yjs alone):
//
// "How many water monitoring logs this month?"
// SELECT COUNT(*) FROM impact_logs
// WHERE action_type = 'water_monitoring'
// AND recorded_at > strftime('%s', 'now', '-30 days')
//
// "Find grants matching our bioregion, sorted by deadline"
// SELECT * FROM funding_sources
// WHERE bioregion_match > 0.5 AND deadline > strftime('%s', 'now')
// ORDER BY deadline ASC
//
// "Search knowledge for 'watershed restoration'"
// SELECT * FROM knowledge_fts WHERE knowledge_fts MATCH 'watershed restoration'
```

---

## Mesh Network Architecture

### Topology

```
┌──────────────────────────────────────────────────────────────────┐
│                        Coop Mesh                                  │
│                                                                   │
│  Bioregion: Ojai Valley                                          │
│  Topic: /coop/bioregion/ojai-valley                              │
│                                                                   │
│     PWA Peers (ephemeral — online while tab open)                │
│     ┌─────┐  ┌─────┐  ┌─────┐                                   │
│     │María│  │David│  │ Ana │                                    │
│     │ PWA │  │ PWA │  │ PWA │                                    │
│     └──┬──┘  └──┬──┘  └──┬──┘                                   │
│        │        │        │                                        │
│        │   WebRTC DataChannels (direct P2P)                      │
│        │        │        │                                        │
│     ┌──▼────────▼────────▼──┐                                    │
│     │   Extension Peers     │  (semi-persistent — while browser  │
│     │   (relay backbone)    │   is open, even without Coop tab)  │
│     │                       │                                     │
│     │  ┌──────┐  ┌──────┐  │                                    │
│     │  │Sarah │  │ Luis │  │                                    │
│     │  │ Ext  │  │ Ext  │  │                                    │
│     │  └──┬───┘  └──┬───┘  │                                    │
│     └─────┼──────────┼──────┘                                    │
│           │          │                                            │
│           │  libp2p circuit relay                                 │
│           │  (NAT traversal for peers behind firewalls)          │
│           │          │                                            │
│     ┌─────▼──────────▼──────┐                                    │
│     │ Bootstrap Nodes       │  (public signaling — minimal,      │
│     │ (community-operated   │   only for initial peer discovery, │
│     │  or Coop-provided)    │   NOT for data relay)              │
│     │                       │                                     │
│     │  wss://signal.coop.earth (WebSocket signaling)             │
│     │  /ip4/.../p2p/Qm...   (libp2p bootstrap multiaddr)        │
│     └───────────────────────┘                                    │
│                                                                   │
│  Cross-bioregion link:                                           │
│  Extension peers with multiple community memberships             │
│  bridge bioregion topics via GossipSub                           │
└──────────────────────────────────────────────────────────────────┘
```

### Peer Discovery and Connection

```typescript
import { createLibp2p } from 'libp2p';
import { webRTC } from '@libp2p/webrtc';
import { webSockets } from '@libp2p/websockets';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { kadDHT } from '@libp2p/kad-dht';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { bootstrap } from '@libp2p/bootstrap';

async function createCoopMeshNode(config: {
  isPersistent: boolean;   // true for extension, false for PWA
  communityIds: string[];  // coop IDs (deterministic; see Identity Model)
}): Promise<CoopMeshNode> {
  const node = await createLibp2p({
    transports: [
      webRTC(),                        // Direct browser-to-browser
      webSockets({ filter: all }),     // To signaling/bootstrap servers
      circuitRelayTransport({          // Relay through other peers
        discoverRelays: 1,             // Find at least 1 relay peer
      }),
    ],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    peerDiscovery: [
      bootstrap({
        list: [
          // Minimal signaling server (community can self-host)
          '/dns4/signal.coop.earth/tcp/443/wss/p2p/QmBootstrap...',
        ],
      }),
    ],
    services: {
      pubsub: gossipsub({
        emitSelf: false,
        allowPublishToZeroTopicPeers: true,
        // Extension peers act as message relays
        floodPublish: config.isPersistent,
      }),
      dht: kadDHT({
        // PWA peers are DHT clients (query only)
        // Extension peers are DHT servers (store + serve records)
        clientMode: !config.isPersistent,
      }),
    },
  });

  // Subscribe to each coop mesh topic (one topic per community)
  for (const communityId of config.communityIds) {
    node.services.pubsub.subscribe(`coop/community/${communityId}/v1`);
  }

  // If extension peer, also serve as circuit relay for NAT traversal
  if (config.isPersistent) {
    // Extension peers relay connections for PWA peers behind NATs
    // This is the key benefit of running the extension
  }

  return wrapAsCoopMeshNode(node);
}
```

### Sync Protocol (Yjs over libp2p)

```typescript
// Custom Yjs provider that uses libp2p instead of y-webrtc's
// built-in signaling. Reuses Yjs's efficient binary sync protocol.
//
// IMPORTANT: In Coop, all update payloads are wrapped in `SignedYjsUpdate`
// and verified at the mesh boundary before `Y.applyUpdate(...)`.

import * as Y from 'yjs';
import {
  writeSyncStep1,     // sends local state vector
  writeSyncStep2,     // sends missing updates
  readSyncMessage,
} from 'yjs/dist/src/utils/sync.js';

function wrapSignedUpdate(update: Uint8Array): Uint8Array {
  // Encode { docId, yjsUpdate, authorMemberDid, authorPeerId, createdAt, signature }
  // into bytes. Signature covers {docId, sha256(yjsUpdate), createdAt}.
  return encodeSignedYjsUpdate(update);
}

function unwrapAndVerifySignedUpdate(data: Uint8Array): Uint8Array | null {
  const signed = decodeSignedYjsUpdate(data);
  if (!verifySignedYjsUpdate(signed)) return null;
  return signed.yjsUpdate;
}

class LibP2PYjsProvider {
  private doc: Y.Doc;
  private node: Libp2pNode;
  private topic: string;

  constructor(doc: Y.Doc, node: Libp2pNode, communityId: string) {
    this.doc = doc;
    this.node = node;
    this.topic = `coop/community/${communityId}/v1`;

    // Step 1: When a new peer joins, exchange state vectors
    this.node.services.pubsub.addEventListener('message', (msg) => {
      if (msg.detail.topic === this.topic) {
        this.handleSyncMessage(msg.detail.data, msg.detail.from);
      }
    });

    // Step 2: When local doc changes, broadcast update
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') {
        // ~200 bytes per keystroke/change — very efficient
        this.node.services.pubsub.publish(
          this.topic,
          this.encodeSyncUpdate(wrapSignedUpdate(update))
        );
      }
    });

    // Step 3: Announce presence to get initial sync
    this.announcePresence();
  }

  private handleSyncMessage(data: Uint8Array, from: PeerId): void {
    const decoder = new Decoder(data);
    const messageType = decoder.readVarUint();

    switch (messageType) {
      case 0: // sync step 1 — peer sends their state vector
        // Respond with updates they're missing
        const sv = decoder.readVarUint8Array();
        const diff = Y.encodeStateAsUpdate(this.doc, sv);
        this.sendToPeer(from, this.encodeSyncStep2(wrapSignedUpdate(diff)));
        break;

      case 1: // sync step 2 — peer sends updates we're missing
        const update = decoder.readVarUint8Array();
        const verified = unwrapAndVerifySignedUpdate(update);
        if (verified) Y.applyUpdate(this.doc, verified, 'remote');
        break;

      case 2: // incremental update
        const incUpdate = decoder.readVarUint8Array();
        const verifiedInc = unwrapAndVerifySignedUpdate(incUpdate);
        if (verifiedInc) Y.applyUpdate(this.doc, verifiedInc, 'remote');
        break;
    }
  }
}
```

### Swarm Compute (Task-Level Delegation)

“Distributed inference” (splitting a single model forward pass across peers) is fragile in browsers and doesn’t map cleanly onto heterogeneous devices. Coop should instead treat the mesh as a **task delegation fabric**:

- **Map**: split work into independent chunks (review 40 grants, summarize 20 docs, label 200 photos).
- **Dispatch**: publish jobs on the mesh with required capabilities (WebGPU? LLM API budget? extension-only?).
- **Claim**: nodes volunteer/claim based on capability + current load + user permissions.
- **Reduce**: merge results back into shared CRDT state (with provenance: which node/skill produced what).

This gives you “the hive is stronger with more nodes” without coupling the system to any particular model architecture, and it allows low-end phones to contribute (light classification, capture, review) while higher-end nodes handle heavier analysis.

### Agentic Loop & Orchestration (Per-Node + Anchor Execution)

Coop’s “agentic loop” is **event-driven** and **capability-gated**:
- **Any node** can *propose* work (draft digests, summaries, classifications) and write results into shared state with provenance.
- Only **authorized anchor nodes** (extension/hardware/hosted) can *execute outward actions* (Telegram, Bluesky, email) because they hold secrets and can run in background.

**Inputs**
- **EventBus**: typed events from mesh, skills, and state changes (`funding_source_found`, `message_received`, `proposal_created`, etc.).
- **JobQueue**: durable, restart-safe queue of work items (stored locally in SQLite/kv; jobs are replicated as *metadata* in shared state so peers can coordinate).

**Loop**

```
Observe → Enqueue → Claim → Plan → Execute → Commit → Audit

Two-phase safety split:
  1) Draft/Propose (any node): generate a preview (markdown/text/JSON)
  2) Execute (anchor only): send/post/do irreversible actions (after approval gates)
```

**Minimal job model**

```ts
type JobStatus = 'queued' | 'claimed' | 'planning' | 'ready' | 'executing' | 'done' | 'failed';

type Job = {
  id: string;
  communityId: string;
  kind: string; // "weekly_digest", "grant_eligibility_review", "email_poll", "telegram_post", ...
  createdByMemberDid: string;
  requiresCapabilities: string[]; // ["persistentBackground", "canPostEmail"]
  requiresRoles?: string[];       // ["anchor", "publisher"]
  inputRefs: Array<{ type: string; id: string }>; // pointers into Yjs/SQLite/OPFS
  status: JobStatus;
};

type JobClaim = {
  jobId: string;
  peerId: string;
  memberDid: string;
  claimedAt: number;
  leaseExpiresAt: number;
};

type JobResult = {
  jobId: string;
  outputRefs: Array<{ type: string; id: string }>;
  provenance: { peerId: string; memberDid: string; modelUsed?: string };
  createdAt: number;
};

type ApprovalGate = {
  jobId: string;
  riskLevel: 'low' | 'medium' | 'high';
  preview: { markdown?: string; json?: unknown };
  approvedByDid?: string;
  approvedAt?: number;
};
```

**Shared coordination state (replicated via Yjs)**

Jobs coordinate using small, signed metadata in shared state (not full local payloads or secrets):

- `community:{id}` (Y.Doc)
  - `jobs`: `Y.Map<jobId, Job>`
  - `job_claims`: `Y.Map<jobId, Y.Array<JobClaim>>` (append-only)
  - `job_results`: `Y.Map<jobId, Y.Array<JobResult>>` (append-only)
  - `approvals`: `Y.Map<jobId, ApprovalGate>`

Rule: nodes keep richer local context (embeddings, caches, full email bodies) in SQLite/OPFS, while shared job records point to data via `inputRefs` / `outputRefs`.

**Claiming & leases (deterministic winner)**

Multiple nodes may append claims concurrently. To avoid “split brain”, every node computes the same *effective executor*:

1. Consider only claims where `leaseExpiresAt > now`.
2. Rank each claim by `rank = sha256(jobId + ':' + peerId)` (lowest wins).
3. The winning claim’s `peerId` is the executor until it completes the job or its lease expires.
4. Winner renews its lease by appending a new claim before expiry (e.g., every 30–60s).
5. If the winner disappears, other nodes claim and a new winner deterministically emerges.

**Idempotency & dedupe (outward actions + inbound intake)**

Execution must be safe under retries and multi-anchor failover:

- Every irreversible outward action gets an `actionId` (UUID) and `idempotencyKey` derived from `(jobId, channel, destination, contentHash)`.
- Before sending/posting, an anchor node checks:
  1) local `outbound_actions` for `idempotencyKey`, and
  2) shared feed for an existing `message_sent` with the same `actionId`.
- If either exists, the executor no-ops and marks the job as done.

Inbound pollers use provider cursors + stable `sourceMessageId` fields so repeated polls do not create duplicate intake events.

**Node surfaces (capability matrix)**

| Capability | PWA | Extension (anchor) | Optional Local Daemon |
|---|---:|---:|---:|
| Runs in background | ❌ (SW killed) | ✅ (offscreen doc) | ✅ |
| Cross-origin capture | ❌ | ✅ (content scripts) | ✅ |
| Long polling | ⚠️ limited | ✅ | ✅ |
| Holds long-lived secrets | ⚠️ user-only | ✅ (SecretVault) | ✅ |
| Accepts inbound webhooks | ❌ | ❌ | ✅ |
| Full browser automation | ❌ | ⚠️ best-effort (CDP via `chrome.debugger`) | ✅ (Playwright) |

**Browser automation in the extension (Claude-in-Chrome paradigm)**

To support “continuous browser automation” in a way that resembles Claude-in-Chrome, Coop should treat the browser as a **tool surface** that an anchor node can use inside the agentic loop.

Two practical modes:

1) **Content-script adapters (low-trust, site-specific)**:
   - Works on an allowlist of domains with explicit `host_permissions`.
   - Extracts structured data and can perform simple DOM actions (click/type) inside the page.
   - Best for curated integrations (GitHub, Grants.gov, Drive tagging) where we want stable selectors and minimal permissions.

2) **CDP automation via `chrome.debugger` (high-trust, more general)**:
   - Attaches to a specific tab and drives it via Chrome DevTools Protocol commands.
   - Enables screenshots, DOM snapshotting, click/type, and visibility into console/network.
   - Requires `debugger` permission and (often) broader host permissions; treat as an **anchor-only capability** (`canAutomateBrowser`) with “ask-before-act” as the default mode.
   - Scope automation to a dedicated Coop “workspace” (a tab group/window) so the agent does not hijack normal browsing.

**Continuous loop model (while the browser is open)**:
- Offscreen runtime runs `browser_automation_session` jobs (lease-claimed like any other job).
- Each session includes `{ allowOrigins[], maxSteps, maxWallTimeMs }` and emits an audit trail (`action_taken`, screenshots as optional CIDs).
- High-risk actions require an `ApprovalGate` (and some actions should be permanently “protected”: password entry, payments, wallet signing).

Principle: use UI automation for *research/capture/workflow assist*, not for irreversible authority actions. For posting/sending, prefer channel APIs via `AuthBroker` over UI-driven automation.

#### Concrete `browser:*` tool interface (Claude tool-use ↔ extension executors)

To make Claude “tool use” map 1:1 onto extension automation (content scripts or CDP), define a stable set of browser tools. These are exposed to the model as tools, and implemented by the extension anchor runtime as a capability-gated skill (available only when `canAutomateBrowser=true`).

Design constraints:
- Every call MUST include a `sessionId` (scopes actions to a dedicated Coop workspace tab group/window).
- The executor MUST enforce `allowOrigins` and deny anything outside the session scope.
- Outputs MUST be size-bounded (`maxChars`, `maxBytes`) and may return `blobRef`/`cid` for large artifacts.
- “Protected actions” (password entry, payments, wallet signing) MUST be blocked or require explicit human approval.

**Common types**

```ts
type BrowserSessionId = string;

type BrowserLocator =
  | { css: string }
  | { xpath: string }
  | { text: string } // exact/substring match (implementation-defined)
  | { role: string; name?: string }; // ARIA-like role/name targeting (best-effort)

type BrowserTarget = {
  sessionId: BrowserSessionId;
  tab?: { tabId?: number; active?: true; urlMatch?: string };
  frame?: BrowserLocator; // optional iframe locator
};

type BrowserErrorCode =
  | 'PERMISSION_REQUIRED'
  | 'ORIGIN_NOT_ALLOWED'
  | 'NO_ACTIVE_TAB'
  | 'ELEMENT_NOT_FOUND'
  | 'TIMEOUT'
  | 'NAVIGATION_FAILED'
  | 'PROTECTED_ACTION'
  | 'UNSUPPORTED';

type BrowserToolResult<T> =
  | { ok: true; result: T; redactions?: string[] }
  | { ok: false; error: { code: BrowserErrorCode; message: string } };
```

**Tools**

```ts
// browser:navigate — open or navigate a tab inside the session scope
type BrowserNavigateInput = BrowserTarget & {
  url: string;
  openInNewTab?: boolean;
  waitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
  timeoutMs?: number;
};
type BrowserNavigateOutput = {
  tabId: number;
  finalUrl: string;
  title?: string;
};

// browser:click — click a target element (best-effort, selectors vary by mode)
type BrowserClickInput = BrowserTarget & {
  locator: BrowserLocator;
  timeoutMs?: number;
};
type BrowserClickOutput = { clicked: true };

// browser:type — focus an element and type text (optionally submit)
type BrowserTypeInput = BrowserTarget & {
  locator: BrowserLocator;
  text: string;
  clearFirst?: boolean;
  submit?: boolean; // press Enter after typing
  timeoutMs?: number;
};
type BrowserTypeOutput = { typed: true };

// browser:screenshot — capture an image of the current tab (or element)
type BrowserScreenshotInput = BrowserTarget & {
  locator?: BrowserLocator; // if omitted, screenshot the viewport
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  maxBytes?: number; // executor may downscale/compress
};
type BrowserScreenshotOutput = {
  finalUrl: string;
  image: { cid?: string; dataUrl?: string };
};

// browser:extract — pull text/HTML/links/structured snippets (bounded)
type BrowserExtractInput = BrowserTarget & {
  kind: 'page_text' | 'selection_text' | 'html' | 'links' | 'dom_snapshot' | 'tabs';
  locator?: BrowserLocator; // used for selection_* kinds
  maxChars?: number;
};
type BrowserExtractOutput = {
  finalUrl: string;
  title?: string;
  text?: string;
  html?: string;
  links?: Array<{ href: string; text?: string }>;
  tabs?: Array<{ tabId: number; title?: string; url?: string; active?: boolean }>;
  blobRef?: { type: 'opfs' | 'sqlite'; id: string }; // for large extracts stored locally
};

// browser:wait — wait for time, navigation, or element appearance
type BrowserWaitInput = BrowserTarget & {
  waitFor: { timeMs?: number; locator?: BrowserLocator; urlMatch?: string };
  timeoutMs?: number;
};
type BrowserWaitOutput = { ready: true };
```

Implementation mapping:
- **Content-script mode**: tool executor forwards actions to a site adapter running in the page (limited domains, stable selectors, lower permission).
- **CDP mode**: tool executor uses `chrome.debugger` to drive the tab via Chrome DevTools Protocol (more general, higher trust).

**Claude tool registration (example)**

When calling Claude with tool use, register these tool names exactly so planning → execution is deterministic:

```ts
const tools = [
  {
    name: 'browser:navigate',
    description: 'Navigate a session-scoped tab to a URL (optionally open a new tab).',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['sessionId', 'url'],
      properties: {
        sessionId: { type: 'string' },
        url: { type: 'string' },
        openInNewTab: { type: 'boolean' },
        waitUntil: { type: 'string', enum: ['domcontentloaded', 'load', 'networkidle'] },
        timeoutMs: { type: 'number' }
      }
    }
  },
  // browser:click, browser:type, browser:screenshot, browser:extract, browser:wait ...
];
```

#### Proactivity (What a node does without being asked)

Coop should feel “alive” without becoming spooky or draining devices. Proactivity is explicitly scoped:
- **PWA nodes**: mostly reactive (foreground-only). They can draft, review, and approve.
- **Extension anchor nodes**: best-effort proactive loops while the browser is open (pollers, digests, indexing, automation sessions).
- **Optional daemon nodes**: truly proactive/always-on (webhooks, Playwright, IMAP, long-running workflows).

**Default proactive behaviors (anchor node, while browser is open)**

Event-triggered:
- **Index updates**: when shared Yjs state changes, update local SQLite indexes (FTS + tag indexes) and (optionally) enqueue embeddings.
- **Route jobs**: observe new jobs/approvals in shared state and attempt to claim/execute if capable + authorized.
- **Inbound intake**: when a `message_received` event arrives, classify it (intent/risk), attach context links, and propose next-step jobs.

Scheduled (via `chrome.alarms` + local scheduler; implemented as jobs so leases + dedupe apply):
- `node_heartbeat` — ensure offscreen runtime is active, renew leases, and refresh `NodeBinding.expiresAt` when needed.
- `email_poll` — poll inbox cursor and ingest headers/snippets.
- `telegram_poll` / `social:listen` — long-poll or poll cursors and ingest mentions/commands.
- `chain_watch` — poll pending txs / Safe proposals and write confirmation/execution events to the feed.
- `digest_generate` — scheduled query → draft weekly digest in the feed for approval.
- `retention_sweep` — apply retention policy (redact/roll-up old items) and prune local caches.
- `cache_refresh:*` — refresh external caches (grants sources) on a conservative cadence (e.g., daily) with TTLs.
- `export_snapshot` (optional) — generate “long memory” snapshot for Git publish (push/PR) and/or Filecoin archival (CAR upload) (manual by default; schedulable later).

Pillar-aligned examples (what “autonomous” work looks like):

| Pillar | Proactive research | Proactive actions (gated) |
|---|---|---|
| Impact Reporting | flag missing evidence, summarize recent logs | draft monthly impact report; propose attest job (approval) |
| Coordination & Governance | watch proposals/votes; ingest messages | draft agenda; send reminders via Telegram/email (approval as needed) |
| Knowledge Commons | extract + tag docs; refresh indexes | draft “knowledge garden” snapshot; propose curation PR |
| Capital Formation | scan grants; match eligibility | draft funding digest; propose “apply” task; send outreach email (approval) |

Guardrails:
- Proactive jobs should be **budget-aware** (API spend, CPU, battery) and **network-aware** (prefer Wi‑Fi; degrade on metered).
- The UI should expose a per-node **Automation Mode**: `off | ask-before-act | act-within-rules`, and show what’s running.

#### Memory lifecycle (How memory grows, and how it gets pruned)

Coop memory grows on each node across multiple surfaces. The plan already separates “source of truth” vs “local indexes”; this section defines the pruning contract so it stays usable for years.

**RetentionPolicy (community) vs LocalBudgets (node)**

- **Community retention policy** is stored in shared config and enforced by *writing new state* (redactions/rollups) so peers converge.
- **Local budgets** are per-node and can be stricter (a node may keep less cached media than the community defaults).

```ts
type RetentionPolicy = {
  // Shared data classes (enforced via redaction/rollups in Yjs)
  feedDays: number;            // e.g., 90 (older entries rolled up)
  jobHistoryDays: number;      // e.g., 30
  messageIntakeDays: number;   // e.g., 30 (snippets only; keep thread links)

  // Local-only data classes (enforced by deletion)
  cachedBlobDays: number;      // e.g., 30 (downloaded-from-peers cache)
  screenshotDays: number;      // e.g., 7 (automation artifacts)
  embeddingDays: number;       // e.g., 180 (rebuildable)
};

type LocalBudgets = {
  maxOpfsBytes: number;        // overall OPFS budget for Coop data on this node
  maxCachedBlobsBytes: number; // LRU cache class
  maxModelsBytes: number;      // model cache
  maxSkillsBytes: number;      // skill bundle cache
};
```

**Growth → prune strategy (by surface)**

1) **Shared Yjs state (`community:{id}`)**
   - Growth drivers: feed entries, job metadata, approvals, lightweight knowledge refs.
   - Keep shared entries small: store **references** (URLs/CIDs/blobRefs), not huge bodies.
   - Prune mechanism (convergent): `retention_sweep` writes **rollups**:
     - replace old detailed entries with a compact summary + thread link,
     - drop job claims/results beyond `jobHistoryDays`,
     - keep governance/proposals “forever” by default.
   - Note: CRDT history/tombstones exist; for true size control, anchors may periodically **compact persistence** (store a fresh snapshot of current state and drop old update logs).

2) **SQLite indexes/caches**
   - Growth drivers: denormalized indexes, external caches (funding_sources), embeddings, job queue.
   - Prune mechanism: TTL deletes (`expires_at`), plus periodic cleanup:
     - delete completed `job_queue` rows older than `jobHistoryDays`,
     - delete `outbound_actions`/`inbound_cursors` history beyond a safe audit window,
     - vacuum/optimize occasionally on anchor/daemon nodes.

3) **OPFS blob store (media + automation artifacts + caches)**
   - Growth drivers: user-captured attachments, downloaded-from-peers media, screenshots, cached models/skills.
   - Prune mechanism:
     - **Never auto-delete authored “owned” attachments** without explicit user action.
     - Auto-prune **cache-class** blobs with LRU when `maxCachedBlobsBytes` is exceeded (downloaded media, thumbnails, screenshots).
     - Cache models/skills by version; keep a small rollback window (e.g., last 1–2 versions) and prune older unused versions.

4) **CacheStorage (HTTP)**
   - Growth drivers: SW caching strategies.
   - Prune mechanism: Workbox expiration/TTL + browser eviction (non-authoritative).

5) **SecretVault**
   - Growth drivers: connected credentials.
   - Prune mechanism: revoke/rotate credentials; wipe secrets when `CredentialRef` revoked or anchor role removed.

User-facing controls (required for trust):
- “Storage & privacy” view per coop: shows bytes by surface + last prune time + “Clear cache” actions.
- Toggle what gets cached locally (media, full email bodies, screenshots) with safe defaults.

**Claude integration tiers**
- **Tier A (local)**: Transformers.js/WebLLM for embeddings, tagging, short summaries (cheap + offline-friendly).
- **Tier B (extension tool-loop)**: Claude “tool use” where **tools = Coop skill interfaces**; safe because tools are narrowly scoped (no arbitrary shell).
- **Tier C (optional local daemon)**: Claude **Agent SDK** for long-running, multi-step workflows (Playwright, IMAP/webhooks, filesystem). Communicates with extension via **native messaging**; never required for basic coop operation.

Credential model:
- A coop-connected Claude/Anthropic API key is a `CredentialRef` (`provider: "anthropic"`) whose secret lives only in `SecretVault` on authorized anchor nodes.
- Individual members may optionally connect their own keys for *local-only drafting*; those secrets never enter shared state.

**Dispatch / Draft / Execute diagram**

```
Event sources (mesh, skills, channels)
   │
   ▼
EventBus ──► JobQueue ──► Claim (capabilities + roles)
                     │
                     ├─► Draft/Propose (any node)
                     │       └─► ApprovalGate (preview in feed)
                     │
                     └─► Execute (anchor only)
                             └─► Audit log (message_sent / action_taken)
```

### Data Replication and Availability

```
Replication strategy:

1. EVERY peer stores a full copy of their community's Yjs doc
   (text + metadata only, typically 1-50MB — not media)

2. Media files (photos, audio) are stored as CIDs and
   replicated on-demand:
   - Creator stores original in OPFS
   - When another peer views the feed, their client requests
     the CID via Helia (IPFS)
   - Extension peers cache media they've seen (LRU, up to quota)
   - This means popular media is well-replicated; old media
     may only exist on the creator's device

3. Extension peers are "super-peers":
   - Store more media (larger cache)
   - Relay connections for NAT-trapped PWA peers
   - Participate in DHT (help others find content)
   - Maintain Yjs sync even when no Coop tab is open (best-effort while the browser is open)

4. Availability guarantee:
   - With 0 extension peers online: PWA peers sync directly
     via WebRTC (works but fragile — NAT issues)
   - With 1 extension peer online: reliable relay for all
     PWA peers, persistent Yjs state
   - With 3+ extension peers online: redundant backbone,
     community data survives any single peer going offline
```

### Benefits of Running a Node (Extension)

```
┌─────────────────────────────────────────────────────────────────┐
│              Why Install the Coop Extension?                     │
│                                                                  │
│  For You:                                                        │
│  ─────────                                                       │
│  · Coop works in background (no need to keep tab open)          │
│  · System notifications when community needs you                │
│  · Cross-site integration (save grants, link GitHub issues)     │
│  · Faster sync (persistent connections, no reconnect delay)     │
│  · Larger local storage (more media cached, better search)      │
│                                                                  │
│  For Your Community:                                             │
│  ──────────────────────                                          │
│  · You become a relay node — others connect through you         │
│  · Community data stays available even when others are offline  │
│  · Your extension caches media that others can request          │
│  · Helps peers behind strict NATs join the mesh                 │
│  · Reduces dependency on bootstrap/signaling servers            │
│                                                                  │
│  Future Benefits (when hardware tier launches):                  │
│  ──────────────────────────────────────────────                  │
│  · Native messaging bridge to local Ollama (free AI)            │
│  · Bridge to signal-cli (always-on secure messaging)            │
│  · Bridge to IPFS daemon (permanent content pinning)            │
│  · Foundation for community staking node                        │
│                                                                  │
│  What It Costs:                                                  │
│  ──────────────                                                  │
│  · ~50-200MB RAM while browser is open                          │
│  · Minimal bandwidth (~1-10KB/s for sync, more for media relay) │
│  · No battery impact when laptop is plugged in                  │
│  · Zero financial cost                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## AI Economics: Who Pays and How

### The Cost Tiers

```
┌──────────────────────────────────────────────────────────────────┐
│                    AI Cost Model                                  │
│                                                                   │
│  Tier 0: FREE — runs locally, no API calls                       │
│  ────────────────────────────────────────                         │
│  · Whisper (speech-to-text): @xenova/transformers, WebGPU        │
│    ~244MB model download (cached in OPFS, one-time)              │
│    Runs entirely in-browser. No audio leaves the device.         │
│                                                                   │
│  · Sentence embeddings: all-MiniLM-L6-v2                         │
│    ~23MB model (cached). Semantic search over local knowledge.   │
│                                                                   │
│  · Intent classification: zero-shot-classification               │
│    ~170MB model (cached). Routes voice commands to skills.       │
│                                                                   │
│  · Keyword spotting: wake word detection ("Hey Coop")            │
│    ~5MB model. Runs continuously, negligible CPU.                │
│                                                                   │
│  Total cached models: ~442MB (downloaded once, stored in OPFS)   │
│  Ongoing cost: $0 / month                                        │
│                                                                   │
│  What this covers:                                                │
│  · ALL voice transcription                                        │
│  · ALL intent routing                                             │
│  · ALL local semantic search                                      │
│  · Basic impact classification (from calibration memory)          │
│                                                                   │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Tier 1: COMMUNITY-FUNDED — Claude/Gemini API for complex tasks  │
│  ────────────────────────────────────────                         │
│  When local models can't handle it:                               │
│  · "Summarize our community's impact this quarter" → Claude API  │
│  · "Draft a grant proposal for USDA Urban Ag" → Claude API      │
│  · "Analyze this funding opportunity for eligibility" → Claude   │
│  · "Help me understand this governance proposal" → Claude        │
│                                                                   │
│  Cost: ~$5-30/month per active community                         │
│  (based on ~50-200 complex queries/month at Sonnet pricing)      │
│                                                                   │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Tier 2: OPTIONAL — WebLLM for in-browser LLM (replaces Tier 1) │
│  ────────────────────────────────────────                         │
│  Devices with WebGPU + decent GPU (8GB+ VRAM):                   │
│  · Llama 3.2 3B-Q4 (~2GB download) — free, runs locally         │
│  · Handles ~80% of Tier 1 queries (summaries, drafts, analysis) │
│  · Falls back to Claude API only for complex multi-step tasks    │
│  · Reduces API costs to ~$2-10/month                             │
│                                                                   │
│  Not available on: phones, low-end laptops, tablets              │
│  The system gracefully falls back to Tier 1 when WebGPU absent  │
└──────────────────────────────────────────────────────────────────┘
```

### In-Browser AI (WebLLM / WebNN / Transformers.js): What Runs Where

Coop should treat browser AI as **progressive enhancement**:

- **Default assumption**: many members are on phones/low-end laptops → rely on small local models (or none) + strong local-first data + optional API.
- **Power assumption**: some members/nodes have WebGPU-capable desktops → unlock WebLLM for drafts/summaries and reduce API spend.
- **Acceleration assumption**: where available, WebNN can accelerate certain model families; otherwise fall back to WebGPU/WASM.

Practical “local in browser” tasks (high ROI):
- Speech-to-text (privacy-sensitive, predictable cost)
- Embeddings + semantic search (fast, stable, cheap)
- Intent routing + lightweight classification/tagging
- Short summaries, rewrites, translation (WebLLM on capable devices)

Tasks that usually require a **power node** (community compute) or **Claude API**:
- Long-context synthesis across lots of documents
- Multi-step planning with tool use (web research + writing + posting)
- High-stakes decisions (grant eligibility/strategy, governance execution) where you want reliability + audit + review

Framework notes:
- **Transformers.js / ONNX Runtime Web**: good for embeddings, classifiers, STT/TTS components; can target WebGPU/WASM and sometimes WebNN.
- **WebLLM (WebGPU)**: good for small local LLMs on desktops; treat it as optional and cache models in OPFS.
- **Power node runtime (Node/Python)**: optional always-on service that can run tool-using workflows via Claude Agent SDK and/or host local models (e.g., Ollama) for the coop.

### Funding AI Costs

```typescript
// AI cost tracking and funding model

interface AICostTracker {
  // Every API call is metered
  trackUsage(call: {
    model: 'claude-sonnet' | 'claude-opus' | 'gemini-flash';
    inputTokens: number;
    outputTokens: number;
    skill: string;        // which skill triggered this
    communityId: string;  // which community it's for
  }): void;

  // Monthly cost summary
  getMonthlyCost(communityId: string): {
    total: number;          // USD
    bySkill: Map<string, number>;
    byModel: Map<string, number>;
    localSavings: number;   // how much was handled locally (free)
  };
}

// Funding sources for AI costs (progressive):
//
// 1. FREE TIER (Coop-subsidized, first 3 months):
//    $10/month of API credits per community
//    Funded by Coop project treasury / grants
//    Purpose: let communities experience AI without friction
//
// 2. COMMUNITY POOL:
//    Community members contribute voluntarily
//    Safe multisig holds community funds
//    API key is community-owned, stored encrypted
//    Dashboard shows: "This month: $18 spent, $32 remaining"
//
// 3. GRANT-FUNDED:
//    Many environmental grants cover "technology and tools"
//    AI costs are a legitimate line item in grant budgets
//    Coop generates cost reports formatted for grant reporting
//
// 4. YIELD-FUNDED (future, hardware tier):
//    Staking yield from community ETH → covers AI costs
//    $1000 staked at 4% APY = $40/year ≈ covers basic AI usage
//    Self-sustaining: impact → attestation → staking → yield → AI → more impact
```

### AI Routing Logic

```typescript
// Decision tree: local vs power node vs API for each request type
// (Power node = extension/hardware node that can run heavier workflows)

type AIRoute =
  | 'local_free'
  | 'webllm_local'
  | 'power_node'
  | 'api_sonnet'
  | 'api_opus';

function routeAIRequest(request: AIRequest): AIRoute {
  // Voice transcription → ALWAYS local (privacy + free)
  if (request.type === 'transcription') return 'local_free';

  // Intent classification → ALWAYS local
  if (request.type === 'intent') return 'local_free';

  // Semantic search → ALWAYS local (embeddings in SQLite)
  if (request.type === 'search') return 'local_free';

  // Impact classification with high calibration confidence → local
  if (request.type === 'impact_classify' && request.confidence > 0.8) {
    return 'local_free';
  }

  // Simple summarization → try WebLLM first, then power node, then API
  if (request.type === 'summarize' && request.length < 2000) {
    if (webGPUAvailable && webLLMLoaded) return 'webllm_local';
    if (powerNodeAvailable) return 'power_node';
    return 'api_sonnet';
  }

  // Complex tasks → prefer power node; else API (with budget check)
  if (request.type === 'grant_draft' || request.type === 'report_generate') {
    if (powerNodeAvailable) return 'power_node';
    if (communityBudget.remaining <= 0) {
      // Notify community that AI budget is depleted
      notify('AI budget reached. Complex tasks paused until next month.');
      return 'local_free'; // graceful degradation
    }
    return 'api_sonnet';
  }

  // Default: try local first, then power node, then cheapest API
  if (webGPUAvailable && webLLMLoaded) return 'webllm_local';
  if (powerNodeAvailable) return 'power_node';
  return 'api_sonnet';
}
```

---

## Data Flows

### Flow 1: Recording Impact (Core Flow)

```
User taps Orb → Recording starts
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. CAPTURE (browser)                                         │
│    MediaRecorder API → audio chunks in memory                │
│    Optional: camera capture → photo stored in OPFS           │
│    Optional: navigator.geolocation → lat/lng                 │
│    Duration: 5-120 seconds                                   │
└────────────────────────┬────────────────────────────────────┘
                         │ stop recording
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. TRANSCRIBE (local, free)                                  │
│    Audio chunks → Whisper WASM (@xenova/transformers)        │
│    Runs in Web Worker (won't block UI)                       │
│    Output: raw text transcription                            │
│    Latency: ~2-5 seconds for 30s of audio                   │
└────────────────────────┬────────────────────────────────────┘
                         │ transcription text
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CLASSIFY (local, free — uses calibration memory)          │
│                                                              │
│    Input: transcription + user traits + calibration patterns │
│                                                              │
│    IF calibration confidence > 0.8:                          │
│      → Auto-fill perceived impact from learned patterns     │
│      → Go to step 5 (CONFIRM)                               │
│                                                              │
│    IF calibration confidence <= 0.8:                         │
│      → Sentence embeddings (local) → nearest known activity │
│      → Present best guess → Go to step 4 (CALIBRATE)        │
└──────────┬──────────────────────────────┬───────────────────┘
           │ high confidence              │ low confidence
           ▼                              ▼
┌───────────────────┐        ┌──────────────────────────┐
│ 5. CONFIRM        │        │ 4. CALIBRATE             │
│ "Water monitoring │        │ "I think you planted     │
│  at north creek?" │        │  trees — is that right?" │
│                   │        │                          │
│ [Yes] [Edit]      │        │ [Correct to: ____]      │
└────────┬──────────┘        └──────────┬───────────────┘
         │                              │
         │    user confirms/corrects    │
         └──────────┬───────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. STORE + SYNC                                              │
│                                                              │
│    a. Create ActivityEntry with final impact data            │
│    b. Append to Yjs community doc feed (Y.Array)             │
│       → Triggers reactive SQLite insert (via observer)       │
│       → Triggers P2P broadcast via libp2p/GossipSub          │
│    c. Store media in OPFS (keyed by CID)                     │
│    d. If online: queue EAS attestation for on-chain record   │
│    e. Update AI calibration memory:                          │
│       - Store correction (if any) in calibration table       │
│       - Recompute confidence score                           │
│       - Update pattern associations                          │
│    f. Generate embedding → store in ai_embeddings table      │
│                                                              │
│    All of this happens locally. Sync to other peers is       │
│    automatic via Yjs + libp2p. On-chain attestation is       │
│    async and non-blocking (queued for when online).          │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: Cross-Site Knowledge Capture (Extension Only)

```
User is browsing Grants.gov → Extension content script active
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. DETECT (content script)                                   │
│    Content script recognizes a grant listing page            │
│    Extracts: title, deadline, amount, eligibility, URL       │
│    Shows small Coop overlay: "Save to Coop?"                │
└────────────────────────┬────────────────────────────────────┘
                         │ user clicks "Save"
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ENRICH (background service worker)                        │
│    Content script sends extracted data → background SW       │
│    Background SW:                                            │
│      a. Computes bioregion match score (local embeddings)    │
│      b. Checks for duplicates in SQLite                      │
│      c. If complex eligibility: optionally sends to Claude   │
│         API for analysis ("Is our 501(c)(3) eligible?")      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. STORE + NOTIFY                                            │
│    a. Insert into funding_sources table (SQLite)             │
│    b. Add to Yjs knowledge map (metadata only)               │
│    c. → Syncs to all community peers via mesh                │
│    d. If bioregion_match > 0.7 and deadline < 30 days:       │
│       → Push notification to community: "New relevant grant" │
└─────────────────────────────────────────────────────────────┘
```

### Flow 3: Mesh Sync (What Happens When You Come Online)

```
María opens Coop (PWA) after being offline for 2 days
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. BOOTSTRAP                                                 │
│    Service Worker activates → loads Yjs docs from IndexedDB  │
│    Connects to libp2p mesh:                                  │
│      a. Try WebRTC direct to known peers (cached peer IDs)   │
│      b. If NAT blocked: connect via WebSocket to bootstrap   │
│      c. Bootstrap helps find circuit relay peer (extension)   │
│      d. Connect to relay → connect to community peers        │
│    Typical time to first peer: 1-3 seconds                   │
└────────────────────────┬────────────────────────────────────┘
                         │ connected to 1+ peers
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SYNC (Yjs protocol — automatic)                           │
│    a. Exchange state vectors with each peer                  │
│       "I have updates up to clock 47"                        │
│       "I have updates up to clock 63"                        │
│    b. Peer sends updates 48-63 as binary diff               │
│       (typically 2-50KB for 2 days of community activity)    │
│    c. María's Yjs doc merges updates (CRDT — no conflicts)  │
│    d. Reactive pipeline updates SQLite from Yjs changes      │
│    e. UI reactively renders new feed entries                  │
│                                                              │
│    María sees: "While you were away: David logged 3 sessions,│
│    Sarah added 2 knowledge docs, 1 new grant matched."       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. MEDIA FETCH (lazy, on-demand)                             │
│    Feed entries reference media by CID (not inline data)     │
│    When María scrolls and a photo becomes visible:           │
│      a. Check OPFS: do we have this CID locally?            │
│      b. If yes: display from local storage (instant)         │
│      c. If no: request via Helia (IPFS) from peers           │
│         → Closest peer with the file responds                │
│         → Download + cache in OPFS for future                │
│      d. Show placeholder shimmer while fetching              │
│                                                              │
│    This means: text syncs instantly, media loads lazily.     │
│    Perfect for low-bandwidth field conditions.               │
└─────────────────────────────────────────────────────────────┘
```

### Flow 4: Skill Lifecycle

```
Community operator decides to add "Grants.gov" skill
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. DISCOVER                                                  │
│    Skill Registry (curated list, not marketplace):           │
│      · Bundled with bioregional template, or                 │
│      · Manually selected from Coop skill catalog             │
│    Each skill has a manifest:                                │
│      { name, version, provides, requires, size,              │
│        capabilities_needed, offline_capable }                │
│                                                              │
│    User sees: "Grants.gov Search — 12kB — needs network     │
│    access to grants.gov — provides: funding-source-search"   │
└────────────────────────┬────────────────────────────────────┘
                         │ user confirms install
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. LOAD                                                      │
│    a. Fetch skill bundle (JS module, not WASM initially)    │
│    b. Cache in OPFS: /coop/skills/grants-gov/1.0.0.js       │
│    c. Create dedicated Web Worker for this skill             │
│    d. Pass capability handles (not raw secrets):             │
│       { network: ["https://www.grants.gov/*"],               │
│         storage: { quota: "50MB", namespace: "grants-gov" }, │
│         auth: { provider, credentialRefId, allowedScopes }?  │
│         events: ["publish:funding_source_found"] }           │
│    e. Skill registers its interfaces with the OS registry    │
└────────────────────────┬────────────────────────────────────┘
                         │ skill loaded and running
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. OPERATE                                                   │
│    Skill runs in isolated Worker, communicates via typed      │
│    messages (Comlink):                                        │
│                                                              │
│    // Skill code:                                            │
│    export const search = async (query, bioregion) => {       │
│      const results = await fetch(                            │
│        `https://www.grants.gov/api/search?q=${query}`        │
│      );                                                      │
│      const grants = await results.json();                    │
│      for (const grant of grants) {                           │
│        // Emit typed event — OS routes to interested skills  │
│        emit('funding_source_found', {                        │
│          source: 'grants_gov',                               │
│          title: grant.title,                                 │
│          amount: grant.amount,                               │
│          deadline: grant.deadline,                            │
│          url: grant.url,                                     │
│        });                                                   │
│      }                                                       │
│      return grants;                                          │
│    };                                                        │
│                                                              │
│    // OS stores results in SQLite funding_sources table      │
│    // Other skills (e.g., Claude) can consume these events   │
│    // to do eligibility analysis                              │
└─────────────────────────────────────────────────────────────┘
```

### Platform Authentication & Secrets (AuthBroker + SecretVault)

Coop needs to authenticate with external platforms (Telegram, Bluesky, email, Drive, GitHub, etc.) without introducing centralized accounts or leaking secrets into shared state.

**Core rule**: tokens/passwords/refresh tokens never go into Yjs docs or Git exports. Shared state stores only **credential references** and **public linkage**.

#### Components

- **`AuthBroker` (anchor node runtime)**:
  - Lives in extension background/offscreen (or hardware/hosted worker).
  - Runs OAuth flows, refreshes tokens, enforces scopes.
  - Performs authenticated fetch on behalf of skills (`fetchWithAuth`).
  - Emits redacted audit events (`auth_connected`, `auth_refreshed`, `auth_revoked`).

- **`SecretVault` (node-local encrypted store)**:
  - Stores refresh tokens / app passwords / bot tokens **encrypted at rest**.
  - Unlocked per session using a passkey/session key (WebAuthn gate) on anchor nodes.
  - Not replicated in the mesh; losing a node does not leak secrets.

#### Extension-first OAuth (MV3) — practical notes

For OAuth providers (Google, Microsoft), the extension should use the `chrome.identity` flow (not an embedded webview inside the PWA):

- **Redirect URI**: `chrome.identity.getRedirectURL()` (e.g., `https://<extension-id>.chromiumapp.org/...`)
- **Authorization**: `chrome.identity.launchWebAuthFlow({ interactive: true })`
- **PKCE**: required; store the `code_verifier` only locally for the short exchange window.
- **Refresh tokens**: stored only in `SecretVault` (encrypted at rest). Shared state stores only `CredentialRef`.
- **Host permissions**: add explicit API domains needed by skills (example: `https://www.googleapis.com/*`, `https://graph.microsoft.com/*`).
- **Background reality**: refresh + polling should run in the offscreen runtime; use `chrome.alarms` to wake the SW and ensure offscreen is created/recreated.

**Pilot recommendation (email-first)**:
- Start with **Gmail via Google OAuth** because it has a widely used HTTP API and reliable history/cursor semantics.
- Scopes should be split by feature:
  - outbound only: `gmail.send`
  - inbound digest intake: `gmail.readonly` (or `gmail.modify` only if you need label mutations)

Non-OAuth secrets (Telegram `bot_token`, Bluesky app password / OAuth token, Claude/Anthropic API key) follow the same rule:
- store secrets only in `SecretVault`,
- reference them in shared config via `CredentialRef`.

#### Credential Reference Pattern (Shared vs Local)

Shared (in coop config / shared doc):

```ts
type CredentialRef = {
  provider: 'google' | 'microsoft' | 'telegram' | 'bluesky' | 'github' | string;
  credentialRefId: string;          // public identifier, not a secret
  accountHandle?: string;           // e.g. "coopname@gmail.com", "@inlandempire.coop"
  coopEmailAddress?: string;         // displayed to community if configured
  scopes: string[];                 // least privilege
  allowedNodePeerIds?: string[];    // anchor nodes allowed to execute
  createdAt: number;
  revokedAt?: number;
};
```

Local (inside a specific node’s SecretVault):
- `credentialRefId → encrypted secret material (refresh token, bot token, app password)`

#### Skill token handling (least privilege)

- Skill workers never receive refresh tokens directly.
- A skill is given only `{ provider, credentialRefId, allowedScopes }` and must call:

```ts
await authBroker.fetchWithAuth(credentialRefId, {
  url: 'https://api.example.com/...',
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
```

This keeps secret handling centralized, auditable, and revocable.

#### Revocation / Rotation

- Operator can revoke a `CredentialRef` in coop config → anchor nodes wipe vault entry → any pending jobs fail closed.
- If anchor membership changes, rotate credentials without rotating member DIDs.

### Flow 5: Communications Bridge (Telegram / Bluesky / Email)

**Goal**: Coop should “infuse” into existing comms without forcing a new chat UI. Treat comms as skills behind a shared interface.

```
Community wants: "Weekly grant digest" posted into an existing Telegram group
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. PRODUCE (any node)                                        │
│    Grants skill + Knowledge skill populate local SQLite      │
│    Coop runs a scheduled query:                              │
│      SELECT * FROM funding_sources                           │
│      WHERE deadline < 30d AND relevance > 0.7                │
│    Claude/WebLLM generates a digest (budget-aware).          │
└────────────────────────┬────────────────────────────────────┘
                         │ digest markdown + links
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ROUTE (capabilities-aware)                                │
│    If extension/hardware node online:                        │
│      → use `telegram` skill (long-polling, bot token)         │
│    Else if hosted bridge configured:                         │
│      → send to hosted worker to post                         │
│    Else:                                                     │
│      → queue message until a capable node appears            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. POST + LOG                                                │
│    Telegram bot posts into group thread/topic                │
│    Coop writes an immutable entry to the community feed:     │
│      { type: "message_sent", channel: "telegram", ... }      │
│    (Auditable: what was said, when, by which node/skill)     │
└─────────────────────────────────────────────────────────────┘
```

**Why this matters**: the same message object can be delivered via multiple channels (`telegram`, `bluesky`, `email`) without rewriting logic. The coop chooses delivery based on what nodes are available and what the community has authorized.

### Flow 6: “Long Memory” Publish (Git + Filecoin Archives)

**Goal**: make coop knowledge durable, legible, and seedable even if the mesh goes quiet.

```
Curator runs "Publish this month's knowledge garden"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. CURATE (human-in-the-loop)                                │
│    Curator selects a set:                                    │
│      - verified funding opportunities                         │
│      - meeting notes + decisions                              │
│      - impact highlights + evidence links                     │
│    Coop generates markdown + frontmatter metadata.           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. EXPORT (deterministic)                                    │
│    Yjs/SQLite → files:                                       │
│      knowledge/                                               │
│      governance/                                              │
│      funding/                                                 │
│      impact/                                                  │
│    Large media remains CID-addressed (IPFS), not in exports. │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. PUBLISH (optional stores)                                 │
│    Git (knowledge garden): push snapshot (signed commit/PR). │
│    Filecoin (archive): package snapshot as CAR → upload      │
│      via Storacha → record root CID.                         │
│    Else: keep local export for later seeding/sharing.        │
└─────────────────────────────────────────────────────────────┘
```

**Publish result (shared pointer, no secrets)**:

```ts
type SnapshotPointer = {
  communityId: string;
  exportHash: string; // sha256 of deterministic export bundle
  createdAt: number;
  createdByDid: string;
  git?: { repo: string; ref: string; commit?: string; path?: string };
  filecoin?: { rootCid: string; retrievalUrl?: string };
};
```

Notes:
- Git publishing is optimized for human curation (diffs, PR review).
- Filecoin publishing is optimized for durable, decentralized archives (immutable bundles).
- Storacha/Filecoin credentials are handled via `CredentialRef + SecretVault` on anchor nodes (never in shared state).

### Flow 7: Onchain Actions (Attestation + Treasury) — Draft → Approve → Sign → Confirm

**Goal**: make on-chain writes safe, auditable, and extension-executable without ever custodying private keys inside Coop.

**Core idea**: treat on-chain writes like any other high-risk outbound action:
- **Draft/Propose** can happen on any node (cheap, local, often AI-assisted).
- **Execute** is capability-gated to anchor nodes and requires either:
  - a **human signature** in a wallet-capable surface, or
  - (for low-risk allowlisted actions) a **pre-installed constrained session key** on a coop smart account (AA Pattern 2).

**On-chain scope (phased, Green Goods aligned)**:
- **Pilot / Phase 1**: optional EAS/Green Goods attestations for selected impact logs (`impact:attest`).
- **Phase 2**: extension jobs for tx drafting + signer-tab handoff + tx watching; optional AA Pattern 2 executor for allowlisted attestations (session key + paymaster); read-only treasury visibility.
- **Phase 3+**: Safe transaction proposals/execution (`capital:treasury`), Octant vault ops, Hypercert minting (`capital:certify`).
- **Governance**: off-chain proposals/votes are the source of truth; on-chain execution is an explicit, gated follow-up job.

#### Signing surfaces (reality check)

- **Browser extensions cannot reliably access injected EIP‑1193 wallet providers** from service workers/offscreen docs.
- **EOA / Safe owner signing must occur in an HTTPS page**:
  - Coop PWA “Signer” route (recommended), or
  - a trusted signer tab the extension opens (wallet injection works), or
  - WalletConnect (future) for mobile-first signing.
- **Account Abstraction (EIP‑4337 / “ERC‑4337”) is different**: if the coop uses a smart account with a constrained *session key*, the extension can sign **UserOperations** locally (no wallet popup per tx). The *installation/rotation* of that session key is still a high-risk owner-signed action.

#### What runs in the extension vs the wallet

Extension / anchor node responsibilities (while browser is open):
- Draft tx payloads, estimate costs, and apply policy gates (roles + approvals).
- Open the signer surface with an explicit, human-readable summary.
- Watch tx receipts / Safe confirmations (`chain_watch`) and write public results into the feed.
- Cache read-only chain state locally (balances, positions) for fast UI and low RPC load.

Wallet / signer responsibilities:
- Hold keys and perform signing with explicit user confirmation.
- Enforce chain/network checks (correct chain, simulation warnings, allowlisting).

#### Example: `impact:attest` (EAS) for a recorded impact log

```
Impact log recorded (off-chain) → creates "attest" job (queued)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1) DRAFT (any node)                                          │
│    green-goods skill prepares attestation payload:           │
│      - references: impact_log_id, content_hash, media CIDs   │
│      - NEVER: raw PII, raw audio, full docs on-chain         │
│    Writes OnchainActionDraft into shared state:              │
│      { kind: "impact_attest", schemaId, recipient, payload } │
└────────────────────────┬────────────────────────────────────┘
                         │ high-risk? → ApprovalGate
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2) APPROVE (human)                                           │
│    UI shows exact data that will go on-chain + cost estimate  │
│    Approver signs approval event (member DID)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3) SIGN + SEND (wallet surface)                              │
│    Anchor node opens Signer tab (PWA route) with tx draft     │
│    Human signs in wallet → tx broadcast                       │
│    Returns txHash; writes to shared feed + local tx table     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4) CONFIRM + COMMIT (anchor node)                            │
│    Extension polls RPC for receipt + EAS UID                 │
│    Updates: impact_logs.attestation_uid + "attested" event    │
└─────────────────────────────────────────────────────────────┘
```

#### Example: `capital:treasury` (Safe) — propose, don’t auto-spend (Phase 3+)

**Principle**: Coop can *coordinate* treasury ops, but **signers control funds**.

Execution model:
- Coop stores the coop’s public treasury identity in shared config:
  - `treasury_safe_address` (public), `chain_id`, optional Safe Tx Service URL.
- Any node can draft a spend proposal (recipient, amount, token, rationale).
- Anchor node can create a Safe transaction **proposal** (off-chain API or on-chain call data) and post the Safe link into the feed.
- Signers complete signing/execution in Safe UI (or later, via an integrated signer surface).
- Anchor node watches the Safe tx status and records:
  - `safeTxHash`, confirmations, executed txHash, receipt summary.

**Non-negotiable rule (high-stakes)**:
- no unattended signing with **owner keys** (treasury Safe owners / root validators),
- no storing owner private keys in Coop,
- no “agent clicks confirm” wallet automation.

**Allowed (automation, constrained)**:
- an anchor node MAY store a **time-bound, revocable session key** for a coop smart account *only* after explicit owner approval,
- that session key MUST be constrained (allowlist + value=0 + rate limits + expiry) so compromise cannot escalate into treasury loss.

#### Onchain data model (minimal, auditable)

Shared state stores *drafts + public results*:

```ts
type OnchainActionKind = 'impact_attest' | 'safe_propose' | 'safe_execute' | 'octant_deposit' | 'hypercert_mint';

type OnchainActionDraft = {
  id: string; // UUID
  communityId: string;
  kind: OnchainActionKind;
  chainId: number; // single-chain by default (DEFAULT_CHAIN_ID)
  riskLevel: 'low' | 'medium' | 'high';
  requiresRoles?: string[]; // e.g. ["treasurer", "council"]
  inputRefs: string[]; // pointers into Yjs/SQLite/OPFS (impact_log_id, proposal_id, ...)
  txPreview: {
    to: string; // Address
    value?: string; // wei
    data?: string; // calldata (redacted if needed)
    humanSummary: string; // what humans read/approve
    costEstimate?: { gas?: string; maxFee?: string };
  };
  createdByMemberDid: string;
  createdAt: number;
};

type OnchainActionResult = {
  id: string;
  status: 'queued' | 'approved' | 'sent' | 'confirmed' | 'failed';
  txHash?: string;
  attestationUid?: string;
  safeTxHash?: string;
  executedAt?: number;
  executedByPeerId?: string;
};
```

Local node state tracks *cursors + receipts* without bloating shared memory:
- tx polling cursors, RPC response caches, decoded logs, receipts.

#### Pattern 2 (v1 target): Coop Smart Account (EIP‑4337) + Session Key + Pimlico Paymaster

This is the “extension can submit onchain actions” path without giving the extension human wallet keys.

**Core idea**:
- The **coop has an onchain account** (`coop_operator_account`) that is granted the Garden operator role.
- The extension holds a **session key** that can *only* do a narrow set of actions (e.g., attest WorkApprovals).
- Pimlico sponsors gas via a **Sponsorship Policy** so the coop operator account doesn’t need ETH.

**Key entities**
- `coop_operator_account`: EIP‑4337 smart account address (contract). This is the onchain *attester/operator*.
- `coop_treasury_safe` (optional): Safe multisig for funds (separate from operator account).
- `session_key`: a delegated signing key installed on the smart account with strict limits.
- `pimlico_paymaster`: verifying paymaster endpoint (`pm_sponsorUserOperation`).
- `pimlico_bundler`: bundler endpoint (`eth_sendUserOperation`, receipts, gas price).
- `pimlico_chain`: Pimlico chain slug for the RPC URL path (e.g., `base`, `sepolia`) from the supported-chains list.

##### Setup (one-time, high-risk)

1) **Create or choose the coop smart account implementation**
- Prefer a modular account stack that supports session keys (e.g., ERC‑7579 modules or a mature plugin system).
- Generate the counterfactual address for `coop_operator_account` and store it in shared coop config.

2) **Grant Garden operator role to `coop_operator_account`**
- Using the Green Goods Hats role flow, add `coop_operator_account` as operator/owner where appropriate.

3) **Install a constrained session key**
- Owners sign a one-time onchain configuration that installs `session_key` with:
  - allowlisted `to` addresses (EAS / Green Goods contracts only),
  - allowlisted function selectors / schema UIDs,
  - `value == 0` enforced,
  - max ops per day + expiry,
  - revocation path (owners can remove session key immediately).
- Store the session key private material only on anchor nodes (SecretVault).

4) **Configure Pimlico sponsorship**
- Create a Pimlico API key + fund the Pimlico balance.
- Create a Sponsorship Policy that constrains:
  - chain allowlist,
  - spend caps (global/per-user/per-op),
  - optional webhooks for monitoring.
- Store Pimlico API key in SecretVault; store `sponsorshipPolicyId` in shared config.

##### v1 policy (what the session key is allowed to do)

To make Pattern 2 safe, the *restriction must be enforced on-chain by the smart account/module*, not only by Coop UI.

Recommended v1 allowlist (tight by default; expand later):
- `to` allowlist: **EAS contract** address (and optionally the specific Green Goods contracts needed for attest integration).
- selector allowlist: `attest(...)` (optionally `multiAttest(...)` for batching).
- schema allowlist: WorkApproval / impact schemas only (explicit schema UID list).
- `value == 0` enforced.
- rate limits: max attestations/day + max batched size.
- expiry: short-lived session keys (e.g., 7–30 days) with explicit rotation playbook.

##### Emergency response (compromise / abuse)

- **Session key leak**:
  - owners revoke/remove the session key on-chain immediately,
  - anchor nodes wipe SecretVault entry and rotate `credentialRefId`,
  - Coop writes a signed “revocation” event into shared state for audit.
- **Paymaster abuse / runaway sponsorship**:
  - tighten Pimlico Sponsorship Policy (caps + allowlists) or disable it,
  - rotate Pimlico API key; update the anchor node’s SecretVault mapping,
  - add monitoring webhooks/alerts before expanding allowlists.

##### Execution (recurring, low-touch)

```
Offchain approval in Coop (DID) → OnchainActionDraft(kind=impact_attest)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1) BUILD USEROP (anchor node)                                │
│    - encode EAS attestation calldata                         │
│    - build UnpackedUserOperation (EntryPoint v0.7/0.8)        │
│    - sign userOp with session_key                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2) SPONSOR (Pimlico paymaster)                               │
│    call pm_sponsorUserOperation(userOp, entryPoint, {         │
│      sponsorshipPolicyId                                      │
│    })                                                         │
│    returns gas overrides + paymaster fields                   │
│    NOTE: sponsored ops have a short validity window (~10 min) │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3) SUBMIT (Pimlico bundler)                                  │
│    call eth_sendUserOperation(userOp, entryPoint)             │
│    receive userOpHash                                         │
│    write { userOpHash, idempotencyKey } to local tx table     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4) CONFIRM + RECORD                                           │
│    poll eth_getUserOperationReceipt(userOpHash)               │
│    decode logs → attestation UID                              │
│    write result into shared feed + update impact_log          │
└─────────────────────────────────────────────────────────────┘
```

**Important implementation details**
- For EntryPoint **0.7/0.8**, Pimlico expects **UnpackedUserOperation** (bundler packs before onchain submission).
- Use strict dedupe (`idempotency_key`) so only one userOp is sent for a given draft.
- If Pimlico sponsorship fails, degrade gracefully:
  - queue for retry,
  - or require a human to fund gas / sign directly.

##### Why this helps Coop (vs “wallet popups per tx”)

- Enables *true anchor-node autonomy* for low-risk, policy-bounded actions (impact attestations).
- Keeps treasury custody separate (Safe owners still control funds).
- Onchain identity becomes “the coop” (operator account) rather than “a person’s wallet”.

##### Account Abstraction roadmap (to keep Pattern 2 future-proof)

Account Abstraction is evolving quickly. Pattern 2 is viable today, but Coop should track these standards/upgrades
to reduce vendor lock-in and improve safety + UX over time:

1) **EntryPoint upgrades (0.7 → 0.8 → 0.9+)**
- EntryPoint version affects the UserOperation shape, hashing/signing domain, and paymaster fields.
- Notable improvements to track:
  - **0.8**: native EIP‑7702 authorization support + ERC‑712-based UserOp hash/signatures.
  - **0.9**: `paymasterSignature` enables parallelizable paymaster signing (lower latency) and adds block-number validity ranges.
- Prefer keeping `entryPointVersion` explicit in coop config and in onchain job drafts so upgrades are deliberate.
- Expect 0.8+ to matter more as ecosystems adopt EIP‑7702 and as bundlers tighten mempool rules.

2) **Modular smart accounts (ERC‑7579, EIP‑6900)**
- Use an account implementation that supports standardized modules/plugins so “session keys” aren’t vendor-specific.
- This makes it easier to swap paymasters/bundlers or migrate account stacks without rewriting Coop policy logic.

3) **Paymaster interoperability (EIP‑7677)**
- Standardizes paymaster web services (stub data → final data) and helps avoid hard-coding vendor RPC methods.
- Target future adapter shape around EIP‑7677 methods, with Pimlico as an implementation behind that port.

4) **Wallet capability standards (EIP‑5792, EIP‑7715)**
- Over time, wallets may support permissioned “sessions” so Coop can request constrained permissions rather than holding a session key.
- This can reduce the amount of secret material that must live in the extension’s SecretVault.

5) **Bundler/mempool rules (EIP‑7562)**
- Bundlers enforce validation constraints; module/account choices must comply or UserOperations will be rejected.
- Treat EIP‑7562 compliance as a hard requirement when choosing the coop smart account + session key module.

6) **Counterfactual signatures (EIP‑6492)**
- Useful when coop accounts are counterfactual (address known before deployment). Helps off-chain proof + linking.
- Makes “bootstrap identity before first tx” cleaner (e.g., publish coop operator address in Git/Bluesky early).

7) **Protocol-level AA direction (EIP‑7702 now; EIP‑7701 future)**
- EIP‑7702 enables EOAs to temporarily execute code (more flexible batching/sponsorship for individual users).
- EIP‑7701 (native AA) is an active direction; if adopted broadly, it could change how “bundlers/paymasters” are accessed.

---

## Hardware Portability Contract

The architecture is designed so `coop-core` can run outside the browser with minimal changes:

```typescript
// coop-core depends ONLY on these abstractions, never browser APIs directly:

interface StorageAdapter {
  kv: KVStore;                     // Browser: IndexedDB, Node: LevelDB, HW: SQLite
  sql: SQLDatabase;                // Browser: wa-sqlite, Node: better-sqlite3
  binary: BinaryStore;             // Browser: OPFS, Node: filesystem
}

interface NetworkAdapter {
  createNode: (config: MeshConfig) => Promise<MeshNode>;
  // Browser: libp2p/webrtc, Node: libp2p/tcp, HW: libp2p/tcp+quic
}

interface AIAdapter {
  transcribe: (audio: Float32Array) => Promise<string>;
  // Browser: Whisper WASM, HW: Whisper.cpp native, Cloud: Whisper API

  embed: (text: string) => Promise<Float32Array>;
  // Browser: Transformers.js, HW: Ollama embeddings

  complete: (prompt: string, opts: LLMOpts) => Promise<string>;
  // Browser: WebLLM or Claude API, HW: Ollama, Cloud: Claude API

  classify: (text: string, labels: string[]) => Promise<Classification>;
  // Browser: zero-shot WASM, HW: local model
}

interface AuthAdapter {
  // Connect a coop credential on this node (OAuth, app passwords, bot tokens).
  // Returns a public, non-secret handle that can be referenced in shared coop config.
  connect: (provider: string, scopes: string[]) => Promise<string>; // credentialRefId

  // Perform an authenticated request using the stored credential.
  // Browser extension: implemented by AuthBroker + SecretVault.
  fetchWithAuth: (
    credentialRefId: string,
    req: { url: string; init?: RequestInit }
  ) => Promise<Response>;

  // Redact secrets before writing audit logs to shared state.
  redactForLogs: (value: unknown) => unknown;
}

interface ChainAdapter {
  // Read-only calls (safe to run autonomously). Uses a configured RPC endpoint.
  readContract: (req: {
    address: string; // Address
    abi: unknown;
    functionName: string;
    args?: unknown[];
  }) => Promise<unknown>;

  // Build a tx request for a known action (no signing).
  prepareTransaction: (req: {
    purpose: 'impact_attest' | 'safe_propose' | 'octant_deposit' | string;
    to: string; // Address
    data: string; // calldata
    value?: string; // wei
  }) => Promise<{ to: string; data: string; value?: string }>;

  // Request a human signature in a wallet-capable surface (PWA signer tab).
  // Returns a txHash once the wallet has signed and broadcast.
  requestWalletSend: (req: {
    communityId: string;
    tx: { to: string; data: string; value?: string };
    summary: string; // what the human sees before confirming
  }) => Promise<{ txHash: string }>;

  // Watch for confirmation and return a summarized receipt.
  waitForReceipt: (req: {
    txHash: string;
    confirmations?: number;
    timeoutMs?: number;
  }) => Promise<{ status: 'success' | 'reverted'; blockNumber: number }>;

  // ─── Account Abstraction (EIP-4337) optional surface ───
  //
  // Used when the coop runs a smart account with session keys and wants the extension
  // to submit UserOperations (no EIP-1193 wallet popup per tx).

  sponsorUserOperation?: (req: {
    chain: string;                  // e.g. "base", "sepolia" (Pimlico chain slug)
    entryPoint: string;             // EntryPoint address
    sponsorshipPolicyId?: string;   // Pimlico policy id
    userOperation: unknown;         // UnpackedUserOperation (v0.7/0.8) or packed (v0.6)
    pimlicoCredentialRefId: string; // SecretVault ref to Pimlico API key
  }) => Promise<{ userOperation: unknown }>; // userOp with paymaster fields populated

  sendUserOperation?: (req: {
    chain: string;
    entryPoint: string;
    userOperation: unknown;
    bundlerCredentialRefId: string; // SecretVault ref to Pimlico bundler url/key (if needed)
  }) => Promise<{ userOpHash: string }>;

  getUserOperationReceipt?: (req: {
    chain: string;
    userOpHash: string;
    bundlerCredentialRefId: string;
  }) => Promise<unknown>;
}

interface PlatformAdapter {
  storage: StorageAdapter;
  network: NetworkAdapter;
  ai: AIAdapter;
  auth: AuthAdapter;
  chain: ChainAdapter;
  capabilities: PlatformCapabilities;
}

// Future OpenClaw skill just provides a different PlatformAdapter:
// const platform = createNodePlatform({
//   ollama: 'http://localhost:11434',
//   storage: '/data/coop',
//   libp2pTransport: 'tcp',
// });
// const coop = new CoopKernel(platform);
```

---

## Skill Interface Registry

```typescript
// Skills register typed interfaces — pillars query the registry

// Built-in interface types (extensible)
type InterfaceName =
  // Impact
  | 'impact:capture'          // submit work evidence
  | 'impact:assess'           // evaluate work quality
  | 'impact:report'           // generate impact reports
  | 'impact:attest'           // create on-chain attestation
  // Knowledge
  | 'knowledge:store'         // persist a document
  | 'knowledge:search'        // query knowledge base
  | 'knowledge:summarize'     // generate summaries
  | 'knowledge:curate'        // organize and tag
  // Coordination
  | 'coordination:propose'    // create governance proposal
  | 'coordination:vote'       // cast vote
  | 'coordination:message'    // send to community
  | 'coordination:listen'     // receive messages from channels
  | 'coordination:roles'      // manage permissions/hats
  // Capital
  | 'capital:search-funding'  // find funding opportunities
  | 'capital:apply'           // submit grant application
  | 'capital:treasury'        // manage community funds
  | 'capital:certify'         // mint impact certificates
  // Cross-cutting
  | 'ai:query'                // LLM query (any context)
  | 'ai:analyze'              // structured analysis
  // Browser tool surface (extension/daemon only; capability-gated)
  | 'browser:navigate'
  | 'browser:click'
  | 'browser:type'
  | 'browser:screenshot'
  | 'browser:extract'
  | 'browser:wait'
  | 'identity:resolve'        // resolve DID to profile
  | 'identity:verify_credential' // optional VC verification (OpenCred, etc.)
  | 'social:post'             // publish to social network
  | 'social:listen'           // subscribe to social events (mentions, replies)

class InterfaceRegistry {
  private providers = new Map<InterfaceName, Set<SkillId>>();
  private skills = new Map<SkillId, Set<InterfaceName>>();

  register(skillId: SkillId, interfaces: InterfaceName[]): void {
    this.skills.set(skillId, new Set(interfaces));
    for (const iface of interfaces) {
      if (!this.providers.has(iface)) this.providers.set(iface, new Set());
      this.providers.get(iface)!.add(skillId);
    }
  }

  // "Who can search for funding?" → ["grants-gov", "candid", "retropgf"]
  whoProvides(iface: InterfaceName): SkillId[] {
    return [...(this.providers.get(iface) ?? [])];
  }

  // "What can Claude do?" → ["ai:query", "ai:analyze", "knowledge:summarize", ...]
  whatCanDo(skillId: SkillId): InterfaceName[] {
    return [...(this.skills.get(skillId) ?? [])];
  }

  // Pillar lens queries
  impactLens(): Map<InterfaceName, SkillId[]> {
    return this.filterByPrefix('impact:');
  }
  knowledgeLens(): Map<InterfaceName, SkillId[]> {
    return this.filterByPrefix('knowledge:');
  }
  coordinationLens(): Map<InterfaceName, SkillId[]> {
    return this.filterByPrefix('coordination:');
  }
  capitalLens(): Map<InterfaceName, SkillId[]> {
    return this.filterByPrefix('capital:');
  }

  private filterByPrefix(prefix: string): Map<InterfaceName, SkillId[]> {
    const result = new Map<InterfaceName, SkillId[]>();
    for (const [iface, providers] of this.providers) {
      if (iface.startsWith(prefix)) result.set(iface, [...providers]);
    }
    return result;
  }
}
```

---

## External Identity & Channels (ATProto/Bluesky, Telegram, Email)

Coop needs outward presence and inward coordination. Both should be treated as **skills** (replaceable integrations), not hard dependencies of `coop-core`.

### AT Protocol (Bluesky) Reality Check

- A **PDS is a server process** that hosts an AT Protocol repository and serves HTTP APIs. A PDS cannot realistically be “created” *inside* a PWA or MV3 extension (clients can’t accept inbound connections or act as a durable service for other devices).
- In the browser tier, the viable options are:
  - **Use a hosted PDS** (e.g., Bluesky account) and authenticate from Coop to post/listen via API (`bluesky` skill implementing `social:post`/`social:listen`).
  - **Run a community PDS** on a cheap VPS or on a coop node (desktop/hardware tier) and point Coop clients at it for sovereignty.
- For the prototype, treat ATProto as **presence + discovery**, not the primary persistence layer for coop state.

### Bluesky Presence (One Coop = One Profile)

For early PMF, it’s reasonable for each coop to have a Bluesky identity as its public “front door”.

- **Outbound**: weekly digests (funding, decisions, impact highlights), meeting/event announcements, calls for volunteers.
- **Inbound**: mentions/replies become intake (“how do I join?”, “can you share the grant link?”, “where’s the meeting?”).
- **Linking**: profile/bio can point to a coop landing page or invite flow (but not to secrets).
- **Provenance**: posts are attributable to a coop identity; Coop can write post URLs back into the shared feed for traceability.

### Credential Separation (Bluesky Login ≠ Coop Join)

Do **not** reuse the same secret for:
- Bluesky authentication, and
- coop membership / node sharing / invites.

Reasons:
- Joining a coop should not grant the ability to impersonate the coop publicly.
- Membership needs fine-grained revocation (remove one member without rotating everything).
- Credentials should be scoped and stored only on nodes that need them (principle of least privilege).

Recommended pilot approach:
- Use **Bluesky app passwords / OAuth tokens** stored only on 1–2 trusted “anchor” nodes (extension/hardware).
- Use **separate coop invites** (expiring links/QR codes) that bootstrap a member’s own DID/keypair and permissions.

### Messaging Channels (Pragmatism First)

- **Telegram** is the practical early bridge (bot API, group chats, broad accessibility). It fits best when run by an always-on node (extension/hardware) or a minimal hosted worker because PWA-only devices can’t reliably long-poll in background.
- **Email** is the universal fallback (digests, “reply-to-create-task”, inbox capture).
- **Signal/Matrix** are future “privacy-first” bridges; keep the interface stable so swapping is cheap.

### Telegram Bot Identity (One Coop = One Bot)

Telegram is accessible and familiar, but the bot API should be treated as a **coordination bridge**, not a confidential channel:
- Bot API traffic is not end-to-end encrypted like Telegram Secret Chats.
- Inputs from Telegram are **untrusted** and should never directly trigger high-risk actions without review.

**Setup flow (repeatable)**:
1. Create a bot with BotFather → obtain `bot_token` (secret).
2. Store `bot_token` **only on anchor node(s)** (extension offscreen / hardware / minimal hosted worker). Never store it in Yjs/shared state.
3. Add the bot to the target group (optionally as admin depending on required actions).
4. Link group → coop:
   - In the Telegram group, run: `/link <coop_invite_code>`
   - Anchor node writes the public linkage into shared coop config:
     - `{ channel: "telegram", chat_id, thread_id?, bot_username }`
5. Optional: member DM linking for DMs/mentions:
   - Member DMs the bot `/start`
   - Bot returns a one-time code; member pastes it into Coop UI (or vice versa)
   - Coop stores `{ member_did ↔ telegram_user_id }` (shared or permission-scoped)

**Runtime model**:
- Posting: coop emits a `ChannelMessageRequest` → an authorized anchor node sends → coop logs `message_sent`.
- Listening: anchor node long-polls `getUpdates` (store offset in `inbound_cursors`) or uses a webhook relay → coop logs `message_received` (treated as intake).

### Email Identity (Coop Inbox)

For the pilot, a coop’s email identity is an **operator mailbox authorized via OAuth** on an anchor node. This avoids provisioning new mail infrastructure while still letting Coop “show up” inside existing email workflows.

**Outbound email (digests + notifications)**:
- `email` skill provides `coordination:message` with `channel=email`.
- Any node can draft the message; an anchor node executes the send via `AuthBroker.fetchWithAuth(...)`.
- Coop logs `message_sent` with redacted metadata (to, subject, thread link) for auditability.

**Inbound polling (anchor node)**:
- Anchor node polls the provider API (e.g., Gmail/Graph) on an interval while the browser is open.
- Poll state is stored locally on the anchor node (SQLite/kv): `historyId` / `lastSeenMessageId` (see `inbound_cursors`) to avoid duplicates.
- In multi-anchor setups, polling should be run as a lease-claimed job (`kind="email_poll"`) so only one authorized anchor polls a mailbox at a time; failover happens when the lease expires.
- Default ingest policy (pilot-safe):
  - Write **headers + snippet + thread link** into the shared feed.
  - Store full body locally unless the coop sets `email_visibility=shared`.
- Inbound messages are treated as **untrusted intake**; high-risk actions require an approval gate.

### OpenCred (CA) Optional Verification (Pilot: Inland Empire Residency)

OpenCred is a **verification checkpoint service** for verifiable credentials (OIDC/OID4VP-style flows) — it is **not** a persistence layer for coop state.

Pilot objective: optional verification of **Inland Empire residency** (Riverside + San Bernardino counties) to support:
- local-only programs/grants,
- “verified local member” roles,
- anti-sybil friction without requiring phone numbers.

**Privacy model (data minimization)**:
- Never store raw address or PII in coop state.
- Store only coarse region + provenance:
  - `residency_region_code` (e.g., `US-CA-IE-RIV`, `US-CA-IE-SBD`)
  - `verified: true`
  - `verifier_did` (e.g., `did:web:opencred...`)
  - `verified_at`, `expires_at`
  - `proof_hash` (hash of verifier response for audit without PII)

**Architecture (port + adapter)**:
- Add `identity:verify_credential({ purpose, requested_claims_minimal }) → VerificationResult` as a stable interface.
- Implement `opencred` as a skill adapter:
  - Starts the verification session with a hosted OpenCred checkpoint
  - Receives callback/result, reduces claims to `residency_region_code`
  - Emits a signed `CredentialAttestation` record into coop state

### Permissions and Safety

- Channel skills require explicit authorization (per-coop tokens), emit audit events (`message_sent`, `message_received`), and provide “human review” points for risky actions (posting, fund transfers, governance execution).

---

## Build Phases (Scoped to Browser + Extension)

### Pilot (Weeks 1-4): Inland Empire “Funding → Coordination → Reporting” Loop
- Bioregional template: Inland Empire + adjacent bioregion context (v0)
- Focused knowledge garden: “Inland Empire Grants” (sources, eligibility notes, deadlines)
- Channels: Telegram + email digests (no new chat UI required)
- Telegram identity: **one bot per coop** created via BotFather; token stored only on the anchor node; `/link <invite>` binds a group to the coop
- Email identity: operator mailbox connected via OAuth on the anchor node; inbound polling ingests snippets into the feed; outbound digests sent via `email` skill
- Optional verification: OpenCred pilot for **Inland Empire residency** (store coarse region code only; no PII)
- One “always-on” anchor node: extension running on a community laptop/Mac mini
- Incident readiness (pilot-safe):
  - document the containment runbook (freeze outbound, rotate tokens, revoke DIDs),
  - run a “fork drill”: export snapshot → (optionally publish to Git/Filecoin) → seed a new coop → re-bind Telegram/email.
- Outputs: weekly funding digest, meeting notes → action items, lightweight impact log
- Long memory (optional): publish a monthly snapshot to Git (knowledge garden) and/or Filecoin (archive via Storacha).
- Optional on-chain: attest a small curated subset of impact logs (EAS/Green Goods):
  - default: human signer flow (signer tab + wallet),
  - optional: AA Pattern 2 once configured (coop smart account + session key + Pimlico paymaster).
- Success metric: 1 lead can onboard 5-15 members and run a recurring loop for 4 weeks

### Phase 1 (Months 1-3): Kernel + Recording Flow
- `coop-core`: PlatformAdapter abstraction, skill loader, interface registry
- `coop-core/state`: Yjs docs + y-indexeddb + wa-sqlite reactive pipeline
- `coop-core/identity`: Passkey session gate + per-coop `did:key` member identity + signed update envelopes (batch-sign)
- `coop-core/security`: membership allowlist + DID revocation + `IncidentConfig` (freeze modes) in shared config
- `coop-core/chain`: ChainAdapter (read/prepare/send/watch) with single-chain default; signer-tab handoff for wallet actions
- `coop-core/ai`: Whisper WASM transcription + intent classification + calibration memory
- `coop-pwa`: Vite PWA shell with Orb recording flow
- `coop-pwa/signer`: dedicated signer route (HTTPS) for wallet actions (EIP‑1193 injection)
- `coop-shared-ui`: Orb component, RecordingFlow state machine (XState), CommunityFeed
- Skills: `green-goods` (impact capture + optional attest), `claude` (AI assistant)
- One bioregional template
- AI economics: free tier ($10/mo API credit per community)

### Phase 2 (Months 3-6): Mesh + Extension + Skills
- `coop-core/mesh`: libp2p node, Yjs-over-libp2p sync provider
- `coop-core/identity`: NodeBinding registry (PeerId ↔ Member DID) + capability gating for high-risk skills
- Incident response mechanics:
  - executors enforce `IncidentConfig.mode` (fail closed on outbound + onchain),
  - deterministic snapshot export hashing (`SnapshotManifest`),
  - fork UX: render `ForkCertificate` / `DeprecationNotice` banners + “migrate” helper.
- `coop-extension/auth`: AuthBroker + SecretVault (OAuth connect, refresh, scope enforcement, redacted audit logs)
- `coop-extension`: MV3 manifest, background SW, offscreen doc (persistent mesh)
- `coop-extension/chain`: on-chain action executor + tx watcher (poll RPC, update feed/results), incl. optional AA Pattern 2 (UserOperations via Pimlico)
- `coop-extension/content-scripts`: GitHub overlay, Grants.gov scraper
- `coop-extension/sidepanel`: full Coop UI (shared components with PWA)
- Skills: `grants-gov`, `github`, `bluesky`, `telegram`, `email`, `storacha` (Filecoin archive/pinning), `gardens` (governance), `google-drive`
- Long memory publish: GitHub API export + optional Storacha upload (CAR) for Filecoin archival; store `SnapshotPointer` refs in shared state.
- Bioregional template engine + 3 templates
- Community feed UX, cross-site knowledge capture
- AI economics: community pool funding, usage dashboard

### Phase 3 (Months 6-9): Federation + Advanced Skills
- Cross-bioregion mesh routing (GossipSub topic bridging)
- Template marketplace (communities share/fork templates)
- Skills: `signal`, `at-proto`, `opencred`, `hypercerts`, `safe-wallet`, `open-civics`
- Semantic search across knowledge commons (vector embeddings in SQLite)
- WebLLM integration (optional in-browser LLM for capable devices)
- Native messaging bridge spec (for future hardware tier)
- Incident hardening (optional, higher-trust communities):
  - quorum-signed freeze/unfreeze + fork certificates,
  - threshold custody for coop signing key (or hardware-bound anchors),
  - monitoring hooks (paymaster spend, channel posting anomalies).
- AI economics: grant-funded model, cost reporting for grant budgets

---

## Evaluation Framework

### Success Outcomes Per Phase

**Phase 1 — "One person can record impact and it persists"**

| Outcome | Metric | How to Measure |
|---|---|---|
| Recording works end-to-end | Tap Orb → transcription → stored in < 30s total | Playwright E2E timer |
| Voice transcription is accurate | > 85% word accuracy on field recordings | Compare Whisper output to manual transcript (10 test recordings) |
| Works fully offline | Complete recording flow with network disabled | Playwright test with `context.setOffline(true)` |
| Data persists across sessions | Record, close browser, reopen → data present | Playwright test: record, close, reopen, assert |
| AI calibration improves | Confidence score increases after corrections | Unit test: feed 5 corrections → assert confidence > 0.7 |
| Passkey auth works | Login < 3 seconds, no wallet prompts | Playwright E2E + manual test on 3 devices |
| Member DID persists per coop | DID stable across sessions; different across coops | Unit test: join coop A twice → same DID; join coop B → different DID |
| Signed updates verified | 100% invalid signatures rejected | Integration test: tamper signature on `SignedYjsUpdate`, assert peer drops |
| DID revocation enforced | Revoked members' updates rejected | Integration test: revoke DID in membership list → assert peer drops new updates |
| PWA installable | Lighthouse PWA audit passes | `lhci` CI gate |
| Orb feels alive | Animations at 60fps, no jank during recording | Lighthouse performance score > 90, manual UX review |

**Phase 2 — "A community of 5 can sync and coordinate"**

| Outcome | Metric | How to Measure |
|---|---|---|
| P2P sync works | 2 browsers sync within 5s without any server relay | Integration test: 2 Playwright browsers, disable signaling after connect |
| Extension relays for others | PWA peer syncs through extension peer | Integration test: 3 browsers (1 ext, 2 PWA), NAT-simulated |
| Mesh survives peer churn | Data consistent after peers join/leave randomly | Chaos test: 5 peers, random connect/disconnect for 60s, assert convergence |
| Cross-site capture works | Save grant from Grants.gov to Coop | Playwright E2E: navigate Grants.gov, click extension overlay, verify in Coop |
| Community feed updates live | New activity appears within 3s on all peers | Integration test: one peer records, others see it |
| NodeBinding propagates | PeerId ↔ Member DID resolvable for connected peers | Integration test: announce NodeBinding; assert attribution on other peers |
| Channel skills gated | Unauthorized nodes cannot post/send | Unit test: enforce NodeBinding + role checks before `coordination:message` |
| Incident freeze works | 0 outbound actions during `freeze_outbound` | Unit test: set `IncidentConfig.mode=freeze_outbound` → executors fail closed + log |
| Credential revocation fails closed | Revoked `CredentialRef` cannot be used | Integration test: revoke `CredentialRef` → AuthBroker denies; pending jobs fail |
| Fork/migration is legible | Clients show "migrated" banner when present | E2E: publish `DeprecationNotice` or `ForkCertificate` referencing current community → banner shows target |
| Telegram `/link` works | Bot posts to linked chat and logs `message_sent` | Integration test with mocked Telegram API |
| Email poll ingests deterministically | 0 duplicates; stable thread links | Integration test with mocked provider API + stored `historyId`/cursor |
| No channel secrets in shared state | 0 tokens present in Yjs docs | Unit test: serialize shared docs; assert token patterns absent |
| Long memory publish works | SnapshotPointer contains `exportHash` + Git ref and/or Filecoin CID | E2E: publish snapshot → verify pointer → re-import matches `exportHash` |
| AI budget tracking works | Usage dashboard shows accurate costs | Unit test: mock API calls, assert cost calculation |
| 3+ skills loaded simultaneously | No memory leak, no Worker crashes | Load test: 5 skills, run for 10 minutes, assert stable memory |

**Phase 3 — "Multiple communities can federate"**

| Outcome | Metric | How to Measure |
|---|---|---|
| Cross-bioregion sync | Peer in community A sees shared content from community B | Integration test with GossipSub topic bridging |
| Template sharing works | Community A's template forkable by community B | E2E test: create template, export, import in new community |
| Semantic search returns relevant results | Top-3 results contain the target document | Retrieval test suite (20 queries, manually labeled relevance) |
| WebLLM reduces API costs | > 60% of queries handled locally on capable devices | Metric tracking: local_handled / total_queries |
| 10+ communities stable | No degradation with 10 communities, 50 peers | Load test (simulated with headless browsers) |

### Test Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│                        Test Pyramid                               │
│                                                                   │
│              ┌───────────────┐                                    │
│              │  E2E (Playwright)                                  │
│              │  5-10 critical paths                               │
│              │  "Can a person record impact?"                     │
│              │  "Can 2 browsers sync P2P?"                        │
│              └───────┬───────┘                                    │
│                      │                                            │
│           ┌──────────▼──────────┐                                │
│           │  Integration (Vitest)                                 │
│           │  ~30-50 tests                                         │
│           │  Yjs↔SQLite pipeline                                 │
│           │  Skill loading + isolation                            │
│           │  AI routing decisions                                 │
│           │  Mesh sync protocol                                   │
│           └──────────┬──────────┘                                │
│                      │                                            │
│      ┌───────────────▼───────────────┐                           │
│      │  Unit (Vitest)                                            │
│      │  ~100-200 tests                                           │
│      │  InterfaceRegistry                                        │
│      │  CalibrationMemory                                        │
│      │  AI routing logic                                         │
│      │  Yjs document helpers                                     │
│      │  SQLite schema + queries                                  │
│      │  Storage quota management                                 │
│      │  Event bus dispatch                                       │
│      └───────────────────────────────┘                           │
└──────────────────────────────────────────────────────────────────┘
```

### Identity & Channel Acceptance Tests (Conceptual)

Minimal “must never break” checks:
- **Signature enforcement**: unsigned/invalid `SignedYjsUpdate` updates are dropped at the mesh boundary.
- **Membership enforcement**: valid signatures from revoked/non-members are still rejected (membership is part of verification).
- **Attribution**: every persisted shared-state update has `{ authorMemberDid, authorPeerId }` attached or is rejected.
- **Capability gating**: channel skills (`telegram`, `bluesky`, `email`) can only execute on nodes with NodeBinding + required roles.
- **Secret isolation**: no bot tokens, OAuth refresh tokens, or app passwords in shared CRDT state or exports; only public linkage does.
- **Long memory pointers**: `SnapshotPointer` stores `exportHash` + Git ref and/or Filecoin CID; Filecoin publishing requires `CredentialRef` and never leaks secrets.
- **Incident freeze**: `freeze_outbound` blocks all outbound and onchain execution even if an anchor still has tokens locally.
- **Onchain safety**: on-chain actions require an `ApprovalGate`; signer surface shows exact tx summary; idempotency prevents duplicate submissions.
- **AA safety (Pattern 2)**: session key actions are enforced on-chain (allowlist + `value==0` + rate limits + expiry); paymaster caps prevent runaway sponsorship spend.
- **Fork/migration legibility**: old coop clients display deprecation banners when `DeprecationNotice`/`ForkCertificate` is present.
- **Telegram linking**: `/link <coop_invite_code>` binds the correct `chat_id` (and optional `thread_id`) to the coop config.
- **Email polling**: inbound poll uses local cursor (`historyId`/`lastSeenMessageId`) and never ingests duplicates.
- **OpenCred minimization**: store only `{ residency_region_code, verifier_did, verified_at, expires_at, proof_hash }` — no raw address/PII.

### Unit Test Cases (coop-core)

```typescript
// ─── InterfaceRegistry ───

describe('InterfaceRegistry', () => {
  it('registers a skill and its interfaces', () => {
    registry.register('claude', ['ai:query', 'knowledge:summarize']);
    expect(registry.whatCanDo('claude')).toContain('ai:query');
  });

  it('finds all providers for an interface', () => {
    registry.register('grants-gov', ['capital:search-funding']);
    registry.register('candid', ['capital:search-funding']);
    expect(registry.whoProvides('capital:search-funding'))
      .toEqual(['grants-gov', 'candid']);
  });

  it('returns pillar lens correctly', () => {
    registry.register('green-goods', ['impact:capture', 'impact:attest']);
    registry.register('claude', ['impact:report', 'ai:query']);
    const lens = registry.impactLens();
    expect(lens.get('impact:capture')).toEqual(['green-goods']);
    expect(lens.get('impact:report')).toEqual(['claude']);
    expect(lens.has('ai:query')).toBe(false); // not impact: prefix
  });

  it('handles skill unregistration', () => {
    registry.register('temp-skill', ['knowledge:store']);
    registry.unregister('temp-skill');
    expect(registry.whoProvides('knowledge:store')).toEqual([]);
  });
});

// ─── CalibrationMemory ───

describe('CalibrationMemory', () => {
  it('starts with 0.5 confidence (uninformed)', () => {
    const mem = new CalibrationMemory('did:key:test');
    expect(mem.confidence).toBe(0.5);
  });

  it('increases confidence after correct predictions', () => {
    const mem = new CalibrationMemory('did:key:test');
    mem.recordOutcome({ predicted: 'water_monitoring', actual: 'water_monitoring' });
    mem.recordOutcome({ predicted: 'water_monitoring', actual: 'water_monitoring' });
    mem.recordOutcome({ predicted: 'water_monitoring', actual: 'water_monitoring' });
    expect(mem.confidence).toBeGreaterThan(0.7);
  });

  it('decreases confidence after wrong predictions', () => {
    const mem = new CalibrationMemory('did:key:test');
    // Start with some correct ones
    for (let i = 0; i < 5; i++) {
      mem.recordOutcome({ predicted: 'planting', actual: 'planting' });
    }
    const before = mem.confidence;
    mem.recordOutcome({ predicted: 'planting', actual: 'water_monitoring' });
    expect(mem.confidence).toBeLessThan(before);
  });

  it('learns location aliases from corrections', () => {
    const mem = new CalibrationMemory('did:key:test');
    mem.recordCorrection({
      rawText: 'worked at the creek today',
      correctedLocation: 'North Ventura River Watershed',
    });
    expect(mem.resolveLocation('the creek'))
      .toBe('North Ventura River Watershed');
  });

  it('learns activity clusters', () => {
    const mem = new CalibrationMemory('did:key:test');
    mem.recordOutcome({ actual: 'water_monitoring', coActivities: ['soil_sampling'] });
    mem.recordOutcome({ actual: 'water_monitoring', coActivities: ['soil_sampling'] });
    expect(mem.predictCoActivities('water_monitoring'))
      .toContain('soil_sampling');
  });
});

// ─── AI Routing ───

describe('AIRouter', () => {
  it('always routes transcription locally', () => {
    expect(routeAIRequest({ type: 'transcription' })).toBe('local_free');
  });

  it('always routes intent classification locally', () => {
    expect(routeAIRequest({ type: 'intent' })).toBe('local_free');
  });

  it('routes high-confidence classification locally', () => {
    expect(routeAIRequest({ type: 'impact_classify', confidence: 0.9 }))
      .toBe('local_free');
  });

  it('routes low-confidence classification to API', () => {
    expect(routeAIRequest({ type: 'impact_classify', confidence: 0.3 }))
      .toBe('api_sonnet');
  });

  it('uses WebLLM when available for summarization', () => {
    setWebGPUAvailable(true);
    setWebLLMLoaded(true);
    expect(routeAIRequest({ type: 'summarize', length: 1000 }))
      .toBe('webllm_local');
  });

  it('falls back to API when budget available', () => {
    setWebGPUAvailable(false);
    setCommunityBudget({ remaining: 5.00 });
    expect(routeAIRequest({ type: 'grant_draft' })).toBe('api_sonnet');
  });

  it('degrades gracefully when budget exhausted', () => {
    setCommunityBudget({ remaining: 0 });
    expect(routeAIRequest({ type: 'grant_draft' })).toBe('local_free');
  });
});

// ─── Yjs↔SQLite Pipeline ───

describe('YjsToSqlitePipeline', () => {
  it('inserts impact log into SQLite when added to Yjs feed', async () => {
    const doc = createCommunityDoc('test-community');
    const db = await createTestSqliteDb();
    bindYjsToSqlite(doc, db);

    const feed = doc.getArray('feed');
    feed.push([{
      id: 'log-1',
      type: 'impact_logged',
      authorDid: 'did:key:test',
      timestamp: Date.now(),
      summary: 'Water monitoring at north creek',
      data: { actionType: 'water_monitoring', locationName: 'north creek' },
    }]);

    // Wait for observer to fire
    await nextTick();

    const rows = db.exec('SELECT * FROM impact_logs WHERE id = ?', ['log-1']);
    expect(rows.length).toBe(1);
    expect(rows[0].action_type).toBe('water_monitoring');
  });

  it('handles concurrent inserts from multiple Yjs updates', async () => {
    // Simulate 2 peers adding entries simultaneously
    const doc = createCommunityDoc('test-community');
    const db = await createTestSqliteDb();
    bindYjsToSqlite(doc, db);

    const feed = doc.getArray('feed');
    // Simulate remote update
    const remoteDoc = new Y.Doc();
    Y.applyUpdate(remoteDoc, Y.encodeStateAsUpdate(doc));
    remoteDoc.getArray('feed').push([makeEntry('remote-1')]);
    feed.push([makeEntry('local-1')]);
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remoteDoc));

    await nextTick();

    const count = db.exec('SELECT COUNT(*) as c FROM impact_logs')[0].c;
    expect(count).toBe(2);
  });
});
```

### Integration Test Cases

```typescript
// ─── P2P Sync ───

describe('Mesh Sync', () => {
  it('two PWA peers sync Yjs doc via WebRTC', async () => {
    const peer1 = await createTestMeshNode({ isPersistent: false });
    const peer2 = await createTestMeshNode({ isPersistent: false });

    // Both join same community
    const doc1 = peer1.getCommunityDoc('test');
    const doc2 = peer2.getCommunityDoc('test');

    // Peer 1 adds an entry
    doc1.getArray('feed').push([makeEntry('from-peer-1')]);

    // Wait for sync
    await waitForSync(doc2, (doc) =>
      doc.getArray('feed').length === 1
    , { timeout: 5000 });

    expect(doc2.getArray('feed').get(0).id).toBe('from-peer-1');
  });

  it('extension peer relays between two NAT-blocked PWA peers', async () => {
    const extPeer = await createTestMeshNode({ isPersistent: true });
    const pwa1 = await createTestMeshNode({ isPersistent: false, relayThrough: extPeer });
    const pwa2 = await createTestMeshNode({ isPersistent: false, relayThrough: extPeer });

    const doc1 = pwa1.getCommunityDoc('test');
    const doc3 = pwa2.getCommunityDoc('test');

    doc1.getArray('feed').push([makeEntry('relayed')]);

    await waitForSync(doc3, (doc) =>
      doc.getArray('feed').length === 1
    , { timeout: 10000 });

    expect(doc3.getArray('feed').get(0).id).toBe('relayed');
  });

  it('sync recovers after peer disconnects and reconnects', async () => {
    const peer1 = await createTestMeshNode({ isPersistent: false });
    const peer2 = await createTestMeshNode({ isPersistent: false });

    const doc1 = peer1.getCommunityDoc('test');
    const doc2 = peer2.getCommunityDoc('test');

    // Peer 2 goes offline
    await peer2.disconnect();

    // Peer 1 adds entries while peer 2 is offline
    doc1.getArray('feed').push([makeEntry('while-offline-1')]);
    doc1.getArray('feed').push([makeEntry('while-offline-2')]);

    // Peer 2 reconnects
    await peer2.reconnect();

    await waitForSync(doc2, (doc) =>
      doc.getArray('feed').length === 2
    , { timeout: 10000 });

    expect(doc2.getArray('feed').length).toBe(2);
  });
});

// ─── Recording Flow E2E ───

describe('Recording Flow', () => {
  it('complete recording cycle offline', async () => {
    const page = await browser.newPage();
    await page.goto('https://coop.localhost');

    // Go offline
    await page.context().setOffline(true);

    // Tap the Orb
    await page.click('[data-testid="orb"]');
    await expect(page.locator('[data-testid="recording-indicator"]'))
      .toBeVisible();

    // Speak (inject test audio)
    await injectTestAudio(page, 'test-water-monitoring.wav');

    // Stop recording
    await page.click('[data-testid="orb"]');

    // Wait for transcription
    await expect(page.locator('[data-testid="transcription-result"]'))
      .toBeVisible({ timeout: 15000 });

    // Confirm
    await page.click('[data-testid="confirm-button"]');

    // Verify celebration state
    await expect(page.locator('[data-testid="orb"][data-state="celebrating"]'))
      .toBeVisible();

    // Verify persisted
    await page.reload();
    await expect(page.locator('[data-testid="feed-entry"]'))
      .toHaveCount(1);
  });
});
```

### Performance Budgets

```
┌──────────────────────────────────────────────────────────────────┐
│                    Performance Budgets                             │
│                                                                   │
│  Metric                          │ Budget   │ Gate     │ Tool    │
│  ────────────────────────────────┼──────────┼──────────┼──────── │
│  Initial load (PWA, cached)      │ < 2s     │ CI block │ LHCI    │
│  Initial load (PWA, first visit) │ < 5s     │ CI warn  │ LHCI    │
│  Time to interactive             │ < 3s     │ CI block │ LHCI    │
│  Orb tap → recording starts      │ < 200ms  │ CI block │ Vitest  │
│  Recording stop → transcription  │ < 8s     │ CI warn  │ Vitest  │
│    (30s audio, Whisper WASM)     │          │          │         │
│  Transcription → classification  │ < 500ms  │ CI block │ Vitest  │
│  Yjs update → SQLite insert      │ < 50ms   │ CI block │ Vitest  │
│  P2P sync (same network)         │ < 3s     │ CI warn  │ Integ.  │
│  P2P sync (via relay)            │ < 8s     │ CI warn  │ Integ.  │
│  Community feed render (50 items)│ < 100ms  │ CI block │ Vitest  │
│  Semantic search (1000 docs)     │ < 200ms  │ CI warn  │ Vitest  │
│  Skill load (cold)               │ < 1s     │ CI block │ Vitest  │
│  Total JS bundle (core)          │ < 300kB  │ CI block │ Vite    │
│  Total JS bundle (all skills)    │ < 800kB  │ CI warn  │ Vite    │
│  Lighthouse Performance score    │ > 90     │ CI block │ LHCI    │
│  Lighthouse Accessibility score  │ > 95     │ CI block │ LHCI    │
│  Memory (10 min active use)      │ < 200MB  │ CI warn  │ Playwright│
│  Memory (extension idle)         │ < 80MB   │ Manual   │ DevTools│
│                                  │          │          │         │
│  CI block = merge blocked if exceeded                            │
│  CI warn  = warning in PR, doesn't block                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Security & Privacy Model

### Threat Model

```
┌──────────────────────────────────────────────────────────────────┐
│                    Coop Threat Model                               │
│                                                                   │
│  TRUST BOUNDARY: Everything on the local device is trusted.      │
│  Everything from the mesh / network is untrusted until verified. │
│                                                                   │
│  Threat 1: Malicious peer injects false data into Yjs doc        │
│  ─────────────────────────────────────────────────────────       │
│  Impact: Fake impact logs, corrupted community feed              │
│  Mitigation:                                                     │
│    · Every replicated CRDT update is signed (batch-signed)       │
│      by the author's member DID key                              │
│    · Peers verify signatures before applying updates             │
│    · Unsigned or invalid-signature updates are dropped           │
│    · Community operator can revoke a DID (removes from members)  │
│                                                                   │
│  Threat 2: Eavesdropping on P2P traffic                          │
│  ─────────────────────────────────────────                       │
│  Impact: Exposure of community activity, personal recordings     │
│  Mitigation:                                                     │
│    · All libp2p connections encrypted via Noise protocol          │
│    · WebRTC DataChannels use DTLS encryption (browser-enforced)  │
│    · Media CIDs are content-addressed but not searchable without │
│      community membership (no public index)                      │
│                                                                   │
│  Threat 3: Rogue extension skill accesses unauthorized data      │
│  ────────────────────────────────────────────────────────        │
│  Impact: Skill reads other skills' data or user's browsing       │
│  Mitigation:                                                     │
│    · Skills run in isolated Web Workers (separate global scope)  │
│    · Skills communicate ONLY via Comlink typed interface          │
│    · Storage is namespaced per-skill (skill can't read others)   │
│    · Network access scoped to declared domains in manifest       │
│    · Skills are curated (no open marketplace in Phase 1-2)       │
│                                                                   │
│  Threat 4: Bootstrap/signaling server compromised                │
│  ──────────────────────────────────────────────                  │
│  Impact: Could deny P2P connections (DoS), not read data         │
│  Mitigation:                                                     │
│    · Signaling server only facilitates WebRTC handshake          │
│    · No data flows through signaling server after connection     │
│    · Communities can self-host signaling (just a WebSocket relay)│
│    · Multiple bootstrap nodes (no single point of failure)       │
│                                                                   │
│  Threat 5: Voice data exfiltrated                                │
│  ────────────────────────────                                    │
│  Impact: Private recordings sent to unauthorized third party     │
│  Mitigation:                                                     │
│    · ALL voice transcription runs locally (Whisper WASM)         │
│    · Raw audio NEVER leaves the device by default                │
│    · Only transcription text is stored/synced by default         │
│      (audio attachments are opt-in, policy-controlled)           │
│    · Audio chunks are discarded after transcription completes    │
│      by default                                                  │
│    · Content Security Policy blocks unexpected network requests  │
│                                                                   │
│  Threat 6: AI API calls leak private community data              │
│  ──────────────────────────────────────────────                  │
│  Impact: Claude sees sensitive community information             │
│  Mitigation:                                                     │
│    · AI routing sends minimal context (not full community doc)   │
│    · Community can opt out of API tier (local-only mode)         │
│    · API calls use community-owned key (not Coop master key)     │
│    · Anthropic data retention policy: no training on API data    │
│    · Dashboard shows exactly what was sent to API and when       │
└──────────────────────────────────────────────────────────────────┘
```

### Privacy Guarantees

```
Data that NEVER leaves the device:
  · Raw audio recordings (transcribed locally; deleted by default unless attached as evidence)
  · AI calibration memory (personal patterns, local only)
  · Passkey private keys (hardware-bound via WebAuthn)
  · Member signing keys (encrypted at rest; unlocked per session)
  · Channel/OAuth tokens (Bluesky/Telegram/Email) stored only on authorized anchor nodes (never in shared state)
  · Extension browsing context (content scripts run locally)

Data that syncs within community mesh (encrypted in transit):
  · Impact log entries (text + metadata + media CIDs)
  · Community member profiles
  · NodeBinding records (PeerId ↔ Member DID + capabilities)
  · Credential refs (non-secret handles + scopes + allowed anchor nodes)
  · Credential attestations (coarse region codes only; no PII)
  · Governance proposals and votes
  · Knowledge document metadata
  · Funding source discoveries

Data that goes to external APIs (with consent):
  · Transcription text → Claude API (for complex queries only)
  · Grant search queries → Grants.gov, SAM (public APIs)
  · Email provider APIs (send + inbox polling on anchor nodes; optional)
  · Credential verification sessions → OpenCred checkpoint (optional)
  · Attestation data → Ethereum (on-chain, by design)

Data that is NEVER collected by Coop infrastructure:
  · Usage analytics (no PostHog, no telemetry)
  · User identity linkage across communities
  · Browsing behavior outside Coop contexts
```

---

## Incident Response & Exit/Fork Strategy

Coop is a permissionless mesh: assume **compromise will happen** (lost devices, malware, social engineering, token leaks, malicious members). The architecture needs a **clear exit strategy** so communities can contain damage and continue operating without a central admin account.

Design goals:
- **Bound the blast radius**: most nodes can draft; only authorized anchors can execute outward actions.
- **Fail closed on execution**: when in doubt, block outbound actions and require re-authorization.
- **Make exits cheap**: members can leave, and communities can fork/migrate, using legible “long memory” snapshots (Git and/or Filecoin).
- **Make compromise legible**: every outward action has an auditable trail (`Job` → approval → executor → external message/tx).

### Threat Classes (What Can Be Compromised)

1) **Member key compromise** (`member_did` private key stolen)
- Damage: signed spam/poisoned data; governance abuse *if* the member has roles.
- Containment: revoke member from active membership list; require quorum for high-impact governance actions.

2) **Anchor compromise** (extension node holding channel creds / session keys)
- Damage: unauthorized Telegram/email/Bluesky posts; misuse of EIP‑4337 session key within allowlists; inbox data leakage (if scopes allow).
- Containment: revoke/rotate channel credentials at providers; revoke `CredentialRef`; freeze outbound execution; revoke session key on-chain; tighten/disable paymaster policy.

3) **Channel credential compromise** (Telegram bot token, Bluesky token, OAuth refresh token)
- Damage: reputational + coordination harm (posting as the coop); possible inbox read/send depending on scopes.
- Containment: rotate tokens at provider; revoke `CredentialRef` so anchors wipe local vault entries.

4) **Coop signing key compromise** (`coop_did` private key)
- Damage: forged “official coop” statements/exports/descriptors.
- Containment: rotate `coop_did` if old key can still sign a rotation; otherwise fork with a quorum-signed migration certificate (below).

5) **AA session key / paymaster compromise** (Pattern 2)
- Damage: only what the on-chain session module + paymaster sponsorship policy allow; worst-case is spam/DoS within caps.
- Containment: revoke session key on-chain; disable sponsorship policy; rotate Pimlico API key; clamp allowlists/rate limits.

### Incident Modes (Community “Freeze” Switch)

To stop damage quickly without deleting data, Coop supports an explicit incident mode in shared config:

```ts
type IncidentMode =
  | 'normal'
  | 'freeze_outbound'  // block all channel + onchain execution; drafting still allowed
  | 'freeze_all';      // also blocks role/skill changes; read-only except incident controls

type IncidentConfig = {
  mode: IncidentMode;
  reason?: string;
  setByDid: string;
  setAt: number;
  expiresAt?: number; // optional "auto-unfreeze" for temporary incidents
};
```

Enforcement rule (hard requirement):
- All executors (`coordination:message`, `chain:execute`, `browser:*` automation that posts/forms) MUST check `IncidentConfig.mode` and **fail closed**.

Authorization:
- Setting `freeze_*` requires a high-trust role (e.g. `guardian`) or a quorum approval (Phase 3+).
- Unfreezing requires the same (or stronger) authorization.

### Exit Options (Member Leaves vs Community Fork)

**Member exit (simple)**:
- A member can leave at any time by stopping sync and optionally wiping local coop storage (`community_id` namespace in IndexedDB/OPFS/SQLite).
- Because DIDs are per-coop, leaving does not expose a cross-coop identifier.

**Community fork / migration (when trust is lost)**:
- Fork means: create a new coop identity (`coop_did` → new `community_id`) and seed it from a known-good snapshot.
- Fork is the “escape hatch” when:
  - anchors are repeatedly compromised,
  - governance is captured,
  - coop signing key is compromised and cannot be credibly rotated,
  - channel identities are burned and need to be reset.

### Fork/Migration Artifacts (Make it Verifiable)

When forking, produce artifacts that can be published to **long memory** (Git and/or Filecoin) and posted to external channels:

1) **Snapshot Manifest** (hashable export)
```ts
type SnapshotManifest = {
  communityId: string;      // source community
  exportedAt: number;
  exportHash: string;       // sha256 of deterministic export bundle
  summary: string;
};
```

2) **Fork Certificate** (quorum-signed continuity proof)
```ts
type ForkCertificate = {
  kind: 'fork_certificate';
  fromCommunityId: string;
  toCommunityId: string;
  snapshot: SnapshotManifest;
  reason: 'security_incident' | 'governance_capture' | 'planned_migration';
  signedBy: string[];       // member_dids (guardians/council) that approve the fork
  signatures: string[];     // matching signatures over the canonical payload hash
  createdAt: number;
};
```

3) **Deprecation Notice** (posted in the *old* coop when possible)
```ts
type DeprecationNotice = {
  kind: 'deprecation_notice';
  communityId: string;      // the coop being deprecated
  migratedToCommunityId: string;
  forkCertificateHash: string;
  message: string;
  signedBy: string[];       // guardians/council
  signatures: string[];
  createdAt: number;
};
```

Publishing:
- Store `ForkCertificate` in the **new** coop’s shared state, and include it in Git exports and/or Filecoin archives.
- When possible, also copy `ForkCertificate` into the **old** coop (so old clients can verify the migration without leaving).
- If the old coop is still governable, write a `DeprecationNotice` in the **old** coop that references the fork certificate hash.
- Announce the new coop descriptor via Bluesky/Telegram/email using pre-established “trusted” channels.

Client behavior (required):
- If a client sees a valid `DeprecationNotice` **or** a valid `ForkCertificate` that references its current community, show a prominent **“Migrated / Deprecated”** banner with the new `community_id` + discovery info.

### Containment & Recovery Playbooks (Concrete Steps)

#### Playbook 0: Immediate containment (first 10 minutes)
- Set `IncidentConfig.mode = freeze_outbound` (block Telegram/email/Bluesky/onchain execution).
- Revoke/rotate compromised **channel credentials** at the provider:
  - Telegram: revoke bot token (BotFather regenerate) and remove bot from groups if needed.
  - Email: revoke OAuth grant in provider security settings.
  - Bluesky: rotate app password / revoke OAuth session.
- If Pattern 2 is enabled:
  - revoke/remove session key on-chain,
  - disable/tighten Pimlico Sponsorship Policy + rotate Pimlico API key.

#### Playbook 1: Assess blast radius (first hour)
- Review `outbound_actions` logs + onchain tx/userOp history (anchor local DB + shared feed events).
- Identify compromised DIDs and anchors (look for:
  - unusual posting cadence,
  - unexpected destinations,
  - execution by nodes that should not have capabilities,
  - large spikes in sponsored userOps).
- Decide recovery path: **rotate** (if governance is intact) vs **fork** (if trust is lost).

#### Playbook 2: Recover in place (governance intact)
- Revoke compromised member DIDs (remove from active members list; block their signed updates).
- Demote compromised anchors (remove anchor role; revoke all `CredentialRef`s they could access).
- Rotate coop signing key (`coop_did_rotated`) and republish `coop_descriptor`.
- Reconnect channels (new `CredentialRef` ids) and unfreeze after verification.

#### Playbook 3: Fork/migrate (trust lost)
- Export a deterministic snapshot from the last known-good state → produce `SnapshotManifest` → optionally publish to Git and/or Filecoin.
- Create a new coop (new `coop_did` → new `community_id`) and import the snapshot.
- Issue new invites; members join and generate new per-coop DIDs.
- Re-bind external identities (new Telegram bot, new Bluesky handle if needed, new mailbox/OAuth grant).
- If using Pattern 2 AA:
  - deploy/configure new `coop_operator_account`,
  - grant operator role in Gardens to the new account,
  - configure a new session key + new Pimlico policy,
  - publish the new operator address in the new coop config and exports.
- Publish `ForkCertificate` (quorum-signed) and announce migration via trusted channels.

### Required Safety Invariants (What Must Always Hold)

- No channel/OAuth/Pimlico secrets appear in shared state or Git/Filecoin publishes (only `CredentialRef` + public handles).
- Revoking a member DID blocks new signed updates from that DID (membership is part of verification).
- `freeze_outbound` blocks all outward actions even if an anchor still has tokens locally.
- Pattern 2 session keys are constrained on-chain (allowlist + `value==0` + rate limits + expiry) and are revocable without member key rotation.

---

## Graceful Degradation

```
┌──────────────────────────────────────────────────────────────────┐
│              What Happens When Things Fail                        │
│                                                                   │
│  Condition                │ Behavior                              │
│  ────────────────────────┼──────────────────────────────────── │
│  No internet              │ Full recording, storage, local AI.   │
│                           │ Sync queued. Badge: "Offline —       │
│                           │ changes will sync when connected."   │
│                           │                                      │
│  No peers online          │ Everything works locally. Yjs docs   │
│                           │ persist in IndexedDB. Sync resumes   │
│                           │ when any peer comes online.          │
│                           │                                      │
│  No extension peers       │ PWA-to-PWA via WebRTC (may fail      │
│  (only PWA nodes)         │ behind strict NAT). Falls back to    │
│                           │ signaling server relay. Badge:       │
│                           │ "Limited connectivity — install      │
│                           │ extension for better sync."          │
│                           │                                      │
│  Signaling server down    │ Can't discover NEW peers. Existing   │
│                           │ connections continue. Cached peer    │
│                           │ IDs used for direct reconnect.       │
│                           │                                      │
│  WebGPU unavailable       │ Whisper runs on CPU (slower, ~10s    │
│  (old device)             │ for 30s audio instead of ~3s).       │
│                           │ WebLLM disabled; Claude API used.    │
│                           │                                      │
│  Whisper model not cached │ First recording triggers download    │
│  (first ever use)         │ (244MB). Progress bar shown. User    │
│                           │ can type instead of speak while      │
│                           │ model downloads.                     │
│                           │                                      │
│  OPFS quota exceeded      │ Oldest cached media pruned (LRU).   │
│                           │ Core data (Yjs docs, SQLite)         │
│                           │ prioritized. Warning: "Storage full  │
│                           │ — oldest media will be removed."     │
│                           │                                      │
│  AI API budget depleted   │ Complex AI tasks paused. Local AI    │
│                           │ (transcription, search, basic        │
│                           │ classification) unaffected.          │
│                           │ "AI budget reached — basic features  │
│                           │ continue, advanced paused."          │
│                           │                                      │
│  Skill worker crashes     │ Skill restarted automatically (max   │
│                           │ 3 retries). If still failing:        │
│                           │ disabled with notification.          │
│                           │ Other skills unaffected (isolated).  │
│                           │                                      │
│  Yjs doc corrupted        │ Restore from last known good state   │
│                           │ in IndexedDB. If no backup: request  │
│                           │ full state from peers. Worst case:   │
│                           │ re-sync from scratch (slow but safe).│
│                           │                                      │
│  Browser crashes during   │ Audio chunks saved to IndexedDB      │
│  recording                │ incrementally. On reopen: "You had   │
│                           │ a recording in progress — resume?"   │
│                           │ Recovers partial recording.          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Offline Behavior Specification

```
┌──────────────────────────────────────────────────────────────────┐
│              Offline Capability Matrix                             │
│                                                                   │
│  Feature                     │ Offline? │ Notes                  │
│  ───────────────────────────┼──────────┼──────────────────────── │
│  Record impact (voice)       │ YES      │ Full local pipeline    │
│  Record impact (photo)       │ YES      │ Stored in OPFS         │
│  Transcribe recording        │ YES*     │ *After model cached    │
│  AI classification           │ YES      │ Local embeddings       │
│  View own recordings         │ YES      │ From IndexedDB/SQLite  │
│  View community feed         │ YES      │ From cached Yjs doc    │
│  Search local knowledge      │ YES      │ SQLite FTS + embeddings│
│  View cached grants          │ YES      │ From SQLite cache      │
│  Create governance proposal  │ YES      │ Queued in Yjs, syncs   │
│  Cast vote on proposal       │ YES      │ Queued in Yjs, syncs   │
│  View community members      │ YES      │ From cached Yjs doc    │
│  ─────────────────────────────────────────────────────────────── │
│  Sync with peers             │ NO       │ Requires P2P connection│
│  Claude/Gemini AI queries    │ NO       │ Requires internet      │
│  Search new grants online    │ NO       │ Requires API access    │
│  On-chain attestation        │ PARTIAL  │ Queues offline; publish needs internet + RPC (wallet signer or AA Pattern 2) │
│  Mint Hypercerts             │ NO       │ Requires blockchain    │
│  Extension cross-site overlay│ NO       │ Requires target site   │
│  View media from other peers │ PARTIAL  │ Only if previously     │
│                              │          │ cached in OPFS         │
│  WebLLM complex queries      │ YES*     │ *After 2GB model cached│
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Design rule: Every write operation works offline.               │
│  Reads work for cached data. Network-dependent features          │
│  show clear "unavailable offline" state (not error).             │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Deletion & CRDT Tombstones

CRDTs are append-only by nature. Deletion requires careful handling:

```typescript
// Yjs supports deletion natively — deleted items become tombstones
// that are eventually garbage collected.

// For user data deletion (right to be forgotten):
interface DataDeletion {
  // Soft delete: mark as deleted in Yjs, stop displaying
  // Tombstone remains in CRDT history but content is replaced
  softDelete(entryId: string): void;
  // Implementation: replace content with { deleted: true, deletedAt: timestamp }
  // All peers see the deletion via normal sync
  // SQLite row is deleted (reactive pipeline handles it)

  // Hard delete (for personal data):
  // Remove from local Yjs doc + SQLite + OPFS
  // Send "forget" message to peers via GossipSub
  // Peers remove from their local copies
  // Note: cannot guarantee all peers comply (CRDT limitation)
  // Acceptable because: personal recordings are authored by one person,
  // so deleting from your own doc removes the authoritative copy
  hardDelete(entryId: string): Promise<void>;

  // Community data retention policy:
  // Configurable per community in template
  // Default: 2 years for impact logs, 1 year for chat, forever for governance
  retentionPolicy: RetentionPolicy;
}
```

---

## Governance of Coop Itself

```
Who maintains what:

Bootstrap/signaling servers:
  · Coop project maintains default servers (signal.coop.earth)
  · Any community can self-host (it's a ~100 LOC WebSocket relay)
  · Multiple bootstrap nodes in different regions
  · Cost: ~$5/month per server (tiny VPS)
  · Funded by: Coop project treasury initially, community contributions later

Skill curation:
  · Phase 1-2: Coop team curates all skills (manual review)
  · Phase 3+: Community-nominated skills with review process
  · No open marketplace (learned from OpenClaw's ClawHub supply chain attack)
  · Skills are open-source, auditable, hash-verified

Bioregional templates:
  · Coop team creates initial templates
  · Communities can fork and customize
  · Template sharing is opt-in (community decides to publish)
  · No central template authority — it's a git-like fork model

Extension / PWA updates:
  · Extension: Chrome Web Store auto-update (standard MV3 update flow)
  · PWA: Service worker update on navigation (Workbox update strategy)
  · Breaking changes: versioned PlatformAdapter, migration scripts
  · Yjs doc schema: additive only (new fields, never remove)
```

---

## Migration Path from Green Goods

```
Coop is a NEW product, not a Green Goods refactor.

Green Goods → Coop relationship:
  · Green Goods continues as the on-chain impact verification protocol
  · Coop is a browser OS that uses Green Goods as its primary impact skill
  · The "green-goods" skill in Coop wraps the existing Green Goods
    PWA functionality (camera capture, EAS attestation, work submission)
  · Green Goods' shared package (@green-goods/shared) provides hooks
    and utilities that the green-goods skill builds on

Code reuse:
  · coop-core is NEW code (no fork of Green Goods)
  · coop-shared-ui reuses patterns from Green Goods but is a new package
  · The green-goods skill imports from @green-goods/shared
  · Libraries are shared via the monorepo (React, Vite, Tailwind, etc.)

Monorepo structure (if built in same repo):
  packages/
  ├── contracts/        ← existing Green Goods
  ├── shared/           ← existing Green Goods
  ├── client/           ← existing Green Goods PWA
  ├── admin/            ← existing Green Goods admin
  ├── indexer/          ← existing Green Goods
  ├── agent/            ← existing Green Goods
  ├── coop-core/        ← NEW: Coop OS kernel
  ├── coop-pwa/         ← NEW: Coop PWA shell
  ├── coop-extension/   ← NEW: Coop browser extension
  ├── coop-shared-ui/   ← NEW: Coop shared components
  └── coop-skills/      ← NEW: Coop skill packages
      ├── green-goods/  ← wraps @green-goods/shared
      ├── claude/
      ├── grants-gov/
      └── ...
```

---

## Versioning & Update Strategy

```
Skill versioning:
  · Semver (major.minor.patch)
  · Skills cached in OPFS by version: /coop/skills/{name}/{version}.js
  · Skill loader checks for updates on community doc config
  · Breaking changes: new major version, old version continues until
    community operator upgrades template

Yjs document schema:
  · ADDITIVE ONLY — never remove or rename fields
  · New fields have default values for backward compatibility
  · Schema version tracked in community doc config
  · Migration: on-load, check version, add missing fields with defaults

Extension updates:
  · Chrome Web Store review + auto-update
  · Canary → beta → stable rollout
  · Rollback: previous version cached, restore on crash

PWA updates:
  · Workbox stale-while-revalidate for app shell
  · New version downloaded in background
  · User prompted: "Coop has been updated — reload to get latest"
  · Never force-reload (user might be mid-recording)
```

---

## API Rate Limits & External Service Quotas

```
┌──────────────────────────────────────────────────────────────────┐
│  Service          │ Rate Limit            │ Coop Handling         │
│  ─────────────────┼───────────────────────┼───────────────────── │
│  Grants.gov API   │ 1,000 req/hour        │ Cache results in      │
│                   │                       │ SQLite (24h TTL).     │
│                   │                       │ Batch community       │
│                   │                       │ queries. Deduplicate. │
│                   │                       │                       │
│  SAM.gov API      │ 10,000 req/day        │ Same caching strategy.│
│                   │ (requires API key)    │ Community shares key. │
│                   │                       │                       │
│  USAspending API  │ Generous (gov service)│ Cache with 24h TTL.   │
│                   │                       │                       │
│  Claude API       │ Per-key rate limits   │ Queue with backoff.   │
│                   │ (varies by tier)      │ Budget cap prevents   │
│                   │                       │ runaway spending.     │
│                   │                       │                       │
│  Ethereum RPC     │ Varies by provider    │ Batch attestation     │
│                   │ (Alchemy: 300 CU/s)  │ submissions. Use      │
│                   │                       │ public RPCs for reads.│
│                   │                       │                       │
│  IPFS gateways    │ Varies               │ Prefer P2P (Helia).   │
│                   │                       │ Gateway as fallback   │
│                   │                       │ with exponential      │
│                   │                       │ backoff.              │
│                   │                       │                       │
│  All external     │ —                     │ Skill capability      │
│  services         │                       │ system enforces which │
│                   │                       │ domains each skill    │
│                   │                       │ can access. No skill  │
│                   │                       │ can make undeclared   │
│                   │                       │ network requests.     │
└──────────────────────────────────────────────────────────────────┘
```

---

1. **Yjs over Automerge**: 15x smaller, built-in P2P, no WASM, battle-tested
2. **Extension + PWA (not either/or)**: PWA for onboarding, extension for mesh backbone
3. **Skills decoupled from pillars**: Interface Registry, capability mesh
4. **PlatformAdapter abstraction**: Same core logic runs in browser, extension, or future Node/hardware
5. **Yjs is source of truth, SQLite is query cache**: CRDT handles sync/conflict, SQL handles queries
6. **Media is CID-referenced, lazy-loaded**: Text syncs instantly, media loads on demand
7. **AI is local-first**: Whisper + embeddings + classification run free in-browser. API only for complex tasks.
8. **AI costs are community-funded**: Free tier → community pool → grant-funded → yield-funded (future)
9. **Extension offscreen doc for best-effort mesh anchor**: MV3-compatible long-lived runtime for libp2p + pollers while the browser is open
10. **Skills are JS modules in Web Workers**: Not full WASM components (yet) — simpler, faster to build, migrate to WASM Component Model when tooling matures

---

## References

### Core protocols (CRDT + P2P + storage)

- [Yjs](https://github.com/yjs/yjs) — CRDT library
- [Yjs docs](https://docs.yjs.dev/)
- [y-protocols](https://github.com/yjs/y-protocols) — Yjs sync protocols
- [y-indexeddb](https://github.com/yjs/y-indexeddb) — Yjs persistence
- [y-webrtc](https://github.com/yjs/y-webrtc) — baseline WebRTC provider
- [libp2p JS](https://github.com/libp2p/js-libp2p) — P2P networking
- [libp2p docs](https://docs.libp2p.io/)
- [libp2p WebRTC (Browser)](https://docs.libp2p.io/guides/getting-started/webrtc/)
- [libp2p PubSub concepts](https://docs.libp2p.io/concepts/pubsub/) — gossipsub + topics
- [Helia](https://github.com/ipfs/helia) — IPFS in the browser
- [IPFS concepts](https://docs.ipfs.tech/concepts/) — content addressing, CIDs, pinning
- [wa-sqlite](https://github.com/nicktacik/wa-sqlite) — SQLite WASM
- [Comlink](https://github.com/GoogleChromeLabs/comlink) — Web Worker RPC
- [Origin Private File System (OPFS)](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/getDirectory) — browser persistent files

### Chrome Extensions (Manifest V3)

- [Extension docs (MV3)](https://developer.chrome.com/docs/extensions/develop/)
- [Service workers in MV3](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)
- [Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- [Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Tab Groups API](https://developer.chrome.com/docs/extensions/reference/api/tabGroups)
- [Debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger) — DevTools Protocol automation
- [OAuth2 for extensions](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)
- [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [Native messaging (MV3)](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Runtime messaging](https://developer.chrome.com/docs/extensions/reference/api/runtime)
- [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Host permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions#host-permissions)
- [Chrome permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list)
- [Chrome DevTools Protocol (CDP)](https://chromedevtools.github.io/devtools-protocol/)

### PWA + service worker tooling

- [Service Worker API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox](https://developer.chrome.com/docs/workbox/)
- [Vite PWA plugin](https://vite-pwa-org.netlify.app/)

### Identity, keys, and credentials (DID/VC)

- [WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/) — passkeys
- [WebCrypto / SubtleCrypto (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- [W3C DID Core](https://www.w3.org/TR/did-core/)
- [`did:key` method spec](https://w3c-ccg.github.io/did-method-key/)
- [Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model/)
- [Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [OAuth 2.0](https://www.rfc-editor.org/rfc/rfc6749)
- [PKCE (RFC 7636)](https://www.rfc-editor.org/rfc/rfc7636)
- [OIDC Core](https://openid.net/specs/openid-connect-core-1_0.html)
- [OpenID4VP](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
- [OpenID4VCI](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html)
- [OpenCred](https://opencred.org/) — CA verification checkpoint
- [OpenCred (GitHub)](https://github.com/stateofca/opencred)

### OAuth + email APIs (anchor node)

- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API overview](https://developers.google.com/gmail/api)
- [Gmail: messages.send](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send)
- [Gmail: history.list](https://developers.google.com/gmail/api/reference/rest/v1/users.history/list)
- [Microsoft Graph Mail API](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [Microsoft Graph: sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail)
- [Microsoft Graph: delta query](https://learn.microsoft.com/en-us/graph/delta-query-overview)

### Social + messaging APIs (external presence)

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram bots overview](https://core.telegram.org/bots)
- [AT Protocol](https://atproto.com/)
- [ATProto spec index](https://atproto.com/specs/)
- [ATProto (GitHub)](https://github.com/bluesky-social/atproto)
- [Bluesky API docs](https://docs.bsky.app/)

### Onchain (EVM) + wallets + Safe + attestations

- [EIP-1193 (Ethereum Provider JavaScript API)](https://eips.ethereum.org/EIPS/eip-1193)
- [EIP-712 (Typed structured data hashing & signing)](https://eips.ethereum.org/EIPS/eip-712)
- [EIP-1271 (Standard Signature Validation Method for Contracts)](https://eips.ethereum.org/EIPS/eip-1271)
- [WalletConnect docs](https://docs.walletconnect.com/)
- [Viem](https://viem.sh/) — TS-first EVM client
- [Wagmi](https://wagmi.sh/) — React hooks for EVM wallets
- [Safe docs](https://docs.safe.global/)
- [Safe Core SDK (GitHub)](https://github.com/safe-global/safe-core-sdk)
- [Safe Transaction Service (GitHub)](https://github.com/safe-global/safe-transaction-service)
- [Ethereum Attestation Service (EAS) docs](https://docs.attest.sh/)
- [EAS SDK (GitHub)](https://github.com/ethereum-attestation-service/eas-sdk)
- [EAS contracts (GitHub)](https://github.com/ethereum-attestation-service/eas-contracts)
- [Hypercerts](https://www.hypercerts.org/)
- [Hypercerts protocol (GitHub)](https://github.com/hypercerts-org/hypercerts-protocol)

#### Account Abstraction (EIP‑4337) + permissions

- [EIP-4337](https://eips.ethereum.org/EIPS/eip-4337) — Account Abstraction via Entry Point Contract
- [ERC‑4337 docs](https://docs.erc4337.io/)
- [Paymaster signature (EntryPoint v0.9)](https://docs.erc4337.io/paymasters/paymaster-signature.html)
- [Ethereum Foundation: Pectra upgrade](https://blog.ethereum.org/en/2025/04/23/pectra-mainnet) — EIP‑7702 shipped
- [Account Abstraction (EntryPoint repo)](https://github.com/eth-infinitism/account-abstraction)
- [EntryPoint releases / versions](https://github.com/eth-infinitism/account-abstraction/releases)
- [ERC-7579](https://ercs.ethereum.org/ERCS/erc-7579) — Minimal Modular Smart Accounts
- [EIP-6900](https://eips.ethereum.org/EIPS/eip-6900) — Modular Smart Contract Accounts and Plugins
- [EIP-7562](https://eips.ethereum.org/EIPS/eip-7562) — Account Abstraction Mempool Rules
- [EIP-7677](https://eips.ethereum.org/EIPS/eip-7677) — Paymaster Web Service Capability
- [EIP-6492](https://eips.ethereum.org/EIPS/eip-6492) — Signature Validation for Predeploy Contracts
- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) — Set EOA account code for one transaction
- [EIP-7701](https://eips.ethereum.org/EIPS/eip-7701) — Native Account Abstraction
- [EIP-5792](https://eips.ethereum.org/EIPS/eip-5792) — Wallet call batching (`wallet_sendCalls`)
- [EIP-7715](https://eips.ethereum.org/EIPS/eip-7715) — Wallet grant permissions (`wallet_grantPermissions`)

#### Pimlico (Bundler + Paymaster + Sponsorship Policies)

- [Pimlico docs](https://docs.pimlico.io/)
- [Supported chains + EntryPoint versions](https://docs.pimlico.io/guides/supported-chains)
- [Create Pimlico API key](https://docs.pimlico.io/guides/create-api-key)
- [Bundler reference](https://docs.pimlico.io/references/bundler)
- [Paymaster reference](https://docs.pimlico.io/references/paymaster)
- [Sponsorship Policies API](https://docs.pimlico.io/references/platform/api/sponsorship-policies)
- [Sponsorship Policies guide](https://docs.pimlico.io/guides/how-to/sponsorship-policies)
- [Verifying Paymaster endpoints](https://docs.pimlico.io/references/paymaster/verifying-paymaster/endpoints)
- [`pm_sponsorUserOperation` (v2)](https://docs.pimlico.io/references/paymaster/verifying-paymaster/endpoints#pm_sponsoruseroperation-v2)
- [`pm_validateSponsorshipPolicies`](https://docs.pimlico.io/references/paymaster/verifying-paymaster/endpoints#pm_validatesponsorshippolicies)
- [`pimlico_getUserOperationGasPrice`](https://docs.pimlico.io/references/bundler/endpoints/pimlico_getUserOperationGasPrice)
- [`eth_sendUserOperation`](https://docs.pimlico.io/references/bundler/endpoints/eth_sendUserOperation)
- [`eth_estimateUserOperationGas`](https://docs.pimlico.io/references/bundler/endpoints/eth_estimateUserOperationGas)
- [`eth_getUserOperationReceipt`](https://docs.pimlico.io/references/bundler/endpoints/eth_getUserOperationReceipt)
- [permissionless.js docs](https://docs.pimlico.io/references/permissionless)
- [permissionless.js (GitHub)](https://github.com/pimlicolabs/permissionless.js)

#### Session keys (modules) — optional research direction

- [SmartSessions (session key module)](https://github.com/erc7579/smartsessions)
- [ERC‑7579 modules list](https://github.com/erc7579/modules)

### Long Memory Stores (Git + Filecoin)

- [Git documentation](https://git-scm.com/doc)
- [GitHub REST API](https://docs.github.com/en/rest)
- [Content Addressable aRchives (CAR) spec](https://ipld.io/specs/transport/car/)
- [Storacha](https://storacha.network/) — hot storage + Filecoin-backed durability
- [Storacha docs](https://docs.storacha.network/)
- [Storacha: Filecoin storage concept](https://docs.storacha.network/concepts/filecoin-storage)
- [Storacha: UCAN concept](https://docs.storacha.network/concepts/ucan/)
- [Filecoin](https://filecoin.io/)
- [Filecoin Specification](https://spec.filecoin.io/)

### AI runtimes (browser + optional daemon)

- [Claude Platform docs](https://platform.claude.com/docs)
- [Claude API: Messages](https://platform.claude.com/docs/api/messages)
- [Tool use](https://platform.claude.com/docs/en/tool-use/overview)
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) — optional daemon tier
- [Transformers.js](https://github.com/xenova/transformers.js) — browser ML
- [WebLLM](https://github.com/mlc-ai/web-llm) — in-browser LLM via WebGPU
- [WebGPU (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [WebGPU spec](https://www.w3.org/TR/webgpu/)
- [WebNN spec](https://www.w3.org/TR/webnn/)
- [ONNX Runtime Web](https://github.com/microsoft/onnxruntime/tree/main/js/web)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — local transcription baseline

### Repo-local guides (Green Goods)

- [Repo guidance (CLAUDE.md)](../CLAUDE.md)
- [Context: agent](../.claude/context/agent.md)
- [Context: client](../.claude/context/client.md)
- [Skill: agent](../.claude/skills/agent/SKILL.md)
- [Skill: data-layer](../.claude/skills/data-layer/SKILL.md)
- [Contracts (README)](../packages/contracts/README.md)
- [Shared (README)](../packages/shared/README.md)
- [Green Goods Local-First Evolution](2026-02-19-local-first-evolution.md)
- [Local-First Extended Tooling](2026-02-19-local-first-extended-tooling.md)
- [AI-Accelerated Development Spec](ai-accelerated-development-spec.md)
- [OpenClaw Pipeline Plan](../.claude/plans/openclaw-agentic-pipeline.md)
