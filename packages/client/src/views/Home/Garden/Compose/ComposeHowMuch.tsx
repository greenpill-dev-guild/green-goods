import { type Action, type CommitmentComposerValues, cn } from "@green-goods/shared";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { useIntl } from "react-intl";

import { ComposeActionRail } from "./ComposeActionRail";

export { actionUIDOf } from "./ComposeActionRail";

export interface ComposeHowMuchProps {
  form: UseFormReturn<CommitmentComposerValues>;
  chainId: number;
  /** The garden's registered actions, for garden work. */
  actions: Action[];
}

const UNIT_CHOICES = ["hours", "sessions", "rides", "meals", "repairs"] as const;
const COUNT_CHOICES = [1, 2, 3, 4, 6] as const;
const HOUR_CHOICES = [1, 2, 4, 6, 12] as const;
const DAY_CHOICES = [7, 14, 30] as const;

function chipClass(selected: boolean) {
  return cn(
    "rounded-full border px-3 py-1.5 text-xs font-medium tap-target-lg",
    selected
      ? "border-primary-alpha-24 bg-primary-alpha-10 text-primary"
      : "border-stroke-soft-200 text-text-sub-600"
  );
}

/**
 * How much is put in, by when, and on what terms it is kept.
 *
 * A service counts whatever the member says it counts and is kept by proof;
 * garden work is counted in hours and kept by the garden approving the actions
 * named here, each with how many approved submissions it needs. Those rows are
 * what the contract calls requirements. There are as many as the commitment
 * genuinely needs; the module's ceiling is a validation limit, never a number
 * a member is shown as a plan.
 *
 * An asker also says who may take it up: anyone here, or only someone the
 * stewards review. An offer is open to be taken by definition.
 */
export function ComposeHowMuch({ form, chainId, actions }: ComposeHowMuchProps) {
  const { formatMessage } = useIntl();
  const direction = useWatch({ control: form.control, name: "direction" });
  const kind = useWatch({ control: form.control, name: "kind" });
  const unitLabel = useWatch({ control: form.control, name: "unitLabel" });
  const targetUnits = useWatch({ control: form.control, name: "targetUnits" });
  const dueInDays = useWatch({ control: form.control, name: "dueInDays" });
  const claimMode = useWatch({ control: form.control, name: "claimMode" });
  const isRequest = direction === "REQUEST";
  const isGardenWork = kind === "GARDEN_WORK";

  const setUnits = (value: number) =>
    form.setValue("targetUnits", value, { shouldValidate: true, shouldDirty: true });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-text-strong-950">
        {formatMessage({
          id: isGardenWork ? "app.compose.howMuch.legendHours" : "app.compose.howMuch.legend",
        })}
      </h1>

      {isGardenWork ? (
        <p className="text-sm text-text-sub-600">
          {formatMessage({
            id: isRequest
              ? "app.compose.howMuch.hoursHelpRequest"
              : "app.compose.howMuch.hoursHelpOffer",
          })}
        </p>
      ) : (
        <fieldset>
          <legend className="text-sm font-medium text-text-strong-950">
            {formatMessage({ id: "app.compose.what.unitLabel" })}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {UNIT_CHOICES.map((unit) => {
              // The label is the member's own word for what is counted, and it
              // goes on chain as written. A chip therefore stores what it shows,
              // so a Spanish reader's commitment does not say "hours".
              const label = formatMessage({ id: `app.compose.unit.${unit}` });
              const selected = unitLabel === label;
              return (
                <button
                  key={unit}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    form.setValue("unitLabel", label, { shouldValidate: true, shouldDirty: true })
                  }
                  className={chipClass(selected)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <label className="mt-2 block text-xs text-text-soft-400" htmlFor="compose-label">
            {formatMessage({ id: "app.compose.what.unitHelp" })}
          </label>
          <input
            id="compose-label"
            type="text"
            value={unitLabel}
            maxLength={40}
            placeholder={formatMessage({ id: "app.compose.what.unitPlaceholder" })}
            onChange={(event) =>
              form.setValue("unitLabel", event.target.value, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
          />
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-text-strong-950">
          {formatMessage({
            id: isGardenWork ? "app.compose.howMuch.countHours" : "app.compose.what.countLabel",
          })}
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(isGardenWork ? HOUR_CHOICES : COUNT_CHOICES).map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={targetUnits === count}
              onClick={() => setUnits(count)}
              className={chipClass(targetUnits === count)}
            >
              {count}
            </button>
          ))}
        </div>
        <label className="mt-2 block text-xs text-text-soft-400" htmlFor="compose-units">
          {formatMessage({ id: "app.compose.howMuch.customCount" })}
        </label>
        <input
          id="compose-units"
          type="number"
          inputMode="numeric"
          min={1}
          value={Number.isFinite(targetUnits) ? targetUnits : ""}
          onChange={(event) => setUnits(Number(event.target.value))}
          className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
        />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-text-strong-950">
          {formatMessage({ id: "app.compose.terms.byWhen" })}
        </legend>
        <div className="mt-2 flex gap-2">
          {DAY_CHOICES.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={dueInDays === days}
              onClick={() =>
                form.setValue("dueInDays", days, { shouldValidate: true, shouldDirty: true })
              }
              className={chipClass(dueInDays === days)}
            >
              {formatMessage({ id: "app.compose.terms.days" }, { count: days })}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-text-soft-400">
          {formatMessage({ id: "app.compose.terms.byWhenHelp" })}
        </p>
      </fieldset>

      {isGardenWork ? <ComposeActionRail form={form} chainId={chainId} actions={actions} /> : null}

      {isRequest ? (
        <fieldset>
          <legend className="text-sm font-medium text-text-strong-950">
            {formatMessage({ id: "app.compose.claimMode.legend" })}
          </legend>
          <div className="mt-2 space-y-2">
            {(["OPEN", "APPROVAL_GATED"] as const).map((mode) => (
              <div
                key={mode}
                className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3"
              >
                <input
                  id={`compose-claim-${mode}`}
                  type="radio"
                  name="compose-claim-mode"
                  value={mode}
                  checked={claimMode === mode}
                  onChange={() =>
                    form.setValue("claimMode", mode, { shouldValidate: true, shouldDirty: true })
                  }
                  className="mt-1 accent-[var(--color-primary)]"
                />
                <label htmlFor={`compose-claim-${mode}`} className="min-w-0 cursor-pointer">
                  <span className="block text-sm font-medium text-text-strong-950">
                    {formatMessage({ id: `app.compose.claimMode.${mode}.title` })}
                  </span>
                  <span className="block text-xs text-text-sub-600">
                    {formatMessage({ id: `app.compose.claimMode.${mode}.body` })}
                  </span>
                </label>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-soft-400">
            {formatMessage({ id: "app.compose.claimMode.help" })}
          </p>
        </fieldset>
      ) : null}
    </div>
  );
}
