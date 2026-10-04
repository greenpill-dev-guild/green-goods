import { describe, expect, it } from "vitest";
import {
  GRANT_LIMITS,
  type GrantPolicy,
  grantPolicyDigest,
  grantPolicyIssues,
  isDelegationAvailable,
  type RevocationDescriptor,
  revocationDescriptorIssues,
} from "../../../modules/agent-reporting/grants";

const policy: GrantPolicy = {
  version: 1,
  purpose: "reporting",
  chainId: 42161,
  account: "0x00000000000000000000000000000000000000A1",
  gardenAddress: "0x00000000000000000000000000000000000000c2",
  easAddress: "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458",
  schemaUID: `0x${"43".repeat(32)}`,
  signerAddress: "0x00000000000000000000000000000000000000d3",
  moduleRef: "fixture-module",
  validAfter: 0,
  validUntil: GRANT_LIMITS.reporting.durationMs,
  maxSubmissions: 5,
  gasCap: 1_000_000,
};

describe("grant policies", () => {
  it("keeps the accepted demo limits: 24h/5 reporting, 1h/5 review", () => {
    expect(GRANT_LIMITS).toEqual({
      reporting: { durationMs: 86_400_000, maxSubmissions: 5 },
      review: { durationMs: 3_600_000, maxSubmissions: 5 },
    });
  });

  it.each([
    [{}, []],
    [{ validUntil: GRANT_LIMITS.reporting.durationMs + 1 }, ["window_exceeds_limit"]],
    [{ purpose: "review" as const }, ["window_exceeds_limit"]],
    [{ maxSubmissions: 6 }, ["submissions_exceed_limit"]],
    [{ gasCap: 0 }, ["gas_cap_missing"]],
    [{ validUntil: 0 }, ["window_invalid"]],
  ])("%j -> %j", (overrides, issues) => {
    expect(grantPolicyIssues({ ...policy, ...overrides })).toEqual(issues);
  });

  it("binds purpose, garden and signer into the policy digest", () => {
    const digest = grantPolicyDigest(policy);
    expect(grantPolicyDigest({ ...policy, purpose: "review" })).not.toBe(digest);
    expect(
      grantPolicyDigest({ ...policy, signerAddress: "0x00000000000000000000000000000000000000d4" })
    ).not.toBe(digest);
    expect(
      grantPolicyDigest({ ...policy, account: policy.account.toLowerCase() as `0x${string}` })
    ).toBe(digest);
  });
});

describe("revocation descriptors", () => {
  const descriptor: RevocationDescriptor = {
    version: 1,
    chainId: 42161,
    account: policy.account,
    kernelVersion: "0.3.1",
    entryPointVersion: "0.7",
    moduleRef: "fixture-module",
    validatorAddress: "0x00000000000000000000000000000000000000e5",
    validatorCodeHash: `0x${"11".repeat(32)}`,
    permissionId: "0x12345678",
    signerAddress: policy.signerAddress,
    purpose: "reporting",
    gardenAddress: policy.gardenAddress,
    validUntil: policy.validUntil,
    policyDigest: grantPolicyDigest(policy),
  };
  const entry = {
    moduleRef: "fixture-module",
    chainId: 42161,
    validatorAddress: descriptor.validatorAddress,
    validatorCodeHash: descriptor.validatorCodeHash,
  };

  it("keeps delegation disabled until a module passes the independent-revocation gate", () => {
    expect(isDelegationAvailable(42161)).toBe(false);
    expect(revocationDescriptorIssues(descriptor)).toEqual(["unsupported_module"]);
    expect(isDelegationAvailable(42161, [entry])).toBe(true);
  });

  it.each([
    [{}, []],
    [{ validatorCodeHash: `0x${"22".repeat(32)}` }, ["module_mismatch"]],
    [{ purpose: "admin" }, ["malformed"]],
    [{ account: "0x1" }, ["malformed"]],
  ])("an imported descriptor %j -> %j", (overrides, issues) => {
    expect(revocationDescriptorIssues({ ...descriptor, ...overrides }, [entry])).toEqual(issues);
  });
});
