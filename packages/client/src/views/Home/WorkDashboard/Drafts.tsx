import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/blockchain";
import { useActions, useDrafts, useGardens, type DraftWithImages } from "@green-goods/shared/hooks";
import { findActionByUID } from "@green-goods/shared/utils";
import { RiAlertLine, RiDraftLine, RiLoader4Line, RiRefreshLine } from "@remixicon/react";
import React, { useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { DraftCard } from "@/components/Cards";
import { ConfirmDrawer } from "@/components/Dialogs";

export interface DraftsTabProps {
  className?: string;
  headerContent?: React.ReactNode;
}

/**
 * Drafts tab for WorkDashboard.
 * Shows all saved work drafts with options to resume or delete.
 */
export const DraftsTab: React.FC<DraftsTabProps> = ({ headerContent }) => {
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

  // Helper to get garden name
  const getGardenName = (gardenAddress: string | null): string | undefined => {
    if (!gardenAddress) return undefined;
    const garden = gardens.find((g) => g.id === gardenAddress);
    return garden?.name;
  };

  // Handle resume draft
  const handleResume = (draft: DraftWithImages) => {
    navigate(`/garden?draftId=${draft.id}`);
  };

  // Handle delete draft
  const handleDeleteClick = (draft: DraftWithImages) => {
    setDraftToDelete(draft);
  };

  const handleConfirmDelete = async () => {
    if (draftToDelete) {
      try {
        await deleteDraft(draftToDelete.id);
      } catch (error) {
        console.error("[DraftsTab] Failed to delete draft:", error);
      }
      setDraftToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDraftToDelete(null);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        {headerContent && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
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

  // Render empty state
  if (drafts.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {headerContent && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            {headerContent}
            <button
              onClick={() => refetchDrafts()}
              className="p-2 hover:bg-bg-weak-50 rounded-lg transition-colors"
              aria-label={intl.formatMessage({
                id: "app.drafts.refresh",
                defaultMessage: "Refresh drafts",
              })}
            >
              <RiRefreshLine className="w-4 h-4 text-text-sub-600" />
            </button>
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <RiDraftLine className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <h3 className="font-medium text-text-strong-950">
              {intl.formatMessage({
                id: "app.drafts.empty.title",
                defaultMessage: "No drafts yet",
              })}
            </h3>
            <p className="text-sm text-text-sub-600 mt-1">
              {intl.formatMessage({
                id: "app.drafts.empty.description",
                defaultMessage: "Drafts are automatically saved when you start adding photos",
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render drafts list
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
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
          className="p-2 hover:bg-bg-weak-50 rounded-lg transition-colors"
          aria-label={intl.formatMessage({
            id: "app.drafts.refresh",
            defaultMessage: "Refresh drafts",
          })}
        >
          <RiRefreshLine className="w-4 h-4 text-text-sub-600" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        <ul className="flex flex-col gap-3">
          {drafts.map((draft) => (
            <li key={draft.id}>
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

      {/* Delete Confirmation Drawer */}
      <ConfirmDrawer
        isOpen={!!draftToDelete}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title={intl.formatMessage({
          id: "app.drafts.delete.title",
          defaultMessage: "Delete Draft?",
        })}
        description={intl.formatMessage({
          id: "app.drafts.delete.description",
          defaultMessage:
            "This will permanently delete your draft and all associated images. This action cannot be undone.",
        })}
        confirmLabel={intl.formatMessage({
          id: "app.drafts.delete.confirm",
          defaultMessage: "Delete",
        })}
        cancelLabel={intl.formatMessage({
          id: "app.drafts.delete.cancel",
          defaultMessage: "Cancel",
        })}
        variant="danger"
        isLoading={isDeleting}
        icon={<RiAlertLine className="w-6 h-6 text-red-500" />}
      />
    </div>
  );
};

export default DraftsTab;
