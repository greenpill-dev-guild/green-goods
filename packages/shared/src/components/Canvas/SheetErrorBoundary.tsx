import { RiAlertLine, RiCloseLine, RiRefreshLine } from "@remixicon/react";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { logger } from "../../modules/app/logger";
import { Button } from "../Button";
import { ErrorBoundary } from "../ErrorBoundary/ErrorBoundary";
import { EmptyState } from "../ListPrimitives";

export interface SheetErrorBoundaryProps {
  children: React.ReactNode;
  onClose?: () => void;
}

/**
 * Error boundary designed for dialog / inspector panel contexts.
 *
 * Renders the state block within sheet dimensions instead of a full-page
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
    <EmptyState
      tone="error"
      icon={<RiAlertLine />}
      title={titleLabel}
      action={
        <div className="flex items-center gap-3">
          <Button size="sm" leadingIcon={<RiRefreshLine />} onClick={onRetry}>
            {retryLabel}
          </Button>
          {onClose && (
            <Button size="sm" emphasis="secondary" leadingIcon={<RiCloseLine />} onClick={onClose}>
              {closeLabel}
            </Button>
          )}
        </div>
      }
    />
  );
}
