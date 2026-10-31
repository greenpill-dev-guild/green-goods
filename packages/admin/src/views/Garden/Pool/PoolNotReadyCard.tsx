import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCard } from "@/components/AdminCard";

/**
 * The Promises tab before the pool takes commitments: what setting up gives
 * the garden, and the one act that starts it, as the state block. Offline the
 * act waits, and says why beneath it rather than greying out in silence.
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
      className="flex min-h-56 flex-col justify-center"
      data-component="PoolNotReadyCard"
    >
      <EmptyState
        icon={<RiSeedlingLine />}
        title={formatMessage({
          id: "cockpit.garden.pool.notReady.title",
          defaultMessage: "This garden isn’t taking promises yet",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.notReady.body",
          defaultMessage:
            "Neighbors can offer help and ask for it here once you’ve set up how this pool works.",
        })}
        action={
          <div className="flex flex-col items-center gap-3">
            <Button
              type="button"
              emphasis="primary"
              size="sm"
              onClick={onSetUp}
              disabled={!isOnline}
            >
              {formatMessage({
                id: "cockpit.garden.pool.act.setUp",
                defaultMessage: "Set Up Promises",
              })}
            </Button>
            {isOnline ? null : (
              <p className="type-meta text-warning-dark" role="status">
                {formatMessage({
                  id: "cockpit.garden.pool.offline",
                  defaultMessage:
                    "Needs a connection. Pool changes are sent right away, not queued.",
                })}
              </p>
            )}
          </div>
        }
      />
    </AdminCard>
  );
}
