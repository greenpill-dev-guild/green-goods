import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import { useEffect } from "react";
import { useIntl } from "react-intl";

export interface AddedGardensToastProps {
  /** Home is the page on screen, not one it holds open under another. */
  home: boolean;
  /** Make one garden the active one, as the switcher's pick does. */
  onSwitch: (gardenId: string) => void;
  /** Open the switcher, Your Gardens, to choose among several. */
  onChoose: () => void;
}

/**
 * Says that the member was added to a garden since this device last read their gardens
 * (PRD-1492): a steward added them, or welcomed their request. The toast stays until it is acted
 * on, and only an answer marks the gardens told, so news a reload or a closed app cut short shows
 * again on the next launch. Switch opens Home in that garden; with several, See Your Gardens
 * opens the switcher; closing the toast keeps Home where it is. Being added moves nothing by
 * itself. The first-login page lists every garden of the member's, so there it says nothing more.
 * Renders nothing.
 */
export function AddedGardensToast({ home, onSwitch, onChoose }: AddedGardensToastProps) {
  const intl = useIntl();
  const { status, addedGardens, acknowledgeAddedGardens } = useActiveGarden();

  useEffect(() => {
    if (!home || addedGardens.length === 0) return;
    if (status !== "ready" && status !== "choose") return;
    const gardenIds = addedGardens.map(({ id }) => id);
    const told = () => acknowledgeAddedGardens(gardenIds);
    if (status === "choose") {
      told();
      return;
    }
    const single = addedGardens.length === 1 ? addedGardens[0] : undefined;
    toastService.info({
      id: "garden-added",
      title: single
        ? intl.formatMessage({ id: "app.home.added.title" }, { garden: single.name })
        : intl.formatMessage({ id: "app.home.added.titleMany" }, { count: addedGardens.length }),
      message: intl.formatMessage({
        id: single ? "app.home.added.message" : "app.home.added.messageMany",
      }),
      persistent: true,
      action: {
        label: intl.formatMessage({
          id: single ? "app.home.added.action" : "app.home.chooser.action",
        }),
        onClick: () => {
          told();
          if (single) onSwitch(single.id);
          else onChoose();
        },
        dismissOnClick: true,
      },
      // The action closes the toast without this; the close button and a tap call it.
      onDismiss: told,
      suppressLogging: true,
    });
  }, [acknowledgeAddedGardens, addedGardens, home, intl, onChoose, onSwitch, status]);

  return null;
}
