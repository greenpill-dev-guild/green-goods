import { useOfflineAssetAvailability } from "@green-goods/shared/hooks/offline/useOfflineAssetAvailability";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { AudioPlayer } from "@green-goods/shared/components/Audio/AudioPlayer";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import type { Garden } from "@green-goods/shared/types/domain";
import { RiDownloadLine, RiExternalLinkLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { Button } from "@green-goods/shared/components/Button";
import { FormCard, FormInfo, GardenCard, GardenCardSkeleton } from "@/components/Cards";
import { Carousel, CarouselContent, CarouselItem, ImageWithFallback } from "@/components/Display";

export type WorkViewAction = {
  id: string;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  visible?: boolean;
};

// Icon component type for details and header
type IconComponent = React.ComponentType<{ className?: string }>;

type WorkViewProps = {
  title: string;
  info: string;
  garden?: Garden;
  actionTitle: string;
  media?: string[];
  mediaTypes?: string[];
  /** IPFS CIDs for gardener audio notes (from work metadata) */
  audioNoteCids?: string[];
  details: Array<{ label: string; value: string; icon?: IconComponent | null }>;
  /** The commitment this work fulfils, drawn after the details when there is one. */
  fulfills?: React.ReactNode;
  /** When true, shows skeleton placeholders for details instead of the actual cards */
  isDetailsLoading?: boolean;
  headerIcon?: IconComponent | null;
  primaryActions?: WorkViewAction[]; // shown near header or under details
  feedbackSection?: React.ReactNode; // optional feedback input section
  footer?: React.ReactNode; // e.g., fixed approval bar
  /**
   * When the provided `footer` is positioned `fixed` (outside normal layout flow),
   * set this to true so the WorkView reserves vertical space and content doesn't
   * end up hidden behind the footer.
   */
  reserveFooterSpace?: boolean;
  /**
   * Optional override for the reserved space element used by `reserveFooterSpace`.
   * Useful when different fixed footers have different heights.
   */
  footerSpacerClassName?: string;
  showMedia?: boolean;
  onMediaError?: (mediaUrl: string, index: number) => void;
};

export const WorkView: React.FC<WorkViewProps> = ({
  title,
  info,
  garden,
  actionTitle,
  media = [],
  mediaTypes = [],
  audioNoteCids,
  details,
  fulfills = null,
  isDetailsLoading = false,
  headerIcon: HeaderIcon,
  primaryActions = [],
  feedbackSection,
  footer,
  reserveFooterSpace = false,
  footerSpacerClassName,
  showMedia = true,
  onMediaError,
}) => {
  const intl = useIntl();
  const isOnline = useOnlineStatus();
  const mediaUrls = media.map((url) =>
    /^(blob:|data:|https?:)/.test(url) ? url : resolveIPFSUrl(url)
  );
  const audioUrls = (audioNoteCids ?? []).map((cid) => resolveIPFSUrl(cid));
  const offlineAssets = useOfflineAssetAvailability([...mediaUrls, ...audioUrls]);
  const missingOriginals =
    !isOnline && [...mediaUrls, ...audioUrls].some((url) => !offlineAssets[url]);

  const hasMedia = showMedia && Array.isArray(media) && media.length > 0;
  const hasAudioNotes = audioNoteCids && audioNoteCids.length > 0;
  const visibleActions = primaryActions
    .filter((a) => a.visible !== false)
    .map((action) =>
      action.id === "download-media" && !isOnline && mediaUrls.some((url) => !offlineAssets[url])
        ? { ...action, disabled: true }
        : action
    );

  return (
    <div className="flex flex-col gap-4">
      <FormInfo title={title} info={info} Icon={HeaderIcon ?? undefined} />

      <h6 className="text-base font-semibold">
        {intl.formatMessage({ id: "app.home.workApproval.garden", defaultMessage: "Garden" })}
      </h6>
      {garden ? (
        <GardenCard
          garden={garden}
          media="small"
          height="default"
          showStewards={true}
          selected={false}
          showDescription={false}
          showBanner={false}
        />
      ) : (
        <GardenCardSkeleton media="small" height="default" showBanner={false} />
      )}

      {missingOriginals && (
        <p role="status" className="text-sm text-text-sub-600">
          {intl.formatMessage({
            id: "app.offline.originalsUnavailable",
            defaultMessage:
              "Original media isn’t saved on this device. Photo previews may still be available.",
          })}
        </p>
      )}
      {hasMedia && (
        <>
          <h6 className="text-base font-semibold">
            {intl.formatMessage({ id: "app.home.workApproval.media", defaultMessage: "Media" })}
          </h6>
          <Carousel
            enablePreview={
              !missingOriginals && !mediaTypes.some((type) => type.startsWith("video/"))
            }
            previewImages={media}
          >
            <CarouselContent>
              {media.map((item, index) => (
                <CarouselItem
                  // A local preview URL is empty until it is created, and one work
                  // can repeat a CID, so the URL alone is not a unique key.
                  key={`${index}:${item}`}
                  index={index}
                  className="max-w-40 aspect-3/4 rounded-2xl relative overflow-hidden"
                >
                  {mediaTypes[index]?.startsWith("video/") &&
                  !isOnline &&
                  !offlineAssets[mediaUrls[index]] ? (
                    <p className="p-3 text-sm text-text-sub-600">
                      {intl.formatMessage({
                        id: "app.offline.attachmentUnavailable",
                        defaultMessage: "Not downloaded for offline use",
                      })}
                    </p>
                  ) : mediaTypes[index]?.startsWith("video/") ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption -- user-generated evidence has no caption track
                    <video
                      src={mediaUrls[index]}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain"
                      onError={() => onMediaError?.(item, index)}
                    />
                  ) : (
                    <ImageWithFallback
                      src={item}
                      alt={`Work media ${index + 1}`}
                      className="w-full h-full aspect-3/4 object-cover rounded-2xl"
                      fallbackClassName="w-full h-full aspect-3/4 rounded-2xl"
                      onErrorCallback={() => onMediaError?.(item, index)}
                    />
                  )}
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </>
      )}

      {hasAudioNotes && (
        <>
          <h6 className="text-base font-semibold">
            {intl.formatMessage({
              id: "app.home.work.audioNotes",
              defaultMessage: "Audio notes",
            })}
          </h6>
          <div className="flex flex-col gap-2">
            {audioNoteCids.map((cid, index) =>
              isOnline || offlineAssets[audioUrls[index]] ? (
                <AudioPlayer key={cid} src={audioUrls[index]} compact={false} />
              ) : (
                <p key={cid} className="text-sm text-text-sub-600">
                  {intl.formatMessage({
                    id: "app.offline.attachmentUnavailable",
                    defaultMessage: "Not downloaded for offline use",
                  })}
                </p>
              )
            )}
          </div>
        </>
      )}

      <h6 className="text-base font-semibold">
        {intl.formatMessage({ id: "app.home.workApproval.details", defaultMessage: "Details" })}
      </h6>
      <FormCard
        label={intl.formatMessage({ id: "app.home.workApproval.action", defaultMessage: "Action" })}
        value={
          actionTitle ||
          intl.formatMessage({ id: "app.action.selected", defaultMessage: "Selected" })
        }
        Icon={RiExternalLinkLine}
      />

      {isDetailsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={`detail-loading-${i}`}
              className="h-12 bg-bg-weak-50 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : (
        details
          .filter((d) => d.value && d.value.trim().length > 0)
          .map((d) => (
            <FormCard
              key={d.label}
              label={d.label}
              value={d.value}
              Icon={d.icon ?? RiExternalLinkLine}
            />
          ))
      )}

      {fulfills}

      {feedbackSection}

      {visibleActions.length > 0 && (
        <>
          <h6 className="mt-2 text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.home.work.actions", defaultMessage: "Actions" })}
          </h6>
          <div className="flex flex-col gap-3">
            {visibleActions.map((a) => {
              // Approve is the one filled action; reject and the utility actions are
              // outlined (DL-026), reject in the error tone.
              const isReject = a.id === "reject";
              return (
                <Button
                  key={a.id}
                  onClick={a.onClick}
                  className="w-full touch-manipulation"
                  emphasis={a.id === "approve" ? "primary" : "secondary"}
                  tone={isReject ? "danger" : "default"}
                  type="button"
                  leadingIcon={a.icon ?? <RiDownloadLine className="h-5 w-5" aria-hidden="true" />}
                  disabled={a.disabled}
                >
                  {a.label}
                </Button>
              );
            })}
          </div>
        </>
      )}

      {reserveFooterSpace ? (
        <div
          aria-hidden="true"
          className={footerSpacerClassName ?? "h-[calc(96px+env(safe-area-inset-bottom))]"}
        />
      ) : null}

      {footer}
    </div>
  );
};

type WorkViewSkeletonProps = {
  showMedia?: boolean;
  showActions?: boolean;
  numDetails?: number;
};

export const WorkViewSkeleton: React.FC<WorkViewSkeletonProps> = ({
  showMedia = true,
  showActions = false,
  numDetails = 3,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Header info */}
      <div className="bg-bg-weak-50 p-4 rounded-lg animate-pulse h-24" />

      {/* Garden section */}
      <div className="h-4 w-28 bg-bg-soft-200 rounded" />
      <GardenCardSkeleton media="small" height="default" showBanner={false} />

      {/* Media section */}
      {showMedia && (
        <>
          <div className="h-4 w-20 bg-bg-soft-200 rounded" />
          <div className="flex flex-row gap-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={`media-skel-${idx}`}
                className="max-w-40 aspect-3/4 rounded-2xl bg-bg-soft-200 animate-pulse w-full"
              />
            ))}
          </div>
        </>
      )}

      {/* Details section */}
      <div className="h-4 w-24 bg-bg-soft-200 rounded" />
      <div className="space-y-2">
        <div className="h-12 bg-bg-weak-50 rounded-lg animate-pulse" />
        {Array.from({ length: numDetails }).map((_, i) => (
          <div key={`detail-skel-${i}`} className="h-12 bg-bg-weak-50 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Primary actions */}
      {showActions && (
        <div className="flex gap-3">
          <div className="h-10 flex-1 bg-bg-weak-50 rounded-lg animate-pulse" />
          <div className="h-10 flex-1 bg-bg-weak-50 rounded-lg animate-pulse" />
          <div className="h-10 flex-1 bg-bg-weak-50 rounded-lg animate-pulse" />
        </div>
      )}
    </div>
  );
};
