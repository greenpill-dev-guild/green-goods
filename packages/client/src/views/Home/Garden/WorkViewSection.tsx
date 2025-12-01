import {
  RiCheckDoubleFill,
  RiDownloadLine,
  RiExternalLinkLine,
  RiLeafFill,
  RiPencilFill,
  RiPlantFill,
  RiShareLine,
} from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { WorkView, type WorkViewAction } from "@/components/Work";

type ViewingMode = "operator" | "gardener" | "viewer";

type WorkViewSectionProps = {
  garden: Garden;
  work: Work;
  workMetadata: WorkMetadata | null;
  viewingMode: ViewingMode;
  actionTitle: string;
  onDownloadData: () => void;
  onDownloadMedia?: () => void;
  onShare: () => void;
  onViewAttestation?: () => void;
  footer?: React.ReactNode;
};

export const WorkViewSection: React.FC<WorkViewSectionProps> = ({
  garden,
  work,
  workMetadata,
  viewingMode,
  actionTitle,
  onDownloadData,
  onDownloadMedia,
  onShare,
  onViewAttestation,
  footer,
}) => {
  const intl = useIntl();

  const { feedback: workFeedback, media } = work;

  // Utility actions (download, share, view attestation)
  const primaryActions: WorkViewAction[] = [
    {
      id: "download-data",
      label: intl.formatMessage({
        id: "app.home.work.downloadData",
        defaultMessage: "Download Data",
      }),
      onClick: onDownloadData,
      icon: <RiDownloadLine className="w-6 h-6" />,
      className:
        "!bg-white !border-2 !border-[#3E8E4E] !text-[#3E8E4E] hover:!bg-[#3E8E4E]/5 !outline-none",
    },
    ...(media && media.length > 0 && onDownloadMedia
      ? [
          {
            id: "download-media",
            label: intl.formatMessage({
              id: "app.home.work.downloadMedia",
              defaultMessage: "Download Media",
            }),
            onClick: onDownloadMedia,
            icon: <RiDownloadLine className="w-6 h-6" />,
            className:
              "!bg-white !border-2 !border-[#FF7533] !text-[#FF7533] hover:!bg-[#FF7533]/5 !outline-none",
          },
        ]
      : []),
    {
      id: "share",
      label: intl.formatMessage({ id: "app.home.work.share", defaultMessage: "Share Work" }),
      onClick: onShare,
      icon: <RiShareLine className="w-6 h-6" />,
      className:
        "!bg-white !border-2 !border-[#D28560] !text-[#D28560] hover:!bg-[#D28560]/5 !outline-none",
    },
    ...(onViewAttestation
      ? [
          {
            id: "view-attestation",
            label: intl.formatMessage({
              id: "app.home.work.viewAttestation",
              defaultMessage: "View Attestation",
            }),
            onClick: onViewAttestation,
            icon: <RiExternalLinkLine className="w-6 h-6" />,
            className:
              "!bg-white !border-2 !border-[#6EE0F7] !text-[#6EE0F7] hover:!bg-[#6EE0F7]/5 !outline-none",
          },
        ]
      : []),
  ];

  const metadataUnavailable = intl.formatMessage({
    id: "app.status.notAvailable",
    defaultMessage: "Not available",
  });
  const plantSelectionValue =
    workMetadata?.plantSelection && workMetadata.plantSelection.length > 0
      ? workMetadata.plantSelection.join(", ")
      : workMetadata
        ? ""
        : metadataUnavailable;
  const plantCountValue =
    typeof workMetadata?.plantCount === "number"
      ? workMetadata.plantCount.toString()
      : workMetadata
        ? ""
        : metadataUnavailable;

  return (
    <WorkView
      title={
        viewingMode === "operator"
          ? intl.formatMessage({
              id: "app.home.workApproval.evaluateWork",
              defaultMessage: "Evaluate Work",
            })
          : viewingMode === "gardener"
            ? intl.formatMessage({
                id: "app.home.work.yourSubmission",
                defaultMessage: "Your Work Submission",
              })
            : intl.formatMessage({ id: "app.home.work.viewWork", defaultMessage: "View Work" })
      }
      info={
        viewingMode === "operator"
          ? intl.formatMessage({
              id: "app.home.workApproval.verifyIfTheWorkIsAcceptable",
              defaultMessage: "Verify if the work is acceptable",
            })
          : viewingMode === "gardener"
            ? intl.formatMessage({
                id: "app.home.work.submittedForReview",
                defaultMessage: "Submitted for review",
              })
            : intl.formatMessage({
                id: "app.home.work.exploreSubmission",
                defaultMessage: "Explore this work submission",
              })
      }
      garden={garden}
      actionTitle={actionTitle}
      media={media}
      details={[
        {
          label: intl.formatMessage({
            id: "app.home.workApproval.plantTypes",
            defaultMessage: "Plant Types",
          }),
          value: plantSelectionValue,
          icon: RiPlantFill,
        },
        ...(workFeedback
          ? [
              {
                label: intl.formatMessage({
                  id: "app.home.workApproval.description",
                  defaultMessage: "Description",
                }),
                value: workFeedback,
                icon: RiPencilFill,
              },
            ]
          : []),
        {
          label: intl.formatMessage({
            id: "app.home.workApproval.plantAmount",
            defaultMessage: "Plant Amount",
          }),
          value: plantCountValue,
          icon: RiLeafFill,
        },
      ]}
      headerIcon={RiCheckDoubleFill}
      primaryActions={primaryActions}
      footer={footer}
    />
  );
};

export default WorkViewSection;
