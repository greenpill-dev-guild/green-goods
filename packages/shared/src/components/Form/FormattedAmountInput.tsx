import { useId, useMemo, type InputHTMLAttributes, type ReactNode } from "react";
import { parseUnits } from "viem";

import { validateDecimalInput } from "../../utils/blockchain/vaults";
import { cn } from "../../utils/styles/cn";

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
  /** Trailing control beside the input — typically a Max button or symbol. */
  endSlot?: ReactNode;
  /**
   * Styling stays with the consumer (client/admin utility classes compile in
   * their own package scans; shared must not author utilities). The component
   * owns only structure + a11y wiring.
   */
  inputClassName?: string;
  errorClassName?: string;
  containerClassName?: string;
}

/**
 * Structural amount input: `inputMode="decimal"` text input + optional end
 * slot + an `aria-describedby`-linked error region. Visuals come entirely from
 * the consumer's classes so adoption is pixel-identical per surface.
 */
export function FormattedAmountInput({
  value,
  onValueChange,
  error,
  endSlot,
  inputClassName,
  errorClassName,
  containerClassName,
  id,
  "aria-invalid": ariaInvalid,
  ...inputProps
}: FormattedAmountInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorRegionId = `${inputId}-error`;

  return (
    <div data-component="FormattedAmountInput" className={containerClassName}>
      <div className="flex items-center gap-2">
        <input
          {...inputProps}
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={ariaInvalid ?? (error ? true : undefined)}
          aria-describedby={error ? errorRegionId : (inputProps["aria-describedby"] ?? undefined)}
          className={inputClassName}
        />
        {endSlot}
      </div>
      {error ? (
        <p id={errorRegionId} role="alert" className={cn(errorClassName)}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

FormattedAmountInput.displayName = "FormattedAmountInput";
