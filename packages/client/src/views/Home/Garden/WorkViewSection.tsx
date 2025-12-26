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
import { WorkView, type WorkViewAction } from "@/components/Features/Work";

type ViewingMode = "operator" | "gardener" | "viewer";

type WorkViewSectionProps = {
  garden: Garden;
  work: Work;
  workMetadata: WorkMetadata | null;
  viewingMode: ViewingMode;
  actionTitle: string;
  effectiveStatus: "approved" | "rejected" | "pending";
  onDownloadData: () => void;
  onDownloadMedia?: () => void;
  onShare: () => void;
  onViewAttestation?: () => void;
  footer?: React.ReactNode;
  reserveFooterSpace?: boolean;
  footerSpacerClassName?: string;
};

export const WorkViewSection: React.FC<WorkViewSectionProps> = ({
  garden,
  work,
  workMetadata,
  viewingMode,
  actionTitle,
  effectiveStatus,
  onDownloadData,
  onDownloadMedia,
  onShare,
  onViewAttestation,
  footer,
  reserveFooterSpace,
  footerSpacerClassName,
}) => {
  const intl = useIntl();

  const { feedback: workFeedback, media } = work;

  // Dynamic title based on status and viewing mode
  const getTitle = () => {
    if (viewingMode === "operator") {
      if (effectiveStatus === "approved") {
        return intl.formatMessage({
          id: "app.home.workApproval.workApproved",
          defaultMessage: "Work Approved ✓",
        });
      }
      if (effectiveStatus === "rejected") {
        return intl.formatMessage({
          id: "app.home.workApproval.workRejected",
          defaultMessage: "Work Rejected",
        });
      }
      return intl.formatMessage({
        id: "app.home.workApproval.evaluateWork",
        defaultMessage: "Evaluate Work",
      });
    }

    if (viewingMode === "gardener") {
      if (effectiveStatus === "approved") {
        return intl.formatMessage({
          id: "app.home.work.yourSubmissionApproved",
          defaultMessage: "Your Work Submission ✓",
        });
      }
      return intl.formatMessage({
        id: "app.home.work.yourSubmission",
        defaultMessage: "Your Work Submission",
      });
    }

    return intl.formatMessage({
      id: "app.home.work.viewWork",
      defaultMessage: "View Work",
    });
  };

  // Dynamic info text based on status and viewing mode
  const getInfo = () => {
    if (viewingMode === "operator") {
      if (effectiveStatus === "approved") {
        return intl.formatMessage({
          id: "app.home.workApproval.workHasBeenApproved",
          defaultMessage: "This work has been approved",
        });
      }
      if (effectiveStatus === "rejected") {
        return intl.formatMessage({
          id: "app.home.workApproval.workHasBeenRejected",
          defaultMessage: "This work has been rejected",
        });
      }
      return intl.formatMessage({
        id: "app.home.workApproval.verifyIfTheWorkIsAcceptable",
        defaultMessage: "Verify if the work is acceptable",
      });
    }

    if (viewingMode === "gardener") {
      if (effectiveStatus === "approved") {
        return intl.formatMessage({
          id: "app.home.work.approvedByOperator",
          defaultMessage: "Your work has been approved by the garden operator",
        });
      }
      if (effectiveStatus === "rejected") {
        return intl.formatMessage({
          id: "app.home.work.notApproved",
          defaultMessage: "This work was not approved",
        });
      }
      return intl.formatMessage({
        id: "app.home.work.submittedForReview",
        defaultMessage: "Submitted for review",
      });
    }

    return intl.formatMessage({
      id: "app.home.work.exploreSubmission",
      defaultMessage: "Explore this work submission",
    });
  };

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
      title={getTitle()}
      info={getInfo()}
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
      reserveFooterSpace={reserveFooterSpace}
      footerSpacerClassName={footerSpacerClassName}
    />
  );
};

export default WorkViewSection;
