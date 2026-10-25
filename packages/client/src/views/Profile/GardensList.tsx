import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useMyGardens } from "@green-goods/shared/hooks/garden/useMyGardens";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Address } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiArrowRightSLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiMapPinLine,
  RiPlantLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/Cards";
import { cardVariants } from "@/components/Cards/Card";
import { Avatar } from "@/components/Display";

interface GardensListProps {
  primaryAddress: Address | undefined;
}

/**
 * The account's own gardens (`useMyGardens`), each opening its garden. Joining
 * and requesting to join live on the garden itself, so this list offers neither.
 */
export const GardensList: React.FC<GardensListProps> = ({ primaryAddress }) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const setGardenFilters = useUIStore((state) => state.setGardenFilters);
  const { gardens: myGardens, isLoaded, isError, refetch } = useMyGardens(primaryAddress);

  if (!primaryAddress) return null;

  return (
    <>
      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({
          id: "app.profile.gardens",
          defaultMessage: "My gardens",
        })}
      </h5>

      {!isLoaded && !isError ? (
        <Card>
          <EmptyState
            busy
            className="w-full"
            icon={<RiLoader4Line className="animate-spin motion-reduce:animate-none" />}
            title={intl.formatMessage({
              id: "app.profile.loadingGardens",
              defaultMessage: "Loading gardens...",
            })}
          />
        </Card>
      ) : !isLoaded ? (
        <Card>
          <EmptyState
            className="w-full"
            tone="error"
            icon={<RiErrorWarningLine />}
            title={intl.formatMessage({
              id: "app.profile.gardensUnavailable",
              defaultMessage: "Gardens are unavailable right now.",
            })}
            action={
              <Button type="button" emphasis="secondary" onClick={refetch}>
                {intl.formatMessage({
                  id: "app.home.retry",
                  defaultMessage: "Retry",
                })}
              </Button>
            }
          />
        </Card>
      ) : myGardens.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {myGardens.map(({ garden }) => (
            <li key={garden.id}>
              <button
                type="button"
                data-pressable="card"
                onClick={() => navigate(`/home/${garden.id}`)}
                className={cn(cardVariants(), "w-full items-center gap-3 text-left")}
              >
                <Avatar>
                  <div className="flex items-center justify-center text-center mx-auto text-primary-on-surface">
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
          <EmptyState
            className="w-full"
            icon={<RiPlantLine />}
            title={intl.formatMessage({
              id: "app.profile.noGardensTitle",
              defaultMessage: "No gardens yet",
            })}
            description={intl.formatMessage({
              id: "app.profile.noGardensDescription",
              defaultMessage: "Join a garden to start documenting regenerative work",
            })}
            action={
              <Button
                type="button"
                onClick={() => {
                  setGardenFilters((current) => ({ scope: "open", sort: current.sort }));
                  navigate("/home");
                }}
                leadingIcon={<RiPlantLine className="h-4 w-4" aria-hidden="true" />}
              >
                {intl.formatMessage({
                  id: "app.profile.discoverGardens",
                  defaultMessage: "Open Gardens",
                })}
              </Button>
            }
          />
        </Card>
      )}
    </>
  );
};
