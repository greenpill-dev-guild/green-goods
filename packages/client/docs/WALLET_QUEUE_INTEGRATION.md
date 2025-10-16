# Future: Wallet + Job Queue Integration

## Current State

As of the current implementation, Green Goods uses **two separate submission paths** based on authentication mode:

### Wallet Users (Direct Transactions)
- Submit work and approvals directly via blockchain transactions
- No job queue involvement
- Online-only operation
- Traditional web3 UX: sign transaction → wait for confirmation
- User pays gas fees

### Passkey Users (Job Queue)
- Submit work and approvals to job queue
- Offline-first with automatic sync
- Pimlico sponsorship for gasless transactions
- PWA-optimized mobile experience

## Architecture Decision

This dual-path approach was chosen for the following reasons:

1. **Different UX expectations**: Wallet users (typically operators) expect traditional web3 workflows, while passkey users (typically gardeners) need offline-first mobile experiences
2. **Simpler implementation**: No need to adapt job processors for wallet clients
3. **Gas handling**: Wallet users pay their own gas (expected), passkey users get sponsored transactions
4. **Maintenance**: Each path can be optimized independently for its target audience

## Future Integration Options

If you want to unify wallet and passkey users on the same infrastructure, here are the recommended approaches:

### Option A: Unified Job Queue (Full Integration)

Enable wallet users to optionally use the job queue for consistency.

**Benefits:**
- Single code path for submissions
- Consistent retry/error handling
- Potential for offline support for wallet users
- Unified monitoring and debugging

**Implementation Steps:**

1. **Update Job Processor Interface**

```typescript
// packages/client/src/modules/job-queue/job-processor.ts

import type { SmartAccountClient } from "permissionless";
import type { WalletClient } from "viem";

// Add wallet client support to processor interface
interface JobProcessor<T, E> {
  encodePayload(payload: T, chainId: number): Promise<E>;
  execute(
    encoded: E,
    meta: Record<string, unknown>,
    client: SmartAccountClient | WalletClient // Updated to accept both
  ): Promise<string>;
}
```

2. **Update Work Processor**

```typescript
// packages/client/src/modules/job-queue/processors/work.ts

import type { SmartAccountClient } from "permissionless";
import type { WalletClient } from "viem";

export const workProcessor: JobProcessor<WorkJobPayload, EncodedWorkData> = {
  async execute(
    encoded: EncodedWorkData,
    _meta: Record<string, unknown>,
    client: SmartAccountClient | WalletClient
  ): Promise<string> {
    const encodedData = encodeFunctionData({ /* ... */ });

    // Branch based on client type
    if ('account' in client && 'sendTransaction' in client) {
      // Smart account client
      const receipt = await (client as SmartAccountClient).sendTransaction({
        to: encoded.easConfig.EAS.address as `0x${string}`,
        value: 0n,
        data: encodedData,
      });
      return receipt;
    } else {
      // Wallet client
      const hash = await (client as WalletClient).sendTransaction({
        to: encoded.easConfig.EAS.address as `0x${string}`,
        value: 0n,
        data: encodedData,
        chain: client.chain,
        account: client.account,
      });
      return hash;
    }
  },
};
```

3. **Update JobProcessor Class**

```typescript
// packages/client/src/modules/job-queue/job-processor.ts

import { getWalletClient } from "@wagmi/core";
import { wagmiConfig } from "@/config/appkit";

class JobProcessor {
  private client: SmartAccountClient | WalletClient | null = null;

  setClient(client: SmartAccountClient | WalletClient) {
    this.client = client;
  }

  async refreshClient(chainId: number) {
    // Try wallet client first
    const walletClient = await getWalletClient(wagmiConfig, { chainId });
    if (walletClient) {
      this.client = walletClient;
      return;
    }

    // Fall back to smart account client
    // ... existing smart account refresh logic
  }
}
```

4. **Update WorkProvider**

```typescript
// packages/client/src/providers/work.tsx

const workMutation = useMutation({
  mutationFn: async ({ draft, images }: { draft: WorkDraft; images: File[] }) => {
    // Always use job queue for both modes
    const { txHash, jobId } = await submitWorkToQueue(
      draft,
      gardenAddress!,
      actionUID!,
      ctxActions,
      chainId,
      images
    );

    // Process inline based on available client
    if (authMode === "wallet") {
      const walletClient = await getWalletClient(wagmiConfig, { chainId });
      if (walletClient) {
        await processWorkJobInlineWithClient(jobId, chainId, walletClient);
      }
    } else if (smartAccountClient) {
      await processWorkJobInline(jobId, chainId, smartAccountClient);
    }

    return txHash;
  },
});
```

5. **Add User Preference Toggle**

```typescript
// packages/client/src/state/useSettingsStore.ts

interface SettingsState {
  useDirectTransactions: boolean; // Wallet users can choose
  setUseDirectTransactions: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  useDirectTransactions: true, // Default for wallet users
  setUseDirectTransactions: (value) => set({ useDirectTransactions: value }),
}));
```

### Option B: Hybrid Approach (Fallback Queue)

Keep direct transactions as default for wallet users, but fall back to queue on errors.

**Benefits:**
- Best of both worlds: fast direct transactions + offline fallback
- No user-visible changes
- Minimal code changes

**Implementation:**

```typescript
// packages/client/src/providers/work.tsx

const workMutation = useMutation({
  mutationFn: async ({ draft, images }: { draft: WorkDraft; images: File[] }) => {
    if (authMode === "wallet") {
      try {
        // Try direct transaction first
        return await submitWorkDirectly(
          draft,
          gardenAddress!,
          actionUID!,
          actionTitle,
          chainId,
          images
        );
      } catch (err: any) {
        // On network error, fall back to queue
        if (err.message?.includes("network")) {
          logger.log("Network error, falling back to queue");
          const { txHash, jobId } = await submitWorkToQueue(
            draft,
            gardenAddress!,
            actionUID!,
            ctxActions,
            chainId,
            images
          );
          return txHash;
        }
        throw err; // Re-throw other errors
      }
    } else {
      // Passkey mode continues using queue
      const { txHash, jobId } = await submitWorkToQueue(/* ... */);
      // ... process inline
      return txHash;
    }
  },
});
```

### Option C: Keep Separate (Current Approach)

Maintain the current dual-path system with clear separation.

**Benefits:**
- Simplest to maintain
- Each path optimized for its use case
- No mixing of concerns
- Clear mental model

**When to choose this:**
- Wallet and passkey users have fundamentally different workflows
- Offline support not needed for wallet users
- Team resources limited for maintaining unified queue

## Recommendation

**Start with Option C (current approach)** and only migrate to Option A or B if:

1. **User feedback** indicates wallet users need offline support
2. **Debugging complexity** increases from having two submission paths
3. **Feature parity** becomes a requirement (e.g., retry logic for wallet users)

The current implementation is **production-ready** and should be evaluated in real-world use before committing to unification.

## Migration Checklist

If you decide to pursue unified job queue (Option A):

- [ ] Add `WalletClient` type to job processor interface
- [ ] Update `workProcessor.execute()` to handle both client types
- [ ] Update `approvalProcessor.execute()` for wallet clients
- [ ] Create helper to detect client type (smart account vs wallet)
- [ ] Add user preference toggle in settings UI
- [ ] Update JobProcessor class to accept both client types
- [ ] Test wallet submissions through queue
- [ ] Test offline → online sync for wallet users
- [ ] Update documentation and agent rules
- [ ] Migrate existing direct submission code to queue

## Code Patterns

### Type Guard for Client Detection

```typescript
import type { SmartAccountClient } from "permissionless";
import type { WalletClient } from "viem";

export function isSmartAccountClient(
  client: SmartAccountClient | WalletClient
): client is SmartAccountClient {
  return 'sendUserOperation' in client;
}

export function isWalletClient(
  client: SmartAccountClient | WalletClient
): client is WalletClient {
  return 'chain' in client && 'account' in client && !('sendUserOperation' in client);
}
```

### Unified Transaction Sending

```typescript
async function sendTransaction(
  client: SmartAccountClient | WalletClient,
  params: { to: `0x${string}`; data: `0x${string}`; value: bigint }
): Promise<`0x${string}`> {
  if (isSmartAccountClient(client)) {
    return await client.sendTransaction(params);
  } else {
    return await client.sendTransaction({
      ...params,
      chain: client.chain,
      account: client.account,
    });
  }
}
```

## Testing Strategy

Before implementing unified queue:

1. **Load test** current dual-path system
2. **Monitor** error rates and retry patterns
3. **Survey** wallet users about offline needs
4. **Benchmark** performance difference between direct vs queue

## References

- Current implementation: `packages/client/src/modules/work/wallet-submission.ts`
- Job queue system: `packages/client/src/modules/job-queue/`
- Work provider: `packages/client/src/providers/work.tsx`
- Authentication: `packages/client/src/providers/auth.tsx`

