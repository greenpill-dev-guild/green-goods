import type { HubPipelineStage } from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import {
  type HubActionSummary,
  selectHubStageContent,
} from "@green-goods/shared/hooks/admin-ui/hub/hub.workbenchModel";
import type { Address, Work } from "@green-goods/shared/types/domain";
import type { CommitmentsToConfirm } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentsToConfirm";
import { HubAssessmentQueue } from "./HubAssessmentQueue";
import { HubCertificationQueue } from "./HubCertificationQueue";
import { HubConfirmQueue } from "./HubConfirmQueue";
import { HubWorkQueue } from "./HubWorkQueue";

interface CertificationItem {
  id: string;
  title?: string | null;
  description?: string | null;
  assessmentType?: string | null;
  createdAt: number;
}

interface HubStageContentProps {
  stage: HubPipelineStage;
  pendingWorks: Work[];
  assessmentQueue: Work[];
  certificationQueue: CertificationItem[];
  worksLoading: boolean;
  fetchingAssessments: boolean;
  hypercertsLoading: boolean;
  hasDataError: boolean;
  normalizedSearch: string;
  debouncedSearch: string;
  actionsMap: Map<number, HubActionSummary>;
  selectedGardenName?: string;
  selectedWorkId: string | undefined;
  selectedCertificationId: string | undefined;
  canManage: boolean;
  /** The Confirm stage's queue (uiux-spec §6.9), read by the Hub controller. */
  toConfirm: CommitmentsToConfirm;
  chainId: number;
  viewer?: Address;
  selectedCommitmentId: string | undefined;
  onOpenCommitment: (commitmentId: string) => void;
  onCloseCommitment: () => void;
  onOpenWorkDetail: (workId: string) => void;
  onClearSearch: () => void;
  onOpenCertification: (assessmentId: string) => void;
}

export function HubStageContent({
  stage,
  pendingWorks,
  assessmentQueue,
  certificationQueue,
  worksLoading,
  fetchingAssessments,
  hypercertsLoading,
  hasDataError,
  normalizedSearch,
  debouncedSearch,
  actionsMap,
  selectedGardenName,
  selectedWorkId,
  selectedCertificationId,
  canManage,
  toConfirm,
  chainId,
  viewer,
  selectedCommitmentId,
  onOpenCommitment,
  onCloseCommitment,
  onOpenWorkDetail,
  onClearSearch,
  onOpenCertification,
}: HubStageContentProps) {
  const content = selectHubStageContent(stage);

  if (content === "work") {
    return (
      <HubWorkQueue
        items={pendingWorks}
        worksLoading={worksLoading}
        hasDataError={hasDataError}
        normalizedSearch={normalizedSearch}
        debouncedSearch={debouncedSearch}
        actionsMap={actionsMap}
        selectedGardenName={selectedGardenName}
        selectedWorkId={selectedWorkId}
        onOpenWorkDetail={onOpenWorkDetail}
        onClearSearch={onClearSearch}
      />
    );
  }

  if (content === "assess") {
    return (
      <HubAssessmentQueue
        items={assessmentQueue}
        worksLoading={worksLoading}
        hasDataError={hasDataError}
        actionsMap={actionsMap}
        selectedGardenName={selectedGardenName}
        selectedWorkId={selectedWorkId}
        onOpenWorkDetail={onOpenWorkDetail}
      />
    );
  }

  if (content === "confirm") {
    return (
      <HubConfirmQueue
        toConfirm={toConfirm}
        chainId={chainId}
        viewer={viewer}
        normalizedSearch={normalizedSearch}
        selectedCommitmentId={selectedCommitmentId}
        onOpenCommitment={onOpenCommitment}
        onCloseCommitment={onCloseCommitment}
      />
    );
  }

  return (
    <HubCertificationQueue
      items={certificationQueue}
      fetchingAssessments={fetchingAssessments}
      hypercertsLoading={hypercertsLoading}
      hasDataError={hasDataError}
      canManage={canManage}
      selectedCertificationId={selectedCertificationId}
      onOpenCertification={onOpenCertification}
    />
  );
}
