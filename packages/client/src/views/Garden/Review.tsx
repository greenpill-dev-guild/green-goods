import { RiFileFill, RiHammerFill, RiLeafFill, RiPencilFill, RiPlantFill } from "@remixicon/react";
import { useIntl } from "react-intl";
import { WorkView } from "@/components/UI/WorkView/WorkView";

interface WorkReviewProps {
  instruction: string;
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
  instruction,
  images,
  values,
  plantSelection,
  plantCount,
  feedback,
}) => {
  const intl = useIntl();

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
      label: intl.formatMessage({ id: "app.garden.review.action", defaultMessage: "Action" }),
      value: action.title,
      icon: RiHammerFill,
    },
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
      title={intl.formatMessage({ id: "app.garden.review.title", defaultMessage: "Review Work" })}
      info={instruction}
      garden={garden}
      actionTitle={action.title}
      media={images.map((f) => URL.createObjectURL(f))}
      details={[...baseDetails, ...dynamicDetails]}
      headerIcon={RiFileFill}
      primaryActions={[]}
    />
  );
};
