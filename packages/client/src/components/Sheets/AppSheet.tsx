import { CountBadge } from "@green-goods/shared/components/Badge/Badge";
import { PwaSheet, type SheetSize } from "@green-goods/shared/components/Dialog/PwaSheet";
import type { SheetActionsProps } from "@green-goods/shared/components/Dialog/SheetActions";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type FC, type ReactNode, useId, useState } from "react";
import { useIntl } from "react-intl";
import { TAB_ICON, TAB_RAIL, TAB_SIZING } from "@/components/Navigation/Tabs/tabRailStyles";
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
  covered?: boolean;
  entryMotion?: "slide" | "instant";
  viewTransitionName?: string;
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
   * Names a read-only body that scrolls and makes it focusable, so a keyboard
   * can scroll it. Tabbed sheets name their panel by the tab instead.
   */
  bodyLabel?: string;
  /** Holds the sheet open while an act it started is still in flight. */
  preventClose?: boolean;
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
  covered,
  entryMotion,
  viewTransitionName,
  header,
  tabs = [],
  activeTab,
  onTabChange,
  children,
  actions,
  className,
  contentClassName,
  bodyLabel,
  preventClose = false,
  size,
}) => {
  const { formatMessage } = useIntl();
  const idPrefix = useId();
  const tabPanelId = `${idPrefix}-panel`;
  const tabId = (id: string) => `${idPrefix}-tab-${id}`;
  const hasTabs = tabs.length > 0;
  // Manual activation: moving focus does not open a tab or mark its notifications seen.
  const [focusedTab, setFocusedTab] = useState<string | null>(null);
  const entryTab = tabs.some((tab) => tab.id === focusedTab)
    ? focusedTab
    : (activeTab ?? tabs[0]?.id);

  const rail = hasTabs ? (
    <div
      className={cn(pwaSheetStyles.tabs, TAB_RAIL)}
      role="tablist"
      aria-label={header.title}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusedTab(null);
      }}
    >
      {tabs.map((tab, index) => (
        <button
          type="button"
          key={tab.id}
          id={tabId(tab.id)}
          onClick={() => onTabChange?.(tab.id)}
          role="tab"
          tabIndex={entryTab === tab.id ? 0 : -1}
          onFocus={() => setFocusedTab(tab.id)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % tabs.length
                : event.key === "ArrowLeft"
                  ? (index + tabs.length - 1) % tabs.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : null;
            if (next === null) return;
            event.preventDefault();
            document.getElementById(tabId(tabs[next].id))?.focus();
          }}
          aria-selected={activeTab === tab.id}
          aria-controls={tabPanelId}
          className={cn(
            pwaSheetStyles.tabTrigger,
            TAB_SIZING,
            activeTab === tab.id ? pwaSheetStyles.tabActive : pwaSheetStyles.tabInactive
          )}
          data-testid={`tab-${tab.id}`}
        >
          {tab.icon && (
            <span className={cn(TAB_ICON, activeTab === tab.id && pwaSheetStyles.tabActiveIcon)}>
              {tab.icon}
            </span>
          )}
          <span className="min-w-0 truncate whitespace-nowrap">{tab.label}</span>
          {tab.count !== undefined && <CountBadge count={tab.count} />}
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
      covered={covered}
      entryMotion={entryMotion}
      viewTransitionName={viewTransitionName}
      size={size}
      preventClose={preventClose}
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
              tabIndex: 0,
            }
          : bodyLabel
            ? { tabIndex: 0, role: "region", "aria-label": bodyLabel }
            : undefined
      }
      actions={actions}
    >
      {children}
    </PwaSheet>
  );
};
