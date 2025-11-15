## Client (PWA) — UI system, Tailwind v4, Radix, forms, offline-first, and component patterns.

# Green Goods Client — Architecture Guide

The Green Goods client is an **offline-first Progressive Web App (PWA)** built with React, TypeScript, and Vite. This guide provides AI agents with essential architectural context.

## Architecture Overview

```
src/
├── components/      # UI components (Radix + Tailwind)
├── views/           # Main app views (lazy-loaded)
├── providers/       # React context providers
├── hooks/           # Custom React hooks
├── modules/         # Service layer (data, job queue, auth)
├── state/           # Zustand stores
├── utils/           # Utility functions
├── types/           # TypeScript definitions
├── styles/          # Tailwind CSS + animations
├── i18n/            # Translations (en, es, pt)
└── router.tsx       # React Router config
```

## Core Design Principles

### 1. Offline-First

**Job queue system** queues work when offline, syncs when online:
- IndexedDB for persistent storage
- Event-driven synchronization
- MediaResourceManager for blob URLs
- No polling, only event-based updates

**See:** `.cursor/rules/offline-architecture.mdc`

### 2. Passkey Authentication

**WebAuthn + Kernel Smart Accounts:**
- Biometric authentication (Face ID, Touch ID, fingerprint)
- No seed phrases or private keys
- Pimlico sponsorship for garden joins
- Wagmi fallback for operators/admins

**See:** `.cursor/rules/authentication.mdc`

### 3. Component-Driven UI

**Design system:**
- Tailwind CSS v4 with Radix UI primitives
- Card variants: ActionCard, GardenCard, WorkCard
- Form components with consistent API
- Modal/drawer patterns

**See:** `.cursor/rules/component-patterns.mdc`

### 4. State Specialization

Different tools for different state concerns:
- **Server state:** TanStack Query
- **UI state:** Zustand
- **Form state:** React Hook Form
- **Global context:** React Context

**See:** `.cursor/rules/state-management.mdc`

## Key Workflows

### Work Submission Workflow

Green Goods uses **two distinct submission paths** based on authentication mode:

**Passkey Mode (Offline-First):**
```
User fills form → Submit → Add to job queue → Process inline (if online)
                                            → Queue for later (if offline)
                                            
Queue processes → Upload media to IPFS → Create EAS attestation → Mark synced
```

**Wallet Mode (Direct Transaction):**
```
User fills form → Submit → Upload media to IPFS → Create EAS attestation
→ Send transaction via wallet → Wait for confirmation → Done
```

**Implementation:**
- Form: `src/views/Garden/index.tsx`
- Wallet submission: `src/modules/work/wallet-submission.ts`
- Queue submission: `src/modules/work/work-submission.ts`
- Processing: `packages/shared/src/modules/job-queue/index.ts` (`processJob`, `flush`)
- Provider: `src/providers/work.tsx` (branches on `authMode`)

### Work Approval Workflow

**Passkey Mode:**
```
Operator views work → Reviews media/details → Approves/rejects with feedback
→ Creates approval job → Process inline → EAS attestation created
```

**Wallet Mode:**
```
Operator views work → Reviews media/details → Approves/rejects with feedback
→ Encode approval data → Send transaction via wallet → Done
```

**Implementation:**
- View: `src/views/Home/Garden/Work.tsx`
- Hook: `src/hooks/work/useWorkApproval.ts` (branches on `authMode`)
- Wallet submission: `src/modules/work/wallet-submission.ts`
- Queue submission: `src/modules/work/work-submission.ts`
- Provider: `src/providers/jobQueue.tsx`

### Root Garden Auto-Join

**First-time users (passkey):**
```
Create passkey → Show "Creating your garden account..."
→ Initialize smart account → Show "Joining community garden..."
→ Auto-join root garden (sponsored tx) → Set onboarded flag
→ Navigate to home
```

**Returning users (passkey):**
```
Authenticate → Show "Welcome back..." → Navigate to home
```

**Wallet users:**
```
Connect wallet → Manual prompt to join root garden (optional)
→ User can join later from profile
```

**Storage Pattern:**
- `greengoods_user_onboarded`: Set to "true" after first-time onboarding complete
- `rootGardenPrompted`: Set to "true" after wallet user prompted or dismissed

**Files:**
- Login flow: `src/views/Login/index.tsx`
- Splash screen: `src/components/Layout/Splash.tsx` (with loading states)
- Hook: `src/hooks/garden/useAutoJoinRootGarden.ts`
- Auth provider: `src/providers/auth.tsx`
- Pimlico client setup: `src/modules/auth/passkey.ts`, `src/modules/pimlico/config.ts`

## Module Architecture

### modules/job-queue/

**Core offline system:**
- `index.ts` — JobQueue service (`addJob`, `processJob`, `flush`)
- `db.ts` — IndexedDB interface
- `event-bus.ts` — Event-driven updates
- `media-resource-manager.ts` — Blob URL lifecycle / cleanup

### modules/data/

**Data fetching:**
- `eas.ts` — EAS attestation queries
- `greengoods.ts` — Indexer queries (gardens, actions)
- `pinata.ts` — IPFS uploads
- `urql.ts` — GraphQL client config
- `graphql.ts` — Type-safe GraphQL (gql.tada)

### modules/app/

**App infrastructure:**
- `posthog.ts` — Analytics with offline context
- `service-worker.ts` — PWA service worker registration

### modules/work/

**Work-specific logic:**
- `work-submission.ts` — Submission utilities
- `deduplication.ts` — Duplicate detection (currently disabled)
- `retry-policy.ts` — Retry logic with exponential backoff
- `storage-manager.ts` — Storage quota management

### modules/pimlico/

**Account abstraction:**
- `config.ts` — Pimlico client configuration
- `paymaster.ts` — Sponsorship logic and rate limiting

## Provider Hierarchy

**Required nesting order:**

```tsx
<WagmiProvider>                    // 1. Wallet infrastructure
  <AppProvider>                    // 2. App settings (i18n, PWA)
    <AuthProvider chainId={chainId}> // 3. Passkey or wallet auth
      <QueryClientProvider>        // 4. TanStack Query
        <JobQueueProvider>         // 5. Offline job processing
          <WorkProvider>           // 6. Work submission
            <Routes />
          </WorkProvider>
        </JobQueueProvider>
      </QueryClientProvider>
    </AuthProvider>
  </AppProvider>
</WagmiProvider>
```

**Why this order:** Each provider depends on ancestors. Changing order breaks functionality.

## Routing Structure

```typescript
// router.tsx (lazy-loaded views)
{
  path: 'home',
  lazy: () => import('@/views/Home'),
  children: [
    {
      path: ':id',  // Garden detail
      lazy: () => import('@/views/Home/Garden'),
      children: [
        { path: 'work/:workId', lazy: () => import('@/views/Home/Garden/Work') },
      ],
    },
  ],
},
{
  path: 'garden',  // Work submission
  lazy: () => import('@/views/Garden'),
},
{
  path: 'profile',
  lazy: () => import('@/views/Profile'),
},
```

**Pattern:** Lazy load all views for optimal bundle size.

## Critical Patterns

### 1. Chain from Environment Only

```typescript
// ✅ Correct
import { DEFAULT_CHAIN_ID } from '@/config/blockchain';
const chainId = DEFAULT_CHAIN_ID;  // Reads VITE_CHAIN_ID

// ❌ Wrong
const { chainId } = useAccount();  // Never use wallet chain
```

### 2. Query Key Centralization

```typescript
// ✅ Correct
import { queryKeys } from '@/hooks/query-keys';
queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });

// ❌ Wrong
queryClient.invalidateQueries({ queryKey: ['works', gardenId] });
```

### 3. Event-Driven Updates

```typescript
// ✅ Correct
useJobQueueEvents(['job:completed'], () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
});

// ❌ Wrong
setInterval(() => {
  queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
}, 5000);
```

### 4. Media URL Lifecycle

```typescript
// ✅ Correct
const url = mediaResourceManager.createUrl(file, jobId);
useEffect(() => () => mediaResourceManager.cleanupUrls(jobId), [jobId]);

// ❌ Wrong
const url = URL.createObjectURL(file);  // Never revoked = memory leak
```

## Performance Optimizations

### Bundle Splitting

**Dynamic imports for views:**
```typescript
const Home = lazy(() => import('@/views/Home'));
const Garden = lazy(() => import('@/views/Garden'));
const Profile = lazy(() => import('@/views/Profile'));
```

**Result:**
- Main bundle: ~4.4MB
- Assessment chunk: 0.36KB
- Garden chunk: 10.81KB
- WorkApproval chunk: 66.11KB

### Image Optimization

```typescript
import { imageCompressor } from '@/utils/work/image-compression';

// Compress before upload
const compressed = await imageCompressor.compressImage(file, {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
});
```

### Virtualization

```typescript
import { FixedSizeList as List } from 'react-window';

// Use for lists >40 items
{items.length > 40 ? (
  <List height={600} itemCount={items.length} itemSize={80} width="100%">
    {({ index, style }) => <Item item={items[index]} style={style} />}
  </List>
) : (
  items.map(item => <Item item={item} />)
)}
```

## Testing Strategy

### Test Categories

1. **Unit tests**: Components, hooks, utils (Vitest)
2. **Integration tests**: Multi-component flows (Vitest)
3. **E2E tests**: Full user journeys (Playwright via MCP)
4. **Visual tests**: Screenshot comparisons (Playwright via MCP)

### Coverage Target

- **Overall:** 70%+
- **Critical paths:** 80%+ (offline queue, auth, sync)
- **Security:** 100% (authentication, encryption)

**See:** `.cursor/rules/testing.mdc`

## Internationalization

**Supported languages:**
- English (en.json)
- Spanish (es.json)
- Portuguese (pt.json)

**Usage:**
```typescript
import { useIntl } from 'react-intl';

const intl = useIntl();
const message = intl.formatMessage({
  id: 'app.garden.work.noWork',
  defaultMessage: 'No work yet',
});
```

## Common Tasks

### Adding a New Feature

1. Create component in `src/components/` or `src/views/`
2. Add tests in `src/__tests__/components/` or `src/__tests__/views/`
3. Update provider if needed (`src/providers/`)
4. Add translations to `src/i18n/*.json`
5. Update routing in `src/router.tsx`
6. Document pattern in relevant `.mdc` file if establishing new convention

### Adding Offline Support

1. Define job payload type in `src/types/job-queue.d.ts`
2. Extend `jobQueue.processJob`/`flush` in `packages/shared/src/modules/job-queue/index.ts`
3. Persist any extra IndexedDB state in `db.ts`
4. Queue the job from the relevant provider/hook using `submit*ToQueue`
5. Add event invalidations or optimistic updates (`providers/jobQueue.tsx`, hooks)
6. Cover new paths with unit tests (queue + provider) and integration tests

### Adding GraphQL Query

1. Add query to modules (e.g., `src/modules/data/eas.ts`)
2. Create hook in `src/hooks/` (e.g., `useWorks.ts`)
3. Add query keys to `src/hooks/query-keys.ts`
4. Set up event-driven invalidation
5. Use in component via hook

## MCP Integration

### GitHub MCP for Client

```bash
# Create feature issues
@github: Create issue "Add garden search functionality" with labels: feature, client

# Track bugs
@github: Create issue from error "Job queue sync timeout" with label bug, priority:high

# PR management
@github: List open PRs modifying client package
```

### Playwright MCP for Testing

```bash
# Run E2E tests
@playwright: Execute all client E2E tests

# Visual regression
@playwright: Compare WorkDashboard screenshots before/after changes

# Accessibility
@playwright: Run accessibility audit on garden submission flow
```

## Deep Dive Rules

For detailed patterns, see package-specific .mdc files:

- **Offline Architecture:** `.cursor/rules/offline-architecture.mdc`
- **State Management:** `.cursor/rules/state-management.mdc`
- **Components:** `.cursor/rules/component-patterns.mdc`
- **Hooks:** `.cursor/rules/hooks-conventions.mdc`
- **Authentication:** `.cursor/rules/authentication.mdc`
- **Testing:** `.cursor/rules/testing.mdc`

## Reference Documentation

- Client README: `/packages/client/README.md`
- Architecture: `/docs/ARCHITECTURE.md`
- Features: `/docs/FEATURES.md`
- Testing: `/docs/TESTING.md`
- Root agent guide: `/AGENTS.md`
