import { SideSheet } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AccountSurface } from "./AccountSurface";
import { type AccountSheetTab } from "./accountSheet.events";

interface AccountSheetProps {
  open: boolean;
  activeTab: AccountSheetTab;
  onClose: () => void;
  onTabChange: (tab: AccountSheetTab) => void;
  container?: HTMLElement | null;
}

export function AccountSheet({
  open,
  activeTab,
  onClose,
  onTabChange,
  container,
}: AccountSheetProps) {
  const { formatMessage } = useIntl();

  const title =
    activeTab === "settings"
      ? formatMessage({ id: "cockpit.settings.title", defaultMessage: "Settings" })
      : formatMessage({ id: "cockpit.profile.title", defaultMessage: "Profile" });
  const description = formatMessage({
    id: "cockpit.profile.description",
    defaultMessage: "Manage your canvas identity, appearance, and operator preferences.",
  });

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      container={container}
    >
      <AccountSurface activeTab={activeTab} onTabChange={onTabChange} />
    </SideSheet>
  );
}
