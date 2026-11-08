import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiRefreshLine } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";

interface SheetListHeaderProps {
  /** The count with what it counts, or the offline line; it never truncates (DL-032). */
  statusText?: string | null;
  /** Shows the compact Refresh beside the status line when set. */
  onRefresh?: () => void;
  isFetching?: boolean;
  refreshLabel?: string;
  /** Actions that sit with the status line, such as Upload all. */
  actions?: React.ReactNode;
  /** Filters, right-aligned; they give way before the status line does. */
  children?: React.ReactNode;
}

/**
 * The one header row a sheet tab's list shares, in Your Work and the bell's sheet: status line
 * and compact Refresh on the left, filters on the right (DL-032). The row keeps the height of a
 * tab that has a filter, so a tab without one (Drafts) starts its list at the same place, 16px
 * under the tab rail, and it never shrinks when the list below it scrolls.
 *
 * An action (Upload all) sits beside Refresh at normal phone sizes.
 * When the row is short of room the filters give way first, down to their 4rem
 * minimum; only then does the action's label truncate. The status line never
 * truncates. At narrow widths or enlarged text, controls wrap into additional
 * rows so actions remain readable and reachable.
 */
export const SheetListHeader: React.FC<SheetListHeaderProps> = ({
  statusText,
  onRefresh,
  isFetching,
  refreshLabel,
  actions,
  children,
}) => {
  const intl = useIntl();
  return (
    <div className="@container shrink-0">
      <div
        className="mb-4 flex min-h-14 shrink-0 items-center gap-2 px-4 pt-4 @max-[20rem]:flex-wrap"
        data-testid="sheet-list-header"
      >
        <div
          className={
            actions
              ? // Leaves the filter its 4rem minimum and the 0.5rem gap.
                "flex min-w-0 max-w-[calc(100%-4.5rem)] shrink-0 items-center gap-0.5 @max-[20rem]:w-full @max-[20rem]:max-w-full @max-[20rem]:flex-wrap @max-[20rem]:[&>button]:shrink-0"
              : "flex shrink-0 items-center gap-0.5 @max-[20rem]:w-full @max-[20rem]:flex-wrap"
          }
          data-testid="sheet-list-actions"
        >
          {statusText ? (
            <p
              role="status"
              className="shrink-0 whitespace-nowrap text-sm text-text-sub-600 @max-[20rem]:shrink @max-[20rem]:whitespace-normal"
              title={statusText}
            >
              {statusText}
            </p>
          ) : null}
          {onRefresh ? (
            <IconButton
              className="shrink-0"
              size="compact"
              aria-label={
                isFetching
                  ? intl.formatMessage({
                      id: "app.common.refreshing",
                      defaultMessage: "Refreshing...",
                    })
                  : (refreshLabel ??
                    intl.formatMessage({ id: "app.common.refresh", defaultMessage: "Refresh" }))
              }
              icon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
              loading={isFetching}
              onClick={onRefresh}
            />
          ) : null}
          {actions}
        </div>
        <div className="flex min-w-0 flex-1 justify-end">{children}</div>
      </div>
    </div>
  );
};
