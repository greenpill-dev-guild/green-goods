import type { Address } from "../../types/domain";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { ZERO_ADDRESS } from "../../utils/blockchain/vaults";

export function getOctantModuleAddress(chainId: number): Address {
  const moduleAddress = getNetworkContracts(chainId).octantModule;
  if (!moduleAddress || moduleAddress.toLowerCase() === ZERO_ADDRESS) {
    throw new Error("OctantModule is not configured for the current chain");
  }
  return moduleAddress as Address;
}

export function isRecoverableAllowanceReadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("revert") ||
    message.includes("execution reverted") ||
    message.includes("contractfunctionexecutionerror") ||
    message.includes("call_exception")
  );
}

export type VaultDepositStage = "approval" | "deposit";
export type VaultDepositFailureReason =
  | "vaultShutdown"
  | "depositLimitZero"
  | "depositLimitReached"
  | "vaultUnavailable"
  | "slippage";
export type TxErrorMode = "toast" | "inline" | "auto";

export interface VaultMutationOptions {
  errorMode?: TxErrorMode;
}

export function shouldShowErrorToast(mode: TxErrorMode = "auto"): boolean {
  return mode !== "inline";
}

export class VaultDepositStageError extends Error {
  stage: VaultDepositStage;
  reason?: VaultDepositFailureReason;
  diagnostics?: Record<string, string>;

  constructor(stage: VaultDepositStage, message: string, reason?: VaultDepositFailureReason) {
    super(message);
    this.name = "VaultDepositStageError";
    this.stage = stage;
    this.reason = reason;
  }
}
