import {
  type Action,
  type CommitmentComposerValues,
  cn,
  DomainBadge,
  MAX_COMMITMENT_REQUIREMENTS,
} from "@green-goods/shared";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";

import { ImageWithFallback } from "@/components/Display";

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
const ROW_COUNT_CHOICES = [1, 2, 4] as const;

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
  const direction = form.watch("direction");
  const kind = form.watch("kind");
  const unitLabel = form.watch("unitLabel");
  const targetUnits = form.watch("targetUnits");
  const dueInDays = form.watch("dueInDays");
  const claimMode = form.watch("claimMode");
  const requirements = form.watch("requirements");
  const isRequest = direction === "REQUEST";
  const isGardenWork = kind === "GARDEN_WORK";

  const setUnits = (value: number) =>
    form.setValue("targetUnits", value, { shouldValidate: true, shouldDirty: true });
  const setRows = (rows: CommitmentComposerValues["requirements"]) =>
    form.setValue("requirements", rows, { shouldValidate: true, shouldDirty: true });

  const rowFor = (action: Action) => {
    const uid = actionUIDOf(action.id, chainId);
    return uid === null ? undefined : requirements.find((row) => row.actionUID === uid);
  };
  const toggleAction = (action: Action) => {
    const uid = actionUIDOf(action.id, chainId);
    if (uid === null) return;
    const existing = requirements.find((row) => row.actionUID === uid);
    if (existing) {
      setRows(requirements.filter((row) => row.actionUID !== uid));
      return;
    }
    if (requirements.length >= MAX_COMMITMENT_REQUIREMENTS) return;
    setRows([...requirements, { actionUID: uid, requiredCount: 1 }]);
  };
  const setRowCount = (uid: string, requiredCount: number) =>
    setRows(requirements.map((row) => (row.actionUID === uid ? { ...row, requiredCount } : row)));

  const invalidRows = requirements.filter(
    (row) => !Number.isInteger(row.requiredCount) || row.requiredCount < 1
  );
  const rowTitle = (uid: string) =>
    actions.find((action) => actionUIDOf(action.id, chainId) === uid)?.title ?? `#${uid}`;

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
            {UNIT_CHOICES.map((unit) => (
              <button
                key={unit}
                type="button"
                aria-pressed={unitLabel === unit}
                onClick={() =>
                  form.setValue("unitLabel", unit, { shouldValidate: true, shouldDirty: true })
                }
                className={chipClass(unitLabel === unit)}
              >
                {formatMessage({ id: `app.compose.unit.${unit}` })}
              </button>
            ))}
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

      {isGardenWork ? (
        <section aria-labelledby="compose-proof-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="compose-proof-heading" className="text-sm font-medium text-text-strong-950">
              {formatMessage({ id: "app.compose.proof.title" })}
            </h2>
            {requirements.length > 0 ? (
              <span className="text-xs text-text-sub-600">
                {formatMessage({ id: "app.compose.proof.chosen" }, { count: requirements.length })}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-text-sub-600">
            {formatMessage({
              id: isRequest ? "app.compose.proof.noteRequest" : "app.compose.proof.noteOffer",
            })}
          </p>

          {invalidRows.length > 0 ? (
            <p className="mt-2 text-xs text-error-base" role="alert">
              {formatMessage({ id: "app.compose.proof.invalid" })}
            </p>
          ) : null}

          {actions.length === 0 ? (
            <p className="mt-3 text-sm text-text-sub-600">
              {formatMessage({ id: "app.compose.proof.noActions" })}
            </p>
          ) : (
            <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {actions.map((action) => {
                const row = rowFor(action);
                const selected = Boolean(row);
                return (
                  <button
                    key={action.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleAction(action)}
                    className={cn(
                      "flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-lg)] border text-left tap-feedback",
                      selected
                        ? "border-primary-alpha-24 bg-primary-alpha-10"
                        : "border-stroke-soft-200 bg-bg-white-0"
                    )}
                  >
                    <ImageWithFallback
                      src={action.media[0]}
                      alt=""
                      className="h-20 w-full object-cover"
                      fallbackClassName="h-20 w-full"
                    />
                    <span className="flex flex-1 flex-col gap-1 p-3">
                      <span className="truncate text-sm font-medium text-text-strong-950">
                        {action.title}
                      </span>
                      {action.domain ? <DomainBadge domain={action.domain} size="sm" /> : null}
                      <span className="mt-auto text-xs text-text-sub-600">
                        {selected
                          ? formatMessage(
                              { id: "app.compose.proof.times" },
                              { count: row?.requiredCount ?? 1 }
                            )
                          : formatMessage({ id: "app.compose.proof.tapToAdd" })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {requirements.length > 0 ? (
            <ul
              className="mt-3 space-y-2"
              aria-label={formatMessage({ id: "app.compose.proof.rows" })}
            >
              {requirements.map((row) => (
                <li
                  key={row.actionUID}
                  className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-text-strong-950">
                      {rowTitle(row.actionUID)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRows(requirements.filter((r) => r.actionUID !== row.actionUID))
                      }
                      aria-label={formatMessage(
                        { id: "app.compose.proof.remove" },
                        { action: rowTitle(row.actionUID) }
                      )}
                      className="shrink-0 rounded-full p-1 text-text-sub-600 tap-target-lg"
                    >
                      <RiCloseLine className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {ROW_COUNT_CHOICES.map((count) => (
                      <button
                        key={count}
                        type="button"
                        aria-pressed={row.requiredCount === count}
                        onClick={() => setRowCount(row.actionUID, count)}
                        className={chipClass(row.requiredCount === count)}
                      >
                        {formatMessage({ id: "app.compose.proof.times" }, { count })}
                      </button>
                    ))}
                    <label className="sr-only" htmlFor={`compose-row-${row.actionUID}`}>
                      {formatMessage(
                        { id: "app.compose.proof.countFor" },
                        { action: rowTitle(row.actionUID) }
                      )}
                    </label>
                    <input
                      id={`compose-row-${row.actionUID}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={Number.isFinite(row.requiredCount) ? row.requiredCount : ""}
                      onChange={(event) => setRowCount(row.actionUID, Number(event.target.value))}
                      className="w-20 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-2 text-sm text-text-strong-950"
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-xs text-text-soft-400">
              <RiAddLine className="h-4 w-4" aria-hidden="true" />
              {formatMessage({ id: "app.compose.proof.empty" })}
            </p>
          )}
        </section>
      ) : null}

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

/** Action ids are `${chainId}-${uid}`; the uid is what the contract takes. */
export function actionUIDOf(actionId: string, chainId: number): string | null {
  const prefix = `${chainId}-`;
  if (!actionId.startsWith(prefix)) return null;
  const uid = actionId.slice(prefix.length);
  return /^\d+$/.test(uid) ? uid : null;
}
