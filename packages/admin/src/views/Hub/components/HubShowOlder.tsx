import { Button } from "@green-goods/shared/components/Button";
import type { HubOlderRecords } from "@green-goods/shared/hooks/admin-ui/hub/hub.workbenchModel";

interface HubShowOlderProps {
  older: HubOlderRecords;
  label: string;
}

/**
 * Reads the next page of a Hub list's older records. A list holds its
 * garden's newest page, so while the garden has more this is how a steward
 * reaches the rest, and its presence is what says there is more.
 */
export function HubShowOlderButton({ older, label }: HubShowOlderProps) {
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

/** The foot of a Hub list that has more: its next page, centered under the rows. */
export function HubShowOlder(props: HubShowOlderProps) {
  return (
    <div className="flex justify-center" data-slot="show-older">
      <HubShowOlderButton {...props} />
    </div>
  );
}
