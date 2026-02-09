/**
 * Validation Error
 *
 * Custom error class for validation/programming errors that indicate
 * a precondition was not met (e.g., missing required parameter).
 * These typically indicate a programming error rather than a runtime condition.
 *
 * @module utils/errors/validation-error
 */

/**
 * Error thrown when a validation precondition is not met.
 * Used to distinguish programming errors from runtime errors.
 *
 * @example
 * ```typescript
 * if (!gardenId) {
 *   throw new ValidationError("gardenId is required for listing hypercerts");
 * }
 * ```
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}
