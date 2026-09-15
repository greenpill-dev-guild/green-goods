import { PwaSheet, type SheetSize } from "@green-goods/shared/components/Dialog/PwaSheet";
import type { SheetActionsProps } from "@green-goods/shared/components/Dialog/SheetActions";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type FC, type ReactNode, useId } from "react";
import { useIntl } from "react-intl";
import { pwaSheetStyles } from "@/components/Pwa/sheetStyles";

export interface AppSheetTab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  badge?: ReactNode;
}

export interface AppSheetHeaderProps {
  title: string;
  description?: string;
}

export interface AppSheetProps {
  isOpen: boolean;
  onClose: () => void;
  header: AppSheetHeaderProps;
  tabs?: AppSheetTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: ReactNode;
  /**
   * The sheet's actions, pinned under the content in the shared action bar
   * (DL-016). The sheet pads the device's bottom safe area itself.
   */
  actions?: SheetActionsProps;
  className?: string;
  contentClassName?: string;
  /**
   * Height tier (DL-014). `compact` sizes to its content up to the half
   * height; `half`, `tall`, and `full` hold 50%, 70%, and 85% of the viewport.
   * Tabbed sheets use `full` so switching tabs never resizes them.
   */
  size: SheetSize;
}

/**
 * The installed app's workspace sheet: the shared bottom sheet (`PwaSheet`)
 * with the one sheet header (DL-028), an optional tab rail directly under it,
 * and the shared action bar. The content region is the sheet's single scroll
 * owner unless a consumer passes its own `contentClassName` (tabbed sheets
 * scroll per tab).
 *
 * The sheet renders into <body> through a portal and registers itself as
 * open, so the AppBar steps aside while it shows (DL-015); it drags to
 * dismiss like every other sheet.
 */
export const AppSheet: FC<AppSheetProps> = ({
  isOpen,
  onClose,
  header,
  tabs = [],
  activeTab,
  onTabChange,
  children,
  actions,
  className,
  contentClassName,
  size,
}) => {
  const { formatMessage } = useIntl();
  const idPrefix = useId();
  const tabPanelId = `${idPrefix}-panel`;
  const tabId = (id: string) => `${idPrefix}-tab-${id}`;
  const hasTabs = tabs.length > 0;

  const rail = hasTabs ? (
    <div className={pwaSheetStyles.tabs} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={tabId(tab.id)}
          onClick={() => onTabChange?.(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={tabPanelId}
          className={cn(
            pwaSheetStyles.tabTrigger,
            activeTab === tab.id ? pwaSheetStyles.tabActive : pwaSheetStyles.tabInactive
          )}
          data-testid={`tab-${tab.id}`}
        >
          {tab.icon && (
            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-sm [&>i]:text-base [&>svg]:h-4 [&>svg]:w-4">
              {tab.icon}
            </span>
          )}
          <span className="min-w-0 truncate whitespace-nowrap">{tab.label}</span>
          {tab.count !== undefined && tab.count > 0 && (
            <span
              className={cn(
                "inline-flex items-center justify-center text-xs font-medium rounded-full min-w-[16px] h-4 px-1 flex-shrink-0",
                pwaSheetStyles.tabBadge
              )}
            >
              {tab.count > 99 ? "99+" : tab.count}
            </span>
          )}
          {tab.badge}
          {activeTab === tab.id && (
            <div
              className={cn("absolute bottom-0 left-0 right-0 h-0.5", pwaSheetStyles.tabIndicator)}
            />
          )}
        </button>
      ))}
    </div>
  ) : undefined;

  return (
    <PwaSheet
      open={isOpen}
      onClose={onClose}
      size={size}
      title={header.title}
      description={header.description}
      closeLabel={formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
      closeTestId="app-sheet-close"
      testId="app-sheet"
      panelClassName={className}
      tabs={rail}
      bodyClassName={contentClassName}
      bodyProps={
        hasTabs
          ? {
              id: tabPanelId,
              role: "tabpanel",
              "aria-labelledby": activeTab ? tabId(activeTab) : undefined,
            }
          : undefined
      }
      actions={actions}
    >
      {children}
    </PwaSheet>
  );
};
