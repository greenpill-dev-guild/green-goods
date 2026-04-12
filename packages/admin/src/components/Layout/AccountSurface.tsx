import { CanvasStageTabRail, cn } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AccountProfilePanel } from "./AccountProfilePanel";
import { AccountSettingsPanel } from "./AccountSettingsPanel";
import { type AccountSheetTab } from "./accountSheet.events";

interface AccountSurfaceProps {
  activeTab: AccountSheetTab;
  onTabChange: (tab: AccountSheetTab) => void;
  className?: string;
}

const ACCOUNT_TABS: AccountSheetTab[] = ["profile", "settings"];

interface AccountTabListProps {
  activeTab: AccountSheetTab;
  onTabChange: (tab: AccountSheetTab) => void;
  className?: string;
}

interface AccountTabPanelsProps {
  activeTab: AccountSheetTab;
  className?: string;
}

export function AccountTabList({
  activeTab,
  onTabChange,
  className,
}: AccountTabListProps) {
  const { formatMessage } = useIntl();

  return (
    <CanvasStageTabRail
      ariaLabel={formatMessage({
        id: "cockpit.topBar.userProfile",
        defaultMessage: "User profile",
      })}
      activeId={activeTab}
      onChange={(nextTab) => onTabChange(nextTab as AccountSheetTab)}
      idBase="account"
      tabs={ACCOUNT_TABS.map((tab) => ({
        id: tab,
        label:
          tab === "settings"
            ? formatMessage({ id: "cockpit.settings.title", defaultMessage: "Settings" })
            : formatMessage({ id: "cockpit.nav.profile", defaultMessage: "Profile" }),
      }))}
      className={cn("w-full", className)}
    />
  );
}

export function AccountTabPanels({ activeTab, className }: AccountTabPanelsProps) {
  return (
    <div
      id="account-panel"
      role="tabpanel"
      aria-labelledby={`account-tab-${activeTab}`}
      className={cn("flex flex-col gap-4", className)}
    >
      {activeTab === "settings" ? <AccountSettingsPanel /> : <AccountProfilePanel />}
    </div>
  );
}

export function AccountSurface({
  activeTab,
  onTabChange,
  className,
}: AccountSurfaceProps) {
  return (
    <div className={cn("flex flex-col gap-4 p-4 sm:p-5", className)}>
      <AccountTabList activeTab={activeTab} onTabChange={onTabChange} />
      <AccountTabPanels activeTab={activeTab} />
    </div>
  );
}
