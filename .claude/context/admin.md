# Admin Package Context

Loaded when working in `packages/admin/`. Extends CLAUDE.md.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun test` | Run tests |
| `bun build` | Build (includes TypeScript check) |
| `bun lint` | Lint with oxlint |
| `bun dev` | Start dev server (via PM2 from root) |

## Architecture

```
packages/admin/src/
├── components/      # Admin UI components
│   ├── Action/     # Action configuration
│   ├── Assessment/ # Assessment workflow steps
│   ├── Garden/     # Garden management
│   └── Layout/     # Dashboard layout
├── views/           # Main views (lazy-loaded)
├── routes/          # Route guards (RequireRole, DashboardShell)
├── config.ts        # Admin configuration
└── router.tsx       # Route configuration
```

**ALL hooks, providers, stores live in `@green-goods/shared`.**

## Critical Patterns

### Role-Based Access Control

Three user roles:

| Role | Access | Source |
|------|--------|--------|
| **Deployer (Admin)** | Full access, create gardens | Hardcoded allowlist |
| **Operator** | Assigned gardens only | Indexer query |
| **User** | Unauthorized | Default |

### useRole Hook

```typescript
import { useRole } from "@green-goods/shared";

const {
  role,           // "deployer" | "operator" | "user"
  isDeployer,     // true if deployer
  isOperator,     // true if operator OR deployer
  operatorGardens, // Gardens this user operates
  loading,
} = useRole();
```

### Permission Checks (MANDATORY)

Always check permissions before actions:

```typescript
import { useGardenPermissions } from "@green-goods/shared";

const permissions = useGardenPermissions();

if (!permissions.canRemoveMembers(garden)) {
  toast.error("Unauthorized");
  return;
}
```

### Route Guards

```typescript
// Route configuration
<Route element={<RequireAuth />}>
  <Route element={<DashboardShell />}>
    {/* Admin-only */}
    <Route element={<RequireDeployer />}>
      <Route path="/deployment" element={<Deployment />} />
    </Route>

    {/* Admin + Operator */}
    <Route element={<RequireOperatorOrDeployer />}>
      <Route path="/gardens" element={<Gardens />} />
    </Route>
  </Route>
</Route>
```

### Toast for All Transactions (MANDATORY)

```typescript
import { useToastAction } from "@green-goods/shared";

const { executeWithToast } = useToastAction();

await executeWithToast(
  () => writeContractAsync({
    address: gardenAccountAddress,
    abi: GardenAccountABI,
    functionName: 'addGardener',
    args: [address],
  }),
  {
    loadingMessage: 'Adding gardener...',
    successMessage: 'Gardener added successfully',
    errorMessage: 'Failed to add gardener',
  }
);
```

### Radix Dialog for Modals

Use Radix Dialog for all admin modals (form-based interactions):

```typescript
import * as Dialog from "@radix-ui/react-dialog";

<Dialog.Root>
  <Dialog.Trigger asChild>
    <button>Add Member</button>
  </Dialog.Trigger>

  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl p-6 max-w-md w-full z-50">
      <Dialog.Title>Add Member</Dialog.Title>
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
      </form>
      <Dialog.Close asChild>
        <button aria-label="Close">✕</button>
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

**Benefits over custom modals:**
- Complete ARIA support
- Focus management built-in
- Portal rendering
- Composable API

### Form Validation with Zod

```typescript
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const createGardenSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(10, 'Description too short'),
  communityToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address'),
  gardeners: z.array(z.string()).min(1, 'At least one gardener required'),
});

const { register, handleSubmit, formState } = useForm({
  resolver: zodResolver(createGardenSchema),
});
```

### Conditional Rendering by Role

```typescript
function GardensList() {
  const { isDeployer, operatorGardens } = useRole();
  const { data: allGardens } = useQuery({
    queryKey: ['gardens'],
    queryFn: getGardens,
    enabled: isDeployer,  // Only fetch all if admin
  });

  const gardensToShow = isDeployer ? allGardens : operatorGardens;

  return (
    <div>
      {isDeployer && <CreateGardenButton />}
      {gardensToShow?.map(garden => <GardenCard key={garden.id} garden={garden} />)}
    </div>
  );
}
```

## Anti-Patterns

### Never Hardcode Permissions

```typescript
// ❌ Wrong
if (address === '0x123...') {
  return <AdminPanel />;
}

// ✅ Correct
const { isDeployer } = useRole();
if (isDeployer) {
  return <AdminPanel />;
}
```

### Never Skip Permission Checks

```typescript
// ❌ Wrong — assuming user has permission
async function removeOperator(gardenId, address) {
  await contract.removeOperator(address);
}

// ✅ Correct — check first
async function removeOperator(garden, address) {
  const permissions = useGardenPermissions();
  if (!permissions.canRemoveMembers(garden)) {
    throw new Error('Unauthorized');
  }
  await contract.removeOperator(address);
}
```

### Never Expose All Data to Operators

```typescript
// ❌ Wrong — showing all gardens to operators
<GardensList gardens={allGardens} />

// ✅ Correct — filter by permission
const { isDeployer, operatorGardens } = useRole();
<GardensList gardens={isDeployer ? allGardens : operatorGardens} />
```

### Never Create Hooks in Admin

```typescript
// ❌ packages/admin/src/hooks/useLocalHook.ts
export function useLocalHook() { ... }

// ✅ Import from shared
import { useRole, useGardenPermissions } from "@green-goods/shared";
```

## Testing Coverage

| Area | Target |
|------|--------|
| Access control | 100% |
| Critical paths | 70%+ |
| Overall | 70%+ |

### Role-Based Testing

```typescript
describe("Gardens View", () => {
  it("shows all gardens for deployer", async () => {
    const { screen } = renderWithProviders(<Gardens />, {
      userRole: "deployer",
    });

    await waitFor(() => {
      expect(screen.getByText("All Gardens")).toBeInTheDocument();
    });
  });

  it("shows only assigned gardens for operator", async () => {
    const { screen } = renderWithProviders(<Gardens />, {
      userRole: "operator",
      operatorGardens: ["garden-1"],
    });

    await waitFor(() => {
      expect(screen.queryByText("Garden 2")).not.toBeInTheDocument();
    });
  });
});
```

## Reference Files

- Role hooks: `@green-goods/shared` → `hooks/gardener/useRole.ts`
- Permission hooks: `@green-goods/shared` → `hooks/garden/useGardenPermissions.ts`
- Route guards: `routes/RequireAuth.tsx`, `RequireDeployer.tsx`, `RequireOperatorOrDeployer.tsx`
- Toast action: `@green-goods/shared` → `hooks/app/useToastAction.ts`
