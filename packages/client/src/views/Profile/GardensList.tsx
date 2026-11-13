import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import { useGardenDepartureOptions } from "@green-goods/shared/hooks/garden/useLeaveGarden";
import { useGardenMemberHistory } from "@green-goods/shared/hooks/garden/useGardenMemberHistory";
import { useMyGardens } from "@green-goods/shared/hooks/garden/useMyGardens";
import { useExitPresence } from "@green-goods/shared/hooks/utils/useExitPresence";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Address, Garden } from "@green-goods/shared/types/domain";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";
import { RiErrorWarningLine, RiLoader4Line, RiPlantLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/Cards";
import { LeaveGardenAction } from "@/components/Features/Garden/LeaveGardenAction";
import { getPwaSheetExitMs } from "@/components/Pwa/sheetStyles";
import { APP_ROUTES } from "@/config/pwaRouting";
import { GardenMembershipCard } from "./GardenMembershipCard";

interface GardensListProps {
  primaryAddress: Address | undefined;
}

/**
 * The account's own gardens (`useMyGardens`), each opening its garden, with the
 * active garden marked On Home. Only Home's chip switches the active garden, and
 * joining lives on the garden itself. Departure lives here, with its sheet hosted
 * outside the membership rows so confirmed removal cannot unmount an in-flight command.
 */
export const GardensList: React.FC<GardensListProps> = ({ primaryAddress }) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const setGardenFilters = useUIStore((state) => state.setGardenFilters);
  const { gardens: homeGardens, isLoaded, isError, refetch } = useMyGardens(primaryAddress);
  const { gardenId: activeGardenId } = useActiveGarden();
  const history = useGardenMemberHistory({ account: primaryAddress });
  const {
    options: departureOptions,
    isLoading: membershipsLoading,
    isError: membershipsError,
    refetch: refetchMemberships,
  } = useGardenDepartureOptions();
  const [selected, setSelected] = useState<{
    garden: Garden;
    wasActive: boolean;
    account: Address;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [returnHome, setReturnHome] = useState(false);
  const present = useExitPresence(open, getPwaSheetExitMs);

  useEffect(() => {
    if (!selected) return;
    if (!compareAddresses(selected.account, primaryAddress)) {
      setOpen(false);
      setSelected(null);
      setReturnHome(false);
      return;
    }
    if (open || present) return;
    setSelected(null);
    setReturnHome(false);
    if (returnHome) navigate(APP_ROUTES.home, { replace: true, viewTransition: true });
  }, [selected, open, present, returnHome, primaryAddress, navigate]);

  const startDeparture = (garden: Garden) => {
    if (!primaryAddress) return;
    setSelected({
      garden,
      wasActive: compareAddresses(garden.id, activeGardenId),
      account: primaryAddress,
    });
    setReturnHome(false);
    setOpen(true);
  };

  if (!primaryAddress) return null;
  const myGardens = [
    ...homeGardens,
    ...departureOptions.filter(
      ({ garden, membership }) =>
        membership.roles.length > 0 &&
        !homeGardens.some((mine) => compareAddresses(mine.garden.id, garden.id))
    ),
  ];
  const outsideMembership = departureOptions.filter(
    (option) => !myGardens.some(({ garden }) => compareAddresses(garden.id, option.garden.id))
  );
  const departureGroups = [
    {
      title: "app.garden.leave.otherRoles",
      options: outsideMembership.filter(({ roles }) => roles.length > 0),
    },
    {
      title: "app.garden.leave.previousDepartures",
      options: outsideMembership.filter(({ roles }) => roles.length === 0),
    },
  ];

  const unavailable = (
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
          <Button
            type="button"
            emphasis="secondary"
            onClick={() => {
              refetch();
              void refetchMemberships();
            }}
          >
            {intl.formatMessage({
              id: "app.home.retry",
              defaultMessage: "Retry",
            })}
          </Button>
        }
      />
    </Card>
  );

  return (
    <>
      <section className="flex flex-col gap-2">
        <h5 className="text-label-md text-text-strong-950">
          {intl.formatMessage({
            id: "app.profile.gardens",
            defaultMessage: "My gardens",
          })}
        </h5>

        {membershipsError && myGardens.length > 0 ? unavailable : null}
        {myGardens.length === 0 && (membershipsLoading || (!isLoaded && !isError)) ? (
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
        ) : myGardens.length === 0 && (!isLoaded || membershipsError) ? (
          unavailable
        ) : myGardens.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {myGardens.map(({ garden, membership }) => (
              <li key={garden.id}>
                <GardenMembershipCard
                  garden={garden}
                  role={membership.roles[0] ?? (membership.pendingJoin ? "gardener" : undefined)}
                  roles={membership.roles}
                  history={history.members.find((member) =>
                    compareAddresses(member.garden, garden.id)
                  )}
                  historyLoading={history.isLoading}
                  historyError={history.isError}
                  onHome={compareAddresses(garden.id, activeGardenId)}
                  recovering={departureOptions.some(
                    (option) =>
                      compareAddresses(option.garden.id, garden.id) && option.hasPendingDeparture
                  )}
                  onOpen={() => navigate(`/home/${garden.id}`)}
                  onLeave={() => startDeparture(garden)}
                />
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
                    navigate(APP_ROUTES.explore);
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
      </section>
      {departureGroups.map(({ title, options }) => {
        return options.length ? (
          <section key={title} className="flex flex-col gap-2">
            <h5 className="text-label-md text-text-strong-950">
              {intl.formatMessage({
                id: title,
              })}
            </h5>
            <ul className="flex flex-col gap-2">
              {options.map(({ garden, roles, hasPendingDeparture }) => (
                <li key={garden.id}>
                  <GardenMembershipCard
                    garden={garden}
                    role={roles[0]}
                    roles={roles}
                    history={history.members.find((member) =>
                      compareAddresses(member.garden, garden.id)
                    )}
                    historyLoading={history.isLoading}
                    historyError={history.isError}
                    onHome={false}
                    recovering={hasPendingDeparture}
                    onOpen={() => navigate(`/home/${garden.id}`)}
                    onLeave={() => startDeparture(garden)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null;
      })}
      {selected && present && compareAddresses(selected.account, primaryAddress) ? (
        <LeaveGardenAction
          key={selected.garden.id}
          garden={selected.garden}
          open={open}
          onClose={() => setOpen(false)}
          onConfirmed={(departed) => {
            setReturnHome(departed && selected.wasActive);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
};
