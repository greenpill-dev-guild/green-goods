import { RiFileFill, RiLeafFill, RiPencilFill, RiPlantFill } from "@remixicon/react";
import { useIntl } from "react-intl";
import { WorkView } from "@/components/Work";

interface WorkReviewProps {
  reviewConfig?: Action["review"];
  garden: Garden;
  action: Action;
  images: File[];
  values: Record<string, unknown>;
  plantSelection: string[];
  plantCount: number;
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
    .filter(Boolean) as Array<{ label: string; value: string; icon: any }>;

  const baseDetails = [
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

  return (
    <WorkView
      title={reviewTitle}
      info={reviewDescription}
      garden={garden}
      actionTitle={action.title}
      media={images.map((f) => URL.createObjectURL(f))}
      details={[...baseDetails, ...dynamicDetails]}
      headerIcon={RiFileFill}
      primaryActions={[]}
    />
  );
};
