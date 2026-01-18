import React, { Component, Suspense, type ReactNode, type ErrorInfo } from "react";
import { cn } from "@green-goods/shared";
import { Spinner } from "@green-goods/shared/components";

/**
 * Error types that can be caught by SuspenseBoundary
 */
type SuspenseErrorType = "network" | "timeout" | "unknown";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorType: SuspenseErrorType;
}

interface ErrorFallbackProps {
  error: Error | null;
  errorType: SuspenseErrorType;
  resetError: () => void;
}

export interface SuspenseBoundaryProps {
  children: ReactNode;
  /**
   * Fallback to show while suspending (loading state)
   * Defaults to a centered spinner
   */
  fallback?: ReactNode;
  /**
   * Custom error fallback component
   * If not provided, uses a default error UI
   */
  errorFallback?: React.ComponentType<ErrorFallbackProps>;
  /**
   * Called when an error is caught
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /**
   * Called when the boundary is reset
   */
  onReset?: () => void;
  /**
   * Additional className for the container
   */
  className?: string;
  /**
   * ID for the boundary (useful for debugging)
   */
  boundaryId?: string;
}

/**
 * Determines the type of error for better UI feedback
 */
function categorizeError(error: Error): SuspenseErrorType {
  const message = error.message.toLowerCase();

  // Check timeout explicitly first (more specific than network)
  if (message.includes("timeout")) {
    return "timeout";
  }

  const networkPatterns = [
    "network error",
    "fetch failed",
    "failed to fetch",
    "network request failed",
    "net::err",
    "connection refused",
    "econnrefused",
    "offline",
  ];

  for (const pattern of networkPatterns) {
    if (message.includes(pattern)) {
      return "network";
    }
  }

  return "unknown";
}

/**
 * Default loading fallback - centered spinner
 */
export const DefaultSuspenseFallback: React.FC<{ className?: string; message?: string }> = ({
  className,
  message,
}) => (
  <div
    className={cn("flex flex-col items-center justify-center min-h-[200px] gap-3", className)}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <Spinner size="lg" label={message || "Loading"} />
    {message && (
      <p className="text-sm text-text-sub-600" aria-hidden="true">
        {message}
      </p>
    )}
  </div>
);

/**
 * Default error fallback for SuspenseBoundary
 */
export const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorType,
  resetError,
}) => {
  const errorMessages: Record<SuspenseErrorType, { title: string; description: string }> = {
    network: {
      title: "Connection Error",
      description: "Unable to connect. Please check your internet connection and try again.",
    },
    timeout: {
      title: "Request Timeout",
      description: "The request took too long. Please try again.",
    },
    unknown: {
      title: "Something Went Wrong",
      description: "An unexpected error occurred. Please try again.",
    },
  };

  const { title, description } = errorMessages[errorType];

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[200px] p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div
        className="mb-4 w-12 h-12 rounded-full bg-error-lighter flex items-center justify-center"
        aria-hidden="true"
      >
        <svg
          className="w-6 h-6 text-error-base"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text-strong-950 mb-2">{title}</h3>
      <p className="text-sm text-text-sub-600 mb-4 max-w-sm">{description}</p>
      <button
        type="button"
        onClick={resetError}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        aria-label="Try again to reload the content"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Try Again
      </button>
      {import.meta.env?.DEV && error && (
        <details className="mt-4 text-left w-full max-w-md">
          <summary className="cursor-pointer text-xs text-text-sub-600 hover:text-text-strong-950">
            Error Details (Dev Only)
          </summary>
          <pre className="mt-2 p-3 bg-bg-soft-200 rounded-lg text-xs overflow-auto max-h-32">
            {error.stack || error.message}
          </pre>
        </details>
      )}
    </div>
  );
};

/**
 * Internal Error Boundary class component
 * This is needed because React doesn't have a hook-based error boundary
 */
class ErrorBoundaryInternal extends Component<
  {
    children: ReactNode;
    errorFallback?: React.ComponentType<ErrorFallbackProps>;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    onReset?: () => void;
  },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryInternal["props"]) {
    super(props);
    this.state = { hasError: false, error: null, errorType: "unknown" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorType: categorizeError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorType: "unknown" });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const ErrorFallbackComponent = this.props.errorFallback || DefaultErrorFallback;
      return (
        <ErrorFallbackComponent
          error={this.state.error}
          errorType={this.state.errorType}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * SuspenseBoundary - Combines React Suspense with Error Boundary
 *
 * A reusable component that handles both loading states (via Suspense) and
 * error states (via Error Boundary) for data-fetching components using
 * TanStack Query's useSuspenseQuery.
 *
 * @example
 * // Basic usage with default fallbacks
 * <SuspenseBoundary>
 *   <GardenList />
 * </SuspenseBoundary>
 *
 * @example
 * // Custom loading fallback
 * <SuspenseBoundary
 *   fallback={<GardenListSkeleton count={3} />}
 *   onError={(error) => trackError('garden-list', error)}
 * >
 *   <GardenList />
 * </SuspenseBoundary>
 *
 * @example
 * // Custom error fallback
 * <SuspenseBoundary
 *   fallback={<LoadingSpinner />}
 *   errorFallback={CustomErrorComponent}
 * >
 *   <DataComponent />
 * </SuspenseBoundary>
 */
export const SuspenseBoundary: React.FC<SuspenseBoundaryProps> = ({
  children,
  fallback,
  errorFallback,
  onError,
  onReset,
  className,
  boundaryId,
}) => {
  const loadingFallback = fallback ?? <DefaultSuspenseFallback />;

  return (
    <ErrorBoundaryInternal
      errorFallback={errorFallback}
      onError={(error, errorInfo) => {
        if (boundaryId) {
          console.error(`[SuspenseBoundary:${boundaryId}]`, error);
        }
        onError?.(error, errorInfo);
      }}
      onReset={onReset}
    >
      <Suspense fallback={<div className={className}>{loadingFallback}</div>}>{children}</Suspense>
    </ErrorBoundaryInternal>
  );
};

/**
 * RouteLoader - Full-page loading state for route transitions
 *
 * Use this as a Suspense fallback for entire routes.
 *
 * @example
 * <SuspenseBoundary fallback={<RouteLoader message="Loading garden..." />}>
 *   <GardenRoute />
 * </SuspenseBoundary>
 */
export const RouteLoader: React.FC<{ message?: string; className?: string }> = ({
  message = "Loading...",
  className,
}) => (
  <div
    className={cn("flex flex-col items-center justify-center min-h-[50vh] gap-4", className)}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <Spinner size="lg" label={message} />
    <p className="text-sm text-text-sub-600" aria-hidden="true">
      {message}
    </p>
  </div>
);
