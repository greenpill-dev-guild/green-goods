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
import { assertPrimaryPasskeyProfile } from "../modules/commitment-pooling/account-profiles";
import {
  clearSignedOutSentinel,
  getAuthMode,
  getStoredCredential,
  getStoredSmartAccountAddress,
  getStoredUsername,
  hasSignedOutSentinel,
  setStoredCredential,
  setStoredSmartAccountAddress,
  setStoredUsername,
} from "../modules/auth/session";

export type PasskeyServerClientAdapter = ReturnType<typeof createPasskeyServerClient>;

export interface PasskeySessionAdapter {
  hasSignedOutSentinel(): boolean;
  clearSignedOutSentinel(): void;
  getAuthMode(): ReturnType<typeof getAuthMode>;
  getStoredCredential(): P256Credential | null;
  setStoredCredential(credential: P256Credential): void;
  getStoredUsername(): string | null;
  setStoredUsername(userName: string): void;
  getStoredSmartAccountAddress(): Hex | null;
  setStoredSmartAccountAddress(address: Hex): void;
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
  session: PasskeySessionAdapter;
  telemetry: AuthTelemetryAdapter;
  isServerEnabled(): boolean;
  buildRecoveryContext(userName: string): ReturnType<typeof buildPasskeyRecoveryContext>;
  createServerClient(chainId: number): PasskeyServerClientAdapter;
  createLocalPasskey(userName: string): Promise<P256Credential>;
  createWebAuthnCredential(options: unknown): Promise<P256Credential>;
  getWebAuthnCredential(options: CredentialRequestOptions): Promise<Credential | null>;
  getRpId(): string;
  randomChallenge(): Uint8Array;
  buildSmartAccount(
    credential: P256Credential,
    chainId: number
  ): Promise<{ client: SmartAccountClient; address: Hex }>;
}

async function buildSmartAccount(
  credential: P256Credential,
  chainId: number
): Promise<{ client: SmartAccountClient; address: Hex }> {
  assertPrimaryPasskeyProfile(chainId);
  const sponsorshipPolicyId = getPimlicoSponsorshipPolicyId(chainId);
  const chain = getChain(chainId);
  const publicClient = createPublicClientForChain(chainId);
  const pimlicoClient = createPimlicoClientForChain(chainId);
  const rpId = getPasskeyRpId();
  const account = await toKernelSmartAccount({
    client: publicClient,
    version: "0.3.1",
    owners: [toWebAuthnAccount({ credential, rpId })],
    entryPoint: { address: entryPoint07Address, version: "0.7" },
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
  session: {
    hasSignedOutSentinel,
    clearSignedOutSentinel,
    getAuthMode,
    getStoredCredential,
    setStoredCredential,
    getStoredUsername,
    setStoredUsername,
    getStoredSmartAccountAddress: () => getStoredSmartAccountAddress() as Hex | null,
    setStoredSmartAccountAddress: (address) => setStoredSmartAccountAddress(address),
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
  createLocalPasskey: createPasskey,
  createWebAuthnCredential: (options) =>
    createWebAuthnCredential(options as Parameters<typeof createWebAuthnCredential>[0]),
  getWebAuthnCredential: (options) => navigator.credentials.get(options),
  getRpId: getPasskeyRpId,
  randomChallenge: () => crypto.getRandomValues(new Uint8Array(32)),
  buildSmartAccount,
};
