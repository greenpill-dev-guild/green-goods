import {
  type Action,
  AudioPlayer,
  formatTimeSpent,
  type Garden,
  mediaResourceManager,
  type WorkInput,
  cn,
} from "@green-goods/shared";
import { RiFileFill, RiPencilFill, RiTimeFill } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { WorkView } from "@/components/Features/Work";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";
import { getWorkMediaId, isVideoFile } from "./mediaProcessing";

/** Stable tracking ID for work draft media URLs (shared with Media.tsx) */
const WORK_DRAFT_TRACKING_ID = "work-draft";
const VIDEO_TRACKING_ID = "work-draft-video";

function getDisplayLabel(input: WorkInput, value: string) {
  return input.optionLabels?.[value] ?? input.bandLabels?.[value] ?? value;
}

function formatInputValue(input: WorkInput, raw: unknown) {
  if (Array.isArray(raw)) {
    return raw.map((item) => getDisplayLabel(input, String(item))).join(", ");
  }
  if (typeof raw === "number") {
    return String(raw);
  }
  if (typeof raw === "string") {
    return getDisplayLabel(input, raw);
  }
  return JSON.stringify(raw);
}

interface WorkReviewProps {
  reviewConfig?: Action["review"];
  garden: Garden;
  action: Action;
  images: File[];
  audioNotes?: File[];
  values: Record<string, unknown>;
  timeSpentMinutes?: number;
  feedback: string;
  brokenMediaIds?: ReadonlySet<string>;
  onPreviewFailed?: (file: File, surface: "review") => void;
  onRemoveBrokenMedia?: (surface: "review") => void;
}

export const WorkReview: React.FC<WorkReviewProps> = ({
  action,
  garden,
  reviewConfig,
  images,
  audioNotes = [],
  values,
  timeSpentMinutes,
  feedback,
  brokenMediaIds,
  onPreviewFailed,
  onRemoveBrokenMedia,
}) => {
  const intl = useIntl();
  const reviewTitle =
    reviewConfig?.title ??
    intl.formatMessage({ id: "app.garden.review.title", defaultMessage: "Review Work" });
  const reviewDescription =
    reviewConfig?.description ??
    intl.formatMessage({
      id: "app.garden.submit.tab.review.instruction",
      defaultMessage: "Check if the information is correct",
    });

  // Build details from action inputs dynamically
  const dynamicDetails = (action.inputs || [])
    .map((input) => {
      const raw = values?.[input.key];
      if (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0)) {
        return null;
      }
      const display = formatInputValue(input, raw);
      return { label: input.title, value: display, icon: RiFileFill };
    })
    .filter(Boolean) as Array<{
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;

  const formattedTimeSpent = formatTimeSpent(timeSpentMinutes);

  const details = [
    // Time spent - shown first as a key metric
    ...(formattedTimeSpent
      ? [
          {
            label: intl.formatMessage({
              id: "app.garden.review.timeSpent",
              defaultMessage: "Time Spent",
            }),
            value: formattedTimeSpent,
            icon: RiTimeFill,
          },
        ]
      : []),
    // Dynamic action-specific fields
    ...dynamicDetails,
    // Feedback last (if provided)
    ...(feedback && feedback.trim().length > 0
      ? [
          {
            label: intl.formatMessage({
              id: "app.garden.review.description",
              defaultMessage: "Description",
            }),
            value: feedback,
            icon: RiPencilFill,
          },
        ]
      : []),
  ];

  // Separate photos from videos (both can coexist)
  const { photoFiles, videoFiles } = useMemo(() => {
    const videos = images.filter(isVideoFile);
    const photos = images.filter((f) => !isVideoFile(f));
    return { photoFiles: photos, videoFiles: videos };
  }, [images]);

  const brokenCount = useMemo(
    () => images.filter((file) => brokenMediaIds?.has(getWorkMediaId(file))).length,
    [brokenMediaIds, images]
  );

  // Stable URLs for photos (same tracking ID as Media.tsx)
  const photoUrls = useMemo(
    () =>
      photoFiles.map((file) => mediaResourceManager.getOrCreateUrl(file, WORK_DRAFT_TRACKING_ID)),
    [photoFiles]
  );

  // Stable URLs for videos
  const videoUrls = useMemo(
    () => videoFiles.map((file) => mediaResourceManager.getOrCreateUrl(file, VIDEO_TRACKING_ID)),
    [videoFiles]
  );

  return (
    <div className="flex flex-col gap-4">
      {brokenCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex flex-col gap-2 rounded-[var(--radius-lg)] border p-3",
            pwaStatusStyles.warning.surface,
            pwaStatusStyles.warning.border
          )}
        >
          <p className={cn("text-sm font-medium", pwaStatusStyles.warning.text)}>
            {intl.formatMessage({
              id: "app.garden.review.previewFailedTitle",
              defaultMessage: "Some media previews failed",
            })}
          </p>
          <p className={cn("text-sm", pwaStatusStyles.warning.text)}>
            {intl.formatMessage(
              {
                id: "app.garden.review.previewFailedMessage",
                defaultMessage:
                  "{count, plural, one {Remove the broken item before submitting again. Your details will stay here.} other {Remove the broken items before submitting again. Your details will stay here.}}",
              },
              { count: brokenCount }
            )}
          </p>
          <button
            type="button"
            className="self-start min-h-11 rounded-[var(--radius-md)] border border-stroke-sub-300 bg-bg-white-0 px-3 text-sm font-medium text-text-strong-950"
            onClick={() => onRemoveBrokenMedia?.("review")}
          >
            {intl.formatMessage({
              id: "app.garden.review.removeBrokenMedia",
              defaultMessage: "Remove broken media",
            })}
          </button>
        </div>
      )}

      <WorkView
        title={reviewTitle}
        info={reviewDescription}
        garden={garden}
        actionTitle={action.title}
        media={photoUrls}
        showMedia={photoUrls.length > 0}
        details={details}
        headerIcon={RiFileFill}
        primaryActions={[]}
        onMediaError={(_mediaUrl, index) => {
          const file = photoFiles[index];
          if (file) onPreviewFailed?.(file, "review");
        }}
      />

      {/* Video previews (shown alongside photos, not mutually exclusive) */}
      {videoUrls.length > 0 && (
        <div className="padded flex flex-col gap-2">
          <p className="text-xs tracking-tight mb-1 uppercase text-text-sub">
            {intl.formatMessage({
              id: "app.garden.review.video",
              defaultMessage: "Video",
            })}
          </p>
          {videoUrls.map((url, index) => (
            /* eslint-disable-next-line jsx-a11y/media-has-caption -- user-generated content */
            <video
              key={getWorkMediaId(videoFiles[index])}
              src={url}
              controls
              className="w-full rounded-lg"
              onError={() => {
                const file = videoFiles[index];
                if (file) onPreviewFailed?.(file, "review");
              }}
            >
              <track kind="captions" />
            </video>
          ))}
        </div>
      )}

      {/* Audio notes preview */}
      {audioNotes.length > 0 && (
        <div className="padded flex flex-col gap-2">
          <p className="text-xs tracking-tight mb-1 uppercase text-text-sub">
            {intl.formatMessage({
              id: "app.garden.review.audioNotes",
              defaultMessage: "Audio Notes",
            })}
          </p>
          {audioNotes.map((file, index) => (
            <AudioPlayer key={`review-audio-${file.name}-${index}`} file={file} />
          ))}
        </div>
      )}
    </div>
  );
};
