import type {
  ReviewPipelineStage,
  ReviewWorkScope,
} from "@green-goods/shared/hooks/admin-ui/review/review.utils";
import {
  type ReviewActionSummary,
  type ReviewOlderRecords,
  selectReviewStageContent,
} from "@green-goods/shared/hooks/admin-ui/review/review.workbenchModel";
import type { Address, Work } from "@green-goods/shared/types/domain";
import type { CommitmentsToConfirm } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentsToConfirm";
import type { ReviewBatch } from "@green-goods/shared/hooks/work/useWorkApproval";
import { ReviewConfirmQueue } from "./ReviewConfirmQueue";
import {
  ReviewAssessmentList,
  type ReviewAssessmentListItem,
  ReviewHypercertList,
  type ReviewHypercertListItem,
} from "./ReviewRecordLists";
import { ReviewWorkQueue } from "./ReviewWorkQueue";

interface ReviewStageContentProps {
  stage: ReviewPipelineStage;
  /** The Work tab's list for its current scope. */
  works: Work[];
  workScope: ReviewWorkScope;
  /** Works on a day's list whose status could not be read. */
  unknownIds?: ReadonlySet<string>;
  /** On one day's list: shows every status, where works whose status is unread are listed. */
  onShowWholeDay?: () => void;
  /** Clears the chosen waiting-time band, when one narrows the Work list. */
  onClearWaitingBand?: () => void;
  assessments: ReviewAssessmentListItem[];
  hypercerts: ReviewHypercertListItem[];
  worksLoading: boolean;
  fetchingAssessments: boolean;
  hypercertsLoading: boolean;
  hasDataError: boolean;
  normalizedSearch: string;
  debouncedSearch: string;
  actionsMap: Map<number, ReviewActionSummary>;
  selectedGardenName?: string;
  selectedWorkId: string | undefined;
  selectedCertificationId: string | undefined;
  /** Where each create flow opens; omitted for a reader who cannot create that record. */
  createAssessmentHref?: string;
  createHypercertHref?: string;
  /** The Confirm stage's queue (uiux-spec §6.9), read by the Review controller. */
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
  reviewBatch?: ReviewBatch;
  /** Each list's next page of older records, while the garden has more than it holds. */
  olderWork?: ReviewOlderRecords;
  olderHypercerts?: ReviewOlderRecords;
}

export function ReviewStageContent({
  stage,
  works,
  workScope,
  unknownIds,
  onShowWholeDay,
  onClearWaitingBand,
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
  reviewBatch,
  olderWork,
  olderHypercerts,
}: ReviewStageContentProps) {
  const content = selectReviewStageContent(stage);

  if (content === "work") {
    return (
      <ReviewWorkQueue
        items={works}
        scope={workScope}
        unknownIds={unknownIds}
        onShowWholeDay={onShowWholeDay}
        worksLoading={worksLoading}
        hasDataError={hasDataError}
        normalizedSearch={normalizedSearch}
        debouncedSearch={debouncedSearch}
        actionsMap={actionsMap}
        selectedGardenName={selectedGardenName}
        selectedWorkId={selectedWorkId}
        onOpenWorkDetail={onOpenWorkDetail}
        onClearSearch={onClearSearch}
        reviewBatch={reviewBatch}
        older={olderWork}
        onClearWaitingBand={onClearWaitingBand}
      />
    );
  }

  if (content === "assess") {
    return (
      <ReviewAssessmentList
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
      <ReviewConfirmQueue
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
    <ReviewHypercertList
      items={hypercerts}
      isLoading={hypercertsLoading}
      hasDataError={hasDataError}
      searchQuery={normalizedSearch ? debouncedSearch : ""}
      onClearSearch={onClearSearch}
      createHref={createHypercertHref}
      onOpenHypercert={onOpenHypercert}
      older={olderHypercerts}
    />
  );
}
