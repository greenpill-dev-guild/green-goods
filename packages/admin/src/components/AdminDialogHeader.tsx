import * as Dialog from "@radix-ui/react-dialog";
import { SheetHeader } from "@green-goods/shared/components/Dialog/SheetHeader";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type ComponentType, type ReactNode, isValidElement } from "react";

interface AdminDialogHeaderProps {
  title: ReactNode;
  /** What the act writes to, named under the title and before the description. */
  target?: ReactNode;
  description?: ReactNode;
  /** A leading icon on the centered header only; the phone sheet's header has none. */
  icon?: ComponentType<{ className?: string }> | ReactNode;
  /** Below 640px the header is the shared bottom sheet's (`SheetHeader`). */
  rendersAsSheet: boolean;
  closeLabel: string;
  onClose: () => void;
  closeDisabled?: boolean;
  hideCloseButton?: boolean;
  closeTestId: string;
}

/**
 * The header of the cockpit's dialogs, rendered inside their Radix surface so
 * Radix keeps naming and describing the dialog.
 *
 * From 640px it is the centered dialog's header: an optional icon, the 22px
 * title, the target line and the description over a hairline, beside the
 * dialog's own absolute close button. Below 640px it is the installed app's
 * sheet header (F5), which the side sheet renders too: the shared
 * `SheetHeader` at the cockpit's title size (`--gg-sheet-title-*`), carrying
 * the close button itself, with no icon and no rule under it. Either way the
 * dialog keeps an accessible description, the title when nothing else
 * describes it.
 */
export function AdminDialogHeader({
  title,
  target,
  description,
  icon: Icon,
  rendersAsSheet,
  closeLabel,
  onClose,
  closeDisabled = false,
  hideCloseButton = false,
  closeTestId,
}: AdminDialogHeaderProps) {
  if (rendersAsSheet) {
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
        />
        {description ? null : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
      </>
    );
  }

  const icon =
    typeof Icon === "function" ? (
      <Icon className="h-6 w-6 text-[rgb(var(--m3-on-surface-variant))]" />
    ) : isValidElement(Icon) ? (
      Icon
    ) : null;

  return (
    <header
      data-slot="header"
      className={cn(
        "shrink-0 border-b border-stroke-soft px-4 py-3 sm:px-6",
        // Clearance for the absolute close button on the title row.
        !hideCloseButton && "pr-14"
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 shrink-0" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <Dialog.Title className="type-title-lg font-semibold text-[rgb(var(--m3-on-surface))]">
            {title}
          </Dialog.Title>
          {target ? (
            <div data-slot="target" className="mt-2">
              {target}
            </div>
          ) : null}
          <Dialog.Description
            className={cn(
              description ? "mt-0.5 type-body" : "sr-only",
              "text-[rgb(var(--m3-on-surface-variant))]"
            )}
          >
            {description ?? title}
          </Dialog.Description>
        </div>
      </div>
    </header>
  );
}
