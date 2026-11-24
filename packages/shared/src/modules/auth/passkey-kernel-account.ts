import { toKernelSmartAccount } from "permissionless/accounts";
import type { Hex } from "viem";
import { entryPoint07Address, toWebAuthnAccount } from "viem/account-abstraction";
import {
  getPasskeyAccountRecipe,
  getPilotCredentialId,
  isKernel033PasskeyProfile,
  LEGACY_PASSKEY_PROFILE,
  type PasskeyAccountProfileId,
} from "./account-profile";
export { supportsPasskeyAccountProfile } from "./account-profile";
import { getPasskeyRequestIds, type PasskeyCredential } from "./passkey-credential-storage";

type PublicCredential = Pick<PasskeyCredential, "id" | "signingId" | "publicKey">;
type CredentialGetter = Parameters<typeof toWebAuthnAccount>[0]["getFn"];

export function createPasskeyOwner(
  credential: PublicCredential,
  rpId: string,
  getFn: CredentialGetter = (options) =>
    navigator.credentials.get(options as CredentialRequestOptions)
) {
  return toWebAuthnAccount({
    credential,
    rpId,
    getFn: (options) => {
      if (!options?.publicKey?.allowCredentials) return getFn(options);
      return getFn({
        ...options,
        publicKey: {
          ...options.publicKey,
          allowCredentials: getPasskeyRequestIds(credential).map((id) => ({
            type: "public-key",
            id,
          })),
        },
      });
    },
  });
}

/** Use the same factory and exact credential ID for sign-in and directory address reads. */
export function createPasskeyKernelAccount({
  client,
  chainId,
  credential,
  rpId,
  knownAddress,
  profile = LEGACY_PASSKEY_PROFILE,
  getFn,
}: {
  client: Parameters<typeof toKernelSmartAccount>[0]["client"];
  chainId: number;
  credential: PublicCredential;
  rpId: string;
  knownAddress?: Hex;
  profile?: PasskeyAccountProfileId;
  getFn?: CredentialGetter;
}) {
  const recipe = getPasskeyAccountRecipe(profile, chainId);
  if (isKernel033PasskeyProfile(profile) && knownAddress) {
    throw new Error("Pilot accounts must be derived without an address override");
  }
  const ownerCredential = isKernel033PasskeyProfile(profile)
    ? { ...credential, id: getPilotCredentialId(credential) }
    : credential;
  return toKernelSmartAccount({
    client,
    ...recipe,
    owners: [createPasskeyOwner(ownerCredential, rpId, getFn)],
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    address: knownAddress,
  });
}
