import { Button } from "@green-goods/shared/components/Button";
import { EmptyState, type EmptyStateTone } from "@green-goods/shared/components/ListPrimitives";
import { trackErrorBoundary } from "@green-goods/shared/modules/app/error-events";
import { logger } from "@green-goods/shared/modules/app/logger";
import { RiAlertLine, RiArrowLeftLine, RiRefreshLine, RiWifiOffLine } from "@remixicon/react";
import { type ReactNode, useEffect } from "react";
import { useIntl } from "react-intl";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";

/**
 * One-shot self-heal for stale-deployment chunk errors: after a deploy
 * replaces the hashed chunks, every already-open session fails its next lazy
 * route load. Reloading once fetches the fresh manifest and lands back on the
 * requested URL — no manual "Reload" click. The sessionStorage guard (keyed by
 * failing path) makes a genuinely-broken chunk fall through to the error state
 * on its second failure instead of reload-looping.
 */
const CHUNK_RELOAD_GUARD_KEY = "gg-admin-chunk-reload";
/** A repeat failure inside this window means the chunk is really broken. */
const CHUNK_RELOAD_GUARD_WINDOW_MS = 60_000;

export function attemptChunkAutoRecovery(): boolean {
  try {
    const raw = sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY);
    if (raw) {
      const [guardPath, at] = raw.split("|");
      const recent = Date.now() - Number(at) < CHUNK_RELOAD_GUARD_WINDOW_MS;
      if (guardPath === location.pathname && recent) {
        return false;
      }
    }
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, `${location.pathname}|${Date.now()}`);
    window.location.reload();
    return true;
  } catch {
    // Storage unavailable (rare): fall through to the manual state rather
    // than risking a reload loop we cannot guard.
    return false;
  }
}

/**
 * Route-level error boundary for React Router.
 *
 * Catches errors that React Error Boundaries cannot:
 * - Failed lazy() chunk loads (deploy race conditions, network issues)
 * - Thrown responses from loaders/actions
 * - Any unhandled error during route resolution
 *
 * Placed on a pathless wrapper inside CanvasShell's children so the
 * sidebar/header stay visible when a child route errors.
 * Also placed on the root route as a full-page fallback.
 */
export default function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();

  const isChunkError = isChunkLoadError(error);
  const isNetwork = isNetworkError(error);
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    const normalizedError = error instanceof Error ? error : new Error(extractMessage(error));

    logger.error("[RouteErrorBoundary] Route error caught", {
      message: normalizedError.message,
      isChunkError,
      isNetwork,
      isNotFound,
    });

    trackErrorBoundary(normalizedError, {
      boundaryName: "RouteErrorBoundary",
      isNetwork: isNetwork || isChunkError,
    });

    // Stale-deployment self-heal: reload once per failing path before ever
    // showing the manual state (the reload interrupts render, so the state
    // below only appears on a repeat failure).
    if (isChunkError) {
      attemptChunkAutoRecovery();
    }
  }, [error, isChunkError, isNetwork, isNotFound]);

  // Chunk errors = stale deployment, hard reload fixes it. Reaching this
  // render twice for the same path means the auto-recovery already spent its
  // one shot, so show the manual state.
  if (isChunkError) {
    return (
      <RouteErrorState
        icon={<RiRefreshLine />}
        tone="neutral"
        title={formatMessage({ id: "app.error.route.chunk.title" })}
        description={formatMessage({ id: "app.error.route.chunk.description" })}
        technicalDetailsLabel={formatMessage({ id: "app.error.route.technicalDetails" })}
        actions={
          <Button
            type="button"
            emphasis="primary"
            size="sm"
            leadingIcon={<RiRefreshLine className="h-[18px] w-[18px]" aria-hidden="true" />}
            onClick={() => window.location.reload()}
          >
            {formatMessage({ id: "app.error.route.chunk.action" })}
          </Button>
        }
      />
    );
  }

  if (isNetwork) {
    return (
      <RouteErrorState
        icon={<RiWifiOffLine />}
        tone="warning"
        title={formatMessage({ id: "app.error.route.network.title" })}
        description={formatMessage({ id: "app.error.route.network.description" })}
        technicalDetailsLabel={formatMessage({ id: "app.error.route.technicalDetails" })}
        actions={
          <Button
            type="button"
            emphasis="primary"
            size="sm"
            leadingIcon={<RiRefreshLine className="h-[18px] w-[18px]" aria-hidden="true" />}
            onClick={() => window.location.reload()}
          >
            {formatMessage({ id: "app.error.route.network.action" })}
          </Button>
        }
      />
    );
  }

  // Generic route error (render crash, unexpected throw, etc.)
  return (
    <RouteErrorState
      icon={<RiAlertLine />}
      tone="error"
      title={formatMessage({ id: "app.error.route.generic.title" })}
      description={formatMessage({ id: "app.error.route.generic.description" })}
      technicalDetailsLabel={formatMessage({ id: "app.error.route.technicalDetails" })}
      details={import.meta.env.DEV ? extractMessage(error) : undefined}
      actions={
        <div className="flex gap-3">
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            leadingIcon={<RiArrowLeftLine className="h-[18px] w-[18px]" aria-hidden="true" />}
            onClick={() => navigate(-1)}
          >
            {formatMessage({ id: "app.error.route.generic.actionBack" })}
          </Button>
          <Button
            type="button"
            emphasis="primary"
            size="sm"
            leadingIcon={<RiRefreshLine className="h-[18px] w-[18px]" aria-hidden="true" />}
            onClick={() => window.location.reload()}
          >
            {formatMessage({ id: "app.error.route.generic.actionReload" })}
          </Button>
        </div>
      }
    />
  );
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * A route that failed, as the state block: the page's space keeps the shell
 * around it, and every kind of failure is announced, as a failed read is.
 */
function RouteErrorState({
  icon,
  tone,
  title,
  description,
  details,
  technicalDetailsLabel,
  actions,
}: {
  icon: ReactNode;
  tone: EmptyStateTone;
  title: string;
  description: string;
  details?: string;
  technicalDetailsLabel: string;
  actions: ReactNode;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-6 py-24"
      // The failure tone announces itself; the others are announced here.
      role={tone === "error" ? undefined : "alert"}
    >
      <EmptyState
        titleAs="h2"
        tone={tone}
        icon={icon}
        title={title}
        description={description}
        action={actions}
      />
      {details && (
        <details className="w-full max-w-md text-left">
          <summary className="cursor-pointer type-label-sm text-text-soft hover:text-text-sub">
            {technicalDetailsLabel}
          </summary>
          <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-bg-soft p-3 type-meta text-text-sub">
            {details}
          </pre>
        </details>
      )}
    </div>
  );
}

function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("failed to fetch dynamically imported module") ||
      msg.includes("loading chunk") ||
      msg.includes("loading css chunk") ||
      msg.includes("dynamically imported module")
    );
  }
  return false;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("network error") || msg.includes("failed to fetch") || msg.includes("net::err_")
    );
  }
  return false;
}

function extractMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}: ${error.data}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
