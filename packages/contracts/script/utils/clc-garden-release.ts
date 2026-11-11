import { getAddress, getCreate2Address, Interface, isAddress, MaxUint256, ZeroAddress } from "ethers";
import deployed from "../../deployments/100-pilot-downstream.json";
import { type CLCMemberAsset, inspectCLCMemberAssets } from "./clc-member-inputs";
import {
  CLC_DEPENDENCIES,
  CLC_FACTORY_ABI,
  CLC_FACTORY_INIT_CODE_HASH,
  CLC_FEE_POLICY_ABI,
  CLC_INDEX_ABI,
  CLC_LIMITER_ABI,
  CLC_POOL_ABI,
  CLC_PROTOCOL_FEE_ABI,
  CLC_QUOTER_ABI,
  CLC_TOKEN_ABI,
  type CLCReviewTransaction,
} from "./clc-release";
import { voucherDigest } from "./voucher-release";

export const CLC_POOL_COMPONENTS = ["index", "limiter", "quoter", "feePolicy", "protocolFee", "pool"] as const;
export type CLCGardenPoolComponent = (typeof CLC_POOL_COMPONENTS)[number];
type Approval = { reference: string | null; digest: string | null };
export interface CLCGardenListing {
  assetId: string;
  priceIndex: string | null;
  poolHoldingCap: string | null;
  inventory: string | null;
  approval: Approval;
}
export interface CLCGardenManifest {
  schemaVersion: 3;
  releaseId: string;
  chainId: 100;
  deployer: string | null;
  nonce: number | null;
  local: {
    id: "tech-and-sun";
    garden: string;
    name: string;
    symbol: string;
    owner: string;
    proxyAdmin: string;
    poolFee: string;
    protocolFee: string;
    policyApproval: Approval;
    listings: CLCGardenListing[];
  };
  members: CLCMemberAsset[];
}
export interface CLCGardenPool {
  id: string;
  chainId: 100;
  mode: "adopt" | "deploy";
  garden: string;
  owner: string;
  proxyAdmin: string;
  addresses: Record<CLCGardenPoolComponent, string>;
  listings: CLCGardenListing[];
}
export interface CLCGardenDeployment {
  component: `tech-and-sun:${CLCGardenPoolComponent}` | `member:${string}:token`;
  chainId: 100;
  from: string;
  nonce: number;
  address: string;
  to: string;
  value: "0";
  data: string;
  salt: string;
  implementation: string;
  admin: string;
  initializer: string;
}
export interface CLCGardenPlan {
  schemaVersion: 3;
  kind: "CLC_GARDEN_EXCHANGE_PREPARATION";
  releaseId: string;
  sourceCommit: string;
  manifestHash: string;
  adoptionHash: string;
  pools: { greenGoods: CLCGardenPool; techAndSun: CLCGardenPool };
  assets: { id: string; token: string; ownerReserve: string; mode: "adopt" | "deploy" }[];
  transactions: CLCGardenDeployment[];
  configurationTransactions: CLCReviewTransaction[];
  fundingTransactions: CLCReviewTransaction[];
  issuanceTransactions: CLCReviewTransaction[];
  activationMissing: string[];
  newInventory: { tokens: number; pools: 1; administration: 0 };
  activationIncluded: false;
  liveBroadcast: false;
}

/** Historical identities are adopted, never re-predicted from a new deployer's nonce. */
export function existingCLCAddress(component: string): string {
  const record = deployed.contracts.findLast((row) => row.contract === component);
  if (!record) throw new Error(`Missing existing CLC deployment: ${component}`);
  return getAddress(record.address);
}
const GG_OWNER = getAddress(deployed.endpointOwner);
const TAS_OWNER = getAddress("0x9BE5f0D6B95Ea3735df71023F5dFED53b4c1aABf");
function record(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  if (Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(value, key)))
    throw new Error(`Invalid ${label} fields`);
  return value as Record<string, unknown>;
}
function address(value: unknown, label: string): string {
  if (typeof value !== "string" || !isAddress(value) || getAddress(value) === ZeroAddress)
    throw new Error(`Invalid ${label}`);
  return getAddress(value);
}
function amount(value: unknown, label: string, missing: string[], zero = false): bigint | null {
  if (value === null) {
    missing.push(label);
    return null;
  }
  if (
    typeof value !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(value) ||
    BigInt(value) >= MaxUint256 ||
    (!zero && BigInt(value) === 0n)
  )
    throw new Error(`Invalid ${label}`);
  return BigInt(value);
}
function approval(value: unknown, label: string, missing: string[]): void {
  const proof = record(value, ["reference", "digest"], label);
  if (proof.reference === null) missing.push(`${label}.reference`);
  else {
    if (typeof proof.reference !== "string") throw new Error(`Invalid ${label}.reference`);
    const url = new URL(proof.reference);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error(`Invalid ${label}.reference`);
  }
  if (proof.digest === null) missing.push(`${label}.digest`);
  else if (typeof proof.digest !== "string" || !/^0x[0-9a-f]{64}$/.test(proof.digest))
    throw new Error(`Invalid ${label}.digest`);
}
export function inspectCLCGardenManifest(value: unknown) {
  const m = record(
    value,
    ["schemaVersion", "releaseId", "chainId", "deployer", "nonce", "local", "members"],
    "garden manifest",
  );
  if (
    m.schemaVersion !== 3 ||
    m.chainId !== 100 ||
    typeof m.releaseId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(m.releaseId)
  )
    throw new Error("Invalid garden exchange identity");
  const deploymentMissing: string[] = [];
  const activationMissing: string[] = [];
  const deployer = m.deployer === null ? null : address(m.deployer, "deployer");
  if (!deployer) deploymentMissing.push("deployer");
  if (m.nonce === null) deploymentMissing.push("nonce");
  else if (!Number.isSafeInteger(m.nonce) || (m.nonce as number) < 0)
    throw new Error("Invalid garden deployment nonce");
  const local = record(
    m.local,
    ["id", "garden", "name", "symbol", "owner", "proxyAdmin", "poolFee", "protocolFee", "policyApproval", "listings"],
    "local",
  );
  if (
    local.id !== "tech-and-sun" ||
    address(local.owner, "local.owner") !== TAS_OWNER ||
    address(local.proxyAdmin, "local.proxyAdmin") !== existingCLCAddress("techAndSunTimelock") ||
    address(local.garden, "local.garden") !== getAddress("0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3")
  )
    throw new Error("Preserve the TAS garden, Safe and approved upgrade authority");
  if ([GG_OWNER, TAS_OWNER].includes(deployer ?? ""))
    throw new Error("Deployment sender cannot be a collective issuer");
  if (
    typeof local.name !== "string" ||
    !/^[\x20-\x7e]{1,100}$/.test(local.name) ||
    local.name.trim() !== local.name ||
    typeof local.symbol !== "string" ||
    !/^[A-Z][A-Z0-9]{1,11}$/.test(local.symbol)
  )
    throw new Error("Invalid local pool name or symbol");
  for (const key of ["poolFee", "protocolFee"]) {
    const fee = amount(local[key], `local.${key}`, deploymentMissing, true);
    if (fee !== null && fee > 1_000_000n) throw new Error(`Invalid local.${key}`);
  }
  approval(local.policyApproval, "local.policyApproval", activationMissing);
  if (!Array.isArray(local.listings) || local.listings.length !== 1)
    throw new Error("Initial local collective listing must contain TSV only");
  for (const raw of local.listings) {
    const listing = record(raw, ["assetId", "priceIndex", "poolHoldingCap", "inventory", "approval"], "local listing");
    if (listing.assetId !== "techAndSun") throw new Error("Initial local collective listing must be TSV");
    const prefix = "local.listings.techAndSun";
    amount(listing.priceIndex, `${prefix}.priceIndex`, activationMissing);
    const cap = amount(listing.poolHoldingCap, `${prefix}.poolHoldingCap`, activationMissing);
    const inventory = amount(listing.inventory, `${prefix}.inventory`, activationMissing, true);
    if (cap !== null && inventory !== null && cap <= inventory)
      throw new Error("Local inventory requires holding-cap headroom");
    approval(listing.approval, `${prefix}.approval`, activationMissing);
  }
  const members = inspectCLCMemberAssets(m.members, [deployer, GG_OWNER, TAS_OWNER], ["GGV", "TSV"]);
  deploymentMissing.push(...members.deploymentMissing);
  activationMissing.push(...members.activationMissing);
  if ((m.members as CLCMemberAsset[]).some((asset) => ["greenGoods", "techAndSun"].includes(asset.id)))
    throw new Error("Duplicate collective asset id");
  if (typeof m.nonce === "number" && m.nonce > Number.MAX_SAFE_INTEGER - 6 - (m.members as unknown[]).length)
    throw new Error("Garden deployment nonce overflow");
  activationMissing.push(
    "live.techAndSunOneApprovalPolicy",
    "live.currentAuthorityInventoryAndSourceReadback",
    "live.explicitActivationAuthorization",
  );
  if ((m.members as unknown[]).length) activationMissing.push("members.actualMemberSigningAndReadback");
  return { manifest: structuredClone(value) as CLCGardenManifest, deploymentMissing, activationMissing };
}
function encode(abi: readonly string[], method: string, args: unknown[]): string {
  return new Interface(abi).encodeFunctionData(method, args);
}
export function buildCLCGardenPlan(value: unknown, sourceCommit: string): CLCGardenPlan {
  const { manifest: m, deploymentMissing, activationMissing } = inspectCLCGardenManifest(value);
  if (deploymentMissing.length || m.deployer === null || m.nonce === null)
    throw new Error(`Missing garden deployment inputs: ${deploymentMissing.join(", ")}`);
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("Invalid source revision");
  const deployer = getAddress(m.deployer);
  const transactions: CLCGardenDeployment[] = [];
  const localAddresses = {} as Record<CLCGardenPoolComponent, string>;
  const saltFor = (component: string) =>
    `0x${deployer.slice(2).toLowerCase()}${voucherDigest({ releaseId: m.releaseId, component, owner: m.local.owner, admin: m.local.proxyAdmin }).slice(0, 24)}`;
  for (const component of CLC_POOL_COMPONENTS)
    localAddresses[component] = getCreate2Address(
      CLC_DEPENDENCIES.factory.address,
      saltFor(component),
      CLC_FACTORY_INIT_CODE_HASH,
    );
  const addProxy = (
    component: CLCGardenDeployment["component"],
    salt: string,
    implementation: string,
    admin: string,
    initializer: string,
  ) => {
    transactions.push({
      component,
      chainId: 100,
      from: deployer,
      nonce: m.nonce! + transactions.length,
      address: getCreate2Address(CLC_DEPENDENCIES.factory.address, salt, CLC_FACTORY_INIT_CODE_HASH),
      to: CLC_DEPENDENCIES.factory.address,
      value: "0",
      salt,
      implementation,
      admin: getAddress(admin),
      initializer,
      data: encode(CLC_FACTORY_ABI, "deployDeterministicAndCall", [implementation, admin, salt, initializer]),
    });
  };
  const owner = getAddress(m.local.owner);
  const initializers: Record<CLCGardenPoolComponent, string> = {
    index: encode(CLC_INDEX_ABI, "initialize", [owner, [], []]),
    limiter: encode(CLC_LIMITER_ABI, "initialize", [owner]),
    quoter: encode(CLC_QUOTER_ABI, "initialize", [owner]),
    feePolicy: encode(CLC_FEE_POLICY_ABI, "initialize", [owner, m.local.poolFee]),
    protocolFee: encode(CLC_PROTOCOL_FEE_ABI, "initialize", [owner, m.local.protocolFee, owner]),
    pool: encode(CLC_POOL_ABI, "initialize", [
      m.local.name,
      m.local.symbol,
      6,
      owner,
      localAddresses.feePolicy,
      owner,
      localAddresses.index,
      localAddresses.limiter,
      localAddresses.quoter,
      true,
      localAddresses.protocolFee,
    ]),
  };
  for (const component of CLC_POOL_COMPONENTS)
    addProxy(
      `tech-and-sun:${component}`,
      saltFor(component),
      CLC_DEPENDENCIES[component].address,
      m.local.proxyAdmin,
      initializers[component],
    );
  const assets: CLCGardenPlan["assets"] = [
    { id: "greenGoods", token: existingCLCAddress("greenGoodsToken"), ownerReserve: GG_OWNER, mode: "adopt" },
    { id: "techAndSun", token: existingCLCAddress("techAndSunToken"), ownerReserve: TAS_OWNER, mode: "adopt" },
  ];
  const listings = structuredClone(m.local.listings);
  for (const member of m.members) {
    if (!member.ownerReserve || !member.name || !member.symbol) throw new Error("Missing member deployment inputs");
    const salt = `0x${deployer.slice(2).toLowerCase()}${voucherDigest({ releaseId: m.releaseId, id: member.id, owner: member.ownerReserve, name: member.name, symbol: member.symbol }).slice(0, 24)}`;
    addProxy(
      `member:${member.id}:token`,
      salt,
      CLC_DEPENDENCIES.token.address,
      member.ownerReserve,
      encode(CLC_TOKEN_ABI, "initialize", [member.name, member.symbol, 6, member.ownerReserve, 0]),
    );
    assets.push({
      id: member.id,
      token: transactions.at(-1)!.address,
      ownerReserve: getAddress(member.ownerReserve),
      mode: "deploy",
    });
    listings.push({
      assetId: member.id,
      priceIndex: member.priceIndex,
      poolHoldingCap: member.poolHoldingCap,
      inventory: member.poolInventory,
      approval: member.service.approval,
    });
  }
  const configurationTransactions: CLCReviewTransaction[] = [];
  const fundingTransactions: CLCReviewTransaction[] = [];
  const issuanceTransactions: CLCReviewTransaction[] = [];
  const draft = (list: CLCReviewTransaction[], from: string, to: string, operation: string, data: string | null) =>
    list.push({
      chainId: 100,
      from,
      to,
      value: "0",
      operation,
      data,
      executable: false,
      missing: [...activationMissing],
      reviewOnly: true,
    });
  for (const listing of listings) {
    const asset = assets.find((row) => row.id === listing.assetId)!;
    draft(
      configurationTransactions,
      owner,
      localAddresses.index,
      "register",
      encode(CLC_INDEX_ABI, "register", [asset.token]),
    );
    draft(
      configurationTransactions,
      owner,
      localAddresses.limiter,
      "setLimitFor",
      listing.poolHoldingCap === null
        ? null
        : encode(CLC_LIMITER_ABI, "setLimitFor", [asset.token, localAddresses.pool, listing.poolHoldingCap]),
    );
    draft(
      configurationTransactions,
      owner,
      localAddresses.quoter,
      "setPriceIndexValue",
      listing.priceIndex === null
        ? null
        : encode(CLC_QUOTER_ABI, "setPriceIndexValue", [asset.token, listing.priceIndex]),
    );
    draft(
      fundingTransactions,
      asset.ownerReserve,
      asset.token,
      "approvePool",
      listing.inventory === null ? null : encode(CLC_TOKEN_ABI, "approve", [localAddresses.pool, listing.inventory]),
    );
    draft(
      fundingTransactions,
      asset.ownerReserve,
      localAddresses.pool,
      "deposit",
      listing.inventory === null ? null : encode(CLC_POOL_ABI, "deposit", [asset.token, listing.inventory]),
    );
  }
  for (const member of m.members) {
    const asset = assets.find((row) => row.id === member.id)!;
    draft(
      issuanceTransactions,
      asset.ownerReserve,
      asset.token,
      "mintTo",
      member.initialSupply === null
        ? null
        : encode(CLC_TOKEN_ABI, "mintTo", [asset.ownerReserve, member.initialSupply]),
    );
    const adapter = existingCLCAddress("GnosisVoucherAdapter");
    draft(
      issuanceTransactions,
      asset.ownerReserve,
      adapter,
      "configureAsset",
      member.sourceAuthority === null
        ? null
        : encode(["function configureAsset(address,address,bool)"], "configureAsset", [
            asset.token,
            member.sourceAuthority,
            true,
          ]),
    );
    draft(
      issuanceTransactions,
      asset.ownerReserve,
      asset.token,
      "approveAdapter",
      member.adapterAllowance === null ? null : encode(CLC_TOKEN_ABI, "approve", [adapter, member.adapterAllowance]),
    );
  }
  draft(configurationTransactions, owner, localAddresses.pool, "seal", encode(CLC_POOL_ABI, "seal", [31]));
  const existingAddresses = Object.fromEntries(
    CLC_POOL_COMPONENTS.map((component) => [component, existingCLCAddress(component)]),
  ) as Record<CLCGardenPoolComponent, string>;
  return {
    schemaVersion: 3,
    kind: "CLC_GARDEN_EXCHANGE_PREPARATION",
    releaseId: m.releaseId,
    sourceCommit,
    manifestHash: voucherDigest(m),
    adoptionHash: voucherDigest(deployed),
    pools: {
      greenGoods: {
        id: "green-goods",
        chainId: 100,
        mode: "adopt",
        garden: "0xf401f34378384713222d1d21f63359cc4E8a858a",
        owner: GG_OWNER,
        proxyAdmin: existingCLCAddress("greenGoodsTimelock"),
        addresses: existingAddresses,
        listings: assets
          .filter((asset) => asset.mode === "adopt")
          .map((asset) => ({
            assetId: asset.id,
            priceIndex: null,
            poolHoldingCap: null,
            inventory: null,
            approval: { reference: null, digest: null },
          })),
      },
      techAndSun: {
        id: m.local.id,
        chainId: 100,
        mode: "deploy",
        garden: m.local.garden,
        owner,
        proxyAdmin: getAddress(m.local.proxyAdmin),
        addresses: localAddresses,
        listings,
      },
    },
    assets,
    transactions,
    configurationTransactions,
    fundingTransactions,
    issuanceTransactions,
    activationMissing,
    newInventory: { tokens: m.members.length, pools: 1, administration: 0 },
    activationIncluded: false,
    liveBroadcast: false,
  };
}
export function validateCLCGardenPlan(
  plan: unknown,
  manifest: unknown,
  sourceCommit: string,
): asserts plan is CLCGardenPlan {
  if (voucherDigest(plan) !== voucherDigest(buildCLCGardenPlan(manifest, sourceCommit)))
    throw new Error("CLC garden release plan mismatch");
}
