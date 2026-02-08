---
name: error-handling-patterns
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

## Error Categories

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

## TypeScript Error Handling

### Custom Error Classes

```typescript
// packages/shared/src/utils/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly fields: Record<string, string>) {
    super(message, "VALIDATION_ERROR", 400, { fields });
    this.name = "ValidationError";
  }
}

export class NetworkError extends AppError {
  constructor(message: string, public readonly retryable: boolean = true) {
    super(message, "NETWORK_ERROR", 503, { retryable });
    this.name = "NetworkError";
  }
}
```

### Result Type Pattern

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function submitWork(data: WorkData): Promise<Result<Work, AppError>> {
  try {
    const work = await api.submitWork(data);
    return { success: true, data: work };
  } catch (error) {
    if (error instanceof NetworkError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new AppError("Unknown error", "UNKNOWN", 500),
    };
  }
}

// Usage with toast presets
import { toastService, createWorkToasts } from "@green-goods/shared";
import { useIntl } from "react-intl";

const intl = useIntl();
const workToasts = createWorkToasts(intl.formatMessage);

const result = await submitWork(data);
if (result.success) {
  toastService.show(workToasts.success);
} else {
  toastService.show(workToasts.error(result.error.message));
}
```

## React Error Handling

### Error Boundaries

```typescript
// packages/shared/src/components/ErrorBoundary.tsx
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode | ((error: Error) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      return typeof fallback === "function"
        ? fallback(this.state.error!)
        : fallback;
    }
    return this.props.children;
  }
}
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

## Contract Error Handling

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

## Retry Patterns

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

// Usage
const result = await withRetry(
  () => fetch("/api/gardens"),
  {
    maxRetries: 3,
    shouldRetry: (error) => error instanceof NetworkError && error.retryable,
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

// ✅ Always specific catches
try {
  await submitWork(data);
} catch (error) {
  if (error instanceof ValidationError) {
    setFormErrors(error.fields);
  } else if (error instanceof NetworkError) {
    queueForRetry(data);
  } else {
    throw error; // Rethrow unexpected errors
  }
}
```

## Green Goods Integration

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
function categorizeError(error: unknown): ErrorCategory {
  if (error instanceof NetworkError) return "network";
  if (error instanceof ValidationError) return "validation";
  if (error instanceof AuthError) return "auth";
  if (isContractError(error)) return "blockchain";
  return "unknown";
}

function getRecoveryAction(category: ErrorCategory) {
  switch (category) {
    case "network": return { label: "Retry", action: retry };
    case "auth": return { label: "Login", action: redirectToLogin };
    case "blockchain": return { label: "Try Again", action: retry };
    default: return { label: "Dismiss", action: dismiss };
  }
}
```
