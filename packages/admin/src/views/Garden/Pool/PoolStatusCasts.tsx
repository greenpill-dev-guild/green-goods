import type { PoolConsoleController } from "@green-goods/shared";
import { RiRefreshLine, RiWifiOffLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";

function SkeletonRail() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-24 rounded-[var(--m3-shape-md)] skeleton-shimmer" />
      <div className="h-40 rounded-[var(--m3-shape-md)] skeleton-shimmer" />
    </div>
  );
}

/**
 * The pool console before it has a console to show: loading, a read error, a
 * chain that does not serve pooling yet, and a garden with no pool registered.
 * Returns null once the console itself should render. Split out of `index.tsx`,
 * which is at its source-structure cap.
 */
export function PoolStatusCasts({
  pool,
  canManage,
}: {
  pool: PoolConsoleController;
  canManage: boolean;
}) {
  const { formatMessage } = useIntl();

  // The console is the steward's surface (uiux-spec §6.2), and the Garden rail
  // only offers the tab to one. A direct link is the other way in, so the
  // permission is checked here too rather than on each card: pause, close,
  // cancel, accept and decline would otherwise invite a member to sign a call
  // the contract refuses.
  if (!canManage) {
    return (
      <AdminCard variant="elevated" data-component="GardenPoolTab" className="space-y-2">
        <p className="label-md text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.stewardOnly.title",
            defaultMessage: "The pool console is for this garden's stewards",
          })}
        </p>
        <p className="text-sm text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.stewardOnly.body",
            defaultMessage:
              "Members read this garden's pool in the Green Goods app. Ask a steward if something here needs changing.",
          })}
        </p>
      </AdminCard>
    );
  }

  if (pool.isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"
        role="status"
        aria-label={formatMessage({
          id: "cockpit.garden.pool.loading",
          defaultMessage: "Loading the pool",
        })}
        data-component="GardenPoolTab"
      >
        <div className="space-y-3" aria-hidden>
          <div className="h-16 rounded-[var(--m3-shape-md)] skeleton-shimmer" />
          <div className="h-40 rounded-[var(--m3-shape-md)] skeleton-shimmer" />
          <div className="h-56 rounded-[var(--m3-shape-md)] skeleton-shimmer" />
        </div>
        <SkeletonRail />
      </div>
    );
  }

  if (pool.isError) {
    return (
      <AdminCard
        variant="elevated"
        data-component="GardenPoolTab"
        className="flex min-h-56 flex-col items-center justify-center gap-3 text-center"
      >
        <RiWifiOffLine className="h-6 w-6 text-text-soft" aria-hidden />
        <p className="label-md text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.readError.title",
            defaultMessage: "Couldn’t load this pool",
          })}
        </p>
        <p className="max-w-md text-sm text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.readError.body",
            defaultMessage:
              "Something went wrong reaching the indexer. Nothing about the pool, its seasons, or its commitments has changed.",
          })}
        </p>
        <AdminButton
          type="button"
          variant="filled"
          leadingIcon={<RiRefreshLine className="h-4 w-4" />}
          onClick={() => void pool.refetch()}
        >
          {formatMessage({
            id: "cockpit.garden.pool.readError.retry",
            defaultMessage: "Try again",
          })}
        </AdminButton>
      </AdminCard>
    );
  }

  // A chain that does not serve pooling yet has nothing to show; data that is
  // already here (a cache, a fixture) renders regardless of the ledger.
  if (pool.availability.status !== "available" && pool.pool === null) {
    return (
      <AdminCard variant="elevated" data-component="GardenPoolTab" className="space-y-2">
        <p className="label-md text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.unavailable.title",
            defaultMessage: "Commitment pooling is not on this chain yet",
          })}
        </p>
        <p className="text-sm text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.unavailable.body",
            defaultMessage:
              "The pool console switches on with the release that serves pooling here.",
          })}
        </p>
      </AdminCard>
    );
  }

  if (pool.model.status === "unregistered") {
    return (
      <AdminCard variant="elevated" data-component="GardenPoolTab" className="space-y-2">
        <p className="label-md text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.unregistered.title",
            defaultMessage: "This garden has no commitment pool",
          })}
        </p>
        <p className="text-sm text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.unregistered.body",
            defaultMessage:
              "A pool is registered for a garden by the Green Goods team. Once it is, setting it up happens here.",
          })}
        </p>
      </AdminCard>
    );
  }

  return null;
}
