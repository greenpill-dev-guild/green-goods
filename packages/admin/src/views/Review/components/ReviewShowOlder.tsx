import { Button } from "@green-goods/shared/components/Button";
import type { ReviewOlderRecords } from "@green-goods/shared/hooks/admin-ui/review/review.workbenchModel";

interface ReviewShowOlderButtonProps {
  older: ReviewOlderRecords;
  label: string;
}

/**
 * Reads the next page of a Review list's older records. A list holds its
 * garden's newest page, so while the garden has more this is how a steward
 * reaches the rest. Offline, where no page can be read, there is no button.
 */
export function ReviewShowOlderButton({ older, label }: ReviewShowOlderButtonProps) {
  if (!older.onShowOlder) return null;
  return (
    <Button
      type="button"
      emphasis="tertiary"
      size="compact"
      loading={older.isLoading}
      onClick={older.onShowOlder}
    >
      {label}
    </Button>
  );
}

interface ReviewShowOlderProps extends ReviewShowOlderButtonProps {
  /** What the list says when it cannot read the next page, as offline. */
  notLoaded: string;
}

/** The foot of a Review list that has more: its next page, centered under the rows. */
export function ReviewShowOlder({ older, label, notLoaded }: ReviewShowOlderProps) {
  return (
    <div className="flex justify-center" data-slot="show-older">
      {older.onShowOlder ? (
        <ReviewShowOlderButton older={older} label={label} />
      ) : (
        <p className="type-meta text-text-sub">{notLoaded}</p>
      )}
    </div>
  );
}
