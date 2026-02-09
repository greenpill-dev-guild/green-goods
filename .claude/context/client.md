# Client Package Context

Loaded when working in `packages/client/`. Extends CLAUDE.md.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun test` | Run tests |
| `bun build` | Build (includes TypeScript check) |
| `bun lint` | Lint with oxlint |
| `bun dev` | Start dev server (via PM2 from root) |

## Architecture

```
packages/client/src/
├── components/      # UI components (cards, forms, dialogs)
├── views/           # Route views (lazy-loaded)
├── routes/          # Route guards (RequireAuth, AppShell)
├── styles/          # CSS (colors, typography, animation)
└── config.ts        # Client configuration
```

**ALL hooks, providers, stores live in `@green-goods/shared`.**

## Critical Patterns

### Offline-First Architecture (MANDATORY)

**Never poll. Use event-driven updates:**

```typescript
// ✅ Correct — event-driven
import { useJobQueueEvents, queryKeys } from "@green-goods/shared";

useJobQueueEvents(["job:completed"], () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
});

// ❌ Wrong — polling
setInterval(() => queryClient.invalidateQueries(), 5000);
```

### Job Queue for Work Submission

All work submissions go through the job queue for offline support:

```typescript
import { submitWorkToQueue, processWorkJobInline } from "@green-goods/shared";

const handleSubmit = async () => {
  // 1. Validate
  const errors = validateWorkDraft(draft, gardenAddress, actionUID, images);
  if (errors.length > 0) {
    toast.error(errors[0]);
    return;
  }

  // 2. Add to queue (persists to IndexedDB)
  const { txHash, jobId } = await submitWorkToQueue(
    draft, gardenAddress, actionUID, actions, DEFAULT_CHAIN_ID, images
  );

  // 3. Auto-process if client available
  if (smartAccountClient) {
    try {
      await processWorkJobInline(jobId, chainId, smartAccountClient);
    } catch {
      // Job remains queued for later
    }
  }

  // 4. Navigate
  navigate("/home");
  sessionStorage.setItem("openWorkDashboard", "true");
};
```

### Media URL Management (MANDATORY)

**Never create orphan blob URLs:**

```typescript
import { mediaResourceManager } from "@green-goods/shared";

// ✅ Correct — tracked URLs
const url = mediaResourceManager.getOrCreateUrl(file, "work-draft");

// Cleanup on unmount
useEffect(() => {
  return () => mediaResourceManager.cleanupUrls("work-draft");
}, []);

// ❌ Wrong — orphan URLs cause memory leaks
const url = URL.createObjectURL(file);
setImageUrl(url);
// Never revoked → memory leak
```

**Tracking IDs:**
- `work-draft` — Work form images
- `job-{jobId}` — Job-specific images

### Passkey-First Authentication

```typescript
import { useAuth } from "@green-goods/shared";

const {
  authMode,           // "passkey" | "wallet" | null
  isAuthenticated,
  isReady,
  loginWithPasskey,
  loginWithWallet,
  signOut,
  smartAccountClient, // Passkey mode only
  smartAccountAddress,// Passkey mode only
  eoaAddress,         // Wallet mode only
} = useAuth();
```

### Auth Mode Branching

```typescript
const { authMode, smartAccountClient } = useAuth();

if (authMode === "wallet") {
  // Direct wallet transaction
  await submitWorkDirectly(draft, gardenAddress, actionUID);
} else {
  // Passkey — use job queue
  const { txHash, jobId } = await submitWorkToQueue(draft, gardenAddress, actionUID);
  if (smartAccountClient) {
    await processWorkJobInline(jobId, chainId, smartAccountClient);
  }
}
```

### Route Guards

```typescript
// RequireAuth.tsx
export default function RequireAuth() {
  const { isAuthenticated, isReady } = useAuth();

  if (!isReady) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

### Toast Patterns for Jobs

Use consistent toast IDs for job status updates:

```typescript
// Loading → Success/Error replacement
toast.loading("Uploading work...", { id: `job-${jobId}` });
// Later:
toast.success("Work uploaded!", { id: `job-${jobId}` });
// Or:
toast.error("Upload failed", { id: `job-${jobId}` });
```

### Card Components

```typescript
// StatusBadge for work states
import { StatusBadge } from "@green-goods/shared";

<StatusBadge status="pending" />   // warning (orange)
<StatusBadge status="approved" />  // success (green)
<StatusBadge status="rejected" />  // error (red)
<StatusBadge status="syncing" />   // info (blue) + spinner
```

### Radix Dialog for Modals

Use Radix Dialog for complex modals (not native popover):

```typescript
import * as Dialog from "@radix-ui/react-dialog";

<Dialog.Root>
  <Dialog.Trigger>Add Member</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <Dialog.Title>Add Member</Dialog.Title>
      {/* Content */}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

**When to use native popover vs Radix:**
- `popover="hint"` — Tooltips, simple hints
- `popover="auto"` — Dropdowns, menus
- Radix Dialog — Forms, confirmations, multi-step flows

## Anti-Patterns

### Never Create Hooks in Client

```typescript
// ❌ packages/client/src/hooks/useLocalHook.ts
export function useLocalHook() { ... }

// ✅ Import from shared
import { useHook } from "@green-goods/shared";
```

### Never Use Wallet Chain ID

```typescript
// ❌ Wrong — wallet chain can differ
const { chainId } = useAccount();

// ✅ Correct — always use environment chain
import { DEFAULT_CHAIN_ID } from "@green-goods/shared";
```

### Never Skip isReady Check

```typescript
// ❌ Wrong — smartAccountClient might be null
const { smartAccountClient } = useAuth();
await smartAccountClient.sendTransaction({...});

// ✅ Correct — guard with isReady
const { smartAccountClient, isReady } = useAuth();
if (!isReady || !smartAccountClient) return;
await smartAccountClient.sendTransaction({...});
```

### Never Create Orphan Blob URLs

```typescript
// ❌ Memory leak
const url = URL.createObjectURL(file);

// ✅ Use MediaResourceManager
const url = mediaResourceManager.getOrCreateUrl(file, "tracking-id");
```

## Common Mistakes

| Mistake | Why It Fails | Solution |
|---------|--------------|----------|
| Polling for sync status | Wastes resources | Use `useJobQueueEvents` |
| Empty sync toasts | Confusing UX | Guard: `if (pendingCount > 0)` |
| Direct transaction without auth check | Passkey users need job queue | Check `authMode` first |
| Creating orphan blob URLs | Memory leaks | Use `mediaResourceManager` |
| Not cleaning up on unmount | Memory leaks | Return cleanup in `useEffect` |

## Sync Triggers

Jobs sync automatically on:
1. **Online event** — Browser reconnects
2. **Inline processing** — Smart account client available
3. **Service worker** — Background sync message
4. **Manual flush** — User action from WorkDashboard

## Form Accessibility (MANDATORY)

```typescript
// ✅ Correct — proper label association
<div className="space-y-1">
  <label htmlFor={inputId} className="font-semibold text-text-strong">
    {label}
    {required && <span className="sr-only">(required)</span>}
  </label>
  <input
    id={inputId}
    aria-describedby={error ? `${inputId}-error` : undefined}
    aria-invalid={!!error}
    aria-required={required}
  />
  {error && (
    <p id={`${inputId}-error`} role="alert" className="text-xs text-error-base">
      {error}
    </p>
  )}
</div>
```

## Testing Coverage

| Area | Target |
|------|--------|
| Critical paths | 80%+ |
| Overall | 70%+ |
| Offline queue | 80%+ |
| Auth flows | 100% |

## Reference Files

- Job Queue: `@green-goods/shared` → `modules/job-queue/`
- Work submission: `@green-goods/shared` → `modules/work/`
- Auth Provider: `@green-goods/shared` → `providers/Auth.tsx`
- Shared hooks: `@green-goods/shared` → `hooks/`
