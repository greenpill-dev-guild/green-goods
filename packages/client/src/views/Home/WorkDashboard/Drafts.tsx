import { PwaSheet } from "@green-goods/shared/components/Dialog/PwaSheet";
import { Button } from "@/components/Actions";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useActions, useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { type DraftWithImages, useDrafts } from "@green-goods/shared/hooks/work/useDrafts";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { Address } from "@green-goods/shared/types/domain";
import { findActionByUID } from "@green-goods/shared/utils/action/parsers";
import { RiDraftLine, RiLoader4Line, RiRefreshLine } from "@remixicon/react";
import { createPortal } from "react-dom";
import React, { useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { DraftCard } from "@/components/Cards";
import { EmptyState } from "@/components/Communication";
import { APP_ROUTES } from "@/config/pwaRouting";

export interface DraftsTabProps {
  className?: string;
  headerContent?: React.ReactNode;
  onBeforeNavigate?: () => void;
}

/**
 * Drafts tab for WorkDashboard.
 * Shows all saved work drafts with options to resume or delete.
 */
export const DraftsTab: React.FC<DraftsTabProps> = ({ headerContent, onBeforeNavigate }) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { drafts, isLoading, deleteDraft, isDeleting, refetchDrafts } = useDrafts();
  const { data: actions = [] } = useActions();
  const { data: gardens = [] } = useGardens(DEFAULT_CHAIN_ID);

  // Confirm delete state
  const [draftToDelete, setDraftToDelete] = useState<DraftWithImages | null>(null);

  // Helper to get action title
  const getActionTitle = (actionUID: number | null): string | undefined => {
    if (actionUID === null) return undefined;
    const action = findActionByUID(actions, actionUID);
    return action?.title;
  };

  const getGardenName = (gardenAddress: Address | null): string | undefined => {
    if (!gardenAddress) return undefined;
    const garden = gardens.find((g) => g.id === gardenAddress);
    return garden?.name;
  };

  const handleResume = (draft: DraftWithImages) => {
    onBeforeNavigate?.();
    navigate(`${APP_ROUTES.garden}?draftId=${draft.id}`, { viewTransition: true });
  };

  const handleDeleteClick = (draft: DraftWithImages) => {
    setDraftToDelete(draft);
  };

  const handleConfirmDelete = async () => {
    if (draftToDelete) {
      try {
        await deleteDraft(draftToDelete.id);
        setDraftToDelete(null);
      } catch (error) {
        logger.error("[DraftsTab] Failed to delete draft:", { error });
        toastService.error({
          title: intl.formatMessage({
            id: "app.drafts.delete.error",
            defaultMessage: "Delete failed",
          }),
          message: intl.formatMessage({
            id: "app.drafts.delete.errorMessage",
            defaultMessage: "Could not delete the draft. Please try again.",
          }),
          context: "drafts",
        });
      }
    }
  };

  const handleCancelDelete = () => {
    if (!isDeleting) setDraftToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col">
        {headerContent && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-stroke-soft-200">
            {headerContent}
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-text-sub-600">
            <RiLoader4Line className="w-5 h-5 animate-spin" />
            <span className="text-sm">
              {intl.formatMessage({
                id: "app.drafts.loading",
                defaultMessage: "Loading drafts...",
              })}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex min-h-full flex-col">
        {headerContent && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-stroke-soft-200">
            {headerContent}
            <button
              onClick={() => refetchDrafts()}
              className="p-2 hover:bg-bg-weak-50 rounded-lg tap-target-lg transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]"
              aria-label={intl.formatMessage({
                id: "app.drafts.refresh",
                defaultMessage: "Refresh Drafts",
              })}
            >
              <RiRefreshLine className="w-4 h-4 text-text-sub-600" />
            </button>
          </div>
        )}
        <EmptyState
          className="flex-1"
          icon={<RiDraftLine />}
          title={intl.formatMessage({
            id: "app.drafts.empty.title",
            defaultMessage: "No drafts yet",
          })}
          description={intl.formatMessage({
            id: "app.drafts.empty.description",
            defaultMessage: "Drafts are automatically saved when you start adding photos",
          })}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-stroke-soft-200">
        <div className="flex items-center gap-2">
          {headerContent}
          <span className="text-xs text-text-sub-600">
            {intl.formatMessage(
              { id: "app.drafts.count", defaultMessage: "{count} draft(s)" },
              { count: drafts.length }
            )}
          </span>
        </div>
        <button
          onClick={() => refetchDrafts()}
          className="p-2 hover:bg-bg-weak-50 rounded-lg tap-target-lg transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]"
          aria-label={intl.formatMessage({
            id: "app.drafts.refresh",
            defaultMessage: "Refresh Drafts",
          })}
        >
          <RiRefreshLine className="w-4 h-4 text-text-sub-600" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 p-4">
        <ul className="flex flex-col gap-3">
          {drafts.map((draft) => (
            <li key={draft.id} className="cv-draft-card">
              <DraftCard
                draft={draft}
                actionTitle={getActionTitle(draft.actionUID)}
                gardenName={getGardenName(draft.gardenAddress)}
                onResume={() => handleResume(draft)}
                onDelete={() => handleDeleteClick(draft)}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* Delete Confirmation Dialog */}
      {createPortal(
        <PwaSheet
          open={!!draftToDelete}
          onClose={handleCancelDelete}
          ariaLabel={intl.formatMessage({ id: "app.drafts.delete.title" })}
          dragToDismiss={!isDeleting}
        >
          <div className="flex flex-col gap-4 p-4">
            <h2 className="text-lg font-semibold">
              {intl.formatMessage({ id: "app.drafts.delete.title" })}
            </h2>
            <p>{intl.formatMessage({ id: "app.drafts.delete.description" })}</p>
            <Button
              label={intl.formatMessage({ id: "app.drafts.delete.confirm" })}
              onClick={() => void handleConfirmDelete()}
              disabled={isDeleting}
              variant="primary"
              mode="filled"
              size="medium"
            />
            <Button
              label={intl.formatMessage({ id: "app.drafts.delete.cancel" })}
              onClick={handleCancelDelete}
              disabled={isDeleting}
              variant="neutral"
              mode="stroke"
              size="medium"
            />
          </div>
        </PwaSheet>,
        document.body
      )}
    </div>
  );
};
