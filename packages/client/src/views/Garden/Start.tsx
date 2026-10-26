import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { ActionPicker } from "@green-goods/shared/components/Cards/ActionPicker";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { useWorkSubmissionFlowController } from "@green-goods/shared/hooks/client-ui/work/useWorkSubmissionFlowController";
import type { Domain } from "@green-goods/shared/types/domain";
import { parseActionUID } from "@green-goods/shared/utils/action/parsers";
import { localizeAction } from "@green-goods/shared/utils/action/translations";
import { RiCloseLine, RiHammerLine, RiHandHeartFill, RiRefreshLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards/Form/FormInfo";
import { PromiseCard } from "@/components/Features/Commitments";
import { StartActions } from "./StartActions";
import { StartGardenQuestion, type StartGardenQuestionProps } from "./StartGardenQuestion";
import { StartPromise, startPromiseCard } from "./StartPromise";

type Controller = ReturnType<typeof useWorkSubmissionFlowController>;
/** The Start step's model, from the work kind's controller. */
type StartStep = Controller["start"];

export interface WorkStartProps {
  start: StartStep;
  /** The chain's actions are still being read. */
  actionsLoading: boolean;
  /** The chain lists any action at all; with none, the step says none are set up yet. */
  hasActions: boolean;
  selectedActionUID: number | null;
  /** The domain chip chosen, null for All. The chips only filter: they choose nothing. */
  selectedDomain: Domain | null;
  setSelectedDomain: (domain: Domain | null) => void;
  gardenQuestion: StartGardenQuestionProps | null;
  /** The page's promise link, when it no longer holds or could not be checked. */
  link: { status: Controller["linkIntentStatus"]; onRetry: () => void; onLetGo: () => void };
}

/**
 * Logging work's Start step (DL-131). It has no Start button: choosing a promise or an action
 * moves on, and the domain chips only filter. With promises the member could work on, it lists
 * them as compact cards, then the garden's Open asks they could take up in the same tap, saying
 * how many prompts that brings (decision 18), with Log Work on Its Own last; a promise or an ask
 * with actions opens its own screen, Add Evidence first when it takes evidence, then its
 * actions; otherwise it is the garden's actions as two-up tiles under the chips. The garden
 * comes from Home's chip, so the step asks for one only when the flow has none it can use.
 */
export function WorkStart({
  start,
  actionsLoading,
  hasActions,
  selectedActionUID,
  selectedDomain,
  setSelectedDomain,
  gardenQuestion,
  link,
}: WorkStartProps) {
  const intl = useIntl();
  // Every card and tile reads its action in the reader's language.
  const actions = useMemo(
    () => start.actions.map((action) => localizeAction(action, intl.locale)),
    [start.actions, intl.locale]
  );

  if (gardenQuestion) return <StartGardenQuestion {...gardenQuestion} />;
  if (start.waiting) return <StartSkeleton />;

  const titleOf = (actionUID: number) =>
    actions.find((action) => parseActionUID(action.id) === actionUID)?.title ?? null;
  const linkNotice =
    link.status === "invalid" || link.status === "unavailable" ? (
      <Alert
        variant="warning"
        action={
          <span className="flex flex-wrap gap-2">
            {link.status === "unavailable" ? (
              <Button
                type="button"
                emphasis="secondary"
                size="compact"
                onClick={link.onRetry}
                leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
              >
                {intl.formatMessage({ id: "app.garden.commitment.retry" })}
              </Button>
            ) : null}
            <Button
              type="button"
              emphasis="secondary"
              size="compact"
              onClick={link.onLetGo}
              leadingIcon={<RiCloseLine className="h-4 w-4" aria-hidden="true" />}
            >
              {intl.formatMessage({ id: "app.garden.commitment.none" })}
            </Button>
          </span>
        }
      >
        {intl.formatMessage({
          id:
            link.status === "invalid"
              ? "app.garden.commitment.invalid"
              : "app.garden.commitment.error",
        })}
      </Alert>
    ) : null;

  // Promises or Open asks that could not be read, said on either list with a retry, never as none.
  const readNotice = start.promisesFailed ? (
    <Alert
      variant="warning"
      action={
        <Button
          type="button"
          emphasis="secondary"
          size="compact"
          onClick={start.retryPromises}
          leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
        >
          {intl.formatMessage({ id: "app.garden.commitment.retry" })}
        </Button>
      }
    >
      {intl.formatMessage({ id: "app.garden.commitment.error" })}
    </Alert>
  ) : null;

  const { screen } = start;
  return (
    <div className="flex flex-col gap-4" data-component="WorkStart" data-screen={screen.kind}>
      {screen.kind === "promise" ? (
        <StartPromise
          promise={screen.promise}
          actions={actions}
          selectedActionUID={selectedActionUID}
          onAddEvidence={() => start.addEvidence(screen.promise)}
          onChoose={(choice) => void start.choosePromiseAction(choice)}
        />
      ) : screen.kind === "promises" ? (
        <>
          <FormInfo
            fit="line"
            title={intl.formatMessage({ id: "app.garden.start.promises.title" })}
            info={intl.formatMessage({ id: "app.garden.start.promises.info" })}
            Icon={RiHandHeartFill}
          />
          {linkNotice ?? readNotice}
          <div className="flex flex-col gap-(--gg-list-gap)">
            {start.promises.map((promise) => (
              <PromiseCard
                key={promise.commitmentId.toString()}
                {...startPromiseCard(intl, promise, titleOf)}
                onOpen={() => start.pickPromise(promise)}
              />
            ))}
            {start.asks.length > 0 ? (
              <div className="flex flex-col gap-(--gg-list-gap)" data-component="StartAsks">
                <div className="flex flex-col gap-1">
                  <h3 className="type-title-md text-text-strong-950">
                    {intl.formatMessage({ id: "app.garden.start.asks.title" })}
                  </h3>
                  <p className="type-meta text-text-sub-600">
                    {intl.formatMessage(
                      { id: "app.garden.start.asks.prompts" },
                      { count: start.askPromptCount }
                    )}
                  </p>
                </div>
                {start.asks.map((ask) => (
                  <PromiseCard
                    key={ask.commitmentId.toString()}
                    {...startPromiseCard(intl, ask, titleOf)}
                    onOpen={() => start.pickPromise(ask)}
                  />
                ))}
              </div>
            ) : null}
            <ItemRow
              data-component="LogWorkOnItsOwn"
              lead={{ kind: "icon", icon: <RiHammerLine /> }}
              title={intl.formatMessage({ id: "app.garden.start.logOnOwn.title" })}
              details={[intl.formatMessage({ id: "app.garden.start.logOnOwn.detail" })]}
              onOpen={start.logWorkOnItsOwn}
            />
          </div>
        </>
      ) : (
        <StartActions
          actions={actions}
          domains={start.domains}
          loading={actionsLoading}
          hasActions={hasActions}
          selectedActionUID={selectedActionUID}
          selectedDomain={selectedDomain}
          setSelectedDomain={setSelectedDomain}
          onChoose={(uid) => void start.chooseAction(uid)}
          notice={linkNotice ?? readNotice}
        />
      )}
    </div>
  );
}

/** The step before its answer: the info panel's place and the tiles', as they will land. */
export function StartSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" data-component="WorkStartSkeleton">
      <div aria-hidden="true" className="h-20 rounded-lg bg-bg-weak-50" />
      <ActionPicker
        actions={[]}
        value={null}
        onChange={() => undefined}
        label=""
        layout="tiles"
        loading
      />
    </div>
  );
}
