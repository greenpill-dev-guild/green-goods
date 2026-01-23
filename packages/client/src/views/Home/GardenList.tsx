import type { Garden, GardenFilterScope } from "@green-goods/shared";
import { RiRefreshLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { GardenCard, GardenCardSkeleton } from "@/components/Cards";

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
            defaultMessage: "Unable to load gardens. The server may be slow or unavailable.",
          })}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        >
          <RiRefreshLine className="w-4 h-4" />
          {intl.formatMessage({
            id: "app.home.retry",
            defaultMessage: "Retry",
          })}
        </button>
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
          defaultMessage: "Sign in or connect a wallet to filter by your gardens.",
        })}
      </p>
    );
  }

  if (!gardens.length) {
    if (scope === "mine" && hasUserAddress) {
      return (
        <p className="grid place-items-center text-center text-sm italic text-text-sub-600">
          {intl.formatMessage({
            id: "app.home.gardens.mineEmpty",
            defaultMessage: "You don't steward any gardens yet.",
          })}
        </p>
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

  return (
    <>
      {gardens.map((garden) => (
        <GardenCard
          key={garden.id}
          garden={garden}
          media="large"
          height="home"
          showOperators={true}
          selected={garden.id === selectedGardenId}
          {...garden}
          onClick={() => onCardClick(garden.id)}
        />
      ))}
    </>
  );
}
