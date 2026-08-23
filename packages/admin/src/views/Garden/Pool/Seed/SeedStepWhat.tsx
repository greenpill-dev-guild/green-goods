import type { CommitmentComposerValues } from "@green-goods/shared";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminTextField } from "@/components/AdminTextField";
import { SELECT_CLASS, type SeedCycleOption, type SeedFieldError } from "./seedStepModel";

export interface SeedStepWhatProps {
  form: UseFormReturn<CommitmentComposerValues>;
  values: CommitmentComposerValues;
  /** Field ids are derived from the dialog's one useId, so labels stay unique. */
  noteId: string;
  busy: boolean;
  errorOf: SeedFieldError;
  cycleOptions: SeedCycleOption[];
}

/**
 * Step one of the seeding console: the kind of commitment, its direction, the
 * cycle it belongs to, and the words a member will read.
 */
export function SeedStepWhat({
  form,
  values,
  noteId,
  busy,
  errorOf,
  cycleOptions,
}: SeedStepWhatProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <Controller
        control={form.control}
        name="kind"
        render={({ field }) => (
          <AdminChoiceGroup
            ariaLabel={formatMessage({
              id: "cockpit.garden.pool.seed.kind",
              defaultMessage: "Type",
            })}
            value={field.value}
            onChange={field.onChange}
            options={[
              {
                value: "SEASON_CAMPAIGN",
                label: formatMessage({
                  id: "cockpit.garden.pool.seed.kind.seasonCampaign",
                  defaultMessage: "Season / campaign commitment",
                }),
                description: formatMessage({
                  id: "cockpit.garden.pool.seed.kind.seasonCampaignHint",
                  defaultMessage: "The pool offers or requests",
                }),
              },
              {
                value: "SERVICE",
                label: formatMessage({
                  id: "cockpit.garden.pool.seed.kind.service",
                  defaultMessage: "Support / service",
                }),
                description: formatMessage({
                  id: "cockpit.garden.pool.seed.kind.serviceHint",
                  defaultMessage: "Kept by proof",
                }),
              },
              {
                value: "GARDEN_WORK",
                label: formatMessage({
                  id: "cockpit.garden.pool.seed.kind.gardenWork",
                  defaultMessage: "Garden work (impact)",
                }),
                description: formatMessage({
                  id: "cockpit.garden.pool.seed.kind.gardenWorkHint",
                  defaultMessage: "Kept by approved actions",
                }),
              },
            ]}
          />
        )}
      />
      <Controller
        control={form.control}
        name="direction"
        render={({ field }) => (
          <AdminChoiceGroup
            ariaLabel={formatMessage({
              id: "cockpit.garden.pool.seed.direction",
              defaultMessage: "Direction",
            })}
            value={field.value}
            onChange={field.onChange}
            columns={2}
            options={[
              {
                value: "OFFER",
                label: formatMessage({
                  id: "cockpit.garden.pool.seed.direction.offer",
                  defaultMessage: "The pool offers",
                }),
              },
              {
                value: "REQUEST",
                label: formatMessage({
                  id: "cockpit.garden.pool.seed.direction.request",
                  defaultMessage: "The pool requests",
                }),
              },
            ]}
          />
        )}
      />
      <div className="space-y-1.5">
        <label htmlFor={`${noteId}-cycle`} className="label-md block text-text-strong">
          {formatMessage({ id: "cockpit.garden.pool.seed.cycle", defaultMessage: "Cycle" })}
        </label>
        <select
          id={`${noteId}-cycle`}
          className={SELECT_CLASS}
          value={values.cycleId}
          onChange={(event) => form.setValue("cycleId", event.target.value, { shouldDirty: true })}
          disabled={busy}
        >
          {cycleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errorOf("cycleId") ? (
          <p className="text-xs text-[rgb(var(--m3-error))]">{errorOf("cycleId")}</p>
        ) : null}
      </div>
      <AdminTextField
        label={formatMessage({
          id: "cockpit.garden.pool.seed.titleField",
          defaultMessage: "Title",
        })}
        value={values.title}
        onChange={(event) =>
          form.setValue("title", event.target.value, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        error={errorOf("title")}
        disabled={busy}
        required
      />
      <div className="space-y-1.5">
        <label htmlFor={noteId} className="label-md block text-text-strong">
          {formatMessage({ id: "cockpit.garden.pool.seed.note", defaultMessage: "Note" })}
        </label>
        <textarea
          id={noteId}
          value={values.note ?? ""}
          onChange={(event) => form.setValue("note", event.target.value, { shouldDirty: true })}
          rows={3}
          maxLength={2000}
          disabled={busy}
          className={`${SELECT_CLASS} resize-y`}
        />
      </div>
    </div>
  );
}
