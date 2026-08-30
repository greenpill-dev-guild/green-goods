import type { Action } from "@green-goods/shared/types/domain";
import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import { Controller, type UseFieldArrayReturn, type UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminSelect, AdminTextField } from "@/components/AdminTextField";
import { actionUIDOf, type SeedFieldError } from "./seedStepModel";

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
}

/**
 * Step two of the seeding console: the unit and target, when it is due, who may
 * contribute, and — for garden work — the approved actions it is kept by.
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
}: SeedStepHowMuchProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminTextField
          label={formatMessage({ id: "cockpit.garden.pool.seed.unit", defaultMessage: "Unit" })}
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
        />
        <AdminTextField
          label={formatMessage({
            id: "cockpit.garden.pool.seed.target",
            defaultMessage: "Target",
          })}
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
        <AdminTextField
          label={formatMessage({
            id: "cockpit.garden.pool.seed.dueInDays",
            defaultMessage: "Due in (days)",
          })}
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
          <p className="label-md text-text-strong">
            {formatMessage({
              id: "cockpit.garden.pool.seed.requirements",
              defaultMessage: "Actions this needs",
            })}
          </p>
          <p className="text-xs text-text-soft">
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
                    defaultMessage: "Choose an action",
                  })}
                </option>
                {actions.map((action) => {
                  const uid = actionUIDOf(action.id, chainId);
                  return uid === null ? null : (
                    <option key={action.id} value={uid}>
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
              defaultMessage: "Add action",
            })}
          </AdminButton>
          {form.formState.errors.requirements?.message ? (
            <p className="text-xs text-[rgb(var(--m3-error))]">
              {String(form.formState.errors.requirements.message)}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-text-soft">
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
