import { RightSheet } from "@green-goods/shared";
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
  return (
    <RightSheet open={open} onClose={onClose} container={container}>
      <AccountSurface activeTab={activeTab} onTabChange={onTabChange} />
    </RightSheet>
  );
}
