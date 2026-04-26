import {
  type Address,
  toastService,
  useGreenGoodsEnsName,
  usePrimaryAddress,
  useProtocolMemberStatus,
  useTimeout,
} from "@green-goods/shared";
import { useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { isAddress } from "viem";

const ENS_CLAIM_REMINDER_KEY_PREFIX = "greengoods_ens_claim_reminder_shown";

function getReminderStorageKey(address: Address) {
  return `${ENS_CLAIM_REMINDER_KEY_PREFIX}:${address.toLowerCase()}`;
}

function hasSeenReminder(address: Address) {
  return localStorage.getItem(getReminderStorageKey(address)) === "true";
}

function markReminderSeen(address: Address) {
  localStorage.setItem(getReminderStorageKey(address), "true");
}

export function ENSClaimReminder() {
  const intl = useIntl();
  const navigate = useNavigate();
  const primaryAddress = usePrimaryAddress();
  const normalizedAddress =
    primaryAddress && isAddress(primaryAddress) ? (primaryAddress.toLowerCase() as Address) : null;
  const { data: isProtocolMember = false, isLoading: isProtocolMemberLoading } =
    useProtocolMemberStatus(normalizedAddress ?? undefined);
  const { data: greenGoodsEnsName, isLoading: isGreenGoodsEnsNameLoading } =
    useGreenGoodsEnsName(normalizedAddress);
  const shownInSessionRef = useRef(false);
  const pendingReminderAddressRef = useRef<Address | null>(null);
  const { set: scheduleReminder } = useTimeout();

  useEffect(() => {
    if (!normalizedAddress || shownInSessionRef.current) return;
    if (isProtocolMemberLoading || isGreenGoodsEnsNameLoading) return;
    if (!isProtocolMember || greenGoodsEnsName !== null) return;
    if (hasSeenReminder(normalizedAddress)) {
      shownInSessionRef.current = true;
      return;
    }
    if (pendingReminderAddressRef.current === normalizedAddress) return;
    pendingReminderAddressRef.current = normalizedAddress;

    const cancel = scheduleReminder(() => {
      pendingReminderAddressRef.current = null;
      markReminderSeen(normalizedAddress);
      shownInSessionRef.current = true;
      toastService.info({
        id: "ens-claim-reminder",
        title: intl.formatMessage({
          id: "app.toast.ensClaimReminder.title",
          defaultMessage: "Claim your username",
        }),
        message: intl.formatMessage({
          id: "app.toast.ensClaimReminder.message",
          defaultMessage:
            "You can now claim your Green Goods username. Please choose your greengoods.eth name so people can find you.",
        }),
        duration: 8000,
        action: {
          label: intl.formatMessage({
            id: "app.toast.ensClaimReminder.action",
            defaultMessage: "Claim username",
          }),
          onClick: () => navigate("/profile"),
          dismissOnClick: true,
        },
        suppressLogging: true,
      });
    }, 1000);

    return () => {
      cancel();
      if (pendingReminderAddressRef.current === normalizedAddress) {
        pendingReminderAddressRef.current = null;
      }
    };
  }, [
    greenGoodsEnsName,
    intl,
    isGreenGoodsEnsNameLoading,
    isProtocolMember,
    isProtocolMemberLoading,
    navigate,
    normalizedAddress,
    scheduleReminder,
  ]);

  return null;
}
