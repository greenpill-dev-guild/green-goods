import type {
  CommitmentComposerValues,
  CommitmentCycleRecord,
  CycleMetadataNameResolution,
} from "@green-goods/shared";
import { RiHandHeartLine, RiLeafLine } from "@remixicon/react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { useIntl } from "react-intl";

export interface ComposeWhatProps {
  form: UseFormReturn<CommitmentComposerValues>;
  /** The pool's open seasons and campaigns: where this could run. */
  openCycles: CommitmentCycleRecord[];
  cycleNames: Map<string, CycleMetadataNameResolution>;
}

/**
 * What kind of thing this is, where it runs, and what it is called.
 *
 * The kind is two equal cards rather than a default with a toggle, because the
 * two are equally ordinary here and they change what the next step asks:
 * garden work names the garden's actions and is kept by approvals; a service
 * names none and is kept by proof and the person it was for.
 *
 * Where it runs is a real choice only when more than one cycle is open.
 * Binding the one legal target is not guessing, so a single open season is
 * shown as a fact rather than a chooser.
 */
export function ComposeWhat({ form, openCycles, cycleNames }: ComposeWhatProps) {
  const { formatMessage } = useIntl();
  const direction = useWatch({ control: form.control, name: "direction" });
  const kind = useWatch({ control: form.control, name: "kind" });
  const title = useWatch({ control: form.control, name: "title" });
  const cycleId = useWatch({ control: form.control, name: "cycleId" });
  const isRequest = direction === "REQUEST";

  const kinds = [
    {
      id: "GARDEN_WORK" as const,
      icon: <RiLeafLine className="h-5 w-5" aria-hidden="true" />,
      titleId: "app.compose.kind.work.title",
      bodyId: "app.compose.kind.work.body",
    },
    {
      id: "SERVICE" as const,
      icon: <RiHandHeartLine className="h-5 w-5" aria-hidden="true" />,
      titleId: isRequest ? "app.compose.kind.help.title" : "app.compose.kind.service.title",
      bodyId: "app.compose.kind.service.body",
    },
  ];

  const cycleLabel = (cycle: CommitmentCycleRecord) => {
    const kindLabel = formatMessage({
      id: cycle.cycleType === "CAMPAIGN" ? "app.pool.rail.campaign" : "app.pool.rail.season",
    });
    const name = cycleNames.get(cycle.cycleId.toString())?.name;
    return name ? `${kindLabel} · ${name}` : kindLabel;
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-medium text-text-strong-950">
        {formatMessage({
          id: isRequest ? "app.compose.what.legendRequest" : "app.compose.what.legendOffer",
        })}
      </h1>

      <fieldset>
        <legend className="text-sm font-medium text-text-strong-950">
          {formatMessage({ id: "app.compose.what.kindLegend" })}
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {kinds.map((option) => {
            const selected = kind === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  form.setValue("kind", option.id, { shouldValidate: true, shouldDirty: true });
                  // Garden work is counted in hours; the actions are what is
                  // approved. A service keeps whatever unit the member chose.
                  if (option.id === "GARDEN_WORK") {
                    form.setValue("unitLabel", "hours", {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }
                }}
                className={
                  selected
                    ? "flex min-h-[7rem] flex-col gap-2 rounded-[var(--radius-lg)] border border-primary-alpha-24 bg-primary-alpha-10 p-3 text-left tap-target-lg"
                    : "flex min-h-[7rem] flex-col gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-3 text-left tap-target-lg"
                }
              >
                <span className="text-text-sub-600">{option.icon}</span>
                <span className="block text-sm font-medium text-text-strong-950">
                  {formatMessage({ id: option.titleId })}
                </span>
                <span className="block text-xs text-text-sub-600">
                  {formatMessage({ id: option.bodyId })}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {openCycles.length > 1 ? (
        <div>
          <label className="block text-sm font-medium text-text-strong-950" htmlFor="compose-cycle">
            {formatMessage({ id: "app.compose.what.whereLabel" })}
          </label>
          <select
            id="compose-cycle"
            value={cycleId}
            onChange={(event) =>
              form.setValue("cycleId", event.target.value, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
          >
            {openCycles.map((cycle) => (
              <option key={cycle.id} value={cycle.cycleId.toString()}>
                {cycleLabel(cycle)}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-text-soft-400">
            {formatMessage({ id: "app.compose.what.whereHelp" })}
          </p>
        </div>
      ) : openCycles[0] ? (
        <p className="text-sm text-text-sub-600">
          {formatMessage(
            { id: "app.compose.what.whereBound" },
            { cycle: cycleLabel(openCycles[0]) }
          )}
        </p>
      ) : (
        <p className="text-sm text-text-sub-600">
          {formatMessage({ id: "app.compose.what.whereNone" })}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-text-strong-950" htmlFor="compose-title">
          {formatMessage({ id: "app.compose.what.titleLabel" })}
        </label>
        <input
          id="compose-title"
          type="text"
          value={title}
          maxLength={120}
          placeholder={formatMessage({
            id: isRequest
              ? "app.compose.what.titlePlaceholderRequest"
              : "app.compose.what.titlePlaceholderOffer",
          })}
          onChange={(event) =>
            form.setValue("title", event.target.value, { shouldValidate: true, shouldDirty: true })
          }
          className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
        />
        <p className="mt-1.5 text-xs text-text-soft-400">
          {formatMessage({ id: "app.compose.what.titleHelp" })}
        </p>
      </div>
    </div>
  );
}
