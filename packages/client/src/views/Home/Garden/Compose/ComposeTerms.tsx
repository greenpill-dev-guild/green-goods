import type { CommitmentComposerValues } from "@green-goods/shared";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";

export interface ComposeTermsProps {
  form: UseFormReturn<CommitmentComposerValues>;
}

const DAY_CHOICES = [7, 14, 30];

/**
 * When it ends, and what happens if nobody local can confirm it.
 *
 * Both are consequences rather than settings, so both say what they do. An end
 * date is what lets a commitment lapse instead of sitting open forever, and the
 * fallback is structural: a small garden may simply have nobody eligible to
 * confirm, and without it that commitment could never be kept.
 */
export function ComposeTerms({ form }: ComposeTermsProps) {
  const { formatMessage } = useIntl();
  const dueInDays = form.watch("dueInDays");
  const openTeam = form.watch("openTeam");
  const protocolFallbackEnabled = form.watch("protocolFallbackEnabled");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-text-strong-950">
        {formatMessage({ id: "app.compose.terms.legend" })}
      </h1>

      <fieldset>
        <legend className="text-sm font-medium text-text-strong-950">
          {formatMessage({ id: "app.compose.terms.byWhen" })}
        </legend>
        <div className="mt-2 flex gap-2">
          {DAY_CHOICES.map((days) => {
            const selected = dueInDays === days;
            return (
              <button
                key={days}
                type="button"
                aria-pressed={selected}
                onClick={() => form.setValue("dueInDays", days, { shouldValidate: true })}
                className={
                  selected
                    ? "rounded-full border border-primary-alpha-24 bg-primary-alpha-10 px-3 py-1.5 text-xs font-medium text-primary tap-target"
                    : "rounded-full border border-stroke-soft-200 px-3 py-1.5 text-xs font-medium text-text-sub-600 tap-target"
                }
              >
                {formatMessage({ id: "app.compose.terms.days" }, { count: days })}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-text-soft-400">
          {formatMessage({ id: "app.compose.terms.byWhenHelp" })}
        </p>
      </fieldset>

      <Toggle
        id="compose-open-team"
        checked={openTeam}
        onChange={(next) => form.setValue("openTeam", next)}
        label={formatMessage({ id: "app.compose.terms.openTeam" })}
        help={formatMessage({ id: "app.compose.terms.openTeamHelp" })}
      />

      <Toggle
        id="compose-fallback"
        checked={protocolFallbackEnabled}
        onChange={(next) => form.setValue("protocolFallbackEnabled", next)}
        label={formatMessage({ id: "app.compose.terms.fallback" })}
        help={formatMessage({ id: "app.compose.terms.fallbackHelp" })}
      />
    </div>
  );
}

function Toggle({
  id,
  checked,
  onChange,
  label,
  help,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  help: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="min-w-0">
        <label className="block text-sm font-medium text-text-strong-950" htmlFor={id}>
          {label}
        </label>
        <span className="mt-0.5 block text-xs text-text-sub-600">{help}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
      />
    </div>
  );
}
