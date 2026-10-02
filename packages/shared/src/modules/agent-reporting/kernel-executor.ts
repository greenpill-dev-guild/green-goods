import { createKernelAccount } from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";
import { createSmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import {
  http,
  type Chain,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type Transport,
} from "viem";
import { formatUserOperationRequest, getUserOperationHash } from "viem/account-abstraction";
import type { GrantPolicy } from "./grants";
import type { PublicationEnvelope } from "./envelope";
import { grantPermissionValidator } from "./kernel-permissions";

/** Prepares and signs one installed permission; no sudo plugin/portable owner-enable signature. */
export async function signGrantedKernelOperation(input: {
  client: PublicClient<Transport, Chain>;
  bundlerUrl: string;
  sponsorshipPolicyId: string;
  signer: LocalAccount;
  policy: GrantPolicy;
  envelope: PublicationEnvelope;
  nonce?: bigint;
  onPrepared?: (nonce: bigint) => Promise<void>;
}): Promise<{ userOperationHash: Hex; signedOperation: string }> {
  const { client, policy, envelope } = input;
  if (
    !policy.approvedPaymaster ||
    !policy.gasCostCapWei ||
    input.signer.address.toLowerCase() !== policy.signerAddress.toLowerCase()
  ) {
    throw new Error("Unsupported grant execution");
  }
  const permission = await grantPermissionValidator(client, {
    policy,
    scope: {
      purpose: policy.purpose,
      easAddress: policy.easAddress as Hex,
      gardenAddress: policy.gardenAddress as Hex,
      schemaUID: policy.schemaUID,
    },
    signer: input.signer,
  });
  // Permission must already be owner-installed. Agent never gets an owner enable signature.
  if (!(await permission.isEnabled(policy.account, "0xe9ae5c53")))
    throw new Error("Permission not installed");
  const account = await createKernelAccount(client, {
    address: policy.account,
    entryPoint: getEntryPoint("0.7"),
    kernelVersion: KERNEL_V3_1,
    plugins: { regular: permission },
  });
  const paymaster = createPimlicoClient({
    chain: client.chain,
    transport: http(input.bundlerUrl),
    entryPoint: { address: getEntryPoint("0.7").address, version: "0.7" },
  });
  const executor = createSmartAccountClient({
    account,
    chain: client.chain,
    bundlerTransport: http(input.bundlerUrl),
    paymaster,
    paymasterContext: { sponsorshipPolicyId: input.sponsorshipPolicyId },
    userOperation: {
      estimateFeesPerGas: async () => (await paymaster.getUserOperationGasPrice()).fast,
    },
  });
  const prepared = await executor.prepareUserOperation({
    ...(input.nonce === undefined ? {} : { nonce: input.nonce }),
    calls: [{ to: envelope.call.to, value: 0n, data: envelope.call.data }],
  });
  if (prepared.paymaster?.toLowerCase() !== policy.approvedPaymaster.toLowerCase())
    throw new Error("Sponsorship unavailable");
  const gas =
    (prepared.callGasLimit ?? 0n) +
    (prepared.verificationGasLimit ?? 0n) +
    (prepared.preVerificationGas ?? 0n) +
    (prepared.paymasterVerificationGasLimit ?? 0n) +
    (prepared.paymasterPostOpGasLimit ?? 0n);
  if (gas * (prepared.maxFeePerGas ?? 0n) > BigInt(policy.gasCostCapWei))
    throw new Error("Grant cost exceeds approved budget");
  await input.onPrepared?.(prepared.nonce);
  const signed = { ...prepared, signature: await account.signUserOperation(prepared) };
  const userOperationHash = getUserOperationHash({
    userOperation: signed,
    entryPointAddress: getEntryPoint("0.7").address,
    entryPointVersion: "0.7",
    chainId: policy.chainId,
  });
  return {
    userOperationHash,
    signedOperation: JSON.stringify({
      userOperationHash,
      request: formatUserOperationRequest(signed),
    }),
  };
}
