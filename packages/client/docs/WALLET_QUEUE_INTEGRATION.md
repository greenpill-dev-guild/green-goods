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

1. **Extend the processing context**

```typescript
// packages/shared/src/modules/job-queue/index.ts

interface ProcessJobContext {
  smartAccountClient: SmartAccountClient | null;
  walletClient?: WalletClient | null; // add optional wallet client
}
```

2. **Branch inside `executeWorkJob` / `executeApprovalJob`**

```typescript
// packages/shared/src/modules/job-queue/index.ts

async function executeWorkJob(
  jobId: string,
  job: Job<WorkJobPayload>,
  chainId: number,
  context: ProcessJobContext
): Promise<string> {
  if (context.walletClient) {
    return await submitWorkDirectly(
      job.payload as WorkDraft,
      (job.payload as WorkJobPayload).gardenAddress,
      (job.payload as WorkJobPayload).actionUID,
      (job.payload as WorkJobPayload).title ?? "Unknown Action",
      chainId,
      images
    );
  }

  if (!context.smartAccountClient) {
    throw new Error("No client available for processing");
  }

  return await submitWorkWithPasskey({
    client: context.smartAccountClient,
    /* existing params */
  });
}
```

3. **Update `jobQueue.processJob` calls**

Pass the appropriate client from the provider:

```typescript
// packages/shared/src/providers/work.tsx

const result = await jobQueue.processJob(jobId, {
  smartAccountClient,
  walletClient,
});
```

4. **Optionally surface a user toggle** so wallet users can choose between direct transactions and queued submissions (existing Zustand settings store is a good fit).

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
          const { txHash, jobId } = await submitWorkToQueue(
            draft,
            gardenAddress!,
            actionUID!,
            ctxActions,
            chainId,
            images
          );

          if (navigator.onLine && smartAccountClient) {
            await jobQueue.processJob(jobId, { smartAccountClient });
          }

          return txHash;
        }
        throw err; // Re-throw other errors
      }
    } else {
      // Passkey mode continues using queue
      const { txHash, jobId } = await submitWorkToQueue(
        draft,
        gardenAddress!,
        actionUID!,
        ctxActions,
        chainId,
        images
      );

      if (navigator.onLine && smartAccountClient) {
        await jobQueue.processJob(jobId, { smartAccountClient });
      }

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
