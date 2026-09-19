import { Alert } from "@green-goods/shared/components/Alert";
import { useGardenYieldWiringState } from "@green-goods/shared/hooks/yield/useGardenYieldWiringState";
import type { Address } from "@green-goods/shared/types/domain";
import { RiCheckLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

export function CommunityYieldStatus({
  gardenId,
  enabled,
}: {
  gardenId: Address;
  enabled: boolean;
}) {
  const { formatMessage } = useIntl();
  const { wiringState, wiringStatus, repairHref } = useGardenYieldWiringState(gardenId, {
    enabled,
  });
  const canShowReconnectLink =
    Boolean(wiringState?.expectedHypercertPoolAddress) && Boolean(repairHref);
  if (!enabled) return null;
  return (
    <>
      {wiringStatus === "missing-resolver-wiring" || wiringStatus === "mismatch" ? (
        <Alert
          variant="warning"
          className="p-3"
          action={
            canShowReconnectLink && repairHref ? (
              <Link to={repairHref} className="font-medium underline-offset-2 hover:underline">
                {formatMessage({ id: "app.community.yield.connectAction" })}
              </Link>
            ) : undefined
          }
        >
          {wiringStatus === "mismatch"
            ? formatMessage({ id: "app.community.yield.mismatch" })
            : formatMessage({ id: "app.community.yield.notConnected" })}
        </Alert>
      ) : null}
      {wiringStatus === "connected" ? (
        <p className="inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-md)] bg-success-lighter px-3 text-xs text-success-dark">
          <RiCheckLine className="h-4 w-4 shrink-0" aria-hidden="true" />
          {formatMessage({ id: "app.community.yield.connected" })}
        </p>
      ) : null}
    </>
  );
}
