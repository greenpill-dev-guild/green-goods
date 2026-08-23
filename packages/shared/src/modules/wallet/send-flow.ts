import type { SendableTokenBalance } from "../../hooks/blockchain/useSendableTokens";
import type { Address } from "../../types";
import { validateDecimalInput } from "../../utils";
import type { GardenRole } from "../../utils/blockchain/garden-roles";
import { parseUnits } from "viem";

export type WalletMode = "balance" | "send" | "receive";
export type SendStep = "recipient" | "amount" | "review";
export type RecipientSource = "garden" | "recent" | "manual" | "ens" | "qr";

export interface SelectedRecipient {
  address: Address;
  source: RecipientSource;
  ensName?: string;
  roles?: GardenRole[];
  gardenName?: string;
}

export interface AmountValidation {
  parsedAmount: bigint;
  formatErrorId: string | null;
  insufficient: boolean;
  valid: boolean;
}

export interface SendFlowState {
  mode: WalletMode;
  step: SendStep;
  recipient: SelectedRecipient | null;
  selectedToken: SendableTokenBalance | null;
  amountInput: string;
  note: string;
  showConfirm: boolean;
}

export type SendFlowEvent =
  | { type: "select-mode"; mode: WalletMode }
  | { type: "select-recipient"; recipient: SelectedRecipient }
  | { type: "select-token"; token: SendableTokenBalance | null }
  | { type: "change-amount"; amount: string }
  | { type: "change-note"; note: string }
  | { type: "advance" }
  | { type: "back" }
  | { type: "edit-recipient" }
  | { type: "edit-amount" }
  | { type: "open-confirm" }
  | { type: "close-confirm" }
  | { type: "start-send"; token: SendableTokenBalance }
  | { type: "reset-tab" }
  | { type: "reset-after-send" };

export const initialSendFlowState: SendFlowState = {
  mode: "balance",
  step: "recipient",
  recipient: null,
  selectedToken: null,
  amountInput: "",
  note: "",
  showConfirm: false,
};

export function sendFlowReducer(state: SendFlowState, event: SendFlowEvent): SendFlowState {
  switch (event.type) {
    case "select-mode":
      return { ...state, mode: event.mode };
    case "select-recipient":
      return { ...state, recipient: event.recipient, step: "amount" };
    case "select-token":
      return { ...state, selectedToken: event.token };
    case "change-amount":
      return { ...state, amountInput: event.amount };
    case "change-note":
      return { ...state, note: event.note };
    case "advance":
      return state.step === "recipient"
        ? { ...state, step: "amount" }
        : state.step === "amount"
          ? { ...state, step: "review" }
          : state;
    case "back":
      return state.step === "review"
        ? { ...state, step: "amount" }
        : state.step === "amount"
          ? { ...state, step: "recipient" }
          : state;
    case "edit-recipient":
      return { ...state, step: "recipient" };
    case "edit-amount":
      return { ...state, step: "amount" };
    case "open-confirm":
      return { ...state, showConfirm: true };
    case "close-confirm":
      return { ...state, showConfirm: false };
    case "start-send":
      return { ...state, mode: "send", step: "recipient", selectedToken: event.token };
    case "reset-tab":
      return { ...state, mode: "balance", step: "recipient", showConfirm: false };
    case "reset-after-send":
      return initialSendFlowState;
  }
}

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
  if (formatErrorId || !amountInput.trim()) return { ...empty, formatErrorId };

  let parsedAmount = 0n;
  try {
    parsedAmount = parseUnits(amountInput, token.decimals);
  } catch {
    return empty;
  }

  const insufficient = parsedAmount > (token.balance ?? 0n);
  return {
    parsedAmount,
    formatErrorId: null,
    insufficient,
    valid: parsedAmount > 0n && !insufficient && token.supported,
  };
}
