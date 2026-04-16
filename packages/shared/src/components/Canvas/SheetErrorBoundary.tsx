import { RiAlertLine, RiCloseLine, RiRefreshLine } from "@remixicon/react";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { logger } from "../../modules/app/logger";
import { cn } from "../../utils";
import { ErrorBoundary } from "../ErrorBoundary/ErrorBoundary";

export interface SheetErrorBoundaryProps {
  children: React.ReactNode;
  onClose?: () => void;
}

/**
 * Error boundary designed for sheet (SideSheet/BottomSheet) contexts.
 *
 * Renders a compact error card within sheet dimensions instead of a full-page
 * fallback. Errors are caught and logged but never propagate to the parent,
 * keeping the toolbar functional.
 *
 * - Retry re-renders children without closing the sheet.
 * - Close calls `onClose` to dismiss the sheet.
 */
export function SheetErrorBoundary({ children, onClose }: SheetErrorBoundaryProps) {
  const { formatMessage } = useIntl();
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  return (
    <ErrorBoundary
      key={retryKey}
      context="SheetErrorBoundary"
      onError={(error, errorInfo) => {
        logger.error("[SheetErrorBoundary] Caught error in sheet content", {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        });
      }}
      fallback={(error, reset) => (
        <SheetErrorFallback
          error={error}
          onRetry={() => {
            reset();
            handleRetry();
          }}
          onClose={onClose}
          retryLabel={formatMessage({ id: "app.common.retry" })}
          closeLabel={formatMessage({ id: "app.common.close" })}
          titleLabel={formatMessage({ id: "app.common.failedToLoad" })}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

interface SheetErrorFallbackProps {
  error: Error;
  onRetry: () => void;
  onClose?: () => void;
  retryLabel: string;
  closeLabel: string;
  titleLabel: string;
}

function SheetErrorFallback({
  error: _error,
  onRetry,
  onClose,
  retryLabel,
  closeLabel,
  titleLabel,
}: SheetErrorFallbackProps) {
  return (
    <div
      role="alert"
      className={cn(
        "mx-4 my-6 flex flex-col items-center gap-4 rounded-xl",
        "border border-stroke-soft bg-bg-weak p-6 text-center"
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error-lighter">
        <RiAlertLine className="h-5 w-5 text-error-base" />
      </div>

      <p className="text-sm font-medium text-text-strong">{titleLabel}</p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2",
            "bg-bg-strong text-sm font-medium text-text-white",
            "transition-colors hover:bg-bg-strong/90",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
          )}
        >
          <RiRefreshLine className="h-4 w-4" />
          {retryLabel}
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2",
              "bg-bg-weak text-sm font-medium text-text-sub",
              "border border-stroke-soft",
              "transition-colors hover:bg-bg-soft",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
            )}
          >
            <RiCloseLine className="h-4 w-4" />
            {closeLabel}
          </button>
        )}
      </div>
    </div>
  );
}
