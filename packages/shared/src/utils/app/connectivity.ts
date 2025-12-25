/**
 * Connectivity utilities for handling poor network conditions
 * and implementing retry logic with exponential backoff.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay in milliseconds */
  baseDelay?: number;
  /** Maximum delay cap in milliseconds */
  maxDelay?: number;
  /** Optional callback on each retry */
  onRetry?: (attempt: number, error: Error) => void;
  /** Optional abort signal */
  signal?: AbortSignal;
}

/**
 * Executes an async function with exponential backoff retry logic.
 * 
 * @example
 * ```ts
 * const result = await retryWithBackoff(
 *   () => fetchData(),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    onRetry,
    signal,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if aborted
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on abort
      if (lastError.name === "AbortError") {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        
        // Add jitter (±20%) to prevent thundering herd
        const jitter = delay * 0.2 * (Math.random() - 0.5);
        const finalDelay = Math.round(delay + jitter);

        onRetry?.(attempt + 1, lastError);

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, finalDelay);
          
          // Handle abort during delay
          if (signal) {
            const onAbort = () => {
              clearTimeout(timeout);
              reject(new DOMException("Aborted", "AbortError"));
            };
            signal.addEventListener("abort", onAbort, { once: true });
          }
        });
      }
    }
  }

  throw lastError;
}

export interface ScheduleValidationOptions {
  /** Initial delay before first check (ms) */
  initialDelay?: number;
  /** Maximum number of validation attempts */
  maxAttempts?: number;
  /** Multiplier for exponential delay growth */
  multiplier?: number;
}

/**
 * Schedules multiple validation attempts with exponential backoff.
 * Useful for validating optimistic updates after a mutation.
 * 
 * Returns a cleanup function to cancel pending validations.
 * 
 * @example
 * ```ts
 * const cleanup = scheduleValidation(
 *   () => queryClient.invalidateQueries({ queryKey: ['gardens'] }),
 *   { initialDelay: 2000, maxAttempts: 4 }
 * );
 * 
 * // Later, to cancel:
 * cleanup();
 * ```
 */
export function scheduleValidation(
  validate: () => void,
  options: ScheduleValidationOptions = {}
): () => void {
  const { initialDelay = 2000, maxAttempts = 4, multiplier = 2 } = options;
  const timeouts: ReturnType<typeof setTimeout>[] = [];

  for (let i = 0; i < maxAttempts; i++) {
    const delay = initialDelay * Math.pow(multiplier, i);
    timeouts.push(setTimeout(validate, delay));
  }

  // Return cleanup function
  return () => {
    timeouts.forEach(clearTimeout);
  };
}

/**
 * Creates a promise that resolves when the browser comes back online.
 * Times out after the specified duration.
 * 
 * @param timeoutMs - Maximum time to wait for connectivity (default: 30000ms)
 */
export function waitForOnline(timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already online
    if (navigator.onLine) {
      resolve();
      return;
    }

    const cleanup = () => {
      window.removeEventListener("online", handleOnline);
      clearTimeout(timeout);
    };

    const handleOnline = () => {
      cleanup();
      resolve();
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout waiting for network connection"));
    }, timeoutMs);

    window.addEventListener("online", handleOnline);
  });
}

/**
 * Checks if the current error is a network-related error.
 * Useful for deciding whether to retry.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    return (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("failed to fetch") ||
      message.includes("timeout") ||
      message.includes("offline") ||
      name.includes("network") ||
      name === "typeerror" // fetch throws TypeError on network failure
    );
  }
  return false;
}

/**
 * Determines if an error is retryable based on HTTP status codes.
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors are retryable
  if (isNetworkError(error)) return true;

  // Check for status code in error
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    
    // 408 Request Timeout
    // 429 Too Many Requests
    // 500+ Server Errors (except 501 Not Implemented)
    return status === 408 || status === 429 || (status >= 500 && status !== 501);
  }

  return false;
}
