import { ActionPicker } from "@green-goods/shared/components/Cards/ActionPicker";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { useWorkSubmissionFlowController } from "@green-goods/shared/hooks/client-ui/work/useWorkSubmissionFlowController";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import type { Action } from "@green-goods/shared/types/domain";
import { parseActionUID } from "@green-goods/shared/utils/action/parsers";
import { RiHammerLine, RiHandHeartFill, RiUploadCloud2Line } from "@remixicon/react";
import { type IntlShape, useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards/Form/FormInfo";
import {
  type PromiseCardProps,
  presentState,
  promiseDueDetail,
} from "@/components/Features/Commitments";
import { actionAsksFor, actionDomainPill } from "./StartActions";

/** A promise the Start step lists, and one requirement of it the work can be linked to. */
type StartPromiseModel = ReturnType<
  typeof useWorkSubmissionFlowController
>["start"]["promises"][number];
type StartChoice = StartPromiseModel["choices"][number];

/** A promise's actions show as rows up to this many, and as two-up tiles past it (decision 16). */
const PROMISE_ACTION_ROWS = 3;

/** A listed promise as its card reads it. */
export function startPromiseCard(
  intl: IntlShape,
  promise: StartPromiseModel,
  titleOf: (actionUID: number) => string | null
): Omit<PromiseCardProps, "onOpen"> {
  const state = presentState(promise.state);
  const needs = promise.choices
    .map((choice) => titleOf(choice.actionUID))
    .filter((title): title is string => title !== null);
  if (promise.takesEvidence)
    needs.push(intl.formatMessage({ id: "app.garden.start.need.evidence" }));
  return {
    title: promise.title,
    direction: promise.direction,
    status: { label: intl.formatMessage({ id: state.labelId }), tone: state.tone },
    // The whole promise's, not the requirements listed here: a met one is not offered.
    progress: promise.progress,
    units: promise.unitLabel
      ? formatCommitmentUnits(intl, promise.targetUnits, promise.unitLabel)
      : null,
    due: promiseDueDetail(intl, promise.dueDate),
    needs,
  };
}

/** A promise's own screen: Add Evidence first when it takes evidence, then its actions. */
export function StartPromise({
  promise,
  actions,
  selectedActionUID,
  onAddEvidence,
  onChoose,
}: {
  promise: StartPromiseModel;
  actions: Action[];
  selectedActionUID: number | null;
  onAddEvidence: () => void;
  onChoose: (choice: StartChoice) => void;
}) {
  const intl = useIntl();
  const card = startPromiseCard(intl, promise, () => null);
  const progress = card.progress
    ? intl.formatMessage(
        { id: "app.garden.commitment.progress" },
        {
          done: Math.min(card.progress.approved, card.progress.required),
          total: card.progress.required,
        }
      )
    : card.units;
  // The panel keeps one line (decision 30), so its due date leaves the year to the card.
  const due = promise.dueDate
    ? intl.formatMessage(
        { id: "app.commitments.row.due" },
        {
          date: intl.formatDate(Number(promise.dueDate) * 1000, { month: "short", day: "numeric" }),
        }
      )
    : null;
  const rows = promise.choices.flatMap((choice) => {
    const action = actions.find((each) => parseActionUID(each.id) === choice.actionUID);
    return action ? [{ choice, action }] : [];
  });
  const selected = rows.filter(({ choice }) => choice.actionUID === selectedActionUID);

  return (
    <>
      <FormInfo
        fit="line"
        title={promise.title}
        info={[progress, due].filter(Boolean).join(" · ")}
        Icon={RiHandHeartFill}
      />
      {promise.takesEvidence ? (
        <ItemRow
          data-component="AddEvidence"
          lead={{ kind: "icon", icon: <RiUploadCloud2Line /> }}
          title={intl.formatMessage({ id: "app.garden.start.addEvidence.title" })}
          details={[intl.formatMessage({ id: "app.garden.start.addEvidence.detail" })]}
          onOpen={onAddEvidence}
        />
      ) : null}
      {rows.length > 0 ? (
        <h3 className="text-base font-semibold text-text-strong-950">
          {intl.formatMessage({ id: "app.garden.start.promiseActions" })}
        </h3>
      ) : null}
      {rows.length <= PROMISE_ACTION_ROWS ? (
        <div className="flex flex-col gap-(--gg-list-gap)">
          {rows.map(({ choice, action }) => (
            <ItemRow
              key={choice.requirementIndex}
              lead={{ kind: "photo", src: action.media[0] ?? null, fallbackIcon: RiHammerLine }}
              title={action.title}
              status={actionDomainPill(intl, action)}
              details={[actionAsksFor(intl, action)]}
              onOpen={() => onChoose(choice)}
            />
          ))}
        </div>
      ) : (
        <ActionPicker
          actions={rows.map(({ action }) => action)}
          getOptionValue={(_action, index) => String(rows[index].choice.requirementIndex)}
          value={selected.length === 1 ? String(selected[0].choice.requirementIndex) : null}
          onChange={(requirementIndex) => {
            const picked = rows.find(
              ({ choice }) => String(choice.requirementIndex) === requirementIndex
            );
            if (picked) onChoose(picked.choice);
          }}
          label={intl.formatMessage({ id: "app.garden.start.promiseActions" })}
          layout="tiles"
        />
      )}
    </>
  );
}
