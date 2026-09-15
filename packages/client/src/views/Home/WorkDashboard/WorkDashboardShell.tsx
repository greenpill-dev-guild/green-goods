import { PwaSheet } from "@green-goods/shared/components/Dialog/PwaSheet";
import type React from "react";
import { useIntl } from "react-intl";
import { type StandardTab, StandardTabs } from "@/components/Navigation";

interface WorkDashboardShellProps {
  className?: string;
  /** True once the close animation has started: the sheet plays its exit pose. */
  isClosing: boolean;
  onRequestClose: () => void;
  tabs: StandardTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
}

/**
 * The dashboard's sheet chrome: the shared bottom sheet at the full tier with
 * the one sheet header (DL-028), the tab rail directly under it, and the
 * sheet body as the single scroll owner for tab content. Open/close state
 * stays with WorkDashboard so the data hooks and the close timer share one
 * owner; the sheet itself registers as open so the AppBar steps aside
 * (DL-015).
 */
export const WorkDashboardShell: React.FC<WorkDashboardShellProps> = ({
  className,
  isClosing,
  onRequestClose,
  tabs,
  activeTab,
  onTabChange,
  children,
}) => {
  const intl = useIntl();

  return (
    <PwaSheet
      open={!isClosing}
      onClose={onRequestClose}
      size="full"
      title={intl.formatMessage({
        id: "app.workDashboard.title",
        defaultMessage: "Your Work",
      })}
      description={intl.formatMessage({
        id: "app.workDashboard.description",
        defaultMessage: "Track work submissions and reviews",
      })}
      closeLabel={intl.formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
      closeTestId="app-sheet-close"
      testId="app-sheet"
      panelClassName={className}
      tabs={
        <StandardTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          ariaLabel={intl.formatMessage({
            id: "app.work.tabs.label",
            defaultMessage: "Work sections",
          })}
          triggerClassName="text-xs"
          scrollTargetSelector="#work-dashboard-scroll"
        />
      }
      bodyProps={{ id: "work-dashboard-scroll" }}
      bodyClassName="overflow-x-hidden p-0"
    >
      {children}
    </PwaSheet>
  );
};
