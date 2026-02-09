# Error Handling

> **Audience:** Developers implementing error handling in Green Goods.
> **Related:** [Shared Package](shared), [Testing Guide](testing)

This guide covers error handling patterns used across Green Goods applications.

---

## Error Categories

All errors are categorized for consistent handling:

| Category | Examples | Recovery Action |
|----------|----------|-----------------|
| `network` | Fetch failed, timeout, disconnected | Retry with backoff, show offline indicator |
| `validation` | Invalid input, schema mismatch | Show form errors, highlight fields |
| `auth` | Session expired, unauthorized | Redirect to login, clear state |
| `permission` | Forbidden, wrong role | Show access denied, suggest action |
| `blockchain` | Tx failed, gas estimation, user rejected | Show failure, offer retry |
| `storage` | IndexedDB full, IPFS upload failed | Prompt cleanup, degrade gracefully |
| `unknown` | Uncategorized errors | Log and show generic message |

---

## Using the Categorization Utility

```typescript
import { categorizeError, type CategorizedError } from '@green-goods/shared';

try {
  await riskyOperation();
} catch (error) {
  const categorized = categorizeError(error);

  logger.error("Operation failed", {
    message: categorized.message,
    category: categorized.category,
    metadata: categorized.metadata,
  });

  switch (categorized.category) {
    case 'network':
      toast.error("Network error. Please check your connection.");
      break;
    case 'auth':
      router.push('/login');
      break;
    case 'permission':
      toast.error("You don't have permission for this action.");
      break;
    case 'blockchain':
      handleBlockchainError(error);
      break;
    default:
      toast.error("Something went wrong. Please try again.");
  }
}
```

---

## User-Friendly Messages

Convert technical errors to user-friendly messages:

```typescript
import { formatUserError, USER_FRIENDLY_ERRORS } from '@green-goods/shared';

try {
  await submitWork();
} catch (error) {
  // Automatically maps to friendly message
  const message = formatUserError(error);
  toast.error(message);
}
```

### Message Mappings

Common error patterns and their user-friendly messages:

| Pattern | User Message |
|---------|--------------|
| `not a gardener` | "You're not a member of this garden. Please join from your profile." |
| `user rejected` | "Transaction cancelled by user" |
| `insufficient funds` | "Insufficient funds for gas" |
| `network` | "Network connection error - your work is saved offline" |
| `offline` | "You're offline - your work will sync when you reconnect" |
| `reverted` | "Transaction would fail. Make sure you're a member of the selected garden." |
| `quota` | "Storage quota exceeded - please free up space" |

---

## Blockchain Errors

### Blockchain Error Types

```typescript
import { getBlockchainErrorInfo, type BlockchainErrorType } from '@green-goods/shared';

type BlockchainErrorType =
  | "userRejected"      // User cancelled in wallet
  | "insufficientFunds" // Not enough ETH for gas
  | "network"           // RPC/connection issue
  | "gasEstimation"     // Gas estimation failed
  | "nonce"             // Nonce conflict
  | "timeout"           // Transaction timeout
  | "unknown";          // Unrecognized error
```

### Handling Blockchain Errors

```typescript
import { getBlockchainErrorInfo, formatWalletError } from '@green-goods/shared';

try {
  await sendTransaction();
} catch (error) {
  const errorInfo = getBlockchainErrorInfo(error);

  if (errorInfo.recoverable) {
    // Show retry button
    toast.error(formatWalletError(error), {
      action: {
        label: 'Retry',
        onClick: () => sendTransaction(),
      },
    });
  } else {
    // Non-recoverable (e.g., insufficient funds)
    toast.error(formatWalletError(error));

    if (errorInfo.suggestedAction === 'addFunds') {
      showAddFundsModal();
    }
  }
}
```

### i18n Keys for Blockchain Errors

Each error type has an i18n key prefix for localized messages:

```typescript
// Example i18n keys
"app.errors.blockchain.userRejected.title"
"app.errors.blockchain.userRejected.message"
"app.errors.blockchain.insufficientFunds.title"
"app.errors.blockchain.insufficientFunds.message"
```

```typescript
import { useTranslation } from '@green-goods/shared';

function BlockchainErrorToast({ errorInfo }) {
  const { t } = useTranslation();

  return (
    <div>
      <h3>{t(`${errorInfo.i18nKeyPrefix}.title`)}</h3>
      <p>{t(`${errorInfo.i18nKeyPrefix}.message`)}</p>
    </div>
  );
}
```

---

## Contract Error Parsing

Parse Solidity revert errors:

```typescript
import { parseContractError, type ParsedContractError } from '@green-goods/shared';

try {
  await contract.write.joinGarden([gardenId]);
} catch (error) {
  const parsed = parseContractError(error);

  console.log(parsed.name);    // "AlreadyGardener"
  console.log(parsed.args);    // ["0x123...", 42n]
  console.log(parsed.message); // "You're already a member of this garden"
}
```

### Common Contract Errors

| Error Name | Meaning | User Message |
|------------|---------|--------------|
| `AlreadyGardener` | User is already a member | "You're already a member of this garden" |
| `NotGardener` | User is not a member | "You're not a member of this garden" |
| `NotOperator` | User lacks operator role | "You don't have operator permissions" |
| `InvalidAction` | Action doesn't exist | "This action is not available" |
| `ActionExpired` | Action is no longer active | "This action has expired" |

---

## Toast Patterns

### Using the Toast Service

```typescript
import { toastService, createWorkToasts } from '@green-goods/shared';

// Create localized toast messages
const workToasts = createWorkToasts(t); // t = translation function

// Show toast by key
toastService.show(workToasts.submitting);  // "Submitting work..."
toastService.show(workToasts.success);     // "Work submitted!"
toastService.show(workToasts.error);       // "Failed to submit work"
```

### Toast Factory Functions

```typescript
import {
  createWorkToasts,
  createApprovalToasts,
  createWalletProgressToasts,
  createValidationToasts,
  createQueueToasts,
} from '@green-goods/shared';

// Work submission toasts
const workToasts = createWorkToasts(t);
workToasts.submitting  // Uploading/processing
workToasts.success     // Work submitted successfully
workToasts.error       // Submission failed
workToasts.offline     // Saved offline, will sync later

// Approval toasts
const approvalToasts = createApprovalToasts(t);
approvalToasts.approving   // Approving work...
approvalToasts.approved    // Work approved!
approvalToasts.rejected    // Work rejected

// Wallet progress toasts
const walletToasts = createWalletProgressToasts(t);
walletToasts.connecting     // Connecting wallet...
walletToasts.signing        // Please sign in your wallet
walletToasts.processing     // Processing transaction...
walletToasts.confirmed      // Transaction confirmed!
```

---

## Never Swallow Errors

**Always log AND handle errors:**

```typescript
// ❌ Wrong — error disappears
try {
  await riskyOp();
} catch (e) {
  // Silent failure - BAD!
}

// ❌ Wrong — only logs, no user feedback
try {
  await riskyOp();
} catch (e) {
  console.error(e);
}

// ✅ Correct — log AND handle
try {
  await riskyOp();
} catch (error) {
  logger.error("Operation failed", { error });
  toast.error(formatUserError(error));
}
```

---

## Error Tracking

Track errors for monitoring with the logger:

```typescript
import {
  logger,
  trackError,
  trackContractError,
  trackNetworkError,
  addBreadcrumb,
} from '@green-goods/shared';

// Add context breadcrumbs
addBreadcrumb({ action: 'submitWork', gardenId: '123' });
addBreadcrumb({ action: 'uploadMedia', fileCount: 3 });

try {
  await submitWork();
} catch (error) {
  // Track with category
  trackContractError(error, {
    operation: 'submitWork',
    gardenId: '123',
  });

  // Also log locally
  logger.error("Work submission failed", {
    error,
    gardenId: '123',
  });
}
```

---

## Error Boundary Pattern

Wrap sections with error boundaries:

```typescript
import { ErrorBoundary } from '@green-goods/shared';

function App() {
  return (
    <ErrorBoundary
      fallback={({ error, reset }) => (
        <div className="p-4 text-center">
          <h2>Something went wrong</h2>
          <p className="text-gray-500">{error.message}</p>
          <button onClick={reset}>Try Again</button>
        </div>
      )}
      onError={(error, info) => {
        trackError(error, { componentStack: info.componentStack });
      }}
    >
      <WorkSubmissionForm />
    </ErrorBoundary>
  );
}
```

---

## Validation Errors

Use the ValidationError class for input validation:

```typescript
import { ValidationError } from '@green-goods/shared';

function validateWorkDraft(draft: WorkDraft) {
  const errors: string[] = [];

  if (!draft.title?.trim()) {
    errors.push('Title is required');
  }
  if (!draft.actionUID) {
    errors.push('Action must be selected');
  }
  if (draft.media.length === 0) {
    errors.push('At least one photo is required');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join('. '));
  }
}
```

---

## Retry Patterns

### Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const categorized = categorizeError(error);

      // Don't retry non-recoverable errors
      if (categorized.category === 'validation' ||
          categorized.category === 'permission') {
        throw error;
      }

      // Wait with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
}
```

### Using in Hooks

```typescript
import { useToastAction } from '@green-goods/shared';

function useSubmitWork() {
  return useToastAction({
    loadingMessage: 'Submitting work...',
    successMessage: 'Work submitted!',
    errorMessage: (error) => formatUserError(error),
    onError: (error) => {
      const categorized = categorizeError(error);
      if (categorized.category === 'network') {
        // Queue for retry
        jobQueue.addJob({ kind: 'WORK_SUBMISSION', ... });
      }
    },
  });
}
```

---

## Related Documentation

- [Shared Package](shared) — Error utilities location
- [Testing Guide](testing) — Testing error scenarios
- [Hypercerts](hypercerts) — Minting error handling
