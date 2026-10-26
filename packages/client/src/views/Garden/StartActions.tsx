import { ActionPicker } from "@green-goods/shared/components/Cards/ActionPicker";
import { Chip } from "@green-goods/shared/components/Chip";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { DOMAIN_CONFIG } from "@green-goods/shared/config/domain";
import type { Action, Domain } from "@green-goods/shared/types/domain";
import { parseActionUID } from "@green-goods/shared/utils/action/parsers";
import { RiHammerFill, RiHammerLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards/Form/FormInfo";

/** The garden's actions as two-up tiles under capsule domain chips with All. */
export function StartActions({
  actions,
  domains,
  loading,
  hasActions,
  selectedActionUID,
  selectedDomain,
  setSelectedDomain,
  onChoose,
  notice,
}: {
  actions: Action[];
  domains: readonly Domain[];
  loading: boolean;
  hasActions: boolean;
  selectedActionUID: number | null;
  selectedDomain: Domain | null;
  setSelectedDomain: (domain: Domain | null) => void;
  onChoose: (uid: number) => void;
  notice: ReactNode;
}) {
  const intl = useIntl();
  // A chip for a domain this garden does not offer reads as All.
  const domain =
    selectedDomain !== null && domains.includes(selectedDomain) ? selectedDomain : null;
  const shown = domain === null ? actions : actions.filter((action) => action.domain === domain);
  const selectedActionId =
    actions.find((action) => parseActionUID(action.id) === selectedActionUID)?.id ?? null;
  const title = intl.formatMessage({ id: "app.garden.selectYourAction" });

  return (
    <>
      <FormInfo
        fit="line"
        title={title}
        info={intl.formatMessage({ id: "app.garden.whatTypeOfWork" })}
        Icon={RiHammerFill}
      />
      {notice}
      {domains.length > 1 ? (
        <div
          role="group"
          aria-label={intl.formatMessage({ id: "app.gardenIntro.domains.label" })}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
        >
          <Chip selected={domain === null} onClick={() => setSelectedDomain(null)}>
            {intl.formatMessage({ id: "app.actions.domain.all" })}
          </Chip>
          {domains.map((each) => (
            <Chip key={each} selected={domain === each} onClick={() => setSelectedDomain(each)}>
              {intl.formatMessage({ id: DOMAIN_CONFIG[each].labelId })}
            </Chip>
          ))}
        </div>
      ) : null}
      {!loading && !hasActions ? (
        <EmptyState
          icon={<RiHammerLine />}
          title={intl.formatMessage({ id: "app.garden.noActionsConfigured" })}
        />
      ) : !loading && shown.length === 0 ? (
        <EmptyState
          icon={<RiHammerLine />}
          title={intl.formatMessage({ id: "app.garden.noActiveActions" })}
        />
      ) : (
        <ActionPicker
          actions={shown}
          value={selectedActionId}
          onChange={(actionId) => {
            const uid = parseActionUID(actionId);
            if (uid !== null) onChoose(uid);
          }}
          label={title}
          layout="tiles"
          loading={loading}
        />
      )}
    </>
  );
}

/** An action's domain as its row's pill; one the app does not know says Other. */
export function actionDomainPill(intl: IntlShape, action: Action) {
  return {
    label: intl.formatMessage({
      id: action.domain === null ? "app.domain.tab.unknown" : DOMAIN_CONFIG[action.domain].labelId,
    }),
    tone: "neutral" as const,
  };
}

/** What the action asks for, as the action picker says it. */
export function actionAsksFor(intl: IntlShape, action: Action) {
  const minPhotos = action.mediaInfo?.required ? (action.mediaInfo.minImageCount ?? 1) : 0;
  return minPhotos > 0
    ? intl.formatMessage({ id: "app.actions.picker.photosRequired" }, { count: minPhotos })
    : intl.formatMessage({ id: "app.actions.picker.photosOptional" });
}
