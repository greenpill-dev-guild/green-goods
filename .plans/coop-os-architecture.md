# Coop OS Architecture

**Status**: DRAFT v2
**Created**: 2026-03-01
**Updated**: 2026-03-01
**Scope**: Browser PWA + Browser Extension (hardware tier is future — architecture is modular to port)

---

## Vision

Coop is a browser-based OS for regenerative coordination. TypeScript-first, skills-based, bioregional, voice-first. Communities capture impact, coordinate governance, build knowledge commons, and discover funding — all through a P2P mesh where every browser is a node.

**Scope boundary**: This plan covers the PWA and browser extension. The architecture is modular so that skills, state, and mesh protocols can port to hardware runtimes (OpenClaw, DappNode, bare metal) in the future without rewriting core logic.

## Four Pillars (Lenses, Not Categories)

Pillars are **query lenses** into a shared capability mesh, not skill containers.

1. **Impact Reporting** — evidence capture, verification, attestation
2. **Coordination & Governance** — proposals, voting, roles, messaging
3. **Knowledge Commons** — docs, data, AI-assisted curation, community memory
4. **Capital Formation** — grants, staking yield, impact certificates, treasury

---

## Architecture: PWA + Extension

### Why Two Surfaces

| Capability | PWA (coop.earth) | Extension |
|---|---|---|
| Onboarding | URL → instant access | Store install (friction) |
| Mobile | Full support (iOS/Android) | Chrome Android only, no iOS |
| Background service worker | Killed after ~5 min idle | **Persistent** (MV3 offscreen doc) |
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
│  │ Background Service Worker (persistent via offscreen doc) │   │
│  │                                                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │   │
│  │  │ Mesh     │ │ Yjs Sync │ │ Skill    │ │ AI         │  │   │
│  │  │ Node     │ │ Engine   │ │ Runtime  │ │ Pipeline   │  │   │
│  │  │ (libp2p) │ │          │ │ (Workers)│ │ (Whisper,  │  │   │
│  │  │          │ │          │ │          │ │  Embeddings│  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │   │
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
│  │ Offscreen Document (keeps SW alive for mesh relay)        │  │
│  │ Invisible page that maintains WebRTC connections           │  │
│  │ and Yjs sync even when no Coop UI is open                 │  │
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
    "offscreen",         // keep SW alive for mesh relay
    "sidePanel",         // main UI surface
    "notifications",     // local system notifications
    "nativeMessaging",   // future: bridge to local services
    "activeTab"          // content script injection
  ],
  "host_permissions": [
    "https://github.com/*",
    "https://drive.google.com/*",
    "https://www.grants.gov/*",
    "https://bsky.app/*"
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
// Offscreen document — keeps libp2p alive
// MV3 service workers die after 30s of inactivity
// Offscreen docs persist as long as browser is open

// background.ts
chrome.offscreen.createDocument({
  url: 'offscreen.html',
  reasons: ['WORKERS'],   // Web Workers for libp2p + Yjs
  justification: 'Maintaining P2P mesh connections for community sync'
});

// offscreen.ts — runs the mesh node
import { createCoopMeshNode } from '@coop/mesh';
import { createYjsSyncEngine } from '@coop/sync';

const mesh = await createCoopMeshNode();
const sync = await createYjsSyncEngine(mesh);

// This stays alive as long as the browser is open
// Relays data between community peers
// Syncs Yjs documents in background
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
│   ├── background.ts       ← SW: mesh node + sync
│   ├── offscreen.ts        ← Persistent mesh relay
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
// coop-core/platform.ts — injected by shell, not imported directly

interface CoopPlatform {
  // Storage adapter (different impl for PWA vs extension vs Node)
  storage: {
    opfs: () => Promise<FileSystemDirectoryHandle>;
    indexedDB: (name: string) => Promise<IDBDatabase>;
    kvStore: (namespace: string) => KVStore;
  };

  // Network adapter
  network: {
    createLibp2pNode: (config: MeshConfig) => Promise<Libp2pNode>;
    // PWA: ephemeral node, extension: persistent, Node: full
  };

  // Platform capabilities
  capabilities: {
    persistentBackground: boolean;  // false in PWA, true in extension
    crossOrigin: boolean;           // false in PWA, true in extension
    nativeMessaging: boolean;       // false in PWA, true in extension
    camera: boolean;                // true in both
    notifications: 'push' | 'local' | 'none';
  };
}
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
│  │   community:{id}:feed     → activity feed (Y.Array)         │  │
│  │   community:{id}:members  → member profiles (Y.Map)         │  │
│  │   community:{id}:proposals → governance proposals (Y.Array)  │  │
│  │   community:{id}:knowledge → shared docs index (Y.Map)      │  │
│  │   user:{did}:calibration  → personal AI memory (Y.Map)      │  │
│  │   user:{did}:drafts       → in-progress recordings (Y.Map)  │  │
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
│  │ What: Photos, audio recordings, video clips                 │  │
│  │ Persisted to: OPFS (fast, quota-managed, no IndexedDB bloat)│  │
│  │ Referenced by: CID (content hash) in Yjs documents          │  │
│  │ Synced via: Helia (IPFS) when peers request content          │  │
│  │ Size: ~100MB-2GB (auto-prune oldest when approaching quota) │  │
│  │                                                              │  │
│  │ Directory structure:                                         │  │
│  │   /coop/media/{cid}         → original media files          │  │
│  │   /coop/media/{cid}.thumb   → compressed thumbnails          │  │
│  │   /coop/models/             → cached ML models (Whisper etc) │  │
│  │   /coop/skills/             → cached skill WASM bundles      │  │
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
└──────────────────────────────────────────────────────────────────┘
```

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

  // Governance proposals
  const proposals = doc.getArray<Proposal>('proposals');

  // Knowledge index (not full content — just metadata + CIDs)
  const knowledge = doc.getMap<KnowledgeRef>('knowledge');

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
        'proposal_passed' | 'funding_matched' | 'knowledge_added';
  authorDid: string;
  timestamp: number;
  summary: string;        // human-readable summary
  data: Record<string, unknown>;  // type-specific payload
  mediaCids?: string[];   // references to OPFS binary store
}

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
  communities: string[];   // bioregion topic IDs
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

  // Subscribe to each community's bioregion topic
  for (const community of config.communities) {
    node.services.pubsub.subscribe(`/coop/community/${community}`);
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

import * as Y from 'yjs';
import {
  writeSyncStep1,     // sends local state vector
  writeSyncStep2,     // sends missing updates
  readSyncMessage,
} from 'yjs/dist/src/utils/sync.js';

class LibP2PYjsProvider {
  private doc: Y.Doc;
  private node: Libp2pNode;
  private topic: string;

  constructor(doc: Y.Doc, node: Libp2pNode, communityId: string) {
    this.doc = doc;
    this.node = node;
    this.topic = `/coop/community/${communityId}`;

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
          this.encodeSyncUpdate(update)
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
        this.sendToPeer(from, this.encodeSyncStep2(diff));
        break;

      case 1: // sync step 2 — peer sends updates we're missing
        const update = decoder.readVarUint8Array();
        Y.applyUpdate(this.doc, update, 'remote');
        break;

      case 2: // incremental update
        const incUpdate = decoder.readVarUint8Array();
        Y.applyUpdate(this.doc, incUpdate, 'remote');
        break;
    }
  }
}
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
   - Maintain Yjs sync even when no Coop tab is open

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
// Decision tree: local vs API for each request type

type AIRoute = 'local_free' | 'api_sonnet' | 'api_opus' | 'webllm_local';

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

  // Simple summarization → try WebLLM first, fallback to API
  if (request.type === 'summarize' && request.length < 2000) {
    if (webGPUAvailable && webLLMLoaded) return 'webllm_local';
    return 'api_sonnet';
  }

  // Complex tasks → API (with budget check)
  if (request.type === 'grant_draft' || request.type === 'report_generate') {
    if (communityBudget.remaining <= 0) {
      // Notify community that AI budget is depleted
      notify('AI budget reached. Complex tasks paused until next month.');
      return 'local_free'; // graceful degradation
    }
    return 'api_sonnet';
  }

  // Default: try local first, fallback to cheapest API
  return webGPUAvailable ? 'webllm_local' : 'api_sonnet';
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
│    d. Pass capability tokens:                                │
│       { network: ["https://www.grants.gov/*"],               │
│         storage: { quota: "50MB", namespace: "grants-gov" }, │
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

interface PlatformAdapter {
  storage: StorageAdapter;
  network: NetworkAdapter;
  ai: AIAdapter;
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
  | 'coordination:roles'      // manage permissions/hats
  // Capital
  | 'capital:search-funding'  // find funding opportunities
  | 'capital:apply'           // submit grant application
  | 'capital:treasury'        // manage community funds
  | 'capital:certify'         // mint impact certificates
  // Cross-cutting
  | 'ai:query'                // LLM query (any context)
  | 'ai:analyze'              // structured analysis
  | 'identity:resolve'        // resolve DID to profile
  | 'social:post'             // publish to social network

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

## Build Phases (Scoped to Browser + Extension)

### Phase 1 (Months 1-3): Kernel + Recording Flow
- `coop-core`: PlatformAdapter abstraction, skill loader, interface registry
- `coop-core/state`: Yjs docs + y-indexeddb + wa-sqlite reactive pipeline
- `coop-core/identity`: Passkey auth + DID generation
- `coop-core/ai`: Whisper WASM transcription + intent classification + calibration memory
- `coop-pwa`: Vite PWA shell with Orb recording flow
- `coop-shared-ui`: Orb component, RecordingFlow state machine (XState), CommunityFeed
- Skills: `green-goods` (impact capture), `claude` (AI assistant)
- One bioregional template
- AI economics: free tier ($10/mo API credit per community)

### Phase 2 (Months 3-6): Mesh + Extension + Skills
- `coop-core/mesh`: libp2p node, Yjs-over-libp2p sync provider
- `coop-extension`: MV3 manifest, background SW, offscreen doc (persistent mesh)
- `coop-extension/content-scripts`: GitHub overlay, Grants.gov scraper
- `coop-extension/sidepanel`: full Coop UI (shared components with PWA)
- Skills: `grants-gov`, `github`, `bluesky`, `gardens` (governance), `google-drive`
- Bioregional template engine + 3 templates
- Community feed UX, cross-site knowledge capture
- AI economics: community pool funding, usage dashboard

### Phase 3 (Months 6-9): Federation + Advanced Skills
- Cross-bioregion mesh routing (GossipSub topic bridging)
- Template marketplace (communities share/fork templates)
- Skills: `signal`, `at-proto`, `hypercerts`, `safe-wallet`, `open-civics`
- Semantic search across knowledge commons (vector embeddings in SQLite)
- WebLLM integration (optional in-browser LLM for capable devices)
- Native messaging bridge spec (for future hardware tier)
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
│    · Every Yjs update is signed by the author's DID key          │
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
│    · Raw audio NEVER leaves the device                           │
│    · Only the transcription text (not audio) is stored/synced    │
│    · Audio chunks are discarded after transcription completes    │
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
  · Raw audio recordings (transcribed locally, then deleted)
  · AI calibration memory (personal patterns, local only)
  · Passkey private keys (hardware-bound via WebAuthn)
  · Extension browsing context (content scripts run locally)

Data that syncs within community mesh (encrypted in transit):
  · Impact log entries (text + metadata + media CIDs)
  · Community member profiles
  · Governance proposals and votes
  · Knowledge document metadata
  · Funding source discoveries

Data that goes to external APIs (with consent):
  · Transcription text → Claude API (for complex queries only)
  · Grant search queries → Grants.gov, SAM (public APIs)
  · Attestation data → Ethereum (on-chain, by design)

Data that is NEVER collected by Coop infrastructure:
  · Usage analytics (no PostHog, no telemetry)
  · User identity linkage across communities
  · Browsing behavior outside Coop contexts
```

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
│  On-chain attestation        │ NO       │ Requires Ethereum RPC  │
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
9. **Extension offscreen doc for persistent mesh**: MV3 workaround keeps libp2p alive
10. **Skills are JS modules in Web Workers**: Not full WASM components (yet) — simpler, faster to build, migrate to WASM Component Model when tooling matures

---

## References

- [Yjs](https://github.com/yjs/yjs) — CRDT library (17.5k stars)
- [libp2p JS](https://github.com/libp2p/js-libp2p) — P2P networking
- [Helia](https://github.com/ipfs/helia) — IPFS in browser
- [Transformers.js](https://github.com/xenova/transformers.js) — Browser ML
- [WebLLM](https://github.com/mlc-ai/web-llm) — In-browser LLM via WebGPU
- [wa-sqlite](https://github.com/nicktacik/wa-sqlite) — SQLite WASM
- [Comlink](https://github.com/nicktacik/comlink) — Web Worker RPC
- [Chrome MV3 Offscreen Documents](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [libp2p WebRTC Browser](https://docs.libp2p.io/guides/getting-started/webrtc/)
- [Green Goods Local-First Evolution](.plans/2026-02-19-local-first-evolution.md)
- [OpenClaw Pipeline Plan](.claude/plans/openclaw-agentic-pipeline.md)
