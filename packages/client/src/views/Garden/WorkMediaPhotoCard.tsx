import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiCloseLine, RiZoomInLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { PendingPhotoTile, type PendingPhotoState } from "@/components/Features/Work";

export interface WorkMediaPhotoCardProps {
  file: File;
  index: number;
  url: string | undefined;
  isBroken: boolean;
  /** Set only for a HEIC photo still waiting to convert: it renders a placeholder instead. */
  heicState?: PendingPhotoState;
  onPreview: () => void;
  onPreviewFailed: () => void;
  onRemove: () => void;
  onRetryConversion?: () => void;
}

/** One photo in the work composer's media step: the picture, its preview, and its removal. */
export function WorkMediaPhotoCard({
  file,
  index,
  url,
  isBroken,
  heicState,
  onPreview,
  onPreviewFailed,
  onRemove,
  onRetryConversion,
}: WorkMediaPhotoCardProps) {
  const intl = useIntl();

  return (
    <div className="relative">
      {heicState ? (
        <PendingPhotoTile
          state={heicState}
          name={file.name}
          onRetry={onRetryConversion}
          onRemove={onRemove}
        />
      ) : (
        <button
          type="button"
          data-pressable="media"
          className="relative group cursor-pointer w-full"
          disabled={isBroken}
          onClick={onPreview}
        >
          <img
            src={url || undefined}
            alt={`${intl.formatMessage({ id: "app.garden.upload.uploaded", defaultMessage: "Uploaded" })} ${index + 1}`}
            className="w-full aspect-4/3 md:aspect-square object-cover rounded-lg"
            onError={() => {
              if (url) onPreviewFailed();
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-overlay)] opacity-0 transition-opacity duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] group-hover:opacity-100">
            <RiZoomInLine className="w-12 h-12 text-static-white" />
          </div>
        </button>
      )}
      {isBroken && !heicState && (
        <div className="absolute inset-x-2 bottom-2 rounded-[var(--radius-md)] border border-stroke-sub-300 bg-bg-white-0 px-2 py-1 text-xs font-medium text-text-strong-950">
          {intl.formatMessage({
            id: "app.garden.upload.brokenPreviewLabel",
            defaultMessage: "Preview failed",
          })}
        </div>
      )}
      {heicState === "failed" ? null : (
        <IconButton
          emphasis="secondary"
          size="compact"
          aria-label={intl.formatMessage(
            { id: "app.garden.upload.removeMedia", defaultMessage: "Remove media {index}" },
            { index: index + 1 }
          )}
          className="absolute top-2 right-2 z-10"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          icon={<RiCloseLine aria-hidden="true" />}
        />
      )}
    </div>
  );
}
