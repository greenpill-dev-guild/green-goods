import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useJoinGarden } from "@green-goods/shared/hooks/garden/useJoinGarden";
import { logger } from "@green-goods/shared/modules/app/logger";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { JoinGardenConfirmDialog } from "./JoinGardenConfirmDialog";

export interface JoinGardenButtonProps {
  gardenId: string;
  gardenName: string;
}

/**
 * The garden page's Join Garden action. It asks the shared join confirmation
 * first, the same one the Profile gardens list uses, then joins and reports the
 * outcome.
 */
export function JoinGardenButton({ gardenId, gardenName }: JoinGardenButtonProps) {
  const intl = useIntl();
  const { joinGarden, isJoining } = useJoinGarden();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const join = async () => {
    try {
      const result = await joinGarden(gardenId);
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
        label={intl.formatMessage({
          id: "app.garden.join",
          defaultMessage: "Join Garden",
        })}
        variant="primary"
        mode="filled"
        size="compact"
        onClick={() => setConfirmOpen(true)}
        disabled={isJoining}
      />
      <JoinGardenConfirmDialog
        isOpen={confirmOpen}
        gardenName={gardenName}
        isJoining={isJoining}
        onClose={() => setConfirmOpen(false)}
        onConfirm={join}
      />
    </>
  );
}
