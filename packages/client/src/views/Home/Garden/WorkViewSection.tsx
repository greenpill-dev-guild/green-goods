import {
  formatTimeSpent,
  type Garden,
  type Work,
  type WorkMetadata,
  type WorkMetadataV1,
} from "@green-goods/shared";
import {
  RiCheckDoubleFill,
  RiDownloadLine,
  RiExternalLinkLine,
  RiFileFill,
  RiLeafFill,
  RiPencilFill,
  RiPlantFill,
  RiShareLine,
  RiTimeFill,
} from "@remixicon/react";
import React, { useMemo } from "react";
import { useIntl } from "react-intl";
import { WorkView, type WorkViewAction } from "@/components/Features/Work";

type ViewingMode = "operator" | "gardener" | "viewer";

type WorkViewSectionProps = {
  garden?: Garden;
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

/** Type guard for v1 metadata shape */
function isV1Metadata(
  metadata: WorkMetadata | WorkMetadataV1 | Record<string, unknown> | null
): metadata is WorkMetadataV1 {
  if (!metadata) return false;
  return "plantCount" in metadata || "plantSelection" in metadata;
}

/** Build details list from metadata, supporting both v1 and v2 shapes */
function buildMetadataDetails(
  metadata: WorkMetadata | null,
  metadataUnavailable: string,
  intl: ReturnType<typeof useIntl>
) {
  // v2 metadata: generic details map
  if (metadata && "schemaVersion" in metadata && metadata.schemaVersion === "work_metadata_v2") {
    const items: Array<{
      label: string;
      value: string;
      icon: React.ComponentType<{ className?: string }>;
    }> = [];

    // Time spent
    if (metadata.timeSpentMinutes) {
      const formatted = formatTimeSpent(metadata.timeSpentMinutes);
      if (formatted) {
        items.push({
          label: intl.formatMessage({
            id: "app.home.workApproval.timeSpent",
            defaultMessage: "Time Spent",
          }),
          value: formatted,
          icon: RiTimeFill,
        });
      }
    }

    // Dynamic details
    if (metadata.details) {
      for (const [key, value] of Object.entries(metadata.details)) {
        if (value === undefined || value === null) continue;
        let display: string;
        if (Array.isArray(value)) {
          display = value.join(", ");
        } else if (typeof value === "number" || typeof value === "string") {
          display = String(value);
        } else {
          display = JSON.stringify(value);
        }
        if (display) {
          items.push({
            label: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
            value: display,
            icon: RiFileFill,
          });
        }
      }
    }

    // Tags
    if (metadata.tags && metadata.tags.length > 0) {
      items.push({
        label: intl.formatMessage({
          id: "app.home.workApproval.tags",
          defaultMessage: "Tags",
        }),
        value: metadata.tags.join(", "),
        icon: RiFileFill,
      });
    }

    return items;
  }

  // v1 metadata fallback (legacy plant-specific fields)
  if (isV1Metadata(metadata)) {
    const v1 = metadata;
    return [
      {
        label: intl.formatMessage({
          id: "app.home.workApproval.plantTypes",
          defaultMessage: "Plant Types",
        }),
        value:
          v1.plantSelection && v1.plantSelection.length > 0 ? v1.plantSelection.join(", ") : "",
        icon: RiPlantFill,
      },
      {
        label: intl.formatMessage({
          id: "app.home.workApproval.plantAmount",
          defaultMessage: "Plant Amount",
        }),
        value: typeof v1.plantCount === "number" ? v1.plantCount.toString() : "",
        icon: RiLeafFill,
      },
    ];
  }

  // No metadata available
  return [
    {
      label: intl.formatMessage({
        id: "app.home.workApproval.details",
        defaultMessage: "Details",
      }),
      value: metadataUnavailable,
      icon: RiFileFill,
    },
  ];
}

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
          defaultMessage: "Work Approved",
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
          defaultMessage: "Your Work Submission",
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
        "!bg-bg-white-0 !border-2 !border-[#3E8E4E] !text-[#3E8E4E] hover:!bg-[#3E8E4E]/5 !outline-none",
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
              "!bg-bg-white-0 !border-2 !border-[#FF7533] !text-[#FF7533] hover:!bg-[#FF7533]/5 !outline-none",
          },
        ]
      : []),
    {
      id: "share",
      label: intl.formatMessage({ id: "app.home.work.share", defaultMessage: "Share Work" }),
      onClick: onShare,
      icon: <RiShareLine className="w-6 h-6" />,
      className:
        "!bg-bg-white-0 !border-2 !border-[#D28560] !text-[#D28560] hover:!bg-[#D28560]/5 !outline-none",
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
              "!bg-bg-white-0 !border-2 !border-[#6EE0F7] !text-[#6EE0F7] hover:!bg-[#6EE0F7]/5 !outline-none",
          },
        ]
      : []),
  ];

  const metadataUnavailable = intl.formatMessage({
    id: "app.status.notAvailable",
    defaultMessage: "Not available",
  });

  // Build details from metadata (supports v1 and v2 shapes)
  const metadataDetails = useMemo(
    () => buildMetadataDetails(workMetadata, metadataUnavailable, intl),
    [workMetadata, metadataUnavailable, intl]
  );

  // Add feedback to details if present
  const allDetails = useMemo(() => {
    const items = [...metadataDetails];
    if (workFeedback) {
      items.push({
        label: intl.formatMessage({
          id: "app.home.workApproval.description",
          defaultMessage: "Description",
        }),
        value: workFeedback,
        icon: RiPencilFill,
      });
    }
    return items;
  }, [metadataDetails, workFeedback, intl]);

  return (
    <WorkView
      title={getTitle()}
      info={getInfo()}
      garden={garden}
      actionTitle={actionTitle}
      media={media}
      details={allDetails}
      headerIcon={RiCheckDoubleFill}
      primaryActions={primaryActions}
      footer={footer}
      reserveFooterSpace={reserveFooterSpace}
      footerSpacerClassName={footerSpacerClassName}
    />
  );
};

export default WorkViewSection;
