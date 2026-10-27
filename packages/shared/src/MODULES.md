# @green-goods/shared -- Module Map

> Navigation map for the shared package. [AGENTS.md](../AGENTS.md),
> [declared exports](../package.json), and the
> [source-structure checker](../../../scripts/quality/check-source-structure.js) own import rules.

## Package Contract

`packages/shared` is the single home for cross-app hooks, providers, stores, modules, types,
i18n catalogs, and Storybook-backed UI primitives.

### Import Policy

1. Consume Shared through declared `package.json#exports`; never import `shared/src/**` from
   another package.
2. Client and admin use declared leaf entrypoints. The source-structure checker rejects the root
   barrel and broad family barrels in their source, tests, and stories. Shared production code
   also avoids its own high-fanout barrels.
3. Choose the narrowest declared entrypoint that supplies the needed capability. A broad export
   being present in the manifest does not make it an allowed import for every consumer.
4. `lib/hypercerts` stays a pure-domain library. It is intentionally separate from `modules/`.
5. Prefer selector-first auth/work consumption in new code:
   `useAuthState` + `useAuthActions`, `useWorkSelection` + `useWorkFormContext`.

## Public Entrypoints

The [export manifest](../package.json) is the complete inventory. These examples explain the
main boundaries without duplicating every leaf:

| Entrypoint | Role |
|---|---|
| `@green-goods/shared/hooks/auth/useAuth` | Auth state and action selectors |
| `@green-goods/shared/providers/Work` | Work selection and form contexts |
| `@green-goods/shared/config/query-keys/registry` | Centralized query keys |
| `@green-goods/shared/components/StatusBadge` | A declared UI component leaf |
| `@green-goods/shared/commitment-pooling` | Pooling facade over its modules and hooks |
| `@green-goods/shared/commitment-pooling/public` | Public-route pooling reads and presentation |
| `@green-goods/shared/profile-avatar/protocol` | Avatar request/response contract without React hooks |
| `@green-goods/shared/styles/theme.css` | Shared theme stylesheet |
| `@green-goods/shared/styles/utilities.css` | Shared utilities stylesheet |

The root and broad family barrels remain declared exports with consumer restrictions. Existing
`cards`, `display`, `badge`, and `toast` compatibility entrypoints are not preferred for new usage.

## Internal Module Groups

### modules/ -- Core business logic (minimal React dependency)

| Module | Purpose | Key exports |
| --- | --- | --- |
| `app/` | Observability and runtime adapters -- analytics events, error tracking, logging, service worker management | `logger`, `track`, `trackError`, `serviceWorkerManager`, `ANALYTICS_EVENTS` |
| `auth/` | Session persistence only -- auth mode, passkey credential, username, RP ID storage | `getAuthMode`, `setAuthMode`, `clearAllAuth`, `getStoredUsername` |
| `commitment-pooling/` | Pool, series, credit, settlement, and job-domain data/types | Domain selectors, mappers, metadata, and job executors |
| `data/` | Data-fetching adapters -- GraphQL clients, EAS/indexer/gardens reads, IPFS upload/resolve, marketplace and vault reads | `getGardens`, `getWorks`, `uploadFileToIPFS`, `resolveIPFSUrl`, `greenGoodsIndexer` |
| `job-queue/` | Offline job queue -- IndexedDB queue, draft persistence, media resource manager, event bus | `jobQueue`, `jobQueueDB`, `jobQueueEventBus`, `mediaResourceManager` |
| `marketplace/` | HypercertExchange SDK integration -- maker ask signing, approvals, validation | `getMarketplaceClient`, `buildMakerAsk`, `signMakerAsk`, `checkMarketplaceApprovals` |
| `offline-content/` | Background offline preparation that yields to the screen, photo cache helpers and download progress | `OfflineScheduler`, `OfflineRunQueue`, plan, media and progress helpers |
| `profile-avatar/` | Avatar drafts, normalization, signing, publishing, and resolution | Profile avatar transport and persistence helpers |
| `transactions/` | Abstract transaction sending -- passkey, wallet, and embedded sender strategies | `createTransactionSender`, `PasskeySender`, `WalletSender`, `EmbeddedSender` |
| `translation/` | Browser translation engine -- LibreTranslate client, IndexedDB cache, diagnostics | `browserTranslator`, `translationCache`, `runTranslationDiagnostics` |
| `work/` | Work submission pipelines -- bot, passkey, wallet, validation helpers | `submitWorkBot`, `submitWorkWithPasskey`, `submitWorkDirectly`, `validateWorkSubmissionContext` |
| `vault-crowdfunding.ts` | Vault crowdfunding calculations and domain helpers | Vault crowdfunding utilities |

### hooks/ -- React hooks

The folder inventory is checked against the source tree; avoid hand-maintained file counts here.

| Folder | Purpose |
| --- | --- |
| `action/` | Action CRUD, filtering, and form schema |
| `admin-ui/` | Admin shell and workspace state helpers |
| `agent-reporting/` | Chat reporting ceremonies: account proof, pairing, exact publication and recovery |
| `analytics/` | PostHog identity and page-view tracking |
| `app/` | Browser navigation, install guidance, theme, offline, toasts, and service worker |
| `assessment/` | Assessment drafts, forms, and workflow orchestration |
| `auth/` | Auth context, primary address, and user profile |
| `blockchain/` | Chain config, base lists, ENS, deployment registry, and transaction sender |
| `client-ui/` | Client view controllers that compose shared readers, selectors, and mutations |
| `commitment-pooling/` | Pooling, credit, settlement, and contributor hooks |
| `conviction/` | Conviction strategies, pools, signals, and member power |
| `cookie-jar/` | Cookie jar reads and admin/user mutations |
| `ens/` | ENS claim, registration status, and slug form |
| `garden/` | Garden CRUD, permissions, tabs, domains, invites, and joining |
| `gardener/` | Gardener profile and role resolution |
| `greenwill/` | GreenWill reads and mutations |
| `hypercerts/` | Minting, listings, attestations, allowlists, and contracts |
| `navigation/` | URL synchronization and canvas search params |
| `offline/` | Content preparation lifecycle, coverage and local media availability |
| `profile/` | Profile data and editing workflows |
| `public/` | Public-route reads and presentation state |
| `roles/` | Role checks and toolbar permissions |
| `translation/` | Garden, action, and general translation hooks |
| `ui/` | Shared UI state helpers |
| `utils/` | Async effects, clipboard, audio, debounce, timers, and focus trap |
| `vault/` | Vault deposits, events, funder, and strategy views |
| `work/` | Drafts, mutation, approvals, metadata, queue sync, and images |
| `yield/` | Yield allocation and summary hooks |

Shared hook infrastructure also includes `query-keys.ts`.

### providers/ -- React context wiring

Current provider inventory is seven runtime files plus the barrel export.

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

The workflow folder contains four machines, auth actor/services support, and the barrel export.

| File | Purpose |
| --- | --- |
| `authActor.ts` | Singleton auth actor and selectors |
| `authMachine.ts` | Auth lifecycle machine |
| `authServices.ts` | Auth machine services |
| `createGarden.ts` | Garden creation workflow |
| `createAssessment.ts` | Assessment creation workflow |
| `mintHypercert.ts` | Hypercert mint workflow |

### stores/ -- Zustand stores

The store folder contains eight Zustand store files, shared workflow type definitions, and the barrel
export.

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
| `query-keys/` | Centralized query keys, invalidation helpers, and schedules |
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
| `commitment-pooling/` | Public entry files; implementation stays in `modules/commitment-pooling/` and `hooks/commitment-pooling/` |
| `profile-avatar/` | Public entry files; implementation stays in `modules/profile-avatar/`, `hooks/profile/`, and `public-contracts/` |
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
6. Declared public exports and the source-structure checker jointly define allowed imports.
   Keep public entry files separate from the module and hook implementations they expose.
7. Selector-first hooks are the preferred consumption pattern for auth/work state.
