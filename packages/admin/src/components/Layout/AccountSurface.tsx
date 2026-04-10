import { cn } from "@green-goods/shared";
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
    <div
      role="tablist"
      aria-label={formatMessage({
        id: "cockpit.topBar.userProfile",
        defaultMessage: "User profile",
      })}
      className={cn(
        "inline-flex rounded-2xl bg-bg-soft p-1 shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.04)]",
        className
      )}
    >
      {ACCOUNT_TABS.map((tab) => {
        const isActive = activeTab === tab;
        const label =
          tab === "settings"
            ? formatMessage({ id: "cockpit.settings.title", defaultMessage: "Settings" })
            : formatMessage({ id: "cockpit.nav.profile", defaultMessage: "Profile" });

        return (
          <button
            key={tab}
            id={`account-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`account-panel-${tab}`}
            onClick={() => onTabChange(tab)}
            className={cn(
              "min-w-[7rem] rounded-[1rem] px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-bg-white text-text-strong shadow-[var(--edge-rest),var(--elevation-1)]"
                : "text-text-sub hover:text-text-strong"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AccountTabPanels({ activeTab, className }: AccountTabPanelsProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        id="account-panel-profile"
        role="tabpanel"
        aria-labelledby="account-tab-profile"
        hidden={activeTab !== "profile"}
      >
        {activeTab === "profile" ? <AccountProfilePanel /> : null}
      </div>

      <div
        id="account-panel-settings"
        role="tabpanel"
        aria-labelledby="account-tab-settings"
        hidden={activeTab !== "settings"}
      >
        {activeTab === "settings" ? <AccountSettingsPanel /> : null}
      </div>
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
