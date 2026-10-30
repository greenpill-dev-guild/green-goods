import { getAddress, Interface } from "ethers";
import { describe, expect, it } from "vitest";
import clcDraft from "../../config/clc-pilot-release.json";
import config from "../../config/live-pilot-release.json";
import sourceDraft from "../../config/source-upgrade-release.json";
import stewardDraft from "../../config/steward-safe-release.json";
import voucherDraft from "../../config/voucher-pilot-release.json";
import { buildCLCPilotPlan, CLC_TIMELOCK_ABI, CLC_TIMELOCK_SOURCE, type CLCPilotManifest } from "./clc-release";
import { buildCLCReleasePlan } from "./clc-member-release";
import { memberReleaseFixture } from "./clc-member.fixtures";
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
      arbitrum: { chainId: 42161, router: address(105), deployer: arbDeployer, nonce: 13 },
      gnosis: { chainId: 100, router: address(106), deployer: gnosisDeployer, nonce: 20 },
    },
  } as StewardManifest;
  const vouchers = structuredClone(voucherDraft) as VoucherManifest;
  Object.assign(vouchers.networks.arbitrum, {
    deployer: arbDeployer,
    nonce: 14,
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
            : "constructor(address,address,address,string,uint256,uint256,address)",
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
  it("keeps fee-floor configuration unresolved until a positive amount is selected", () => {
    const f = fixture();
    const prepared = buildLivePilotPackage(withPlans(f));
    const stage = prepared.stages.find((s) => s.id === "earned-fee-reserve");
    expect(stage?.transactions[0]?.data).toBeNull();
    expect(stage?.transactions[0]?.missing).toContain("live.earnedFeeReserveMinimumWei");
    expect(prepared.activationMissing).toContain("live.earnedFeeReserveMinimumWei");
  });

  it("encodes a selected floor but still requires funding and readback", () => {
    const f = fixture();
    const selected = { ...f.config, earnedFeeReserveMinimumWei: "2000000000000000" };
    const prepared = buildLivePilotPackage({ ...withPlans(f), config: selected });
    const call = prepared.stages.find((s) => s.id === "earned-fee-reserve")!.transactions[0]!;
    expect(call.data).toBe(
      new Interface(["function setFeeReserveMinimum(uint256)"]).encodeFunctionData("setFeeReserveMinimum", [
        selected.earnedFeeReserveMinimumWei,
      ]),
    );
    expect(call.from).toBe(f.manifests.vouchers.governance.greenGoods.address);
    expect(call.to).toBe(
      withPlans(f).plans.vouchers.transactions.find(
        (tx) => tx.contract === "VoucherEntitlementModule" && tx.kind === "proxy",
      )!.address,
    );
    expect(call.missing).toEqual([]);
    expect(prepared.activationMissing).toContain("live.earnedFeeReserveConfigurationAndFundedBalanceReadback");
    expect(prepared.stages.find((s) => s.id === "final-activation")!.transactions).toEqual([]);
  });
  it.each(["0", "-1", "01", "1.5", " ", 1, (1n << 256n).toString()])("rejects invalid retained minimum %s", (floor) => {
    const f = fixture();
    expect(() =>
      inspectLivePilotPackageInputs({ ...f.config, earnedFeeReserveMinimumWei: floor }, f.manifests),
    ).toThrow("Invalid earned fee reserve minimum");
  });
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
        lastNonce: 12,
        count: 3,
        requiresNonceRefreeze: false,
      },
      {
        phase: "downstream",
        chainId: 42161,
        from: address(101),
        firstNonce: 13,
        lastNonce: 19,
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
  it("adds two explicit member assets to the same base pool, exact issuer bindings and native nonce inventory", () => {
    const f = fixture();
    const old = withPlans(f);
    const member = memberReleaseFixture();
    member.base = f.manifests.clc;
    member.members.deployer = f.manifests.clc.deployer;
    member.members.nonce = f.manifests.clc.nonce! + 10;
    const clc = buildCLCReleasePlan(member, f.artifacts.clc, commit);
    const prepared = buildLivePilotPackage({
      ...old,
      manifests: { ...f.manifests, clc: member },
      plans: { ...old.plans, clc },
    });
    expect(prepared.nativeNonceRanges.at(-1)?.count).toBe(18);
    expect(prepared.stages.find((stage) => stage.id === "clc-deployments")?.transactions).toHaveLength(12);
    const bindings = prepared.stages.find((stage) => stage.id === "source-issuer-authorities")!.transactions;
    expect(bindings).toHaveLength(4);
    if (clc.schemaVersion !== 2) throw new Error("Expected member plan");
    const abi = new Interface(["function setIssuerAuthority(address,address,address)"]);
    for (const [index, asset] of clc.memberAssets.entries()) {
      const call = bindings[index + 2];
      expect(call.from).toBe(f.manifests.clc.greenGoodsSafe);
      expect(abi.decodeFunctionData("setIssuerAuthority", call.data!)).toEqual([
        asset.ownerReserve,
        asset.token,
        asset.sourceAuthority,
      ]);
      expect(call.missing).toContain("live.exactMemberAuthorityApprovalAndPausedReadback");
    }
    const issuance = prepared.stages.find((stage) => stage.id === "clc-issuance")!.transactions.slice(10);
    expect(issuance).toHaveLength(10);
    expect(issuance.slice(0, 5).every((call) => call.from === member.members.assets[0].ownerReserve)).toBe(true);
    expect(
      issuance.filter((call) => call.operation === "deposit").every((call) => call.to === clc.basePlan.addresses.pool),
    ).toBe(true);
    expect(prepared.executionReady).toBe(false);
  });
  it("refuses an old two-issuer plan for a changed member descriptor", () => {
    const f = fixture();
    const input = withPlans(f);
    const member = memberReleaseFixture();
    member.base = f.manifests.clc;
    member.members.deployer = f.manifests.clc.deployer;
    member.members.nonce = f.manifests.clc.nonce! + 10;
    expect(() => buildLivePilotPackage({ ...input, manifests: { ...f.manifests, clc: member } })).toThrow(
      "plan mismatch",
    );
  });
  it("reserves all source CREATEs and direct Safe submissions before the downstream nonce budget", () => {
    const f = fixture();
    Object.assign(f.manifests.sourceUpgrades, { settlement: structuredClone(sourceDraft.settlement) });
    const [settlementSource, settlementName] = SOURCE_UPGRADE_TARGETS.settlement.split(":");
    f.artifacts.sourceUpgrades[SOURCE_UPGRADE_TARGETS.settlement] = artifact(settlementSource, settlementName, []);
    const pooling = f.artifacts.sourceUpgrades[SOURCE_UPGRADE_TARGETS.pooling];
    pooling.bytecode.object = `0x${"00".repeat(21 * 20)}60006000f3`;
    pooling.bytecode.linkReferences = {};
    for (let i = 0; i < 21; i++) {
      const source = `src/lib/CommitmentPooling/PackageLibrary${i}.sol`;
      const name = `PackageLibrary${i}`;
      f.artifacts.sourceUpgrades[`${source}:${name}`] = artifact(source, name, []);
      pooling.bytecode.linkReferences[source] = { [name]: [{ start: i * 20, length: 20 }] };
    }
    const source = buildSourceUpgradePlan(f.manifests.sourceUpgrades, f.artifacts.sourceUpgrades, commit);
    expect(source.deployments).toHaveLength(23);
    expect(source.ownerCalls).toHaveLength(4);
    const first = f.manifests.sourceUpgrades.nonce;
    f.manifests.stewardSafe.networks.arbitrum.nonce = first + 27;
    f.manifests.vouchers.networks.arbitrum.nonce = first + 28;
    const p = buildLivePilotPackage(withPlans(f));
    expect(p.nativeNonceRanges.filter((range) => range.chainId === 42161)).toEqual([
      expect.objectContaining({ phase: "source", firstNonce: first, lastNonce: first + 26, count: 27 }),
      expect.objectContaining({ phase: "downstream", firstNonce: first + 27, lastNonce: first + 33, count: 7 }),
    ]);
    const upgrades = p.stages.find((stage) => stage.id === "source-paused-upgrades")!.transactions;
    expect(upgrades.map((tx) => tx.safeNonce)).toEqual([4, 5, 6, 7]);
    expect(upgrades.every((tx) => tx.from === f.manifests.sourceUpgrades.authority.address)).toBe(true);
    const ids = p.stages.map((stage) => stage.id);
    expect(ids.indexOf("source-deployments")).toBeLessThan(ids.indexOf("source-paused-upgrades"));
    expect(ids.indexOf("source-paused-upgrades")).toBeLessThan(ids.indexOf("source-upgrade-boundary"));
    expect(p.stages.find((stage) => stage.id === "steward-deployments")!.transactions[0].nonce).toBe(first + 27);
    f.manifests.stewardSafe.networks.arbitrum.nonce = first + 23;
    f.manifests.vouchers.networks.arbitrum.nonce = first + 24;
    expect(() => buildLivePilotPackage(withPlans(f))).toThrow("nonce");
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
  it("keeps independent deployers' downstream nonce ranges separate", () => {
    const f = fixture();
    f.manifests.stewardSafe.networks.arbitrum.deployer = address(210);
    f.manifests.stewardSafe.networks.arbitrum.nonce = 70;
    f.manifests.vouchers.networks.arbitrum.nonce = 13;
    const ranges = buildLivePilotPackage(withPlans(f)).nativeNonceRanges;
    expect(ranges.find((range) => range.phase === "downstream" && range.from === address(210))).toMatchObject({
      firstNonce: 70,
      lastNonce: 70,
      count: 1,
    });
    expect(ranges.find((range) => range.phase === "downstream" && range.from === address(101))).toMatchObject({
      firstNonce: 13,
      lastNonce: 18,
      count: 6,
    });
  });
  it("rejects source Safe submissions that overflow the deployer's nonce range", () => {
    const f = fixture();
    f.manifests.sourceUpgrades.nonce = Number.MAX_SAFE_INTEGER;
    expect(() => buildLivePilotPackage(withPlans(f))).toThrow("nonce overflow");
  });
  it.each(["overlap", "gap", "order"])("rejects valid component plans with native nonce %s", (kind) => {
    const f = fixture();
    const first = f.manifests.stewardSafe.networks.arbitrum.nonce!;
    f.manifests.vouchers.networks.arbitrum.nonce = kind === "overlap" ? first : kind === "gap" ? first + 2 : first - 2;
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
