import type { GardenSettingsHold } from "@green-goods/shared/hooks/garden/useUpdateGarden";
import { useIntl } from "react-intl";
import { BatchHoldAlert } from "./BatchHoldAlert";
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
    <BatchHoldAlert
      title={formatMessage({
        id: "app.garden.settings.hold.title",
        defaultMessage: "We couldn’t confirm your last save.",
      })}
      body={formatMessage({
        id: "app.garden.settings.hold.body",
        defaultMessage:
          "It could still land, so these fields stay locked until you check again or move on.",
      })}
      hasUnreadValues={hold.onChain.length < hold.fields.length}
      isSettling={isSettling}
      isSaving={isSaving}
      onCheckAgain={onCheckAgain}
      onMoveOn={onMoveOn}
    >
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
    </BatchHoldAlert>
  );
}
