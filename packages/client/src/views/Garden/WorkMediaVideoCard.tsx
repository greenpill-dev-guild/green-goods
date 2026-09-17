import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiCloseLine, RiPlayFill } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface WorkMediaVideoCardProps {
  index: number;
  url: string | undefined;
  isBroken: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onPreviewFailed: () => void;
  onRemove: () => void;
}

/** One video in the work composer's media step: a still until played, then the player. */
export function WorkMediaVideoCard({
  index,
  url,
  isBroken,
  isPlaying,
  onPlay,
  onPreviewFailed,
  onRemove,
}: WorkMediaVideoCardProps) {
  const intl = useIntl();

  return (
    <div className="relative">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-generated content */}
      <video
        src={url || undefined}
        controls={isPlaying}
        className="w-full aspect-4/3 md:aspect-square object-cover rounded-lg"
        onError={() => {
          if (url) onPreviewFailed();
        }}
        aria-label={intl.formatMessage({
          id: "app.garden.upload.videoPreview",
          defaultMessage: "Video preview",
        })}
      >
        <track kind="captions" />
      </video>
      {!isPlaying && (
        <button
          type="button"
          data-pressable="media"
          className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-overlay)]"
          onClick={onPlay}
        >
          <RiPlayFill className="w-12 h-12 text-static-white" />
        </button>
      )}
      {isBroken && (
        <div className="absolute inset-x-2 bottom-2 rounded-[var(--radius-md)] border border-stroke-sub-300 bg-bg-white-0 px-2 py-1 text-xs font-medium text-text-strong-950">
          {intl.formatMessage({
            id: "app.garden.upload.brokenPreviewLabel",
            defaultMessage: "Preview failed",
          })}
        </div>
      )}
      <IconButton
        emphasis="secondary"
        size="compact"
        aria-label={intl.formatMessage(
          { id: "app.garden.upload.removeMedia", defaultMessage: "Remove media {index}" },
          { index: index + 1 }
        )}
        className="absolute top-2 right-2 z-10"
        onClick={onRemove}
        icon={<RiCloseLine aria-hidden="true" />}
      />
    </div>
  );
}
