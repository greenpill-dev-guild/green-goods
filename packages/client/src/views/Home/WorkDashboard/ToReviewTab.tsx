import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useLinkedWorkUIDs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import { useCommitmentQueueState } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentQueueState";
import type { Address, Work } from "@green-goods/shared/types/domain";
import { findActionByUID } from "@green-goods/shared/utils/action/parsers";
import { RiInboxLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { toReviewRow } from "./buildPendingRows";
import { PendingRowCard } from "./PendingRowCard";
import { WorkListTab } from "./WorkListTab";

interface ToReviewTabProps {
  /** Work in the gardens this account may review that waits for its review, newest first. */
  items: Work[];
  viewer: Address | null;
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  /** Older work may wait beyond the rows read, so the list names no count and claims no end. */
  uncounted: boolean;
  onWorkClick: (work: Work) => void;
  onRefresh: () => void;
  isOffline?: boolean;
  savedAt?: number;
}

const TO_REVIEW_MESSAGES = {
  itemCount: { id: "app.workDashboard.toReview.count", defaultMessage: "{count} to review" },
  loading: { id: "app.workDashboard.loading", defaultMessage: "Loading your work..." },
  emptyTitle: { id: "app.workDashboard.toReview.empty", defaultMessage: "Nothing to review" },
  emptyDescription: {
    id: "app.workDashboard.toReview.description",
    defaultMessage: "Work waiting for your review shows up here.",
  },
};

/** None waiting among the rows read says nothing about older work beyond them. */
const RECENT_ONLY_MESSAGES = {
  ...TO_REVIEW_MESSAGES,
  emptyTitle: {
    id: "app.workDashboard.toReview.emptyRecent",
    defaultMessage: "Nothing to review in recent work",
  },
  emptyDescription: {
    id: "app.workDashboard.toReview.emptyRecentDescription",
    defaultMessage: "Older work may still be waiting. See All under Recent Activity lists it.",
  },
};

/**
 * Your Work › To Review (DL-149): the review queue, moved out of Pending and counted on this tab,
 * so Pending and the Home badge hold the member's own work. It is the one list and header the
 * other tabs share, with the review rows Pending used to list.
 */
export const ToReviewTab: React.FC<ToReviewTabProps> = ({
  items,
  viewer,
  isLoading,
  isFetching,
  hasError,
  uncounted,
  onWorkClick,
  onRefresh,
  isOffline,
  savedAt,
}) => {
  const intl = useIntl();
  const { data: actions = [] } = useActions();
  const queue = useCommitmentQueueState(viewer);
  const { linked } = useLinkedWorkUIDs({
    chainId: DEFAULT_CHAIN_ID,
    workUIDs: items.map((work) => work.id),
  });
  const context = {
    intl,
    actionTitle: (actionUID: number) => findActionByUID(actions, actionUID)?.title,
    isLinked: (work: Work) => linked.has(work.id.toLowerCase()) || queue.linkedWorkIds.has(work.id),
  };

  return (
    <WorkListTab
      items={items}
      isLoading={isLoading}
      isFetching={isFetching}
      hasError={hasError}
      uncounted={uncounted}
      onWorkClick={onWorkClick}
      onRefresh={onRefresh}
      isOffline={isOffline}
      savedAt={savedAt}
      renderRow={(work) => (
        <div className="cv-draft-card">
          <PendingRowCard row={toReviewRow(work, context)} onOpen={() => onWorkClick(work)} />
        </div>
      )}
      messages={uncounted ? RECENT_ONLY_MESSAGES : TO_REVIEW_MESSAGES}
      emptyIcon={<RiInboxLine />}
    />
  );
};
