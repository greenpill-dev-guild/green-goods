import { logger } from "@green-goods/shared/modules/app/logger";
import { trackErrorBoundary } from "@green-goods/shared/modules/app/error-events";
import { RiArrowGoBackLine, RiLeafFill, RiRefreshLine } from "@remixicon/react";
import React, { Component, type ReactNode } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { Button } from "@green-goods/shared/components/Button";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  intl?: IntlShape;
  /**
   * Called when the error boundary is reset (e.g., via Try Again button)
   * Useful for resetting queries or other state
   */
  onReset?: () => void;
  /**
   * Key that when changed will reset the error boundary
   * Useful for resetting when navigation occurs
   */
  resetKey?: string | number;
}

class GardenErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("Garden Error Boundary caught an error", { error, errorInfo });

    // Track error in PostHog for debugging
    trackErrorBoundary(error, {
      componentStack: errorInfo.componentStack,
      boundaryName: "GardenErrorBoundary",
    });
  }

  // Reset error state when resetKey changes (useful for navigation)
  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.resetErrorState();
    }
  }

  resetErrorState = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { intl } = this.props;

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-bg-white-0">
          <div className="text-center max-w-md">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl grid place-items-center bg-primary/10">
              <RiLeafFill className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-text-strong-950">
              {intl?.formatMessage({
                id: "app.error.garden.title",
                defaultMessage: "Garden failed to load",
              })}
            </h2>
            <p className="text-text-sub-600 mb-6">
              {intl?.formatMessage({
                id: "app.error.garden.description",
                defaultMessage: "Something went wrong while loading this garden. Please try again.",
              })}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                type="button"
                leadingIcon={<RiRefreshLine className="h-5 w-5" aria-hidden="true" />}
                onClick={this.resetErrorState}
              >
                {intl?.formatMessage({
                  id: "app.error.garden.tryAgain",
                  defaultMessage: "Try Again",
                }) || "Try Again"}
              </Button>
              <Button
                type="button"
                emphasis="secondary"
                leadingIcon={<RiArrowGoBackLine className="h-5 w-5" aria-hidden="true" />}
                onClick={() => window.history.back()}
              >
                {intl?.formatMessage({
                  id: "app.error.garden.goBack",
                  defaultMessage: "Go Back",
                }) || "Go Back"}
              </Button>
            </div>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-text-sub-600">
                  {intl?.formatMessage({
                    id: "app.error.garden.technicalDetails",
                    defaultMessage: "Technical details",
                  })}
                </summary>
                <pre className="mt-2 text-xs bg-bg-weak-50 border border-stroke-soft-200 p-3 rounded-lg overflow-auto max-h-40">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to inject intl from hook
export const GardenErrorBoundary: React.FC<Omit<ErrorBoundaryProps, "intl">> = (props) => {
  const intl = useIntl();
  return <GardenErrorBoundaryClass {...props} intl={intl} />;
};
