import { getAddress } from "ethers";
import draft from "../../config/clc-pilot-release.json";
import type { CLCMemberManifest } from "./clc-member-inputs";
import { CLC_TIMELOCK_ABI, CLC_TIMELOCK_SOURCE, type CLCPilotManifest } from "./clc-release";
import type { VoucherArtifact } from "./voucher-release";

export const memberFixtureAddress = (n: number) => getAddress(`0x${n.toString(16).padStart(40, "0")}`);
export const memberFixtureRevision = "a".repeat(40);
/** Fictional planner terms; these are never confirmation of a real person's service or account. */
export function memberReleaseFixture(): CLCMemberManifest {
  const base = {
    ...structuredClone(draft),
    deployer: memberFixtureAddress(400),
    nonce: 3,
    techAndSunSafe: memberFixtureAddress(401),
    earnedAdapter: memberFixtureAddress(402),
  } as CLCPilotManifest;
  return {
    schemaVersion: 2,
    releaseId: "fictional-tas-member-rehearsal",
    purpose: "fictional-rehearsal",
    base,
    members: {
      deployer: base.deployer,
      nonce: 13,
      assets: ["analyst", "engineer"].map((role, index) => ({
        id: `${role}-peer-help`,
        kind: "individual",
        ownerReserve: memberFixtureAddress(410 + index),
        sourceAuthority: memberFixtureAddress(410 + index),
        name: `Fictional ${role} peer help`,
        symbol: index === 0 ? "FAN" : "FEN",
        service: {
          unit: index === 0 ? "One standalone measurement-coaching lesson" : "One standalone integration-help lesson",
          terms: {
            reference: `https://example.org/fictional/${role}/terms`,
            digest: `0x${String(index + 1).repeat(64)}`,
          },
          capacityConfirmed: true,
          approval: {
            reference: `https://example.org/fictional/${role}/approval`,
            digest: `0x${String(index + 3).repeat(64)}`,
          },
        },
        initialSupply: "12000000",
        poolInventory: "4000000",
        poolHoldingCap: "8000000",
        adapterAllowance: "5000000",
        priceIndex: index === 0 ? "2000000" : "4000000",
        upgradeControl: { kind: "member" },
      })),
    },
  };
}
/** Never deployed: pure planner tests only require the existing production policy shape. */
export function memberPlannerArtifact(): VoucherArtifact {
  return {
    abi: CLC_TIMELOCK_ABI,
    bytecode: { object: "0x60006000f3" },
    deployedBytecode: { object: "0x6000" },
    metadata: {
      compiler: { version: "0.8.28+commit.fixture" },
      settings: {
        optimizer: { enabled: true, runs: 1 },
        viaIR: true,
        evmVersion: "cancun",
        compilationTarget: { [CLC_TIMELOCK_SOURCE]: "TimelockController" },
      },
    },
  };
}
