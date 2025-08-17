import { RiCheckDoubleFill, RiLeafFill, RiPencilFill, RiPlantFill } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { WorkView, type WorkViewAction } from "@/components/UI/WorkView/WorkView";

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

  const { feedback, media } = work;

  const primaryActions: WorkViewAction[] = [
    {
      id: "download-data",
      label: intl.formatMessage({
        id: "app.home.work.downloadData",
        defaultMessage: "Download Data",
      }),
      onClick: onDownloadData,
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
          },
        ]
      : []),
    {
      id: "share",
      label: intl.formatMessage({ id: "app.home.work.share", defaultMessage: "Share Work" }),
      onClick: onShare,
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
          },
        ]
      : []),
  ];

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
          value: workMetadata?.plantSelection.join(", ") || "",
          icon: RiPlantFill,
        },
        ...(feedback
          ? [
              {
                label: intl.formatMessage({
                  id: "app.home.workApproval.description",
                  defaultMessage: "Description",
                }),
                value: feedback,
                icon: RiPencilFill,
              },
            ]
          : []),
        {
          label: intl.formatMessage({
            id: "app.home.workApproval.plantAmount",
            defaultMessage: "Plant Amount",
          }),
          value: workMetadata?.plantCount?.toString() || "",
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
