import {
  type Action,
  AudioPlayer,
  formatTimeSpent,
  type Garden,
  mediaResourceManager,
} from "@green-goods/shared";
import { RiFileFill, RiPencilFill, RiTimeFill } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { WorkView } from "@/components/Features/Work";

/** Stable tracking ID for work draft media URLs (shared with Media.tsx) */
const WORK_DRAFT_TRACKING_ID = "work-draft";
const VIDEO_TRACKING_ID = "work-draft-video";

interface WorkReviewProps {
  reviewConfig?: Action["review"];
  garden: Garden;
  action: Action;
  images: File[];
  audioNotes?: File[];
  values: Record<string, unknown>;
  timeSpentMinutes?: number;
  feedback: string;
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
      let display: string = "";
      if (Array.isArray(raw)) {
        display = raw.join(", ");
      } else if (typeof raw === "number") {
        display = String(raw);
      } else if (typeof raw === "string") {
        display = raw;
      } else {
        display = JSON.stringify(raw);
      }
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
    const videos = images.filter((f) => f.type.startsWith("video/"));
    const photos = images.filter((f) => !f.type.startsWith("video/"));
    return { photoFiles: photos, videoFiles: videos };
  }, [images]);

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
            <video key={`review-video-${index}`} src={url} controls className="w-full rounded-lg">
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
