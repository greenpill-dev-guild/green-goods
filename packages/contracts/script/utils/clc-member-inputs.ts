import { getAddress, isAddress, MaxUint256, ZeroAddress } from "ethers";
import { type CLCPilotManifest, inspectCLCPilotManifest } from "./clc-release";
import { voucherDigest } from "./voucher-release";

export interface CLCMemberAsset {
  id: string;
  kind: "individual";
  ownerReserve: string | null;
  sourceAuthority: string | null;
  name: string | null;
  symbol: string | null;
  service: {
    unit: string | null;
    terms: { reference: string | null; digest: string | null };
    capacityConfirmed: boolean;
    approval: { reference: string | null; digest: string | null };
  };
  initialSupply: string | null;
  poolInventory: string | null;
  poolHoldingCap: string | null;
  adapterAllowance: string | null;
  priceIndex: string | null;
  upgradeControl: { kind: string } | null;
}
export interface CLCMemberManifest {
  schemaVersion: 2;
  releaseId: string;
  purpose: "live" | "fictional-rehearsal";
  base: CLCPilotManifest;
  members: { deployer: string | null; nonce: number | null; assets: CLCMemberAsset[] };
}
export interface CLCMemberExtension {
  schemaVersion: 1;
  kind: "CLC_MEMBER_EXTENSION";
  releaseId: string;
  purpose: CLCMemberManifest["purpose"];
  baseManifestHash: string;
  members: CLCMemberManifest["members"];
}
function object(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(record, key)))
    throw new Error(`Invalid ${label} fields`);
  return record;
}
function address(value: unknown, label: string, missing: string[]): string | null {
  if (value === null) {
    missing.push(label);
    return null;
  }
  if (typeof value !== "string" || !isAddress(value) || getAddress(value) === ZeroAddress)
    throw new Error(`Invalid ${label}`);
  return getAddress(value);
}
function text(value: unknown, label: string, missing: string[], symbol = false): void {
  if (value === null) missing.push(label);
  else if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !value.length ||
    (symbol
      ? !/^[A-Z][A-Z0-9]{1,11}$/.test(value)
      : value.length > 160 || [...value].some((char) => char.charCodeAt(0) < 32))
  )
    throw new Error(`Invalid ${label}`);
}
function provenance(value: unknown, label: string, missing: string[]): void {
  const p = object(value, ["reference", "digest"], label);
  if (p.reference === null) missing.push(`${label}.reference`);
  else {
    if (typeof p.reference !== "string") throw new Error(`Invalid ${label}.reference`);
    const url = new URL(p.reference);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error(`Invalid ${label}.reference`);
  }
  if (p.digest === null) missing.push(`${label}.digest`);
  else if (typeof p.digest !== "string" || !/^0x[0-9a-f]{64}$/.test(p.digest))
    throw new Error(`Invalid ${label}.digest`);
}
export function inspectCLCMemberManifest(value: unknown): {
  manifest: CLCMemberManifest;
  deploymentMissing: string[];
  activationMissing: string[];
} {
  const m = object(value, ["schemaVersion", "releaseId", "purpose", "base", "members"], "member manifest");
  if (
    m.schemaVersion !== 2 ||
    typeof m.releaseId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(m.releaseId) ||
    !["live", "fictional-rehearsal"].includes(String(m.purpose))
  )
    throw new Error("Invalid member manifest identity");
  const base = inspectCLCPilotManifest(m.base);
  const deploymentMissing = base.deploymentMissing.map((key) => `base.${key}`);
  const activationMissing = base.activationMissing.map((key) => `base.${key}`);
  const members = object(m.members, ["deployer", "nonce", "assets"], "members");
  const deployer = address(members.deployer, "members.deployer", deploymentMissing);
  if (
    deployer &&
    [base.manifest.greenGoodsSafe, base.manifest.techAndSunSafe]
      .filter(Boolean)
      .map((value) => getAddress(value as string))
      .includes(deployer)
  )
    throw new Error("Member deployment sender cannot be a collective issuer");
  if (members.nonce === null) deploymentMissing.push("members.nonce");
  else if (!Number.isSafeInteger(members.nonce) || (members.nonce as number) < 0)
    throw new Error("Invalid members.nonce");
  if (!Array.isArray(members.assets) || !members.assets.length) throw new Error("Member assets required");
  const ids = new Set<string>();
  const owners = new Set<string>();
  const symbols = new Set(Object.values(base.manifest.issuers).map((i) => i.symbol));
  for (const raw of members.assets) {
    const a = object(
      raw,
      [
        "id",
        "kind",
        "ownerReserve",
        "sourceAuthority",
        "name",
        "symbol",
        "service",
        "initialSupply",
        "poolInventory",
        "poolHoldingCap",
        "adapterAllowance",
        "priceIndex",
        "upgradeControl",
      ],
      "member asset",
    );
    if (typeof a.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(a.id) || ids.has(a.id) || a.kind !== "individual")
      throw new Error("Invalid or duplicate member asset identity");
    ids.add(a.id);
    const key = `members.assets.${a.id}`;
    const owner = address(a.ownerReserve, `${key}.ownerReserve`, deploymentMissing);
    address(a.sourceAuthority, `${key}.sourceAuthority`, activationMissing);
    if (owner) {
      if (
        owners.has(owner) ||
        [deployer, base.manifest.deployer, base.manifest.greenGoodsSafe, base.manifest.techAndSunSafe]
          .filter(Boolean)
          .map((v) => getAddress(v as string))
          .includes(owner)
      )
        throw new Error("Member owner must be distinct from deployment senders and collective issuers");
      owners.add(owner);
    }
    text(a.name, `${key}.name`, deploymentMissing);
    text(a.symbol, `${key}.symbol`, deploymentMissing, true);
    if (a.symbol !== null) {
      if (symbols.has(a.symbol as string)) throw new Error("Duplicate member token symbol");
      symbols.add(a.symbol as string);
    }
    if (a.upgradeControl === null) deploymentMissing.push(`${key}.upgradeControl`);
    else {
      const control = object(a.upgradeControl, ["kind"], `${key}.upgradeControl`);
      if (control.kind !== "member") deploymentMissing.push(`${key}.upgradeControl.supportedVariant`);
    }
    const service = object(a.service, ["unit", "terms", "capacityConfirmed", "approval"], `${key}.service`);
    text(service.unit, `${key}.service.unit`, activationMissing);
    provenance(service.terms, `${key}.service.terms`, activationMissing);
    provenance(service.approval, `${key}.service.approval`, activationMissing);
    if (typeof service.capacityConfirmed !== "boolean") throw new Error("Invalid member capacity confirmation");
    if (!service.capacityConfirmed) activationMissing.push(`${key}.service.capacityConfirmed`);
    const amounts: Record<string, bigint> = {};
    for (const field of ["initialSupply", "poolInventory", "poolHoldingCap", "adapterAllowance", "priceIndex"]) {
      const quantity = a[field];
      if (quantity === null) activationMissing.push(`${key}.${field}`);
      else if (
        typeof quantity !== "string" ||
        !/^(0|[1-9][0-9]*)$/.test(quantity) ||
        BigInt(quantity) >= MaxUint256 ||
        (field !== "adapterAllowance" && BigInt(quantity) === 0n)
      )
        throw new Error(`Invalid ${key}.${field}`);
      else amounts[field] = BigInt(quantity);
    }
    const {
      initialSupply: supply,
      poolInventory: inventory,
      poolHoldingCap: cap,
      adapterAllowance: allowance,
    } = amounts;
    if (
      (supply !== undefined && inventory !== undefined && inventory > supply) ||
      (cap !== undefined && inventory !== undefined && cap < inventory) ||
      (supply !== undefined && cap !== undefined && cap > supply) ||
      (supply !== undefined && inventory !== undefined && allowance !== undefined && allowance > supply - inventory)
    )
      throw new Error("Invalid member supply, inventory, cap or finite allowance");
    if (cap !== undefined && cap === inventory) activationMissing.push(`${key}.poolHeadroom`);
  }
  if (typeof members.nonce === "number" && members.nonce > Number.MAX_SAFE_INTEGER - members.assets.length)
    throw new Error("Member deployment nonce overflow");
  if (
    deployer &&
    base.manifest.deployer &&
    getAddress(base.manifest.deployer) === deployer &&
    base.manifest.nonce !== null &&
    members.nonce !== null &&
    members.nonce !== base.manifest.nonce + 10
  )
    throw new Error("Member nonce must follow the unchanged ten-transaction base range");
  if (m.purpose === "fictional-rehearsal") activationMissing.push("members.liveIssuerInputs");
  activationMissing.push("members.actualMemberSigningAndReadback", "members.explicitActivationAuthorization");
  return { manifest: structuredClone(value) as CLCMemberManifest, deploymentMissing, activationMissing };
}
/** A separate input references the authoritative base file instead of copying it in configuration. */
export function composeCLCMemberManifest(base: unknown, value: unknown): CLCMemberManifest {
  const extension = object(
    value,
    ["schemaVersion", "kind", "releaseId", "purpose", "baseManifestHash", "members"],
    "member extension",
  );
  if (
    extension.schemaVersion !== 1 ||
    extension.kind !== "CLC_MEMBER_EXTENSION" ||
    extension.baseManifestHash !== voucherDigest(base)
  )
    throw new Error("Member extension base manifest binding mismatch");
  return inspectCLCMemberManifest({
    schemaVersion: 2,
    releaseId: extension.releaseId,
    purpose: extension.purpose,
    base,
    members: extension.members,
  }).manifest;
}
