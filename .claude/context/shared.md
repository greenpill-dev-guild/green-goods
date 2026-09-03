# Shared Package Context

Loaded when working in `packages/shared/`. Extends CLAUDE.md.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun run test` | Run tests |
| `bun lint` | Lint with oxlint |
| `bun run storybook` | Start Storybook (port 3004) |
| `bun run build-storybook` | Build static Storybook |

## Contents
- [Architecture](#architecture)
- [Critical Patterns](#critical-patterns)
- [Anti-Patterns](#anti-patterns)
- [Common Mistakes](#common-mistakes)
- [Creating New Hooks](#creating-new-hooks)
- [Storybook Component Development](#storybook-component-development)
- [Reference Files](#reference-files)

## Architecture

```
packages/shared/src/
├── hooks/        # ALL React hooks (domain-organized)
├── providers/    # Auth, JobQueue, Work, App contexts
├── stores/       # Zustand state management
├── modules/      # Core business logic
├── workflows/    # XState state machines
├── types/        # TypeScript definitions
├── config/       # App, chains, pimlico configuration
├── utils/        # Utility functions
├── i18n/         # Translations (en, es, pt)
└── components/   # Toast, Spinner, StatusBadge
```

## Critical Patterns

### Hook Architecture (MANDATORY)

**ALL hooks live in shared. Client/admin have ZERO hook definitions.**

```typescript
// ✅ Correct — import from shared
import { useAuth, useWorks, useRole } from "@green-goods/shared";

// ❌ Wrong — never create hooks in client/admin
// packages/client/src/hooks/useLocalHook.ts
export function useLocalHook() { ... }  // DON'T DO THIS
```

### Hook Categories

| Category | Location | Examples |
|----------|----------|----------|
| Authentication | `hooks/auth/` | `useAuth`, `useUser` |
| Garden | `hooks/garden/` | `useGardens`, `useGardenOperations`, `useGardenPermissions` |
| Work | `hooks/work/` | `useWorks`, `useWorkMutation`, `useWorkApproval` |
| Blockchain | `hooks/blockchain/` | `useCurrentChain`, `useNetworkConfig`, `useEnsName` |
| App | `hooks/app/` | `useOffline`, `useToastAction`, `useTheme` |
| Role | `hooks/gardener/` | `useRole`, `useGardenerProfile` |

### EAS Data Layer

EAS attestation data (assessments, work approvals, work submissions) is queried from EAS's own GraphQL indexer — **NOT** from the Envio indexer.

| Module | Purpose | Source |
|--------|---------|--------|
| `modules/data/eas.ts` | Query assessments, work, work approvals | EAS GraphQL (`easscan.org`) |
| `config/blockchain.ts` | Schema UIDs and EAS addresses | Deployment JSONs |
| `utils/eas/encoders.ts` | Encode attestation data for EAS SDK | Local encoding |
| `utils/eas/transaction-builder.ts` | Build batch attestation transactions | Local building |

```typescript
// Schema UIDs come from deployment artifacts, not hardcoded
import { getEASConfig } from "@green-goods/shared";
const easConfig = getEASConfig(chainId);
const assessmentSchemaUID = easConfig.ASSESSMENT.uid;

// EAS GraphQL endpoint per chain
import { getEasGraphqlUrl } from "@green-goods/shared";
const url = getEasGraphqlUrl(chainId); // e.g., "https://arbitrum.easscan.org/graphql"
```

### Query Key Pattern (MANDATORY)

Always use centralized query keys — never ad-hoc strings:

```typescript
import { queryKeys, queryInvalidation } from "@green-goods/shared";

// ✅ Correct — centralized keys
useQuery({ queryKey: queryKeys.gardens.all(chainId) });
queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });

// ❌ Wrong — ad-hoc keys
useQuery({ queryKey: ["gardens", chainId] });
queryClient.invalidateQueries({ queryKey: ["works", gardenId] });
```

**Key factories:**
- `queryKeys.gardens.all(chainId)` — All gardens
- `queryKeys.gardens.detail(gardenId, chainId)` — Single garden
- `queryKeys.works.merged(gardenId, chainId)` — Online + offline works
- `queryKeys.queue.stats()` — Job queue statistics

### Provider Nesting Order (MANDATORY)

Providers must nest in dependency order (outermost first). Wrong order causes runtime "context not found" crashes.

**Client** (`packages/client/src/main.tsx`):
```tsx
<HelmetProvider>
  <AppErrorBoundary>
    <AppKitProvider>      {/* Wallet connection (wraps Wagmi + QueryClient internally) */}
      <AuthProvider>      {/* Auth state — depends on wallet context */}
        <AppProvider>     {/* App context (i18n, analytics) — depends on auth */}
          <App />
        </AppProvider>
      </AuthProvider>
    </AppKitProvider>
  </AppErrorBoundary>
</HelmetProvider>
```

**Admin** (`packages/admin/src/main.tsx`):
```tsx
<PersistQueryClientProvider>  {/* Persisted query cache (admin-specific) */}
  <ErrorBoundary>
    <AppKitProvider>          {/* Wallet connection */}
      <AuthProvider>          {/* Auth state — depends on wallet context */}
        <AppProvider>         {/* App context — depends on auth */}
          <App />
        </AppProvider>
      </AuthProvider>
    </AppKitProvider>
  </ErrorBoundary>
</PersistQueryClientProvider>
```

**Dependency chain**: AppKitProvider (wallet) -> AuthProvider (auth) -> AppProvider (app)
- AppKitProvider must be outermost because auth and app hooks depend on wallet context
- AuthProvider must wrap AppProvider because app-level hooks (analytics, i18n) need auth state
- JobQueueProvider and WorkProvider (used in client views) nest inside AppProvider

### State Tool Selection

| Concern | Tool | Notes |
|---------|------|-------|
| Server state | TanStack Query | Remote data, caching |
| UI state | Zustand | Stores in `shared/stores/` |
| Form state | React Hook Form | Local to component |
| Global context | React Context | Providers in shared |
| Complex workflows | XState | Multi-step state machines |

### Event-Driven Updates (MANDATORY)

**Never poll. Always react to events:**

```typescript
// ✅ Correct — event-driven
import { useJobQueueEvents, queryKeys } from "@green-goods/shared";

useJobQueueEvents(["job:completed"], () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
});

// ❌ Wrong — polling
setInterval(() => refetch(), 5000);
```

### TypeScript Strictness

**Never use `any` — use `unknown` for untrusted data:**

```typescript
// ✅ Forces type narrowing
function processApiResponse(data: unknown): Garden | null {
  if (isGarden(data)) return data;
  return null;
}

// ❌ Disables type safety
function processApiResponse(data: any): Garden {
  return data;  // No validation!
}
```

**Use discriminated unions for state:**

```typescript
// ✅ Type-safe
type JobState =
  | { status: 'pending' }
  | { status: 'processing'; progress: number }
  | { status: 'completed'; result: Work }
  | { status: 'failed'; error: string };
```

### Chain from Environment Only

```typescript
// ✅ Correct — environment chain
import { DEFAULT_CHAIN_ID, useCurrentChain } from '@green-goods/shared';
const chainId = useCurrentChain();

// ❌ Wrong — wallet chain can differ
const { chainId } = useAccount();
```

### i18n (MANDATORY for User-Facing Strings)

All new user-facing strings MUST be added to ALL THREE language files:

```typescript
// ✅ Correct
intl.formatMessage({ id: "app.update.title", defaultMessage: "Refresh app" })

// ❌ Wrong — hardcoded
<button>Refresh app</button>
```

**Files to update simultaneously:**
- `src/i18n/en.json`
- `src/i18n/es.json`
- `src/i18n/pt.json`

### Zustand Store Inventory

All stores live in `packages/shared/src/stores/` (exported via `stores/index.ts`):

| Store | Purpose |
|-------|---------|
| `useAdminStore` | Admin cockpit state + tx status (`TransactionInfo`/`TransactionStatus`) |
| `useCreateGardenStore` | Multi-step garden-creation flow (`persist`) |
| `useCreateAssessmentStore` | Multi-step assessment-creation flow (`persist` + `partialize`) |
| `useHypercertWizardStore` | Hypercert minting wizard |
| `useWorkFlowStore` | Work-submission flow + draft/object-URL state |
| `useGardenStateStore` | Garden view state |
| `useSheetOrchestratorStore` | Sheet/overlay orchestration |
| `useUIStore` | Global UI state |

**Multi-step wizard shape**: `useCreateGardenStore` + `useCreateAssessmentStore` use `persist` and share `currentStep` / `setField` / `nextStep` / `prevStep` / computed `isStepValid(stepId)` / `reset()`. Exceptions — `useHypercertWizardStore` persists in-progress minting to **sessionStorage** (custom, not `persist`; no `isStepValid`) and loads drafts from IndexedDB; `useWorkFlowStore` is non-persisted and its `reset()` revokes tracked object URLs.

### Offline Job Queue + IndexedDB

`jobQueue` singleton (`modules/job-queue/index.ts`, barrel-exported) — the write path for all offline ops; every method is scoped by `userAddress` (`addJob` throws without it):

- `addJob(kind, payload, userAddress, meta?) → jobId` · `processJob(jobId, ctx)` · `flush(ctx)` (ctx carries `userAddress` + `smartAccountClient`)
- `getStats` · `getJobs(userAddress, filter?)` · `getPendingCount` · `hasPendingJobs` · `subscribe(listener) → unsub` · `cleanup()`
- `JobKind` = `"work" | "approval"` (`JobKindMap`, `types/job-queue.ts`)
- Job states `pending → processing → synced` / `failed`; retry `MAX_RETRIES = 5`, backoff `min(1000 · 2^attempts, 60_000)` ms
- React access: `useJobQueue()` (`providers/JobQueue.tsx`)

**Two IndexedDB databases** (not one):

| DB | Version | Object stores |
|----|---------|---------------|
| `green-goods-job-queue` | 5 | `jobs`, `job_images`, `cached_work`, `client_work_id_mappings` |
| `green-goods-drafts` | 1 | `drafts`, `draft_images` (`draftDB`, `modules/job-queue/draft-db.ts`) |

### Error Utilities

Beyond `parseContractError` / `USER_FRIENDLY_ERRORS` / `createMutationErrorHandler` (CLAUDE.md § Key Patterns), `utils/errors/` (barrel) provides:

- `categorizeError(error) → ErrorCategory` = `network | validation | auth | permission | blockchain | storage | unknown` (`categorize-error.ts`, message pattern-matched)
- `extractErrorMessage(error)` / `extractErrorMessageOr(error, fallback)` (`extract-message.ts`)
- `ValidationError` — throw for precondition/programming-error checks (`validation-error.ts`)
- `createMutationErrorHandler` config: `{ source, toastContext, toastId?, trackError?, getFallbackMessage?, getFallbackDescription? }`; returned handler takes `(error, { authMode, gardenAddress, metadata?, showToast? })`
- `USER_FRIENDLY_ERRORS` lives in `contract-errors.ts`; blockchain/tx specifics in `blockchain-errors.ts` + `tx-error-classifier.ts`

### React Compiler

`client` and `admin` enable `babel-plugin-react-compiler` in `vite.config.ts`, so components/hooks in those apps are auto-memoized. `packages/shared` is compiled by each consuming app — so `.claude/rules/react-patterns.md` Rules 9/10 (manual `useMemo`, memoized context-provider values) still apply to shared hooks and providers.

### Contract ABIs

ABIs are public exports of `@green-goods/shared` (source: `utils/blockchain/abis.ts`, e.g. `GardenAccountABI`, `GardenTokenABI`). Never import ABI JSON from `contracts/out/*.json`.

### Feature Availability (undeployed contracts)

Use `isGreenWillDeployed(chainId?)` from `@green-goods/shared` to detect when a feature contract is undeployed (zero-address) on the active chain. Render a "not available on this network" branch instead of a generic empty state — masking deployment gaps as data gaps wastes debugging cycles.

### Optimistic-UI Memos over localStorage

When a memo depends on a value written to localStorage in the same tab (e.g. pending-join membership), include `usePendingJoinsVersion()` from `@green-goods/shared` in its `useMemo` deps. The hook returns an incrementing counter that ticks on every in-tab pending-join change. Standard `storage` events only fire across tabs, so without this same-tab consumers go stale until an unrelated re-render. The pattern is generalizable — propose a sibling `use<Thing>Version()` hook when introducing new localStorage-backed optimistic state.

## Anti-Patterns

### Never Mix State Concerns

```typescript
// ❌ Wrong — server state in Zustand
const useStore = create((set) => ({
  gardens: [],  // Server data in Zustand!
  fetchGardens: async () => { ... },
}));

// ✅ Correct — TanStack Query for server state
const { data: gardens } = useQuery({
  queryKey: queryKeys.gardens.all(chainId),
  queryFn: fetchGardens,
});
```

### Never Create Stores Outside Shared

```typescript
// ❌ Wrong — store in client/admin
// packages/client/src/stores/useLocalStore.ts

// ✅ Correct — store in shared
// packages/shared/src/stores/useStore.ts
```

### Never Skip Hook Index Export

```typescript
// ❌ Missing from index (hook exists but not exported)
// packages/shared/src/hooks/domain/useNewHook.ts exists
// but not exported from hooks/index.ts

// ✅ Always export from index
// hooks/index.ts
export { useNewHook } from "./domain/useNewHook";
// Then re-export from packages/shared/src/index.ts
```

## Common Mistakes

| Mistake | Why It Fails | Solution |
|---------|--------------|----------|
| Deep/internal imports from shared | Bypasses the declared public surface | Import only from paths declared in `packages/shared/package.json#exports`; never `@green-goods/shared/src/**` |
| Using wallet chainId | Wallet may be on wrong chain | Use `useCurrentChain()` |
| Polling for updates | Wastes resources, stale data | Use event-driven updates |
| Creating hooks in client | Violates hook boundary | Move to shared |
| Ad-hoc query keys | Cache misses, stale data | Use `queryKeys` factory |

## Creating New Hooks

1. **Choose domain folder:** `hooks/{auth,garden,work,blockchain,app}/`
2. **Follow naming:** `useEntityVerb` (operations), `useEntity` (data), `useAdjective` (state)
3. **Export from index:** `hooks/index.ts` → `src/index.ts`
4. **Use centralized query keys**

```typescript
// hooks/{domain}/useNewHook.ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../config/query-keys";

export function useNewHook(param: string) {
  return useQuery({
    queryKey: queryKeys.domain.key(param),
    queryFn: ({ signal }) => fetchData(param, signal),  // Support cancellation
  });
}
```

## Storybook Component Development

### When to Use Storybook

| Use Case | Storybook Role |
|----------|----------------|
| **New Component** | Develop in isolation first, then integrate |
| **Debugging UI** | Isolate component from app context |
| **Testing Variants** | See all states (loading, error, empty) at once |
| **Prototyping** | Quickly iterate on designs |
| **Documentation** | Auto-generated docs from props |

### Creating Stories (MANDATORY for New Components)

When adding components to `src/components/`, include a story file:

```
src/components/
├── MyComponent/
│   ├── MyComponent.tsx
│   └── MyComponent.stories.tsx  ← Required
```

**Story template:**

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { MyComponent } from "./MyComponent";

const meta: Meta<typeof MyComponent> = {
  title: "Components/Category/MyComponent",
  component: MyComponent,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  args: { /* default props */ },
};

// Show all variants
export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      <MyComponent variant="primary" />
      <MyComponent variant="secondary" />
    </div>
  ),
};
```

### Storybook Theming

- Uses same CSS tokens as apps (`--bg-*`, `--text-*`, `--stroke-*`)
- Tailwind v4 utilities work in stories
- Theme toggle in toolbar (🎨 icon) switches light/dark

### Accessibility Testing

The a11y addon runs automatically:
1. Open story in Storybook
2. Check "Accessibility" tab in addon panel
3. Fix any violations before merging

### Configuration Files

| File | Purpose |
|------|---------|
| `packages/shared/.storybook/main.ts` | Addons, Vite config |
| `packages/shared/.storybook/preview.tsx` | Global decorators |
| `packages/shared/.storybook/storybook.css` | Tailwind + tokens |
| `packages/shared/.storybook/theme.ts` | Green Goods branding |

### Story Gates & Determinism

- Coverage + quality gates run from this package: `bun run check:stories` (`scripts/quality/check-story-coverage.ts`) and `bun run check:story-quality` (`scripts/quality/check-story-quality.ts`). Run both when a story changes.
- Use deterministic fixtures/decorators from `.storybook/` (`fixtures.ts`, `adminFixtures.ts`, `decorators.tsx`). Never `Date.now()`, zero-arg `new Date()`, `picsum.photos`, live IPFS, or placeholder CIDs — use `STORYBOOK_NOW_SECONDS`, `hoursAgo`/`daysAgo`, and `FIXTURE_*` data URLs.
- Tag a story `visual-harness` only when a real component can't render deterministically (wallet/contract/live-service seams); `storybook-ci` only for stable high-value `play()` behavior. Story authoring/tagging conventions: `.claude/skills/design/implementation.md § Storybook`.

## Reference Files

- Hook exports: `src/hooks/index.ts`
- Query keys: `src/config/query-keys/`
- Package exports: `src/index.ts`
- Providers: `src/providers/`
- Stores: `src/stores/`
- Storybook config: `packages/shared/.storybook/`

## Documentation References (on-demand)

Read these docs pages when you need domain context beyond code patterns:

- System architecture with Mermaid diagrams: `docs/docs/builders/architecture.mdx`
- Domain authority: `packages/shared/src/ontology/green-goods-ontology.json`; public projection: `docs/docs/reference/glossary.generated.mdx`
- Impact model & Eight Forms of Capital: `docs/docs/builders/architecture/design.mdx`
- Cross-protocol entity matrix (draft/vocab aid): `docs/docs/builders/architecture/entity-matrix.mdx`
