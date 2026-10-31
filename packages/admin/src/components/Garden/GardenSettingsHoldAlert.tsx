import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import type { GardenSettingsHold } from "@green-goods/shared/hooks/garden/useUpdateGarden";
import { useIntl } from "react-intl";
import { gardenSettingsFieldTitle, gardenSettingsValueText } from "./gardenSettingsSave";

/**
 * A save whose outcome nobody can say yet. It shows what the chain holds now, so
 * the person can decide with fresh values: its fields stay locked until they
 * check again and it has landed, or they choose to move on.
 */
export function GardenSettingsHoldAlert({
  hold,
  isSettling,
  isSaving,
  onCheckAgain,
  onMoveOn,
}: {
  hold: GardenSettingsHold;
  isSettling: boolean;
  /** Another save is in flight; settling waits for it. */
  isSaving: boolean;
  onCheckAgain: () => void;
  onMoveOn: () => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <Alert
      variant="warning"
      // Stacked, so a long value truncates at the alert's edge.
      layout="stacked"
      title={formatMessage({
        id: "app.garden.settings.hold.title",
        defaultMessage: "We couldn’t confirm your last save.",
      })}
      action={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            onClick={onCheckAgain}
            disabled={isSaving}
            loading={isSettling}
          >
            {formatMessage({
              id: "app.garden.settings.hold.checkAgain",
              defaultMessage: "Check Again",
            })}
          </Button>
          <Button
            type="button"
            emphasis="tertiary"
            size="sm"
            onClick={onMoveOn}
            disabled={isSaving || isSettling}
          >
            {formatMessage({ id: "app.garden.settings.hold.moveOn", defaultMessage: "Move On" })}
          </Button>
        </div>
      }
    >
      <p>
        {formatMessage({
          id: "app.garden.settings.hold.body",
          defaultMessage:
            "It could still land, so these fields stay locked until you check again or move on.",
        })}
      </p>
      <ul className="mt-2 space-y-1">
        {hold.onChain.map((change) => {
          const line = formatMessage(
            { id: "app.garden.settings.hold.onChain", defaultMessage: "{field} on chain: {value}" },
            {
              field: gardenSettingsFieldTitle(change.field, formatMessage),
              value: gardenSettingsValueText(change, formatMessage),
            }
          );
          return (
            <li key={change.field} className="truncate" title={line}>
              {line}
            </li>
          );
        })}
      </ul>
      {hold.onChain.length < hold.fields.length ? (
        <p className="mt-2">
          {formatMessage({
            id: "app.garden.settings.hold.unread",
            defaultMessage: "Some values couldn’t be read just now.",
          })}
        </p>
      ) : null}
    </Alert>
  );
}
