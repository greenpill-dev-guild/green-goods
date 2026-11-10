import { useOfflineAssetAvailability } from "@green-goods/shared/hooks/offline/useOfflineAssetAvailability";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { AudioPlayer } from "@green-goods/shared/components/Audio/AudioPlayer";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import type { PublishedWorkDocument } from "@green-goods/shared/modules/work/media-processing";
import type { Garden } from "@green-goods/shared/types/domain";
import { RiDownloadLine, RiExternalLinkLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { gardenMemberCount } from "@green-goods/shared/components/Cards/GardenCard/GardenCard";
import { FormInfo } from "@/components/Cards";
import { Carousel, CarouselContent, CarouselItem, ImageWithFallback } from "@/components/Display";
import { WorkDocumentRow } from "./WorkDocumentRow";

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
  /** The heading already names the action, as on a steward's page, so the facts leave it out. */
  actionInTitle?: boolean;
  media?: string[];
  mediaTypes?: string[];
  /** IPFS CIDs for gardener audio notes (from work metadata) */
  audioNoteCids?: string[];
  /** Documents the work's metadata lists; each opens from its gateway address. */
  documents?: PublishedWorkDocument[];
  details: Array<{ label: string; value: string; icon?: IconComponent | null }>;
  /**
   * What follows the heading card: why queued work is still on this phone
   * (D24), or the promise Submit Work is for, pinned as the page scrolls (O9).
   */
  afterHeading?: React.ReactNode;
  /**
   * What follows the details: the promise this work counts toward, on its page,
   * or where Submit Work's work waits until it lands.
   */
  afterDetails?: React.ReactNode;
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

/**
 * The garden the work belongs to, as facts: its name, how many members and where. The work's
 * own photos are the pictures on this screen, so the garden shows none.
 */
function WorkGardenFacts({ garden }: { garden: Garden }) {
  const intl = useIntl();
  const place = garden.location?.trim();
  return (
    <FactList frame="card" data-component="WorkGarden">
      <FactRow
        label={intl.formatMessage({
          id: "app.home.workApproval.gardenName",
          defaultMessage: "Name",
        })}
        value={garden.name}
      />
      <FactRow
        label={intl.formatMessage({
          id: "app.home.workApproval.gardenMembers",
          defaultMessage: "Members",
        })}
        value={gardenMemberCount(garden).toLocaleString(intl.locale)}
      />
      {place ? (
        <FactRow
          label={intl.formatMessage({
            id: "app.home.workApproval.gardenPlace",
            defaultMessage: "Place",
          })}
          value={place}
        />
      ) : null}
    </FactList>
  );
}

/** The garden's facts while the garden is read, in the space they take. */
function WorkGardenFactsSkeleton() {
  return <div aria-hidden="true" className="h-32 rounded-2xl bg-bg-weak-50 animate-pulse" />;
}

export const WorkView: React.FC<WorkViewProps> = ({
  title,
  info,
  garden,
  actionTitle,
  actionInTitle = false,
  media = [],
  mediaTypes = [],
  audioNoteCids,
  documents = [],
  details,
  afterHeading = null,
  afterDetails = null,
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
  const documentUrls = documents.map((document) => resolveIPFSUrl(document.cid));
  const offlineAssets = useOfflineAssetAvailability([...mediaUrls, ...audioUrls, ...documentUrls]);
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
      {afterHeading}

      <h6 className="text-base font-semibold">
        {intl.formatMessage({ id: "app.home.workApproval.garden", defaultMessage: "Garden" })}
      </h6>
      {garden ? <WorkGardenFacts garden={garden} /> : <WorkGardenFactsSkeleton />}

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

      {documents.length > 0 && (
        <>
          <h6 className="text-base font-semibold">
            {intl.formatMessage({ id: "app.work.documents" })}
          </h6>
          <div className="flex flex-col gap-2">
            {documents.map((document, index) => {
              // Offline, a document opens only from a copy kept on this device, as a voice note plays.
              const available = isOnline || offlineAssets[documentUrls[index]];
              return (
                <div key={`${index}:${document.cid}`} className="flex flex-col gap-1">
                  <WorkDocumentRow
                    name={document.name}
                    type={document.type}
                    size={document.size}
                    href={available ? documentUrls[index] : undefined}
                  />
                  {available ? null : (
                    <p className="text-sm text-text-sub-600">
                      {intl.formatMessage({
                        id: "app.offline.attachmentUnavailable",
                        defaultMessage: "Not downloaded for offline use",
                      })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <h6 className="text-base font-semibold">
        {intl.formatMessage({ id: "app.home.workApproval.details", defaultMessage: "Details" })}
      </h6>
      {/* One list of facts, a label beside each value, as every review and detail screen
          lists them (DL-109): the action first, then what the work recorded. */}
      <FactList frame="card" data-component="WorkDetails">
        {actionInTitle ? null : (
          <FactRow
            label={intl.formatMessage({
              id: "app.home.workApproval.action",
              defaultMessage: "Action",
            })}
            value={
              actionTitle ||
              intl.formatMessage({ id: "app.action.selected", defaultMessage: "Selected" })
            }
            icon={<RiExternalLinkLine className="h-4 w-4" />}
          />
        )}
        {isDetailsLoading
          ? Array.from({ length: 2 }).map((_, i) => (
              <div
                key={`detail-loading-${i}`}
                aria-hidden="true"
                className="gg-fact-row h-12 animate-pulse bg-bg-weak-50"
              />
            ))
          : details
              .filter((d) => d.value && d.value.trim().length > 0)
              .map((d) => {
                const Icon = d.icon ?? RiExternalLinkLine;
                return (
                  <FactRow
                    key={d.label}
                    label={d.label}
                    value={d.value}
                    icon={<Icon className="h-4 w-4" />}
                  />
                );
              })}
      </FactList>

      {afterDetails}

      {feedbackSection}

      {/* The work's utilities share one compact row, so none of them weighs as much as the
          decision a steward makes in the bar below. */}
      {visibleActions.length > 0 && (
        <div
          role="group"
          aria-label={intl.formatMessage({
            id: "app.home.work.actions",
            defaultMessage: "Actions",
          })}
          className="mt-2 flex flex-wrap gap-2"
        >
          {visibleActions.map((a) => (
            <Button
              key={a.id}
              onClick={a.onClick}
              className="touch-manipulation"
              emphasis="secondary"
              size="sm"
              type="button"
              leadingIcon={a.icon ?? <RiDownloadLine className="h-4 w-4" aria-hidden="true" />}
              disabled={a.disabled}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}

      {reserveFooterSpace ? (
        <div
          aria-hidden="true"
          className={footerSpacerClassName ?? "h-[calc(96px+var(--safe-area-bottom))]"}
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
      <WorkGardenFactsSkeleton />

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
