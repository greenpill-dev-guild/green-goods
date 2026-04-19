import { Button, logger, trackErrorBoundary } from "@green-goods/shared";
import { RiAlertLine, RiArrowLeftLine, RiRefreshLine, RiWifiOffLine } from "@remixicon/react";
import { type ReactNode, useEffect } from "react";
import { useIntl } from "react-intl";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";

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
  }, [error, isChunkError, isNetwork, isNotFound]);

  // Chunk errors = stale deployment, hard reload fixes it
  if (isChunkError) {
    return (
      <ErrorCard
        icon={<RiRefreshLine className="h-6 w-6 text-information-dark" />}
        iconBg="bg-information-lighter"
        title={formatMessage({ id: "app.error.route.chunk.title" })}
        description={formatMessage({ id: "app.error.route.chunk.description" })}
        technicalDetailsLabel={formatMessage({ id: "app.error.route.technicalDetails" })}
        actions={
          <Button onClick={() => window.location.reload()}>
            <RiRefreshLine className="h-4 w-4" />
            {formatMessage({ id: "app.error.route.chunk.action" })}
          </Button>
        }
      />
    );
  }

  if (isNetwork) {
    return (
      <ErrorCard
        icon={<RiWifiOffLine className="h-6 w-6 text-warning-dark" />}
        iconBg="bg-warning-lighter"
        title={formatMessage({ id: "app.error.route.network.title" })}
        description={formatMessage({ id: "app.error.route.network.description" })}
        technicalDetailsLabel={formatMessage({ id: "app.error.route.technicalDetails" })}
        actions={
          <Button onClick={() => window.location.reload()}>
            <RiRefreshLine className="h-4 w-4" />
            {formatMessage({ id: "app.error.route.network.action" })}
          </Button>
        }
      />
    );
  }

  // Generic route error (render crash, unexpected throw, etc.)
  return (
    <ErrorCard
      icon={<RiAlertLine className="h-6 w-6 text-error-dark" />}
      iconBg="bg-error-lighter"
      title={formatMessage({ id: "app.error.route.generic.title" })}
      description={formatMessage({ id: "app.error.route.generic.description" })}
      technicalDetailsLabel={formatMessage({ id: "app.error.route.technicalDetails" })}
      details={import.meta.env.DEV ? extractMessage(error) : undefined}
      actions={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <RiArrowLeftLine className="h-4 w-4" />
            {formatMessage({ id: "app.error.route.generic.actionBack" })}
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RiRefreshLine className="h-4 w-4" />
            {formatMessage({ id: "app.error.route.generic.actionReload" })}
          </Button>
        </div>
      }
    />
  );
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function ErrorCard({
  icon,
  iconBg,
  title,
  description,
  details,
  technicalDetailsLabel,
  actions,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  description: string;
  details?: string;
  technicalDetailsLabel: string;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-md animate-fade-in-up" role="alert">
        <div className="rounded-xl border border-stroke-soft bg-bg-white p-8 text-center shadow-sm">
          <div
            className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}
          >
            {icon}
          </div>
          <h2 className="text-lg font-semibold text-text-strong">{title}</h2>
          <p className="mt-2 text-sm text-text-sub">{description}</p>
          {details && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-xs font-medium text-text-soft hover:text-text-sub">
                {technicalDetailsLabel}
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-bg-soft p-3 text-xs text-text-sub">
                {details}
              </pre>
            </details>
          )}
          <div className="mt-6">{actions}</div>
        </div>
      </div>
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
