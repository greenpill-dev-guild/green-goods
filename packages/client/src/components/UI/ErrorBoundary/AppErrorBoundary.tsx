import { RiBugLine, RiErrorWarningLine, RiRefreshLine } from "@remixicon/react";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { track } from "@/modules/posthog";
import { Button } from "../Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App Error Boundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Track error in PostHog
    track("error_boundary_triggered", {
      error_message: error.message,
      error_stack: error.stack,
      component_stack: errorInfo.componentStack,
      is_offline_error: this.isOfflineError(error),
      is_network_error: this.isNetworkError(error),
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  isOfflineError(error: Error | null): boolean {
    if (!error) return false;
    const offlineKeywords = ["offline", "job_queue", "sync", "IndexedDB"];
    return offlineKeywords.some((keyword) =>
      error.message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  isNetworkError(error: Error | null): boolean {
    if (!error) return false;
    const networkErrorMessages = [
      "network error",
      "fetch failed",
      "failed to fetch",
      "network request failed",
      "internet connection",
    ];
    return networkErrorMessages.some((msg) => error.message.toLowerCase().includes(msg));
  }

  render() {
    if (this.state.hasError) {
      const isOfflineError = this.isOfflineError(this.state.error);
      const isNetworkError = this.isNetworkError(this.state.error);

      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex flex-col items-center text-center">
              {isOfflineError ? (
                <RiErrorWarningLine className="h-16 w-16 text-orange-500 mb-4" />
              ) : (
                <RiBugLine className="h-16 w-16 text-red-500 mb-4" />
              )}

              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {isOfflineError ? "Offline Functionality Error" : "Something went wrong"}
              </h1>

              <p className="text-gray-600 mb-6">
                {isNetworkError
                  ? "There's a problem with your internet connection. Your work is saved locally and will sync when you're back online."
                  : isOfflineError
                    ? "An error occurred with offline functionality. Your data should still be safe."
                    : "An unexpected error occurred. Please try refreshing the page."}
              </p>

              {import.meta.env.DEV && this.state.error && (
                <details className="mb-6 text-left w-full">
                  <summary className="cursor-pointer font-medium text-sm text-gray-700">
                    Technical Details
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  size="medium"
                  onClick={this.handleRetry}
                  className="flex-1"
                >
                  <RiRefreshLine className="h-4 w-4 mr-2" />
                  Try Again
                </Button>

                <Button
                  variant="primary"
                  size="medium"
                  onClick={() => (window.location.href = "/")}
                  className="flex-1"
                >
                  Go Home
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
