import { RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";

/**
 * The pool tab before the pool takes commitments: what setting up gives the
 * garden, and the one act that starts it. Offline the act waits, and says why
 * beneath it rather than greying out in silence.
 */
export function PoolNotReadyCard({
  isOnline,
  onSetUp,
}: {
  isOnline: boolean;
  onSetUp: () => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <AdminCard
      variant="elevated"
      className="flex min-h-56 flex-col items-center justify-center gap-3 text-center"
      data-component="PoolNotReadyCard"
    >
      <RiSeedlingLine className="h-6 w-6 text-text-soft" aria-hidden />
      <AdminCardTitle>
        {formatMessage({
          id: "cockpit.garden.pool.notReady.title",
          defaultMessage: "This garden isn’t taking commitments yet",
        })}
      </AdminCardTitle>
      <p className="max-w-md text-sm text-text-soft">
        {formatMessage({
          id: "cockpit.garden.pool.notReady.body",
          defaultMessage:
            "Neighbours can offer help and ask for it here once you’ve set up how this pool works.",
        })}
      </p>
      <AdminButton type="button" variant="filled" onClick={onSetUp} disabled={!isOnline}>
        {formatMessage({
          id: "cockpit.garden.pool.act.setUp",
          defaultMessage: "Set Up Commitments",
        })}
      </AdminButton>
      {isOnline ? null : (
        <p className="text-xs text-warning-dark" role="status">
          {formatMessage({
            id: "cockpit.garden.pool.offline",
            defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
          })}
        </p>
      )}
    </AdminCard>
  );
}
