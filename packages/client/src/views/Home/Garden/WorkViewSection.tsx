import {
  RiCheckDoubleFill,
  RiCheckLine,
  RiCloseLine,
  RiLeafFill,
  RiPencilFill,
  RiPlantFill,
} from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { WorkView, type WorkViewAction } from "@/components/UI/WorkView/WorkView";
import { FormText } from "@/components/UI/Form/Text";

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
  onApprove?: () => void;
  onReject?: () => void;
  feedback?: string;
  onFeedbackChange?: (value: string) => void;
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
  onApprove,
  onReject,
  feedback,
  onFeedbackChange,
  footer,
}) => {
  const intl = useIntl();

  const { feedback: workFeedback, media } = work;

  // Approval actions for operators (shown at the top for easy access)
  const approvalActions: WorkViewAction[] =
    viewingMode === "operator" && work.status === "pending" && onApprove && onReject
      ? [
          {
            id: "approve",
            label: intl.formatMessage({
              id: "app.home.workApproval.approve",
              defaultMessage: "Approve",
            }),
            onClick: onApprove,
            icon: <RiCheckLine className="w-5 h-5" />,
          },
          {
            id: "reject",
            label: intl.formatMessage({
              id: "app.home.workApproval.reject",
              defaultMessage: "Reject",
            }),
            onClick: onReject,
            icon: <RiCloseLine className="w-5 h-5" />,
          },
        ]
      : [];

  // Utility actions (download, share, view attestation)
  const utilityActions: WorkViewAction[] = [
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

  // Primary actions: approval actions first (if applicable), then utility actions
  const primaryActions: WorkViewAction[] = [...approvalActions, ...utilityActions];

  // Feedback section for operators reviewing pending work
  const feedbackSection =
    viewingMode === "operator" && work.status === "pending" && onFeedbackChange ? (
      <>
        <h6 className="text-text-strong-950 mt-2">
          {intl.formatMessage({
            id: "app.home.workApproval.feedback",
            defaultMessage: "Feedback",
          })}
        </h6>
        <div className="bg-bg-weak-50 border border-stroke-soft-200 rounded-xl p-4">
          <FormText
            rows={4}
            placeholder={intl.formatMessage({
              id: "app.home.workApproval.feedbackPlaceholder",
              defaultMessage:
                "Add feedback for the gardener (optional for approval, required for rejection)...",
            })}
            value={feedback || ""}
            onChange={(e) => onFeedbackChange(e.target.value)}
            className="bg-bg-white-0"
          />
          <p className="text-xs text-text-soft-400 mt-2">
            {intl.formatMessage({
              id: "app.home.workApproval.feedbackHint",
              defaultMessage:
                "This feedback will be included with your approval or rejection decision.",
            })}
          </p>
        </div>
      </>
    ) : undefined;

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
      feedbackSection={feedbackSection}
      footer={footer}
    />
  );
};

export default WorkViewSection;
