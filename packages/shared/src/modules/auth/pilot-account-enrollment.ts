import type { SmartAccountClient } from "permissionless";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { getUserOperationHash, type UserOperation } from "viem/account-abstraction";
import { createPublicClientForChain } from "../../config/pimlico";
import type { PasskeyAdapters } from "../../workflows/auth-passkey-adapters";
import type { PasskeySessionResult } from "../../workflows/authMachine.types";
import { PasskeySender } from "../transactions/passkey-sender";
import { PILOT_PASSKEY_PROFILE, getPilotCredentialId } from "./account-profile";
import {
  discoverPilotAccountProof,
  PILOT_PROOF_CALL_ABI,
  PILOT_ROOT_NONCE_KEY,
  getPilotProofExecutionCallData,
  PilotProofExecutionFailedError,
  type PilotAccountProof,
} from "./pilot-account-proof";
import {
  getPasskeyRequestIds,
  matchesBrowserId,
  type PasskeyCredential,
  type SessionStorage,
} from "./session";
import { createSmartAccountClientResolver } from "./smartAccountClientResolver";

const PROOF_CHAIN_ID = 100;
const MAX_PROOF_COST = 10n ** 16n; // 0.01 xDAI, paid by the paymaster; value is always zero.
const QUOTE_LIFETIME_MS = 60_000;

export type PilotAccountPreview = {
  address: Address;
  previousAddress: Address;
  enrolled: boolean;
  pending: boolean;
};

export type PilotAccountQuote = {
  operationHash: Hex;
  address: Address;
  chainId: 100;
  nonce: string;
  maxCostWei: string;
  costCeilingWei: string;
  expiresAt: number;
  sponsored: true;
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

type ActivePasskeySession = {
  credential: PasskeyCredential;
  address: Hex;
  userName: string;
  chainId: number;
};

type Candidate = {
  active: ActivePasskeySession;
  credential: PasskeyCredential;
  rpId: string;
  address: Hex;
  clients: Map<number, SmartAccountClient>;
  generation: number;
  proof: PilotAccountProof | null;
  quote?: { view: PilotAccountQuote };
};

function operationHash(request: UserOperation<"0.7">, client: SmartAccountClient): Hex {
  return getUserOperationHash({
    userOperation: request,
    chainId: PROOF_CHAIN_ID,
    entryPointAddress: client.account!.entryPoint.address,
    entryPointVersion: "0.7",
  });
}

/** Check the complete prepared operation again at the last boundary before WebAuthn signs. */
export function getPilotProofMaxCost(request: UserOperation<"0.7">): bigint {
  const gas =
    request.callGasLimit +
    request.verificationGasLimit +
    request.preVerificationGas +
    (request.paymasterVerificationGasLimit ?? 0n) +
    (request.paymasterPostOpGasLimit ?? 0n);
  if (
    !request.paymaster ||
    /^0x0{40}$/i.test(request.paymaster) ||
    request.maxFeePerGas <= 0n ||
    request.maxPriorityFeePerGas < 0n ||
    request.maxPriorityFeePerGas > request.maxFeePerGas ||
    [
      request.callGasLimit,
      request.verificationGasLimit,
      request.preVerificationGas,
      request.paymasterVerificationGasLimit ?? 0n,
      request.paymasterPostOpGasLimit ?? 0n,
    ].some((value) => value < 0n)
  ) {
    throw new Error("Pilot proof requires a fully sponsored operation");
  }
  const maxCost = gas * request.maxFeePerGas;
  if (maxCost > MAX_PROOF_COST) throw new Error("Pilot proof exceeds the 0.01 xDAI fee ceiling");
  return maxCost;
}

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
    const request = (await client.prepareUserOperation({
      account: client.account!,
      calls: [
        {
          to: value.address,
          value: 0n,
          data: encodeFunctionData({ abi: PILOT_PROOF_CALL_ABI, functionName: "rootValidator" }),
        },
      ],
    })) as UserOperation<"0.7">;
    assertCurrent(value);
    if (
      request.sender.toLowerCase() !== value.address.toLowerCase() ||
      request.callData.toLowerCase() !==
        getPilotProofExecutionCallData(value.address).toLowerCase() ||
      request.nonce >> 64n !== PILOT_ROOT_NONCE_KEY
    ) {
      throw new Error("Pilot proof preparation differs from the reviewed account operation");
    }
    const factoryArgs = await client.account!.getFactoryArgs();
    if (
      request.factory?.toLowerCase() !== factoryArgs.factory?.toLowerCase() ||
      request.factoryData?.toLowerCase() !== factoryArgs.factoryData?.toLowerCase()
    ) {
      throw new Error("Pilot proof factory differs from the selected account profile");
    }
    assertCurrent(value);
    const view: PilotAccountQuote = {
      operationHash: operationHash(request, client),
      address: value.address,
      chainId: 100,
      nonce: request.nonce.toString(),
      maxCostWei: getPilotProofMaxCost(request).toString(),
      costCeilingWei: MAX_PROOF_COST.toString(),
      expiresAt: now() + QUOTE_LIFETIME_MS,
      sponsored: true,
    };
    value.quote = { view };
    return view;
  };

  const activate = async (value: Candidate, proof: PilotAccountProof) => {
    assertCurrent(value);
    const primaryChainId = value.active.chainId;
    const primaryClient = value.clients.get(primaryChainId);
    if (!primaryClient) throw new Error("Pilot account is unavailable on the current chain");
    const { session } = adapters;
    const previousProfile = session.getStoredAccountProfile();
    session.setStoredProfileAddress(
      previousProfile,
      value.active.credential,
      value.active.address,
      session.getStoredRpId() || value.rpId,
      value.active.userName
    );
    session.setStoredProfileAddress(
      PILOT_PASSKEY_PROFILE,
      value.credential,
      value.address,
      value.rpId,
      value.active.userName
    );
    const selectedSession: PasskeySessionResult = {
      accountProfile: PILOT_PASSKEY_PROFILE,
      credential: value.credential,
      smartAccountAddress: value.address,
      smartAccountClient: primaryClient,
      userName: value.active.userName,
      resolveSmartAccountClient: createSmartAccountClientResolver({
        credential: value.credential,
        primaryClient,
        primaryChainId,
        expectedAddress: value.address,
        buildSmartAccount: (credential, chainId) =>
          adapters.buildSmartAccount(
            credential,
            chainId,
            value.rpId,
            undefined,
            PILOT_PASSKEY_PROFILE
          ),
      }),
    };
    try {
      session.setStoredCredential(value.credential);
      session.setStoredSmartAccountAddress(value.address);
      session.setStoredAccountProfile(PILOT_PASSKEY_PROFILE);
      input.selectSession(selectedSession);
    } catch (error) {
      // Archived identities remain available even if browser storage refuses a later write.
      session.setStoredCredential(value.active.credential);
      session.setStoredSmartAccountAddress(value.active.address);
      session.setStoredAccountProfile(previousProfile);
      throw error;
    }
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
      const account = client.account!;
      const guardedAccount = Object.create(account, {
        signUserOperation: {
          enumerable: true,
          value: async (request: Parameters<typeof account.signUserOperation>[0]) => {
            assertCurrent(value);
            const operation = request as UserOperation<"0.7">;
            if (
              (request.chainId !== undefined && request.chainId !== 100) ||
              now() > approved.view.expiresAt ||
              getPilotProofMaxCost(operation).toString() !== approved.view.maxCostWei ||
              operationHash(operation, client) !== reviewedHash
            ) {
              throw new Error("Pilot proof quote changed; review it again");
            }
            const signature = await account.signUserOperation(request);
            assertCurrent(value);
            return signature;
          },
        },
      }) as typeof account;
      const guardedClient = Object.create(client, {
        account: { value: guardedAccount, enumerable: true },
      }) as SmartAccountClient;
      const sender = new PasskeySender(guardedClient);
      const result = await sender.sendContractCall(
        {
          address: value.address,
          abi: PILOT_PROOF_CALL_ABI,
          functionName: "rootValidator",
          args: [],
          value: 0n,
          account: value.address,
        },
        {
          assertOwnership: async () => assertCurrent(value),
          onBeforeBroadcast: async (reference) => {
            assertCurrent(value);
            if (now() > approved.view.expiresAt)
              throw new Error("Pilot proof quote expired; review it again");
            if (
              reference?.kind !== "user-operation" ||
              reference.chainId !== PROOF_CHAIN_ID ||
              reference.hash !== reviewedHash
            ) {
              throw new Error("Pilot proof submission differs from the reviewed operation");
            }
            // Public operation identity survives navigation, transport failures and restarts.
            storage.setItem(
              pendingKey(value.address),
              JSON.stringify({ hash: reference.hash, nonce: approved.view.nonce })
            );
          },
        }
      );
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
