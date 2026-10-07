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
      <fieldset className="space-y-2" disabled={busy}>
        <legend className="body-sm font-semibold text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.seed.kind.prompt",
            defaultMessage: "How will this promise be completed?",
          })}
        </legend>
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <AdminChoiceGroup
              ariaLabel={formatMessage({
                id: "cockpit.garden.pool.seed.kind.prompt",
                defaultMessage: "How will this promise be completed?",
              })}
              value={field.value}
              onChange={(kind) => {
                field.onChange(kind);
                // Garden work is counted in hours; the actions are what is approved.
                if (kind === "GARDEN_WORK") {
                  form.setValue("unitLabel", "hours", { shouldDirty: true, shouldValidate: true });
                }
              }}
              options={[
                {
                  value: "SEASON_CAMPAIGN",
                  label: formatMessage({
                    id: "cockpit.garden.pool.seed.kind.seasonCampaign",
                    defaultMessage: "Season / campaign commitment",
                  }),
                  description: formatMessage({
                    id: "cockpit.garden.pool.seed.kind.seasonCampaignHint",
                    defaultMessage: "Proof of a season or campaign promise",
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
                    defaultMessage: "Proof of the support or service delivered",
                  }),
                },
                {
                  value: "GARDEN_WORK",
                  label: formatMessage({
                    id: "cockpit.garden.pool.seed.kind.gardenWork",
                    defaultMessage: "Garden work",
                  }),
                  description: formatMessage({
                    id: "cockpit.garden.pool.seed.kind.gardenWorkHint",
                    defaultMessage: "Linked work approved by garden stewards",
                  }),
                },
              ]}
            />
          )}
        />
      </fieldset>
      <fieldset className="space-y-2" disabled={busy}>
        <legend className="body-sm font-semibold text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.seed.direction",
            defaultMessage: "What is the pool doing?",
          })}
        </legend>
        <Controller
          control={form.control}
          name="direction"
          render={({ field }) => (
            <AdminChoiceGroup
              ariaLabel={formatMessage({
                id: "cockpit.garden.pool.seed.direction",
                defaultMessage: "What is the pool doing?",
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
      </fieldset>
      <AdminSelect
        id={`${noteId}-cycle`}
        label={formatMessage({ id: "cockpit.garden.pool.seed.cycle", defaultMessage: "Cycle" })}
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
