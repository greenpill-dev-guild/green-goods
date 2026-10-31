import type { SmartAccountClient } from "permissionless";
import type { Hex } from "viem";
import type { PasskeyAdapters } from "../../workflows/auth-passkey-adapters";
import type { PasskeySessionResult } from "../../workflows/authMachine.types";
import { PILOT_PASSKEY_PROFILE } from "./account-profile";
import type { PasskeyCredential } from "./session";
import { createSmartAccountClientResolver } from "./smartAccountClientResolver";

export type ActivePasskeySession = {
  credential: PasskeyCredential;
  address: Hex;
  userName: string;
  chainId: number;
};

/** Archive both identities before committing the active profile, restoring the original on failure. */
export function selectPilotAccountSession(input: {
  adapters: PasskeyAdapters;
  active: ActivePasskeySession;
  clients: Map<number, SmartAccountClient>;
  credential: PasskeyCredential;
  address: Hex;
  rpId: string;
  selectSession(session: PasskeySessionResult): void;
}): void {
  const { adapters, active, clients, credential, address, rpId, selectSession } = input;
  const primaryChainId = active.chainId;
  const primaryClient = clients.get(primaryChainId);
  if (!primaryClient) throw new Error("Pilot account is unavailable on the current chain");
  const { session } = adapters;
  const previousProfile = session.getStoredAccountProfile();
  session.setStoredProfileAddress(
    previousProfile,
    active.credential,
    active.address,
    session.getStoredRpId() || rpId,
    active.userName
  );
  session.setStoredProfileAddress(
    PILOT_PASSKEY_PROFILE,
    credential,
    address,
    rpId,
    active.userName
  );
  const selectedSession: PasskeySessionResult = {
    accountProfile: PILOT_PASSKEY_PROFILE,
    credential: credential,
    smartAccountAddress: address,
    smartAccountClient: primaryClient,
    userName: active.userName,
    resolveSmartAccountClient: createSmartAccountClientResolver({
      credential: credential,
      primaryClient,
      primaryChainId,
      expectedAddress: address,
      buildSmartAccount: (credential, chainId) =>
        adapters.buildSmartAccount(credential, chainId, rpId, undefined, PILOT_PASSKEY_PROFILE),
    }),
  };
  try {
    session.setStoredCredential(credential);
    session.setStoredSmartAccountAddress(address);
    session.setStoredAccountProfile(PILOT_PASSKEY_PROFILE);
    selectSession(selectedSession);
  } catch (error) {
    // Archived identities remain available even if browser storage refuses a later write.
    session.setStoredCredential(active.credential);
    session.setStoredSmartAccountAddress(active.address);
    session.setStoredAccountProfile(previousProfile);
    throw error;
  }
}
