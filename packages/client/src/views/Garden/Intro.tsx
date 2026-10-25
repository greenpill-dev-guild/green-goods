import { Button } from "@green-goods/shared/components/Button";
import { ActionPicker } from "@green-goods/shared/components/Cards/ActionPicker";
import {
  GardenCard,
  GardenPicker,
} from "@green-goods/shared/components/Cards/GardenCard/GardenCard";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { type Action, Domain, type Garden } from "@green-goods/shared/types/domain";
import { expandDomainMask, hasDomain } from "@green-goods/shared/utils/domain";
import { parseActionUID } from "@green-goods/shared/utils/action/parsers";
import { localizeAction } from "@green-goods/shared/utils/action/translations";
import {
  RiHammerFill,
  RiHammerLine,
  RiPlantFill,
  RiPlantLine,
  RiUserAddLine,
} from "@remixicon/react";
import React, { useMemo } from "react";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards/Form/FormInfo";
import { type StandardTab, StandardTabs } from "@/components/Navigation";
import { type WorkCommitmentChoice, WorkCommitmentSelection } from "./WorkCommitmentSelection";

/** Domain i18n label ID (stable); labels resolved via intl at render time */
const DOMAIN_TAB_CONFIG: Record<Domain, { labelId: string; defaultLabel: string }> = {
  [Domain.SOLAR]: { labelId: "app.domain.tab.solar", defaultLabel: "Solar" },
  [Domain.AGRO]: { labelId: "app.domain.tab.agro", defaultLabel: "Agroforestry" },
  [Domain.EDU]: {
    labelId: "app.domain.tab.education",
    defaultLabel: "Education",
  },
  [Domain.WASTE]: {
    labelId: "app.domain.tab.waste",
    defaultLabel: "Waste",
  },
};

interface WorkIntroProps {
  actions: Action[];
  gardens: Garden[];
  hasJoinedGardens?: boolean;
  isLoading?: boolean;
  joinableCommunityGarden?: Garden | null;
  isJoiningCommunityGarden?: boolean;
  onJoinCommunityGarden?: () => void;
  selectedActionUID: number | null;
  selectedGardenAddress: string | null;
  /**
   * The chosen garden can take the chosen action, so the step asks no garden question and
   * offers that garden's domains (decision 28).
   */
  gardenSettled?: boolean;
  selectedDomain: Domain | null;
  setActionUID: (value: number | null) => void;
  setGardenAddress: (value: string | null) => void;
  setSelectedDomain: (domain: Domain | null) => void;
  commitmentChoices?: WorkCommitmentChoice[];
  commitmentChoicesLoading?: boolean;
  commitmentChoicesError?: unknown;
  commitmentIntentStatus?: "none" | "validating" | "valid" | "invalid" | "unavailable";
  showCommitmentChoices?: boolean;
  onRetryCommitmentChoices?: () => void;
  selectedCommitmentKey?: string | null;
  setSelectedCommitmentKey?: (key: string | null) => void;
}

/** A picker row bleeds to the page's edges and snaps a card to the page's own inset. */
const PICKER_ROW_CLASS = "-mx-4 scroll-px-4 px-4";

export const WorkIntro: React.FC<WorkIntroProps> = ({
  actions,
  gardens,
  hasJoinedGardens = gardens.length > 0,
  isLoading = false,
  joinableCommunityGarden = null,
  isJoiningCommunityGarden = false,
  onJoinCommunityGarden,
  selectedActionUID,
  selectedGardenAddress,
  gardenSettled = false,
  selectedDomain,
  setActionUID,
  setGardenAddress,
  setSelectedDomain,
  commitmentChoices = [],
  commitmentChoicesLoading = false,
  commitmentChoicesError = null,
  commitmentIntentStatus = "none",
  showCommitmentChoices = false,
  onRetryCommitmentChoices,
  selectedCommitmentKey = null,
  setSelectedCommitmentKey,
}) => {
  const intl = useIntl();

  // Single useMemo: compute available domains, filtered actions, filtered gardens (Rule 9)
  const { availableDomains, filteredActions, unknownActions, filteredGardens, effectiveDomain } =
    useMemo(() => {
      const now = Date.now();

      // Active actions only. Drop any action whose id yields no UID so the
      // carousel never renders an unselectable card — and never parses a
      // missing id at render time.
      const active = actions.filter(
        (a) => now >= a.startTime && now <= a.endTime && parseActionUID(a.id) !== null
      );

      // Derive available domains from gardens' domain masks (decision 13),
      // falling back to action-derived domains for backward compatibility. A
      // settled garden offers its own domains only, so every action shown is
      // one it takes.
      const offeringGardens = gardenSettled
        ? gardens.filter((g) => g.id.toLowerCase() === selectedGardenAddress?.toLowerCase())
        : gardens;
      const gardenDomainSet = new Set(
        offeringGardens.flatMap((g) => (g.domainMask ? expandDomainMask(g.domainMask) : []))
      );
      const domainSet =
        gardenDomainSet.size > 0
          ? gardenDomainSet
          : new Set(active.map((a) => a.domain).filter((d): d is Domain => d !== null));
      const domains = Array.from(domainSet).sort((a, b) => a - b);

      // Auto-select domain: if only 1 domain or none selected yet, pick first available
      const effective =
        selectedDomain !== null && domainSet.has(selectedDomain)
          ? selectedDomain
          : domains.length > 0
            ? domains[0]
            : null;

      // Unknown-domain actions (a.domain === null) never join the named
      // carousel — even when no effective domain exists — so they are never
      // mislabeled or duplicated: they render only in their own "Other" group.
      const unknownDomainActions = active.filter((a) => a.domain === null);
      const knownActions = active.filter((a) => a.domain !== null);
      const domainActions =
        effective !== null ? knownActions.filter((a) => a.domain === effective) : knownActions;

      // Gardens without a domainMask (0 or undefined) pass through all filters.
      // A selected unknown-domain action has no named domain, so the garden
      // list must not inherit whichever named tab happened to be active.
      const selectedActionIsUnknown = unknownDomainActions.some(
        (a) => parseActionUID(a.id) === selectedActionUID
      );
      const domainGardens =
        effective !== null && !selectedActionIsUnknown
          ? gardens.filter((g) => (g.domainMask ? hasDomain(g.domainMask, effective) : true))
          : gardens;

      return {
        availableDomains: domains,
        // Each picker card reads its action in the reader's language.
        filteredActions: domainActions.map((action) => localizeAction(action, intl.locale)),
        unknownActions: unknownDomainActions.map((action) => localizeAction(action, intl.locale)),
        filteredGardens: domainGardens,
        effectiveDomain: effective,
      };
    }, [
      actions,
      gardens,
      gardenSettled,
      selectedGardenAddress,
      selectedDomain,
      selectedActionUID,
      intl.locale,
    ]);

  // Build tab items from available domains (resolved via intl)
  const domainTabItems: StandardTab[] = useMemo(
    () =>
      availableDomains.map((d) => {
        const config = DOMAIN_TAB_CONFIG[d];
        const fullLabel = config
          ? intl.formatMessage({ id: config.labelId, defaultMessage: config.defaultLabel })
          : `Domain ${d}`;
        return {
          id: String(d),
          label:
            d === Domain.AGRO
              ? intl.formatMessage({
                  id: "app.gardenIntro.domain.agroShort",
                  defaultMessage: "Agro",
                })
              : fullLabel,
          accessibleLabel: d === Domain.AGRO ? fullLabel : undefined,
        };
      }),
    [availableDomains, intl]
  );

  const showDomainTabs = availableDomains.length > 1;

  // The pickers choose by action id; the flow keeps the action's UID.
  const selectedActionId =
    selectedActionUID === null
      ? null
      : (actions.find((action) => parseActionUID(action.id) === selectedActionUID)?.id ?? null);
  const chooseAction = (actionId: string) => {
    const uid = parseActionUID(actionId);
    if (uid !== null) setActionUID(uid);
  };

  // Status: show skeletons while data loads
  const actionsStatus: "pending" | "success" =
    isLoading && actions.length === 0 ? "pending" : "success";
  const gardensStatus: "pending" | "success" =
    isLoading && gardens.length === 0 && !joinableCommunityGarden ? "pending" : "success";
  const showCommunityOnramp =
    !hasJoinedGardens && Boolean(joinableCommunityGarden) && Boolean(onJoinCommunityGarden);
  const communityGardenSelected = joinableCommunityGarden?.id === selectedGardenAddress;

  return (
    <>
      {/* Domain tabs — hidden if single domain */}
      {showDomainTabs && (
        <StandardTabs
          tabs={domainTabItems}
          activeTab={String(effectiveDomain ?? "")}
          onTabChange={(tabId) => {
            const domain = Number(tabId) as Domain;
            setSelectedDomain(domain);
            // A new domain clears the action. A settled garden takes every domain
            // offered, so only a garden the step still asks for is cleared.
            setActionUID(null);
            if (!gardenSettled) setGardenAddress(null);
          }}
          ariaLabel={intl.formatMessage({
            id: "app.gardenIntro.domains.label",
            defaultMessage: "Domains",
          })}
          variant="compact"
          className="-mx-4 mb-2 sm:-mx-6 md:-mx-12"
          triggerClassName="px-2 text-xs leading-4 [&>span]:break-normal [&>span]:whitespace-nowrap sm:px-3 sm:text-label-sm"
        />
      )}

      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourAction",
          defaultMessage: "Select Your Action",
        })}
        info={intl.formatMessage({
          id: "app.garden.whatTypeOfWork",
          defaultMessage: "What type of work are you submitting?",
        })}
        Icon={RiHammerFill}
      />
      {actions.length === 0 && actionsStatus === "success" ? (
        <EmptyState
          icon={<RiHammerLine />}
          title={intl.formatMessage({
            id: "app.garden.noActionsConfigured",
            defaultMessage: "No actions have been configured for this garden yet.",
          })}
        />
      ) : actionsStatus === "success" &&
        filteredActions.length === 0 &&
        unknownActions.length === 0 ? (
        <EmptyState
          icon={<RiHammerLine />}
          title={intl.formatMessage({
            id: "app.garden.noActiveActions",
            defaultMessage: "No active actions at this time.",
          })}
        />
      ) : actionsStatus === "pending" || filteredActions.length > 0 ? (
        <ActionPicker
          actions={filteredActions}
          value={selectedActionId}
          onChange={chooseAction}
          label={intl.formatMessage({
            id: "app.garden.selectYourAction",
            defaultMessage: "Select Your Action",
          })}
          layout="row"
          loading={actionsStatus === "pending"}
          className={PICKER_ROW_CLASS}
        />
      ) : null}

      {/* Actions whose domain this client doesn't recognize (newer protocol
          enum) — kept submittable in their own group, never under a named tab. */}
      {unknownActions.length > 0 && (
        <>
          <p className="text-paragraph-md tracking-normal text-text-sub-600">
            {intl.formatMessage({ id: "app.domain.tab.unknown", defaultMessage: "Other" })}
          </p>
          <ActionPicker
            actions={unknownActions}
            value={selectedActionId}
            onChange={chooseAction}
            label={intl.formatMessage({ id: "app.domain.tab.unknown", defaultMessage: "Other" })}
            layout="row"
            className={PICKER_ROW_CLASS}
          />
        </>
      )}
      {/* The flow names no garden it already has (decision 28): the chip on Home
          carries it, and the flow says so under its steps when it differs. */}
      {gardenSettled ? null : (
        <>
          <FormInfo
            title={intl.formatMessage({
              id: "app.garden.selectYourGarden",
              defaultMessage: "Select Your Garden",
            })}
            info={intl.formatMessage({
              id: "app.garden.whichGarden",
              defaultMessage: "Which garden are you submitting for?",
            })}
            Icon={RiPlantFill}
          />
          {filteredGardens.length === 0 &&
          gardensStatus === "success" &&
          showCommunityOnramp &&
          communityGardenSelected &&
          joinableCommunityGarden ? (
            <GardenCard garden={joinableCommunityGarden} selected />
          ) : filteredGardens.length === 0 && gardensStatus === "success" && showCommunityOnramp ? (
            <EmptyState
              icon={<RiPlantLine />}
              title={intl.formatMessage({
                id: "app.garden.communityOnramp.title",
                defaultMessage: "Join the Community Garden",
              })}
              description={intl.formatMessage({
                id: "app.garden.communityOnramp.description",
                defaultMessage:
                  "The Community Garden is open to everyone and gives you a place to submit your first work.",
              })}
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={onJoinCommunityGarden}
                  loading={isJoiningCommunityGarden}
                  leadingIcon={<RiUserAddLine className="h-4 w-4" aria-hidden="true" />}
                >
                  {intl.formatMessage({
                    id: "app.garden.communityOnramp.action",
                    defaultMessage: "Join Garden",
                  })}
                </Button>
              }
            />
          ) : filteredGardens.length === 0 && gardensStatus === "success" ? (
            <EmptyState
              icon={<RiPlantLine />}
              title={intl.formatMessage({
                id: "app.garden.noGardensAvailable.title",
                defaultMessage: "No gardens available",
              })}
              description={intl.formatMessage({
                id: "app.garden.noGardensAvailable.description",
                defaultMessage: "You may need to join a garden first.",
              })}
            />
          ) : (
            <GardenPicker
              gardens={filteredGardens}
              value={selectedGardenAddress}
              onChange={setGardenAddress}
              label={intl.formatMessage({
                id: "app.garden.selectYourGarden",
                defaultMessage: "Select Your Garden",
              })}
              layout="row"
              loading={gardensStatus === "pending"}
              className={PICKER_ROW_CLASS}
            />
          )}
        </>
      )}

      {showCommitmentChoices ? (
        <WorkCommitmentSelection
          choices={commitmentChoices}
          isLoading={commitmentChoicesLoading}
          error={commitmentChoicesError}
          intentStatus={commitmentIntentStatus}
          onRetry={onRetryCommitmentChoices}
          selectedKey={selectedCommitmentKey}
          onSelectedKeyChange={setSelectedCommitmentKey}
        />
      ) : null}
    </>
  );
};
