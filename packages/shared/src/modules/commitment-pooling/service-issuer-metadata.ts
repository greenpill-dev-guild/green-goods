import { keccak256, stringToHex, type Hex } from "viem";
import { GREEN_GOODS_ISSUER_ROUTE } from "./service-issuer-live-config";
import type { ServiceIssuerAsset, ServiceIssuerRoute } from "./service-issuer-types";

/** Only receipt-backed production configuration belongs here. Fictional fixtures stay in tests. */
export const SERVICE_ISSUER_ROUTES: readonly ServiceIssuerRoute[] = [GREEN_GOODS_ISSUER_ROUTE];
export const ISSUER_REVIEW_SECONDS = 300n;
export const issuerSame = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export const issuerDigest = (value: unknown): Hex =>
  keccak256(stringToHex(JSON.stringify(value, (_, v) => (typeof v === "bigint" ? `${v}n` : v))));
export const issuerSerialize = (value: unknown) =>
  JSON.stringify(value, (_, v) => (typeof v === "bigint" ? { bigint: v.toString() } : v));
export const issuerDeserialize = (value: string): unknown =>
  JSON.parse(value, (_, v) =>
    v && typeof v === "object" && Object.keys(v).length === 1 && /^\d+$/.test(v.bigint)
      ? BigInt(v.bigint)
      : v
  );
const address = (v: unknown) => typeof v === "string" && /^0x(?!0{40}$)[a-f0-9]{40}$/i.test(v);
const hash = (v: unknown) => typeof v === "string" && /^0x(?!0{64}$)[a-f0-9]{64}$/i.test(v);
const finite = (v: unknown): v is bigint =>
  typeof v === "bigint" && v > 0n && v < (1n << 256n) - 1n;

function assertServiceIssuerAsset(asset: ServiceIssuerAsset, recovery = false) {
  const control = asset.upgradeControl;
  if (
    !asset.id ||
    !["individual", "collective"].includes(asset.kind) ||
    !address(asset.ownerReserve) ||
    !address(asset.sourceAuthority) ||
    !issuerSame(asset.token.owner, asset.ownerReserve) ||
    !asset.name.trim() ||
    !asset.symbol.trim() ||
    !Number.isInteger(asset.decimals) ||
    asset.decimals < 0 ||
    asset.decimals > 255 ||
    (asset.delisting !== null &&
      (!asset.delisting.reference.trim() || !hash(asset.delisting.digest))) ||
    (!recovery &&
      (!asset.service.unit?.trim() ||
        asset.service.offers?.some(
          (offer) =>
            !offer.unit.trim() ||
            !finite(offer.serviceUnits) ||
            !finite(offer.voucherUnits) ||
            !hash(offer.serviceTermsRef) ||
            !hash(offer.remedyTermsRef)
        ) ||
        !finite(serviceIssuerIssuanceLimit(asset)) ||
        !asset.service.terms.reference?.trim() ||
        !hash(asset.service.terms.digest) ||
        !asset.service.approval.reference?.trim() ||
        !hash(asset.service.approval.digest) ||
        !finite(asset.initialSupply) ||
        !finite(asset.adapterAllowance) ||
        !finite(asset.poolHoldingCap) ||
        !finite(asset.priceIndex))) ||
    !control ||
    !address(control.admin) ||
    (asset.kind === "individual"
      ? control.kind !== "member"
      : control.kind !== "collective-safe") ||
    (control.kind === "member" && !issuerSame(control.admin, asset.ownerReserve))
  )
    throw new Error("Reviewed issuer terms, capacity, finite limits and explicit control required");
}

/**
 * How many vouchers a member issuer may have issued in all: the lower of the capacity they
 * confirmed and the reviewed issuance ceiling. Null until both are known.
 */
export function serviceIssuerIssuanceLimit(
  asset: Pick<ServiceIssuerAsset, "service" | "initialSupply">
): bigint | null {
  const { capacity } = asset.service;
  if (!finite(capacity) || !finite(asset.initialSupply)) return null;
  const offers = asset.service.offers;
  if (
    offers &&
    (!offers.length ||
      offers.some((offer) => !finite(offer.capacity)) ||
      offers.reduce((sum, offer) => sum + offer.capacity!, 0n) !== capacity)
  )
    return null;
  return capacity < asset.initialSupply ? capacity : asset.initialSupply;
}

export function issuerAsset(route: ServiceIssuerRoute, id: string, recovery = false) {
  const assets = route.assets.filter((a) => a.id === id);
  if (assets.length !== 1) throw new Error("Reviewed issuer asset configuration unavailable");
  const asset = assets[0]!;
  assertServiceIssuerAsset(asset, recovery);
  const base = route.service.assets.find((a) => issuerSame(a.token, asset.token.address));
  if (
    !base ||
    !issuerSame(base.issuer, asset.ownerReserve) ||
    base.decimals !== asset.decimals ||
    base.symbol !== asset.symbol ||
    !issuerSame(base.runtimeCodeHash, asset.token.runtimeCodeHash) ||
    !issuerSame(base.implementation.address, asset.token.implementation.address) ||
    !issuerSame(base.implementation.runtimeCodeHash, asset.token.implementation.runtimeCodeHash)
  )
    throw new Error("Issuer metadata does not match the receipt-backed service asset");
  return asset;
}
