import {
  useId,
  useMemo,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { parseUnits } from "viem";

import { validateDecimalInput } from "../../utils/blockchain/vaults";
import { cn } from "../../utils/styles/cn";

const amountInputRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

export interface FormattedAmountState {
  /** Parsed base-unit amount, or null while empty/invalid. */
  parsedAmount: bigint | null;
  /** i18n id for a format error, or null when the input parses (or is empty). */
  formatErrorId: string | null;
  /** True when the parsed amount exceeds `maxAmount` (when one is given). */
  exceeds: boolean;
  /** True when the input is blank. */
  isEmpty: boolean;
}

/**
 * The one decimal-amount parse/validate pipeline behind every funding flow
 * (send, cookie-jar withdraw, donate, claim, endow). Folds together
 * `validateDecimalInput` + viem `parseUnits` so call sites stop re-implementing
 * the same three-step memo. Flows keep their own gating on top (balances,
 * minimums, eligibility) — this owns only "is the typed string a usable
 * amount".
 */
export function useFormattedAmountInput(
  value: string,
  decimals: number,
  maxAmount?: bigint
): FormattedAmountState {
  return useMemo(() => {
    const trimmed = value.trim();
    const isEmpty = trimmed.length === 0;
    const formatErrorId = validateDecimalInput(value, decimals);
    if (isEmpty || formatErrorId) {
      return { parsedAmount: null, formatErrorId, exceeds: false, isEmpty };
    }

    let parsedAmount: bigint;
    try {
      parsedAmount = parseUnits(trimmed, decimals);
    } catch {
      return {
        parsedAmount: null,
        formatErrorId: "app.treasury.invalidAmount",
        exceeds: false,
        isEmpty,
      };
    }

    const exceeds = maxAmount !== undefined && parsedAmount > maxAmount;
    return { parsedAmount, formatErrorId: null, exceeds, isEmpty };
  }, [value, decimals, maxAmount]);
}

export interface FormattedAmountInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string;
  /** Receives the raw input string (call sites keep their own state). */
  onValueChange: (value: string) => void;
  /**
   * Resolved error content (the consumer owns intl and message selection —
   * format errors, minimums, exceeds-balance, etc.). When present the input is
   * marked invalid and described by the error region.
   */
  error?: ReactNode;
  /** Leading content before the input — typically a currency symbol. */
  startSlot?: ReactNode;
  /** Trailing control beside the input — typically a Max button or symbol. */
  endSlot?: ReactNode;
  /**
   * Without `inputClassName` the input is the shared field (`.gg-control`, 16px,
   * DL-022) at `controlSize` on `surface`. Passing `inputClassName` keeps the
   * older consumer-styled input for call sites that have not moved yet.
   */
  inputClassName?: string;
  controlSize?: "sm" | "md" | "lg";
  surface?: "default" | "editorial";
  errorClassName?: string;
  containerClassName?: string;
}

/**
 * Structural amount input: `inputMode="decimal"` text input + optional start and
 * end slots + an `aria-describedby`-linked error region. The input is the shared
 * field unless the consumer still passes its own `inputClassName`.
 */
export function FormattedAmountInput({
  value,
  onValueChange,
  error,
  startSlot,
  endSlot,
  inputClassName,
  controlSize = "md",
  surface = "default",
  errorClassName,
  containerClassName,
  id,
  "aria-invalid": ariaInvalid,
  ...inputProps
}: FormattedAmountInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorRegionId = `${inputId}-error`;
  const invalid = ariaInvalid ?? (error ? true : undefined);
  const sharedField = inputClassName === undefined;

  return (
    <div data-component="FormattedAmountInput" className={containerClassName}>
      <div style={amountInputRowStyle}>
        {startSlot}
        <input
          {...inputProps}
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={error ? errorRegionId : (inputProps["aria-describedby"] ?? undefined)}
          className={sharedField ? "gg-control" : inputClassName}
          data-surface={sharedField ? surface : undefined}
          data-size={sharedField ? controlSize : undefined}
          data-invalid={sharedField && (invalid === true || invalid === "true") ? true : undefined}
        />
        {endSlot}
      </div>
      <p
        id={errorRegionId}
        role={error ? "alert" : undefined}
        tabIndex={error ? 0 : undefined}
        className={cn(errorClassName)}
        style={{
          minBlockSize: "var(--form-feedback-block-size, 2lh)",
          flexShrink: 0,
          overflowWrap: "anywhere",
        }}
      >
        {error}
      </p>
    </div>
  );
}

FormattedAmountInput.displayName = "FormattedAmountInput";
