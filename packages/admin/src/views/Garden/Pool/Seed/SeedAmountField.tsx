import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminTextField } from "@/components/AdminTextField";
import {
  type RewardUnits,
  rewardAmountFromBaseUnits,
  rewardAmountToBaseUnits,
} from "./seedRewardAmount";

export interface SeedAmountFieldProps {
  form: UseFormReturn<CommitmentComposerValues>;
  /** The stored amount, in the token's base units, as the contract records it. */
  value: string;
  /** The units the amount is typed in; while they are unknown the field waits. */
  units: RewardUnits;
  /** The schema's own error for the stored amount (missing, zero). */
  error?: string;
  disabled: boolean;
}

/**
 * The declared reward's amount, typed in the token's own units (10 G$, not
 * 10 × 10¹⁸) and stored as its base units. A prefilled amount appears once its
 * units are known. When the token changes, the typed amount keeps its meaning
 * and is converted again.
 */
export function SeedAmountField({ form, value, units, error, disabled }: SeedAmountFieldProps) {
  const { formatMessage } = useIntl();
  const decimals = units.status === "ready" ? units.decimals : null;
  const [entry, setEntry] = useState(() => ({
    text: decimals === null ? "" : rewardAmountFromBaseUnits(value, decimals),
    decimals,
  }));
  const [formatErrorId, setFormatErrorId] = useState<string | null>(null);
  const written = useRef(value);

  const write = (baseUnits: string) => {
    if (baseUnits === written.current) return;
    written.current = baseUnits;
    form.setValue("considerationAmount", baseUnits, { shouldDirty: true, shouldValidate: true });
  };

  useEffect(() => {
    if (decimals === null) return;
    if (value !== written.current) {
      // Set from outside (a prefill, a restart): show what is stored.
      written.current = value;
      setEntry({ text: rewardAmountFromBaseUnits(value, decimals), decimals });
      setFormatErrorId(null);
      return;
    }
    if (entry.decimals === decimals) return;
    if (entry.decimals === null) {
      // The units have just arrived: show the stored amount in them.
      setEntry({ text: rewardAmountFromBaseUnits(value, decimals), decimals });
      return;
    }
    // A different token: what was typed keeps its meaning in the new units.
    const converted = rewardAmountToBaseUnits(entry.text, decimals);
    setEntry({ text: entry.text, decimals });
    setFormatErrorId(converted.errorId);
    write(converted.baseUnits);
    // `write` only touches the form and the ref, both stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, entry]);

  const label =
    units.status === "ready" && units.symbol
      ? formatMessage(
          { id: "cockpit.garden.pool.seed.rewardAmount", defaultMessage: "Amount ({symbol})" },
          { symbol: units.symbol }
        )
      : formatMessage({
          id: "cockpit.garden.pool.seed.rewardAmountPlain",
          defaultMessage: "Amount",
        });

  const waiting =
    units.status === "waiting"
      ? units.reason === "noToken"
        ? formatMessage({
            id: "cockpit.garden.pool.seed.rewardTokenFirst",
            defaultMessage: "Enter the token address first.",
          })
        : units.reason === "loading"
          ? formatMessage({
              id: "cockpit.garden.pool.seed.rewardTokenReading",
              defaultMessage: "Reading the token…",
            })
          : formatMessage({
              id: "cockpit.garden.pool.seed.rewardTokenUnreadable",
              defaultMessage:
                "This token's units could not be read, so an amount cannot be entered safely. Check the token address.",
            })
      : undefined;

  return (
    <AdminTextField
      label={label}
      value={entry.text}
      onChange={(event) => {
        if (decimals === null) return;
        const converted = rewardAmountToBaseUnits(event.target.value, decimals);
        setEntry({ text: event.target.value, decimals });
        setFormatErrorId(converted.errorId);
        write(converted.baseUnits);
      }}
      error={formatErrorId ? formatMessage({ id: formatErrorId }) : error}
      helperText={waiting}
      inputProps={{ inputMode: "decimal" }}
      disabled={disabled || decimals === null}
    />
  );
}
