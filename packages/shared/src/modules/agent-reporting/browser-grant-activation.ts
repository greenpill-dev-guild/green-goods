import type { SmartAccountClient } from "permissionless";
import { createPublicClient, http, type Hex } from "viem";
import {
  formatUserOperationRequest,
  getUserOperationHash,
  type UserOperation,
} from "viem/account-abstraction";
import { getChain } from "../../config/chains";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";
import { grantActivationOperationSchema, type GrantActivationOperation } from "./api-contract";
import type { GrantPolicy } from "./grants";
import type { PublicationEnvelope } from "./envelope";
import { createGrantedKernelActivationAccount } from "./kernel-permissions";

type PreparedOperation = Omit<UserOperation<"0.7">, "signature"> & { signature?: Hex };

/** Explicit wire allowlist: SDK stub/enable signatures and deployment authority never leave here. */
export function signatureFreeActivationOperation(
  operation: PreparedOperation
): GrantActivationOperation {
  if (
    operation.factory !== undefined ||
    operation.factoryData !== undefined ||
    operation.authorization !== undefined
  )
    throw new Error("Activation requires an already deployed account");
  const rpc = formatUserOperationRequest({ ...operation, signature: operation.signature ?? "0x" });
  return grantActivationOperationSchema.parse({
    sender: rpc.sender,
    nonce: rpc.nonce,
    callData: rpc.callData,
    callGasLimit: rpc.callGasLimit,
    verificationGasLimit: rpc.verificationGasLimit,
    preVerificationGas: rpc.preVerificationGas,
    maxFeePerGas: rpc.maxFeePerGas,
    maxPriorityFeePerGas: rpc.maxPriorityFeePerGas,
    paymaster: rpc.paymaster,
    paymasterVerificationGasLimit: rpc.paymasterVerificationGasLimit,
    paymasterPostOpGasLimit: rpc.paymasterPostOpGasLimit,
    paymasterData: rpc.paymasterData,
  });
}

/** The owner signature stays inside the SDK account and the final operation goes only to its bundler. */
export async function sendBrowserGrantActivation(input: {
  ownerClient: SmartAccountClient;
  policy: GrantPolicy;
  permissionId: Hex;
  envelope: PublicationEnvelope;
  assertOwner: () => void;
  signDelegate: (operation: GrantActivationOperation) => Promise<Hex>;
  onBeforeBroadcast: (hash: Hex) => void;
}): Promise<Hex> {
  const { ownerClient, policy, envelope } = input;
  // The app's own passkey account: it approves the permission with the same signing call it
  // makes for every operation it sends.
  const owner = ownerClient.account;
  if (!owner) throw new Error("Owner Kernel client unavailable");
  input.assertOwner();
  const account = await createGrantedKernelActivationAccount({
    client: createPublicClient({
      chain: getChain(policy.chainId),
      transport: http(getRpcUrl(policy.chainId)),
    }),
    policy,
    permissionId: input.permissionId,
    envelope,
    owner,
    signDelegate: async (operation) => {
      input.assertOwner();
      return input.signDelegate(signatureFreeActivationOperation(operation));
    },
  });
  // Preparing uses the existing owner's sponsorship and bundler configuration. The SDK's stub
  // may ask the owner to enable this permission, caching that signature only in this account.
  const prepared = await ownerClient.prepareUserOperation({
    account,
    calls: [{ to: envelope.call.to, data: envelope.call.data, value: 0n }],
  });
  input.assertOwner();
  const bare = signatureFreeActivationOperation(prepared);
  const gas =
    BigInt(bare.callGasLimit) +
    BigInt(bare.verificationGasLimit) +
    BigInt(bare.preVerificationGas) +
    BigInt(bare.paymasterVerificationGasLimit) +
    BigInt(bare.paymasterPostOpGasLimit);
  if (
    bare.paymaster.toLowerCase() !== policy.approvedPaymaster?.toLowerCase() ||
    !policy.gasCostCapWei ||
    gas > BigInt(policy.gasCap) ||
    gas * BigInt(bare.maxFeePerGas) > BigInt(policy.gasCostCapWei)
  )
    throw new Error("Activation exceeds approved sponsorship or budget");
  const signature = await account.signUserOperation(prepared);
  input.assertOwner();
  const signed = { ...prepared, signature };
  const hash = getUserOperationHash({
    userOperation: signed,
    chainId: policy.chainId,
    entryPointAddress: account.entryPoint.address,
    entryPointVersion: "0.7",
  });
  input.onBeforeBroadcast(hash);
  // Send the already approved operation unchanged. Re-preparing here could alter fees or
  // sponsorship after the Agent signed it. viem's retryCount=0 preserves the uncertain-send barrier.
  const returned = await ownerClient.request(
    {
      method: "eth_sendUserOperation",
      params: [formatUserOperationRequest(signed), account.entryPoint.address],
    },
    { retryCount: 0 }
  );
  if (returned.toLowerCase() !== hash.toLowerCase()) throw new Error("Bundler reference mismatch");
  return hash;
}
