import { RightSheet } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AccountSettingsPanel } from "./AccountSettingsPanel";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  container?: HTMLElement | null;
}

export function SettingsSheet({ open, onClose, container }: SettingsSheetProps) {
  const { formatMessage } = useIntl();

  return (
    <RightSheet
      open={open}
      onClose={onClose}
      title={formatMessage({ id: "cockpit.settings.title", defaultMessage: "Settings" })}
      container={container}
    >
      <div className="p-5">
        <AccountSettingsPanel />
      </div>
    </RightSheet>
  );
}
