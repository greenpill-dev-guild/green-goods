import { Button } from "@green-goods/shared/components/Button";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import {
  isGardenMember,
  usePendingJoinsVersion,
} from "@green-goods/shared/hooks/garden/useJoinGarden";
import type { Address } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiArrowRightSLine, RiMapPinLine, RiPlantLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/Cards";
import { cardVariants } from "@/components/Cards/Card";
import { Avatar } from "@/components/Display";

interface GardensListProps {
  primaryAddress: Address | undefined;
}

/**
 * The gardens this account belongs to, each opening its garden. Joining and
 * requesting to join live on the garden itself, so this list offers neither.
 */
export const GardensList: React.FC<GardensListProps> = ({ primaryAddress }) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const {
    data: gardens = [],
    isError: gardensError,
    isLoading: gardensLoading,
    refetch: refetchGardens,
  } = useGardens();
  const pendingJoinsVersion = usePendingJoinsVersion();

  const myGardens = useMemo(() => {
    if (!primaryAddress) return [];
    return gardens.filter((garden) =>
      isGardenMember(primaryAddress, garden.gardeners, garden.stewards, garden.id)
    );
    // pendingJoinsVersion retriggers when a join made on a garden confirms or
    // expires in-tab, so that garden appears here without an unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version counter is a deliberate cache-buster, not a read dependency
  }, [gardens, primaryAddress, pendingJoinsVersion]);

  if (!primaryAddress) return null;

  return (
    <>
      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({
          id: "app.profile.gardens",
          defaultMessage: "My gardens",
        })}
      </h5>

      {gardensLoading ? (
        <Card>
          <div className="flex flex-row items-center justify-center w-full py-2">
            <span className="text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "app.profile.loadingGardens",
                defaultMessage: "Loading gardens...",
              })}
            </span>
          </div>
        </Card>
      ) : gardensError && gardens.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 w-full py-4">
            <RiPlantLine className="w-8 h-8 text-text-soft-400" />
            <p className="text-center text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "app.profile.gardensUnavailable",
                defaultMessage: "Gardens are unavailable right now.",
              })}
            </p>
            <Button type="button" emphasis="secondary" onClick={() => void refetchGardens()}>
              {intl.formatMessage({
                id: "app.home.retry",
                defaultMessage: "Retry",
              })}
            </Button>
          </div>
        </Card>
      ) : myGardens.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {myGardens.map((garden) => (
            <li key={garden.id}>
              <button
                type="button"
                data-pressable="card"
                onClick={() => navigate(`/home/${garden.id}`)}
                className={cn(cardVariants(), "w-full items-center gap-3 text-left")}
              >
                <Avatar>
                  <div className="flex items-center justify-center text-center mx-auto text-primary">
                    <RiPlantLine className="w-4" />
                  </div>
                </Avatar>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1 overflow-hidden">
                  <div
                    className="line-clamp-2 min-w-0 max-w-full text-sm font-medium leading-snug [overflow-wrap:anywhere]"
                    title={garden.name}
                  >
                    {garden.name}
                  </div>
                  {garden.location && (
                    <div className="flex min-w-0 max-w-full items-center gap-1 text-xs text-text-sub-600">
                      <RiMapPinLine className="w-3 h-3 shrink-0" />
                      <span className="min-w-0 truncate" title={garden.location}>
                        {garden.location}
                      </span>
                    </div>
                  )}
                </div>
                <RiArrowRightSLine
                  className="h-5 w-5 shrink-0 text-text-soft-400"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-3 w-full py-4">
            <RiPlantLine className="w-8 h-8 text-text-soft-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-text-strong-950">
                {intl.formatMessage({
                  id: "app.profile.noGardensTitle",
                  defaultMessage: "No gardens yet",
                })}
              </p>
              <p className="text-xs text-text-sub-600 mt-1">
                {intl.formatMessage({
                  id: "app.profile.noGardensDescription",
                  defaultMessage: "Join a garden to start documenting regenerative work",
                })}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => navigate("/home")}
              leadingIcon={<RiPlantLine className="h-4 w-4" aria-hidden="true" />}
            >
              {intl.formatMessage({
                id: "app.profile.discoverGardens",
                defaultMessage: "Open Gardens",
              })}
            </Button>
          </div>
        </Card>
      )}
    </>
  );
};
