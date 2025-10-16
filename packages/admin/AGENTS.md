# Green Goods Admin Dashboard — Architecture Guide

The admin dashboard provides garden management and contract deployment tools for administrators and operators.

## Architecture Overview

```
src/
├── components/      # UI components
│   ├── Garden/     # Garden management components
│   ├── Layout/     # Navigation and layout
│   └── ui/         # Generic UI components
├── hooks/           # Custom hooks (useRole, useGardenOperations)
├── providers/       # React context (AuthProvider)
├── stores/          # Zustand state (useAdminStore)
├── workflows/       # XState state machines
├── views/           # Main views (Dashboard, Gardens, Deployment)
├── types/           # TypeScript definitions
└── utils/           # Utilities (contracts, urql)
```

## Core Functionality

### 1. Role-Based Access Control

**Three user roles:**
- **Deployer (Admin):** Full access via allowlist
- **Operator:** Garden-specific access via indexer
- **User:** Unauthorized (read-only or redirected)

**Role detection:**
```typescript
const { role, isDeployer, isOperator, operatorGardens } = useRole();

// Access patterns
if (isDeployer) {
  // Show all gardens, enable garden creation
}
if (isOperator) {
  // Show operator gardens only, enable member management
}
```

**See:** `.cursor/rules/access-control.mdc`

### 2. Garden Management

**Admin features:**
- Create gardens (deployers only)
- Add/remove gardeners and operators
- Update garden metadata
- View garden statistics

**Files:**
- Create modal: `src/components/Garden/CreateGardenModal.tsx`
- Member modal: `src/components/Garden/AddMemberModal.tsx`
- Operations hook: `src/hooks/useGardenOperations.ts`
- Detail view: `src/views/Gardens/Detail.tsx`

### 3. Contract Deployment

**Deployer-only feature:**
- View deployed contracts
- Deploy new contracts
- Verify contracts on explorer

**Files:**
- View: `src/views/Deployment/index.tsx`
- Contracts view: `src/views/Contracts/index.tsx`

### 4. Real-Time Updates

**Urql subscriptions:**
- Garden creation events
- Operator/gardener additions
- Contract deployments

**See:** `.cursor/rules/graphql-integration.mdc`

## State Management

### Zustand Store (useAdminStore)

Global state:
- Selected chain ID
- Selected garden
- Pending transactions
- Sidebar open/closed

### XState Workflows

Complex flows with retry logic:
- Garden creation workflow
- Contract deployment workflow

**See:** `.cursor/rules/state-workflows.mdc`

## Key Patterns

### 1. Toast Notifications for All Transactions

**MANDATORY:** Wrap all contract calls with `useToastAction`:

```typescript
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

### 3. Optimistic UI Updates

```typescript
// Update UI immediately, invalidate after confirmation
await writeContractAsync({/*...*/});

// Optimistic update
setGardens(prev => prev.filter(g => g.id !== gardenId));

// Confirm with query invalidation
queryClient.invalidateQueries({ queryKey: ['gardens'] });
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

**See:** `.cursor/rules/testing.mdc`

## Tech Stack

- **UI:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **State:** Zustand + XState
- **GraphQL:** Urql with subscriptions
- **Blockchain:** Viem + Wagmi
- **Forms:** React Hook Form + Zod
- **Routing:** React Router v7

## Common Tasks

### Adding Admin Feature

1. Check role requirements (deployer vs operator)
2. Create component in `src/components/` or `src/views/`
3. Add route in `App.tsx` with `<RequireRole>`
4. Use `useToastAction` for blockchain calls
5. Add integration test
6. Update admin AGENTS.md if establishing new pattern

### Adding Garden Operation

1. Add function to `hooks/useGardenOperations.ts`
2. Add permission check to `hooks/useGardenPermissions.ts`
3. Create modal/form component if needed
4. Use `executeWithToast` for transaction
5. Add test for authorized and unauthorized cases

## MCP Integration

```bash
# Feature tracking
@github: Create issue "Add bulk gardener import feature" with label admin

# Deployment tracking
@github: Create issue "Deploy admin dashboard to Vercel" with label deployment
```

## Deep Dive Rules

- **Access Control:** `.cursor/rules/access-control.mdc`
- **State & Workflows:** `.cursor/rules/state-workflows.mdc`
- **GraphQL:** `.cursor/rules/graphql-integration.mdc`
- **Components:** `.cursor/rules/component-workflows.mdc`
- **Testing:** `.cursor/rules/testing.mdc`

## Reference Documentation

- Admin README: `/packages/admin/README.md`
- Root guide: `/AGENTS.md`

