import { ActionPicker } from "@green-goods/shared/components/Cards/ActionPicker";
import type { Action } from "@green-goods/shared/types/domain";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { localizeActionForDisplay } from "@/components/Action/actionDisplay";

export interface ActionChooserGridProps {
  actions: Action[];
  /** Currently selected action id (`""` when nothing is chosen). */
  selectedActionId: string;
  onSelect: (actionId: string) => void;
  disabled?: boolean;
  /** Accessible name for the listbox (e.g. "Action"). */
  groupLabel: string;
}

/**
 * ActionChooserGrid — the Choose step of Submit Work: the shared action picker, the one the
 * installed app uses, laid out as a grid, with each canonical action titled in the cockpit's
 * own words. One listbox with one tab stop: the arrow keys and Home and End move, and
 * Space, Enter or a press chooses, because choosing resets the work's details.
 */
export function ActionChooserGrid({
  actions,
  selectedActionId,
  onSelect,
  disabled = false,
  groupLabel,
}: ActionChooserGridProps) {
  const intl = useIntl();
  const displayActions = useMemo(
    () => actions.map((action) => localizeActionForDisplay(action, intl)),
    [actions, intl]
  );

  return (
    <ActionPicker
      actions={displayActions}
      value={selectedActionId || null}
      onChange={onSelect}
      label={groupLabel}
      layout="grid"
      disabled={disabled}
    />
  );
}

ActionChooserGrid.displayName = "ActionChooserGrid";
