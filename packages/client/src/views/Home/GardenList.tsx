import { Button } from "@green-goods/shared/components/Button";
import { GardenCard } from "@green-goods/shared/components/Cards/GardenCard/GardenCard";
import { MediaCardSkeleton } from "@green-goods/shared/components/Cards/MediaCard";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { GardenFilterScope } from "@green-goods/shared/hooks/garden/useFilteredGardens";
import type { Garden } from "@green-goods/shared/types/domain";
import {
  RiFilterOffLine,
  RiPlantLine,
  RiRefreshLine,
  RiTimeLine,
  RiUserLine,
  RiWifiOffLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";

interface GardenListProps {
  gardens: Garden[];
  selectedGardenId?: string;
  onCardClick: (id: string) => void;
  /** The one tag on a card's photo, such as Explore's Member, Awaiting review or Open. */
  tagFor?: (garden: Garden) => string | undefined;
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
  tagFor,
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
      <EmptyState
        tone="warning"
        icon={<RiTimeLine />}
        title={intl.formatMessage({
          id: "app.home.loadingTimeout",
          defaultMessage: "Loading is taking longer than expected",
        })}
        action={
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
        }
      />
    );
  }

  if (showSkeleton) {
    return (
      <div className="flex flex-col gap-(--gg-list-gap)">
        {Array.from({ length: 3 }).map((_, idx) => (
          <MediaCardSkeleton key={`garden-skeleton-${idx}`} mediaShape="banner" />
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
    // Offline is a wait, not a fault, so it keeps the calm mark.
    return (
      <EmptyState
        icon={<RiWifiOffLine />}
        title={intl.formatMessage({
          id: "app.home.offline.error",
          defaultMessage: "Unable to load gardens while offline.",
        })}
      />
    );
  }

  if (scope === "mine" && !hasUserAddress) {
    return (
      <EmptyState
        icon={<RiUserLine />}
        title={intl.formatMessage({
          id: "app.home.filters.scope.mineDisabled",
          defaultMessage: "Sign in to filter by your gardens.",
        })}
      />
    );
  }

  if (!gardens.length) {
    if (scope === "mine" && hasUserAddress) {
      // First-run dead-end fix: give the new user a real next step instead of
      // a bare message. There is no product-defined join flow yet, so the CTA
      // routes to the closest existing surface — the all-gardens list, where
      // open-joining gardens can be joined and others name their stewards.
      return (
        <EmptyState
          icon={<RiPlantLine />}
          title={intl.formatMessage({
            id: "app.home.gardens.mineEmpty",
            defaultMessage: "You don't steward any gardens yet.",
          })}
          description={intl.formatMessage({
            id: "app.home.gardens.mineEmptyHint",
            defaultMessage:
              "Find a garden with open joining, or ask a garden's steward to add you.",
          })}
          action={
            onBrowseAll ? (
              <Button type="button" onClick={onBrowseAll}>
                {intl.formatMessage({
                  id: "app.home.gardens.mineEmptyCta",
                  defaultMessage: "Browse All Gardens",
                })}
              </Button>
            ) : null
          }
        />
      );
    }

    if (isFilterActive) {
      return (
        <EmptyState
          icon={<RiFilterOffLine />}
          title={intl.formatMessage({
            id: "app.home.filters.empty",
            defaultMessage: "No gardens match your filters.",
          })}
        />
      );
    }

    return (
      <EmptyState
        icon={<RiPlantLine />}
        title={intl.formatMessage({
          id: "app.home.messages.noGardensFound",
          description: "No gardens found",
        })}
      />
    );
  }

  // TODO: Virtualize with @tanstack/react-virtual when gardens.length > 50
  return (
    <>
      {gardens.map((garden) => (
        <GardenCard
          key={garden.id}
          garden={garden}
          tag={tagFor?.(garden)}
          // Two title lines reserved, so a long name wraps and every card keeps one height (DL-133).
          titleLines={2}
          className="cv-garden-card"
          selected={garden.id === selectedGardenId}
          onClick={() => onCardClick(garden.id)}
        />
      ))}
    </>
  );
}
