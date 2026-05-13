import { en, es, logger, pt, trackErrorBoundary } from "@green-goods/shared";
import {
  RiBugLine,
  RiCheckLine,
  RiClipboardLine,
  RiErrorWarningLine,
  RiHomeLine,
  RiRefreshLine,
  RiWifiOffLine,
} from "@remixicon/react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../Actions";

type Messages = typeof en;
type Locale = "en" | "es" | "pt";

const messages: Record<Locale, Messages> = { en, es, pt };

// Recoverable: new SW activated and old dynamic-import chunks 404. One reload pulls the
// fresh HTML+chunks and the user never needs to see an error screen.
const CHUNK_ERROR_PATTERNS: RegExp[] = [
  /chunkloaderror/i,
  /loading chunk\s+\S+\s+failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
];

// Non-recoverable via reload: render loop / hook order bug. Reloading would loop forever,
// so we offer a hard reset (clear caches + IDB) instead.
const LOOP_ERROR_PATTERNS: RegExp[] = [
  /maximum update depth exceeded/i,
  /minified react error #301/i,
  /minified react error #310/i,
  /rendered more hooks than during the previous render/i,
  /rendered fewer hooks than expected/i,
];

const CHUNK_RELOAD_SESSION_KEY = "gg-eb-chunk-reload";

type ErrorCategory = "chunk" | "loop" | "network" | "offline" | "unknown";

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

function classifyError(error: Error | null): ErrorCategory {
  if (!error) return "unknown";
  const message = (error.message || "").toLowerCase();
  if (CHUNK_ERROR_PATTERNS.some((p) => p.test(message))) return "chunk";
  if (LOOP_ERROR_PATTERNS.some((p) => p.test(message))) return "loop";
  if (
    ["network error", "fetch failed", "failed to fetch", "network request failed"].some((m) =>
      message.includes(m)
    )
  ) {
    return "network";
  }
  if (["offline", "job_queue", "sync", "indexeddb"].some((m) => message.includes(m))) {
    return "offline";
  }
  return "unknown";
}

function readSessionFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string): void {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // private mode / storage denied — best-effort, fall through
  }
}

function clearSessionFlag(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // best-effort
  }
}

interface Props {
  children: ReactNode;
}

type CopyState = "idle" | "copied" | "fallback";

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  locale: Locale;
  category: ErrorCategory;
  showDetails: boolean;
  isAutoRecovering: boolean;
  copyState: CopyState;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      locale: getBrowserLocale(),
      category: "unknown",
      showDetails: false,
      isAutoRecovering: false,
      copyState: "idle",
    };
  }

  private copyResetTimer: number | null = null;

  componentWillUnmount() {
    if (this.copyResetTimer !== null) {
      window.clearTimeout(this.copyResetTimer);
      this.copyResetTimer = null;
    }
  }

  private buildBugReport(): string {
    const { error, errorInfo, category, locale } = this.state;
    const route =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "(unknown)";
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "(unknown)";
    const version =
      typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_VERSION
        ? String(import.meta.env.VITE_APP_VERSION)
        : "(unknown)";
    const standalone =
      typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches
        ? "yes (installed PWA)"
        : "no (browser tab)";

    return [
      "## Green Goods bug report",
      "",
      `**Error:** ${error?.message || error?.name || "Unknown error"}`,
      `**Category:** ${category}`,
      `**Route:** ${route}`,
      `**Time:** ${new Date().toISOString()}`,
      `**Version:** ${version}`,
      `**Locale:** ${locale}`,
      `**Installed PWA:** ${standalone}`,
      `**User agent:** ${userAgent}`,
      "",
      "### Stack",
      "```",
      error?.stack || "(no stack)",
      "```",
      "",
      "### Component stack",
      "```",
      errorInfo?.componentStack?.trim() || "(no component stack)",
      "```",
    ].join("\n");
  }

  handleCopyDetails = async () => {
    if (!this.state.error) return;
    const text = this.buildBugReport();

    const writeViaClipboardApi = async (): Promise<boolean> => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (err) {
        logger.warn("[AppErrorBoundary] Clipboard API write failed", { err });
      }
      return false;
    };

    const writeViaSelection = (): boolean => {
      // Legacy fallback for browsers without async Clipboard API (rare; older iOS).
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        document.body.appendChild(textarea);
        textarea.select();
        // execCommand is deprecated but still the only fallback that works without user-gesture-bound clipboard permissions.
        const ok = document.execCommand?.("copy") ?? false;
        document.body.removeChild(textarea);
        return ok;
      } catch (err) {
        logger.warn("[AppErrorBoundary] Selection-based copy failed", { err });
        return false;
      }
    };

    const copied = (await writeViaClipboardApi()) || writeViaSelection();

    if (copied) {
      this.setState({ copyState: "copied" });
    } else {
      // Final fallback: surface the details so the user can long-press / select manually.
      this.setState({ copyState: "fallback", showDetails: true });
    }

    if (this.copyResetTimer !== null) {
      window.clearTimeout(this.copyResetTimer);
    }
    this.copyResetTimer = window.setTimeout(() => {
      this.setState({ copyState: "idle" });
      this.copyResetTimer = null;
    }, 2500);
  };

  private t(key: keyof Messages): string {
    return messages[this.state.locale][key] || messages.en[key] || String(key);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorInfo: null, category: classifyError(error) };
  }

  componentDidMount() {
    // Clean boot — clear the chunk-reload one-shot so the NEXT deploy can also auto-recover.
    if (!this.state.hasError && readSessionFlag(CHUNK_RELOAD_SESSION_KEY)) {
      clearSessionFlag(CHUNK_RELOAD_SESSION_KEY);
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const category = classifyError(error);

    // Auto-recover transient post-deploy chunk failures with a one-shot reload.
    if (category === "chunk" && !readSessionFlag(CHUNK_RELOAD_SESSION_KEY)) {
      writeSessionFlag(CHUNK_RELOAD_SESSION_KEY);
      logger.warn("[AppErrorBoundary] Chunk load error — auto-reloading once", {
        message: error.message,
      });
      this.setState({ isAutoRecovering: true });
      // Give React a tick to commit the fallback render, then reload to fetch fresh assets.
      window.setTimeout(() => window.location.reload(), 50);
      return;
    }

    logger.error("App Error Boundary caught an error", { error, errorInfo, category });

    // Encode the category into boundaryName so PostHog can slice by failure mode without
    // requiring a shared-type bump. Existing isOffline/isNetwork remain populated for back-compat.
    trackErrorBoundary(error, {
      componentStack: errorInfo.componentStack,
      boundaryName: `AppErrorBoundary:${category}`,
      isOffline: category === "offline",
      isNetwork: category === "network",
    });

    this.setState({ error, errorInfo, category });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      isAutoRecovering: false,
    });
  };

  handleHardReset = async () => {
    // Forceful recovery for loop bugs and persistent failures.
    // Clears: SW caches, IndexedDB, sessionStorage flag, then full network-fresh reload.
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (error) {
      logger.warn("[AppErrorBoundary] Failed to clear caches", { error });
    }
    try {
      if ("indexedDB" in window && typeof indexedDB.databases === "function") {
        const dbs = await indexedDB.databases();
        await Promise.all(
          dbs
            .filter((db) => Boolean(db.name))
            .map(
              (db) =>
                new Promise<void>((resolve) => {
                  const req = indexedDB.deleteDatabase(db.name as string);
                  req.onsuccess = () => resolve();
                  req.onerror = () => resolve();
                  req.onblocked = () => resolve();
                })
            )
        );
      }
    } catch (error) {
      logger.warn("[AppErrorBoundary] Failed to clear IndexedDB", { error });
    }
    clearSessionFlag(CHUNK_RELOAD_SESSION_KEY);
    window.location.replace("/");
  };

  toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }));
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // While the chunk-error auto-reload is in flight, show a minimal "Updating..."
    // placeholder instead of the full error screen. This typically flashes for <100ms.
    if (this.state.isAutoRecovering) {
      return (
        <div className="min-h-screen bg-bg-white-0 flex flex-col items-center justify-center p-4">
          <div className="w-12 h-12 rounded-full bg-bg-soft-200 flex items-center justify-center mb-3 animate-pulse">
            <RiRefreshLine className="h-6 w-6 text-text-sub-600" />
          </div>
          <p className="text-text-sub-600 text-sm">
            {this.t("app.error.boundary.update.refreshing")}
          </p>
        </div>
      );
    }

    const { category, error, showDetails } = this.state;
    const isLoopBug = category === "loop";
    const isOfflineOrNetwork = category === "offline" || category === "network";

    return (
      <div className="min-h-screen bg-bg-white-0 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="bg-bg-weak-50 backdrop-blur-sm rounded-3xl shadow-2xl border border-stroke-soft-200 p-8 transform animate-fade-in">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 rounded-full animate-pulse">
                  <div
                    className={
                      isOfflineOrNetwork
                        ? "w-24 h-24 bg-warning-lighter rounded-full"
                        : "w-24 h-24 bg-error-lighter rounded-full"
                    }
                  />
                </div>
                <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-bg-soft-200 shadow-lg">
                  {category === "network" ? (
                    <RiWifiOffLine className="h-12 w-12 text-warning-base" />
                  ) : category === "offline" ? (
                    <RiErrorWarningLine className="h-12 w-12 text-warning-base" />
                  ) : (
                    <RiBugLine className="h-12 w-12 text-error-base" />
                  )}
                </div>
              </div>

              <h1 className="text-3xl font-bold text-text-strong-950 mb-3">
                {category === "network"
                  ? this.t("app.error.boundary.title.garden")
                  : category === "offline"
                    ? this.t("app.error.boundary.title.maintenance")
                    : this.t("app.error.boundary.title.error")}
              </h1>

              <h2 className="text-lg font-semibold text-text-strong-950 mb-4">
                {category === "network"
                  ? this.t("app.error.boundary.subtitle.connection")
                  : category === "offline"
                    ? this.t("app.error.boundary.subtitle.technical")
                    : this.t("app.error.boundary.subtitle.error")}
              </h2>

              <div className="space-y-3 mb-8">
                <p className="text-text-sub-600 leading-relaxed">
                  {category === "network"
                    ? this.t("app.error.boundary.description.network")
                    : category === "offline"
                      ? this.t("app.error.boundary.description.offline")
                      : isLoopBug
                        ? this.t("app.error.boundary.description.loop")
                        : this.t("app.error.boundary.description.error")}
                </p>

                {isOfflineOrNetwork && (
                  <div className="bg-success-lighter border border-success-light rounded-lg p-3">
                    <p className="text-sm text-success-dark font-medium">
                      {this.t("app.error.boundary.protection.message")}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 w-full">
                {/*
                 * Loop bugs can't be retried in-place — re-rendering the same tree triggers
                 * the same loop. Lead with the hard reset; demote in-place retry.
                 */}
                {isLoopBug ? (
                  <>
                    <Button
                      variant="primary"
                      size="medium"
                      onClick={this.handleHardReset}
                      label={this.t("app.error.boundary.action.clearData")}
                      leadingIcon={<RiRefreshLine className="h-5 w-5" />}
                      className="w-full shadow-lg"
                    />
                    <Button
                      variant="neutral"
                      size="medium"
                      onClick={() => {
                        window.location.href = "/";
                      }}
                      label={this.t("app.error.boundary.action.returnHome")}
                      leadingIcon={<RiHomeLine className="h-5 w-5" />}
                      className="w-full border-2 hover:bg-bg-weak-50"
                    />
                  </>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      size="medium"
                      onClick={this.handleRetry}
                      label={this.t("app.error.boundary.action.tryAgain")}
                      leadingIcon={<RiRefreshLine className="h-5 w-5" />}
                      className="w-full shadow-lg"
                    />
                    <Button
                      variant="neutral"
                      size="medium"
                      onClick={() => {
                        window.location.href = "/";
                      }}
                      label={this.t("app.error.boundary.action.returnHome")}
                      leadingIcon={<RiHomeLine className="h-5 w-5" />}
                      className="w-full border-2 hover:bg-bg-weak-50"
                    />
                    <button
                      type="button"
                      onClick={this.handleHardReset}
                      className="text-xs text-text-sub-600 underline hover:text-text-strong-950 transition-colors"
                    >
                      {this.t("app.error.boundary.action.clearData")}
                    </button>
                  </>
                )}
              </div>

              {/*
               * Diagnostic details: copy-for-support is the headline action. The raw
               * "Minified React error #301" text stays hidden behind a toggle so production
               * users never see it unless they ask — but copying to clipboard produces a
               * markdown-formatted bug report ready to paste into Discord/Telegram/Slack.
               * PostHog still receives the full error+stack regardless.
               */}
              {error && (
                <div className="mt-8 w-full">
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="neutral"
                      mode="stroke"
                      size="small"
                      onClick={this.handleCopyDetails}
                      label={
                        this.state.copyState === "copied"
                          ? this.t("app.error.boundary.action.copied")
                          : this.state.copyState === "fallback"
                            ? this.t("app.error.boundary.action.copyManual")
                            : this.t("app.error.boundary.action.copyDetails")
                      }
                      leadingIcon={
                        this.state.copyState === "copied" ? (
                          <RiCheckLine className="h-4 w-4" />
                        ) : (
                          <RiClipboardLine className="h-4 w-4" />
                        )
                      }
                      className="w-full"
                    />
                    <button
                      type="button"
                      onClick={this.toggleDetails}
                      className="text-xs text-text-sub-600 underline hover:text-text-strong-950 transition-colors"
                    >
                      {showDetails
                        ? this.t("app.error.boundary.devMode.hide")
                        : this.t("app.error.boundary.devMode.show")}
                    </button>
                  </div>
                  {showDetails && (
                    <div className="mt-3 text-left bg-bg-soft-200 border border-stroke-soft-200 rounded-lg p-4">
                      <pre className="text-xs text-text-strong-950 overflow-auto max-h-48 whitespace-pre-wrap select-all">
                        {this.buildBugReport()}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 p-4 bg-information-lighter rounded-xl border border-information-light">
                <p className="text-xs text-information-dark leading-relaxed">
                  <strong>{this.t("app.error.boundary.help.title")}</strong>{" "}
                  {this.t("app.error.boundary.help.description")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
