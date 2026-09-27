import { toPermissionValidator } from "@zerodev/permissions";
import {
  CallPolicyVersion,
  CallType,
  ParamCondition,
  toCallPolicy,
  toRateLimitPolicy,
  toTimestampPolicy,
} from "@zerodev/permissions/policies";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";
import type { Chain, Hex, LocalAccount, PublicClient, Transport } from "viem";
import { ATTEST_SELECTOR, type AttestScope, attestWordRules } from "./call-policy";
import type { GrantPolicy, RevocationDescriptor } from "./grants";

/**
 * Kernel 0.3.1 permission construction for one bounded grant: a call policy that admits only the
 * exact EAS attest shape of `call-policy.ts`, a validity window and a submission count. It builds
 * data only; nothing here enables, signs or sends. Delegation stays disabled until the pinned
 * module passes the independent owner-revocation gate, so no caller may treat a built validator
 * as proof that a permission is installed or enforceable.
 */
export function grantPolicies(policy: GrantPolicy, scope: AttestScope) {
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
  return [call, window, submissions];
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
