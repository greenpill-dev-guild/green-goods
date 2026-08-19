import type { CommitmentComposerValues } from "@green-goods/shared";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";

export interface ComposeWhatProps {
  form: UseFormReturn<CommitmentComposerValues>;
}

/**
 * What is being counted, and how much of it.
 *
 * The unit stays in the member's own words. Nothing normalizes "hours" into
 * "Hours" or maps it onto a list, because the garden's own labels are what the
 * summaries are grouped by, and two spellings are two different things on
 * purpose rather than by accident.
 */
export function ComposeWhat({ form }: ComposeWhatProps) {
  const { formatMessage } = useIntl();
  const direction = form.watch("direction");
  const title = form.watch("title");
  const description = form.watch("description") ?? "";
  const unitLabel = form.watch("unitLabel");
  const targetUnits = form.watch("targetUnits");

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-medium text-text-strong-950">
        {formatMessage({
          id:
            direction === "REQUEST"
              ? "app.compose.what.legendRequest"
              : "app.compose.what.legendOffer",
        })}
      </h1>

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
            id:
              direction === "REQUEST"
                ? "app.compose.what.titlePlaceholderRequest"
                : "app.compose.what.titlePlaceholderOffer",
          })}
          onChange={(event) => form.setValue("title", event.target.value, { shouldValidate: true })}
          className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
        />
        <p className="mt-1.5 text-xs text-text-soft-400">
          {formatMessage({ id: "app.compose.what.titleHelp" })}
        </p>
      </div>

      <div>
        <label
          className="block text-sm font-medium text-text-strong-950"
          htmlFor="compose-description"
        >
          {formatMessage({ id: "app.compose.what.descriptionLabel" })}
        </label>
        <textarea
          id="compose-description"
          value={description}
          rows={3}
          maxLength={2000}
          placeholder={formatMessage({ id: "app.compose.what.descriptionPlaceholder" })}
          onChange={(event) =>
            form.setValue("description", event.target.value, { shouldValidate: true })
          }
          className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-strong-950" htmlFor="compose-units">
          {formatMessage({ id: "app.compose.what.countLabel" })}
        </label>
        <input
          id="compose-units"
          type="number"
          inputMode="numeric"
          min={1}
          value={Number.isFinite(targetUnits) ? targetUnits : ""}
          onChange={(event) =>
            form.setValue("targetUnits", Number(event.target.value), { shouldValidate: true })
          }
          className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-strong-950" htmlFor="compose-label">
          {formatMessage({ id: "app.compose.what.unitLabel" })}
        </label>
        <input
          id="compose-label"
          type="text"
          value={unitLabel}
          maxLength={40}
          placeholder={formatMessage({ id: "app.compose.what.unitPlaceholder" })}
          onChange={(event) =>
            form.setValue("unitLabel", event.target.value, { shouldValidate: true })
          }
          className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
        />
        <p className="mt-1.5 text-xs text-text-soft-400">
          {formatMessage({ id: "app.compose.what.unitHelp" })}
        </p>
      </div>
    </div>
  );
}
