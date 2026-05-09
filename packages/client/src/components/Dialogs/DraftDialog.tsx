import { cn, DialogShell } from "@green-goods/shared";
import { RiArrowRightLine, RiDeleteBinLine, RiDraftLine } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

interface DraftDialogProps {
  isOpen: boolean;
  onContinue: () => void;
  onStartFresh: () => void;
  imageCount: number;
}

/**
 * Draft resume dialog using the shared `DialogShell` for accessibility,
 * focus trap, scroll-lock, mobile-up slide, and i18n close button.
 *
 * The intent is unchanged from the previous raw-Radix version: when the
 * dialog is dismissed by the close button or backdrop, treat it as
 * "continue" so the gardener doesn't accidentally lose draft work.
 */
export const DraftDialog: React.FC<DraftDialogProps> = ({
  isOpen,
  onContinue,
  onStartFresh,
  imageCount,
}) => {
  const intl = useIntl();

  return (
    <DialogShell
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onContinue();
      }}
      title={intl.formatMessage({
        id: "app.garden.draft.title",
        defaultMessage: "Continue Previous Work?",
      })}
      icon={<RiDraftLine className={cn("w-6 h-6", pwaStatusStyles.primary.icon)} />}
      iconContainerClassName={cn("rounded-full", pwaStatusStyles.primary.surface)}
    >
      <div className="flex flex-col gap-6">
        <p className="body-md-regular text-text-sub-600">
          {intl.formatMessage(
            {
              id: "app.garden.draft.description",
              defaultMessage:
                "You have an unfinished work submission{imageInfo}. Would you like to continue where you left off?",
            },
            {
              imageInfo:
                imageCount > 0
                  ? ` with ${imageCount} ${imageCount === 1 ? "image" : "images"}`
                  : "",
            }
          )}
        </p>
        <div className="flex flex-col gap-3">
          <Button
            onClick={onContinue}
            label={intl.formatMessage({
              id: "app.garden.draft.continue",
              defaultMessage: "Continue Draft",
            })}
            variant="primary"
            mode="filled"
            size="medium"
            shape="regular"
            className="w-full"
            trailingIcon={<RiArrowRightLine className="w-5 h-5" />}
          />
          <Button
            onClick={onStartFresh}
            label={intl.formatMessage({
              id: "app.garden.draft.startFresh",
              defaultMessage: "Start Fresh",
            })}
            variant="neutral"
            mode="stroke"
            size="medium"
            shape="regular"
            className="w-full"
            leadingIcon={<RiDeleteBinLine className="w-5 h-5" />}
          />
        </div>
      </div>
    </DialogShell>
  );
};
