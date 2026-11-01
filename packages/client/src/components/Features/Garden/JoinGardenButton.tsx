import { Button } from "@green-goods/shared/components/Button";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useJoinGarden } from "@green-goods/shared/hooks/garden/useJoinGarden";
import { logger } from "@green-goods/shared/modules/app/logger";
import { lazy, Suspense, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "@/config/pwaRouting";

// The confirmation, and the dialog primitives with it, load with the first press: Home and the
// garden page draw the button long before anyone asks to join.
const JoinGardenConfirmDialog = lazy(() =>
  import("./JoinGardenConfirmDialog").then(({ JoinGardenConfirmDialog }) => ({
    default: JoinGardenConfirmDialog,
  }))
);

export interface JoinGardenButtonProps {
  gardenId: string;
  gardenName: string;
}

/**
 * The garden page's Join Garden action. It asks the shared join confirmation
 * first, then joins, reports the outcome and opens Home in the garden, which the
 * join has made the active one (DL-147). The visit is over, so Back does not
 * return to its page.
 */
export function JoinGardenButton({ gardenId, gardenName }: JoinGardenButtonProps) {
  const intl = useIntl();
  const navigate = useNavigate();
  const { joinGarden, isJoining } = useJoinGarden();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Mounted from the first press on, so every later opening and closing plays as before.
  const [confirmRequested, setConfirmRequested] = useState(false);

  const join = async () => {
    try {
      const result = await joinGarden(gardenId);
      if (result === "already-joining") return;
      if (result === "already-member") {
        toastService.success({
          title: intl.formatMessage({
            id: "app.garden.alreadyMember",
            defaultMessage: "You are already a member of this garden",
          }),
        });
      } else {
        toastService.success({
          title: intl.formatMessage({
            id: "app.garden.joinSuccess",
            defaultMessage: "Successfully joined garden",
          }),
        });
      }
      navigate(APP_ROUTES.home, { replace: true, viewTransition: true });
    } catch (error) {
      logger.error("Failed to join garden", { error, gardenId });
      toastService.error({
        title: intl.formatMessage({
          id: "app.garden.joinError",
          defaultMessage: "Failed to join garden",
        }),
      });
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="compact"
        onClick={() => {
          setConfirmRequested(true);
          setConfirmOpen(true);
        }}
        loading={isJoining}
      >
        {intl.formatMessage({
          id: "app.garden.join",
          defaultMessage: "Join Garden",
        })}
      </Button>
      {confirmRequested ? (
        <Suspense fallback={null}>
          <JoinGardenConfirmDialog
            isOpen={confirmOpen}
            gardenName={gardenName}
            isJoining={isJoining}
            onClose={() => setConfirmOpen(false)}
            onConfirm={join}
          />
        </Suspense>
      ) : null}
    </>
  );
}
