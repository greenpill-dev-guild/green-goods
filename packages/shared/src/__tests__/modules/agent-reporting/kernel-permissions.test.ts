import {
  concatHex,
  createPublicClient,
  custom,
  decodeAbiParameters,
  padHex,
  size,
  sliceHex,
  type Hex,
} from "viem";
import { createKernelAccount } from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { ATTEST_SELECTOR, type AttestScope } from "../../../modules/agent-reporting/call-policy";
import { resolveReportingDeployment } from "../../../modules/agent-reporting/envelope";
import { GRANT_LIMITS, type GrantPolicy } from "../../../modules/agent-reporting/grants";
import {
  grantPermissionValidator,
  grantPolicies,
  grantRevocationDescriptor,
} from "../../../modules/agent-reporting/kernel-permissions";

/**
 * Offline construction of the Kernel permission for a reporting grant. It proves what we would ask
 * the account to install, with no network; installation, enforcement and owner revocation remain
 * live gates, and delegation stays disabled until they pass.
 */
const deployment = resolveReportingDeployment(42161);
const signer = privateKeyToAccount(
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"
);
const NOW = Date.UTC(2026, 8, 27);

function policy(garden: Hex): { policy: GrantPolicy; scope: AttestScope } {
  return {
    policy: {
      version: 1,
      purpose: "reporting",
      chainId: 42161,
      account: "0x00000000000000000000000000000000000000ca",
      gardenAddress: garden,
      easAddress: deployment.easAddress,
      schemaUID: deployment.work.schemaUID,
      signerAddress: signer.address,
      moduleRef: "kernel-0.3.1-permission-v0.0.4",
      validAfter: NOW,
      validUntil: NOW + GRANT_LIMITS.reporting.durationMs,
      maxSubmissions: GRANT_LIMITS.reporting.maxSubmissions,
      gasCap: 2_000_000,
      gasCostCapWei: "1000000000000000",
      approvedPaymaster: "0x0000000000000000000000000000000000000a11",
      singleCallPolicy: "0x0000000000000000000000000000000000000a12",
    },
    scope: {
      purpose: "reporting",
      easAddress: deployment.easAddress,
      schemaUID: deployment.work.schemaUID,
      gardenAddress: garden,
    },
  };
}

const offline = createPublicClient({
  chain: arbitrum,
  transport: custom({
    async request() {
      throw new Error("no network in this test");
    },
  }),
});

describe("Kernel reporting permission", () => {
  it("uses the exact pinned SDK single-call encoding accepted by the Solidity guard vector", async () => {
    const grant = policy("0x00000000000000000000000000000000000000c2");
    const validator = await grantPermissionValidator(offline, { ...grant, signer });
    const account = await createKernelAccount(offline, {
      address: grant.policy.account,
      entryPoint: getEntryPoint("0.7"),
      kernelVersion: KERNEL_V3_1,
      plugins: { regular: validator },
    });
    const encoded = await account.encodeCalls([
      { to: "0x0000000000000000000000000000000000000ea5", value: 0n, data: "0x12345678" },
    ]);
    expect(encoded.toLowerCase()).toBe(
      "0xe9ae5c530000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000380000000000000000000000000000000000000ea50000000000000000000000000000000000000000000000000000000000000000123456780000000000000000"
    );
  });
  it("encodes a call policy for the EAS attest shape with the grant window and count", () => {
    const { policy: grant, scope } = policy("0x00000000000000000000000000000000000000c2");
    const [call, window, submissions, gas, single] = grantPolicies(grant, scope);
    const callData = call?.getPolicyData().toLowerCase() ?? "";
    expect(callData).toContain(deployment.easAddress.slice(2).toLowerCase());
    expect(callData).toContain(ATTEST_SELECTOR.slice(2));
    expect(callData).toContain(deployment.work.schemaUID.slice(2).toLowerCase());
    expect(window?.getPolicyData()).toBeDefined();
    expect(submissions?.getPolicyData()).toBeDefined();
    expect(gas?.policyParams).toMatchObject({
      type: "gas",
      allowed: 1000000000000000n,
      enforcePaymaster: true,
      allowedPaymaster: grant.approvedPaymaster,
    });
    expect(single?.getPolicyInfoInBytes().toLowerCase()).toContain(
      grant.singleCallPolicy?.slice(2).toLowerCase()
    );
  });

  it("produces the exact guard installation bytes Kernel prepends to the SDK policy data", async () => {
    const grant = policy("0x00000000000000000000000000000000000000c2");
    const validator = await grantPermissionValidator(offline, { ...grant, signer });
    const [enabled] = decodeAbiParameters(
      [{ type: "bytes[]" }],
      await validator.getEnableData(grant.policy.account)
    );
    const single = enabled[4]!;
    expect(sliceHex(single, 2, 22).toLowerCase()).toBe(
      grant.policy.singleCallPolicy!.toLowerCase()
    );
    // Official Kernel v3.1 _installPermission prepends right-padded bytes32(permissionId)
    // to the policy bytes after its 22-byte flags/address prefix.
    const installed = concatHex([
      padHex(validator.getIdentifier(), { size: 32, dir: "right" }),
      sliceHex(single, 22),
    ]);
    expect(size(installed)).toBe(96);
    expect(
      decodeAbiParameters([{ type: "uint128" }, { type: "address" }], sliceHex(installed, 32))
    ).toEqual([BigInt(grant.policy.gasCostCapWei!), grant.policy.approvedPaymaster]);
  });

  it("builds a validator offline whose identity changes with the granted garden", async () => {
    const first = await grantPermissionValidator(offline, {
      ...policy("0x00000000000000000000000000000000000000c2"),
      signer,
    });
    const again = await grantPermissionValidator(offline, {
      ...policy("0x00000000000000000000000000000000000000c2"),
      signer,
    });
    const other = await grantPermissionValidator(offline, {
      ...policy("0x00000000000000000000000000000000000000d3"),
      signer,
    });
    expect(first.getIdentifier()).toMatch(/^0x[0-9a-f]{8}$/);
    expect(first.getIdentifier()).toBe(again.getIdentifier());
    expect(first.getIdentifier()).not.toBe(other.getIdentifier());
    expect(await first.getEnableData("0x00000000000000000000000000000000000000ca")).toMatch(/^0x/);
  });
});

describe("owner revocation descriptor", () => {
  it("carries only public facts the owner can save, export and re-import", () => {
    const { policy: grant } = policy("0x00000000000000000000000000000000000000c2");
    const descriptor = grantRevocationDescriptor({
      policy: grant,
      permissionId: "0x7e57ab1e",
      validatorAddress: "0x0000000000000000000000000000000000007a11",
      validatorCodeHash: `0x${"ab".repeat(32)}`,
      policyDigest: `0x${"cd".repeat(32)}`,
    });

    // No owner secret, authorization signature or calldata: revocation is derived in code.
    expect(Object.keys(descriptor).sort()).toEqual([
      "account",
      "chainId",
      "entryPointVersion",
      "gardenAddress",
      "kernelVersion",
      "moduleRef",
      "permissionId",
      "policyDigest",
      "purpose",
      "signerAddress",
      "validUntil",
      "validatorAddress",
      "validatorCodeHash",
      "version",
    ]);
    expect(descriptor).toMatchObject({
      account: grant.account,
      signerAddress: signer.address,
      kernelVersion: "0.3.1",
      entryPointVersion: "0.7",
      validUntil: grant.validUntil,
    });
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor);
  });
});
