import { useIntl } from "react-intl";
import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";

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
      <AdminTextArea
        id={purposeId}
        label={formatMessage({
          id: "cockpit.garden.pool.settings.purpose",
          defaultMessage: "What this pool is for",
        })}
        value={purpose}
        onChange={(event) => onPurposeChange(event.target.value)}
        rows={4}
        required
        disabled={disabled}
        placeholder={formatMessage({
          id: "cockpit.garden.pool.setup.purposePlaceholder",
          defaultMessage:
            "Neighbours offer help and ask for it: rides, tools, workshops, garden work. Commitments are kept in the open and confirmed by the person they were made to.",
        })}
        textareaProps={{ maxLength: 2000 }}
      />
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
