import {
  type CommitmentComposerValues,
  MAX_COMMITMENT_SET_SIZE,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import {
  COMMITMENT_COUNT_CHOICES,
  COMMITMENT_DAY_CHOICES,
  COMMITMENT_HOUR_CHOICES,
  COMMITMENT_UNIT_CHOICES,
  COMMITMENT_UNIT_LABEL_MAX_LENGTH,
} from "@green-goods/shared/modules/commitment-pooling/metadata";
import type { Action } from "@green-goods/shared/types/domain";
import { hasActionEnded } from "@green-goods/shared/utils/action/window";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import { Controller, type UseFieldArrayReturn, type UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCardTitle } from "@/components/AdminCard";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSelect, AdminTextField } from "@/components/AdminTextField";
import { SeedTotal } from "./SeedTotal";
import { dueDateAfter, formatDueDate } from "./seedReward";
import { actionUIDOf, closedSeedActions, type SeedFieldError } from "./seedStepModel";

/** How many separate promises a steward usually seeds at once. */
const SET_SIZE_CHOICES = [1, 5, 10, 20] as const;

export interface SeedStepHowMuchProps {
  form: UseFormReturn<CommitmentComposerValues>;
  values: CommitmentComposerValues;
  /** Field ids are derived from the dialog's one useId, so labels stay unique. */
  noteId: string;
  busy: boolean;
  errorOf: SeedFieldError;
  /** The requirement rows, owned by the dialog so they survive a step change. */
  requirements: UseFieldArrayReturn<CommitmentComposerValues, "requirements">;
  /** The garden's registered actions, for garden work. */
  actions: Action[];
  chainId: number;
  now: number;
  /** The pool's per-person limit of open promises, when it is known. */
  cap: number | null;
}

/**
 * Step two of Seed Promises (PRD-1022 screens 02–03): two plainly named
 * questions. How many separate promises to create, and what each one asks for
 * (its unit and amount, when it is due, who may contribute and, for garden
 * work, the approved actions it is kept by). A total under them states the
 * arithmetic in one fixed height, turning into a soft check when both numbers
 * are above one, so nothing below it moves.
 */
export function SeedStepHowMuch({
  form,
  values,
  noteId,
  busy,
  errorOf,
  requirements,
  actions,
  chainId,
  now,
  cap,
}: SeedStepHowMuchProps) {
  const { formatMessage, locale } = useIntl();
  const isGardenWork = values.kind === "GARDEN_WORK";
  const count = values.count ?? 1;
  const set = (
    field: "unitLabel" | "targetUnits" | "dueInDays" | "count",
    value: string | number
  ) => form.setValue(field, value as never, { shouldDirty: true, shouldValidate: true });
  const suggestionsFor = (field: string) =>
    formatMessage(
      { id: "cockpit.garden.pool.seed.suggestionsFor", defaultMessage: "Suggestions for {field}" },
      { field }
    );
  const promisesText = formatMessage({
    id: "cockpit.garden.pool.seed.promisesField",
    defaultMessage: "Promises",
  });
  const unitLabelText = formatMessage({
    id: "cockpit.garden.pool.seed.unit",
    defaultMessage: "Unit",
  });
  const amountText = formatMessage({
    id: "cockpit.garden.pool.seed.amountEach",
    defaultMessage: "Amount",
  });
  const dueText = formatMessage({
    id: "cockpit.garden.pool.seed.dueInDays",
    defaultMessage: "Due in (days)",
  });
  const due = formatDueDate(dueDateAfter(now, values.dueInDays), locale);

  return (
    <div className="space-y-5">
      <fieldset className="min-w-0 space-y-2" aria-labelledby={`${noteId}-promises`}>
        <AdminCardTitle as="h4" id={`${noteId}-promises`}>
          {formatMessage({
            id: "cockpit.garden.pool.seed.promisesToCreate",
            defaultMessage: "Promises to create",
          })}
        </AdminCardTitle>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={suggestionsFor(promisesText)}
        >
          {SET_SIZE_CHOICES.map((choice) => (
            <AdminFilterChip
              key={choice}
              label={String(choice)}
              selected={count === choice}
              onToggle={() => set("count", choice)}
              disabled={busy}
            />
          ))}
        </div>
        <AdminTextField
          label={promisesText}
          value={String(values.count ?? 1)}
          onChange={(event) => set("count", Number(event.target.value))}
          error={errorOf("count")}
          helperText={formatMessage({
            id: "cockpit.garden.pool.seed.promisesHint",
            defaultMessage:
              "Each one is taken up and kept on its own; gardeners see them as one group.",
          })}
          inputProps={{ inputMode: "numeric", max: MAX_COMMITMENT_SET_SIZE }}
          disabled={busy}
          required
          className="max-w-sm"
        />
      </fieldset>

      <fieldset className="min-w-0 space-y-3" aria-labelledby={`${noteId}-each`}>
        <AdminCardTitle as="h4" id={`${noteId}-each`}>
          {formatMessage({
            id: "cockpit.garden.pool.seed.eachPromiseAsks",
            defaultMessage: "Each promise asks for",
          })}
        </AdminCardTitle>
        {isGardenWork ? (
          <p className="body-sm text-text-sub">
            {formatMessage({
              id: "cockpit.garden.pool.seed.countedInHours",
              defaultMessage: "Counted in hours",
            })}
          </p>
        ) : (
          <div className="space-y-2">
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={suggestionsFor(unitLabelText)}
            >
              {COMMITMENT_UNIT_CHOICES.map((unit) => {
                // The chip stores the words it shows, as the member composer's does.
                const label = formatMessage({
                  id: `app.compose.unit.${unit}`,
                  defaultMessage: unit,
                });
                return (
                  <AdminFilterChip
                    key={unit}
                    label={label}
                    selected={values.unitLabel === label}
                    onToggle={() => set("unitLabel", label)}
                    disabled={busy}
                  />
                );
              })}
            </div>
            <AdminTextField
              label={unitLabelText}
              value={values.unitLabel}
              onChange={(event) => set("unitLabel", event.target.value)}
              error={errorOf("unitLabel")}
              helperText={formatMessage({
                id: "cockpit.garden.pool.seed.unitHint",
                defaultMessage: "What each promise counts.",
              })}
              placeholder={formatMessage({
                id: "cockpit.garden.pool.seed.unitPlaceholder",
                defaultMessage: "rides",
              })}
              disabled={busy}
              required
              showCount
              inputProps={{ maxLength: COMMITMENT_UNIT_LABEL_MAX_LENGTH }}
            />
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={suggestionsFor(amountText)}
            >
              {(isGardenWork ? COMMITMENT_HOUR_CHOICES : COMMITMENT_COUNT_CHOICES).map((choice) => (
                <AdminFilterChip
                  key={choice}
                  label={String(choice)}
                  selected={values.targetUnits === choice}
                  onToggle={() => set("targetUnits", choice)}
                  disabled={busy}
                />
              ))}
            </div>
            <AdminTextField
              label={amountText}
              value={String(values.targetUnits)}
              onChange={(event) => set("targetUnits", Number(event.target.value))}
              error={errorOf("targetUnits")}
              helperText={formatMessage({
                id: "cockpit.garden.pool.seed.amountHint",
                defaultMessage: "Per promise.",
              })}
              inputProps={{ inputMode: "numeric" }}
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label={suggestionsFor(dueText)}>
              {COMMITMENT_DAY_CHOICES.map((days) => (
                <AdminFilterChip
                  key={days}
                  label={formatMessage(
                    {
                      id: "app.compose.terms.days",
                      defaultMessage: "{count, plural, one {# day} other {# days}}",
                    },
                    { count: days }
                  )}
                  selected={values.dueInDays === days}
                  onToggle={() => set("dueInDays", days)}
                  disabled={busy}
                />
              ))}
            </div>
            <AdminTextField
              label={dueText}
              value={String(values.dueInDays)}
              onChange={(event) => set("dueInDays", Number(event.target.value))}
              error={errorOf("dueInDays")}
              helperText={formatMessage(
                {
                  id: "cockpit.garden.pool.seed.dueHint",
                  defaultMessage:
                    "{count, plural, one {It is due {date}.} other {Every promise is due {date}.}}",
                },
                { count, date: due }
              )}
              inputProps={{ inputMode: "numeric" }}
              disabled={busy}
              required
            />
          </div>
        </div>
        <Controller
          control={form.control}
          name="openTeam"
          render={({ field }) => (
            <AdminChoiceGroup
              ariaLabel={formatMessage({
                id: "cockpit.garden.pool.seed.contributorPolicy",
                defaultMessage: "Contributor policy",
              })}
              value={field.value ? "open" : "lead"}
              onChange={(value) => field.onChange(value === "open")}
              columns={2}
              options={[
                {
                  value: "open",
                  disabled: busy,
                  label: formatMessage({
                    id: "cockpit.garden.pool.seed.team.open",
                    defaultMessage: "Open team",
                  }),
                  description: formatMessage({
                    id: "cockpit.garden.pool.seed.team.openHint",
                    defaultMessage: "Eligible garden members may join",
                  }),
                },
                {
                  value: "lead",
                  disabled: busy,
                  label: formatMessage({
                    id: "cockpit.garden.pool.seed.team.lead",
                    defaultMessage: "Lead-managed team",
                  }),
                  description: formatMessage({
                    id: "cockpit.garden.pool.seed.team.leadHint",
                    defaultMessage: "The lead or a steward manages the roster",
                  }),
                },
              ]}
            />
          )}
        />
        {isGardenWork ? (
          <div className="space-y-2" data-testid="seed-requirements">
            <AdminCardTitle as="h4">
              {formatMessage({
                id: "cockpit.garden.pool.seed.requirements",
                defaultMessage: "Actions this needs",
              })}
            </AdminCardTitle>
            <p className="body-xs text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.seed.requirementsHint",
                defaultMessage:
                  "Each row names a garden action and how many approved works it takes. Add as many as the work needs.",
              })}
            </p>
            {requirements.fields.map((row, index) => (
              <div key={row.id} className="flex items-end gap-2">
                <AdminSelect
                  id={`${noteId}-req-${index}`}
                  className="min-w-0 flex-1"
                  label={formatMessage({
                    id: "cockpit.garden.pool.seed.requirementAction",
                    defaultMessage: "Action",
                  })}
                  value={values.requirements[index]?.actionUID ?? ""}
                  onChange={(event) =>
                    form.setValue(`requirements.${index}.actionUID`, event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  disabled={busy}
                >
                  <option value="">
                    {formatMessage({
                      id: "cockpit.garden.pool.seed.requirementChoose",
                      defaultMessage: "Choose an Action",
                    })}
                  </option>
                  {actions.map((action) => {
                    const uid = actionUIDOf(action.id, chainId);
                    const ended = hasActionEnded(action, now);
                    return uid === null ||
                      (ended && uid !== values.requirements[index]?.actionUID) ? null : (
                      <option key={action.id} value={uid} disabled={ended}>
                        {action.title}
                      </option>
                    );
                  })}
                </AdminSelect>
                <AdminTextField
                  label={formatMessage({
                    id: "cockpit.garden.pool.seed.requirementCount",
                    defaultMessage: "Count",
                  })}
                  value={String(values.requirements[index]?.requiredCount ?? 1)}
                  onChange={(event) =>
                    form.setValue(
                      `requirements.${index}.requiredCount`,
                      Number(event.target.value),
                      {
                        shouldDirty: true,
                        shouldValidate: true,
                      }
                    )
                  }
                  inputProps={{ inputMode: "numeric" }}
                  className="w-24"
                  disabled={busy}
                />
                {/* Lifted over the fields' reserved supporting line, so it lines up with them. */}
                <AdminButton
                  type="button"
                  variant="text"
                  size="sm"
                  className="mb-5"
                  aria-label={formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
                  onClick={() => requirements.remove(index)}
                  disabled={busy}
                >
                  <RiCloseLine className="h-4 w-4" />
                </AdminButton>
              </div>
            ))}
            <AdminButton
              type="button"
              variant="outlined"
              size="sm"
              leadingIcon={<RiAddLine className="h-4 w-4" />}
              onClick={() => requirements.append({ actionUID: "", requiredCount: 1 })}
              disabled={busy}
            >
              {formatMessage({
                id: "cockpit.garden.pool.seed.requirementAdd",
                defaultMessage: "Add Action",
              })}
            </AdminButton>
            {closedSeedActions(values, actions, chainId, now).map((action) => (
              <p key={action.id} className="body-xs text-error-dark" role="alert">
                {formatMessage(
                  {
                    id: "app.compose.blocked.closedAction",
                    defaultMessage:
                      "{action} has closed and can't take work any more. Remove it to continue.",
                  },
                  { action: action.title }
                )}
              </p>
            ))}
            {form.formState.errors.requirements?.message ? (
              <p className="body-xs text-error-dark">
                {String(form.formState.errors.requirements.message)}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="body-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.seed.proofOnlyPromise",
              defaultMessage:
                "This promise is confirmed by proof, so it has no garden-work action requirements.",
            })}
          </p>
        )}
      </fieldset>

      <SeedTotal
        count={count}
        each={values.targetUnits}
        unit={values.unitLabel}
        busy={busy}
        onMakeItOne={() => set("targetUnits", 1)}
      />
      {cap !== null ? (
        <p className="-mt-2 body-xs text-text-soft">
          {formatMessage(
            {
              id: "cockpit.garden.pool.seed.capHint",
              defaultMessage:
                "Each person can hold up to {cap} open promises in this pool at once. They can take up another after finishing one.",
            },
            { cap }
          )}
        </p>
      ) : null}
    </div>
  );
}
