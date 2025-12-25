import React from "react";
import { useIntl } from "react-intl";
import { BeatLoader } from "../Progress/Loader";

export interface ListStateProps<T> {
  /** Items to render */
  items: T[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether there was an error */
  hasError?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Custom loading message */
  loadingMessage?: string;
  /** Emoji or icon for empty state */
  emptyIcon?: string;
  /** Title for empty state */
  emptyTitle: string;
  /** Description for empty state */
  emptyDescription: string;
  /** Function to render items when available */
  renderItems: (items: T[]) => React.ReactNode;
  /** Optional retry callback for errors */
  onRetry?: () => void;
  /** Optional header content (filters, etc.) */
  headerContent?: React.ReactNode;
  /** Optional count message when items exist */
  countMessage?: (count: number) => string;
}

/**
 * Reusable component for handling list loading, error, and empty states.
 * Reduces duplication across dashboard tabs.
 */
export function ListState<T>({
  items,
  isLoading,
  hasError,
  errorMessage,
  loadingMessage,
  emptyIcon = "📭",
  emptyTitle,
  emptyDescription,
  renderItems,
  onRetry,
  headerContent,
  countMessage,
}: ListStateProps<T>) {
  const intl = useIntl();

  const defaultLoadingMessage = intl.formatMessage({
    id: "common.loading",
    defaultMessage: "Loading...",
  });

  const defaultErrorTitle = intl.formatMessage({
    id: "common.error.title",
    defaultMessage: "Unable to load data",
  });

  const defaultErrorMessage = intl.formatMessage({
    id: "common.error.description",
    defaultMessage: "There was an error loading your data. Please check your connection and try again.",
  });

  const retryLabel = intl.formatMessage({
    id: "common.retry",
    defaultMessage: "Retry",
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header with optional count and controls */}
      <div className="mb-4 px-4 pt-4 flex items-center justify-between gap-3">
        <div>
          {isLoading ? null : hasError ? (
            <p className="text-sm text-red-600">
              {intl.formatMessage({
                id: "common.error.fetchingData",
                defaultMessage: "Error loading data. Please try again.",
              })}
            </p>
          ) : items.length > 0 && countMessage ? (
            <p className="text-sm text-slate-600">{countMessage(items.length)}</p>
          ) : null}
        </div>
        {headerContent}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
        {isLoading ? (
          <div className="list-state-loading">
            <BeatLoader />
            <p className="list-state-loading-text">
              {loadingMessage || defaultLoadingMessage}
            </p>
          </div>
        ) : hasError ? (
          <div className="list-state-error">
            <div className="list-state-error-icon">⚠️</div>
            <p className="list-state-error-title">{defaultErrorTitle}</p>
            <p className="list-state-error-message">
              {errorMessage || defaultErrorMessage}
            </p>
            {onRetry && (
              <button onClick={onRetry} className="list-state-retry-btn">
                {retryLabel}
              </button>
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="list-state-empty">
            <div className="list-state-empty-icon">{emptyIcon}</div>
            <p className="list-state-empty-title">{emptyTitle}</p>
            <p className="list-state-empty-description">{emptyDescription}</p>
          </div>
        ) : (
          renderItems(items)
        )}
      </div>
    </div>
  );
}

export default ListState;
