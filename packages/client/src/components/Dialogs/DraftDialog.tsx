import { cn } from "@green-goods/shared/utils";
import { RiCloseLine, RiDraftLine, RiDeleteBinLine, RiArrowRightLine } from "@remixicon/react";
import React, { useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";

interface DraftDialogProps {
  isOpen: boolean;
  onContinue: () => void;
  onStartFresh: () => void;
  imageCount: number;
}

export const DraftDialog: React.FC<DraftDialogProps> = ({
  isOpen,
  onContinue,
  onStartFresh,
  imageCount,
}) => {
  const intl = useIntl();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus management and scroll lock
  useEffect(() => {
    if (!isOpen) return;

    document.documentElement.classList.add("modal-open");
    setTimeout(() => closeBtnRef.current?.focus(), 0);

    return () => {
      document.documentElement.classList.remove("modal-open");
    };
  }, [isOpen]);

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onContinue();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onContinue]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[10001] flex items-center justify-center p-4",
        "bg-black/40 backdrop-blur-sm",
        "animate-in fade-in duration-200"
      )}
      onClick={onContinue}
      data-testid="draft-dialog-overlay"
    >
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full max-w-sm bg-white rounded-2xl shadow-2xl",
          "animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stroke-soft-200">
          <h2 id="draft-dialog-title" className="text-lg font-semibold text-text-strong">
            {intl.formatMessage({
              id: "app.garden.draft.title",
              defaultMessage: "Continue Previous Work?",
            })}
          </h2>
          <button
            ref={closeBtnRef}
            onClick={onContinue}
            className={cn(
              "p-1.5 rounded-full border border-stroke-soft-200 transition-all duration-200",
              "hover:bg-bg-weak active:scale-95",
              "focus:outline-none focus:ring-2 focus:ring-primary/20"
            )}
            aria-label="Close"
            type="button"
          >
            <RiCloseLine className="w-5 h-5 text-text-sub" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-primary/10 rounded-full shrink-0">
              <RiDraftLine className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-text-sub leading-relaxed">
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
      </div>
    </div>
  );
};
