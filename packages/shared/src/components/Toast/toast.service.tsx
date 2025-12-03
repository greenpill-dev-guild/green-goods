import type { ReactNode } from "react";
import toast, { type Toast as HotToast, type ToastOptions } from "react-hot-toast";
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
}

interface ToastMessageProps {
  title?: string;
  message: string;
  description?: string;
  action?: ToastAction;
  toastId?: string;
  status: ToastStatus;
}

const DEFAULT_DURATIONS: Record<ToastStatus, number> = {
  success: 3000,
  error: 4500,
  info: 3500,
  loading: 60000,
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
  } = descriptor;

  const normalizedMessage = message ?? buildDefaultMessage(status, context);
  const normalizedTitle = title ?? buildDefaultTitle(status, context);

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

function ToastMessage({ title, message, description, action, toastId, status }: ToastMessageProps) {
  const buttonLabel = action?.label ?? "";
  const handleAction = () => {
    if (!action) return;
    if (action.dismissOnClick !== false && toastId) {
      toast.dismiss(toastId);
    }
    action.onClick();
  };

  const ariaLabel = title ? `${title}: ${message}` : undefined;

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1 text-[color:var(--color-text-strong-950)]",
        status === "loading" && "animate-pulse"
      )}
      aria-label={ariaLabel}
    >
      {title ? <p className="text-sm font-semibold leading-tight">{title}</p> : null}
      <p className="text-sm leading-snug">{message}</p>
      {description ? (
        <p className="text-xs leading-snug text-[color:var(--color-text-subtle-600)]">
          {description}
        </p>
      ) : null}
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
    </div>
  );
}

function showToast(descriptor: ToastDescriptor) {
  const resolved = normalizeDescriptor(descriptor);
  const toastFn = STATUS_TO_FN[resolved.status];
  const toastOptions: ToastOptions = {
    id: resolved.id,
    duration: resolved.duration,
    ariaProps: {
      role: STATUS_ARIA_ROLE[resolved.status],
      "aria-live": resolved.status === "error" ? "assertive" : "polite",
    },
  };
  if (typeof resolved.icon !== "undefined") {
    toastOptions.icon = resolved.icon as any;
  }

  const toastId = toastFn(
    (toastState: HotToast) => (
      <ToastMessage
        title={resolved.title}
        message={resolved.message}
        description={resolved.description}
        action={resolved.action}
        status={resolved.status}
        toastId={toastState.id}
      />
    ),
    toastOptions
  );

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
