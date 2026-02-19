---
name: error-handling-patterns
user-invocable: false
description: Robust error handling strategies for graceful failures and debugging. Use for error handling implementations, error flow debugging, error boundaries, retry mechanisms, and user-friendly error messages.
---

# Error Handling Patterns

Build resilient applications with robust error handling that gracefully handles failures.

## Activation

When invoked:
- Classify the error category (network/validation/auth/permission/blockchain/storage).
- Choose a user-facing response (toast, redirect, form error, retry).
- Ensure logging captures actionable context.
- Add or update tests for error paths.

## Part 1: Error Categories

### Recoverable vs Unrecoverable

| Recoverable | Unrecoverable |
|-------------|---------------|
| Network timeout | Out of memory |
| Missing file | Stack overflow |
| Invalid user input | Programming bugs |
| API rate limit | Type errors |

### Green Goods Error Categories

| Category | Examples | Response |
|----------|----------|----------|
| `network` | Fetch failed, timeout | Retry with backoff, show offline |
| `validation` | Invalid input, schema mismatch | Show form errors |
| `auth` | Session expired, unauthorized | Redirect to login |
| `permission` | Forbidden action, wrong role | Show access denied |
| `blockchain` | Tx failed, gas estimation | Show failure, offer retry |
| `storage` | IndexedDB full, quota exceeded | Prompt cleanup |

## Part 2: TypeScript Error Handling

### Error Utility Structure

```
packages/shared/src/utils/errors/
├── extract-message.ts          # extractErrorMessage(), extractErrorMessageOr()
├── categorize-error.ts         # categorizeError() → ErrorCategory
├── contract-errors.ts          # parseContractError(), parseAndFormatError()
├── mutation-error-handler.ts   # createMutationErrorHandler()
├── user-messages.ts            # USER_FRIENDLY_ERRORS mapping
├── blockchain-errors.ts        # Blockchain-specific error handling
├── validation-error.ts         # ValidationError class
└── README.md
```

### ValidationError Class

```typescript
// packages/shared/src/utils/errors/validation-error.ts
import { ValidationError } from "@green-goods/shared";

// Usage: precondition checks for programming errors
if (!gardenId) {
  throw new ValidationError("gardenId is required for listing hypercerts");
}
```

### Error Categorization

```typescript
// packages/shared/src/utils/errors/categorize-error.ts
import { categorizeError } from "@green-goods/shared";
import type { ErrorCategory, CategorizedError } from "@green-goods/shared";

// Categorizes any error by message pattern matching
const { message, category, metadata } = categorizeError(error);
// category: "network" | "validation" | "auth" | "permission" | "blockchain" | "storage" | "unknown"

if (category === "network") {
  toast.error("Network error. Please check your connection.");
} else if (category === "blockchain") {
  toast.error("Transaction failed. Please try again.");
}
```

### Error Message Extraction

```typescript
import { extractErrorMessage, extractErrorMessageOr } from "@green-goods/shared";

// Handles string, Error, or object-with-message gracefully
const msg = extractErrorMessage(error);           // May return ""
const safe = extractErrorMessageOr(error, "Unknown error"); // Fallback guaranteed
```

### Mutation Error Handler (Recommended for Hooks)

```typescript
// packages/shared/src/utils/errors/mutation-error-handler.ts
import { createMutationErrorHandler } from "@green-goods/shared";

const handleError = createMutationErrorHandler({
  source: "useWorkMutation",
  toastContext: "work submission",
  trackError: (error, metadata) => trackContractError(error, metadata),
});

// In TanStack Query mutation
useMutation({
  mutationFn: submitWork,
  onError: (error) => handleError(error, { authMode, gardenAddress }),
});
```

## Part 3: React Error Handling

### Error Boundaries

Green Goods has an `ErrorBoundary` component at `packages/shared/src/components/ErrorBoundary/`.

```typescript
import { ErrorBoundary } from "@green-goods/shared";

// Wrap sections that might throw with a fallback UI
<ErrorBoundary fallback={<ErrorFallback />}>
  <GardenContent />
</ErrorBoundary>
```

### With TanStack Query

```typescript
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

function GardenPage() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <ErrorFallback
              error={error}
              onRetry={resetErrorBoundary}
            />
          )}
        >
          <GardenContent />
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

## Part 4: Contract Error Handling

```typescript
import { parseContractError, USER_FRIENDLY_ERRORS } from "@green-goods/shared";

async function handleTransaction(tx: Promise<TransactionReceipt>) {
  try {
    const receipt = await tx;
    return { success: true, receipt };
  } catch (error) {
    const parsed = parseContractError(error);
    const message = USER_FRIENDLY_ERRORS[parsed.name] || "Transaction failed";

    toastService.show({
      title: message,
      description: parsed.reason,
      variant: "error",
      action: {
        label: "View Details",
        onClick: () => showErrorDetails(parsed),
      },
    });

    return { success: false, error: parsed };
  }
}
```

## Part 5: Retry Patterns

### Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage with categorizeError for retry decisions
import { categorizeError } from "@green-goods/shared";

const result = await withRetry(
  () => fetch("/api/gardens"),
  {
    maxRetries: 3,
    shouldRetry: (error) => categorizeError(error).category === "network",
  }
);
```

## Best Practices

### Do's

1. **Fail fast** — Validate early, fail quickly
2. **Preserve context** — Include stack traces and metadata
3. **Meaningful messages** — Explain what happened
4. **Log appropriately** — Errors warrant logging
5. **Clean up resources** — Use try-finally
6. **Type-safe handling** — Use discriminated unions

### Don'ts

```typescript
// ❌ Never swallow errors
try { await riskyOp(); } catch (e) { }

// ❌ Never catch too broadly
try { /* lots of code */ } catch (e) { console.log("error"); }

// ❌ Never unclear messages
throw new Error("Error");

// ✅ Always log AND handle
try {
  await riskyOp();
} catch (error) {
  logger.error("Operation failed", { error, context });
  toast.error(getUserFriendlyMessage(error));
}

// ✅ Always specific catches using categorizeError
try {
  await submitWork(data);
} catch (error) {
  const { category } = categorizeError(error);
  if (category === "validation") {
    setFormErrors(extractErrorMessage(error));
  } else if (category === "network") {
    queueForRetry(data);
  } else {
    throw error; // Rethrow unexpected errors
  }
}
```

## Part 6: Green Goods Integration

### Toast Service Pattern

```typescript
import { toastService, createWorkToasts } from "@green-goods/shared";
import { useIntl } from "react-intl";

function WorkSubmitButton() {
  const intl = useIntl();
  const workToasts = createWorkToasts(intl.formatMessage);

  const handleSubmit = async () => {
    try {
      toastService.show(workToasts.submitting);
      await submitWork(data);
      toastService.show(workToasts.success);
    } catch (error) {
      toastService.show(workToasts.error(error));
    }
  };
}
```

### Error Categorization

```typescript
// Uses pattern-matching on error messages (not instanceof checks)
import { categorizeError } from "@green-goods/shared";

try {
  await mintHypercert();
} catch (error) {
  const { message, category } = categorizeError(error);
  logger.error("Mint failed", { message, category });

  switch (category) {
    case "network":
      toast.error("Network error. Please check your connection.");
      break;
    case "auth":
      redirectToLogin();
      break;
    case "blockchain":
      toast.error("Transaction failed. Please try again.");
      break;
    default:
      toast.error(message || "An unexpected error occurred");
  }
}
```

## Anti-Patterns

- Swallowing exceptions with empty `catch {}` blocks
- Returning generic errors without category/context metadata
- Retrying non-recoverable errors (validation/permission) indefinitely
- Showing raw blockchain revert messages directly to users
- Logging sensitive values (keys, tokens, proofs) in error payloads

## Related Skills

- `react` — Error boundaries and component-level error handling
- `monitoring` — PostHog error tracking and observability
- `data-layer` — Sync failure categorization and retry patterns
- `web3` — Domain-specific error handling for wallet and blockchain errors (see web3 skill for contract error patterns)
- `tanstack-query` — Query/mutation error handling (see tanstack-query skill for onError patterns)
- `contracts` — Smart contract error parsing (see contracts skill for Solidity revert handling)
- `testing` — Testing error paths and failure scenarios
