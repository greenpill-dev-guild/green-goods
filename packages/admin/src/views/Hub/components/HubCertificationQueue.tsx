import {
  Alert,
  EmptyState,
  EmptyStateShell,
  formatRelativeTime,
  WorkbenchList,
  WorkbenchRow,
} from "@green-goods/shared";
import { RiMedalLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";

interface CertificationItem {
  id: string;
  title?: string | null;
  description?: string | null;
  assessmentType?: string | null;
  createdAt: number;
}

interface HubCertificationQueueProps {
  items: CertificationItem[];
  fetchingAssessments: boolean;
  hypercertsLoading: boolean;
  hasDataError: boolean;
  canManage: boolean;
  selectedCertificationId: string | undefined;
  onOpenCertification: (assessmentId: string) => void;
}

export function HubCertificationQueue({
  items,
  fetchingAssessments,
  hypercertsLoading,
  hasDataError,
  canManage,
  selectedCertificationId,
  onOpenCertification,
}: HubCertificationQueueProps) {
  const { formatMessage } = useIntl();

  if (hasDataError) {
    return (
      <EmptyStateShell>
        <Alert variant="error">
          {formatMessage({
            id: "cockpit.hub.error",
            defaultMessage: "Hub data could not be loaded. Refresh the workspace and try again.",
          })}
        </Alert>
      </EmptyStateShell>
    );
  }

  if (fetchingAssessments || hypercertsLoading) {
    return <HubWorkbenchSkeletonRows count={3} />;
  }

  if (items.length === 0) {
    return (
      <EmptyStateShell>
        <EmptyState
          icon={<RiMedalLine className="h-6 w-6" />}
          title={formatMessage({
            id: "cockpit.hub.certify.placeholder.title",
            defaultMessage: "Certification pipeline",
          })}
          description={formatMessage({
            id: "cockpit.hub.certify.placeholder.description",
            defaultMessage: "Completed assessments will appear here for minting as hypercerts.",
          })}
        />
      </EmptyStateShell>
    );
  }

  return (
    <WorkbenchList>
      {items.map((assessment) => {
        const hasMintAuthority = canManage;
        return (
          <WorkbenchRow
            key={assessment.id}
            eyebrow={formatMessage({ id: "cockpit.hub.tab.certify", defaultMessage: "Certify" })}
            title={
              assessment.title ||
              formatMessage({
                id: "app.garden.admin.assessmentFallback",
                defaultMessage: "Assessment",
              })
            }
            description={
              hasMintAuthority
                ? formatMessage({
                    id: "cockpit.hub.certify.queueDescription",
                    defaultMessage:
                      "Open the certification inspector to validate the package before minting.",
                  })
                : formatMessage({
                    id: "cockpit.hub.certify.readOnlyDescription",
                    defaultMessage:
                      "You can review the certification handoff here, but only garden owners or operators can mint the hypercert.",
                  })
            }
            meta={[
              assessment.assessmentType ||
                formatMessage({ id: "cockpit.garden.impact", defaultMessage: "Impact" }),
              formatRelativeTime(assessment.createdAt),
            ]}
            statusLabel={
              hasMintAuthority
                ? formatMessage({
                    id: "cockpit.hub.certify.readyLabel",
                    defaultMessage: "Ready to certify",
                  })
                : formatMessage({
                    id: "cockpit.hub.certify.readOnlyLabel",
                    defaultMessage: "Read-only handoff",
                  })
            }
            statusTone="certify"
            leadingIcon={RiMedalLine}
            selected={selectedCertificationId === assessment.id}
            onClick={() => onOpenCertification(assessment.id)}
          />
        );
      })}
    </WorkbenchList>
  );
}
