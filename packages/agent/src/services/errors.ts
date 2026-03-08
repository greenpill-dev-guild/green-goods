/**
 * Agent Error Classes
 *
 * Typed errors for classification in the message router.
 * Enables differentiated logging, status codes, and user-facing messages.
 */

/** User input that fails validation (e.g., invalid address, missing fields). */
export class ValidationError extends Error {
  override readonly name = "ValidationError";
  constructor(message: string) {
    super(message);
  }
}

/** Caller lacks permission for the requested operation. */
export class AuthorizationError extends Error {
  override readonly name = "AuthorizationError";
  constructor(message: string) {
    super(message);
  }
}

/** An external service (AI, IPFS, platform API) failed. */
export class ExternalServiceError extends Error {
  override readonly name = "ExternalServiceError";
  readonly service: string;

  constructor(service: string, message: string) {
    super(message);
    this.service = service;
  }
}

/**
 * Classify an unknown error for structured logging and user-facing responses.
 *
 * Returns a category string and safe user message. The original error
 * is always preserved for logging — only the user message is sanitized.
 */
export function classifyError(error: unknown): {
  category: "validation" | "authorization" | "external_service" | "internal";
  userMessage: string;
  statusCode: number;
} {
  if (error instanceof ValidationError) {
    return {
      category: "validation",
      userMessage: error.message,
      statusCode: 400,
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      category: "authorization",
      userMessage: "You don't have permission for this action.",
      statusCode: 403,
    };
  }

  if (error instanceof ExternalServiceError) {
    return {
      category: "external_service",
      userMessage: `Service temporarily unavailable (${error.service}). Please try again later.`,
      statusCode: 502,
    };
  }

  return {
    category: "internal",
    userMessage: "An unexpected error occurred. Please try again.",
    statusCode: 500,
  };
}
