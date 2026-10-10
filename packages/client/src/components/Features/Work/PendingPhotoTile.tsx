import { Button } from "@green-goods/shared/components/Button";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiErrorWarningLine, RiImageLine, RiLoader4Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

export type PendingPhotoState = "waiting" | "converting" | "failed";

export interface PendingPhotoTileProps {
  state: PendingPhotoState;
  /** The photo's file name, announced to screen readers and shown on hover. */
  name: string;
  onRetry?: () => void;
  onRemove?: () => void;
  className?: string;
}

/**
 * Stands in for a HEIC photo picked before its decoder could load. Most
 * browsers cannot draw one, so the tile never tries: it says the photo is kept
 * and converts on its own, and only a photo that will not decode asks for a
 * choice.
 */
export function PendingPhotoTile({
  state,
  name,
  onRetry,
  onRemove,
  className,
}: PendingPhotoTileProps) {
  const { formatMessage } = useIntl();
  const failed = state === "failed";
  const tone = failed ? pwaStatusStyles.warning : pwaStatusStyles.information;
  const Icon = state === "converting" ? RiLoader4Line : failed ? RiErrorWarningLine : RiImageLine;

  return (
    <div
      role="status"
      data-testid="pending-photo"
      data-state={state}
      title={name}
      className={cn(
        "flex w-full aspect-4/3 md:aspect-square flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center",
        tone.surface,
        tone.border,
        className
      )}
    >
      <Icon
        className={cn("h-6 w-6", tone.icon, state === "converting" && "animate-spin")}
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-text-strong-950">
        {state === "converting"
          ? formatMessage({
              id: "app.garden.upload.pendingPhoto.converting",
              defaultMessage: "Converting photo...",
            })
          : failed
            ? formatMessage({
                id: "app.garden.upload.pendingPhoto.failedTitle",
                defaultMessage: "This photo couldn't be converted",
              })
            : formatMessage({
                id: "app.garden.upload.pendingPhoto.waitingTitle",
                defaultMessage: "Photo kept",
              })}
      </p>
      {state === "waiting" ? (
        <p className={cn("text-xs", tone.text)}>
          {formatMessage({
            id: "app.garden.upload.pendingPhoto.waitingMessage",
            defaultMessage: "It converts when the app is ready.",
          })}
        </p>
      ) : null}
      <span className="sr-only">{name}</span>
      {failed && (onRetry || onRemove) ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button type="button" emphasis="secondary" size="compact" onClick={onRetry}>
              {formatMessage({
                id: "app.garden.upload.pendingPhoto.retry",
                defaultMessage: "Try Again",
              })}
            </Button>
          ) : null}
          {onRemove ? (
            <Button type="button" emphasis="tertiary" size="compact" onClick={onRemove}>
              {formatMessage({
                id: "app.garden.upload.pendingPhoto.remove",
                defaultMessage: "Remove",
              })}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
