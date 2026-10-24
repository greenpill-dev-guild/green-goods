import { RiAlertLine, RiRefreshLine } from "@remixicon/react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { trackErrorBoundary } from "../../modules/app/error-events";
import { logger } from "../../modules/app/logger";
import { Button } from "../Button";
import { EmptyState } from "../ListPrimitives";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback component to render on error. If not provided, uses default UI. */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Called after the default error tracking runs. Use for fallback side effects. */
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
 * <ErrorBoundary context="PaymentForm" onError={showRecoveryToast}>
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

    trackErrorBoundary(error, {
      componentStack: errorInfo.componentStack,
      boundaryName: context,
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

    // Default fallback UI: the state block, with the shared family's own button.
    // The copy is written out because a boundary can sit above the language provider.
    return (
      <EmptyState
        tone="error"
        icon={<RiAlertLine />}
        title="Something went wrong"
        description="An unexpected error occurred. Please try again."
        action={
          <Button
            data-piece-control
            size="sm"
            leadingIcon={<RiRefreshLine />}
            onClick={this.handleReset}
          >
            Try Again
          </Button>
        }
      />
    );
  }
}
