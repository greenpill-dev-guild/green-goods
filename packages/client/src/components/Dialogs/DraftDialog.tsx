import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@green-goods/shared/utils";
import { RiCloseLine, RiDraftLine, RiDeleteBinLine, RiArrowRightLine } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";

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
            "fixed inset-0 z-[10001] bg-black/30 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200"
          )}
          data-testid="draft-dialog-overlay"
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[10002] -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-sm bg-bg-white-0 rounded-2xl shadow-2xl p-0",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4",
            "duration-300 focus:outline-none"
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
                className={cn(
                  "p-1.5 rounded-full border border-stroke-soft-200 transition-all duration-200",
                  "hover:bg-bg-weak active:scale-95",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20"
                )}
                aria-label="Close"
                type="button"
              >
                <RiCloseLine className="w-5 h-5 text-text-soft-400" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-primary/10 rounded-full shrink-0">
                <RiDraftLine className="w-6 h-6 text-primary" />
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
                shape="pilled"
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
                shape="pilled"
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
