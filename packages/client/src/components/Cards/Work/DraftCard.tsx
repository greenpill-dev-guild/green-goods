import { useDraftThumbnail, type DraftWithImages } from "@green-goods/shared/hooks/work/useDrafts";
import React from "react";
import { useIntl } from "react-intl";
import { formatAgoStandalone } from "./pendingCopy";
import { PendingCard } from "./PendingCard";

export interface DraftCardProps {
  draft: DraftWithImages;
  actionTitle?: string;
  className?: string;
  onResume: () => void;
  onDelete: () => void;
}

/**
 * A work draft in Your Work › Pending: the pending row with the Draft pill,
 * when it was last touched, and which step it reached with how many photos.
 * Its photo loads once the row scrolls into view.
 */
export const DraftCard: React.FC<DraftCardProps> = ({
  draft,
  actionTitle,
  className,
  onResume,
  onDelete,
}) => {
  const intl = useIntl();
  const thumbnail = useDraftThumbnail(draft);
  const imageCount = draft.attachmentCount ?? draft.images.length;

  return (
    <PendingCard
      kind="draft"
      pill={intl.formatMessage({ id: "app.draft.status", defaultMessage: "Draft" })}
      title={
        actionTitle ||
        intl.formatMessage({ id: "app.draft.untitled", defaultMessage: "Untitled Draft" })
      }
      meta={formatAgoStandalone(intl, draft.updatedAt)}
      marker={
        draft.linkIntent
          ? {
              kind: "linked",
              label: intl.formatMessage({
                id: "app.pending.marker.linked",
                defaultMessage: "For a promise",
              }),
            }
          : undefined
      }
      status={intl.formatMessage(
        {
          id: "app.pending.status.draft",
          defaultMessage:
            "{count, plural, =0 {Step {step} of 4} one {Step {step} of 4 · # photo} other {Step {step} of 4 · # photos}}",
        },
        { step: stepNumber(draft.firstIncompleteStep), count: imageCount }
      )}
      thumbnailUrl={draft.thumbnailUrl ?? thumbnail.url}
      thumbnailRef={thumbnail.ref}
      onOpen={onResume}
      onDiscard={onDelete}
      discardLabel={intl.formatMessage({ id: "app.draft.delete", defaultMessage: "Delete Draft" })}
      className={className}
    />
  );
};

/** The step a draft reached, 1 to 4, from its first incomplete step. */
function stepNumber(step: string): number {
  switch (step) {
    case "media":
      return 2;
    case "details":
      return 3;
    case "review":
      return 4;
    default:
      return 1;
  }
}
