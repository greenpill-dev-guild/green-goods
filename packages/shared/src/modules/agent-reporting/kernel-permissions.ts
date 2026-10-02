import { toPermissionValidator } from "@zerodev/permissions";
import {
  CallPolicyVersion,
  CallType,
  ParamCondition,
  toCallPolicy,
  toGasPolicy,
  toRateLimitPolicy,
  toSudoPolicy,
  toTimestampPolicy,
} from "@zerodev/permissions/policies";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";
import {
  encodeAbiParameters,
  isAddress,
  keccak256,
  type Chain,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type Transport,
  zeroAddress,
} from "viem";
import { toAccount } from "viem/accounts";
import { ATTEST_SELECTOR, type AttestScope, attestWordRules } from "./call-policy";
import {
  grantPolicyIssues,
  VERIFIED_PERMISSION_MODULES,
  type GrantPolicy,
  type RevocationDescriptor,
} from "./grants";
import { resolveReportingDeployment } from "./envelope";
import {
  createPermissionReader,
  KERNEL_PERMISSION_ABI,
  permissionValidationId,
} from "./permission-management";

/**
 * Kernel 0.3.1 permission construction for one bounded grant: a call policy that admits only the
 * exact EAS attest shape of `call-policy.ts`, a validity window and a submission count. It builds
 * data only; nothing here enables, signs or sends. Delegation stays disabled until the pinned
 * module passes the independent owner-revocation gate, so no caller may treat a built validator
 * as proof that a permission is installed or enforceable.
 */
export function grantPolicies(policy: GrantPolicy, scope: AttestScope) {
  if (
    !policy.singleCallPolicy ||
    !isAddress(policy.singleCallPolicy) ||
    policy.singleCallPolicy === zeroAddress ||
    !policy.approvedPaymaster ||
    !isAddress(policy.approvedPaymaster) ||
    policy.approvedPaymaster === zeroAddress ||
    !policy.gasCostCapWei ||
    !/^[1-9][0-9]*$/.test(policy.gasCostCapWei) ||
    BigInt(policy.gasCostCapWei) >= 2n ** 128n
  ) {
    throw new Error(
      "Grant requires deployed single-call policy, measured wei cost cap and approved paymaster"
    );
  }
  const call = toCallPolicy({
    policyVersion: CallPolicyVersion.V0_0_4,
    permissions: [
      {
        callType: CallType.CALL,
        target: scope.easAddress,
        selector: ATTEST_SELECTOR,
        valueLimit: 0n,
        rules: attestWordRules(scope).map((rule) => ({
          condition: ParamCondition.EQUAL,
          offset: rule.offset,
          params: [rule.equals],
        })),
      },
    ],
  });
  const window = toTimestampPolicy({
    validAfter: Math.floor(policy.validAfter / 1000),
    validUntil: Math.floor(policy.validUntil / 1000),
  });
  const submissions = toRateLimitPolicy({ count: policy.maxSubmissions });
  const gas = toGasPolicy({
    allowed: BigInt(policy.gasCostCapWei),
    enforcePaymaster: true,
    allowedPaymaster: policy.approvedPaymaster,
  });
  // SDK's empty-data policy encoder is reused with our restrictive contract address. This is
  // NOT the SDK SudoPolicy contract; the installed guard rejects batches/value/message signing.
  const single = {
    ...toSudoPolicy({ policyAddress: policy.singleCallPolicy }),
    getPolicyData: () =>
      encodeAbiParameters(
        [{ type: "uint128" }, { type: "address" }],
        [BigInt(policy.gasCostCapWei as string), policy.approvedPaymaster as `0x${string}`]
      ),
  };
  return [call, window, submissions, gas, single];
}

/** The permission validator the delegated signer would operate under, built offline. */
export async function grantPermissionValidator(
  client: PublicClient<Transport, Chain>,
  input: { policy: GrantPolicy; scope: AttestScope; signer: LocalAccount }
) {
  return toPermissionValidator(client, {
    signer: await toECDSASigner({ signer: input.signer }),
    policies: grantPolicies(input.policy, input.scope),
    entryPoint: getEntryPoint("0.7"),
    kernelVersion: KERNEL_V3_1,
  });
}

/** Public signer identity suffices to derive policy/install data; no browser session key exists. */
export function publicGrantSigner(policy: GrantPolicy): LocalAccount {
  const refuse = async (): Promise<never> => {
    throw new Error("Public signer cannot sign");
  };
  return toAccount({
    address: policy.signerAddress,
    signMessage: refuse,
    signTypedData: refuse,
    signTransaction: refuse,
  });
}

/** Rebuild the owner install call from trusted deployment pins, never accept imported calldata. */
export async function grantInstallCall(
  client: PublicClient<Transport, Chain>,
  policy: GrantPolicy,
  permissionId: Hex
) {
  if (Date.now() >= policy.validUntil) throw new Error("expired");
  const module = VERIFIED_PERMISSION_MODULES.find(
    (entry) => entry.chainId === policy.chainId && entry.moduleRef === policy.moduleRef
  );
  const deployment = resolveReportingDeployment(policy.chainId);
  if (
    !module?.singleCallPolicy ||
    !module.singleCallPolicyCodeHash ||
    !module.approvedPaymaster ||
    module.singleCallPolicy.toLowerCase() !== policy.singleCallPolicy?.toLowerCase() ||
    module.approvedPaymaster.toLowerCase() !== policy.approvedPaymaster?.toLowerCase() ||
    module.gasCostCapsWei?.[policy.purpose] !== policy.gasCostCapWei ||
    (policy.purpose === "review" && !module.reviewSupported) ||
    grantPolicyIssues(policy).length ||
    policy.easAddress.toLowerCase() !== deployment.easAddress.toLowerCase() ||
    policy.schemaUID !==
      (policy.purpose === "reporting" ? deployment.work : deployment.review).schemaUID
  )
    throw new Error("unsupported_scope");
  const reader = createPermissionReader(
    client as unknown as Parameters<typeof createPermissionReader>[0]
  );
  await reader.assertKernel(policy.account);
  for (const [address, hash] of [
    [module.validatorAddress, module.validatorCodeHash],
    [module.singleCallPolicy, module.singleCallPolicyCodeHash],
  ] as const) {
    const code = await client.getCode({ address });
    if (!code || keccak256(code) !== hash) throw new Error("unsupported_scope");
  }
  const validator = await grantPermissionValidator(client, {
    policy,
    signer: publicGrantSigner(policy),
    scope: {
      purpose: policy.purpose,
      easAddress: policy.easAddress as Hex,
      gardenAddress: policy.gardenAddress as Hex,
      schemaUID: policy.schemaUID,
    },
  });
  if (validator.getIdentifier() !== permissionId) throw new Error("unsupported_scope");
  const validationId = permissionValidationId(permissionId);
  const [current, previous] = await Promise.all([
    client.readContract({
      address: policy.account,
      abi: KERNEL_PERMISSION_ABI,
      functionName: "currentNonce",
    }),
    client.readContract({
      address: policy.account,
      abi: KERNEL_PERMISSION_ABI,
      functionName: "validationConfig",
      args: [validationId],
    }),
  ]);
  const nonce = previous.nonce === current ? current + 1 : current;
  return {
    address: policy.account,
    account: policy.account,
    chainId: policy.chainId,
    abi: KERNEL_PERMISSION_ABI,
    functionName: "installValidations",
    args: [
      [validationId],
      [{ nonce, hook: "0x0000000000000000000000000000000000000001" }],
      [await validator.getEnableData(policy.account)],
      ["0x"],
    ],
    value: 0n,
  };
}

export { signGrantedKernelOperation } from "./kernel-executor";
export {
  createPermissionReader,
  KERNEL_PERMISSION_ABI,
  permissionValidationId,
} from "./permission-management";

/** Non-secret facts the owner saves before enablement to find and revoke this permission. */
export function grantRevocationDescriptor(input: {
  policy: GrantPolicy;
  permissionId: Hex;
  validatorAddress: Hex;
  validatorCodeHash: Hex;
  policyDigest: Hex;
}): RevocationDescriptor {
  const { policy } = input;
  return {
    version: 1,
    chainId: policy.chainId,
    account: policy.account,
    kernelVersion: "0.3.1",
    entryPointVersion: "0.7",
    moduleRef: policy.moduleRef,
    validatorAddress: input.validatorAddress,
    validatorCodeHash: input.validatorCodeHash,
    permissionId: input.permissionId,
    signerAddress: policy.signerAddress,
    purpose: policy.purpose,
    gardenAddress: policy.gardenAddress,
    validUntil: policy.validUntil,
    policyDigest: input.policyDigest,
  };
}
