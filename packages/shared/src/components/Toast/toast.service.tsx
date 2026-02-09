import * as React from "react";
import type { ReactNode } from "react";
import toast, { type Toast as HotToast, type ToastOptions } from "react-hot-toast";
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
  /** Optional toast action rendered as a subtle button. */
  action?: ToastAction;
  /** Optional flag to silence diagnostics for known, handled errors. */
  suppressLogging?: boolean;
  /** Optional icon override (emoji or React component). */
  icon?: ReactNode;
  /** Whether the toast can be dismissed by tapping on it. Defaults to true for success/info/error, false for loading. */
  dismissible?: boolean;
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
  action?: ToastAction;
  context?: string;
  error?: unknown;
  devMessage?: string;
  suppressLogging?: boolean;
  icon?: ReactNode;
  dismissible: boolean;
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
  "inline-flex items-center text-xs font-medium text-[var(--color-primary-base)] hover:text-[var(--color-primary-strong)] focus:outline-none focus:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary-base)] rounded transition-colors";

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
    context,
    action,
    error,
    devMessage,
    suppressLogging,
    icon,
    dismissible,
  } = descriptor;

  const normalizedMessage = message ?? buildDefaultMessage(status, context);
  const normalizedTitle = title ?? buildDefaultTitle(status, context);

  // Default: loading toasts are NOT dismissible, others are
  const normalizedDismissible = dismissible ?? status !== "loading";

  return {
    id,
    status,
    title: normalizedTitle,
    message: normalizedMessage,
    description,
    duration: duration ?? DEFAULT_DURATIONS[status],
    action,
    context,
    error,
    devMessage,
    suppressLogging,
    icon,
    dismissible: normalizedDismissible,
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
    console.error(
      `[toast:error] ${resolved.context ?? resolved.title ?? "operation failed"}`,
      resolved.error
    );
  }

  if (diagnostic) {
    console.error(`[toast:detail] ${diagnostic}`);
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
  onDismiss,
}: ToastMessageProps) {
  const buttonLabel = action?.label ?? "";
  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering dismiss when clicking action button
    if (!action) return;
    if (action.dismissOnClick !== false && toastId) {
      toast.dismiss(toastId);
    }
    action.onClick();
  };

  const handleDismiss = () => {
    if (dismissible && onDismiss) {
      onDismiss();
    }
  };

  const ariaLabel = title ? `${title}: ${message}` : undefined;

  const containerClassName = cn(
    "flex w-full flex-col gap-1 text-[color:var(--color-text-strong-950)] text-left rounded",
    status === "loading" && "animate-pulse",
    dismissible && "cursor-pointer",
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
        tabIndex={0}
        className={containerClassName}
        aria-label={ariaLabel}
        onClick={handleContainerClick}
        onKeyDown={handleKeyDown}
      >
        {title ? <p className="text-sm font-semibold leading-tight">{title}</p> : null}
        <p className="text-sm leading-snug">{message}</p>
        {description ? (
          <p className="text-xs leading-snug text-[color:var(--color-text-subtle-600)]">
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
    <div className={containerClassName} aria-label={ariaLabel}>
      {title ? <p className="text-sm font-semibold leading-tight">{title}</p> : null}
      <p className="text-sm leading-snug">{message}</p>
      {description ? (
        <p className="text-xs leading-snug text-[color:var(--color-text-subtle-600)]">
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
      onDismiss={onDismiss}
    />
  );
}

function showToast(descriptor: ToastDescriptor) {
  const resolved = normalizeDescriptor(descriptor);
  const toastFn = STATUS_TO_FN[resolved.status];
  const isDebug = isDebugModeEnabled();
  const isError = resolved.status === "error" && resolved.error;

  // In debug mode for errors, increase duration to allow reading/copying
  const debugDuration = isDebug && isError ? Math.max(resolved.duration, 8000) : resolved.duration;

  const toastOptions: ToastOptions = {
    id: resolved.id,
    duration: debugDuration,
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
    const handleDismiss = () => toast.dismiss(toastState.id);

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
        onDismiss={handleDismiss}
      />
    );
  }, toastOptions);

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
  dismiss: (id?: string) => toast.dismiss(id),
  dismissAll: () => toast.dismiss(),
};

export type ToastHandle = ReturnType<typeof toastService.show>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
