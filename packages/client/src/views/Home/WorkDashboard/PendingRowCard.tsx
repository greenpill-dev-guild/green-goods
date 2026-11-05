import { useWorkPreviewUrls } from "@green-goods/shared/hooks/work/useWorkImages";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { DraftCard } from "@/components/Cards";
import { PendingCard } from "@/components/Cards/Work/PendingCard";
import type { PendingRow, ToReviewRow } from "./buildPendingRows";

/**
 * One row of Your Work › Pending or To Review: work, a review, a draft or proof, each in the
 * pending card. Home's Continue draws the same rows, without Discard.
 */
export function PendingRowCard({
  row,
  actionTitle,
  onOpen,
  onDiscard,
}: {
  row: PendingRow | ToReviewRow;
  actionTitle?: string;
  onOpen: () => void;
  /** Offered only where throwing the row away is safe; the list confirms first. */
  onDiscard?: () => void;
}) {
  const intl = useIntl();
  if (row.type === "draft") {
    return (
      <DraftCard
        draft={row.draft}
        actionTitle={actionTitle}
        onResume={onOpen}
        onDelete={onDiscard}
      />
    );
  }
  if (row.type === "proof") return <ProofCard row={row} onOpen={onOpen} onDiscard={onDiscard} />;
  return (
    <PendingCard
      {...row.card}
      thumbnailUrl={row.work.media[0] ?? null}
      onOpen={onOpen}
      onDiscard={onDiscard}
      discardLabel={intl.formatMessage(
        { id: "app.pending.discardLabel" },
        { title: row.card.title }
      )}
    />
  );
}

/** Queued proof shows its first photo, read from the queue. */
function ProofCard({
  row,
  onOpen,
  onDiscard,
}: {
  row: Extract<PendingRow, { type: "proof" }>;
  onOpen: () => void;
  onDiscard?: () => void;
}) {
  const intl = useIntl();
  // The preview hook keys its URLs by the array it's handed, so it must stay the same array.
  const { firstPhoto } = row.proof;
  const photos = useMemo(() => (firstPhoto ? [firstPhoto] : []), [firstPhoto]);
  const [thumbnailUrl] = useWorkPreviewUrls(photos);
  return (
    <PendingCard
      {...row.card}
      thumbnailUrl={thumbnailUrl ?? null}
      onOpen={row.proof.garden ? onOpen : undefined}
      onDiscard={onDiscard}
      discardLabel={intl.formatMessage(
        { id: "app.pending.discardLabel" },
        { title: row.card.title }
      )}
    />
  );
}
