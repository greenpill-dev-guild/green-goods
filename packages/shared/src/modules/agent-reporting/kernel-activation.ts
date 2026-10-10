import { createKernelAccount } from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";
import {
  concatHex,
  encodeFunctionData,
  padHex,
  zeroHash,
  type Chain,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type Transport,
} from "viem";
import {
  entryPoint07Abi,
  getUserOperationHash,
  type UserOperation,
} from "viem/account-abstraction";
import { envelopeIssues, resolveReportingDeployment, type PublicationEnvelope } from "./envelope";
import type { GrantPolicy } from "./grants";
import { grantPermissionValidator, verifiedGrantPermissionValidator } from "./kernel-permissions";
import { type OwnerAccount, passkeyOwnerValidator } from "./owner-validator";
import { KERNEL_PERMISSION_ABI, permissionValidationId } from "./permission-management";

type Client = PublicClient<Transport, Chain>;
type Operation = Omit<UserOperation<"0.7">, "signature"> & { signature?: Hex };

/** Shared browser/signer boundary: exactly the frozen first report, never arbitrary calldata. */
async function assertActivationOperation(
  client: Client,
  policy: GrantPolicy,
  permissionId: Hex,
  envelope: PublicationEnvelope,
  operation: Operation
) {
  const now = Date.now();
  const deployment = resolveReportingDeployment(policy.chainId);
  const gas =
    operation.callGasLimit +
    operation.verificationGasLimit +
    operation.preVerificationGas +
    (operation.paymasterVerificationGasLimit ?? 0n) +
    (operation.paymasterPostOpGasLimit ?? 0n);
  const nonceKey = BigInt(
    concatHex(["0x0102", padHex(permissionId, { size: 20, dir: "right" }), "0x0000"])
  );
  const expectedCall = encodeFunctionData({
    abi: KERNEL_PERMISSION_ABI,
    functionName: "execute",
    args: [zeroHash, concatHex([envelope.call.to, zeroHash, envelope.call.data])],
  });
  if (
    client.chain.id !== policy.chainId ||
    now < policy.validAfter ||
    now >= policy.validUntil ||
    envelopeIssues(envelope, { deployment, account: policy.account }).length ||
    envelope.gardenAddress.toLowerCase() !== policy.gardenAddress.toLowerCase() ||
    envelope.schemaUID !== policy.schemaUID ||
    (envelope.kind === "work" ? "reporting" : "review") !== policy.purpose ||
    operation.sender.toLowerCase() !== policy.account.toLowerCase() ||
    operation.factory !== undefined ||
    operation.factoryData !== undefined ||
    operation.authorization !== undefined ||
    operation.nonce >> 64n !== nonceKey ||
    operation.callData.toLowerCase() !== expectedCall.toLowerCase() ||
    operation.paymaster?.toLowerCase() !== policy.approvedPaymaster?.toLowerCase() ||
    !operation.paymasterData ||
    operation.paymasterData.length > 16_386 ||
    operation.callGasLimit <= 0n ||
    operation.verificationGasLimit <= 0n ||
    operation.preVerificationGas <= 0n ||
    (operation.paymasterVerificationGasLimit ?? 0n) <= 0n ||
    (operation.paymasterPostOpGasLimit ?? 0n) < 0n ||
    gas > BigInt(policy.gasCap) ||
    operation.maxFeePerGas <= 0n ||
    operation.maxPriorityFeePerGas < 0n ||
    operation.maxPriorityFeePerGas > operation.maxFeePerGas ||
    gas * operation.maxFeePerGas > BigInt(policy.gasCostCapWei ?? "0") ||
    [
      operation.callGasLimit,
      operation.verificationGasLimit,
      operation.maxFeePerGas,
      operation.maxPriorityFeePerGas,
      operation.paymasterVerificationGasLimit ?? 0n,
      operation.paymasterPostOpGasLimit ?? 0n,
    ].some((value) => value >= 2n ** 128n)
  )
    throw new Error("unsupported_scope");
  const [nonce, installed] = await Promise.all([
    client.readContract({
      address: getEntryPoint("0.7").address,
      abi: entryPoint07Abi,
      functionName: "getNonce",
      args: [policy.account, nonceKey],
    }),
    client.readContract({
      address: policy.account,
      abi: KERNEL_PERMISSION_ABI,
      functionName: "validationConfig",
      args: [permissionValidationId(permissionId)],
    }),
  ]);
  if (nonce !== operation.nonce || installed.hook !== "0x0000000000000000000000000000000000000000")
    throw new Error("conflict");
}

/** Agent signs a reserved exact first operation; it never sees the owner's enable signature. */
export async function signGrantedKernelActivation(input: {
  client: Client;
  policy: GrantPolicy;
  envelope: PublicationEnvelope;
  signer: LocalAccount;
  operation: Operation;
}): Promise<{ userOperationHash: Hex; delegateSignature: Hex }> {
  const permission = await grantPermissionValidator(input.client, {
    policy: input.policy,
    signer: input.signer,
    scope: {
      purpose: input.policy.purpose,
      easAddress: input.policy.easAddress as Hex,
      schemaUID: input.policy.schemaUID,
      gardenAddress: input.policy.gardenAddress as Hex,
    },
  });
  const id = permission.getIdentifier();
  await verifiedGrantPermissionValidator(input.client, input.policy, id);
  if (input.signer.address.toLowerCase() !== input.policy.signerAddress.toLowerCase())
    throw new Error("unsupported_scope");
  await assertActivationOperation(input.client, input.policy, id, input.envelope, input.operation);
  const delegateSignature = await permission.signUserOperation({
    ...input.operation,
    signature: "0x",
  });
  return {
    userOperationHash: getUserOperationHash({
      userOperation: { ...input.operation, signature: "0x" },
      entryPointAddress: getEntryPoint("0.7").address,
      entryPointVersion: "0.7",
      chainId: input.policy.chainId,
    }),
    delegateSignature,
  };
}

/**
 * Browser-only SDK account. The owner approves the permission locally with their passkey, the
 * Agent signs the report. The account's own record of its root decides who the owner is: it is
 * read from the chain, and only the app's passkey validator is accepted.
 */
export async function createGrantedKernelActivationAccount(input: {
  client: Client;
  policy: GrantPolicy;
  permissionId: Hex;
  envelope: PublicationEnvelope;
  /** The owner's own account object, which signs the approval as it signs its operations. */
  owner: OwnerAccount;
  signDelegate: (operation: Operation) => Promise<Hex>;
}) {
  const permission = await verifiedGrantPermissionValidator(
    input.client,
    input.policy,
    input.permissionId
  );
  const root = await input.client.readContract({
    address: input.policy.account,
    abi: KERNEL_PERMISSION_ABI,
    functionName: "rootValidator",
  });
  return createKernelAccount(input.client, {
    address: input.policy.account,
    entryPoint: getEntryPoint("0.7"),
    kernelVersion: KERNEL_V3_1,
    plugins: {
      // The passkey is asked for this permission's enable request and for nothing else.
      sudo: passkeyOwnerValidator(input.owner, root, {
        account: input.policy.account,
        chainId: input.policy.chainId,
        validationId: permissionValidationId(input.permissionId),
        validatorData: await permission.getEnableData(input.policy.account),
      }),
      regular: {
        ...permission,
        async signUserOperation(operation) {
          await assertActivationOperation(
            input.client,
            input.policy,
            input.permissionId,
            input.envelope,
            operation
          );
          return input.signDelegate(operation);
        },
      },
    },
  });
}
