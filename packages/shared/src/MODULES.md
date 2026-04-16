# @green-goods/shared -- Module Map

> Canonical architecture contract for the shared package.
> Last updated: 2026-04-11

## Package Contract

`packages/shared` is the single home for cross-app hooks, providers, stores, modules, types,
i18n catalogs, and Storybook-backed UI primitives.

### Import Policy

1. Prefer the root barrel: `@green-goods/shared`
2. Supported domain subpaths stay available for clear operational boundaries:
   `components`, `config`, `hooks`, `i18n`, `mocks`, `modules`, `providers`, `stores`,
   `styles`, `testing`, `types`, `utils`, `workflows`
3. Leaf entrypoints `cards`, `display`, `badge`, and `toast` are legacy compatibility paths.
   Do not add new usage there.
4. `lib/hypercerts` stays a pure-domain library. It is intentionally separate from `modules/`.
5. Prefer selector-first auth/work consumption in new code:
   `useAuthState` + `useAuthActions`, `useWorkSelection` + `useWorkFormContext`

## Public Entrypoints

| Entrypoint | Status | Notes |
| --- | --- | --- |
| `@green-goods/shared` | Preferred | Main consumer API for app code |
| `@green-goods/shared/components` | Supported | Shared UI primitives and stories |
| `@green-goods/shared/config` | Supported | App and chain configuration |
| `@green-goods/shared/hooks` | Supported | React hooks grouped by domain |
| `@green-goods/shared/i18n` | Supported | Catalog helpers and language JSON |
| `@green-goods/shared/modules` | Supported | Cross-app business logic and adapters |
| `@green-goods/shared/providers` | Supported | Context providers and selector hooks |
| `@green-goods/shared/stores` | Supported | Zustand stores |
| `@green-goods/shared/types` | Supported | Domain and generated types |
| `@green-goods/shared/utils` | Supported | Pure utilities and helpers |
| `@green-goods/shared/workflows` | Supported | XState machines and auth actor exports |
| `@green-goods/shared/styles` | Supported | Theme CSS import path |
| `@green-goods/shared/styles/theme.css` | Supported | Direct theme stylesheet |
| `@green-goods/shared/styles/utilities.css` | Supported | Direct utilities stylesheet |
| `@green-goods/shared/testing` | Supported | Shared test utilities |
| `@green-goods/shared/mocks` | Supported | MSW/browser/server mocks |
| `@green-goods/shared/mocks/browser` | Supported | Browser mock entrypoint |
| `@green-goods/shared/mocks/server` | Supported | Server mock entrypoint |
| `@green-goods/shared/__tests__/setupTests.base` | Operational | Test bootstrap helper |
| `@green-goods/shared/cards` | Legacy | Compatibility entrypoint; no new usage |
| `@green-goods/shared/display` | Legacy | Compatibility entrypoint; no new usage |
| `@green-goods/shared/badge` | Legacy | Compatibility entrypoint; no new usage |
| `@green-goods/shared/toast` | Legacy | Compatibility entrypoint; no new usage |

## Internal Module Groups

### modules/ -- Core business logic (minimal React dependency)

| Module | Purpose | Key exports |
| --- | --- | --- |
| `app/` | Observability and runtime adapters -- analytics events, error tracking, logging, service worker management | `logger`, `track`, `trackError`, `serviceWorkerManager`, `ANALYTICS_EVENTS` |
| `auth/` | Session persistence only -- auth mode, passkey credential, username, RP ID storage | `getAuthMode`, `setAuthMode`, `clearAllAuth`, `getStoredUsername` |
| `data/` | Data-fetching adapters -- GraphQL clients, EAS/indexer/gardens reads, IPFS upload/resolve, marketplace and vault reads | `getGardens`, `getWorks`, `uploadFileToIPFS`, `resolveIPFSUrl`, `greenGoodsIndexer` |
| `job-queue/` | Offline job queue -- IndexedDB queue, draft persistence, media resource manager, event bus | `jobQueue`, `jobQueueDB`, `jobQueueEventBus`, `mediaResourceManager` |
| `marketplace/` | HypercertExchange SDK integration -- maker ask signing, approvals, validation | `getMarketplaceClient`, `buildMakerAsk`, `signMakerAsk`, `checkMarketplaceApprovals` |
| `transactions/` | Abstract transaction sending -- passkey, wallet, and embedded sender strategies | `createTransactionSender`, `PasskeySender`, `WalletSender`, `EmbeddedSender` |
| `translation/` | Browser translation engine -- LibreTranslate client, IndexedDB cache, diagnostics | `browserTranslator`, `translationCache`, `runTranslationDiagnostics` |
| `work/` | Work submission pipelines -- bot, passkey, wallet, validation helpers | `submitWorkBot`, `submitWorkWithPasskey`, `submitWorkDirectly`, `validateWorkDraft` |

### hooks/ -- React hooks (21 domain folders)

Counts below reflect current source files per folder, excluding folder `index.ts`.

| Folder | Count | Purpose |
| --- | ---: | --- |
| `action/` | 3 | Action CRUD, filtering, form schema |
| `analytics/` | 2 | PostHog identity and page view tracking |
| `app/` | 13 | Browser nav, carousel, install guidance, theme, offline, toasts, service worker |
| `assessment/` | 6 | Assessment drafts, forms, workflow orchestration |
| `auth/` | 3 | Auth context, primary address, user profile |
| `blockchain/` | 11 | Chain config, base lists, ENS, deployment registry, tx sender |
| `conviction/` | 14 | Conviction strategies, pools, signals, member power |
| `cookie-jar/` | 5 | Cookie jar reads and admin/user mutations |
| `ens/` | 5 | ENS claim, registration status, slug form |
| `garden/` | 18 | Garden CRUD, permissions, tabs, domains, invites, joining |
| `gardener/` | 2 | Gardener profile and role resolution |
| `hypercerts/` | 15 | Minting, listings, attestations, allowlists, contracts |
| `navigation/` | 3 | URL sync and canvas search params |
| `ops/` | 3 | Ops runner hooks |
| `roles/` | 4 | Role checks and toolbar permissions |
| `translation/` | 3 | Garden/action/general translation hooks |
| `ui/` | 1 | Shared UI state helpers (`useIsDarkMode`) |
| `utils/` | 11 | Async effects, clipboard, audio, debounce, timers, focus trap |
| `vault/` | 17 | Vault deposits, events, funder and strategy views |
| `work/` | 21 | Drafts, mutation, approvals, metadata, queue sync, images |
| `yield/` | 5 | Yield allocation and summary hooks |

Shared hook infrastructure also includes `query-keys.ts`.

### providers/ -- React context wiring

Current provider folder contents: 5 runtime providers plus 2 support files.

| File | Role |
| --- | --- |
| `App.tsx` | App-wide platform, locale, install, and garden metadata context |
| `AppKitProvider.tsx` | Reown AppKit + Wagmi composition |
| `Auth.tsx` | XState auth actor provider plus selector hooks |
| `AuthGate.tsx` | Admin-only auth gate that can switch to dev auth |
| `DevAuthProvider.tsx` | Dev-only mock auth path for admin testing |
| `JobQueue.tsx` | Queue stats and flush lifecycle provider |
| `Work.tsx` | Split work contexts: selection vs form state |

### workflows/ -- XState state machines

The workflow folder currently contains 4 machines plus auth actor/services support files.

| File | Purpose |
| --- | --- |
| `authActor.ts` | Singleton auth actor and selectors |
| `authMachine.ts` | Auth lifecycle machine |
| `authServices.ts` | Auth machine services |
| `createGarden.ts` | Garden creation workflow |
| `createAssessment.ts` | Assessment creation workflow |
| `mintHypercert.ts` | Hypercert mint workflow |

### stores/ -- Zustand stores

Current store folder contents: 7 stores plus shared workflow type definitions.

| File | Purpose |
| --- | --- |
| `useAdminStore.ts` | Admin deployment and transaction state |
| `useCreateAssessmentStore.ts` | Assessment wizard persistence |
| `useCreateGardenStore.ts` | Garden wizard persistence |
| `useGardenStateStore.ts` | Per-garden tab/filter UI state |
| `useHypercertWizardStore.ts` | Hypercert wizard state |
| `useSheetOrchestratorStore.ts` | Sheet orchestration state |
| `useUIStore.ts` | Global UI toggles |
| `useWorkFlowStore.ts` | Work flow state |
| `workFlowTypes.ts` | Shared work flow enums and types |

### config/ -- Configuration and constants

| File | Purpose |
| --- | --- |
| `app.ts` | App metadata |
| `appkit.ts` | Reown AppKit + Wagmi config |
| `blockchain.ts` | Network and EAS config |
| `chains.ts` | Supported chain definitions and guards |
| `gardens-subgraph.ts` | Gardens V2 subgraph URL resolver |
| `passkeyServer.ts` | Passkey RP ID and availability helpers |
| `pimlico.ts` | Pimlico client factories |
| `query-persistence.ts` | Query persistence helpers |
| `react-query.ts` | TanStack Query client and presets |
| `sdg.ts` | Sustainable Development Goal metadata |

### utils/ -- Pure helpers and adapters

| Group | Purpose |
| --- | --- |
| `action/` | Action parsing and instruction templates |
| `app/` | Browser detection, clipboard, haptics, PWA helpers, formatting |
| `blockchain/` | Address helpers, ABIs, registry lookups, ENS, roles, vault math |
| `compression.ts` | Compression Streams helpers |
| `debug.ts` | Debug-mode logging |
| `dispatch-adapter.ts` | Workflow dispatch adapter (candidate for workflow-local regrouping) |
| `domain.ts` | Domain bitmask helpers |
| `eas/` | EAS encoders, explorer URLs, transaction builders |
| `errors/` | Error parsing, classification, formatting |
| `form/` | Form normalizers |
| `garden-detail.ts` | Garden detail tab parsing and badge aggregation |
| `query-invalidation.ts` | Query invalidation scheduling (candidate to live closer to query keys/config) |
| `scheduler.ts` | Cooperative task scheduling |
| `storage/` | Draft persistence and storage quota helpers |
| `styles/` | `cn()`, polymorphic helpers, theme management |
| `time.ts` | Temporal-aware date helpers |
| `work/` | Offline work conversion, compression, sharing |
| `admin-routes.ts` | Admin navigation helpers (candidate for app/navigation grouping) |

### types/ -- TypeScript definitions

| Group | Purpose |
| --- | --- |
| `domain.ts` | Core domain entities and compatibility aliases |
| `auth.ts` | Auth mode and base auth types |
| `blockchain.ts` | Chain and deployment types |
| `contracts.ts` | Network contracts and deployment params |
| `conviction.ts` | Conviction voting and allocation types |
| `cookie-jar.ts` | Cookie jar entities and params |
| `garden-detail.ts` | Garden detail UI state types |
| `gardens-community.ts` | Gardens community and yield allocation types |
| `hypercerts.ts` | Hypercert metadata, listings, allowlists, records |
| `eas-responses.ts` | Parsed EAS response shapes |
| `indexer-responses.ts` | Indexer response shapes |
| `job-queue.ts` | Queue, draft, and file-serialization types |
| `offline.ts` | Offline state and conflict types |
| `ops.ts` | Ops runner types |
| `vaults.ts` | Vault entities and transaction types |
| `*.d.ts` | Generated GraphQL schemas and ambient declarations |

### Other groups

| Group | Purpose |
| --- | --- |
| `components/` | Shared UI primitives consumed by client and admin |
| `i18n/` | Translation catalogs (`en`, `es`, `pt`) |
| `lib/hypercerts/` | Pure hypercert domain logic and schema helpers |
| `styles/` | Shared CSS tokens and utility layers |

## Dependency Flow

```text
config/ + types/
        -> utils/
        -> modules/
        -> stores/
        -> workflows/
        -> hooks/
        -> providers/
        -> components/

i18n/ is standalone catalog data
lib/hypercerts/ is pure-domain logic used by hooks/components/workflows
```

## Key Boundaries

1. `modules/` stays mostly non-React business logic. React lifecycle belongs in `hooks/` or
   `providers/`.
2. `hooks/` compose `modules/`, `stores/`, `workflows/`, and `utils/`; modules do not import
   hooks.
3. `providers/` wire lifecycle and context. New business rules should not start there.
4. `workflows/` are XState machines and auth actor support files. Preserve their boundaries; do
   not move generic domain logic into machines.
5. `stores/` are Zustand slices with minimal dependencies.
6. Root barrel is the preferred public API, but it is not the only supported API. Domain subpaths
   are part of the compatibility contract today.
7. Selector-first hooks are the preferred consumption pattern for auth/work state.
