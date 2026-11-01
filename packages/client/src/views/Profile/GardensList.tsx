import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import { useMyGardens } from "@green-goods/shared/hooks/garden/useMyGardens";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Address } from "@green-goods/shared/types/domain";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";
import {
  RiArrowRightSLine,
  RiErrorWarningLine,
  RiHomeLine,
  RiLoader4Line,
  RiMapPinLine,
  RiPlantLine,
} from "@remixicon/react";
import { useId } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/Cards";
import { SettingTitle } from "./SettingTitle";

interface GardensListProps {
  primaryAddress: Address | undefined;
}

interface GardenRowProps {
  name: string;
  location?: string;
  /** This is the active garden, marked On Home. */
  onHome: boolean;
  onOpen: () => void;
}

/**
 * One garden in the list's divided rows (DL-152). The row's one button, in the right slot, reaches
 * across the row, so the whole row still opens the garden and the list stays a description list:
 * the row presses into the surface with it, and the button's reach draws its focus ring.
 */
function GardenRow({ name, location, onHome, onOpen }: GardenRowProps) {
  const intl = useIntl();
  const detailId = useId();

  return (
    <FactRow
      className="relative transition-[scale] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] motion-safe:has-[[data-pressable]:active]:scale-[0.985]"
      icon={<RiPlantLine className="w-4" />}
      label={<SettingTitle>{name}</SettingTitle>}
      // The active garden's mark shares the place's line under the name, so the name keeps the
      // row's width, and the line stays when it is empty, so every row keeps one height.
      description={
        <span id={detailId} className="flex min-h-[1lh] min-w-0 items-center gap-1">
          {onHome && (
            <span className="mr-2 flex shrink-0 items-center gap-1 font-medium text-text-strong-950">
              <RiHomeLine className="h-3 w-3 shrink-0" aria-hidden="true" />
              {intl.formatMessage({
                id: "app.profile.gardensOnHome",
                defaultMessage: "On Home",
              })}
            </span>
          )}
          {location && (
            <>
              <RiMapPinLine className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate" title={location}>
                {location}
              </span>
            </>
          )}
        </span>
      }
      action={
        <button
          type="button"
          data-pressable="row"
          // The reach lies over the name, so the button carries its hover text, and its name.
          title={name}
          aria-describedby={onHome || location ? detailId : undefined}
          onClick={onOpen}
          // The row takes the press. A scale on the button would shrink its reach back to the
          // chevron under a finger still down, and the release would land off it, on the name.
          className="flex outline-none active:[scale:none] after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-[rgb(var(--gg-focus-ring))]"
        >
          <RiArrowRightSLine className="h-5 w-5 shrink-0 text-text-soft-400" aria-hidden="true" />
        </button>
      }
    />
  );
}

/**
 * The account's own gardens (`useMyGardens`), each opening its garden, with the
 * active garden marked On Home. Only Home's chip switches the active garden, and
 * joining and requesting to join live on the garden itself, so this list offers
 * none of them.
 */
export const GardensList: React.FC<GardensListProps> = ({ primaryAddress }) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const setGardenFilters = useUIStore((state) => state.setGardenFilters);
  const { gardens: myGardens, isLoaded, isError, refetch } = useMyGardens(primaryAddress);
  const { gardenId: activeGardenId } = useActiveGarden();

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
        <FactList>
          {myGardens.map(({ garden }) => (
            <GardenRow
              key={garden.id}
              name={garden.name}
              location={garden.location}
              onHome={compareAddresses(garden.id, activeGardenId)}
              onOpen={() => navigate(`/home/${garden.id}`)}
            />
          ))}
        </FactList>
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
