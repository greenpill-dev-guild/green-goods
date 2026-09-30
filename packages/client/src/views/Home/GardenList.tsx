import { Button } from "@green-goods/shared/components/Button";
import type { GardenFilterScope } from "@green-goods/shared/hooks/garden/useFilteredGardens";
import type { Garden } from "@green-goods/shared/types/domain";
import { RiRefreshLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { GardenCard } from "@/components/Cards/Garden/GardenCard";
import { GardenCardSkeleton } from "@/components/Cards/Garden/GardenCardSkeleton";

interface GardenListProps {
  gardens: Garden[];
  selectedGardenId?: string;
  onCardClick: (id: string) => void;
  // Loading states
  showSkeleton: boolean;
  timedOut: boolean;
  isError: boolean;
  isOnline: boolean;
  onRetry: () => void;
  // Filter context
  scope: GardenFilterScope;
  isFilterActive: boolean;
  hasUserAddress: boolean;
  /** First-run path: switch the list to every garden so a new user can find one to join. */
  onBrowseAll?: () => void;
}

export function GardenList({
  gardens,
  selectedGardenId,
  onCardClick,
  showSkeleton,
  timedOut,
  isError,
  isOnline,
  onRetry,
  scope,
  isFilterActive,
  hasUserAddress,
  onBrowseAll,
}: GardenListProps) {
  const intl = useIntl();
  const hasCachedData = gardens.length > 0 || (!showSkeleton && !timedOut && !isError);

  // Handle timeout or error state (online but no data after max wait)
  if ((timedOut || isError) && !hasCachedData && isOnline) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-4">
        <p className="text-text-sub-600">
          {intl.formatMessage({
            id: "app.home.loadingTimeout",
            defaultMessage: "Loading is taking longer than expected",
          })}
        </p>
        <Button
          type="button"
          onClick={onRetry}
          leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
        >
          {intl.formatMessage({
            id: "app.home.retry",
            defaultMessage: "Retry",
          })}
        </Button>
      </div>
    );
  }

  if (showSkeleton) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <GardenCardSkeleton key={idx} media="large" height="home" />
        ))}
        {!isOnline && (
          <p className="text-center text-sm text-text-sub-600 mt-4 px-4">
            {intl.formatMessage({
              id: "app.home.offline.loading",
              defaultMessage: "You're offline. Gardens will appear when you reconnect.",
            })}
          </p>
        )}
      </div>
    );
  }

  if ((isError || timedOut) && !hasCachedData && !isOnline) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-text-sub-600">
          {intl.formatMessage({
            id: "app.home.offline.error",
            defaultMessage: "Unable to load gardens while offline.",
          })}
        </p>
      </div>
    );
  }

  if (scope === "mine" && !hasUserAddress) {
    return (
      <p className="grid place-items-center text-center text-sm italic text-text-sub-600">
        {intl.formatMessage({
          id: "app.home.filters.scope.mineDisabled",
          defaultMessage: "Sign in to filter by your gardens.",
        })}
      </p>
    );
  }

  if (!gardens.length) {
    if (scope === "mine" && hasUserAddress) {
      // First-run dead-end fix: give the new user a real next step instead of
      // a bare message. There is no product-defined join flow yet, so the CTA
      // routes to the closest existing surface — the all-gardens list, where
      // open-joining gardens can be joined and others name their stewards.
      return (
        <div className="grid place-items-center gap-3 py-6 text-center">
          <p className="text-sm italic text-text-sub-600">
            {intl.formatMessage({
              id: "app.home.gardens.mineEmpty",
              defaultMessage: "You don't steward any gardens yet.",
            })}
          </p>
          <p className="max-w-xs text-xs text-text-soft-400">
            {intl.formatMessage({
              id: "app.home.gardens.mineEmptyHint",
              defaultMessage:
                "Find a garden with open joining, or ask a garden's steward to add you.",
            })}
          </p>
          {onBrowseAll ? (
            <Button type="button" onClick={onBrowseAll}>
              {intl.formatMessage({
                id: "app.home.gardens.mineEmptyCta",
                defaultMessage: "Browse All Gardens",
              })}
            </Button>
          ) : null}
        </div>
      );
    }

    if (isFilterActive) {
      return (
        <p className="grid place-items-center text-center text-sm italic text-text-sub-600">
          {intl.formatMessage({
            id: "app.home.filters.empty",
            defaultMessage: "No gardens match your filters.",
          })}
        </p>
      );
    }

    return (
      <p className="grid place-items-center text-sm italic">
        {intl.formatMessage({
          id: "app.home.messages.noGardensFound",
          description: "No gardens found",
        })}
      </p>
    );
  }

  // TODO: Virtualize with @tanstack/react-virtual when gardens.length > 50
  return (
    <>
      {gardens.map((garden) => (
        <GardenCard
          key={garden.id}
          garden={garden}
          className="cv-garden-card"
          media="large"
          height="home"
          showStewards={true}
          selected={garden.id === selectedGardenId}
          onClick={() => onCardClick(garden.id)}
        />
      ))}
    </>
  );
}
