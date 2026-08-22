import { useIntl } from "react-intl";
import { AdminTextField } from "@/components/AdminTextField";

export interface SetupStepHowProps {
  purposeId: string;
  purpose: string;
  onPurposeChange: (value: string) => void;
  cap: string;
  onCapChange: (value: string) => void;
  disabled: boolean;
}

/** Step one of first-run setup: the agreement and the per-person commitment limit. */
export function SetupStepHow({
  purposeId,
  purpose,
  onPurposeChange,
  cap,
  onCapChange,
  disabled,
}: SetupStepHowProps) {
  const { formatMessage } = useIntl();
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={purposeId} className="label-md block text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.settings.purpose",
            defaultMessage: "What this pool is for",
          })}
          <span aria-hidden="true" className="ml-0.5 text-[rgb(var(--m3-error))]">
            *
          </span>
        </label>
        <textarea
          id={purposeId}
          value={purpose}
          onChange={(event) => onPurposeChange(event.target.value)}
          rows={4}
          maxLength={2000}
          required
          disabled={disabled}
          placeholder={formatMessage({
            id: "cockpit.garden.pool.setup.purposePlaceholder",
            defaultMessage:
              "Neighbours offer help and ask for it: rides, tools, workshops, garden work. Commitments are kept in the open and confirmed by the person they were made to.",
          })}
          className="w-full resize-y rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container-highest))] px-3 py-2 text-body-md text-[rgb(var(--m3-on-surface))] ring-1 ring-inset ring-[rgb(var(--m3-outline-variant))] placeholder:text-[rgb(var(--m3-on-surface-variant))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] disabled:opacity-[0.38]"
        />
      </div>
      <AdminTextField
        label={formatMessage({
          id: "cockpit.garden.pool.settings.cap",
          defaultMessage: "How many commitments one person can hold at once",
        })}
        value={cap}
        onChange={(event) => onCapChange(event.target.value)}
        helperText={formatMessage({
          id: "cockpit.garden.pool.settings.capHelp",
          defaultMessage: "A safety limit so nobody over-commits. 24 suits most gardens.",
        })}
        inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
        disabled={disabled}
        required
      />
      <p className="text-xs text-text-soft">
        {formatMessage({
          id: "cockpit.garden.pool.setup.baselineNote",
          defaultMessage:
            "A starting assessment from the Hub helps the season's report later; nothing here waits on it.",
        })}
      </p>
    </div>
  );
}
