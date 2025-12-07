# Green Goods Client — Architecture Guide

The Green Goods client is an **offline-first Progressive Web App (PWA)** built with React, TypeScript, and Vite. This guide provides AI agents with essential architectural context.

## Architecture Overview

```
src/
├── components/      # Client-specific UI components
│   ├── Actions/    # Action buttons and controls
│   ├── Cards/      # Card components (Action, Garden, Work)
│   ├── Communication/ # Badges, offline indicator, loaders
│   ├── Dialogs/    # Modals and drawers
│   ├── Display/    # Accordion, Avatar, Carousel, Image
│   ├── Errors/     # Error boundaries
│   ├── Features/   # Feature-specific (Garden/, Profile/, Work/)
│   ├── Inputs/     # Form inputs (Clipboard, Date, Select, TextField)
│   ├── Layout/     # AppBar, Hero, Splash
│   ├── Navigation/ # Headers, footers, tabs, TopNav
│   └── Selection/  # Switch and selection controls
├── views/           # Route views (lazy-loaded)
│   ├── Garden/     # Work submission flow (Details, Intro, Media, Review)
│   ├── Home/       # Home view
│   │   ├── Garden/ # Garden detail (Assessment, Work, Notifications)
│   │   └── WorkDashboard/ # User's work status (Pending, Uploading, Completed)
│   ├── Landing/    # Landing page
│   ├── Login/      # Authentication
│   └── Profile/    # User profile (Account, Help)
├── routes/          # Route guards and shells
│   ├── AppShell.tsx      # Authenticated app wrapper
│   ├── RequireAuth.tsx   # Auth guard
│   ├── RequireInstalled.tsx # PWA install guard
│   └── Root.tsx          # Root layout
├── styles/          # CSS files
│   ├── animation.css
│   ├── colors.css
│   ├── typography.css
│   └── utilities.css
├── config.ts        # Client configuration
└── router.tsx       # React Router configuration
```

**Important:** Core logic (hooks, providers, modules, stores, workflows) lives in `@green-goods/shared`. See `/packages/shared/AGENTS.md` for details.

## Core Design Principles

### 1. Offline-First

**Job queue system** queues work when offline, syncs when online:
- IndexedDB for persistent storage
- Event-driven synchronization
- MediaResourceManager for blob URLs
- No polling, only event-based updates

**Implementation:** `@green-goods/shared` — see `packages/shared/src/modules/job-queue/`

### 2. Passkey Authentication

**WebAuthn + Kernel Smart Accounts:**
- Biometric authentication (Face ID, Touch ID, fingerprint)
- No seed phrases or private keys
- Pimlico sponsorship for garden joins
- Wagmi fallback for operators/admins

**Implementation:** `@green-goods/shared` — see `packages/shared/src/providers/`

### 3. Component-Driven UI

**Design system:**
- Tailwind CSS v4 with Radix UI primitives
- Card variants: ActionCard, GardenCard, WorkCard
- Form components with consistent API
- Modal/drawer patterns

### 4. State Specialization

Different tools for different state concerns (all from `@green-goods/shared`):
- **Server state:** TanStack Query
- **UI state:** Zustand
- **Form state:** React Hook Form
- **Global context:** React Context

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
- Shared logic: `@green-goods/shared` modules

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
- Hook: `@green-goods/shared` — `useWorkApproval`

### Root Garden Auto-Join

**First-time users (passkey):**
```
Create passkey → Show "Creating your garden account..."
→ Initialize smart account → Show "Joining community garden..."
→ Auto-join root garden (sponsored tx) → Set onboarded flag
→ Navigate to home
```

**Implementation:**
- Login flow: `src/views/Login/index.tsx`
- Splash screen: `src/components/Layout/Splash.tsx`
- Hook: `@green-goods/shared` — `useAutoJoinRootGarden`

## Imports from Shared Package

```typescript
// Hooks
import { 
  useAuth, useUser, useWorks, useWorkApproval, 
  useGardens, useCurrentChain, useRole,
  queryKeys 
} from '@green-goods/shared';

// Providers
import { 
  AppProvider, ClientAuthProvider, JobQueueProvider, WorkProvider 
} from '@green-goods/shared';

// Modules
import { jobQueue, jobQueueEventBus } from '@green-goods/shared';

// Stores
import { useWorkFlowStore, useUIStore } from '@green-goods/shared';

// Config
import { DEFAULT_CHAIN_ID, getNetworkConfig } from '@green-goods/shared';

// Types
import type { Garden, Work, WorkDraft, Action } from '@green-goods/shared';
```

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
import { DEFAULT_CHAIN_ID } from '@green-goods/shared';
const chainId = DEFAULT_CHAIN_ID;  // Reads VITE_CHAIN_ID

// ❌ Wrong
const { chainId } = useAccount();  // Never use wallet chain
```

### 2. Query Key Centralization

```typescript
// ✅ Correct
import { queryKeys } from '@green-goods/shared';
queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });

// ❌ Wrong
queryClient.invalidateQueries({ queryKey: ['works', gardenId] });
```

### 3. Event-Driven Updates

```typescript
// ✅ Correct
import { useJobQueueEvents } from '@green-goods/shared';

useJobQueueEvents(['job:completed'], () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
});

// ❌ Wrong
setInterval(() => {
  queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
}, 5000);
```

## Component Patterns

### Card Components

Located in `src/components/Cards/`:
- `ActionCard` — Display garden actions
- `GardenCard` — Display garden info
- `WorkCard` — Display work submissions

### Form Components

Located in `src/components/Inputs/`:
- `Input` — Text input
- `FormSelect` — Select dropdown
- `Date` — Date picker

### Dialog Components

Located in `src/components/Dialogs/`:
- `ModalDrawer` — Responsive modal/drawer
- `ConfirmDrawer` — Confirmation dialog
- `ImagePreviewDialog` — Image preview

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

## Internationalization

**Supported languages:**
- English (en.json)
- Spanish (es.json)
- Portuguese (pt.json)

**Translations are in `@green-goods/shared`:** `packages/shared/src/i18n/`

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
2. Add tests in `src/__tests__/`
3. Import hooks/providers from `@green-goods/shared`
4. Update routing in `src/router.tsx` if needed
5. Document pattern in relevant `.mdc` file if establishing new convention

### Adding a New View

1. Create view in `src/views/{ViewName}/index.tsx`
2. Add route in `src/router.tsx` with lazy loading
3. Add route guard if authentication required
4. Use shared hooks for data fetching

### Adding a New Component

1. Create component in appropriate `src/components/{Category}/` directory
2. Export from `src/components/{Category}/index.ts`
3. Add tests in `src/__tests__/components/`
4. Follow existing patterns for props and styling

## Deep Dive Rules

For detailed patterns, see package-specific .mdc files:

- **Component Patterns:** `.cursor/rules/component-patterns.mdc`
- **Testing:** `.cursor/rules/testing.mdc`

For shared code patterns:

- **Offline Architecture:** `packages/shared/.cursor/rules/rules.mdc`
- **State Management:** `packages/shared/AGENTS.md`
- **Authentication:** `packages/shared/AGENTS.md`

## Reference Documentation

- Client README: `/packages/client/README.md`
- Shared AGENTS.md: `/packages/shared/AGENTS.md`
- Root agent guide: `/AGENTS.md`
