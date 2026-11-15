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
 * Says once that the member was added to a garden since this device last read their gardens
 * (PRD-1492): a steward added them, or welcomed their request. The toast stays until it is acted
 * on. Switch opens Home in that garden; with several, See Your Gardens opens the switcher. Being
 * added moves nothing by itself, so Home stays in the garden it shows until the member chooses.
 * The first-login page lists every garden of the member's, so there it says nothing more.
 * Renders nothing.
 */
export function AddedGardensToast({ home, onSwitch, onChoose }: AddedGardensToastProps) {
  const intl = useIntl();
  const { status, addedGardens, acknowledgeAddedGardens } = useActiveGarden();

  useEffect(() => {
    if (!home || addedGardens.length === 0) return;
    if (status !== "ready" && status !== "choose") return;
    acknowledgeAddedGardens(addedGardens.map(({ id }) => id));
    if (status === "choose") return;
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
        onClick: single ? () => onSwitch(single.id) : onChoose,
        dismissOnClick: true,
      },
      suppressLogging: true,
    });
  }, [acknowledgeAddedGardens, addedGardens, home, intl, onChoose, onSwitch, status]);

  return null;
}
