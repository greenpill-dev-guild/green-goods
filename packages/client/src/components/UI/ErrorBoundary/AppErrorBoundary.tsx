import {
  RiBugLine,
  RiErrorWarningLine,
  RiHomeLine,
  RiRefreshLine,
  RiWifiOffLine,
} from "@remixicon/react";
import { Component, ErrorInfo, ReactNode } from "react";
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
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            {/* Animated container */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-100/50 p-8 transform animate-fade-in">
              <div className="flex flex-col items-center text-center">
                {/* Animated icon with glow effect */}
                <div className="relative mb-8">
                  <div className="absolute inset-0 rounded-full animate-pulse">
                    {isNetworkError ? (
                      <div className="w-24 h-24 bg-orange-100 rounded-full" />
                    ) : isOfflineError ? (
                      <div className="w-24 h-24 bg-yellow-100 rounded-full" />
                    ) : (
                      <div className="w-24 h-24 bg-red-100 rounded-full" />
                    )}
                  </div>
                  <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-lg">
                    {isNetworkError ? (
                      <RiWifiOffLine className="h-12 w-12 text-orange-500" />
                    ) : isOfflineError ? (
                      <RiErrorWarningLine className="h-12 w-12 text-yellow-500" />
                    ) : (
                      <RiBugLine className="h-12 w-12 text-red-500" />
                    )}
                  </div>
                </div>

                {/* Title with emoji */}
                <h1 className="text-3xl font-bold text-gray-900 mb-3">
                  {isNetworkError
                    ? "🌱 Garden Offline"
                    : isOfflineError
                      ? "🔧 Garden Maintenance"
                      : "🚧 Oops!"}
                </h1>

                {/* Subtitle */}
                <h2 className="text-lg font-semibold text-gray-700 mb-4">
                  {isNetworkError
                    ? "Connection Lost"
                    : isOfflineError
                      ? "Technical Hiccup"
                      : "Something went wrong"}
                </h2>

                {/* Main description */}
                <div className="space-y-3 mb-8">
                  <p className="text-gray-600 leading-relaxed">
                    {isNetworkError
                      ? "🌐 Your garden is temporarily offline. Don't worry - your work is safely stored locally and will sync when you're back online!"
                      : isOfflineError
                        ? "🔧 There's a technical issue with the offline features, but your data is safe and secure."
                        : "🛠️ Something unexpected happened. Our team has been notified and is working on a fix."}
                  </p>

                  {(isNetworkError || isOfflineError) && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-700 font-medium">
                        ✅ Your work is protected and will not be lost
                      </p>
                    </div>
                  )}
                </div>

                {/* Development details */}
                {import.meta.env.DEV && this.state.error && (
                  <details className="mb-8 text-left w-full group">
                    <summary className="cursor-pointer font-medium text-sm text-gray-700 hover:text-gray-900 transition-colors p-3 bg-gray-50 rounded-lg border border-gray-200 group-open:rounded-b-none">
                      <span className="flex items-center justify-between">
                        🔍 Technical Details (Dev Mode)
                        <span className="text-xs text-gray-500 group-open:hidden">
                          Click to expand
                        </span>
                      </span>
                    </summary>
                    <div className="bg-gray-50 border border-gray-200 border-t-0 rounded-b-lg p-4">
                      <pre className="text-xs text-gray-700 overflow-auto max-h-48 whitespace-pre-wrap">
                        <strong>Error:</strong> {this.state.error.toString()}
                        {this.state.errorInfo?.componentStack && (
                          <>
                            <br />
                            <br />
                            <strong>Component Stack:</strong>
                            {this.state.errorInfo.componentStack}
                          </>
                        )}
                      </pre>
                    </div>
                  </details>
                )}

                {/* Action buttons with improved styling */}
                <div className="flex flex-col gap-3 w-full">
                  <Button
                    variant="primary"
                    size="medium"
                    onClick={this.handleRetry}
                    label="Try Again"
                    leadingIcon={<RiRefreshLine className="h-5 w-5" />}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                  />

                  <Button
                    variant="neutral"
                    size="medium"
                    onClick={() => (window.location.href = "/")}
                    label="Return to Garden"
                    leadingIcon={<RiHomeLine className="h-5 w-5" />}
                    className="w-full border-2 hover:bg-gray-50 transform hover:scale-[1.02] transition-all duration-200"
                  />
                </div>

                {/* Help text with animation */}
                <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    💡 <strong>Need help?</strong> Try refreshing your browser, clearing your cache,
                    or check your internet connection. If this keeps happening, our gardeners are
                    always here to help!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
