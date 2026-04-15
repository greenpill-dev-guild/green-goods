import { RightSheet } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AccountProfilePanel } from "./AccountProfilePanel";

interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  container?: HTMLElement | null;
}

export function ProfileSheet({ open, onClose, container }: ProfileSheetProps) {
  const { formatMessage } = useIntl();

  return (
    <RightSheet
      open={open}
      onClose={onClose}
      title={formatMessage({ id: "cockpit.profile.title", defaultMessage: "Profile" })}
      container={container}
    >
      <div className="p-5">
        <AccountProfilePanel />
      </div>
    </RightSheet>
  );
}
