import type { SmartAccountClient } from "permissionless";
import { encodeFunctionData, type Address, type Hex } from "viem";
import {
  getUserOperationHash,
  sendUserOperation,
  type UserOperation,
} from "viem/account-abstraction";
import { PasskeySender } from "../transactions/passkey-sender";
import {
  PILOT_PROOF_CALL_ABI,
  PILOT_ROOT_NONCE_KEY,
  getPilotProofExecutionCallData,
} from "./pilot-account-proof";

const PROOF_CHAIN_ID = 100;
const MAX_PROOF_COST = 10n ** 16n; // 0.01 xDAI, paid by the paymaster; value is always zero.
const QUOTE_LIFETIME_MS = 60_000;

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

export type PreparedPilotProof = Readonly<{
  view: Readonly<PilotAccountQuote>;
  request: Readonly<UserOperation<"0.7">>;
}>;

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

/** Bind the reviewed quote to the candidate, factory, root nonce and complete sponsorship cost. */
export async function preparePilotProofOperation(input: {
  client: SmartAccountClient;
  address: Address;
  assertCurrent(): void;
  now(): number;
}): Promise<PreparedPilotProof> {
  const { client, address, assertCurrent, now } = input;
  const prepared = (await client.prepareUserOperation({
    account: client.account!,
    calls: [
      {
        to: address,
        value: 0n,
        data: encodeFunctionData({ abi: PILOT_PROOF_CALL_ABI, functionName: "rootValidator" }),
      },
    ],
  })) as UserOperation<"0.7">;
  // Keep only flat wire fields: the SDK result also contains account/call preparation options.
  const request = Object.freeze({
    sender: prepared.sender,
    nonce: prepared.nonce,
    callData: prepared.callData,
    callGasLimit: prepared.callGasLimit,
    verificationGasLimit: prepared.verificationGasLimit,
    preVerificationGas: prepared.preVerificationGas,
    maxFeePerGas: prepared.maxFeePerGas,
    maxPriorityFeePerGas: prepared.maxPriorityFeePerGas,
    factory: prepared.factory,
    factoryData: prepared.factoryData,
    paymaster: prepared.paymaster,
    paymasterData: prepared.paymasterData,
    paymasterVerificationGasLimit: prepared.paymasterVerificationGasLimit,
    paymasterPostOpGasLimit: prepared.paymasterPostOpGasLimit,
    signature: prepared.signature,
  });
  assertCurrent();
  if (
    request.sender.toLowerCase() !== address.toLowerCase() ||
    request.callData.toLowerCase() !== getPilotProofExecutionCallData(address).toLowerCase() ||
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
  assertCurrent();
  const view: PilotAccountQuote = Object.freeze({
    operationHash: operationHash(request, client),
    address: address,
    chainId: 100,
    nonce: request.nonce.toString(),
    maxCostWei: getPilotProofMaxCost(request).toString(),
    costCeilingWei: MAX_PROOF_COST.toString(),
    expiresAt: now() + QUOTE_LIFETIME_MS,
    sponsored: true,
  });
  return Object.freeze({ view, request });
}

/** Preserve the SDK account prototype and reject any changed operation before its passkey prompt. */
export async function sendReviewedPilotProof(input: {
  client: SmartAccountClient;
  address: Address;
  approved: PreparedPilotProof;
  reviewedHash?: Hex;
  assertCurrent(): void;
  now(): number;
  onBeforeBroadcast(hash: Hex): void;
}) {
  const { client, address, approved, reviewedHash, assertCurrent, now, onBeforeBroadcast } = input;
  const { view, request: prepared } = approved;
  const account = client.account!;
  const assertReviewed = (request: UserOperation<"0.7"> & { chainId?: number }) => {
    assertCurrent();
    if (
      (request.chainId !== undefined && request.chainId !== PROOF_CHAIN_ID) ||
      now() > view.expiresAt ||
      getPilotProofMaxCost(request).toString() !== view.maxCostWei ||
      operationHash(request, client) !== reviewedHash ||
      reviewedHash !== view.operationHash
    ) {
      throw new Error("Pilot proof quote changed; review it again");
    }
  };
  const guardedAccount = Object.create(account, {
    signUserOperation: {
      enumerable: true,
      value: async (request: Parameters<typeof account.signUserOperation>[0]) => {
        const operation = request as UserOperation<"0.7">;
        assertReviewed(operation);
        const [nonce, factory] = await Promise.all([account.getNonce(), account.getFactoryArgs()]);
        assertCurrent();
        if (
          nonce !== prepared.nonce ||
          factory.factory?.toLowerCase() !== prepared.factory?.toLowerCase() ||
          factory.factoryData?.toLowerCase() !== prepared.factoryData?.toLowerCase()
        ) {
          throw new Error("Pilot proof quote changed; review it again");
        }
        assertReviewed(operation);
        const signature = await account.signUserOperation(request);
        assertReviewed(operation);
        return signature;
      },
    },
  }) as typeof account;
  const preparedClient = Object.create(client, {
    prepareUserOperation: { value: async () => ({ ...prepared }), enumerable: true },
  }) as SmartAccountClient;
  const guardedClient = Object.create(client, {
    account: { value: guardedAccount, enumerable: true },
    sendUserOperation: {
      enumerable: true,
      value: async (parameters: Parameters<typeof client.sendUserOperation>[0]) => {
        assertReviewed(prepared);
        // Invoke the installed action with this scoped client, not a method bound to the original.
        const hash = await sendUserOperation(preparedClient, parameters);
        if (hash.toLowerCase() !== view.operationHash.toLowerCase())
          throw new Error("Pilot proof submission differs from the reviewed operation");
        return hash;
      },
    },
  }) as SmartAccountClient;
  const sender = new PasskeySender(guardedClient);
  return sender.sendContractCall(
    {
      address: address,
      abi: PILOT_PROOF_CALL_ABI,
      functionName: "rootValidator",
      args: [],
      value: 0n,
      account: address,
    },
    {
      assertOwnership: async () => assertCurrent(),
      onBeforeBroadcast: async (reference) => {
        assertCurrent();
        if (now() > view.expiresAt) throw new Error("Pilot proof quote expired; review it again");
        if (
          reference?.kind !== "user-operation" ||
          reference.chainId !== PROOF_CHAIN_ID ||
          reference.hash !== reviewedHash
        ) {
          throw new Error("Pilot proof submission differs from the reviewed operation");
        }
        // Public operation identity survives navigation, transport failures and restarts.
        onBeforeBroadcast(reference.hash);
      },
    }
  );
}
