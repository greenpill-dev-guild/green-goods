import { getAccount, switchChain, type Config } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getChainName } from "../../config/chains";

const USER_REJECTED_REQUEST = 4001;
const REQUEST_ALREADY_PENDING = -32002;
const UNKNOWN_CHAIN = 4902;

type SwitchChainFn = (params: { chainId: number }) => Promise<unknown>;

export type EnsureWalletChainOptions = {
  targetChainId?: number;
  walletChainId?: number;
  isConnected: boolean;
  switchChain?: SwitchChainFn;
};

export class WalletChainMismatchError extends Error {
  readonly targetChainId: number;
  readonly walletChainId?: number;

  constructor(params: {
    targetChainId: number;
    walletChainId?: number;
    message?: string;
    cause?: unknown;
  }) {
    const targetName = getChainName(params.targetChainId);
    const currentName =
      typeof params.walletChainId === "number" ? getChainName(params.walletChainId) : "Unknown";
    super(
      params.message ??
        `Wrong wallet network. Switch your wallet to ${targetName} before continuing. Current wallet network: ${currentName}.`
    );
    this.name = "WalletChainMismatchError";
    this.targetChainId = params.targetChainId;
    this.walletChainId = params.walletChainId;
    if (params.cause !== undefined) this.cause = params.cause;
  }
}

function extractErrorCode(error: unknown): number | string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const err = error as {
    code?: unknown;
    cause?: unknown;
    error?: unknown;
    data?: { originalError?: { code?: unknown } };
  };

  if (typeof err.code === "number" || typeof err.code === "string") return err.code;
  if (typeof err.data?.originalError?.code === "number") return err.data.originalError.code;
  return extractErrorCode(err.cause ?? err.error);
}

function createSwitchChainError(
  error: unknown,
  targetChainId: number,
  walletChainId?: number
): WalletChainMismatchError {
  const code = extractErrorCode(error);
  const targetName = getChainName(targetChainId);

  if (code === USER_REJECTED_REQUEST) {
    return new WalletChainMismatchError({
      targetChainId,
      walletChainId,
      message: `Network switch rejected. Approve the wallet prompt to switch to ${targetName} before continuing.`,
      cause: error,
    });
  }

  if (code === REQUEST_ALREADY_PENDING) {
    return new WalletChainMismatchError({
      targetChainId,
      walletChainId,
      message: `Network switch already pending. Open your wallet and approve the switch to ${targetName}.`,
      cause: error,
    });
  }

  if (code === UNKNOWN_CHAIN) {
    return new WalletChainMismatchError({
      targetChainId,
      walletChainId,
      message: `Wallet network is missing. Add ${targetName} in your wallet, then switch networks and try again.`,
      cause: error,
    });
  }

  return new WalletChainMismatchError({ targetChainId, walletChainId, cause: error });
}

export async function ensureWalletChain({
  targetChainId = DEFAULT_CHAIN_ID,
  walletChainId,
  isConnected,
  switchChain: switchWalletChain,
}: EnsureWalletChainOptions): Promise<void> {
  if (!isConnected) return;
  if (walletChainId === targetChainId) return;

  if (!switchWalletChain) {
    throw new WalletChainMismatchError({ targetChainId, walletChainId });
  }

  try {
    await switchWalletChain({ chainId: targetChainId });
  } catch (error) {
    throw createSwitchChainError(error, targetChainId, walletChainId);
  }
}

export async function ensureWagmiWalletChain(
  config: Config,
  targetChainId: number = DEFAULT_CHAIN_ID
): Promise<void> {
  const account = getAccount(config);

  await ensureWalletChain({
    targetChainId,
    walletChainId: account.chainId,
    isConnected: account.isConnected,
    switchChain: async ({ chainId }) => {
      await switchChain(config, {
        chainId: chainId as Config["chains"][number]["id"],
      });
    },
  });
}

export async function ensureAppKitWalletChain(
  targetChainId: number = DEFAULT_CHAIN_ID
): Promise<void> {
  await ensureWagmiWalletChain(getWagmiConfig(), targetChainId);
}
