# @green-goods/shared

Shared utilities, hooks, providers, modules, and types for the Green Goods monorepo.

## Installation

This package is used internally by client and admin packages:

```json
{
  "dependencies": {
    "@green-goods/shared": "workspace:*"
  }
}
```

## Usage

Import everything from the package root:

```typescript
// Hooks
import { useAuth, useWorks, useGardens, useRole } from '@green-goods/shared';

// Providers
import { AppProvider, JobQueueProvider, WorkProvider } from '@green-goods/shared';

// Stores
import { useAdminStore, useUIStore, useWorkFlowStore } from '@green-goods/shared';

// Modules
import { jobQueue, track, submitWorkWithPasskey } from '@green-goods/shared';

// Config
import { DEFAULT_CHAIN_ID, getNetworkConfig, queryClient } from '@green-goods/shared';

// Utils
import { cn, formatAddress, truncateAddress } from '@green-goods/shared';

// Components
import { Spinner, ToastViewport, toastService, StatusBadge } from '@green-goods/shared';

// Types
import type { Garden, Work, UserRole, AuthMode } from '@green-goods/shared';
```

## Package Structure

```
src/
├── components/      # Shared UI (Toast, Spinner, Forms, StatusBadge)
├── config/          # App, blockchain, chains, pimlico, react-query
├── hooks/           # All custom hooks (auth, garden, work, blockchain, etc.)
│   ├── action/      # Action operations
│   ├── app/         # App-level hooks (offline, toast, theme)
│   ├── assessment/  # Assessment workflows
│   ├── auth/        # Authentication (useAuth, useUser)
│   ├── blockchain/  # Chain config, ENS, deployment registry
│   ├── garden/      # Garden operations, permissions, invites
│   ├── gardener/    # Role, profile hooks
│   ├── translation/ # i18n hooks
│   ├── ui/          # UI utilities
│   └── work/        # Work submission, approval, mutations
├── modules/         # Core business logic
│   ├── app/         # Analytics (posthog), service worker
│   ├── auth/        # Passkey session management
│   ├── data/        # API clients (eas, greengoods, ipfs/storacha, graphql-client)
│   ├── job-queue/   # Offline queue system (IndexedDB, event bus)
│   ├── translation/ # Browser translation, cache
│   └── work/        # Work/approval submission logic
├── providers/       # React providers (Auth, JobQueue, Work, App)
├── stores/          # Zustand stores (admin, UI, workFlow, createGarden)
├── workflows/       # XState machines (createGarden, createAssessment)
├── types/           # TypeScript definitions
├── utils/           # Utility functions
├── i18n/            # Translations (en, es, pt)
└── styles/          # Shared theme CSS
```

## Key Features

### Toast Notifications

```typescript
import { toastService, ToastViewport } from '@green-goods/shared';

// Show toasts
toastService.success({ title: 'Saved!', message: 'Your changes were saved.' });
toastService.error({ title: 'Error', message: 'Something went wrong.', error });
toastService.loading({ title: 'Processing...', message: 'Please wait.' });

// Render once in your root layout
<ToastViewport />
```

### Job Queue (Offline Support)

```typescript
import { jobQueue, useJobQueueEvents, queryKeys } from '@green-goods/shared';

// Add job to queue
await jobQueue.addJob('work', payload, { chainId });

// Listen for completion
useJobQueueEvents(['job:completed'], ({ txHash }) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
});

// Flush pending jobs
await jobQueue.flush({ smartAccountClient });
```

### Query Keys

Always use centralized query keys:

```typescript
import { queryKeys } from '@green-goods/shared';

queryClient.invalidateQueries({ queryKey: queryKeys.gardens.all(chainId) });
queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
```

### Auth Mode Branching

```typescript
import { useAuth } from '@green-goods/shared';

const { authMode, smartAccountClient } = useAuth();

if (authMode === 'wallet') {
  // Direct wallet transaction
} else {
  // Passkey mode - use job queue for offline support
}
```

## Development

```bash
# Format code
bun format

# Lint code
bun lint

# Run tests
bun test

# Run specific test
bun test job-queue
```

## Storybook

The shared package includes a Storybook setup for component development, testing, and documentation.

### Quick Start

```bash
cd packages/shared

# Start Storybook dev server (port 6006)
bun run storybook

# Build static Storybook for deployment
bun run build-storybook
```

Storybook is also included in the PM2 ecosystem — running `bun dev` from the root starts it alongside other services.

### Accessing Storybook

- **Local**: http://localhost:6006
- **Theme Toggle**: Use the 🎨 paintbrush icon in the toolbar to switch between light/dark modes

### Use Cases

| Use Case | How Storybook Helps |
|----------|---------------------|
| **Product Development** | Preview components in isolation before integrating into views |
| **Testing** | Visual regression testing, accessibility audits via a11y addon |
| **Debugging** | Isolate component issues without app context |
| **Prototyping** | Quickly iterate on component variants and states |
| **Documentation** | Auto-generated docs from component props (autodocs) |

### Writing Stories

Stories live alongside components:

```
src/components/
├── Badge/
│   ├── Badge.tsx
│   └── Badge.stories.tsx  ← Story file
```

**Basic story template:**

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { MyComponent } from "./MyComponent";

const meta: Meta<typeof MyComponent> = {
  title: "Components/Category/MyComponent",
  component: MyComponent,
  tags: ["autodocs"],  // Enable auto-generated docs
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  args: {
    children: "Example",
    variant: "primary",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      <MyComponent variant="primary">Primary</MyComponent>
      <MyComponent variant="secondary">Secondary</MyComponent>
    </div>
  ),
};
```

### Story Guidelines

1. **Location**: Stories go in the same folder as the component
2. **Naming**: Use `ComponentName.stories.tsx`
3. **Title**: Follow hierarchy `Components/Category/ComponentName`
4. **Tags**: Include `["autodocs"]` for automatic documentation
5. **Variants**: Show all component states (default, loading, error, empty)
6. **Controls**: Add `argTypes` for interactive prop editing

### Theming

Storybook uses the same design tokens as the apps:

- **CSS Variables**: All `--bg-*`, `--text-*`, `--stroke-*` tokens work
- **Tailwind v4**: Full Tailwind utility classes available
- **Dark Mode**: Toggle via toolbar, uses `[data-theme="dark"]`

### Accessibility Testing

The a11y addon is pre-configured:

1. Open any story
2. Click the "Accessibility" tab in the addon panel
3. Review violations, passes, and incomplete checks

### Configuration Files

| File | Purpose |
|------|---------|
| `.storybook/main.ts` | Storybook config (addons, Vite plugins) |
| `.storybook/preview.tsx` | Global decorators, theme setup |
| `.storybook/storybook.css` | Tailwind + design tokens |
| `.storybook/theme.ts` | Green Goods branding for Storybook UI |
| `.storybook/manager.ts` | Applies branding to sidebar |

## Documentation

📖 **[Shared Package Documentation](https://docs.greengoods.app/developer/architecture/monorepo-structure#shared-package)** — Shared utilities and architecture patterns

**Essential Guides:**
- 🏗️ [Hook Architecture](https://docs.greengoods.app/developer/architecture/monorepo-structure#hook-boundary-critical) — All hooks centralized in shared
- 🔄 [State Management](https://docs.greengoods.app/developer/architecture/monorepo-structure#state-management) — Providers, stores, and query patterns
- 📦 [Cross-Package Imports](https://docs.greengoods.app/developer/architecture/monorepo-structure#cross-package-dependencies) — Import boundaries and conventions

**For AI Agents:**
- [CLAUDE.md](/CLAUDE.md) — Primary context file
- [shared.md](/.claude/context/shared.md) — Package-specific patterns
- [Root AGENTS.md](/AGENTS.md) — Quick reference
