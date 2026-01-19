import { mediaResourceManager } from "@green-goods/shared/modules";
import { formatTimeSpent } from "@green-goods/shared/utils/form/normalizers";
import { RiFileFill, RiLeafFill, RiPencilFill, RiPlantFill, RiTimeFill } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { WorkView } from "@/components/Features/Work";

/** Stable tracking ID for work draft media URLs (shared with Media.tsx) */
const WORK_DRAFT_TRACKING_ID = "work-draft";

interface WorkReviewProps {
  reviewConfig?: Action["review"];
  garden: Garden;
  action: Action;
  images: File[];
  values: Record<string, unknown>;
  plantSelection: string[];
  plantCount: number;
  timeSpentMinutes?: number;
  feedback: string;
}

export const WorkReview: React.FC<WorkReviewProps> = ({
  action,
  garden,
  reviewConfig,
  images,
  values,
  plantSelection,
  plantCount,
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

  const baseDetails = [
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
    {
      label: intl.formatMessage({
        id: "app.garden.review.plantTypes",
        defaultMessage: "Plant Types",
      }),
      value: plantSelection.join(", ") || "",
      icon: RiPlantFill,
    },
    {
      label: intl.formatMessage({
        id: "app.garden.review.plantAmount",
        defaultMessage: "Plant Amount",
      }),
      value: String(plantCount || ""),
      icon: RiLeafFill,
    },
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

  // Reuse stable URLs from mediaResourceManager (same tracking ID as Media.tsx)
  const mediaUrls = useMemo(
    () => images.map((file) => mediaResourceManager.getOrCreateUrl(file, WORK_DRAFT_TRACKING_ID)),
    [images]
  );

  return (
    <WorkView
      title={reviewTitle}
      info={reviewDescription}
      garden={garden}
      actionTitle={action.title}
      media={mediaUrls}
      details={[...baseDetails, ...dynamicDetails]}
      headerIcon={RiFileFill}
      primaryActions={[]}
    />
  );
};
