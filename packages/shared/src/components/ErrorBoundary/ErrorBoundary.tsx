import { RiAlertLine, RiRefreshLine } from "@remixicon/react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "../../modules/app/logger";
import { cn } from "../../utils";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback component to render on error. If not provided, uses default UI. */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Called when an error is caught. Use for logging or reporting. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional context label for logging (e.g., "HypercertWizard") */
  context?: string;
  /** Custom reset handler. If provided, will be called instead of re-rendering. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * A React Error Boundary component that catches JavaScript errors in child components.
 * Provides a fallback UI and optional error reporting.
 *
 * @example
 * ```tsx
 * <ErrorBoundary context="PaymentForm" onError={reportToSentry}>
 *   <PaymentForm />
 * </ErrorBoundary>
 * ```
 *
 * @example With custom fallback
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, reset) => (
 *     <div>
 *       <p>Something went wrong: {error.message}</p>
 *       <button onClick={reset}>Try again</button>
 *     </div>
 *   )}
 * >
 *   <ComplexComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { context = "ErrorBoundary", onError } = this.props;

    logger.error(`[${context}] Caught error in component tree`, {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    const { onReset } = this.props;

    if (onReset) {
      onReset();
    }

    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { children, fallback } = this.props;
    const { hasError, error } = this.state;

    if (!hasError || !error) {
      return children;
    }

    // Custom fallback function
    if (typeof fallback === "function") {
      return fallback(error, this.handleReset);
    }

    // Custom fallback element
    if (fallback) {
      return fallback;
    }

    // Default fallback UI
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-xl",
          "border border-error-light bg-error-lighter p-6 text-center"
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-light">
          <RiAlertLine className="h-6 w-6 text-error-dark" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-error-dark">Something went wrong</h3>
          <p className="text-sm text-error-dark/80">
            An unexpected error occurred. Please try again.
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleReset}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2",
            "bg-error-base text-sm font-medium text-white",
            "transition hover:bg-error-dark",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-error-base focus-visible:ring-offset-2"
          )}
        >
          <RiRefreshLine className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
