import { cn } from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiArrowRightLine, RiCloseLine, RiDeleteBinLine, RiDraftLine } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { pwaDrawerStyles } from "@/styles/pwaDrawerStyles";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

interface DraftDialogProps {
  isOpen: boolean;
  onContinue: () => void;
  onStartFresh: () => void;
  imageCount: number;
}

/**
 * A dialog asking the user whether to continue a previous draft or start fresh.
 * Uses Radix Dialog for accessibility and proper focus management.
 */
export const DraftDialog: React.FC<DraftDialogProps> = ({
  isOpen,
  onContinue,
  onStartFresh,
  imageCount,
}) => {
  const intl = useIntl();

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onContinue()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            pwaDrawerStyles.dialogOverlay,
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)]"
          )}
          data-testid="draft-dialog-overlay"
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-sm p-0",
            pwaDrawerStyles.dialogSurface,
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4",
            "duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)] focus:outline-none"
          )}
          data-testid="draft-dialog"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-stroke-soft-200">
            <Dialog.Title className="text-lg font-semibold text-text-strong-950">
              {intl.formatMessage({
                id: "app.garden.draft.title",
                defaultMessage: "Continue Previous Work?",
              })}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className={cn("p-1.5", pwaDrawerStyles.closeButtonBase)}
                aria-label="Close"
                type="button"
              >
                <RiCloseLine className={cn("w-5 h-5", pwaDrawerStyles.closeIcon)} />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="flex items-start gap-4 mb-6">
              <div className={cn("p-3 rounded-full shrink-0", pwaStatusStyles.primary.surface)}>
                <RiDraftLine className={cn("w-6 h-6", pwaStatusStyles.primary.icon)} />
              </div>
              <Dialog.Description className="text-sm text-text-sub-600 leading-relaxed">
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
              </Dialog.Description>
            </div>

            {/* Actions */}
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
