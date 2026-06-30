import { type SendableTokenBalance, validateDecimalInput } from "@green-goods/shared";
import { parseUnits } from "viem";

export interface AmountValidation {
  /** Parsed base-unit amount (0n when invalid). */
  parsedAmount: bigint;
  /** i18n id for a format error, or null. */
  formatErrorId: string | null;
  /** True when the parsed amount exceeds the token balance. */
  insufficient: boolean;
  /** True when the amount is a valid, affordable, sendable value. */
  valid: boolean;
}

/**
 * Validate a send amount against the selected token. Shared by `AmountStep`
 * (for inline error display) and `SendTab` (for the action-bar enabled state).
 */
export function validateSendAmount(
  token: SendableTokenBalance | null,
  amountInput: string
): AmountValidation {
  const empty: AmountValidation = {
    parsedAmount: 0n,
    formatErrorId: null,
    insufficient: false,
    valid: false,
  };
  if (!token) return empty;

  const formatErrorId = validateDecimalInput(amountInput, token.decimals) || null;
  if (formatErrorId || !amountInput.trim()) {
    return { ...empty, formatErrorId };
  }

  let parsedAmount = 0n;
  try {
    parsedAmount = parseUnits(amountInput, token.decimals);
  } catch {
    return empty;
  }

  const balance = token.balance ?? 0n;
  const insufficient = parsedAmount > balance;
  const valid = parsedAmount > 0n && !insufficient && token.supported;
  return { parsedAmount, formatErrorId: null, insufficient, valid };
}
