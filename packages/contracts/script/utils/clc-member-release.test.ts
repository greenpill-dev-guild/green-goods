import { getAddress, Interface, MaxUint256 } from "ethers";
import { describe, expect, it } from "vitest";
import { composeCLCMemberManifest, inspectCLCMemberManifest } from "./clc-member-inputs";
import {
  memberFixtureAddress as address,
  memberFixtureRevision as revision,
  memberPlannerArtifact,
  memberReleaseFixture,
} from "./clc-member.fixtures";
import { buildCLCReleasePlan, inspectCLCReleaseManifest, validateCLCReleasePlan } from "./clc-member-release";
import { buildCLCPilotPlan, CLC_FACTORY_ABI, CLC_TOKEN_ABI } from "./clc-release";
import { voucherDigest } from "./voucher-release";

describe("additive member CLC release planning", () => {
  it("preserves the complete legacy JSON and its ten deployment identities", () => {
    const m = memberReleaseFixture();
    const old = buildCLCPilotPlan(m.base, memberPlannerArtifact(), revision);
    expect(voucherDigest(old)).toBe("17326e1060de3242ebade53c26e747ed5c02764cd4f59fb682d7b80d33a74434");
    expect(JSON.stringify(buildCLCReleasePlan(m.base, memberPlannerArtifact(), revision))).toBe(JSON.stringify(old));
    expect(inspectCLCReleaseManifest(m.base)).toEqual(inspectCLCReleaseManifest(m.base));
  });
  it("appends two member tokens to the unchanged base without another pool or administration contract", () => {
    const m = memberReleaseFixture();
    const plan = buildCLCReleasePlan(m, memberPlannerArtifact(), revision);
    expect(plan.schemaVersion).toBe(2);
    if (plan.schemaVersion !== 2) throw new Error("Expected member plan");
    const old = buildCLCPilotPlan(m.base, memberPlannerArtifact(), revision);
    expect(plan.basePlan).toEqual(old);
    expect(plan.addresses).toEqual(old.addresses);
    expect(plan.transactions.slice(0, 10)).toEqual(old.transactions);
    expect(plan.transactions.slice(10).map((tx) => tx.nonce)).toEqual([13, 14]);
    expect(plan.transactions).toHaveLength(12);
    expect(plan.newInventory).toEqual({ tokens: 2, administration: 0, pools: 0 });
    expect(plan.executionReady).toBe(false);
  });
  it("initializes the member as both token owner/reserve and selected factory administrator with zero supply", () => {
    const m = memberReleaseFixture();
    const plan = buildCLCReleasePlan(m, memberPlannerArtifact(), revision);
    if (plan.schemaVersion !== 2) throw new Error("Expected member plan");
    const factory = new Interface(CLC_FACTORY_ABI);
    const token = new Interface(CLC_TOKEN_ABI);
    plan.transactions.slice(10).forEach((tx, index) => {
      const member = m.members.assets[index];
      const decoded = factory.decodeFunctionData("deployDeterministicAndCall", tx.data);
      expect(getAddress(decoded[1])).toBe(member.ownerReserve);
      const initialized = token.decodeFunctionData("initialize", decoded[3]);
      expect(initialized[3]).toBe(member.ownerReserve);
      expect(initialized[4]).toBe(0n);
      expect(plan.memberAssets[index].initialState).toEqual({ supply: "0", allowance: "0", poolInventory: "0" });
    });
  });
  it("keeps existing member token salts stable when another member is appended or the roster is reordered", () => {
    const m = memberReleaseFixture();
    const first = buildCLCReleasePlan(m, memberPlannerArtifact(), revision);
    if (first.schemaVersion !== 2) throw new Error("Expected member plan");
    const added = structuredClone(m.members.assets[0]);
    Object.assign(added, {
      id: "third-service",
      symbol: "THR",
      ownerReserve: address(420),
      sourceAuthority: address(420),
    });
    m.members.assets.push(added);
    m.members.assets.reverse();
    const next = buildCLCReleasePlan(m, memberPlannerArtifact(), revision);
    if (next.schemaVersion !== 2) throw new Error("Expected member plan");
    for (const asset of first.memberAssets)
      expect(next.memberAssets.find((candidate) => candidate.id === asset.id)?.token).toBe(asset.token);
    expect(next.manifestHash).not.toBe(first.manifestHash);
  });
  it("binds changed terms, source authority, quantity and rate to the full plan even when deployment identity stays stable", () => {
    const m = memberReleaseFixture();
    const original = buildCLCReleasePlan(m, memberPlannerArtifact(), revision);
    if (original.schemaVersion !== 2) throw new Error("Expected member plan");
    m.members.assets[0].priceIndex = "3000000";
    const changed = buildCLCReleasePlan(m, memberPlannerArtifact(), revision);
    if (changed.schemaVersion !== 2) throw new Error("Expected member plan");
    expect(changed.memberAssets[0].token).toBe(original.memberAssets[0].token);
    expect(changed.manifestHash).not.toBe(original.manifestHash);
    expect(() => validateCLCReleasePlan(original, m, memberPlannerArtifact(), revision)).toThrow("mismatch");
  });
  it("changes only the affected token when its deployment descriptor changes", () => {
    const m = memberReleaseFixture();
    const first = buildCLCReleasePlan(m, memberPlannerArtifact(), revision);
    m.members.assets[0].name += " revised";
    const next = buildCLCReleasePlan(m, memberPlannerArtifact(), revision);
    if (first.schemaVersion !== 2 || next.schemaVersion !== 2) throw new Error("Expected member plan");
    expect(next.memberAssets[0].token).not.toBe(first.memberAssets[0].token);
    expect(next.memberAssets[1].token).toBe(first.memberAssets[1].token);
    expect(next.basePlan).toEqual(first.basePlan);
  });
  it("never treats metadata provenance or fictional terms as live member-operation proof", () => {
    const m = memberReleaseFixture();
    const plan = buildCLCReleasePlan(m, memberPlannerArtifact(), revision);
    expect(plan.activationMissing).toEqual(
      expect.arrayContaining([
        "members.liveIssuerInputs",
        "members.actualMemberSigningAndReadback",
        "members.explicitActivationAuthorization",
      ]),
    );
    expect(plan.activationIncluded).toBe(false);
    expect(plan.liveBroadcast).toBe(false);
  });
  it("leaves unknown live services, quantities, source signers and approvals visible without copying collective values", () => {
    const m = memberReleaseFixture();
    m.purpose = "live";
    Object.assign(m.members.assets[0], {
      sourceAuthority: null,
      initialSupply: null,
      poolInventory: null,
      poolHoldingCap: null,
      adapterAllowance: null,
      priceIndex: null,
    });
    m.members.assets[0].service = {
      unit: null,
      terms: { reference: null, digest: null },
      capacityConfirmed: false,
      approval: { reference: null, digest: null },
    };
    const report = inspectCLCMemberManifest(m);
    expect(report.deploymentMissing).toEqual([]);
    expect(report.activationMissing).toContain("members.assets.analyst-peer-help.priceIndex");
    expect(report.activationMissing).toContain("members.assets.analyst-peer-help.service.approval.digest");
    const plan = buildCLCReleasePlan(m, memberPlannerArtifact(), revision);
    expect(plan.issuanceTransactions.slice(10).every((tx) => tx.executable === false)).toBe(true);
  });
  it.each([
    null,
    { kind: "sharedPoolSafe" },
    { kind: "newMemberSafe" },
    { kind: "memberTimelock" },
  ])("blocks unselected or unsupported control %j without inventing an administrator", (control) => {
    const m = memberReleaseFixture();
    m.members.assets[0].upgradeControl = control;
    expect(inspectCLCMemberManifest(m).deploymentMissing.join(",")).toContain("upgradeControl");
    expect(() => buildCLCReleasePlan(m, memberPlannerArtifact(), revision)).toThrow("deployment inputs");
  });
  it("composes a separately stored extension only against the exact authoritative base descriptor", () => {
    const m = memberReleaseFixture();
    const extension = {
      schemaVersion: 1,
      kind: "CLC_MEMBER_EXTENSION",
      releaseId: m.releaseId,
      purpose: m.purpose,
      baseManifestHash: voucherDigest(m.base),
      members: m.members,
    };
    expect(composeCLCMemberManifest(m.base, extension)).toEqual(m);
    expect(() => composeCLCMemberManifest({ ...m.base, releaseId: "changed" }, extension)).toThrow("binding mismatch");
    expect(() => composeCLCMemberManifest(m.base, { ...extension, automaticActivation: true })).toThrow("fields");
  });
  it.each([
    "owner",
    "source",
    "supply",
    "cap",
    "allowance",
    "symbol",
    "id",
    "nonce",
    "overflow",
    "extra",
    "kind",
  ])("rejects malformed or conflicting %s without preparing calls", (kind) => {
    const m = memberReleaseFixture();
    const a = m.members.assets[0];
    if (kind === "owner") a.ownerReserve = m.base.greenGoodsSafe;
    if (kind === "source") a.sourceAuthority = "0x00";
    if (kind === "supply") a.initialSupply = "3";
    if (kind === "cap") a.poolHoldingCap = "3000000";
    if (kind === "allowance") a.adapterAllowance = MaxUint256.toString();
    if (kind === "symbol") a.symbol = m.base.issuers.greenGoods.symbol;
    if (kind === "id") m.members.assets[1].id = a.id;
    if (kind === "nonce") m.members.nonce = 12;
    if (kind === "overflow") m.members.nonce = Number.MAX_SAFE_INTEGER;
    if (kind === "extra") Reflect.set(a, "reserve", address(430));
    if (kind === "kind") Reflect.set(a, "kind", "collective");
    expect(() => buildCLCReleasePlan(m, memberPlannerArtifact(), revision)).toThrow();
  });
});
