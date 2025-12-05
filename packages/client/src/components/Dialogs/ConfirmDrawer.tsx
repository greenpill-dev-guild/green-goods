import React from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { ModalDrawer } from "./ModalDrawer";

export type ConfirmDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "error" | "neutral";
  confirmDisabled?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
};

export const ConfirmDrawer: React.FC<ConfirmDrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = "primary",
  confirmDisabled = false,
  onConfirm,
  children,
}) => {
  const intl = useIntl();
  const cancelText =
    cancelLabel ?? intl.formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" });

  return (
    <ModalDrawer isOpen={isOpen} onClose={onClose} header={{ title, description }}>
      <div className="flex flex-col gap-4">
        {children}
        <div className="flex gap-3">
          <Button
            onClick={onClose}
            label={cancelText}
            variant="neutral"
            mode="stroke"
            className="flex-1"
          />
          <Button
            onClick={onConfirm}
            label={confirmLabel}
            variant={confirmVariant}
            mode="filled"
            className="flex-1"
            disabled={confirmDisabled}
          />
        </div>
      </div>
    </ModalDrawer>
  );
};

export default ConfirmDrawer;
