import { getAddress, getCreate2Address, Interface } from "ethers";
import { type CLCMemberAsset, type CLCMemberManifest, inspectCLCMemberManifest } from "./clc-member-inputs";
import {
  buildCLCPilotPlan,
  CLC_DEPENDENCIES,
  CLC_FACTORY_ABI,
  CLC_FACTORY_INIT_CODE_HASH,
  CLC_INDEX_ABI,
  CLC_LIMITER_ABI,
  CLC_POOL_ABI,
  CLC_QUOTER_ABI,
  CLC_TOKEN_ABI,
  type CLCDeploymentTransaction,
  type CLCPilotManifest,
  type CLCPilotPlan,
  type CLCReviewTransaction,
  inspectCLCPilotManifest,
} from "./clc-release";
import { type VoucherArtifact, voucherDigest } from "./voucher-release";

export type CLCReleaseManifest = CLCPilotManifest | CLCMemberManifest;
export type CLCMemberDeployment = Omit<CLCDeploymentTransaction, "component"> & { component: `member:${string}:token` };
export interface CLCResolvedMemberAsset extends CLCMemberAsset {
  ownerReserve: string;
  token: string;
  admin: string;
  upgradeControl: { kind: "member" };
  initialState: { supply: "0"; allowance: "0"; poolInventory: "0" };
}
export interface CLCMemberPlan extends Omit<CLCPilotPlan, "schemaVersion" | "kind" | "transactions"> {
  schemaVersion: 2;
  kind: "CLC_MEMBER_PILOT_PREPARATION";
  purpose: CLCMemberManifest["purpose"];
  basePlan: CLCPilotPlan;
  basePlanHash: string;
  memberAssets: CLCResolvedMemberAsset[];
  transactions: Array<CLCDeploymentTransaction | CLCMemberDeployment>;
  newInventory: { tokens: number; administration: 0; pools: 0 };
  executionReady: false;
}
export type CLCReleasePlan = CLCPilotPlan | CLCMemberPlan;

export function inspectCLCReleaseManifest(value: unknown) {
  if ((value as { schemaVersion?: unknown })?.schemaVersion === 2) return inspectCLCMemberManifest(value);
  return inspectCLCPilotManifest(value);
}
export function getCLCBaseManifest(manifest: CLCReleaseManifest): CLCPilotManifest {
  return manifest.schemaVersion === 2 ? manifest.base : manifest;
}
export function getCLCBasePlan(plan: CLCReleasePlan): CLCPilotPlan {
  return plan.schemaVersion === 2 ? plan.basePlan : plan;
}
export function getCLCIssuerBindings(manifest: CLCReleaseManifest, plan: CLCReleasePlan) {
  const base = getCLCBaseManifest(manifest);
  const addresses = getCLCBasePlan(plan).addresses;
  const bindings = (["greenGoods", "techAndSun"] as const).map((id) => ({
    authority: base.issuers[id].sourceIssuerAuthority,
    reserve: id === "greenGoods" ? base.greenGoodsSafe : base.techAndSunSafe,
    token: addresses[id === "greenGoods" ? "greenGoodsToken" : "techAndSunToken"],
    missing: base.issuers[id].sourceIssuerAuthority ? [] : [`clc.issuers.${id}.sourceIssuerAuthority`],
  }));
  if (plan.schemaVersion === 2)
    bindings.push(
      ...plan.memberAssets.map((asset) => ({
        authority: asset.sourceAuthority,
        reserve: asset.ownerReserve,
        token: asset.token,
        missing: [
          ...(asset.sourceAuthority ? [] : [`clc.members.assets.${asset.id}.sourceAuthority`]),
          "live.exactMemberAuthorityApprovalAndPausedReadback",
        ],
      })),
    );
  return bindings;
}
function encode(abi: readonly string[], method: string, args: unknown[]): string {
  return new Interface(abi).encodeFunctionData(method, args);
}
export function buildCLCReleasePlan(value: unknown, artifact: VoucherArtifact, sourceCommit: string): CLCReleasePlan {
  if ((value as { schemaVersion?: unknown })?.schemaVersion !== 2)
    return buildCLCPilotPlan(value, artifact, sourceCommit);
  const { manifest: m, deploymentMissing, activationMissing } = inspectCLCMemberManifest(value);
  if (deploymentMissing.length || m.members.deployer === null || m.members.nonce === null)
    throw new Error(`Missing member deployment inputs: ${deploymentMissing.join(", ")}`);
  const basePlan = buildCLCPilotPlan(m.base, artifact, sourceCommit);
  const deployer = getAddress(m.members.deployer);
  const baseManifestHash = voucherDigest(m.base);
  const memberAssets: CLCResolvedMemberAsset[] = [];
  const transactions: CLCMemberDeployment[] = [];
  const configurationTransactions = [...basePlan.configurationTransactions];
  const issuanceTransactions = [...basePlan.issuanceTransactions];
  for (const [index, asset] of m.members.assets.entries()) {
    if (
      asset.ownerReserve === null ||
      asset.name === null ||
      asset.symbol === null ||
      asset.upgradeControl?.kind !== "member"
    )
      throw new Error("Missing member deployment inputs");
    const owner = getAddress(asset.ownerReserve);
    // Only deployment facts affect this asset's salt; the full manifest still binds every term/rate/quantity.
    const descriptor = {
      id: asset.id,
      ownerReserve: owner,
      name: asset.name,
      symbol: asset.symbol,
      upgradeControl: asset.upgradeControl,
    };
    const salt = `0x${deployer.slice(2).toLowerCase()}${voucherDigest({ releaseId: m.releaseId, baseManifestHash, descriptor }).slice(0, 24)}`;
    const token = getCreate2Address(CLC_DEPENDENCIES.factory.address, salt, CLC_FACTORY_INIT_CODE_HASH);
    const initializer = encode(CLC_TOKEN_ABI, "initialize", [asset.name, asset.symbol, 6, owner, 0]);
    transactions.push({
      component: `member:${asset.id}:token`,
      chainId: 100,
      kind: "proxy",
      from: deployer,
      nonce: m.members.nonce + index,
      address: token,
      to: CLC_DEPENDENCIES.factory.address,
      value: "0",
      salt,
      implementation: CLC_DEPENDENCIES.token.address,
      admin: owner,
      initializer,
      data: encode(CLC_FACTORY_ABI, "deployDeterministicAndCall", [
        CLC_DEPENDENCIES.token.address,
        owner,
        salt,
        initializer,
      ]),
    });
    memberAssets.push({
      ...structuredClone(asset),
      ownerReserve: owner,
      token,
      admin: owner,
      upgradeControl: { kind: "member" },
      initialState: { supply: "0", allowance: "0", poolInventory: "0" },
    });
    const missing = activationMissing.filter(
      (field) =>
        field.startsWith(`members.assets.${asset.id}.`) ||
        field.startsWith("members.actual") ||
        field.startsWith("members.live") ||
        field.startsWith("members.explicit"),
    );
    const draft = (
      list: CLCReviewTransaction[],
      from: string,
      to: string | null,
      operation: string,
      data: string | null,
      extra: string[] = [],
    ) => {
      const gates = [...missing, ...extra];
      list.push({
        chainId: 100,
        from,
        to,
        value: "0",
        operation,
        data,
        executable: gates.length === 0 && data !== null,
        missing: gates,
        reviewOnly: true,
      });
    };
    draft(
      configurationTransactions,
      m.base.greenGoodsSafe,
      basePlan.addresses.index,
      "register",
      encode(CLC_INDEX_ABI, "register", [token]),
    );
    draft(
      configurationTransactions,
      m.base.greenGoodsSafe,
      basePlan.addresses.limiter,
      "setLimitFor",
      asset.poolHoldingCap === null
        ? null
        : encode(CLC_LIMITER_ABI, "setLimitFor", [token, basePlan.addresses.pool, asset.poolHoldingCap]),
    );
    draft(
      configurationTransactions,
      m.base.greenGoodsSafe,
      basePlan.addresses.quoter,
      "setPriceIndexValue",
      asset.priceIndex === null ? null : encode(CLC_QUOTER_ABI, "setPriceIndexValue", [token, asset.priceIndex]),
    );
    draft(
      issuanceTransactions,
      owner,
      token,
      "mintTo",
      asset.initialSupply === null ? null : encode(CLC_TOKEN_ABI, "mintTo", [owner, asset.initialSupply]),
    );
    draft(
      issuanceTransactions,
      owner,
      token,
      "approvePool",
      asset.poolInventory === null
        ? null
        : encode(CLC_TOKEN_ABI, "approve", [basePlan.addresses.pool, asset.poolInventory]),
    );
    draft(
      issuanceTransactions,
      owner,
      basePlan.addresses.pool,
      "deposit",
      asset.poolInventory === null ? null : encode(CLC_POOL_ABI, "deposit", [token, asset.poolInventory]),
    );
    const authorityReady = m.base.earnedAdapter !== null && asset.sourceAuthority !== null;
    const authorityMissing = m.base.earnedAdapter === null ? ["base.earnedAdapter"] : [];
    draft(
      issuanceTransactions,
      owner,
      m.base.earnedAdapter,
      "configureAsset",
      !authorityReady
        ? null
        : encode(["function configureAsset(address,address,bool)"], "configureAsset", [
            token,
            asset.sourceAuthority,
            true,
          ]),
      authorityMissing,
    );
    draft(
      issuanceTransactions,
      owner,
      token,
      "approveAdapter",
      !authorityReady || asset.adapterAllowance === null
        ? null
        : encode(CLC_TOKEN_ABI, "approve", [m.base.earnedAdapter, asset.adapterAllowance]),
      authorityMissing,
    );
  }
  return {
    ...basePlan,
    schemaVersion: 2,
    kind: "CLC_MEMBER_PILOT_PREPARATION",
    purpose: m.purpose,
    releaseId: m.releaseId,
    manifestHash: voucherDigest(m),
    basePlan,
    basePlanHash: voucherDigest(basePlan),
    memberAssets,
    transactions: [...basePlan.transactions, ...transactions],
    configurationTransactions,
    issuanceTransactions,
    newInventory: { tokens: memberAssets.length, administration: 0, pools: 0 },
    activationMissing,
    executionReady: false,
  };
}
export function validateCLCReleasePlan(
  plan: unknown,
  manifest: CLCReleaseManifest,
  artifact: VoucherArtifact,
  sourceCommit: string,
): asserts plan is CLCReleasePlan {
  if (voucherDigest(plan) !== voucherDigest(buildCLCReleasePlan(manifest, artifact, sourceCommit)))
    throw new Error("CLC release plan mismatch");
}
