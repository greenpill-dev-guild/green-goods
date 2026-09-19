import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import { useIntl } from "react-intl";

export interface JoinGardenConfirmDialogProps {
  isOpen: boolean;
  /** Name of the garden the viewer is about to join. */
  gardenName: string;
  isJoining: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * The single confirmation for joining an open garden, shared by the garden
 * page and the Profile gardens list so both entry points ask the same short
 * question. It names the garden rather than quoting its description, which can
 * run to a paragraph and push the actions off a small screen.
 */
export function JoinGardenConfirmDialog({
  isOpen,
  gardenName,
  isJoining,
  onClose,
  onConfirm,
}: JoinGardenConfirmDialogProps) {
  const intl = useIntl();

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={intl.formatMessage({
        id: "app.profile.joinGardenConfirmTitle",
        defaultMessage: "Join Garden",
      })}
      description={intl.formatMessage(
        {
          id: "app.profile.joinGardenConfirmDescription",
          defaultMessage: "You'll join {gardenName} as a Gardener and can submit work right away.",
        },
        { gardenName }
      )}
      confirmLabel={intl.formatMessage({
        id: "app.profile.joinGardenConfirmAction",
        defaultMessage: "Join",
      })}
      isLoading={isJoining}
    />
  );
}
