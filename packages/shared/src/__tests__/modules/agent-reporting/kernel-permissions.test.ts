import { createPublicClient, custom, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { ATTEST_SELECTOR, type AttestScope } from "../../../modules/agent-reporting/call-policy";
import { resolveReportingDeployment } from "../../../modules/agent-reporting/envelope";
import { GRANT_LIMITS, type GrantPolicy } from "../../../modules/agent-reporting/grants";
import {
  grantPermissionValidator,
  grantPolicies,
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
  it("encodes a call policy for the EAS attest shape with the grant window and count", () => {
    const { policy: grant, scope } = policy("0x00000000000000000000000000000000000000c2");
    const [call, window, submissions] = grantPolicies(grant, scope);
    const callData = call?.getPolicyData().toLowerCase() ?? "";
    expect(callData).toContain(deployment.easAddress.slice(2).toLowerCase());
    expect(callData).toContain(ATTEST_SELECTOR.slice(2));
    expect(callData).toContain(deployment.work.schemaUID.slice(2).toLowerCase());
    expect(window?.getPolicyData()).toBeDefined();
    expect(submissions?.getPolicyData()).toBeDefined();
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
