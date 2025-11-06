% Green Goods Public API & Component Reference

# Green Goods Public API & Component Reference

This guide catalogues the public surfaces exposed by the Green Goods monorepo. It covers REST endpoints, reusable TypeScript utilities, React hooks/providers/components, smart contract entry points, and the indexer event handlers. Wherever practical, it also includes usage notes and representative snippets.

## Monorepo Scope

- `packages/api` — Fastify REST API served to the client and tooling.
- `packages/client` — React PWA with offline-first job queue, storage tooling, and shared UI primitives.
- `packages/contracts` — Core on-chain contracts plus supporting libraries.
- `packages/indexer` — Envio mappings that hydrate the UI/search layer.

---

## Backend API (`packages/api`)

Base URL defaults to `http://localhost:3000` in development. In production the API is typically reverse-proxied under `/api` (see the root endpoint discovery payload).

| Method | Path | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/` | Discovery endpoint listing supported routes and version. | None |
| `GET` | `/health` | Health check including timestamp, environment, and service metadata. | None |
| `GET` | `/users` | Fetch Privy users; falls back to mock users when Privy credentials are absent. | Privy app credentials (optional for mock data) |
| `POST` | `/subscribe` | Subscribe an email address to the Mailchimp list. | None |
| `PATCH` | `/users/me` | Update a user's custom metadata fields via Privy. | Required: `Authorization: Bearer <token>` |

### `GET /`

Returns API metadata and canonical paths (note that the discovery payload uses `/api/*` paths for deploy parity).

```bash
curl http://localhost:3000/
```

Sample response:

```json
{
  "name": "Green Goods API",
  "version": "0.0.0",
  "endpoints": {
    "health": "/api/health",
    "users": "/api/users",
    "subscribe": "/api/subscribe",
    "updateUser": "/api/users/me"
  }
}
```

### `GET /health`

No parameters. Useful for uptime probes.

```bash
curl http://localhost:3000/health
```

Response envelope:

```json
{
  "status": "ok",
  "timestamp": "2025-11-06T12:00:00.000Z",
  "env": "development",
  "port": 3000,
  "version": "0.0.0"
}
```

### `GET /users`

Lists Privy users. When `PRIVY_APP_ID`/`PRIVY_APP_SECRET_ID` are missing, the handler returns deterministic mock users so that the client can function offline.

```bash
curl http://localhost:3000/users
```

Response (mock-mode example):

```json
[
  {
    "id": "mock-user-1",
    "createdAt": "2025-11-06T11:58:31.221Z",
    "smartWallet": { "address": "0x1234…7890" },
    "email": { "address": "gardener1@example.com" },
    "phone": { "number": "+1234567890" },
    "customMetadata": { "username": "gardener1", "avatar": "https://avatar.placeholder.com/150" },
    "farcaster": { "pfp": "https://avatar.placeholder.com/150" }
  }
]
```

Errors resolve to `{ "error": string, "message"?: string }` with HTTP `500`.

### `POST /subscribe`

Subscribes an email address to Mailchimp. The handler performs regex validation and forwards the request to Mailchimp’s hosted endpoint.

```bash
curl -X POST http://localhost:3000/subscribe \
  -H 'Content-Type: application/json' \
  -d '{ "email": "gardener@example.com" }'
```

Successful response:

```json
{ "success": true, "message": "Subscription successful!" }
```

Error responses:

- `400` with `{ "success": false, "error": "Email is required" | "Invalid email format" }`
- `500` with `{ "success": false, "message": "Internal Server Error" }`

### `PATCH /users/me`

Updates Privy custom metadata. Requires an authenticated Privy server token and a body containing the target user id plus a metadata object containing only primitive values (string/number/boolean).

```bash
curl -X PATCH http://localhost:3000/users/me \
  -H 'Authorization: Bearer <privy-server-token>' \
  -H 'Content-Type: application/json' \
  -d '{
        "id": "user_123",
        "customMetadata": {
          "displayName": "Aloe Vera",
          "preferredLanguage": "en"
        }
      }'
```

Responses:

- Echo `{ id, customMetadata }` when Privy credentials are absent (development shortcut).
- The updated Privy user payload otherwise.
- Errors: `401` (missing/invalid token), `400` (missing id or invalid metadata payload), `404` (user not found), `500` (unexpected error with message suppressed in production).

---

## Client Package (`packages/client`)

The PWA exposes React providers, hooks, modules, and UI primitives intended for reuse across routes and downstream packages.

### Application Entrypoints

- `App` (`src/App.tsx`) — top-level route scaffold exported as the default component.
- `Root` (`src/main.tsx`) — bootstraps providers and router; useful when embedding the app into Storybook/tests.
- `router` (`src/router.tsx`) — React Router object configured with guards and lazy routes.

Wrap the root render tree with the provided context providers:

```tsx
import { AppProvider } from "@/providers/app";
import { UserProvider } from "@/providers/user";
import { JobQueueProvider } from "@/providers/jobQueue";
import { WorkProvider } from "@/providers/work";

export function Root() {
  return (
    <AppProvider>
      <UserProvider>
        <JobQueueProvider>
          <WorkProvider>
            <App />
          </WorkProvider>
        </JobQueueProvider>
      </UserProvider>
    </AppProvider>
  );
}
```

### Providers & Context Hooks

| Export | Location | Purpose | Usage |
| --- | --- | --- | --- |
| `AppProvider`, `useApp()` | `providers/app.tsx` | Supplies install-state utilities, locale switching, and PostHog context. | `const { locale, promptInstall } = useApp();` |
| `UserProvider`, `useUser()` | `providers/user.tsx` | Bridges Privy authentication, smart account client, and PostHog identity correlation. | `const { user, smartAccountClient } = useUser();` |
| `JobQueueProvider`, `useJobQueue()`, `useQueueStats()`, `useQueueFlush()` | `providers/jobQueue.tsx` | Coordinates the offline queue, exposes live stats/events, and handles optimistic query updates. | `const { stats, flush } = useJobQueue();` |
| `WorkProvider`, `useWork()` | `providers/work.tsx` | Manages the multi-step work submission wizard, cached approvals, and RHF instance. | `const { form, workMutation } = useWork();` |

### React Hooks

| Hook | Signature | Purpose | Notes |
| --- | --- | --- | --- |
| `useBrowserNavigation()` | `() => number` | Forces a re-render when the browser `popstate` fires or location changes, useful for stale route-aware components. | Returns a monotonically increasing tick that can be used as a key. |
| `useCurrentChain()` | `() => number` | Returns the default chain id (`DEFAULT_CHAIN_ID`). | Memoized. |
| `useEASConfig()` | `() => EASConfig` | Retrieves EAS schema addresses for the active chain. | Derived from `getEASConfig`. |
| `useNetworkConfig()` | `() => NetworkConfig` | Returns RPC/explorer metadata for the active network. | Uses `getNetworkConfig`. |
| `useChainConfig()` | `() => { chainId, eas, network }` | Convenience hook bundling the chain id, EAS config, and network config. | Useful for providers. |
| `useDebounced(callback, delay)` | `<T extends (...args)=>void>(T, number) => T` | Returns a debounced version of a callback with automatic cleanup. | Leverages refs to avoid stale closures. |
| `useDebouncedValue(value, delay)` | `<T>(T, number) => T` | Emits a debounced value snapshot after the delay elapses. | Cancels timeout on change/unmount. |
| `useNavigateToTop()` | `() => void` | Scrolls to top when invoked (ex: after route transition). | Uses `useEffect` on location change. |
| `useOffline()` | `() => { isOnline, pendingCount, pendingWork, syncStatus, refetch }` | Tracks online/offline state, auto-flushes the job queue on reconnect, and exposes pending counts. | `pendingWork` is a placeholder array; use `useWorks` for details. |
| `useStorageManager()` | `() => UseStorageManagerReturn` | Exposes storage analytics plus cleanup helpers backed by `defaultStorageManager`. | Provides `performCleanup`, `shouldPerformCleanup`, etc. |
| `useWorks(gardenId)` | `(string) => { works, offlineCount, onlineCount, isLoading, error, refetch }` | Merges on-chain works with offline queue submissions and keeps them synchronized via events. | Uses `useMerged`, `jobQueueEventBus`. |
| `usePendingWorksCount()` | `() => UseQueryResult<number>` | Tracks pending job count. | Invalidated on job events. |
| `useQueueStatistics()` | `() => UseQueryResult<QueueStats>` | Returns aggregate queue stats (pending/failed/synced). | Event-driven invalidation. |
| `useMerged(options)` | Generic typed hook | Synchronizes two React Query sources (online/offline) and exposes a merged query. | Provide `events` array to listen for cache invalidations. |
| `useWorkApprovals(attesterAddress?)` | `(string?) => {...}` | Returns online + offline approvals for the attester with derived counts and status buckets. | Safely handles network errors and job queue events. |
| `useGardenTabs()` | `() => { activeTab, setTab }` with `GardenTab` enum | Drives the garden tab UI state machine. | Enum values: `overview`, `work`, etc. |

Supporting exports:

- `UseStorageManagerReturn` type (`hooks/useStorageManager.ts`).
- `GardenTab` enum (`hooks/useGardenTabs.ts`).
- `jobToWork(job)` utility (`hooks/useWorks.ts`) converting queue jobs into work models.

### Prefetch Utilities & Query Keys

- `ensureBaseLists(chainId?: number)` — pre-warms actions/gardens/gardeners queries using the shared `QueryClient`.
- `ensureHomeData(chainId?: number)` — awaits the base list promises and returns `{ actions, gardens, gardeners }`.
- `queryClient` (`modules/react-query.ts`) — singleton QueryClient used across the app.
- `queryKeys` and `queryInvalidation` (`hooks/query-keys.ts`) — canonical key factories for TanStack Query. Type helpers `QueryKey`, `WorksQueryKey`, `QueueQueryKey` are exported for strict typing.

### Modules & Services

#### EAS GraphQL Gateway (`modules/eas.ts`)

- `getGardenAssessments(gardenAddress?, chainId?)` — fetches EAS attestations for garden assessments, dereferences IPFS assets, and normalizes metadata.
- `getWorks(gardenAddress?, chainId?)` — returns parsed work attestations including resolved media object URLs.
- `getWorkApprovals(gardenerAddress?, chainId?)` — fetches approval attestations and decodes boolean/feedback fields.
- Internal helpers `parseDataToGardenAssessment`, `parseDataToWork`, `parseDataToWorkApproval` convert GraphQL payloads into domain models.

Usage:

```ts
const works = await getWorks(selectedGarden.id);
```

#### Green Goods Indexer (`modules/greengoods.ts`)

- `Capital` enum — typed mapping of capital categories.
- `getActions()` — queries the indexer for live actions, hydrates instructions/media from IPFS, and maps to the UI schema.
- `getGardens()` — fetches gardens and resolves banner imagery.
- `getGardeners()` — bridges to the REST API (`/users`) and maps Privy users into gardener cards.
- `updateUserProfile(id, customMetadata, accessToken?)` — calls `PATCH /users/me` with optional bearer token and returns the Privy response.

#### Pinata/IPFS (`modules/pinata.ts`)

- `pinata` — configured Pinata SDK instance (uses `VITE_PINATA_JWT`).
- `uploadFileToIPFS(file)` — uploads a `File` privately.
- `uploadJSONToIPFS(json)` — uploads JSON metadata.
- `getFileByHash(hash)` — retrieves a pinned file through the configured gateway.

#### Analytics (`modules/posthog.ts`)

- `track(event, properties)` — throttled capture helper with offline context augmentation.
- `identify(distinctId)` — sets the active user.
- `reset()` — clears PostHog session state.
- `getDistinctId()` — returns the current distinct id (mock id in development).
- `trackOfflineEvent(event, properties?)`, `trackSyncPerformance(operation, startTime, success, details?)`, `trackAppLifecycle(event)` — instrumentation shortcuts tailored for offline flows.

#### GraphQL Clients (`modules/graphql.ts`, `modules/urql.ts`)

- `easGraphQL` & `greenGoodsGraphQL` — typed `gql.tada` builders using introspection JSON.
- `createEasClient(chainId?)` — URQL client targeting the EAS GraphQL endpoint for the provided chain.
- `greenGoodsIndexer` — URQL client configured for the Envio indexer.

#### Offline Job Queue Subsystem (`modules/job-queue/*`)

- `createOfflineTxHash(jobId)` — synthesizes a pseudo transaction hash for offline jobs.
- `jobQueue` — orchestrator exposing:
  - `setSmartAccountClient(client)`
  - `addJob(kind, payload, meta?)`
  - `getStats()` / `getPendingCount()` / `hasPendingJobs()` / `getJobs(filter?)`
  - `flush()` / `startPeriodicSync(intervalMs?)` / `stopPeriodicSync()` / `isSyncInProgress()`
  - `subscribe(listener)` legacy event API
  - `cleanup()` resource teardown
- `jobQueueDB` — IndexedDB wrapper with methods `addJob`, `getJob`, `getJobs`, `updateJob`, `markJobSynced`, `markJobFailed`, `getImagesForJob`, `deleteJob`, `clearSyncedJobs`, `getStats`, `cleanup`, and `createFreshImageUrl`.
- `jobQueueEventBus` — event emitter with typed events plus React hooks `useJobQueueEvent` and `useJobQueueEvents` for subscription with automatic cleanup.
- `mediaResourceManager` — manages `URL.createObjectURL` lifecycles (`createUrl(s)`, `cleanupUrl`, `cleanupUrls`, `cleanupAll`, `getStats`).
- `JobProcessor` class — run jobs through `processJob(jobId)` with smart account execution or `processBatch(jobs, batchSize?)`. `getDefaultChainId(work?)` helper is also exported.
- `SyncManager` class — handles debounced `flush()`, `startPeriodicSync`, `stopPeriodicSync`, `isSyncInProgress`, reactive online handlers, and emits queue events. `FlushResult` interface documents `{ processed, failed, skipped }`.
- `approvalProcessor` & `workProcessor` — encode and execute queue payloads against the EAS contract. `getActionTitle` helper maps action UIDs.
- `serviceWorkerManager` — registers `/sw.js`, requests background sync (`requestBackgroundSync`), and proxies `BACKGROUND_SYNC` messages into queue flushes.

Example: queueing work offline and forcing a sync.

```ts
import { jobQueue } from "@/modules/job-queue";
import { submitWorkToQueue } from "@/modules/work-submission";

const txHash = await submitWorkToQueue(draft, gardenAddress, actionUID, actions, chainId, images);
console.info(`Queued offline work as ${txHash}`);

if (navigator.onLine) {
  await jobQueue.flush();
}
```

#### Storage & Deduplication

- `StorageManager` class (`modules/storage-manager.ts`) — provides `getAnalytics`, `getStorageQuota`, `getStorageBreakdown`, `performCleanup`, `shouldPerformCleanup`, `setCleanupPolicy`, `getCleanupPolicy`, `getLastCleanupTime`, `isCleanupInProgress`. Interfaces `StorageQuota`, `StorageBreakdown`, `CleanupPolicy`, `CleanupResult`, `StorageAnalytics` are exported alongside `defaultStorageManager` singleton.
- `DeduplicationManager` (`modules/deduplication.ts`) — utilities to prevent duplicate submissions. Public methods include `generateContentHash`, `checkRemoteDuplicate`, `checkLocalDuplicate`, `addToLocalCache`, `removeFromLocalCache`, `performComprehensiveCheck`, `clearLocalCache`, `getLocalCacheStats`, `setConfig`, `getConfig`, `checkMultipleDuplicates`, `findSimilarWork`. Also exports `DuplicationConfig`, `DuplicateCheckResult`, `LocalDuplicateResult`, and `defaultDeduplicationManager`.
- `RetryPolicy` (`modules/retry-policy.ts`) — encapsulates exponential backoff retry logic with `shouldRetry`, `calculateDelay`, `recordAttempt`, `recordSuccess`, `getRetryableItems`, `getFailedItems`, `clearItem`, `clearAllFailed`, `getStats`, plus `defaultRetryPolicy` instance. Types `RetryConfig`, `RetryAttempt`, `RetryableItem` accompany it.

#### Work Submission (`modules/work-submission.ts`)

- `submitWorkToQueue(...)` — queues work jobs and returns an offline tx hash.
- `submitApprovalToQueue(...)` — queues approval jobs.
- `validateWorkDraft(...)` & `validateApprovalDraft(...)` — return string arrays of validation errors.
- `getSubmissionStatusText(isOnline, syncStatus)` — maps queue state into friendly copy.
- `formatJobError(error)` — translates low-level errors into user-facing messages.

#### Miscellaneous Modules

- `ensureBaseLists`, `ensureHomeData` (already covered) — top-of-funnel data prefetching.
- `service-worker.ts` (`serviceWorkerManager`) — see job queue section.
- `modules/job-queue/processors/*` — see queue section.
- `modules/job-queue/media-resource-manager.ts` — see queue section.

### Configuration & Utility Exports

- `config.ts` — constants (`SUPPORTED_CHAINS`, `APP_NAME`, `APP_DESCRIPTION`, etc.), derived helpers (`getDefaultChain`, `getChainName`, `isChainSupported`, `getIndexerUrl`, `getEasGraphqlUrl`, `getEASConfig`, `getNetworkConfig`, `DEFAULT_CHAIN_ID`).
- `utils/cn.ts` — `cn(...classValues)` Tailwind-aware class merger plus re-export of `ClassValue` type.
- `utils/chainId.ts` — `extractIdFromChainString(chainString)` and `compareChainId(chainString, numericId)`.
- `utils/eas.ts` — `encodeWorkData(data, chainId)` and `encodeWorkApprovalData(data, chainId)` produce ABI-encoded attestation payloads.
- `utils/easExplorer.ts` — `getEASExplorerUrl(chainId, attestationId)`, `openEASExplorer(...)`, `isValidAttestationId(attestationId)`.
- `utils/image-compression.ts` — Exports `CompressionOptions`, `CompressionResult`, `CompressionStats`, `imageCompressor` instance, `formatFileSize`, `calculateCompressionRatio`.
- `utils/polymorphic.ts` — Polymorphic type helpers (`PolymorphicRef`, `PolymorphicComponentPropsWithRef`, `PolymorphicComponentProps`, `PolymorphicComponent`).
- `utils/recursive-clone-children.tsx` — `recursiveCloneChildren(children, mapper)` to clone React children deeply.
- `utils/tags.tsx` — default export `getTag(action)` mapping metadata into badge descriptors.
- `utils/text.ts` — `formatAddress`, `truncate`, `isValidEmail`, `truncateDescription`, `formatPrice`, `formatLastUpdated`, `capitalize`.
- `utils/workActions.ts` — `downloadWorkMedia(work)`, `downloadWorkData(work)`, `shareWork(work)`, `getWorkShareUrl(gardenId, workId)`.

### React UI Components

#### Layout & Garden Modules

| Export | File | Description |
| --- | --- | --- |
| `AppBar` | `components/Layout/AppBar.tsx` | Top navigation shell showing brand and auth controls. |
| `Header` | `components/Layout/Header.tsx` | Landing page hero header with CTA linkouts. |
| `Footer` | `components/Layout/Footer.tsx` | Footer with social/community links and legal copy. |
| `Hero` | `components/Layout/Hero.tsx` | Landing hero combining stats and CTA button. |
| `Splash` | `components/Layout/Splash.tsx` | Install/login splash screen with progressive enhancement for PWA prompts. |
| `GardenAssessments` | `components/Garden/Assessments.tsx` | Scrollable list of assessment cards (forwardRef for virtualization). |
| `GardenWork` | `components/Garden/Work.tsx` | Work feed with offline status, filters, and virtualization. |
| `GardenGardeners` | `components/Garden/Gardeners.tsx` | Roster of gardeners/operators with avatars. |
| `Books` | `components/Garden/Books.tsx` | Static call-to-action card linking to documentation. |

#### Offline Dashboard & Status

| Export | File | Description |
| --- | --- | --- |
| `WorkDashboard`, `WorkDashboardIcon`, `UploadingTab`, `PendingTab`, `CompletedTab` | `components/UI/WorkDashboard/*` | Drawer-based dashboard surfacing queue stats, grouped submissions, and retry affordances. |
| `DuplicateWorkWarning` | `components/UI/DuplicateWorkWarning/DuplicateWorkWarning.tsx` | Banner shown when deduplication detects similar submissions. |
| `OfflineIndicator` | `components/UI/OfflineIndicator/OfflineIndicator.tsx` | Sticky indicator reflecting `useOffline` status. |

#### Form & Input Primitives

| Export | File | Description |
| --- | --- | --- |
| `FormCard` | `components/UI/Form/Card.tsx` | Card wrapper with title/subtitle for wizard steps. |
| `FormProgress` | `components/UI/Form/Progress.tsx` | Stepper progress indicator. |
| `FormInput`, `FormText`, `FormDate`, `FormInfo` | `components/UI/Form/*.tsx` | React Hook Form–ready inputs with validation states. |
| `FormSelect` | `components/UI/Form/Select.tsx` | Controlled Radix select integrated with RHF generics. |

#### Buttons, Tabs, Switches, Selects

| Export | File | Description |
| --- | --- | --- |
| `Button`, `buttonVariants`, `ButtonProps`, `ButtonRootProps` | `components/UI/Button/*` | Tailwind Variants powered button component supporting icons, tone, and size variants. |
| `Tabs`, `triggerVariants`, `StandardTabs`, `StandardTab` | `components/UI/Tabs/*` | Tab system built on Radix with styled triggers/content. |
| `Switch`, `SwitchProps` | `components/UI/Switch/Switch.tsx` | Accessible toggle switch styled with Tailwind variants. |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, etc. | `components/UI/Select/Select.tsx` | Radix Select wrapper with keyboard support and consistent styling. |
| `ModalDrawer`, `ModalDrawerProps`, `ModalDrawerHeaderProps`, `ModalDrawerTab` | `components/UI/ModalDrawer/*` | Responsive drawer component used for dashboards and multi-tab sheets. |

#### Cards & Media

| Export | File | Description |
| --- | --- | --- |
| `Card`, `FlexCard`, `cardVariants`, `CardRootProps` | `components/UI/Card/Card.tsx` | Base-card primitives with token-aware spacing. |
| `ActionCard`, `GardenCard`, `WorkCard`, `MinimalWorkCard`, `StatusBadge` | `components/UI/Card/*` | Domain cards covering actions, gardens, works, and statuses. |
| Skeletons (`ActionCardSkeleton`, `GardenCardSkeleton`) | `components/UI/Card/*Skeleton.tsx` | Placeholder shimmer components during loading. |
| `ImagePreviewDialog` | `components/UI/ImagePreviewDialog/ImagePreviewDialog.tsx` | Dialog to zoom through media galleries. |
| `Carousel`, `CarouselContent`, `CarouselItem`, `GardenCarousel` | `components/UI/Carousel/Carousel.tsx` | Embla-powered carousel with optional lightbox preview integration. |
| `UploadModal` | `components/UI/UploadModal/UploadModal.tsx` | Multi-step wizard modal for work submission gating file upload states. |

#### Navigation & Feedback

| Export | File | Description |
| --- | --- | --- |
| `TopNav` | `components/UI/TopNav/TopNav.tsx` | Responsive top navigation with menu and status chips. |
| `Badge` | `components/UI/Badge/Badge.tsx` | Token-based badge component supporting accent, success, warning, and neutral variants. |
| `Avatar`, `AvatarProps` | `components/UI/Avatar/Avatar.tsx` | Rounded avatar with size/tone variants. |
| `Profile` | `components/UI/Profile/Profile.tsx` | Profile summary card used in settings and dashboards. |
| `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` | `components/UI/Accordion/Accordion.tsx` | Radix accordion with animated iconography. |
| `Faq`, `FaqItem`, `FaqTrigger`, `FaqContent` | `components/UI/Accordion/Faq.tsx` | Opinionated accordion variant for FAQ lists. |
| `CircleLoader`, `BeatLoader` | `components/UI/Loader/index.tsx` | Loading indicators sized for inline or page-level usage. |
| `AppErrorBoundary`, `GardenErrorBoundary`, `SyncErrorBoundary` | `components/UI/ErrorBoundary/*` | React error boundaries tailored to app, garden module, and sync flows respectively. |

#### Usage Example

```tsx
import { Button } from "@/components/UI/Button";
import { WorkDashboard } from "@/components/UI/WorkDashboard";

function OfflineStatus() {
  const { stats, flush } = useJobQueue();

  return (
    <aside>
      <Button label="Sync now" tone="primary" onClick={() => flush()} />
      <WorkDashboard className="mt-4" onClose={() => null} />
      <p>{stats.pending} submissions waiting to sync.</p>
    </aside>
  );
}
```

### Views & Routes

- `views/Home/*`, `views/Garden/*`, `views/Landing`, `views/Login`, `views/Profile` export page-level components (default exports) and route loaders (e.g., `gardenRouteLoader`, `gardenSubmitLoader`, `homeLoader`). These surfaces are intended for router integration rather than embedding as primitives.

---

## Smart Contracts (`packages/contracts`)

Each Solidity contract exposes public/external functions as described below. All contracts target Solidity `^0.8.25` and utilise OpenZeppelin upgradeable patterns where applicable.

### `Constants.sol`

- Chain-specific constants for TokenBound registry, EAS deployments, community tokens, and error types (`NotGardenAccount`, `NotGardenerAccount`, `NotInActionRegistry`).
- `Capital` enum aligning with the client `Capital` export.

### `accounts/Garden.sol` (`GardenAccount`)

- `initialize(_communityToken, _name, _description, _location, _bannerImage, _gardeners, _gardenOperators)`
- `updateName(_name)` (guarded by `onlyGardenOwner`)
- `updateDescription(_description)` (currently unrestricted; consider adding owner/operator guard if needed)
- `addGardener(gardener)` / `removeGardener(gardener)` (only operator)
- `addGardenOperator(operator)` (only operator)
- `removeGardenOperator(operator)` (only garden owner)
- Public getters: `communityToken`, `name`, `description`, `location`, `bannerImage`, `gardeners(address)`, `gardenOperators(address)`.

### `tokens/Garden.sol` (`GardenToken`)

- `initialize(multisig)` — sets ERC721 name/symbol and owner.
- `mintGarden(communityToken, name, description, location, bannerImage, gardeners[], gardenOperators[])` — mints ERC721, instantiates a GardenAccount via TokenBound, and emits `GardenMinted`.
- `_authorizeUpgrade(newImplementation)` — owner-only upgrade hook.

### `registries/Action.sol` (`ActionRegistry`)

- `initialize(multisig)` — sets ownership.
- `registerAction(startTime, endTime, title, instructions, capitals[], media[])` — owner-only.
- Mutators guarded by `onlyActionOwner(actionUID)`: `updateActionStartTime`, `updateActionEndTime`, `updateActionTitle`, `updateActionInstructions`, `updateActionMedia`.
- Viewers: `getAction(actionUID)`, public mappings `actionToOwner`, `idToAction`.
- Emits granular events for sub-field updates to support the indexer (`ActionRegistered`, `ActionStartTimeUpdated`, etc.).

### `resolvers/Work.sol` (`WorkResolver`)

- Constructor wires EAS + action registry addresses.
- `initialize(multisig)` — upgradeable ownership setup.
- `isPayable()` — always true (allowing attestations with value).
- `onAttest(attestation, value)` — validates gardener membership and action window; reverts with `NotGardenerAccount`, `NotInActionRegistry`, or `NotActiveAction`.
- `onRevoke(...)` — owner-only, returns true (placeholder for future revocation policy).
- `_authorizeUpgrade(newImplementation)` — owner-only.

### `resolvers/WorkApproval.sol` (`WorkApprovalResolver`)

- Mirrored lifecycle to `WorkResolver` but enforces operator permissions.
- `onAttest(attestation, value)` ensures:
  - Attested work UID exists (`NotInWorkRegistry`).
  - Attester is a garden operator (`NotGardenOperator`).
  - Referenced action exists (`NotInActionRegistry`).

### `DeploymentRegistry.sol`

Governance-controlled registry of chain-specific deployments.

- `initialize(owner)`
- `setNetworkConfig(chainId, NetworkConfig)`
- `addToAllowlist(account)` / `removeFromAllowlist(account)` / `batchAddToAllowlist(accounts[])`
- `isInAllowlist(account)` / `getAllowlist()` / `allowlistLength()`
- Governance transfer flow: `initiateGovernanceTransfer(newOwner)`, `acceptGovernanceTransfer()`, `cancelGovernanceTransfer()`
- Emergency controls: `emergencyPause()`, `emergencyUnpause()`
- Resolvers: `getNetworkConfig()`, `getNetworkConfigForChain(chainId)`, `getEAS()`, `getEASSchemaRegistry()`, `getCommunityToken()`, `getActionRegistry()`, `getGardenToken()`, `getWorkResolver()`, `getWorkApprovalResolver()`
- Update helpers for current chain: `updateActionRegistry(address)`, `updateGardenToken(address)`
- `_authorizeUpgrade(newImplementation)` — owner-only.

### Supporting Libraries & Schemas

- `lib/CommunityToken.sol` (`CommunityTokenLib.getCommunityToken()`) — returns the community token address per chain or reverts `InvalidChainId`.
- `lib/EAS.sol` (`EASLib.getEAS()`, `EASLib.getSchemaRegistry()`) — resolves EAS and schema registry addresses.
- `lib/TBA.sol` (`TBALib.createAccount`, `TBALib.getAccount`) — Token Bound Account helpers keyed by SALT.
- `Schemas.sol` — struct definitions for assessment, work, and work approval payloads shared by resolvers.
- `mocks/EAS.sol` — simple testing double exposing `setAttestation`/`getAttestation`.

---

## Indexer (`packages/indexer`)

`src/EventHandlers.ts` registers Envio handlers reacting to on-chain events emitted by the contracts above. Key handlers:

- `ActionRegistry.ActionRegistered` — normalises actions (including capital enum translation) and persists them via `context.Action.set`.
- `ActionRegistry.ActionStartTimeUpdated` / `ActionEndTimeUpdated` / `ActionTitleUpdated` / `ActionInstructionsUpdated` / `ActionMediaUpdated` — apply partial updates to the indexed action entity.
- `GardenToken.GardenMinted` — creates a `Garden` entity keyed by token-bound account address.
- `GardenAccount.NameUpdated` / `DescriptionUpdated` / `GardenerAdded` / `GardenerRemoved` / `GardenOperatorAdded` / `GardenOperatorRemoved` — maintain garden metadata and membership arrays.

Handlers are written to be idempotent and chain-aware (ID is namespaced by `chainId`). The resulting entities back the UI’s GraphQL queries via the Envio indexer endpoint.

---

## Practical Integration Tips

- **Sequencing:** Initialise providers (`AppProvider`, `UserProvider`, `JobQueueProvider`, `WorkProvider`) before rendering routes that use hooks like `useWork` or `useJobQueue`.
- **Offline-safe flows:** Always queue user submissions via `submitWorkToQueue`/`submitApprovalToQueue` and display queue state with components such as `OfflineIndicator` or `WorkDashboard`.
- **Smart contract alignment:** When adding new on-chain fields, update the corresponding resolver structs (`Schemas.sol`), indexer mapping, and client encoders (`utils/eas.ts`).
- **Documentation maintenance:** Whenever you introduce or rename a public export, update this reference (`docs/PUBLIC_API_REFERENCE.md`) alongside package-level READMEs for consistency.

---

_Last updated: 2025-11-06_
