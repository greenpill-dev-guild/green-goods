import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { useGardenYieldWiringState } from "@green-goods/shared/hooks/yield/useGardenYieldWiringState";
import type { Address } from "@green-goods/shared/types/domain";
import { RiCheckLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

export function CommunityYieldStatus({
  gardenId,
  enabled,
  onRereadPools,
}: {
  gardenId: Address;
  enabled: boolean;
  /** Set when the pool list is unread and no other surface offers to read it again. */
  onRereadPools?: () => void;
}) {
  const { formatMessage } = useIntl();
  const { wiringState, wiringStatus, repairHref, refetch, isPending } = useGardenYieldWiringState(
    gardenId,
    { enabled }
  );
  const canShowReconnectLink =
    Boolean(wiringState?.expectedHypercertPoolAddress) && Boolean(repairHref);
  // An unread pool list matters here only while the wiring check has no answer either: once it
  // answers, the rail shows that answer, and an error above it would contradict it. Only the first
  // read hides the error; a Retry keeps it, and the focused button, in place while it reads.
  const wiringUnanswered = !enabled || (wiringStatus === undefined && !isPending);
  const poolReadError =
    onRereadPools && wiringUnanswered ? (
      <Alert
        variant="error"
        className="p-3"
        title={formatMessage({ id: "hub.community.yield.readError.title" })}
        action={
          <Button
            type="button"
            emphasis="secondary"
            size="compact"
            onClick={() => {
              onRereadPools();
              // The wiring check reads separately and keeps a failed answer until asked again. Without
              // a community it is switched off, so there is nothing of its to read again.
              if (enabled) void refetch();
            }}
          >
            {formatMessage({ id: "app.common.retry" })}
          </Button>
        }
      >
        {formatMessage({ id: "hub.community.yield.readError.description" })}
      </Alert>
    ) : null;
  if (!enabled) return poolReadError;
  return (
    <>
      {poolReadError}
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
        <p className="inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-md)] bg-success-lighter px-3 type-meta text-success-dark">
          <RiCheckLine className="h-4 w-4 shrink-0" aria-hidden="true" />
          {formatMessage({ id: "app.community.yield.connected" })}
        </p>
      ) : null}
    </>
  );
}
