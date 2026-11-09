# Admin Package Context

Loaded when working in `packages/admin/`. Extends `packages/admin/AGENTS.md`.

**Primary persona**: Steward. For tone guidance and UX constraints, see `.claude/context/product.md` § Persona & Tone Quick-Reference.

**Design routing**: surface authority `packages/admin/DESIGN.md` · package rules `packages/admin/AGENTS.md` · AI prompt procedure `.claude/skills/design/prompt-contract.md` · public explanation `docs/docs/builders/packages/admin.mdx`.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun run test` | Run tests (vitest) |
| `bun run build` | Build (includes TypeScript check) |
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
│   └── Admin*.tsx  # Top-level admin M3 wrappers (AdminDialog, AdminCard, AdminTextField, ...)
├── styles/          # admin-m3-tokens.css (tokens + Controlled Chrome), admin-m3-components.css (admin skins/motion), admin-layout.css (layout + surface classes; Storybook imports it)
├── views/           # Main views (lazy-loaded)
├── routes/          # CanvasShell.tsx + RequireRole.tsx
├── config.ts        # Admin configuration
└── router.tsx       # Route configuration
```

**ALL hooks, providers, stores live in `@green-goods/shared`.**

## Critical Patterns

### Role-Based Access Control

`useRole` answers three separate questions, and one account can hold any mix of the answers:

| Role | Who | What it opens | Read it as |
|------|-----|---------------|------------|
| **Steward** | An owner or steward of a garden (indexer query) | That garden in the cockpit | `isSteward`, `stewardGardens` |
| **Garden creator** | The deployment registry's owner, or an account on its allowlist | Create Garden, and nothing else | `isDeployer`, `role === "deployer"` |
| **Protocol team** | The registry's owner, or an owner or steward of the Green Goods Community Garden | The protocol's surfaces, such as the Actions workspace and the Campaign Cookie Jars card | `isProtocolTeam` |

The code keeps the name `deployer` for a garden creator; copy, docs, and these guides say
"garden creator", as the Profile does. The list of garden creators is managed from the
**Garden Creators** card on the Community Garden's Community → Coordination tab, by whoever the
registry lets manage it: its owner and the Community Garden's owners and stewards. The card
asks the registry (`useGardenCreators`, which reads `canManageAllowlist`) instead of reading
`isProtocolTeam`. On a registry that answers that read, the card shows exactly when the contract
would accept the change; on an older one the read fails and the card stays hidden, even from the
registry's owner. Being a garden creator never makes an account part of the protocol team.

Evaluators reach the cockpit through `useEligibleAdminGardens`, not `useRole`. It lists the
gardens the account owns, stewards, or evaluates from the base list, which holds a chain's newest
50 gardens; adds owned and stewarded gardens the role query finds beyond it; and adds the
Community Garden for the protocol team. No role sees every garden.

### useRole Hook

```typescript
import { useRole } from "@green-goods/shared/hooks/gardener/useRole";

const {
  role,           // "deployer" | "steward" | "user": the first that applies, in that order
  isDeployer,     // garden creator: may create gardens
  isProtocolTeam, // the registry's owner or a Community Garden owner or steward
  isSteward,      // owns or stewards at least one garden
  stewardGardens, // the gardens this account owns or stewards
  gardensError,   // the steward-gardens read failed: offer a retry, not "no access"
  loading,
} = useRole();
```

Test the flag a surface needs, not `role`: a steward who is also a garden creator has
`role === "deployer"`.

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

`router.tsx` wraps the in-app routes in `routes/CanvasShell.tsx` and takes the route table from `routes/views.tsx`, which places the role guards: `RequireRole` checks `role` (Create Garden takes `["deployer"]`, so only garden creators open it), `RequireProtocolTeam` checks `isProtocolTeam` (the Actions workspace and the `/cookies` redirects), and `RequireCommunityAccess` sends anyone the Community workspace is closed to back to the Hub. Check `views.tsx` for the live nesting. The legacy `RequireAuth` / `DashboardShell` / `RequireDeployer` / `RequireOperatorOrDeployer` guards are deleted.

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
import { Button } from "@green-goods/shared/components/Button";
import { AdminDialog } from "@/components/AdminDialog";

<AdminDialog open={open} onOpenChange={setOpen} title="Add member" tone="community"
  actions={<Button type="button" size="sm" onClick={handleSubmit}>Save</Button>}>
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

Gate a surface on the capability it needs. A protocol surface tests the team and the garden
together, never the garden-creator allowlist:

```typescript
import { useIsProtocolGarden } from "@green-goods/shared/hooks/commitment-pooling/useProtocolPool";
import { useRole } from "@green-goods/shared/hooks/gardener/useRole";
import type { Address } from "@green-goods/shared/types/domain";

const { isProtocolTeam } = useRole();
const { isProtocolGarden } = useIsProtocolGarden({
  chainId: garden.chainId,
  gardenId: garden.id as Address,
});
const showCampaignJars = isProtocolTeam && isProtocolGarden;
```

The Garden Creators card asks the registry instead, so it renders for exactly the accounts that
may change the list:

```typescript
import { useGardenCreators } from "@green-goods/shared/hooks/gardener/useRole";

const creators = useGardenCreators();
if (!creators.canManage) return null;
```

## Anti-Patterns

### Never Hardcode Permissions

```typescript
// ❌ Wrong
if (address === '0x123...') {
  return <CampaignCookieJarPanel />;
}

// ✅ Correct: the team, in the protocol garden (see Conditional Rendering by Role)
const { isProtocolTeam } = useRole();
const { isProtocolGarden } = useIsProtocolGarden({ chainId, gardenId });
if (isProtocolTeam && isProtocolGarden) {
  return <CampaignCookieJarPanel />;
}
```

### Never Skip Permission Checks

```typescript
// ❌ Wrong — assuming user has permission
async function removeSteward(gardenId, address) {
  await contract.removeOperator(address);
}

// ✅ Correct — check first
async function removeSteward(garden, address) {
  const permissions = useGardenPermissions();
  if (!permissions.canRemoveMembers(garden)) {
    throw new Error('Unauthorized');
  }
  await contract.removeOperator(address);
}
```

### Never Expose All Data to Stewards

```typescript
// ❌ Wrong — showing every garden
<GardensList gardens={allGardens} />

// ✅ Correct — only the gardens this account may open
const { eligibleGardens } = useEligibleAdminGardens();
<GardensList gardens={eligibleGardens} />
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

Mock the `useRole` leaf with the flags the surface reads, and flip them per case.
`views/Community/components/CommunityPayoutsTab.test.tsx` is the working example:

```typescript
const access = vi.hoisted(() => ({ isProtocolTeam: false, isProtocolGarden: false }));

vi.mock("@green-goods/shared/hooks/gardener/useRole", () => ({
  useRole: () => ({ isProtocolTeam: access.isProtocolTeam, loading: false }),
}));

vi.mock("@green-goods/shared/hooks/commitment-pooling/useProtocolPool", () => ({
  useIsProtocolGarden: () => ({ isProtocolGarden: access.isProtocolGarden }),
}));

const campaignJars = () => screen.queryByRole("region", { name: "Campaign Cookie Jars" });

it("holds the campaign cookie jars for the team in the protocol garden", () => {
  Object.assign(access, { isProtocolTeam: true, isProtocolGarden: true });
  renderPayouts();

  expect(campaignJars()).toBeInTheDocument();
});

it.each([
  { isProtocolTeam: true, isProtocolGarden: false },
  { isProtocolTeam: false, isProtocolGarden: true },
])("shows no campaign cookie jars elsewhere (%o)", (who) => {
  Object.assign(access, who);
  renderPayouts();

  expect(campaignJars()).not.toBeInTheDocument();
});
```

The Garden Creators card takes its `GardenCreators` value as a prop, so its tests pass
`canManage` and the list directly (`GardenCreatorsCard.test.tsx`).

## Reference Files

- Role hooks: `@green-goods/shared` → `hooks/gardener/useRole.ts`
- Garden creators: `@green-goods/shared` → `hooks/blockchain/useDeploymentRegistry.ts` (`useGardenCreators`); the card is `views/Community/components/GardenCreatorsCard.tsx`
- Permission hooks: `@green-goods/shared` → `hooks/garden/useGardenPermissions.ts`
- Garden scope: `@green-goods/shared` → `hooks/garden/useEligibleAdminGardens.ts`
- Route guards: `routes/views.tsx` (the route table), `routes/RequireRole.tsx`, `routes/RequireProtocolTeam.tsx`, `routes/RequireCommunityAccess.tsx`
- Toast action: `@green-goods/shared` → `hooks/app/useToastAction.ts`

## Documentation References (on-demand)

Read these docs pages when you need steward workflow context or garden management details:

- Garden setup guide: `docs/docs/community/steward-guide/creating-a-garden.mdx`
- Manage gardeners: `docs/docs/community/steward-guide/index.mdx`
- Review work submissions: `docs/docs/community/steward-guide/reviewing-work.mdx`
- Configure actions: `docs/docs/community/steward-guide/managing-actions.mdx`
- Assessment and reporting context: `docs/docs/community/evaluator-guide/making-an-assessment.mdx`
- Steward getting started: `docs/docs/community/steward-guide/index.mdx`
