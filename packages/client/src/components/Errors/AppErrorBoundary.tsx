import { track } from "@green-goods/shared/modules";
import { en, es, pt } from "@green-goods/shared/i18n";
import {
  RiBugLine,
  RiErrorWarningLine,
  RiHomeLine,
  RiRefreshLine,
  RiWifiOffLine,
} from "@remixicon/react";
import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "../Actions";

type Messages = typeof en;
type Locale = "en" | "es" | "pt";

const messages: Record<Locale, Messages> = { en, es, pt };

function getBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const browserLocales = navigator.languages || [navigator.language];
  for (const locale of browserLocales) {
    const lang = locale.split("-")[0] as Locale;
    if (lang === "en" || lang === "es" || lang === "pt") {
      return lang;
    }
  }
  return "en";
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  locale: Locale;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      locale: getBrowserLocale(),
    };
  }

  private t(key: keyof Messages): string {
    return messages[this.state.locale][key];
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
        <div className="min-h-screen bg-bg-white-0 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            {/* Animated container */}
            <div className="bg-bg-weak-50 backdrop-blur-sm rounded-3xl shadow-2xl border border-stroke-soft-200 p-8 transform animate-fade-in">
              <div className="flex flex-col items-center text-center">
                {/* Animated icon with glow effect */}
                <div className="relative mb-8">
                  <div className="absolute inset-0 rounded-full animate-pulse">
                    {isNetworkError ? (
                      <div className="w-24 h-24 bg-warning-lighter rounded-full" />
                    ) : isOfflineError ? (
                      <div className="w-24 h-24 bg-warning-lighter rounded-full" />
                    ) : (
                      <div className="w-24 h-24 bg-error-lighter rounded-full" />
                    )}
                  </div>
                  <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-bg-soft-200 shadow-lg">
                    {isNetworkError ? (
                      <RiWifiOffLine className="h-12 w-12 text-warning-base" />
                    ) : isOfflineError ? (
                      <RiErrorWarningLine className="h-12 w-12 text-warning-base" />
                    ) : (
                      <RiBugLine className="h-12 w-12 text-error-base" />
                    )}
                  </div>
                </div>

                {/* Title with emoji */}
                <h1 className="text-3xl font-bold text-text-strong-950 mb-3">
                  {isNetworkError
                    ? `🌱 ${this.t("app.error.boundary.title.garden")}`
                    : isOfflineError
                      ? `🔧 ${this.t("app.error.boundary.title.maintenance")}`
                      : `🚧 ${this.t("app.error.boundary.title.error")}`}
                </h1>

                {/* Subtitle */}
                <h2 className="text-lg font-semibold text-text-strong-950 mb-4">
                  {isNetworkError
                    ? this.t("app.error.boundary.subtitle.connection")
                    : isOfflineError
                      ? this.t("app.error.boundary.subtitle.technical")
                      : this.t("app.error.boundary.subtitle.error")}
                </h2>

                {/* Main description */}
                <div className="space-y-3 mb-8">
                  <p className="text-text-sub-600 leading-relaxed">
                    {isNetworkError
                      ? `🌐 ${this.t("app.error.boundary.description.network")}`
                      : isOfflineError
                        ? `🔧 ${this.t("app.error.boundary.description.offline")}`
                        : `🛠️ ${this.t("app.error.boundary.description.error")}`}
                  </p>

                  {(isNetworkError || isOfflineError) && (
                    <div className="bg-success-lighter border border-success-light rounded-lg p-3">
                      <p className="text-sm text-success-dark font-medium">
                        ✅ {this.t("app.error.boundary.protection.message")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Development details */}
                {this.state.error && (
                  <details className="mb-8 text-left w-full group">
                    <summary className="cursor-pointer font-medium text-sm text-text-strong-950 hover:text-text-strong-950 transition-colors p-3 bg-bg-soft-200 rounded-lg border border-stroke-soft-200 group-open:rounded-b-none">
                      <span className="flex items-center justify-between">
                        🔍 {this.t("app.error.boundary.devMode.title")}
                        <span className="text-xs text-text-sub-600 group-open:hidden">
                          Click to expand
                        </span>
                      </span>
                    </summary>
                    <div className="bg-bg-soft-200 border border-stroke-soft-200 border-t-0 rounded-b-lg p-4">
                      <pre className="text-xs text-text-strong-950 overflow-auto max-h-48 whitespace-pre-wrap">
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
                    label={this.t("app.error.boundary.action.tryAgain")}
                    leadingIcon={<RiRefreshLine className="h-5 w-5" />}
                    className="w-full shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                  />

                  <Button
                    variant="neutral"
                    size="medium"
                    onClick={() => (window.location.href = "/")}
                    label={this.t("app.error.boundary.action.returnHome")}
                    leadingIcon={<RiHomeLine className="h-5 w-5" />}
                    className="w-full border-2 hover:bg-bg-weak-50 transform hover:scale-[1.02] transition-all duration-200"
                  />
                </div>

                {/* Help text with animation */}
                <div className="mt-8 p-4 bg-information-lighter rounded-xl border border-information-light">
                  <p className="text-xs text-information-dark leading-relaxed">
                    💡 <strong>{this.t("app.error.boundary.help.title")}</strong>{" "}
                    {this.t("app.error.boundary.help.description")}
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
