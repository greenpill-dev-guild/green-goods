import type { SmartAccountClient } from "permissionless";
import type { Address, Hex } from "viem";
import { createPublicClientForChain } from "../../config/pimlico";
import type { PasskeyAdapters } from "../../workflows/auth-passkey-adapters";
import type { PasskeySessionResult } from "../../workflows/authMachine.types";
import { PILOT_PASSKEY_PROFILE, getPilotCredentialId } from "./account-profile";
import {
  discoverPilotAccountProof,
  PilotProofExecutionFailedError,
  type PilotAccountProof,
} from "./pilot-account-proof";
import {
  getPasskeyRequestIds,
  matchesBrowserId,
  type PasskeyCredential,
  type SessionStorage,
} from "./session";
import { selectPilotAccountSession, type ActivePasskeySession } from "./pilot-account-selection";

import {
  preparePilotProofOperation,
  sendReviewedPilotProof,
  type PilotAccountQuote,
  type PreparedPilotProof,
} from "./pilot-account-operation";
export { getPilotProofMaxCost } from "./pilot-account-operation";
export type { PilotAccountQuote } from "./pilot-account-operation";

const PROOF_CHAIN_ID = 100;

export type PilotAccountPreview = {
  address: Address;
  previousAddress: Address;
  enrolled: boolean;
  pending: boolean;
};

export class PilotAccountProofError extends Error {
  constructor(
    message: string,
    readonly pending: boolean
  ) {
    super(message);
    this.name = "PilotAccountProofError";
  }
}

type Candidate = {
  active: ActivePasskeySession;
  credential: PasskeyCredential;
  rpId: string;
  address: Hex;
  clients: Map<number, SmartAccountClient>;
  generation: number;
  proof: PilotAccountProof | null;
  quote?: PreparedPilotProof;
};

/** One explicit enrollment at a time; the existing session stays active until proof is mined. */
export function createPilotAccountEnrollment(input: {
  adapters: PasskeyAdapters;
  getSession(): ActivePasskeySession | null;
  selectSession(session: PasskeySessionResult): void;
  storage?: SessionStorage;
  discoverProof?: typeof discoverPilotAccountProof;
  now?: () => number;
}) {
  const { adapters } = input;
  const storage = input.storage ?? localStorage;
  const now = input.now ?? Date.now;
  const discover = input.discoverProof ?? discoverPilotAccountProof;
  let generation = 0;
  let candidate: Candidate | undefined;
  let sending = false;
  const pendingKey = (address: Address) => `greengoods_pilot_proof:100:${address.toLowerCase()}`;

  const assertCurrent = (value: Candidate) => {
    const active = input.getSession();
    if (
      value.generation !== generation ||
      !active ||
      active.address.toLowerCase() !== value.active.address.toLowerCase() ||
      active.credential.id !== value.active.credential.id ||
      active.credential.publicKey.toLowerCase() !== value.active.credential.publicKey.toLowerCase()
    ) {
      throw new Error("Pilot enrollment session changed; sign in again");
    }
  };
  const current = () => {
    if (!candidate) throw new Error("Prepare the pilot account first");
    assertCurrent(candidate);
    return candidate;
  };
  const proofFor = async (value: Candidate, transactionHash?: Hex) =>
    discover({
      client: createPublicClientForChain(PROOF_CHAIN_ID),
      accountAddress: value.address,
      publicKey: value.credential.publicKey,
      canonicalCredentialId: getPilotCredentialId(value.credential),
      ...(transactionHash ? { transactionHash } : {}),
    });
  const preview = (value: Candidate): PilotAccountPreview => ({
    address: value.address,
    previousAddress: value.active.address,
    enrolled: Boolean(value.proof),
    pending: storage.getItem(pendingKey(value.address)) !== null,
  });

  const buildCandidate = async (
    active: ActivePasskeySession,
    credential: PasskeyCredential,
    rpId: string,
    attempt: number
  ) => {
    getPilotCredentialId(credential);
    const built = await Promise.all(
      [42161, 42220, 100].map(async (chainId) => ({
        chainId,
        ...(await adapters.buildSmartAccount(
          credential,
          chainId,
          rpId,
          undefined,
          PILOT_PASSKEY_PROFILE
        )),
      }))
    );
    const address = built[0].address;
    if (built.some((account) => account.address.toLowerCase() !== address.toLowerCase())) {
      throw new Error("Pilot account address differs between networks");
    }
    const value: Candidate = {
      active,
      credential,
      rpId,
      address,
      clients: new Map(built.map((account) => [account.chainId, account.client])),
      generation: attempt,
      proof: null,
    };
    assertCurrent(value);
    value.proof = await proofFor(value);
    assertCurrent(value);
    return value;
  };

  /** Public deterministic discovery never opens a prompt or changes the selected identity. */
  const findExisting = async (): Promise<PilotAccountPreview | null> => {
    const active = input.getSession();
    const rpId = adapters.session.getStoredRpId();
    if (!active?.credential.signingId || !rpId || ![42161, 42220, 100].includes(active.chainId))
      return null;
    const value = await buildCandidate(active, active.credential, rpId, generation);
    return value.proof ? preview(value) : null;
  };

  const prepare = async (): Promise<PilotAccountPreview> => {
    if (sending) throw new Error("A pilot proof is already awaiting confirmation");
    const active = input.getSession();
    if (!active) throw new Error("Sign in with your existing passkey first");
    if (![42161, 42220, 100].includes(active.chainId))
      throw new Error("Pilot accounts require Arbitrum, Celo or Gnosis as the current chain");
    const attempt = ++generation;
    candidate = undefined;
    const rpId = adapters.session.getStoredRpId();
    if (!rpId) throw new Error("Sign in again to recover the passkey domain");
    const challenge = adapters.randomChallenge();
    const response = await adapters.getWebAuthnCredential({
      publicKey: {
        challenge: new Uint8Array(challenge),
        rpId,
        userVerification: "required",
        allowCredentials: getPasskeyRequestIds(active.credential).map((id) => ({
          type: "public-key",
          id,
        })),
        timeout: 60_000,
      },
    });
    if (
      !response ||
      !matchesBrowserId(active.credential, response.id) ||
      !(await adapters.verifyAssertion({
        response,
        publicKey: active.credential.publicKey,
        challenge,
        rpId,
      }))
    ) {
      throw new Error("Pilot enrollment passkey verification failed or was cancelled");
    }
    const credential = { ...active.credential, signingId: response.id };
    const value = await buildCandidate(active, credential, rpId, attempt);
    candidate = value;
    return preview(value);
  };

  const quote = async (): Promise<PilotAccountQuote> => {
    const value = current();
    if (storage.getItem(pendingKey(value.address)) !== null)
      throw new Error("Reconcile the pending pilot proof before retrying");
    const client = value.clients.get(PROOF_CHAIN_ID)!;
    const prepared = await preparePilotProofOperation({
      client,
      address: value.address,
      assertCurrent: () => assertCurrent(value),
      now,
    });
    value.quote = prepared;
    return prepared.view;
  };

  const activate = async (value: Candidate, proof: PilotAccountProof) => {
    assertCurrent(value);
    selectPilotAccountSession({
      adapters,
      active: value.active,
      clients: value.clients,
      credential: value.credential,
      address: value.address,
      rpId: value.rpId,
      selectSession: (session) => input.selectSession(session),
    });
    storage.removeItem(pendingKey(value.address));
    value.proof = proof;
    generation++;
    candidate = undefined;
  };

  const confirm = async (reviewedHash?: Hex): Promise<void> => {
    const value = current();
    if (sending) throw new Error("A pilot proof is already awaiting confirmation");
    sending = true;
    try {
      if (value.proof) {
        const proof = await proofFor(value, value.proof.transactionHash);
        if (!proof) throw new Error("Pilot account proof is no longer available");
        await activate(value, proof);
        return;
      }
      const approved = value.quote;
      if (
        !approved ||
        approved.view.operationHash !== reviewedHash ||
        now() > approved.view.expiresAt
      ) {
        throw new Error("Review a fresh pilot proof quote before signing");
      }
      if (storage.getItem(pendingKey(value.address)) !== null)
        throw new Error("Reconcile the pending pilot proof before retrying");
      const client = value.clients.get(PROOF_CHAIN_ID)!;
      const result = await sendReviewedPilotProof({
        client,
        address: value.address,
        approved,
        reviewedHash,
        assertCurrent: () => assertCurrent(value),
        now,
        onBeforeBroadcast: (hash) => {
          storage.setItem(
            pendingKey(value.address),
            JSON.stringify({ hash, nonce: approved.view.nonce })
          );
        },
      });
      const proof = await proofFor(value, result.hash);
      if (!proof) throw new Error("Successful pilot account authorization has not been proved");
      await activate(value, proof);
    } catch (error) {
      if (error instanceof PilotProofExecutionFailedError) {
        storage.removeItem(pendingKey(value.address));
        value.quote = undefined;
      }
      throw new PilotAccountProofError(
        error instanceof Error ? error.message : "Pilot proof failed",
        storage.getItem(pendingKey(value.address)) !== null
      );
    } finally {
      sending = false;
    }
  };

  const reconcile = async (): Promise<void> => {
    const value = current();
    const stored = storage.getItem(pendingKey(value.address));
    if (!stored) throw new Error("No pilot proof is awaiting confirmation");
    const pending: unknown = JSON.parse(stored);
    if (
      !pending ||
      typeof pending !== "object" ||
      !("hash" in pending) ||
      typeof pending.hash !== "string" ||
      !/^0x[0-9a-f]{64}$/i.test(pending.hash)
    ) {
      throw new Error("Invalid pending pilot proof");
    }
    const receipt = await value.clients
      .get(PROOF_CHAIN_ID)!
      .waitForUserOperationReceipt({ hash: pending.hash as Hex, timeout: 15_000 });
    assertCurrent(value);
    if (
      receipt.userOpHash.toLowerCase() !== pending.hash.toLowerCase() ||
      receipt.sender.toLowerCase() !== value.address.toLowerCase()
    ) {
      throw new Error("Pilot proof receipt does not match this account");
    }
    if (!receipt.success || receipt.receipt.status !== "success") {
      storage.removeItem(pendingKey(value.address));
      value.quote = undefined;
      throw new PilotAccountProofError(
        "Pilot proof reverted; review a new quote before retrying",
        false
      );
    }
    let proof: PilotAccountProof | null;
    try {
      proof = await proofFor(value, receipt.receipt.transactionHash);
    } catch (error) {
      if (error instanceof PilotProofExecutionFailedError) {
        storage.removeItem(pendingKey(value.address));
        value.quote = undefined;
        throw new PilotAccountProofError(
          "Pilot proof execution failed; review a new quote before retrying",
          false
        );
      }
      throw error;
    }
    if (!proof) throw new Error("Successful pilot account authorization has not been proved");
    await activate(value, proof);
  };

  return {
    prepare,
    findExisting,
    quote,
    confirm,
    reconcile,
    cancel: () => {
      generation++;
      candidate = undefined;
    },
  };
}
