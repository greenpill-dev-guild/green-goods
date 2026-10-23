import { describe, expect, it } from "vitest";
import draft from "../../config/steward-safe-release.json";
import {
  type StewardArtifacts,
  buildStewardPlan,
  inspectStewardManifest,
  validateStewardPlan,
} from "./steward-safe-release";

const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
function fixture() {
  return {
    ...structuredClone(draft),
    garden: address(10),
    hatsModule: address(11),
    stewardHat: "2",
    expectedTopHat: String(1n << 224n),
    networks: {
      arbitrum: { chainId: 42161, router: address(12), deployer: address(13), nonce: 1 },
      gnosis: { chainId: 100, router: address(14), deployer: address(15), nonce: 2 },
    },
  };
}
function artifacts(): StewardArtifacts {
  const artifact = (name: string) => ({
    abi: [
      name === "StewardRolePublisher"
        ? "constructor(address,address,address,uint256,address)"
        : "constructor(address,address,address,uint256,uint256)",
    ],
    bytecode: { object: "0x60006000f3" },
    deployedBytecode: { object: "0x6000" },
    metadata: {
      compiler: { version: "0.8.28+commit.fixture" },
      settings: {
        optimizer: { enabled: true, runs: 1 },
        viaIR: true,
        evmVersion: "cancun",
        compilationTarget: { [`src/accounts/${name}.sol`]: name },
      },
    },
  });
  return {
    StewardRolePublisher: artifact("StewardRolePublisher"),
    StewardSafeReceiver: artifact("StewardSafeReceiver"),
  };
}
const commit = "a".repeat(40);
describe("fixed-two steward Safe release", () => {
  it("keeps missing deployment and real signer inputs explicit", () => {
    const incomplete = { ...fixture(), garden: null, confirmedStewards: [] };
    const report = inspectStewardManifest(incomplete);
    expect(report.missing).toContain("garden");
    expect(report.activationMissing).toContain("confirmedStewards");
    expect(() => buildStewardPlan(incomplete, artifacts(), commit)).toThrow("deployment inputs");
  });
  it.each([
    [
      "threshold",
      (m: ReturnType<typeof fixture>) => {
        m.threshold = 3;
      },
    ],
    [
      "chain",
      (m: ReturnType<typeof fixture>) => {
        m.networks.gnosis.chainId = 1;
      },
    ],
    [
      "negative nonce",
      (m: ReturnType<typeof fixture>) => {
        m.networks.arbitrum.nonce = -1;
      },
    ],
    [
      "GG Safe",
      (m: ReturnType<typeof fixture>) => {
        m.greenGoodsSafe = address(99);
      },
    ],
    [
      "zero address",
      (m: ReturnType<typeof fixture>) => {
        m.garden = address(0);
      },
    ],
  ])("rejects %s drift", (_, mutate) => {
    const m = fixture();
    mutate(m);
    expect(() => inspectStewardManifest(m)).toThrow();
  });
  it("binds both CREATE peers and separately encodes observer registration without enabling it", () => {
    const plan = buildStewardPlan(fixture(), artifacts(), commit);
    expect(plan.transactions).toHaveLength(2);
    expect(plan.activationIncluded).toBe(false);
    expect(plan.observerRegistration.to).toBe(address(11));
    expect(plan.transactions[0].data).toContain(plan.transactions[1].address.slice(2).toLowerCase());
    validateStewardPlan(plan, fixture(), artifacts(), commit);
    plan.transactions[0].data += "00";
    expect(() => validateStewardPlan(plan, fixture(), artifacts(), commit)).toThrow("mismatch");
  });
  it("rejects stale revision, wrong build, and unreviewed runtime", () => {
    const m = fixture();
    const a = artifacts();
    const plan = buildStewardPlan(m, a, commit);
    expect(() => validateStewardPlan(plan, m, a, "b".repeat(40))).toThrow();
    a.StewardSafeReceiver.metadata.settings.viaIR = false;
    expect(() => buildStewardPlan(m, a, commit)).toThrow("production");
  });
});
