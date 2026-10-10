import type { Address } from "../../types/domain";

export type AccountFactoryArgs = {
  factory?: Address;
  factoryData?: `0x${string}`;
};

export type MessageSignerAccount = {
  signMessage?: (args: { message: string }) => Promise<`0x${string}`>;
  getFactoryArgs?: () => AccountFactoryArgs | Promise<AccountFactoryArgs | undefined> | undefined;
};

export function createAccountMessageSigner(input: {
  authMode: "wallet" | "embedded" | "passkey" | null;
  signMessage: (args: { message: string }) => Promise<`0x${string}`>;
  account?: MessageSignerAccount;
}): (message: string) => Promise<`0x${string}`> {
  return async (message) => {
    if (input.authMode !== "passkey") return input.signMessage({ message });
    if (!input.account?.signMessage)
      throw new Error("Reconnect your passkey account before continuing.");
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
