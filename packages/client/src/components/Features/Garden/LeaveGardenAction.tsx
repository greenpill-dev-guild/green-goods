// Profile owns the trigger and retains this flow while membership removes its card.

import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useLeaveGarden } from "@green-goods/shared/hooks/garden/useLeaveGarden";
import { useGardenMembership } from "@green-goods/shared/hooks/roles/useGardenMembership";
import { useHasRole } from "@green-goods/shared/hooks/roles/useHasRole";
import type { Address, Garden } from "@green-goods/shared/types/domain";
import { parseContractError } from "@green-goods/shared/utils/errors/contract-errors";
import { isCancelledTxError } from "@green-goods/shared/utils/errors/tx-error-classifier";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { LeaveGardenConfirmDialog } from "./LeaveGardenConfirmDialog";

interface LeaveGardenActionProps {
  garden: Garden;
  open: boolean;
  onClose: () => void;
  /** A recovered old receipt may preserve a later rejoin. */
  onConfirmed: (departed: boolean) => void;
}

export function LeaveGardenAction({ garden, open, onClose, onConfirmed }: LeaveGardenActionProps) {
  const { formatMessage: message } = useIntl();
  const { primaryAddress } = useUser();
  const address = garden.id as Address;
  const {
    isMember,
    isError: membershipFailed,
    refetch,
  } = useGardenMembership(address, primaryAddress as Address);
  const owner = useHasRole(address, primaryAddress as Address, "owner");
  const {
    leaveGarden,
    isLeaving,
    availability,
    checkAvailability,
    hasPendingDeparture,
    reconcileDeparture,
  } = useLeaveGarden(address);
  const [recovering, setRecovering] = useState(false);
  const sending = useRef(false);
  const opened = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    if (!open) {
      opened.current = false;
      return;
    }
    if (opened.current) return;
    opened.current = true;
    setFailure(null);
    setRecovering(hasPendingDeparture);
    void owner.refetch();
    void refetch();
    if (!hasPendingDeparture) void checkAvailability();
  }, [open, hasPendingDeparture, owner.refetch, refetch, checkAvailability]);
  useEffect(() => {
    if (open && hasPendingDeparture && !isLeaving && !recovering) {
      setRecovering(true);
      setFailure(null);
    }
  }, [open, hasPendingDeparture, isLeaving, recovering]);
  if (!primaryAddress) return null;
  const isOwner = owner.hasRole;
  const checking = owner.isLoading || owner.error || membershipFailed || isMember === null;
  const confirm = async () => {
    if (sending.current || (!recovering && (checking || isOwner || availability !== "available")))
      return;
    sending.current = true;
    setFailure(null);
    try {
      const recovery = recovering;
      const result = await (recovery ? reconcileDeparture() : leaveGarden());
      toastService.success({
        title: message({
          id:
            recovery || !result.departed
              ? "app.garden.leave.recoverySuccess"
              : "app.garden.leave.success",
        }),
      });
      onConfirmed(result.departed);
    } catch (error) {
      if (!isCancelledTxError(error)) {
        const parsed = parseContractError(error);
        const text = message({
          id: recovering
            ? "app.garden.leave.recoveryFailed"
            : parsed.name === "OwnerCannotLeave"
              ? "app.garden.leave.owner"
              : "app.garden.leave.failed",
        });
        setFailure(text);
        toastService.error({ title: text });
      }
    } finally {
      sending.current = false;
    }
  };
  return (
    <LeaveGardenConfirmDialog
      open={open}
      onClose={() => {
        if (!isLeaving) onClose();
      }}
      gardenName={garden.name}
      isOwner={isOwner}
      checking={Boolean(checking)}
      availability={availability}
      recovery={recovering}
      isLeaving={isLeaving}
      failure={failure}
      onConfirm={confirm}
      onRetry={() => {
        void owner.refetch();
        refetch();
        void checkAvailability();
      }}
      checkFailed={Boolean(
        owner.error ||
          membershipFailed ||
          availability === "unavailable" ||
          availability === "unknown"
      )}
    />
  );
}
