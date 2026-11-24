import { type AuthMode, isSmartAccountAuthMode, type WalletRestoreState } from "../../types/auth";
import type { Address } from "../../types/domain";
import { refuseWithoutWallet } from "./wallet-reconnect";

export type AccountFactoryArgs = {
  factory?: Address;
  factoryData?: `0x${string}`;
};

export type MessageSignerAccount = {
  signMessage?: (args: { message: string }) => Promise<`0x${string}`>;
  getFactoryArgs?: () => AccountFactoryArgs | Promise<AccountFactoryArgs | undefined> | undefined;
};

export function createAccountMessageSigner(input: {
  authMode: AuthMode;
  signMessage: (args: { message: string }) => Promise<`0x${string}`>;
  account?: MessageSignerAccount;
  /** A wallet account whose wallet has not answered is asked to reconnect instead (PRD-1499). */
  walletRestore?: WalletRestoreState | null;
}): (message: string) => Promise<`0x${string}`> {
  return async (message) => {
    if (input.authMode === "wallet" && input.walletRestore) refuseWithoutWallet();
    // A smart account signs through its own account (ERC-1271), never as its owner key.
    if (!isSmartAccountAuthMode(input.authMode)) return input.signMessage({ message });
    if (!input.account?.signMessage)
      throw new Error(
        input.authMode === "openfort"
          ? "Sign in with your email again before continuing."
          : "Reconnect your passkey account before continuing."
      );
    return input.account.signMessage({ message });
  };
}

export async function resolveAccountFactoryArgs(
  account?: MessageSignerAccount,
  explicit?: AccountFactoryArgs
): Promise<AccountFactoryArgs | undefined> {
  if (explicit?.factory && explicit.factoryData) return explicit;
  const args = await account?.getFactoryArgs?.();
  return args?.factory && args.factoryData ? args : undefined;
}
