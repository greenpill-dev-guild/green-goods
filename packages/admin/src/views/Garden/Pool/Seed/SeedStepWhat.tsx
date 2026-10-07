import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import {
  COMMITMENT_NOTE_MAX_LENGTH,
  COMMITMENT_TITLE_MAX_LENGTH,
} from "@green-goods/shared/modules/commitment-pooling/metadata";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminSelect, AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import { type SeedCycleOption, type SeedFieldError } from "./seedStepModel";

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
 * Step one: the season or campaign, the work type and direction, and the
 * words a member will read.
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
      <AdminSelect
        id={`${noteId}-cycle`}
        label={formatMessage({
          id: "cockpit.garden.pool.seed.contextQuestion",
          defaultMessage: "What does this commitment tie to?",
        })}
        value={values.cycleId}
        onChange={(event) => form.setValue("cycleId", event.target.value, { shouldDirty: true })}
        disabled={busy}
        error={errorOf("cycleId")}
      >
        {cycleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </AdminSelect>
      <Controller
        control={form.control}
        name="kind"
        render={({ field }) => (
          <fieldset className="space-y-2">
            <legend className="body-sm font-medium text-text-strong">
              {formatMessage({
                id: "cockpit.garden.pool.seed.workQuestion",
                defaultMessage: "What type of work is it?",
              })}
            </legend>
            <AdminChoiceGroup
              ariaLabel={formatMessage({
                id: "cockpit.garden.pool.seed.workQuestion",
                defaultMessage: "What type of work is it?",
              })}
              value={field.value}
              columns={2}
              onChange={(kind) => {
                field.onChange(kind);
                // Garden work is counted in hours; the actions are what is approved.
                if (kind === "GARDEN_WORK") {
                  form.setValue("unitLabel", "hours", { shouldDirty: true, shouldValidate: true });
                }
              }}
              options={[
                {
                  value: "SERVICE",
                  label: formatMessage({
                    id: "cockpit.garden.pool.seed.work.support",
                    defaultMessage: "Support",
                  }),
                  description: formatMessage({
                    id: "cockpit.garden.pool.seed.kind.serviceHint",
                    defaultMessage: "Kept by proof",
                  }),
                },
                {
                  value: "GARDEN_WORK",
                  label: formatMessage({
                    id: "cockpit.garden.pool.seed.work.gardenWork",
                    defaultMessage: "Garden work",
                  }),
                  description: formatMessage({
                    id: "cockpit.garden.pool.seed.kind.gardenWorkHint",
                    defaultMessage: "Kept by approved actions",
                  }),
                },
              ]}
            />
          </fieldset>
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
        showCount
        inputProps={{ maxLength: COMMITMENT_TITLE_MAX_LENGTH }}
      />
      <AdminTextArea
        id={noteId}
        label={formatMessage({ id: "cockpit.garden.pool.seed.note", defaultMessage: "Note" })}
        value={values.note ?? ""}
        onChange={(event) => form.setValue("note", event.target.value, { shouldDirty: true })}
        error={errorOf("note")}
        rows={3}
        disabled={busy}
        showCount
        textareaProps={{ maxLength: COMMITMENT_NOTE_MAX_LENGTH }}
      />
    </div>
  );
}
