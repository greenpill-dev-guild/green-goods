import type {
  HubPipelineStage,
  HubWorkScope,
} from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import {
  type HubActionSummary,
  selectHubStageContent,
} from "@green-goods/shared/hooks/admin-ui/hub/hub.workbenchModel";
import type { Address, Work } from "@green-goods/shared/types/domain";
import type { CommitmentsToConfirm } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentsToConfirm";
import { HubConfirmQueue } from "./HubConfirmQueue";
import {
  HubAssessmentList,
  type HubAssessmentListItem,
  HubHypercertList,
  type HubHypercertListItem,
} from "./HubRecordLists";
import { HubWorkQueue } from "./HubWorkQueue";

interface HubStageContentProps {
  stage: HubPipelineStage;
  /** The Work tab's list for its current scope. */
  works: Work[];
  workScope: HubWorkScope;
  assessments: HubAssessmentListItem[];
  hypercerts: HubHypercertListItem[];
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
  /** Where each create flow opens; omitted for a reader who cannot create that record. */
  createAssessmentHref?: string;
  createHypercertHref?: string;
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
  onOpenHypercert: (hypercertId: string) => void;
}

export function HubStageContent({
  stage,
  works,
  workScope,
  assessments,
  hypercerts,
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
  createAssessmentHref,
  createHypercertHref,
  toConfirm,
  chainId,
  viewer,
  selectedCommitmentId,
  onOpenCommitment,
  onCloseCommitment,
  onOpenWorkDetail,
  onClearSearch,
  onOpenCertification,
  onOpenHypercert,
}: HubStageContentProps) {
  const content = selectHubStageContent(stage);

  if (content === "work") {
    return (
      <HubWorkQueue
        items={works}
        scope={workScope}
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
      <HubAssessmentList
        items={assessments}
        isLoading={fetchingAssessments}
        hasDataError={hasDataError}
        searchQuery={normalizedSearch ? debouncedSearch : ""}
        onClearSearch={onClearSearch}
        createHref={createAssessmentHref}
        selectedAssessmentId={selectedCertificationId}
        onOpenAssessment={onOpenCertification}
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
    <HubHypercertList
      items={hypercerts}
      isLoading={hypercertsLoading}
      hasDataError={hasDataError}
      searchQuery={normalizedSearch ? debouncedSearch : ""}
      onClearSearch={onClearSearch}
      createHref={createHypercertHref}
      onOpenHypercert={onOpenHypercert}
    />
  );
}
