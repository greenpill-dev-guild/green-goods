# Green Goods Admin Dashboard — Architecture Guide

The admin dashboard provides garden management and contract deployment tools for administrators and operators.

## Architecture Overview

```
src/
├── components/      # Admin-specific UI components
│   ├── Action/     # Action configuration components
│   ├── Assessment/ # Assessment workflow steps
│   ├── Form/       # Form layout and wizard components
│   ├── Garden/     # Garden management (create, invite, members)
│   ├── Layout/     # Dashboard layout (Header, Sidebar, etc.)
│   └── Work/       # Work display components
├── views/           # Main views
│   ├── Actions/    # Action management
│   ├── Contracts/  # Contract deployment status
│   ├── Dashboard/  # Main dashboard
│   ├── Deployment/ # Contract deployment
│   ├── Gardens/    # Garden management
│   └── Login/      # Authentication
├── routes/          # Route guards
│   ├── DashboardShell.tsx     # Dashboard wrapper
│   ├── RequireAuth.tsx        # Auth guard
│   ├── RequireDeployer.tsx    # Deployer role guard
│   ├── RequireOperatorOrDeployer.tsx
│   ├── RequireRole.tsx        # Generic role guard
│   └── Root.tsx               # Root layout
├── config.ts        # Admin configuration
└── router.tsx       # React Router configuration
```

**Important:** Core logic (hooks, providers, stores, workflows) lives in `@green-goods/shared`. See `/packages/shared/AGENTS.md` for details.

## Core Functionality

### 1. Role-Based Access Control

**Three user roles:**
- **Deployer (Admin):** Full access via allowlist
- **Operator:** Garden-specific access via indexer
- **User:** Unauthorized (read-only or redirected)

**Role detection:**
```typescript
import { useRole } from '@green-goods/shared';

const { role, isDeployer, isOperator, operatorGardens } = useRole();

// Access patterns
if (isDeployer) {
  // Show all gardens, enable garden creation
}
if (isOperator) {
  // Show operator gardens only, enable member management
}
```

### 2. Garden Management

**Admin features:**
- Create gardens (deployers only)
- Add/remove gardeners and operators
- Update garden metadata
- View garden statistics

**Files:**
- Create wizard: `src/views/Gardens/CreateGarden.tsx`
- Create steps: `src/components/Garden/CreateGardenSteps/`
- Member modal: `src/components/Garden/MembersModal.tsx`
- Invite modal: `src/components/Garden/CreateInviteModal.tsx`
- Detail view: `src/views/Gardens/Garden/Detail.tsx`

### 3. Contract Deployment

**Deployer-only feature:**
- View deployed contracts
- Deploy new contracts
- Verify contracts on explorer

**Files:**
- Deployment view: `src/views/Deployment/index.tsx`
- Contracts view: `src/views/Contracts/index.tsx`

### 4. Action Management

**Admin features:**
- Create and edit actions
- Configure action details, media requirements, review settings

**Files:**
- Actions list: `src/views/Actions/index.tsx`
- Create action: `src/views/Actions/CreateAction.tsx`
- Edit action: `src/views/Actions/EditAction.tsx`
- Action detail: `src/views/Actions/ActionDetail.tsx`

## Imports from Shared Package

```typescript
// Hooks
import { 
  useRole, useGardenOperations, useGardenPermissions,
  useDeploymentRegistry, useGardens, useActions,
  useToastAction, queryKeys 
} from '@green-goods/shared';

// Providers (used in main.tsx)
import { 
  AppKitProvider, AuthProvider, AppProvider 
} from '@green-goods/shared';

// Stores
import { 
  useAdminStore, useCreateGardenStore, useUIStore 
} from '@green-goods/shared';

// Workflows
import { createGardenMachine, createAssessmentMachine } from '@green-goods/shared';

// Config
import { DEFAULT_CHAIN_ID, getNetworkConfig } from '@green-goods/shared';

// Types
import type { Garden, Action, UserRole } from '@green-goods/shared';
```

## State Management

### Zustand Store (useAdminStore)

From `@green-goods/shared`:
- Selected chain ID
- Selected garden
- Pending transactions
- Sidebar open/closed

```typescript
import { useAdminStore } from '@green-goods/shared';

const { selectedGarden, setSelectedGarden } = useAdminStore();
```

### XState Workflows

Complex flows with retry logic from `@green-goods/shared`:
- Garden creation workflow
- Assessment creation workflow

```typescript
import { createGardenMachine } from '@green-goods/shared';
import { useMachine } from '@xstate/react';

const [state, send] = useMachine(createGardenMachine);
```

## Theme System

### CSS Variables-Based Theming

The admin dashboard uses semantic CSS variable tokens for all styling:

**Core principle:** Use semantic tokens that adapt to light/dark mode automatically.

```typescript
// ✅ Correct - Semantic tokens
<div className="bg-bg-white text-text-strong border border-stroke-soft">

// ❌ Wrong - Hardcoded colors
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
```

### Token Categories

**Background tokens:**
- `bg-white` - Primary backgrounds (inverts in dark mode)
- `bg-weak` - Subtle backgrounds
- `bg-soft` - Soft backgrounds
- `bg-surface` - Surface backgrounds

**Text tokens:**
- `text-strong` - Primary text
- `text-sub` - Secondary text
- `text-soft` - Tertiary text
- `text-disabled` - Disabled text

**Border tokens:**
- `border-stroke-soft` - Soft borders
- `border-stroke-sub` - Medium borders

**State tokens:**
- `success-*` (green) - Success states, approval badges
- `error-*` (red) - Error states, validation errors, remove actions
- `warning-*` (orange) - Warning states, pending statuses
- `information-*` (blue) - Information states, help text

## Key Patterns

### 1. Toast Notifications for All Transactions

**MANDATORY:** Wrap all contract calls with `useToastAction`:

```typescript
import { useToastAction } from '@green-goods/shared';

const { executeWithToast } = useToastAction();

await executeWithToast(
  () => writeContractAsync({/*...*/}),
  {
    loadingMessage: 'Processing...',
    successMessage: 'Success!',
    errorMessage: 'Failed',
  }
);
```

### 2. Permission Checks Before Actions

```typescript
import { useGardenPermissions } from '@green-goods/shared';

const permissions = useGardenPermissions();

const handleRemoveOperator = async (garden: Garden, address: string) => {
  if (!permissions.canRemoveMembers(garden)) {
    toast.error('Unauthorized');
    return;
  }
  
  await executeWithToast(
    () => removeOperator(garden.id, address),
    { successMessage: 'Operator removed' }
  );
};
```

### 3. Role-Based Route Protection

```tsx
// router.tsx
<Route element={<RequireAuth />}>
  <Route element={<DashboardShell />}>
    {/* Admin-only routes */}
    <Route element={<RequireDeployer />}>
      <Route path="/deployment" element={<Deployment />} />
      <Route path="/contracts" element={<Contracts />} />
    </Route>
    
    {/* Admin + Operator routes */}
    <Route element={<RequireOperatorOrDeployer />}>
      <Route path="/gardens" element={<Gardens />} />
      <Route path="/gardens/:id/*" element={<GardenDetail />} />
    </Route>
  </Route>
</Route>
```

## Testing Strategy

### Integration Test Focus

Admin tests emphasize end-to-end workflows:

```typescript
it('admin can create garden and add members', async () => {
  const { user } = renderWithProviders(<App />, { userRole: 'admin' });
  
  // Create garden
  await user.click(screen.getByText('Create Garden'));
  await user.type(screen.getByLabelText('Name'), 'Test Garden');
  await user.click(screen.getByText('Submit'));
  
  // Add gardener
  await user.click(screen.getByText('Add Gardener'));
  await user.type(screen.getByLabelText('Address'), '0x...');
  await user.click(screen.getByText('Add'));
  
  // Verify
  expect(screen.getByText('Test Garden')).toBeInTheDocument();
});
```

## Tech Stack

- **UI:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **State:** Zustand + XState (from `@green-goods/shared`)
- **GraphQL:** Urql with subscriptions
- **Blockchain:** Viem + Wagmi
- **Forms:** React Hook Form + Zod
- **Routing:** React Router v7

## Common Tasks

### Adding Admin Feature

1. Check role requirements (deployer vs operator)
2. Create component in `src/components/` or `src/views/`
3. Add route in `router.tsx` with appropriate guard (`RequireDeployer`, `RequireOperatorOrDeployer`)
4. Import hooks from `@green-goods/shared`
5. Use `useToastAction` for blockchain calls
6. Add integration test
7. Update admin AGENTS.md if establishing new pattern

### Adding Garden Operation

1. Use `useGardenOperations` from `@green-goods/shared`
2. Check permissions with `useGardenPermissions`
3. Create modal/form component if needed
4. Use `executeWithToast` for transaction
5. Add test for authorized and unauthorized cases

## Deep Dive Rules

- **Access Control:** `.cursor/rules/access-control.mdc`
- **State & Workflows:** `.cursor/rules/state-workflows.mdc`
- **GraphQL:** `.cursor/rules/graphql-integration.mdc`
- **Components:** `.cursor/rules/component-workflows.mdc`
- **Testing:** `.cursor/rules/testing.mdc`

## Reference Documentation

- Admin README: `/packages/admin/README.md`
- Shared AGENTS.md: `/packages/shared/AGENTS.md`
- Root guide: `/AGENTS.md`
