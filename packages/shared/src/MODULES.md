# @green-goods/shared -- Module Map

> C4 Level 3 component view of the shared package internals.
> Last updated: 2026-04-02

## Module Groups

### modules/ -- Core business logic (minimal React dependency)

| Module | Purpose | Key exports |
|--------|---------|-------------|
| `app/` | Observability layer -- analytics events, error tracking, logging, service worker management | `logger`, `track`, `trackError`, `serviceWorkerManager`, `ANALYTICS_EVENTS` |
| `auth/` | Session persistence -- auth mode and passkey RP ID storage (no auth flow logic; that lives in workflows/) | `getAuthMode`, `setAuthMode`, `clearAllAuth`, `getStoredUsername` |
| `data/` | Data-fetching adapters -- GraphQL clients for EAS, indexer, Gardens V2 subgraph; IPFS upload/resolve; marketplace reads; vault reads | `getGardens`, `getWorks`, `uploadFileToIPFS`, `resolveIPFSUrl`, `greenGoodsIndexer` |
| `job-queue/` | Offline job queue -- IndexedDB-backed queue with executors, draft persistence, media resource manager, event bus | `jobQueue`, `jobQueueDB`, `jobQueueEventBus`, `mediaResourceManager` |
| `marketplace/` | HypercertExchange SDK integration -- maker ask signing, approval building, order validation | `getMarketplaceClient`, `buildMakerAsk`, `signMakerAsk`, `checkMarketplaceApprovals` |
| `transactions/` | Abstract transaction sender -- factory + strategy pattern for passkey, wallet, and embedded account senders | `createTransactionSender`, `PasskeySender`, `WalletSender`, `EmbeddedSender` |
| `translation/` | Browser-side translation engine -- LibreTranslate client, IndexedDB cache, diagnostics | `browserTranslator`, `translationCache`, `runTranslationDiagnostics` |
| `work/` | Work submission pipelines -- bot, passkey, and wallet submission strategies; draft validation | `submitWorkBot`, `submitWorkWithPasskey`, `submitWorkDirectly`, `validateWorkDraft` |

### hooks/ -- React hooks (compose modules for UI)

| Category | Count | Purpose |
|----------|-------|---------|
| `action/` | 3 | Action CRUD, filtering, form schema |
| `analytics/` | 2 | PostHog identity + page view tracking |
| `app/` | 12 | Browser nav, carousel, debug mode, install guidance, offline status, PWA, theming, toasts |
| `assessment/` | 5 | Assessment drafts, forms, workflow orchestration |
| `auth/` | 3 | Auth context, primary address, user profile |
| `blockchain/` | 8 | Chain config, base list queries (gardens/actions/gardeners), ENS, deployment registry, tx sender |
| `conviction/` | 10 | Conviction voting strategies, pools, signals, member power |
| `cookie-jar/` | 5 | Cookie jar reads, deposits, withdrawals, admin ops |
| `ens/` | 5 | ENS subdomain claim, registration status, slug form |
| `garden/` | 15 | Garden CRUD, join flow, permissions, invites, domains, filtering, tabs |
| `gardener/` | 2 | Gardener profile, role resolution |
| `hypercerts/` | 12 | Hypercert minting, listings, attestations, allowlists, marketplace approvals |
| `navigation/` | 1 | Garden URL sync |
| `ops/` | 1 | Ops runner hooks (deploy, upgrade, scripts, job logs) |
| `roles/` | 4 | Garden roles, has-role check, toolbar permissions |
| `translation/` | 3 | Action/garden/generic translation hooks |
| `utils/` | 8 | Address input, async effects, audio recording, clipboard, debounce, event listeners, mutation lock, timers |
| `vault/` | 9 | Vault deposits, events, operations (deposit/withdraw/harvest), funder leaderboard, strategy rates |
| `work/` | 12 | Work submission, drafts, approvals, queue stats, batch sync, images |
| `yield/` | 3 | Yield allocation, protocol summary |
| `query-keys.ts` | -- | Centralized TanStack Query key factories |

### providers/ -- React context providers

| Provider | Wraps | Purpose |
|----------|-------|---------|
| `AppProvider` | App-wide context | Platform detection, locale, install state, garden data |
| `AppKitProvider` | Reown AppKit + Wagmi | Wallet connection and chain management |
| `AuthProvider` | XState auth actor | Unified passkey/wallet auth flow with session restore |
| `JobQueueProvider` | Job queue event bus | Queue stats, flush triggers, offline sync feedback |
| `WorkProvider` | Work form + selection | Work submission form state and action selection at route level |

### workflows/ -- XState state machines

| Machine | Purpose |
|---------|---------|
| `authMachine` / `authActor` | Auth lifecycle: idle -> connecting -> authenticated (passkey or wallet) with session restore |
| `createGardenMachine` | Multi-step garden creation: metadata -> actions -> members -> deploy |
| `createAssessmentMachine` | Assessment creation flow with draft persistence |
| `mintHypercertMachine` | Hypercert minting: metadata -> allowlist -> sign -> mint -> register |

### stores/ -- Zustand stores

| Store | Purpose |
|-------|---------|
| `useAdminStore` | Admin deployment state: selected garden, transaction tracking |
| `useCreateAssessmentStore` | Multi-step assessment form persistence |
| `useCreateGardenStore` | Multi-step garden form persistence |
| `useGardenStateStore` | Per-garden UI state (selected tab, filters) with localStorage |
| `useHypercertWizardStore` | Hypercert minting wizard: attestation selection, distribution mode, minting status |
| `useUIStore` | Global UI toggles: debug mode, toast visibility |
| `useWorkFlowStore` | Work submission flow: draft state, selected action, active tab |

### config/ -- Configuration and constants

| Module | Purpose |
|--------|---------|
| `app.ts` | App metadata: name, URL, title template |
| `appkit.ts` | Reown AppKit + Wagmi config factory |
| `blockchain.ts` | Network/EAS config lookup by chain ID |
| `chains.ts` | Supported chain definitions and guards |
| `gardens-subgraph.ts` | Gardens V2 subgraph URL resolver |
| `passkeyServer.ts` | Passkey RP ID, availability check, creation helper |
| `pimlico.ts` | Pimlico bundler/paymaster client factories |
| `react-query.ts` | TanStack Query client + stale/GC time presets |
| `sdg.ts` | UN Sustainable Development Goals target definitions |

### utils/ -- Pure utility functions

| Category | Purpose |
|----------|---------|
| `action/` | Action ID parsing, instruction templates |
| `app/` | Browser detection, clipboard, haptics, PWA helpers, text formatting, wake lock, file normalization, garden membership sets |
| `blockchain/` | Address normalization, ABIs, chain registry, contract clients, ENS resolution, garden roles, polling, simulation, vault math |
| `compression.ts` | Native Compression Streams API wrappers |
| `debug.ts` | Debug-mode conditional logging |
| `dispatch-adapter.ts` | Adapter for dispatching XState events |
| `domain.ts` | Domain bitmask expansion/checks |
| `eas/` | EAS attestation encoders, explorer URL builders, transaction builders |
| `errors/` | Contract error parsing, mutation error handlers, tx error classification, user-friendly messages |
| `form/` | Form field normalizers (time, plants, feedback) |
| `garden-detail.ts` | Garden detail tab parsing, badge aggregation, severity ranking |
| `query-invalidation.ts` | Progressive query invalidation scheduler |
| `scheduler.ts` | Cooperative multitasking via Scheduler API |
| `storage/` | Form draft persistence, storage quota tracking |
| `styles/` | `cn()` classname utility, polymorphic component types, theme management |
| `time.ts` | Temporal API wrappers with Date fallback |
| `work/` | Work deduplication, image compression, offline work conversion, share/download |

### types/ -- TypeScript type definitions

| Module | Purpose |
|--------|---------|
| `domain.ts` | Core domain entities: Garden, Action, Work, WorkApproval, GardenerCard, WorkSubmission |
| `auth.ts` | AuthMode, BaseAuthContext |
| `blockchain.ts` | ChainId, DeploymentConfig |
| `contracts.ts` | NetworkContracts, DeploymentParams, CreateGardenParams |
| `conviction.ts` | Conviction voting params and signal types |
| `cookie-jar.ts` | CookieJar entity and operation params |
| `garden-detail.ts` | Garden detail UI types: tabs, ranges, activity events, badges |
| `gardens-community.ts` | Gardens V2 community/pool types, yield allocation, split config |
| `hypercerts.ts` | HypercertRecord, HypercertMetadata, marketplace types |
| `eas-responses.ts` | Parsed EAS attestation response shapes |
| `indexer-responses.ts` | Green Goods indexer response shapes |
| `job-queue.ts` | Job, WorkDraftRecord, queue event types |
| `offline.ts` | OfflineStatus, SyncMetrics, WorkConflict |
| `ops.ts` | Ops runner job/session/script types |
| `vaults.ts` | GardenVault, VaultDeposit, VaultEvent |
| `*.d.ts` | Generated GraphQL schemas (eas.d.ts, green-goods.d.ts), global JSX declarations, Temporal API |

### Other groups

| Group | Purpose |
|-------|---------|
| `i18n/` | Translation message catalogs (en, es, pt) |
| `lib/hypercerts/` | Hypercert metadata formatting, contributor weight calculation, distribution math |
| `styles/theme.css` | CSS custom properties for theming |

### components/ -- Shared UI primitives

Reusable primitives consumed by both client and admin: Alert, Badge, Button, Cards (Garden/Work/Vault), Canvas (BottomSheet, SideSheet, FloatingToolbar, TopContextBar), DatePicker, Dialog, Display (image fallbacks), ErrorBoundary, Form (inputs, selects, confidence/method selectors), ListPrimitives, Progress (submission, ENS, sync), Spinner, StatusBadge, SyncStatusBar, Toast (service + presets + viewport), TranslationBadge, Audio (player/recorder), Vault (AssetSelector).

## Dependency Flow

```
config/  ──────────────────────────────────────────────────┐
types/   ──────────────────────────────────────────────────┤
                                                           │
utils/       <── config, types                             │
modules/     <── config, types, utils                      │
                                                           ▼
workflows/   <── modules (logger, session, analytics)  index.ts
stores/      <── config, types, modules (logger)       (barrel
                                                        export
hooks/       <── modules, workflows, stores,            to
                 config, types, utils                   consumers)

providers/   <── hooks, modules, stores, workflows,
                 config, types

components/  <── hooks, stores, modules (logger),
                 config, types, utils

i18n/        <── (standalone JSON catalogs)
lib/         <── types
```

## Key Boundaries

1. **modules/ is mostly non-React** -- pure TypeScript business logic. One exception: `job-queue/event-bus.ts` exposes a `useJobQueueEvents` React hook for convenience.
2. **hooks/ imports from modules/ but never the reverse** -- hooks compose module functions into React lifecycle; modules never depend on hooks.
3. **providers/ compose hooks and modules** -- they do not contain business logic, only context wiring and lifecycle orchestration.
4. **workflows/ are XState machines** -- testable without React. They import from modules/ (logger, session, analytics) but not from hooks/.
5. **stores/ are Zustand slices** -- minimal dependencies (config, types, logger). They never import hooks or providers.
6. **The barrel export (`index.ts`) is the ONLY public API** for external consumers. Internal code uses relative imports.
7. **config/ and types/ are leaf dependencies** -- imported by everything, import nothing internal (only external packages).
