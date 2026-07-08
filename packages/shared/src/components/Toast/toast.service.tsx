import type { ReactNode } from "react";
import * as React from "react";
import toast, { type Toast as HotToast, type ToastOptions } from "react-hot-toast";
import { logger } from "../../modules/app/logger";
import { useUIStore } from "../../stores/useUIStore";
import { capitalize } from "../../utils/app/text";
import { cn } from "../../utils/styles/cn";

type ToastFn = typeof toast.success;

export type ToastStatus = "success" | "error" | "info" | "loading";

export interface ToastAction {
  label: string;
  onClick: () => void;
  dismissOnClick?: boolean;
  testId?: string;
}

export interface ToastDescriptor {
  id?: string;
  status: ToastStatus;
  /** Short user-facing copy (e.g. "Profile updated"). */
  message?: string;
  /** Optional title rendered above the message. */
  title?: string;
  /** Extended hint or remediation guidance. */
  description?: string;
  /** Fallback context to build predictable copy (e.g. "update profile"). */
  context?: string;
  /** Raw error surfaced from catch blocks; logged in dev builds. */
  error?: unknown;
  /** Extra information for developers; logged in dev builds. */
  devMessage?: string;
  /** Duration override in milliseconds. */
  duration?: number;
  /**
   * Two-tier policy flag. When `true`, the toast never auto-dismisses (it stays
   * until the user acts or it is replaced) and gains an explicit close (X) by
   * default. Use for toasts that require acknowledgement or carry an action
   * (e.g. "Restart to update"). Omit/false for transient "quick notification"
   * toasts that auto-dismiss after their duration. Equivalent to passing
   * `duration: Infinity`, but reads as intent at the call site.
   */
  persistent?: boolean;
  /** Optional toast action rendered as a subtle button. */
  action?: ToastAction;
  /** Optional flag to silence diagnostics for known, handled errors. */
  suppressLogging?: boolean;
  /** Optional icon override. */
  icon?: ReactNode;
  /** Whether the toast can be dismissed by tapping on it. Defaults to true for success/info/error, false for loading. */
  dismissible?: boolean;
  /** Whether to render an explicit close (X) button. Defaults to false. */
  closable?: boolean;
  /** Callback invoked when the toast is dismissed (via tap, X button, or programmatic dismiss). */
  onDismiss?: () => void;
}

export interface ToastTranslator {
  formatTitle?: (status: ToastStatus, context?: string) => string | undefined;
  formatMessage?: (status: ToastStatus, context?: string) => string;
}

interface ResolvedToastDescriptor {
  id?: string;
  status: ToastStatus;
  title?: string;
  message: string;
  description?: string;
  duration: number;
  persistent: boolean;
  action?: ToastAction;
  context?: string;
  error?: unknown;
  devMessage?: string;
  suppressLogging?: boolean;
  icon?: ReactNode;
  dismissible: boolean;
  closable: boolean;
  onDismiss?: () => void;
}

interface ToastMessageProps {
  title?: string;
  message: string;
  description?: string;
  action?: ToastAction;
  toastId?: string;
  status: ToastStatus;
  /** Debug mode verbose description (only shown when debug mode is on) */
  debugDescription?: string;
  /** Callback to copy error to clipboard */
  onCopyError?: () => void;
  /** Whether copy was successful */
  copySuccess?: boolean;
  /** Whether the toast can be dismissed by tapping */
  dismissible?: boolean;
  /** Whether to render an explicit close (X) button */
  closable?: boolean;
  /** Callback to dismiss the toast */
  onDismiss?: () => void;
}

const DEFAULT_DURATIONS: Record<ToastStatus, number> = {
  success: 3000,
  error: 4500,
  info: 3500,
  loading: 20000,
};

const isDevEnvironment =
  (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") ||
  (typeof window !== "undefined" && (window as unknown as { __DEV__?: boolean }).__DEV__);

const STATUS_TO_FN: Record<ToastStatus, ToastFn> = {
  success: toast.success,
  error: toast.error,
  info: toast,
  loading: toast.loading,
};

const STATUS_ARIA_ROLE: Record<ToastStatus, "status" | "alert"> = {
  success: "status",
  info: "status",
  loading: "status",
  error: "alert",
};

const ACTION_BUTTON_BASE =
  "inline-flex items-center text-xs font-medium text-[var(--color-primary-base)] hover:text-[var(--color-primary-dark)] focus:outline-none focus:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary-base)] rounded transition-colors";

/**
 * Self-managed auto-dismiss timers.
 *
 * We deliberately do NOT rely on react-hot-toast's built-in `duration` for
 * auto-dismiss. The library drives dismissal from a single global `pausedAt`
 * flag toggled by the <Toaster> container's mouseenter/mouseleave. On touch
 * (and any enter-without-matching-leave) that flag latches ON and silently
 * disables auto-dismiss for EVERY toast until a stray mouseleave clears it —
 * the "toasts never auto-dismiss, must be tapped" bug.
 *
 * Owning the timers here (and passing the library `duration: Infinity`) makes
 * auto-dismiss immune to that latch. Hover/focus pause is scoped per toast, so a
 * paused toast can never freeze the dismissal of others, and a hard pause cap
 * guarantees even a single toast can't get stuck open if its leave never fires.
 *
 * This is a module-level service (toasts are fired imperatively), not a React
 * hook, so raw setTimeout is correct here — lifetimes are bound to toast ids we
 * explicitly clear on dismiss/replace, not to a component lifecycle.
 */
const MAX_PAUSE_MS = 8000;

interface DismissTimer {
  /** Milliseconds left until dismissal when the timer last (re)started. */
  remaining: number;
  /** Timestamp the current running interval started (for pause accounting). */
  startedAt: number;
  /** Active dismissal timeout, or null while paused. */
  runTimer: ReturnType<typeof setTimeout> | null;
  /** Safety timeout that force-resumes a stuck pause. */
  capTimer: ReturnType<typeof setTimeout> | null;
  paused: boolean;
}

const dismissTimers = new Map<string, DismissTimer>();

function fireDismiss(id: string) {
  dismissTimers.delete(id);
  toast.dismiss(id);
}

/** Cancel and forget the auto-dismiss timer(s). Pass no id to clear all. */
function clearDismissTimer(id?: string) {
  const clearEntry = (entry: DismissTimer) => {
    if (entry.runTimer) clearTimeout(entry.runTimer);
    if (entry.capTimer) clearTimeout(entry.capTimer);
  };
  if (id === undefined) {
    dismissTimers.forEach(clearEntry);
    dismissTimers.clear();
    return;
  }
  const entry = dismissTimers.get(id);
  if (!entry) return;
  clearEntry(entry);
  dismissTimers.delete(id);
}

/** Start (or replace) the auto-dismiss countdown for a toast id. */
function scheduleDismiss(id: string, duration: number) {
  clearDismissTimer(id);
  // Non-finite duration => persistent toast => no auto-dismiss.
  if (!Number.isFinite(duration)) return;
  dismissTimers.set(id, {
    remaining: duration,
    startedAt: Date.now(),
    runTimer: setTimeout(() => fireDismiss(id), duration),
    capTimer: null,
    paused: false,
  });
}

/** Pause the countdown (hover/focus). No-op for persistent/unknown toasts. */
function pauseDismiss(id: string) {
  const entry = dismissTimers.get(id);
  if (!entry || entry.paused || !entry.runTimer) return;
  clearTimeout(entry.runTimer);
  entry.runTimer = null;
  entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt));
  entry.paused = true;
  // Safety: if the matching leave/blur never arrives (touch sticky-hover, the
  // element removed under the pointer), force a resume so it can't stick open.
  entry.capTimer = setTimeout(() => resumeDismiss(id), MAX_PAUSE_MS);
}

/** Resume a paused countdown with its remaining time. */
function resumeDismiss(id: string) {
  const entry = dismissTimers.get(id);
  if (!entry || !entry.paused) return;
  if (entry.capTimer) {
    clearTimeout(entry.capTimer);
    entry.capTimer = null;
  }
  entry.paused = false;
  entry.startedAt = Date.now();
  entry.runTimer = setTimeout(() => fireDismiss(id), entry.remaining);
}

const fallbackTitles: Record<ToastStatus, string> = {
  success: "Success",
  error: "Something went wrong",
  loading: "Working on it",
  info: "Notice",
};

const fallbackMessages: Record<ToastStatus, string> = {
  success: "All set.",
  error: "Please try again.",
  loading: "Processing...",
  info: "Here's an update.",
};

const defaultTranslator: Required<ToastTranslator> = {
  formatTitle: (status, context) => {
    if (context && context.trim().length > 0) {
      return capitalize(context);
    }
    if (status === "info") {
      return fallbackTitles.info;
    }
    return fallbackTitles[status] ?? undefined;
  },
  formatMessage: (status, context) => {
    const trimmedContext = context?.trim();
    if (!trimmedContext) {
      return fallbackMessages[status] ?? fallbackMessages.info;
    }

    const normalized = trimmedContext.toLowerCase();

    switch (status) {
      case "success":
        return `${capitalize(normalized)} completed.`;
      case "error":
        return `Couldn't ${normalized}. Try again.`;
      case "loading":
        return `${capitalize(normalized)} in progress...`;
      default:
        return capitalize(normalized);
    }
  },
};

let activeTranslator: ToastTranslator = defaultTranslator;

export function setToastTranslator(translator?: ToastTranslator) {
  activeTranslator = translator ?? defaultTranslator;
}

function normalizeDescriptor(descriptor: ToastDescriptor): ResolvedToastDescriptor {
  const {
    id,
    status,
    title,
    message,
    description,
    duration,
    persistent,
    context,
    action,
    error,
    devMessage,
    suppressLogging,
    icon,
    dismissible,
    closable,
    onDismiss,
  } = descriptor;

  const normalizedMessage = message ?? buildDefaultMessage(status, context);
  const normalizedTitle = title ?? buildDefaultTitle(status, context);

  // Two-tier policy: persistent toasts never auto-dismiss. Treat an explicit
  // `duration: Infinity` as persistent too, so existing call sites keep working.
  const isPersistent = persistent ?? duration === Number.POSITIVE_INFINITY;
  const resolvedDuration = isPersistent
    ? Number.POSITIVE_INFINITY
    : (duration ?? DEFAULT_DURATIONS[status]);

  // Default: loading toasts are NOT dismissible, others are
  const normalizedDismissible = dismissible ?? status !== "loading";

  return {
    id,
    status,
    title: normalizedTitle,
    message: normalizedMessage,
    description,
    duration: resolvedDuration,
    persistent: isPersistent,
    action,
    context,
    error,
    devMessage,
    suppressLogging,
    icon,
    dismissible: normalizedDismissible,
    // Persistent toasts need a way out: give them an explicit close (X) by default.
    closable: closable ?? isPersistent,
    onDismiss,
  };
}

function buildDefaultTitle(status: ToastStatus, context?: string) {
  const translated = activeTranslator.formatTitle?.(status, context);
  if (isNonEmptyString(translated)) {
    return translated;
  }
  const fallback = defaultTranslator.formatTitle?.(status, context);
  return isNonEmptyString(fallback) ? fallback : undefined;
}

function buildDefaultMessage(status: ToastStatus, context?: string) {
  const translated = activeTranslator.formatMessage?.(status, context);
  if (isNonEmptyString(translated)) {
    return translated;
  }
  return defaultTranslator.formatMessage(status, context);
}

function getDiagnostics(error: unknown, devMessage?: string) {
  if (!error && !devMessage) {
    return undefined;
  }

  if (error instanceof Error) {
    const summary = `${error.name}: ${error.message}`;
    return devMessage ? `${summary} | ${devMessage}` : summary;
  }

  if (typeof error === "string") {
    return devMessage ? `${error} | ${devMessage}` : error;
  }

  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return devMessage ? `${maybeMessage} | ${devMessage}` : maybeMessage;
    }

    try {
      const serialized = JSON.stringify(error);
      return devMessage ? `${serialized} | ${devMessage}` : serialized;
    } catch {
      return devMessage ?? "[toast] encountered an unknown error payload";
    }
  }

  return devMessage;
}

/**
 * Format error details for clipboard copying in debug mode.
 * Includes error name, message, stack trace, and context.
 */
function formatErrorForClipboard(error: unknown, context?: string, devMessage?: string): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = ["=== Green Goods Debug Error ===", `Timestamp: ${timestamp}`];

  if (context) {
    lines.push(`Context: ${context}`);
  }

  if (error instanceof Error) {
    lines.push(`Error Name: ${error.name}`);
    lines.push(`Message: ${error.message}`);
    if (error.stack) {
      lines.push("", "Stack Trace:", error.stack);
    }
    // Include cause if present (Error.cause)
    if ("cause" in error && error.cause) {
      lines.push("", "Cause:", String(error.cause));
    }
  } else if (typeof error === "string") {
    lines.push(`Error: ${error}`);
  } else if (error && typeof error === "object") {
    try {
      lines.push("Error Object:", JSON.stringify(error, null, 2));
    } catch {
      lines.push(`Error Object: [unserializable] ${String(error)}`);
    }
  } else if (error !== undefined && error !== null) {
    lines.push(`Error: ${String(error)}`);
  }

  if (devMessage) {
    lines.push("", `Dev Message: ${devMessage}`);
  }

  lines.push("", "================================");
  return lines.join("\n");
}

/**
 * Copy text to clipboard and return success status.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers or when clipboard API is unavailable
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get verbose error description for debug mode display.
 */
function getVerboseErrorDescription(error: unknown): string | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    const parts: string[] = [`${error.name}: ${error.message}`];

    // Add shortened stack trace (first 3 lines)
    if (error.stack) {
      const stackLines = error.stack.split("\n").slice(1, 4);
      if (stackLines.length > 0) {
        parts.push(stackLines.map((l) => l.trim()).join(" → "));
      }
    }

    return parts.join(" | ");
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

function logDiagnostics(resolved: ResolvedToastDescriptor) {
  if (!isDevEnvironment || resolved.status !== "error" || resolved.suppressLogging) {
    return;
  }

  const diagnostic = getDiagnostics(resolved.error, resolved.devMessage);

  if (resolved.error) {
    logger.error(`[toast:error] ${resolved.context ?? resolved.title ?? "operation failed"}`, {
      error: resolved.error,
    });
  }

  if (diagnostic) {
    logger.error(`[toast:detail] ${diagnostic}`);
  }
}

function ToastMessage({
  title,
  message,
  description,
  action,
  toastId,
  status,
  debugDescription,
  onCopyError,
  copySuccess,
  dismissible,
  closable,
  onDismiss,
}: ToastMessageProps) {
  const buttonLabel = action?.label ?? "";
  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering dismiss when clicking action button
    if (!action) return;
    if (action.dismissOnClick !== false && toastId) {
      clearDismissTimer(toastId);
      toast.dismiss(toastId);
    }
    action.onClick();
  };

  const handleDismiss = () => {
    if (dismissible && onDismiss) {
      onDismiss();
    }
  };

  // Explicit close button dismisses regardless of `dismissible`; also notifies caller.
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toastId) {
      clearDismissTimer(toastId);
      toast.dismiss(toastId);
    }
    onDismiss?.();
  };

  // Hover/focus pauses this toast's auto-dismiss (scoped per toast, with a hard
  // cap in the timer manager so it can never get stuck open).
  const pauseHandlers = toastId
    ? {
        onPointerEnter: () => pauseDismiss(toastId),
        onPointerLeave: () => resumeDismiss(toastId),
        onPointerCancel: () => resumeDismiss(toastId),
        onFocus: () => pauseDismiss(toastId),
        onBlur: () => resumeDismiss(toastId),
      }
    : undefined;

  const closeButton = closable ? (
    <button
      type="button"
      onClick={handleClose}
      aria-label="Dismiss notification"
      data-testid="toast-close-button"
      className="absolute right-0 top-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--color-text-sub-600)] transition-colors hover:bg-[color:var(--color-bg-weak-50)] hover:text-[color:var(--color-text-strong-950)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-base)]"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M2 2L10 10M10 2L2 10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  ) : null;

  const ariaLabel = title ? `${title}: ${message}` : undefined;

  const containerClassName = cn(
    "relative flex w-full flex-col gap-1 text-[color:var(--color-text-strong-950)] text-left rounded",
    status === "loading" && "animate-pulse",
    dismissible && "cursor-pointer",
    closable && "pr-6",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-base)] focus-visible:ring-offset-2"
  );

  // Dismissible toasts use a clickable container.
  // We avoid role="button" since there are nested <button> elements inside (invalid HTML).
  // Instead, we make the container focusable and handle keyboard events directly.
  // The inner action buttons remain as real <button> elements for proper semantics.
  if (dismissible) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Only handle keyboard dismiss if the target is the container itself (not nested buttons)
      if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        handleDismiss();
      }
    };

    const handleContainerClick = (e: React.MouseEvent) => {
      // Only dismiss if clicking the container, not nested buttons
      if (e.target === e.currentTarget || !(e.target as HTMLElement).closest("button")) {
        handleDismiss();
      }
    };

    return (
      <div
        role="status"
        tabIndex={0}
        className={containerClassName}
        aria-label={ariaLabel}
        data-testid="toast-content"
        onClick={handleContainerClick}
        onKeyDown={handleKeyDown}
        {...pauseHandlers}
      >
        {closeButton}
        {title ? <p className="text-sm font-semibold leading-tight">{title}</p> : null}
        <p className="text-sm leading-snug">{message}</p>
        {description ? (
          <p className="text-xs leading-snug text-[color:var(--color-text-sub-600)]">
            {description}
          </p>
        ) : null}
        {/* Debug mode: show verbose error info */}
        {debugDescription ? (
          <div className="mt-1 rounded bg-[var(--color-bg-weak-50)] p-2">
            <p className="break-all font-mono text-[10px] leading-tight text-[color:var(--color-text-sub-600)]">
              {debugDescription}
            </p>
          </div>
        ) : null}
        {/* Action buttons row */}
        <div className="flex items-center gap-3">
          {action ? (
            <button
              type="button"
              onClick={handleAction}
              className={ACTION_BUTTON_BASE}
              data-testid={action.testId}
            >
              {buttonLabel}
            </button>
          ) : null}
          {/* Debug mode: copy error button */}
          {onCopyError ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering dismiss
                onCopyError();
              }}
              className={cn(ACTION_BUTTON_BASE, copySuccess && "text-[var(--color-success-base)]")}
              data-testid="toast-copy-error"
            >
              {copySuccess ? "✓ Copied" : "📋 Copy Error"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={containerClassName}
      aria-label={ariaLabel}
      data-testid="toast-content"
      {...pauseHandlers}
    >
      {closeButton}
      {title ? <p className="text-sm font-semibold leading-tight">{title}</p> : null}
      <p className="text-sm leading-snug">{message}</p>
      {description ? (
        <p className="text-xs leading-snug text-[color:var(--color-text-sub-600)]">{description}</p>
      ) : null}
      {/* Debug mode: show verbose error info */}
      {debugDescription ? (
        <div className="mt-1 rounded bg-[var(--color-bg-weak-50)] p-2">
          <p className="break-all font-mono text-[10px] leading-tight text-[color:var(--color-text-sub-600)]">
            {debugDescription}
          </p>
        </div>
      ) : null}
      {/* Action buttons row */}
      <div className="flex items-center gap-3">
        {action ? (
          <button
            type="button"
            onClick={handleAction}
            className={ACTION_BUTTON_BASE}
            data-testid={action.testId}
          >
            {buttonLabel}
          </button>
        ) : null}
        {/* Debug mode: copy error button */}
        {onCopyError ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering dismiss
              onCopyError();
            }}
            className={cn(ACTION_BUTTON_BASE, copySuccess && "text-[var(--color-success-base)]")}
            data-testid="toast-copy-error"
          >
            {copySuccess ? "✓ Copied" : "📋 Copy Error"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Check if debug mode is enabled.
 * Uses Zustand store state directly since this is called outside React.
 */
function isDebugModeEnabled(): boolean {
  return useUIStore.getState().debugMode;
}

/**
 * Stateful wrapper component for debug toast with copy functionality.
 */
function DebugToastMessage({
  resolved,
  toastId,
  clipboardText,
  onDismiss,
}: {
  resolved: ResolvedToastDescriptor;
  toastId: string;
  clipboardText: string;
  onDismiss: () => void;
}) {
  const [copySuccess, setCopySuccess] = React.useState(false);

  const handleCopyError = async () => {
    const success = await copyToClipboard(clipboardText);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <ToastMessage
      title={resolved.title}
      message={resolved.message}
      description={resolved.description}
      action={resolved.action}
      status={resolved.status}
      toastId={toastId}
      debugDescription={getVerboseErrorDescription(resolved.error)}
      onCopyError={handleCopyError}
      copySuccess={copySuccess}
      dismissible={resolved.dismissible}
      closable={resolved.closable}
      onDismiss={onDismiss}
    />
  );
}

function showToast(descriptor: ToastDescriptor) {
  const resolved = normalizeDescriptor(descriptor);
  const toastFn = STATUS_TO_FN[resolved.status];
  const isDebug = isDebugModeEnabled();
  const isError = resolved.status === "error" && resolved.error;

  // In debug mode for errors, increase duration to allow reading/copying.
  // This is the duration WE enforce via our own timer manager (below).
  const effectiveDuration =
    isDebug && isError ? Math.max(resolved.duration, 8000) : resolved.duration;

  const toastOptions: ToastOptions = {
    id: resolved.id,
    // Auto-dismiss is owned by our timer manager (scheduleDismiss), not the
    // library, so it can't be frozen by react-hot-toast's global hover-pause.
    duration: Number.POSITIVE_INFINITY,
    ariaProps: {
      role: STATUS_ARIA_ROLE[resolved.status],
      "aria-live": resolved.status === "error" ? "assertive" : "polite",
    },
  };
  if (typeof resolved.icon !== "undefined") {
    toastOptions.icon = resolved.icon as any;
  }

  // Prepare clipboard text for debug mode
  const clipboardText = formatErrorForClipboard(
    resolved.error,
    resolved.context,
    resolved.devMessage
  );

  const toastId = toastFn((toastState: HotToast) => {
    const handleDismiss = () => {
      clearDismissTimer(toastState.id);
      toast.dismiss(toastState.id);
      resolved.onDismiss?.();
    };

    // Use debug component with copy functionality for errors in debug mode
    if (isDebug && isError) {
      return (
        <DebugToastMessage
          resolved={resolved}
          toastId={toastState.id}
          clipboardText={clipboardText}
          onDismiss={handleDismiss}
        />
      );
    }

    // Standard toast for non-debug or non-error cases
    return (
      <ToastMessage
        title={resolved.title}
        message={resolved.message}
        description={resolved.description}
        action={resolved.action}
        status={resolved.status}
        toastId={toastState.id}
        dismissible={resolved.dismissible}
        closable={resolved.closable}
        onDismiss={handleDismiss}
      />
    );
  }, toastOptions);

  // Own the auto-dismiss. Persistent toasts resolve to Infinity and are skipped.
  scheduleDismiss(toastId, effectiveDuration);

  logDiagnostics(resolved);
  return toastId;
}

export const toastService = {
  show: showToast,
  success: (descriptor: Omit<ToastDescriptor, "status">) =>
    showToast({ status: "success", ...descriptor }),
  error: (descriptor: Omit<ToastDescriptor, "status">) =>
    showToast({ status: "error", ...descriptor }),
  info: (descriptor: Omit<ToastDescriptor, "status">) =>
    showToast({ status: "info", ...descriptor }),
  loading: (descriptor: Omit<ToastDescriptor, "status">) =>
    showToast({ status: "loading", ...descriptor }),
  dismiss: (id?: string) => {
    clearDismissTimer(id);
    toast.dismiss(id);
  },
  dismissAll: () => {
    clearDismissTimer();
    toast.dismiss();
  },
};

export type ToastHandle = ReturnType<typeof toastService.show>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
