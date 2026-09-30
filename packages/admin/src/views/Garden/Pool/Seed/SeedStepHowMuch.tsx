import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
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
import { actionUIDOf, closedSeedActions, type SeedFieldError } from "./seedStepModel";

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
}

/**
 * Step two of the seeding console: the unit and target, when it is due, who may
 * contribute, and — for garden work — the approved actions it is kept by.
 * Each field keeps its free entry under the member composer's suggestions, and
 * garden work is counted in hours, so it states the unit instead of asking.
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
}: SeedStepHowMuchProps) {
  const { formatMessage } = useIntl();
  const isGardenWork = values.kind === "GARDEN_WORK";
  const set = (field: "unitLabel" | "targetUnits" | "dueInDays", value: string | number) =>
    form.setValue(field, value as never, { shouldDirty: true, shouldValidate: true });
  const unitLabelText = formatMessage({
    id: "cockpit.garden.pool.seed.unit",
    defaultMessage: "Unit",
  });
  const targetText = formatMessage({
    id: "cockpit.garden.pool.seed.target",
    defaultMessage: "Target",
  });
  const suggestionsFor = (field: string) =>
    formatMessage(
      { id: "cockpit.garden.pool.seed.suggestionsFor", defaultMessage: "Suggestions for {field}" },
      { field }
    );
  const dueText = formatMessage({
    id: "cockpit.garden.pool.seed.dueInDays",
    defaultMessage: "Due in (days)",
  });

  return (
    <div className="space-y-4">
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
              const label = formatMessage({ id: `app.compose.unit.${unit}`, defaultMessage: unit });
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
            onChange={(event) =>
              form.setValue("unitLabel", event.target.value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            error={errorOf("unitLabel")}
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
            aria-label={suggestionsFor(targetText)}
          >
            {(isGardenWork ? COMMITMENT_HOUR_CHOICES : COMMITMENT_COUNT_CHOICES).map((count) => (
              <AdminFilterChip
                key={count}
                label={String(count)}
                selected={values.targetUnits === count}
                onToggle={() => set("targetUnits", count)}
                disabled={busy}
              />
            ))}
          </div>
          <AdminTextField
            label={targetText}
            value={String(values.targetUnits)}
            onChange={(event) =>
              form.setValue("targetUnits", Number(event.target.value), {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            error={errorOf("targetUnits")}
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
            onChange={(event) =>
              form.setValue("dueInDays", Number(event.target.value), {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            error={errorOf("dueInDays")}
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
      {values.kind === "GARDEN_WORK" ? (
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
                  form.setValue(`requirements.${index}.requiredCount`, Number(event.target.value), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                inputProps={{ inputMode: "numeric" }}
                className="w-24"
                disabled={busy}
              />
              <AdminButton
                type="button"
                variant="text"
                size="sm"
                aria-label={formatMessage({
                  id: "app.common.remove",
                  defaultMessage: "Remove",
                })}
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
            id: "cockpit.garden.pool.seed.proofOnly",
            defaultMessage:
              "This commitment is confirmed by proof, so it has no garden-work action requirements.",
          })}
        </p>
      )}
    </div>
  );
}
