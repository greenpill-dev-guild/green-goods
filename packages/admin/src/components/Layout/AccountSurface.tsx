import { cn, type AccountSheetTab } from "@green-goods/shared";
import { AdminTabRail } from "@/components/AdminTabRail";
import { useIntl } from "react-intl";
import { AccountProfilePanelContainer } from "./AccountProfilePanel";
import { AccountSettingsPanel } from "./AccountSettingsPanel";

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

export function AccountTabList({ activeTab, onTabChange, className }: AccountTabListProps) {
  const { formatMessage } = useIntl();

  return (
    <AdminTabRail
      ariaLabel={formatMessage({
        id: "cockpit.topBar.userProfile",
        defaultMessage: "User profile",
      })}
      activeId={activeTab}
      onChange={(nextTab) => onTabChange(nextTab as AccountSheetTab)}
      idBase="account"
      tabs={ACCOUNT_TABS.map((tab) => ({
        id: tab,
        // The identity tab is "Account" in the product vocabulary (it holds
        // the same content as the desktop Profile sheet); the internal tab id
        // stays "profile" so deep links (?tab=) and the sheet registry are
        // unchanged.
        label:
          tab === "settings"
            ? formatMessage({ id: "cockpit.settings.title", defaultMessage: "Settings" })
            : formatMessage({ id: "cockpit.nav.account", defaultMessage: "Account" }),
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
      {activeTab === "settings" ? <AccountSettingsPanel /> : <AccountProfilePanelContainer />}
    </div>
  );
}

export function AccountSurface({ activeTab, onTabChange, className }: AccountSurfaceProps) {
  return (
    <div className={cn("flex flex-col gap-4 p-4 sm:p-5", className)}>
      <AccountTabList activeTab={activeTab} onTabChange={onTabChange} />
      <AccountTabPanels activeTab={activeTab} />
    </div>
  );
}
