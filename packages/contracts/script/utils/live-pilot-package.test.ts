import { getAddress } from "ethers";
import { describe, expect, it } from "vitest";
import clcDraft from "../../config/clc-pilot-release.json";
import config from "../../config/live-pilot-release.json";
import sourceDraft from "../../config/source-upgrade-release.json";
import stewardDraft from "../../config/steward-safe-release.json";
import voucherDraft from "../../config/voucher-pilot-release.json";
import { buildCLCPilotPlan, CLC_TIMELOCK_ABI, CLC_TIMELOCK_SOURCE, type CLCPilotManifest } from "./clc-release";
import {
  buildLivePilotPackage,
  inspectLivePilotPackageInputs,
  type LivePilotArtifacts,
  type LivePilotManifests,
} from "./live-pilot-package";
import { buildSourceUpgradePlan, SOURCE_UPGRADE_TARGETS } from "./source-upgrade-release";
import { buildStewardPlan, type StewardArtifacts, type StewardManifest } from "./steward-safe-release";
import { buildVoucherPlan, VOUCHER_CONTRACTS, type VoucherArtifact, type VoucherManifest } from "./voucher-release";

const commit = "a".repeat(40);
const address = (n: number) => getAddress(`0x${n.toString(16).padStart(40, "0")}`);
function artifact(source: string, name: string, abi: string[]): VoucherArtifact {
  return {
    abi,
    bytecode: { object: "0x60006000f3" },
    deployedBytecode: { object: "0x6000" },
    metadata: {
      compiler: { version: "0.8.28+commit.fixture" },
      settings: {
        optimizer: { enabled: true, runs: 1 },
        viaIR: true,
        evmVersion: "cancun",
        compilationTarget: { [source]: name },
      },
    },
  };
}
function fixture() {
  const gg = clcDraft.greenGoodsSafe;
  const arbDeployer = address(101);
  const gnosisDeployer = address(102);
  const hats = address(103);
  const sourceUpgrades = {
    ...structuredClone(sourceDraft),
    deployer: arbDeployer,
    nonce: 10,
    authority: { ...sourceDraft.authority, nonce: 4 },
    settlement: null,
  };
  const stewardSafe = {
    ...structuredClone(stewardDraft),
    garden: address(104),
    hatsModule: hats,
    stewardHat: "2",
    expectedTopHat: String(1n << 224n),
    networks: {
      arbitrum: { chainId: 42161, router: address(105), deployer: arbDeployer, nonce: 11 },
      gnosis: { chainId: 100, router: address(106), deployer: gnosisDeployer, nonce: 20 },
    },
  } as StewardManifest;
  const vouchers = structuredClone(voucherDraft) as VoucherManifest;
  Object.assign(vouchers.networks.arbitrum, {
    deployer: arbDeployer,
    nonce: 12,
    router: address(105),
    owner: gg,
    guardian: address(107),
    commitmentPooling: sourceUpgrades.pooling.proxy,
    hatsModule: hats,
  });
  Object.assign(vouchers.networks.gnosis, {
    deployer: gnosisDeployer,
    nonce: 21,
    router: address(106),
    owner: gg,
    guardian: address(108),
  });
  const clc = {
    ...structuredClone(clcDraft),
    deployer: gnosisDeployer,
    nonce: 26,
    techAndSunSafe: address(109),
  } as CLCPilotManifest;
  vouchers.governance.techAndSun.address = clc.techAndSunSafe;
  const manifests = { sourceUpgrades, stewardSafe, vouchers, clc };
  const [source, name] = SOURCE_UPGRADE_TARGETS.pooling.split(":");
  const artifacts: LivePilotArtifacts = {
    sourceUpgrades: { [SOURCE_UPGRADE_TARGETS.pooling]: artifact(source, name, []) },
    stewardSafe: Object.fromEntries(
      ["StewardRolePublisher", "StewardSafeReceiver"].map((n) => [
        n,
        artifact(`src/accounts/${n}.sol`, n, [
          n === "StewardRolePublisher"
            ? "constructor(address,address,address,uint256,address)"
            : "constructor(address,address,address,uint256,uint256)",
        ]),
      ]),
    ) as StewardArtifacts,
    vouchers: Object.fromEntries(
      VOUCHER_CONTRACTS.map(({ name: n, source: s }) => [
        n,
        artifact(
          s,
          n,
          n === "ERC1967Proxy"
            ? ["constructor(address,bytes)"]
            : n.endsWith("Lib") || n === "VoucherRedemptionTransfers"
              ? []
              : [
                  "constructor(address)",
                  `function initialize(${n === "VoucherEntitlementModule" ? "address,address,uint64,uint256,address,address,address" : n === "VoucherRedemptionModule" ? "address,address,uint64,uint256,address,address" : "address,address,uint64,uint256,address"})`,
                ],
        ),
      ]),
    ),
    clc: artifact(CLC_TIMELOCK_SOURCE, "TimelockController", CLC_TIMELOCK_ABI),
  };
  return { config: structuredClone(config), manifests, artifacts, sourceCommit: commit };
}
function withPlans(f: ReturnType<typeof fixture>) {
  return {
    ...f,
    plans: {
      sourceUpgrades: buildSourceUpgradePlan(f.manifests.sourceUpgrades, f.artifacts.sourceUpgrades, commit),
      stewardSafe: buildStewardPlan(f.manifests.stewardSafe, f.artifacts.stewardSafe, commit),
      vouchers: buildVoucherPlan(f.manifests.vouchers, f.artifacts.vouchers, commit),
      clc: buildCLCPilotPlan(f.manifests.clc, f.artifacts.clc, commit),
    },
  };
}
describe("live pilot package preparation", () => {
  it("preserves missing public inputs and separates live ceremonies from deployment prerequisites", () => {
    const manifests: LivePilotManifests = {
      sourceUpgrades: sourceDraft,
      stewardSafe: stewardDraft,
      vouchers: voucherDraft,
      clc: clcDraft,
    };
    const report = inspectLivePilotPackageInputs(config, manifests);
    expect(report.deploymentMissing).toContain("clc.techAndSunSafe");
    expect(report.deploymentMissing).not.toContain("stewardSafe.confirmedStewards");
    expect(report.activationMissing).toContain("stewardSafe.confirmedStewards");
    expect(report.activationMissing).toContain("live.techAndSunSafeReceiverReadback");
    expect(report.activationMissing).not.toContain("clc.issuers.greenGoods.poolHeadroom");
    expect(clcDraft.techAndSunSafe).toBeNull();
    expect(() =>
      buildLivePilotPackage({
        ...fixture(),
        manifests,
        plans: { sourceUpgrades: null, stewardSafe: null, vouchers: null, clc: null },
      }),
    ).toThrow("deployment inputs");
  });
  it("retains the pool headroom activation gate if an operator restores a cap equal to starting stock", () => {
    const f = fixture();
    for (const issuer of Object.values(f.manifests.clc.issuers)) issuer.poolHoldingCap = issuer.poolInventory;
    const p = buildLivePilotPackage(withPlans(f));
    expect(p.activationMissing).toContain("clc.issuers.greenGoods.poolHeadroom");
    expect(p.activationMissing).toContain("clc.issuers.techAndSun.poolHeadroom");
  });
  it("validates four actual component plans and preserves their exact native transaction boundaries", () => {
    const input = withPlans(fixture());
    const p = buildLivePilotPackage(input);
    expect(p.sourceCommit).toBe(commit);
    expect(Object.keys(p.componentHashes)).toEqual(["sourceUpgrades", "stewardSafe", "vouchers", "clc"]);
    expect(p.nativeNonceRanges).toEqual([
      {
        phase: "source",
        chainId: 42161,
        from: address(101),
        firstNonce: 10,
        lastNonce: 10,
        count: 1,
        requiresNonceRefreeze: false,
      },
      {
        phase: "downstream",
        chainId: 42161,
        from: address(101),
        firstNonce: 11,
        lastNonce: 17,
        count: 7,
        requiresNonceRefreeze: true,
      },
      {
        phase: "downstream",
        chainId: 100,
        from: address(102),
        firstNonce: 20,
        lastNonce: 35,
        count: 16,
        requiresNonceRefreeze: true,
      },
    ]);
    expect(p.stages.flatMap((s) => s.transactions).every((tx) => tx.reviewOnly)).toBe(true);
    expect(p.activationIncluded).toBe(false);
    expect(p.executionReady).toBe(false);
    expect(p.stages.flatMap((s) => s.transactions).some((tx) => "executable" in tx)).toBe(false);
    expect(p.liveBroadcast).toBe(false);
    expect(p.stages.find((s) => s.id === "source-bindings")?.transactions).toHaveLength(2);
    expect(p.stages.find((s) => s.id === "final-activation")?.transactions).toEqual([]);
    expect(p.stages.find((s) => s.id === "external-hats-upgrade")?.instructions.join(" ")).toContain(
      "before nonce freeze",
    );
  });
  it.each([
    "revision",
    "payload",
    "nonce",
    "artifact",
  ])("rejects component %s drift before adopting calldata", (kind) => {
    const input = withPlans(fixture());
    if (kind === "revision") input.plans.vouchers.sourceCommit = "b".repeat(40);
    if (kind === "payload") input.plans.stewardSafe.transactions[0].data += "00";
    if (kind === "nonce") input.manifests.clc.nonce = 99;
    if (kind === "artifact") input.artifacts.clc.bytecode.object += "00";
    expect(() => buildLivePilotPackage(input)).toThrow();
  });
  it.each(["overlap", "gap", "order"])("rejects valid component plans with native nonce %s", (kind) => {
    const f = fixture();
    f.manifests.vouchers.networks.arbitrum.nonce = kind === "overlap" ? 11 : kind === "gap" ? 13 : 9;
    expect(() => buildLivePilotPackage(withPlans(f))).toThrow("nonce");
  });
  it.each([
    "GG reserve",
    "pool Safe",
    "TS threshold",
    "TS Safe",
    "Pooling",
    "Hats",
    "adapter",
    "native Safe sender",
    "plan path",
  ])("rejects mismatched %s authority or linkage", (kind) => {
    const f = fixture();
    if (kind === "GG reserve") f.manifests.vouchers.governance.greenGoods.address = address(200);
    if (kind === "pool Safe") f.manifests.vouchers.governance.sharedPool.address = address(200);
    if (kind === "TS threshold") f.manifests.vouchers.governance.techAndSun.threshold = 3;
    if (kind === "TS Safe") f.manifests.vouchers.governance.techAndSun.address = address(200);
    if (kind === "Pooling") f.manifests.vouchers.networks.arbitrum.commitmentPooling = address(200);
    if (kind === "Hats") f.manifests.vouchers.networks.arbitrum.hatsModule = address(200);
    if (kind === "adapter") f.manifests.clc.earnedAdapter = address(200);
    if (kind === "native Safe sender")
      f.manifests.stewardSafe.networks.gnosis.deployer = f.manifests.clc.techAndSunSafe;
    if (kind === "plan path") f.config.manifests.clc = ".plans/fake.json";
    expect(() => buildLivePilotPackage(withPlans(f))).toThrow();
  });
  it("keeps unverified receiver-derived Safe and reserve authorization out of executable actions", () => {
    const input = withPlans(fixture());
    const p = buildLivePilotPackage(input);
    expect(p.activationMissing).toContain("live.techAndSunSafeReceiverReadback");
    expect(p.activationMissing).toContain("live.sameAddressMemberSigningCeremony");
    const pending = p.stages
      .find((s) => s.id === "clc-issuance")
      ?.transactions.filter((tx) => tx.operation === "configureAsset");
    expect(pending).toHaveLength(2);
    expect(pending?.every((tx) => tx.data === null && tx.missing.length > 0 && tx.reviewOnly)).toBe(true);
    expect(p.stages.find((s) => s.id === "steward-observer")?.transactions[0].from).toBeNull();
  });
  it("stops for source protocol readback and regenerates downstream nonces before Redemption initialization", () => {
    const p = buildLivePilotPackage(withPlans(fixture()));
    const ids = p.stages.map((s) => s.id);
    expect(ids.indexOf("source-paused-upgrades")).toBeLessThan(ids.indexOf("source-upgrade-boundary"));
    expect(ids.indexOf("source-upgrade-boundary")).toBeLessThan(ids.indexOf("voucher-deployments"));
    expect(p.stages.find((s) => s.id === "source-upgrade-boundary")?.instructions.join(" ")).toContain(
      "VoucherRedemptionModule.initialize requires",
    );
    for (const stage of p.stages.filter((s) =>
      ["steward-deployments", "voucher-deployments", "clc-deployments"].includes(s.id),
    )) {
      expect(stage.transactions.every((tx) => tx.requiresNonceRefreeze && tx.reviewOnly)).toBe(true);
    }
  });
});
