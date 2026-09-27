import { type Address, type Hex, isAddress, isAddressEqual, isHex } from "viem";
import { reportingDigest } from "./canonical";

/**
 * Bounded Kernel execution permissions. Reporting and review are separate grants with separate
 * budgets: a reporting grant can never authorize a review decision and neither can be widened,
 * renewed or re-enabled without the account owner.
 */
export type GrantPurpose = "reporting" | "review";

/** Accepted demo limits (technical brief section 9.1). */
export const GRANT_LIMITS = {
  reporting: { durationMs: 24 * 60 * 60 * 1000, maxSubmissions: 5 },
  review: { durationMs: 60 * 60 * 1000, maxSubmissions: 5 },
} as const satisfies Record<GrantPurpose, { durationMs: number; maxSubmissions: number }>;

export interface GrantPolicy {
  version: 1;
  purpose: GrantPurpose;
  chainId: number;
  account: Address;
  gardenAddress: Address;
  easAddress: Address;
  schemaUID: Hex;
  signerAddress: Address;
  moduleRef: string;
  /** Epoch milliseconds bound into the owner's approval; activation never extends them. */
  validAfter: number;
  validUntil: number;
  maxSubmissions: number;
  /** Cumulative gas units; set from measured calls before any grant is offered. */
  gasCap: number;
}

export type GrantPolicyIssue =
  | "window_invalid"
  | "window_exceeds_limit"
  | "submissions_exceed_limit"
  | "gas_cap_missing"
  | "address_invalid";

export function grantPolicyIssues(policy: GrantPolicy): GrantPolicyIssue[] {
  const limits = GRANT_LIMITS[policy.purpose];
  const issues: GrantPolicyIssue[] = [];
  if (!(policy.validUntil > policy.validAfter)) issues.push("window_invalid");
  if (policy.validUntil - policy.validAfter > limits.durationMs)
    issues.push("window_exceeds_limit");
  if (
    !Number.isInteger(policy.maxSubmissions) ||
    policy.maxSubmissions < 1 ||
    policy.maxSubmissions > limits.maxSubmissions
  ) {
    issues.push("submissions_exceed_limit");
  }
  if (!Number.isInteger(policy.gasCap) || policy.gasCap <= 0) issues.push("gas_cap_missing");
  if (
    ![policy.account, policy.gardenAddress, policy.easAddress, policy.signerAddress].every((a) =>
      isAddress(a)
    )
  ) {
    issues.push("address_invalid");
  }
  return issues;
}

export function grantPolicyDigest(policy: GrantPolicy): Hex {
  return reportingDigest("grant-policy", {
    ...policy,
    account: policy.account.toLowerCase(),
    gardenAddress: policy.gardenAddress.toLowerCase(),
    easAddress: policy.easAddress.toLowerCase(),
    signerAddress: policy.signerAddress.toLowerCase(),
  });
}

/**
 * Non-secret facts an owner needs to find and remove a permission without the Agent: saved before
 * enablement, exportable, and always revalidated against the pinned module allowlist and chain.
 */
export interface RevocationDescriptor {
  version: 1;
  chainId: number;
  account: Address;
  kernelVersion: "0.3.1";
  entryPointVersion: "0.7";
  moduleRef: string;
  validatorAddress: Address;
  validatorCodeHash: Hex;
  permissionId: Hex;
  signerAddress: Address;
  purpose: GrantPurpose;
  gardenAddress: Address;
  validUntil: number;
  policyDigest: Hex;
}

export interface PermissionModuleEntry {
  moduleRef: string;
  chainId: number;
  validatorAddress: Address;
  validatorCodeHash: Hex;
}

/**
 * Modules whose install, scoped execution and owner revocation have passed the section 9.3
 * compatibility gate. Delegation stays disabled while this list is empty: nothing may be enabled
 * that the owner cannot independently find and revoke.
 */
export const VERIFIED_PERMISSION_MODULES: readonly PermissionModuleEntry[] = [];

export type DescriptorIssue = "malformed" | "unsupported_module" | "module_mismatch";

export function revocationDescriptorIssues(
  descriptor: unknown,
  allowlist: readonly PermissionModuleEntry[] = VERIFIED_PERMISSION_MODULES
): DescriptorIssue[] {
  const d = descriptor as Partial<RevocationDescriptor> | null;
  const wellFormed =
    d !== null &&
    typeof d === "object" &&
    d.version === 1 &&
    Number.isSafeInteger(d.chainId) &&
    [d.account, d.validatorAddress, d.signerAddress, d.gardenAddress].every(
      (value) => typeof value === "string" && isAddress(value)
    ) &&
    typeof d.permissionId === "string" &&
    isHex(d.permissionId) &&
    typeof d.validatorCodeHash === "string" &&
    isHex(d.validatorCodeHash) &&
    (d.purpose === "reporting" || d.purpose === "review") &&
    typeof d.moduleRef === "string";
  if (!wellFormed) return ["malformed"];
  const entry = allowlist.find((candidate) => candidate.moduleRef === d.moduleRef);
  if (!entry) return ["unsupported_module"];
  if (
    entry.chainId !== d.chainId ||
    !isAddressEqual(entry.validatorAddress, d.validatorAddress as Address) ||
    entry.validatorCodeHash !== d.validatorCodeHash
  ) {
    return ["module_mismatch"];
  }
  return [];
}

export function isDelegationAvailable(
  chainId: number,
  allowlist: readonly PermissionModuleEntry[] = VERIFIED_PERMISSION_MODULES
): boolean {
  return allowlist.some((entry) => entry.chainId === chainId);
}
