import * as Dialog from "@radix-ui/react-dialog";
import { SheetHeader } from "@green-goods/shared/components/Dialog/SheetHeader";
import type { ReactNode } from "react";

interface AdminDialogHeaderProps {
  title: ReactNode;
  /** What the act writes to, named under the title and before the description. */
  target?: ReactNode;
  description?: ReactNode;
  /** Below 640px the header tops the phone sheet, under its grip. */
  rendersAsSheet: boolean;
  closeLabel: string;
  onClose: () => void;
  closeDisabled?: boolean;
  hideCloseButton?: boolean;
  closeTestId: string;
}

/**
 * The header of the cockpit's dialogs: the shared `SheetHeader` at every
 * width (DL-117), rendered inside the dialog's Radix surface so Radix keeps
 * naming and describing it.
 *
 * It carries the 22px title (`--gg-sheet-title-*`), the target line, the
 * description and the close button on the title's line, with no icon and no
 * rule under it (DL-028); the dialog's body shows a hairline only while it
 * scrolls under the header. From 640px the header opens the centered surface
 * (`standalone`); below 640px it sits under the phone sheet's grip (DL-104),
 * which the side sheet renders too. One element serves both widths, so the
 * close button keeps focus when a dialog crosses 640px. The dialog keeps an
 * accessible description either way, the title when nothing else describes it.
 */
export function AdminDialogHeader({
  title,
  target,
  description,
  rendersAsSheet,
  closeLabel,
  onClose,
  closeDisabled = false,
  hideCloseButton = false,
  closeTestId,
}: AdminDialogHeaderProps) {
  return (
    <>
      <SheetHeader
        title={title}
        titleAs={Dialog.Title}
        target={target}
        description={description}
        descriptionAs={Dialog.Description}
        closeLabel={closeLabel}
        onClose={onClose}
        closeDisabled={closeDisabled}
        hideCloseButton={hideCloseButton}
        closeTestId={closeTestId}
        standalone={!rendersAsSheet}
      />
      {description ? null : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
    </>
  );
}
