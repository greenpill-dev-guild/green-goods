# Admin Package Context

Loaded when working in `packages/admin/`. Extends CLAUDE.md.

**Primary persona**: David (Operator). For tone guidance and UX constraints, see `.claude/context/product.md` § Persona & Tone Quick-Reference.

**Design routing**: surface spec `packages/admin/DESIGN.md` · AI prompt contract `.claude/skills/design/prompt-contract.md` · docs page `docs/docs/builders/packages/admin.mdx`.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun run test` | Run tests (vitest) |
| `bun build` | Build (includes TypeScript check) |
| `bun lint` | Lint with oxlint |
| `bun dev` | Start dev server (via PM2 from root) |

## Contents
- [Architecture](#architecture)
- [Critical Patterns](#critical-patterns)
- [Anti-Patterns](#anti-patterns)
- [Testing Coverage](#testing-coverage)
- [Reference Files](#reference-files)

## Architecture

```
packages/admin/src/
├── components/      # Admin UI components
│   ├── Action/     # Action configuration
│   ├── Assessment/ # Assessment workflow steps
│   ├── Garden/     # Garden management
│   ├── Layout/     # Canvas layout (CanvasRouteFrame, LeftInspectorDialog, ...)
│   ├── Shell/      # Admin-owned shell forks: AppBar, MainSheet, NavigationBar (+ FAB)
│   └── Admin*.tsx  # Top-level admin M3 wrappers (AdminButton, AdminDialog, AdminCard, ...)
├── styles/          # admin-m3-tokens.css (tokens + Controlled Chrome), admin-m3-components.css (admin skins/motion)
├── views/           # Main views (lazy-loaded)
├── routes/          # CanvasShell.tsx + RequireRole.tsx
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

`routes/` contains exactly two route components: `CanvasShell.tsx` (the canvas shell route wrapper) and `RequireRole.tsx` (the role guard). `router.tsx` composes them — check it for the live nesting. The legacy `RequireAuth` / `DashboardShell` / `RequireDeployer` / `RequireOperatorOrDeployer` guards are deleted.

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

### AdminDialog for Modals

`AdminDialog` / `AdminConfirmDialog` are the only admin dialog path: 16px radius, level-2
elevation over the 32% scrim, solid `--admin-surface-0`-family surface, bottom-sheet
presentation on mobile. Pass the mounting workspace's `tone` prop — the portal escapes
`[data-tone]` and the prop re-establishes it. Full-surface creation/commit flows use
`variant="flow"` with `ADMIN_FLOW_DIALOG_CLASS`.

```typescript
import { AdminDialog } from "@/components/AdminDialog";

<AdminDialog open={open} onOpenChange={setOpen} title="Add member" tone="community"
  actions={<AdminButton onClick={handleSubmit}>Save</AdminButton>}>
  {/* form fields */}
</AdminDialog>
```

Raw Radix Dialog is allowed only when neither wrapper fits — and it must still honor the
dialog contract (scrim, pinned actions, accessible title/description, mobile safety).

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
- Route guards: `routes/CanvasShell.tsx`, `routes/RequireRole.tsx`
- Toast action: `@green-goods/shared` → `hooks/app/useToastAction.ts`

## Documentation References (on-demand)

Read these docs pages when you need operator workflow context or garden management details:

- Garden setup guide: `docs/docs/operator/setup-garden.mdx`
- Manage gardeners: `docs/docs/operator/manage-gardeners.mdx`
- Review work submissions: `docs/docs/operator/review-work.mdx`
- Configure actions: `docs/docs/operator/configure-actions.mdx`
- Impact reporting: `docs/docs/operator/impact-reporting.mdx`
- Operator getting started: `docs/docs/operator/getting-started.mdx`
