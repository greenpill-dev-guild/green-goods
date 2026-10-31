import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { type Hex, http } from "viem";
import {
  createWebAuthnCredential,
  entryPoint07Address,
  type P256Credential,
  toWebAuthnAccount,
} from "viem/account-abstraction";
import { getChain } from "../config/chains";
import {
  buildPasskeyRecoveryContext,
  createPasskey,
  createPasskeyDirectoryClient,
  createPasskeyServerClient,
  getPasskeyRpId,
  isPasskeyServerEnabled,
} from "../config/passkeyServer";
import {
  createPimlicoClientForChain,
  createPublicClientForChain,
  getPimlicoBundlerUrl,
  getPimlicoSponsorshipPolicyId,
} from "../config/pimlico";
import {
  trackAuthPasskeyLoginFailed,
  trackAuthPasskeyLoginStarted,
  trackAuthPasskeyLoginSuccess,
  trackAuthPasskeyRegisterFailed,
  trackAuthPasskeyRegisterStarted,
  trackAuthPasskeyRegisterSuccess,
  trackAuthSessionRestored,
} from "../modules/app/analytics-events";
import {
  type PasskeyAssertionCheck,
  verifyPasskeyAssertion,
} from "../modules/auth/passkey-assertion";
import {
  clearSignedOutSentinel,
  getAuthMode,
  getPasskeyRequestIds,
  getStoredCredential,
  getStoredRpId,
  getStoredSmartAccountAddress,
  getStoredUsername,
  hasSignedOutSentinel,
  type PasskeyCredential,
  setStoredCredential,
  setStoredRpId,
  setStoredSmartAccountAddress,
  setStoredUsername,
  getStoredAccountProfile,
  setStoredAccountProfile,
  getStoredProfileAddress,
  setStoredProfileAddress,
} from "../modules/auth/session";
import {
  getPasskeyAccountRecipe,
  getPilotCredentialId,
  LEGACY_PASSKEY_PROFILE,
  PILOT_PASSKEY_PROFILE,
  type PasskeyAccountProfileId,
} from "../modules/auth/account-profile";
import { discoverPilotAccountProof } from "../modules/auth/pilot-account-proof";

export type PasskeyServerClientAdapter = ReturnType<typeof createPasskeyServerClient>;

export interface PasskeySessionAdapter {
  hasSignedOutSentinel(): boolean;
  clearSignedOutSentinel(): void;
  getAuthMode(): ReturnType<typeof getAuthMode>;
  getStoredCredential(): PasskeyCredential | null;
  setStoredCredential(credential: PasskeyCredential): void;
  getStoredRpId(): string | null;
  setStoredRpId(rpId: string): void;
  getStoredUsername(): string | null;
  setStoredUsername(userName: string): void;
  getStoredSmartAccountAddress(): Hex | null;
  setStoredSmartAccountAddress(address: Hex): void;
  getStoredAccountProfile(): PasskeyAccountProfileId;
  setStoredAccountProfile(profile: PasskeyAccountProfileId): void;
  getStoredProfileAddress(
    profile: PasskeyAccountProfileId,
    credential: PasskeyCredential
  ): Hex | null;
  setStoredProfileAddress(
    profile: PasskeyAccountProfileId,
    credential: PasskeyCredential,
    address: Hex,
    rpId: string,
    userName: string
  ): void;
}

export interface AuthTelemetryAdapter {
  restore: typeof trackAuthSessionRestored;
  registerStarted: typeof trackAuthPasskeyRegisterStarted;
  registerSucceeded: typeof trackAuthPasskeyRegisterSuccess;
  registerFailed: typeof trackAuthPasskeyRegisterFailed;
  loginStarted: typeof trackAuthPasskeyLoginStarted;
  loginSucceeded: typeof trackAuthPasskeyLoginSuccess;
  loginFailed: typeof trackAuthPasskeyLoginFailed;
}

export interface PasskeyAdapters {
  hasPilotAccountProof(credential: PasskeyCredential, address: Hex): Promise<boolean>;
  session: PasskeySessionAdapter;
  telemetry: AuthTelemetryAdapter;
  isServerEnabled(): boolean;
  buildRecoveryContext(userName: string): ReturnType<typeof buildPasskeyRecoveryContext>;
  /** The hosted passkey server: every account made before the directory lives there. */
  createServerClient(chainId: number): PasskeyServerClientAdapter;
  /** The Green Goods passkey directory, or null while this build has not been switched to it. */
  createDirectoryClient(): PasskeyServerClientAdapter | null;
  createLocalPasskey(userName: string): Promise<P256Credential>;
  createWebAuthnCredential(options: unknown): Promise<P256Credential>;
  getWebAuthnCredential(options: CredentialRequestOptions): Promise<Credential | null>;
  /** Check a sign-in signature against the key the directory holds for the passkey. */
  verifyAssertion(input: Omit<PasskeyAssertionCheck, "origin">): Promise<boolean>;
  /** The domain the app uses when it runs a passkey ceremony without a server's options. */
  getRpId(): string;
  /** This site's own hostname: the domain of a passkey the hosted server issued here. */
  getSiteRpId(): string;
  randomChallenge(): Uint8Array;
  buildSmartAccount(
    credential: PasskeyCredential,
    chainId: number,
    rpId: string,
    knownAddress?: Hex,
    profile?: PasskeyAccountProfileId
  ): Promise<{ client: SmartAccountClient; address: Hex }>;
}

export function createPasskeyOwner(
  credential: PasskeyCredential,
  rpId: string,
  getFn?: Parameters<typeof toWebAuthnAccount>[0]["getFn"]
) {
  const getCredential: NonNullable<Parameters<typeof toWebAuthnAccount>[0]["getFn"]> =
    getFn ?? ((options) => navigator.credentials.get(options as CredentialRequestOptions));
  return toWebAuthnAccount({
    credential,
    rpId,
    getFn: (options) => {
      if (!options?.publicKey?.allowCredentials) return getCredential(options);
      return getCredential({
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

async function buildSmartAccount(
  credential: PasskeyCredential,
  chainId: number,
  rpId: string,
  knownAddress?: Hex,
  profile: PasskeyAccountProfileId = LEGACY_PASSKEY_PROFILE
): Promise<{ client: SmartAccountClient; address: Hex }> {
  const recipe = getPasskeyAccountRecipe(profile, chainId);
  if (profile === PILOT_PASSKEY_PROFILE && knownAddress) {
    throw new Error("Pilot accounts must be derived without an address override");
  }
  const ownerCredential =
    profile === PILOT_PASSKEY_PROFILE
      ? { ...credential, id: getPilotCredentialId(credential) }
      : credential;
  const sponsorshipPolicyId = getPimlicoSponsorshipPolicyId(chainId);
  const chain = getChain(chainId);
  const publicClient = createPublicClientForChain(chainId);
  const pimlicoClient = createPimlicoClientForChain(chainId);
  const account = await toKernelSmartAccount({
    client: publicClient,
    ...recipe,
    owners: [createPasskeyOwner(ownerCredential, rpId)],
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    address: knownAddress,
  });
  const client = createSmartAccountClient({
    account,
    chain,
    bundlerTransport: http(getPimlicoBundlerUrl(chainId)),
    paymaster: pimlicoClient,
    paymasterContext: { sponsorshipPolicyId },
    userOperation: {
      estimateFeesPerGas: async () => {
        const { fast } = await pimlicoClient.getUserOperationGasPrice();
        return {
          maxFeePerGas: fast.maxFeePerGas,
          maxPriorityFeePerGas: fast.maxPriorityFeePerGas,
        };
      },
    },
  });
  return { client, address: account.address as Hex };
}

export const defaultPasskeyAdapters: PasskeyAdapters = {
  hasPilotAccountProof: async (credential, address) =>
    Boolean(
      await discoverPilotAccountProof({
        client: createPublicClientForChain(100),
        accountAddress: address,
        publicKey: credential.publicKey,
        canonicalCredentialId: getPilotCredentialId(credential),
      })
    ),
  session: {
    hasSignedOutSentinel,
    clearSignedOutSentinel,
    getAuthMode,
    getStoredCredential,
    setStoredCredential,
    getStoredRpId,
    setStoredRpId,
    getStoredUsername,
    setStoredUsername,
    getStoredSmartAccountAddress: () => getStoredSmartAccountAddress() as Hex | null,
    setStoredSmartAccountAddress: (address) => setStoredSmartAccountAddress(address),
    getStoredAccountProfile,
    setStoredAccountProfile,
    getStoredProfileAddress,
    setStoredProfileAddress,
  },
  telemetry: {
    restore: trackAuthSessionRestored,
    registerStarted: trackAuthPasskeyRegisterStarted,
    registerSucceeded: trackAuthPasskeyRegisterSuccess,
    registerFailed: trackAuthPasskeyRegisterFailed,
    loginStarted: trackAuthPasskeyLoginStarted,
    loginSucceeded: trackAuthPasskeyLoginSuccess,
    loginFailed: trackAuthPasskeyLoginFailed,
  },
  isServerEnabled: isPasskeyServerEnabled,
  buildRecoveryContext: buildPasskeyRecoveryContext,
  createServerClient: createPasskeyServerClient,
  createDirectoryClient: () => createPasskeyDirectoryClient(),
  createLocalPasskey: createPasskey,
  createWebAuthnCredential: (options) =>
    createWebAuthnCredential(options as Parameters<typeof createWebAuthnCredential>[0]),
  getWebAuthnCredential: (options) => navigator.credentials.get(options),
  verifyAssertion: (input) => verifyPasskeyAssertion({ ...input, origin: window.location.origin }),
  getRpId: getPasskeyRpId,
  getSiteRpId: () => window.location.hostname,
  randomChallenge: () => crypto.getRandomValues(new Uint8Array(32)),
  buildSmartAccount,
};
