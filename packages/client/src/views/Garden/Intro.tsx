import {
  type Action,
  type Address,
  Domain,
  expandDomainMask,
  type Garden,
  hapticSelection,
  hasDomain,
} from "@green-goods/shared";
import { RiHammerFill, RiPlantFill } from "@remixicon/react";
import React, { useMemo } from "react";
import { useIntl } from "react-intl";
import {
  ActionCard,
  ActionCardSkeleton,
  FormInfo,
  GardenCard,
  GardenCardSkeleton,
} from "@/components/Cards";
import { Carousel, CarouselContent, CarouselItem } from "@/components/Display";
import { type StandardTab, StandardTabs } from "@/components/Navigation";

/** Domain icon + i18n label ID (stable); labels resolved via intl at render time */
const DOMAIN_TAB_CONFIG: Record<Domain, { labelId: string; defaultLabel: string; icon: string }> = {
  [Domain.SOLAR]: { labelId: "app.domain.tab.solar", defaultLabel: "Solar", icon: "ri-sun-line" },
  [Domain.AGRO]: { labelId: "app.domain.tab.agro", defaultLabel: "Agro", icon: "ri-plant-line" },
  [Domain.EDU]: {
    labelId: "app.domain.tab.education",
    defaultLabel: "Education",
    icon: "ri-book-open-line",
  },
  [Domain.WASTE]: {
    labelId: "app.domain.tab.waste",
    defaultLabel: "Waste",
    icon: "ri-recycle-line",
  },
};

interface WorkIntroProps {
  actions: Action[];
  gardens: Garden[];
  selectedActionUID: number | null;
  selectedGardenAddress: Address | null;
  selectedDomain: Domain | null;
  setActionUID: (value: number | null) => void;
  setGardenAddress: (value: Address | null) => void;
  setSelectedDomain: (domain: Domain | null) => void;
}

export const WorkIntro: React.FC<WorkIntroProps> = ({
  actions,
  gardens,
  selectedActionUID,
  selectedGardenAddress,
  selectedDomain,
  setActionUID,
  setGardenAddress,
  setSelectedDomain,
}) => {
  const intl = useIntl();

  const uidFromActionId = (id: string): number | null => {
    const last = id.split("-").pop();
    const n = Number(last);
    return Number.isFinite(n) ? n : null;
  };

  // Single useMemo: compute available domains, filtered actions, filtered gardens (Rule 9)
  const { availableDomains, filteredActions, filteredGardens, effectiveDomain } = useMemo(() => {
    const now = Date.now();

    // Active actions only
    const active = actions.filter((a) => now >= a.startTime && now <= a.endTime);

    // Derive available domains from gardens' domain masks (decision 13),
    // falling back to action-derived domains for backward compatibility
    const gardenDomainSet = new Set(
      gardens.flatMap((g) => (g.domainMask ? expandDomainMask(g.domainMask) : []))
    );
    const domainSet =
      gardenDomainSet.size > 0 ? gardenDomainSet : new Set(active.map((a) => a.domain));
    const domains = Array.from(domainSet).sort((a, b) => a - b);

    // Auto-select domain: if only 1 domain or none selected yet, pick first available
    const effective =
      selectedDomain !== null && domainSet.has(selectedDomain)
        ? selectedDomain
        : domains.length > 0
          ? domains[0]
          : null;

    // Filter actions by effective domain
    const domainActions =
      effective !== null ? active.filter((a) => a.domain === effective) : active;

    // Filter gardens by selected domain; gardens without a domainMask (0 or undefined) pass through all filters
    const domainGardens =
      effective !== null
        ? gardens.filter((g) => (g.domainMask ? hasDomain(g.domainMask, effective) : true))
        : gardens;

    return {
      availableDomains: domains,
      filteredActions: domainActions,
      filteredGardens: domainGardens,
      effectiveDomain: effective,
    };
  }, [actions, gardens, selectedDomain]);

  // Build tab items from available domains (resolved via intl)
  const domainTabItems: StandardTab[] = useMemo(
    () =>
      availableDomains.map((d) => {
        const config = DOMAIN_TAB_CONFIG[d];
        return {
          id: String(d),
          label: config
            ? intl.formatMessage({ id: config.labelId, defaultMessage: config.defaultLabel })
            : `Domain ${d}`,
          icon: <i className={config?.icon ?? "ri-question-line"} aria-hidden="true" />,
        };
      }),
    [availableDomains, intl]
  );

  const showDomainTabs = availableDomains.length > 1;

  // Status: show skeletons while data loads
  const actionsStatus: "pending" | "success" = actions.length ? "success" : "pending";
  const gardensStatus: "pending" | "success" = gardens.length ? "success" : "pending";

  return (
    <>
      {/* Domain tabs — hidden if single domain */}
      {showDomainTabs && (
        <StandardTabs
          tabs={domainTabItems}
          activeTab={String(effectiveDomain ?? "")}
          onTabChange={(tabId) => {
            const domain = Number(tabId) as Domain;
            hapticSelection();
            setSelectedDomain(domain);
            // Clear action/garden selection when switching domains
            setActionUID(null);
            setGardenAddress(null);
          }}
          variant="compact"
          className="mb-2"
        />
      )}

      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourAction",
          defaultMessage: "Select your action",
        })}
        info={intl.formatMessage({
          id: "app.garden.whatTypeOfWork",
          defaultMessage: "What type of work are you submitting?",
        })}
        Icon={RiHammerFill}
      />
      <Carousel opts={{ align: "start" }}>
        <CarouselContent>
          {actionsStatus === "pending" &&
            Array.from({ length: 4 }).map((_, idx) => (
              <CarouselItem key={`action-skel-${idx}`}>
                <ActionCardSkeleton media="small" height="selection" />
              </CarouselItem>
            ))}

          {actions.length === 0 && actionsStatus === "success" && (
            <div className="p-4 text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "app.garden.noActionsConfigured",
                defaultMessage: "No actions have been configured for this garden yet.",
              })}
            </div>
          )}

          {actionsStatus === "success" && actions.length > 0 && filteredActions.length === 0 && (
            <div className="p-4 text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "app.garden.noActiveActions",
                defaultMessage: "No active actions at this time.",
              })}
            </div>
          )}

          {filteredActions.length > 0 &&
            filteredActions.map((action) => {
              const uid = uidFromActionId(action.id);
              return (
                <CarouselItem
                  key={action.id}
                  onClick={() => {
                    if (uid !== null) {
                      hapticSelection();
                      setActionUID(uid);
                    }
                  }}
                >
                  <ActionCard
                    action={action}
                    selected={selectedActionUID === uid}
                    media="small"
                    height="selection"
                  />
                </CarouselItem>
              );
            })}
        </CarouselContent>
      </Carousel>
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourGarden",
          defaultMessage: "Select your garden",
        })}
        info={intl.formatMessage({
          id: "app.garden.whichGarden",
          defaultMessage: "Which garden are you submitting for?",
        })}
        Icon={RiPlantFill}
      />
      <Carousel>
        <CarouselContent>
          {gardensStatus === "pending" &&
            Array.from({ length: 4 }).map((_, idx) => (
              <CarouselItem key={`garden-skel-${idx}`}>
                <GardenCardSkeleton media="small" height="selection" />
              </CarouselItem>
            ))}

          {filteredGardens.length === 0 && gardensStatus === "success" && (
            <div className="p-4 text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "app.garden.noGardensAvailable",
                defaultMessage: "No gardens available. You may need to join a garden first.",
              })}
            </div>
          )}

          {filteredGardens.length > 0 &&
            filteredGardens.map((garden) => (
              <CarouselItem
                key={garden.id}
                onClick={() => {
                  hapticSelection();
                  setGardenAddress(garden.id);
                }}
              >
                <GardenCard
                  garden={garden}
                  height="selection"
                  selected={garden.id === selectedGardenAddress}
                  showDescription={true}
                  showOperators={false}
                />
              </CarouselItem>
            ))}
        </CarouselContent>
      </Carousel>
    </>
  );
};
