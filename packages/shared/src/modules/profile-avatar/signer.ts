import type { ProfileAvatarFactoryArgs, ProfileAvatarSignerAccount } from "./types";

export function createProfileAvatarSigner(input: {
  authMode: "wallet" | "embedded" | "passkey" | null;
  signMessage: (args: { message: string }) => Promise<`0x${string}`>;
  account?: ProfileAvatarSignerAccount;
}): (message: string) => Promise<`0x${string}`> {
  return async (message) => {
    if (input.authMode !== "passkey") return input.signMessage({ message });
    if (!input.account?.signMessage)
      throw new Error("Reconnect your passkey account before publishing.");
    return input.account.signMessage({ message });
  };
}

export async function resolveProfileAvatarFactoryArgs(
  account?: ProfileAvatarSignerAccount,
  explicit?: ProfileAvatarFactoryArgs
): Promise<ProfileAvatarFactoryArgs | undefined> {
  if (explicit?.factory && explicit.factoryData) return explicit;
  const args = await account?.getFactoryArgs?.();
  return args?.factory && args.factoryData ? args : undefined;
}
