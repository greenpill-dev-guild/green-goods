# Local-First Extended Tooling: Media, AI, and Alternative Stacks

**Companion to**: `2026-02-19-local-first-evolution.md` (core sync/storage plan)

This document covers areas not addressed in the core evolution plan: media handling, on-device AI, geospatial tools, alternative sync engines, and emerging browser APIs.

---

## High-Impact Discoveries

Three findings fundamentally extend the core plan:

### 1. EAS Offchain Attestations (Biggest Win)

**What**: EAS already supports `signOffchainAttestation()` — purely cryptographic EIP-712 signatures requiring NO gas and NO network. Attestations can be timestamped on-chain later via `multiTimestamp()`.

**Why it matters**: Currently, work submissions require on-chain EAS attestations (gas + RPC). With offchain attestations, the flow becomes:
1. Sign attestation locally using passkey-derived smart account
2. Store in local SQLite/IndexedDB
3. Batch-timestamp on-chain when connectivity returns

**Already available**: `@ethereum-attestation-service/eas-sdk` v2.7.0 is already a dependency in `packages/client/package.json`. The `signOffchainAttestation` method exists but is NOT currently used (only found in i18n translation strings).

**Effort**: Medium — integrates directly with the existing job queue architecture.

**Files to modify**:
- `packages/shared/src/modules/work/passkey-submission.ts` — add offchain signing path
- `packages/shared/src/modules/job-queue/index.ts` — batch timestamp on sync
- New: `packages/shared/src/utils/eas/offchain-builder.ts` — offchain attestation builder

### 2. Helia + blockstore-opfs (Content-Addressed Local Storage)

**What**: Helia (official js-ipfs successor from Protocol Labs) with `blockstore-opfs` provides IPFS-native local storage in the browser. Images get a CID the moment they're captured, persist in OPFS, and upload as CAR files when online.

**Why it matters**: Currently, images are stored as raw blobs in IndexedDB and get IPFS CIDs only during on-chain attestation. With Helia:
- CID computed locally at capture time (content-addressed from the start)
- OPFS persistence (3-4x faster than IndexedDB for binary data)
- CAR file export for direct Storacha upload (`uploadCAR()`)
- Built-in deduplication (same image = same CID)
- Verified fetch from gateways (`@helia/verified-fetch`)

**Dependencies**:
```bash
bun add helia @helia/unixfs @helia/car blockstore-opfs
```

**Effort**: High — significant architectural change but aligns perfectly with the on-chain attestation model.

### 3. Image Quality + Geolocation Validation (Zero-Download)

**What**: Pure JavaScript image quality checks (blur, brightness, resolution) and EXIF GPS extraction — no model downloads required.

**Why it matters**: Conservation workers in the field sometimes submit blurry, dark, or off-location photos. These can be caught client-side before submission:
- **Blur detection**: Laplacian variance via Canvas API (sharp images = high variance)
- **Brightness/contrast**: Pixel histogram analysis
- **GPS validation**: `exifr` library (4KB gzipped) extracts GPS from EXIF, cross-referenced against garden location via `turf.booleanPointInPolygon()`

**Effort**: Low — pure JS, integrates into existing `Media.tsx` upload flow.

---

## Tool Inventory by Category

### A. Media & File Handling

| Tool | What | Size | Effort | Value |
|---|---|---|---|---|
| **OPFS migration** | Move binary media from IndexedDB to OPFS | 0KB (native API) | Medium | 3-4x faster I/O, no serialization dance |
| **Helia + blockstore-opfs** | Content-addressed local IPFS storage | ~50KB | High | CID at capture, CAR export, dedup |
| **IPFS gateway caching** | CacheFirst rule for `w3s.link/ipfs/*` in Workbox | 0KB (config change) | Trivial | Immutable content = perfect cache-forever |
| **OffscreenCanvas thumbnails** | Generate 256px thumbnails in Web Worker | 0KB (native API) | Medium | Faster gallery, less memory on low-end Android |
| **browser-image-compression** | Already in use, well-tuned | — | None | Already optimal at `maxSizeMB: 0.8, maxWidthOrHeight: 2048` |
| **Photon WASM** | High-perf image processing (watermarks, filters, metadata stripping) | ~4MB | Low priority | Future: watermark conservation photos |

**Recommended order**: IPFS gateway caching (minutes) → EXIF extraction → OffscreenCanvas thumbnails → OPFS migration → Helia evaluation

### B. On-Device AI/ML

`★ Insight ─────────────────────────────────────`
WebGPU has hit universal browser support as of January 2026 (~70% global coverage). Transformers.js v4 is the leading framework with a completely rewritten C++ WebGPU runtime tested across ~200 model architectures. The key decision is: **pure JS (no model)** for simple checks vs **model-based** for classification/transcription. Always implement progressive enhancement: attempt WebGPU → fall back to WASM → degrade to no-AI.
`─────────────────────────────────────────────────`

#### Tier 1 — No Model Download (Pure JS)

| Tool | Use Case | Size | Integration Point |
|---|---|---|---|
| **Canvas blur detection** | Reject blurry photos before submission | 0KB | `Media.tsx` upload flow |
| **Histogram analysis** | Detect over/underexposed photos | 0KB | `Media.tsx` upload flow |
| **`exifr`** | Extract GPS/date from photo EXIF data | 4KB gzipped | `Media.tsx` → compare with garden location |
| **`turf.booleanPointInPolygon`** | Validate photo was taken inside garden boundary | ~8KB (tree-shakeable) | New `usePhotoLocation` hook |
| **`inspector-bokeh`** | Alternative blur detection (Marziliano edge-width) | ~2KB | Fallback if Canvas method needs refinement |

#### Tier 2 — Small Model Downloads (40-250MB, cached in OPFS)

| Tool | Use Case | Model Size | Framework |
|---|---|---|---|
| **Whisper speech-to-text** | Transcribe audio field notes to searchable text | 40MB (tiny.en) / 250MB (small, multilingual) | Transformers.js v4 |
| **CLIP zero-shot classification** | Classify photos as "plant"/"soil"/"garden"/"compost" | ~150MB | Transformers.js v4 |
| **MobileNetV4** | Lightweight image classification (1000 ImageNet categories) | ~20MB | Transformers.js v4 or MediaPipe |
| **PMTiles + MapLibre** | Offline maps for garden locations | Variable (few MB per city region) | MapLibre GL JS + `pmtiles` protocol |

#### Tier 3 — Larger Models (250MB-1GB, opt-in)

| Tool | Use Case | Model Size | Framework |
|---|---|---|---|
| **Gemma 3 270M (INT4)** | Auto-generate work descriptions from photos + audio | ~135MB | WebLLM |
| **Phi-4-mini (INT4)** | Higher quality text generation | ~2GB | WebLLM |
| **Whisper-small (multilingual)** | Spanish/Portuguese audio transcription | ~250MB | Transformers.js v4 |
| **Fine-tuned plant classifier** | Species-level plant identification | Custom ONNX | ONNX Runtime Web |

**Key frameworks**:
- **[Transformers.js v4](https://huggingface.co/blog/transformersjs-v4)**: Unified API for all tasks. 53% smaller web bundle. ONNX backend.
- **[WebLLM](https://webllm.mlc.ai/docs/)**: Specialized for LLMs. 80% of native GPU performance. OpenAI-compatible API.
- **[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide)**: Google's batteries-included vision suite. Easiest setup.
- **[ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)**: Low-level inference. Best for custom models.

**Battery management**: Use event-driven inference only (trigger on photo upload, not continuously). Prefer WASM for simple tasks, reserve WebGPU for heavy tasks. Consider `ComputePressureObserver` API to throttle when device is strained.

### C. Geospatial

| Tool | What | Effort | Value |
|---|---|---|---|
| **`exifr`** | GPS extraction from photos | Trivial | Validate photo location matches garden |
| **`@turf/turf`** | Spatial analysis (distance, point-in-polygon, area) | Low | Garden boundary validation, plot area calc |
| **PMTiles + MapLibre GL JS** | Offline vector maps | Medium | Visual garden context without connectivity |
| **`protomaps-themes-base`** | Map styling for PMTiles | Low | Default tiles rendering |

**Architecture**: When a gardener enrolls in a garden, download PMTiles covering that geographic region (few MB for city-sized area). Store in OPFS. Render offline maps with MapLibre. Cross-reference photo EXIF GPS against garden GeoJSON boundaries.

### D. Alternative Sync Engines & Tools

| Tool | Status (2026) | Fit for Green Goods | Notes |
|---|---|---|---|
| **ElectricSQL 1.1** | GA, production-proven | **Best fit** (Phase 4 choice) | 102x faster writes in 1.1, Trigger.dev at 20k writes/sec |
| **Turso/libSQL** | Production, browser WASM available | **Evaluate vs wa-sqlite for Phase 1** | Built-in sync + CDC, Rust rewrite of SQLite |
| **Zero (Rocicorp)** | Late alpha → beta | Monitor for GA | Query-powered sync, Replicache sunsetted |
| **PowerSync** | Production | Viable alternative to ElectricSQL | Multi-backend (Postgres, MongoDB, MySQL) |
| **RxDB** | Mature (since 2016) | Alternative if starting fresh | Observable queries, pluggable replication |
| **Convex** | Production, self-hostable | Too opinionated for Green Goods | Full backend replacement, not sync layer |
| **Ditto** | Production, $82M Series B | Future: mesh P2P sync | Mesh networking for field workers without internet |
| **InstantDB** | Production | Firebase-style lock-in | Not recommended due to vendor dependency |
| **Jazz/CoJSON** | Active development | Greenfield only | Would require full rewrite of data layer |
| **Liveblocks** | Open-sourced sync engine (2025) | Low priority | Yjs-backed, focused on collaborative UI |
| **Automerge 3.0** | Released Aug 2025 | Only if adding collaboration | 10x memory reduction, but CRDT is overkill for write-once data |

**Recommendation**: Stick with ElectricSQL for Phase 4. Evaluate Turso/libSQL as a potential wa-sqlite replacement for Phase 1 (benchmark OPFS performance, bundle size, API ergonomics before committing).

### E. Authentication + Offline

| Tool | What | Effort | Value |
|---|---|---|---|
| **WebAuthn PRF extension** | Derive encryption key from passkey for local data encryption | Medium | Encrypt local SQLite at rest |
| **Auth machine offline sub-states** | Add `authenticated.passkey.online`/`.offline` to XState machine | Low | Honest UX about what's possible offline |
| **FIDO CXP/CXF** | Passkey portability between providers | Monitor | Future: cross-device passkey migration |

**WebAuthn PRF detail**: The PRF (Pseudo-Random Function) extension derives deterministic keys during passkey authentication. This enables encrypting the local SQLite database at rest — important for conservation data privacy on shared devices. Supported in Chrome, Edge, Firefox. NOT supported on Windows Hello. Green Goods' Android-primary user base is well-covered.

**Files to modify**:
- `packages/shared/src/modules/auth/session.ts` — add PRF key derivation
- `packages/shared/src/workflows/authMachine.ts` — add offline sub-states
- `packages/shared/src/modules/auth/passkey-server.ts` — request PRF extension during registration

### F. Workflow Persistence

| Tool | What | Effort | Value |
|---|---|---|---|
| **XState `getPersistedSnapshot()`** | Persist workflow state machines to IndexedDB/SQLite | Low | Resume create garden/assessment flows after app close |

Green Goods already uses XState for `authMachine`, `createGardenMachine`, and `createAssessmentMachine`. XState 5's `actor.getPersistedSnapshot()` serializes the full machine state. Combined with Phase 3 (form persistence), this preserves the *entire workflow* — not just form fields but which step the user was on, validation state, and async operation results.

**Files to modify**:
- `packages/shared/src/workflows/createGarden.ts` — add snapshot persistence
- `packages/shared/src/workflows/createAssessment.ts` — add snapshot persistence
- `packages/shared/src/modules/job-queue/draft-db.ts` — add `workflow_snapshot` column

### G. Notifications (Post-v1.0)

| Tool | What | Effort | Value |
|---|---|---|---|
| **Web Push API** | Push notifications for assessment approvals/rejections | Medium | Alert workers when work is reviewed |
| **iOS PWA Push** | Stable since iOS 16.4, requires home screen install | Low (config) | Works after PWA install (already encouraged) |
| **VAPID key generation** | Server-side push subscription management | Medium | Required for Web Push |

**Recommended triggers** (minimal, high-value):
- Work submission approved/rejected
- New action created in gardener's garden
- Assessment requires review (for evaluators)
- Garden invitation received

**Anti-pattern**: Do NOT use push for marketing, generic updates, or frequent polling. Chrome disables ignored notifications.

### H. Emerging Browser APIs

| API | Status | Relevance |
|---|---|---|
| **OPFS** | Universal (Chrome, Safari, Firefox) | **Core dependency** — validates Phase 1 VFS choice |
| **WebGPU** | Universal (~70% coverage, Jan 2026) | Enables on-device AI (Tier 2-3) |
| **WebNN** | Chrome 146 Origin Trial | Future: NPU-accelerated inference, better battery |
| **Compute Pressure** | W3C Candidate Recommendation (Aug 2025) | Throttle AI inference when device strained |
| **Storage Buckets** | Stalled (WICG draft, 2023) | Not progressing — use `navigator.storage.persist()` instead |
| **Background Fetch** | Chrome-only | Not needed — Background Sync API is sufficient |
| **File System Access** | Chrome/Edge only | Not needed — OPFS covers local file needs |
| **Periodic Background Sync** | Chrome-only | Nice-to-have for indexer refresh while backgrounded |

---

## Recommended Implementation Priority

### Immediate (can do before Phase 1)

1. **IPFS gateway caching** — Add CacheFirst rule for `w3s.link/ipfs/*` to `vite.config.ts:103`
   ```typescript
   {
     urlPattern: /https:\/\/(w3s\.link|dweb\.link|ipfs\.io)\/ipfs\/.*/,
     handler: "CacheFirst",
     options: {
       cacheName: "ipfs-media-cache",
       expiration: { maxEntries: 500, maxAgeSeconds: 90 * 24 * 60 * 60 },
       cacheableResponse: { statuses: [0, 200] },
     },
   }
   ```

2. **Image quality checks** — Laplacian blur detection + histogram analysis in `Media.tsx` upload flow. Pure Canvas API, zero dependencies.

3. **EXIF/GPS extraction** — `bun add exifr` (4KB). Extract coordinates, compare with garden location.

### Alongside Phase 1-3

4. **EAS offchain attestations** — `signOffchainAttestation()` + `multiTimestamp()`. Biggest UX win for offline work documentation. Uses existing `eas-sdk` dependency.

5. **Turso/libSQL evaluation** — Benchmark against wa-sqlite before committing to Phase 1 storage choice.

6. **XState workflow persistence** — Alongside Phase 3 form persistence, add `getPersistedSnapshot()` to XState workflows.

### Alongside Phase 4-6

7. **Whisper speech-to-text** — Opt-in, cache `whisper-tiny.en` (40MB) in OPFS. Transcribe audio notes.

8. **OffscreenCanvas thumbnails** — Web Worker thumbnail generation for photo galleries.

9. **PMTiles + MapLibre offline maps** — Download garden-area tiles at enrollment.

### Post-v1.0

10. **WebAuthn PRF encryption** — Encrypt local SQLite at rest with passkey-derived keys.
11. **CLIP image classification** — Auto-categorize work photos.
12. **PWA push notifications** — Assessment approval/rejection alerts.
13. **Ditto mesh networking** — P2P sync for workers without internet.
14. **Local LLM** — Auto-generate work descriptions from photos + audio.

---

## Sources

### Media & IPFS
- [OPFS (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- [Kiwix OPFS Case Study](https://web.dev/case-studies/kiwix)
- [Helia (Protocol Labs)](https://github.com/ipfs/helia)
- [blockstore-opfs](https://socket.dev/npm/package/blockstore-opfs)
- [@helia/car](https://www.npmjs.com/package/@helia/car)
- [@helia/verified-fetch](https://blog.ipfs.tech/verified-fetch/)
- [OffscreenCanvas (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [Photon WASM](https://silvia-odwyer.github.io/photon/)

### AI/ML
- [WebGPU Universal Coverage (Jan 2026)](https://www.webgpu.com/news/webgpu-hits-critical-mass-all-major-browsers/)
- [Transformers.js v4](https://huggingface.co/blog/transformersjs-v4)
- [WebLLM](https://webllm.mlc.ai/docs/)
- [MediaPipe Vision](https://ai.google.dev/edge/mediapipe/solutions/guide)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- [Whisper WebGPU Demo](https://huggingface.co/spaces/Xenova/realtime-whisper-webgpu)
- [Canvas Blur Detection (Revolut)](https://medium.com/revolut/canvas-based-javascript-blur-detection-b92ab1075acf)
- [exifr](https://github.com/MikeKovarik/exifr)
- [Small Language Models 2026](https://localaimaster.com/blog/small-language-models-guide-2026)
- [Gemma 3 270M Fine-Tuning](https://developers.googleblog.com/own-your-ai-fine-tune-gemma-3-270m-for-on-device/)

### Geospatial
- [PMTiles + MapLibre](https://docs.protomaps.com/pmtiles/maplibre)
- [Offline Maps with Protomaps](https://blog.wxm.be/2024/01/14/offline-map-with-protomaps-maplibre.html)
- [Turf.js](http://turfjs.org/)
- [MapLibre GL JS v5.8.0](https://maplibre.org/news/2025-10-04-maplibre-newsletter-september-2025/)

### Alternative Tools
- [ElectricSQL 1.0 GA](https://electric-sql.com/blog/2025/03/17/electricsql-1.0-released)
- [ElectricSQL 1.1 (102x faster)](https://electric-sql.com/blog/2025/08/13/electricsql-v1.1-released)
- [Turso in the Browser](https://turso.tech/blog/introducing-turso-in-the-browser)
- [Ditto $82M Series B](https://techcrunch.com/2025/03/12/ditto-lands-82m-to-synchronize-data-from-the-edge-to-the-cloud/)
- [Convex Self-Hosting](https://news.convex.dev/self-hosting/)
- [Liveblocks Open Source](https://liveblocks.io/blog/open-sourcing-the-liveblocks-sync-engine-and-dev-server)
- [Automerge 3.0](https://automerge.org/blog/automerge-3/)
- [RxDB](https://rxdb.info/)

### Auth & Security
- [Passkeys PRF Extension](https://www.corbado.com/blog/passkeys-prf-webauthn)
- [Keyhive (Ink & Switch)](https://www.inkandswitch.com/keyhive/notebook/01/)
- [Authentication Trends 2026](https://www.c-sharpcorner.com/article/authentication-trends-in-2026-passkeys-oauth3-and-webauthn/)
- [EAS Offchain Attestations](https://docs.attest.org/)

### Browser APIs
- [WebNN (Chrome 146)](https://www.neowin.net/news/google-promotes-chrome-146-to-the-beta-channel-with-webnn-support-sanitizer-api-and-more/)
- [Compute Pressure API](https://developer.chrome.com/docs/web-platform/compute-pressure)
- [XState Persistence](https://stately.ai/docs/persistence)
- [PWA Push on iOS](https://iphtechnologies9.wordpress.com/2025/07/01/solving-ios-pwa-limitations-push-notifications-offline-access/)
