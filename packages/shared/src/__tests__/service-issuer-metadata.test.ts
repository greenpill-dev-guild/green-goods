import { describe, expect, it } from "vitest";
import { encodeAbiParameters, keccak256 } from "viem";
import {
  SERVICE_ISSUER_ROUTES,
  issuerAsset,
  serviceIssuerIssuanceLimit,
} from "../modules/commitment-pooling/service-issuer-metadata";

const VOUCHER = 1_000_000n;
const route = () => structuredClone(SERVICE_ISSUER_ROUTES[0]!);

describe("reviewed Green Goods production issuer metadata", () => {
  it("admits the confirmed session and Claude capacity for reviewed issuer actions", () => {
    const asset = issuerAsset(route(), "green-goods");
    expect(asset.service.offers?.map((offer) => offer.capacity)).toEqual([
      20n * VOUCHER,
      100n * VOUCHER,
    ]);
    expect(asset.service.capacity).toBe(120n * VOUCHER);
    expect(serviceIssuerIssuanceLimit(asset)).toBe(120n * VOUCHER);
  });
  it.each([
    "session",
    "aggregate",
  ])("blocks missing %s capacity while preserving recovery reads", (missing) => {
    const r = route();
    if (missing === "session") r.assets[0]!.service.offers![0]!.capacity = null;
    else r.assets[0]!.service.capacity = null;
    expect(() => issuerAsset(r, "green-goods")).toThrow("capacity");
    const asset = issuerAsset(r, "green-goods", true);
    expect(serviceIssuerIssuanceLimit(asset)).toBeNull();
  });
  it("requires every service capacity before admitting the aggregate, then retains the lower issuance ceiling", () => {
    const asset = route().assets[0]!;
    asset.service.offers![0]!.capacity = null;
    expect(serviceIssuerIssuanceLimit(asset)).toBeNull();
    asset.service.offers![0]!.capacity = 20n * VOUCHER;
    expect(serviceIssuerIssuanceLimit(asset)).toBe(120n * VOUCHER);
    asset.initialSupply = 110n * VOUCHER;
    expect(serviceIssuerIssuanceLimit(asset)).toBe(110n * VOUCHER);
    asset.service.capacity = 121n * VOUCHER;
    expect(serviceIssuerIssuanceLimit(asset)).toBeNull();
  });
  it("retains the approved finite issuance and exchange targets", () => {
    const asset = route().assets[0]!;
    expect([
      asset.initialSupply,
      asset.adapterAllowance,
      asset.poolHoldingCap,
      asset.priceIndex,
    ]).toEqual([120n * VOUCHER, 110n * VOUCHER, 120n * VOUCHER, 1_000_000n]);
    expect(asset.service.capacity).toBe(120n * VOUCHER);
    expect(asset.delisting).toBeNull();
  });
  it("excludes Tech and Sun from issuer configuration and preserves collective Safe control", () => {
    const r = route();
    expect(r.assets.map((asset) => asset.id)).toEqual(["green-goods"]);
    expect(() => issuerAsset(r, "tech-and-sun", true)).toThrow("unavailable");
    const asset = issuerAsset(r, "green-goods", true);
    expect(asset.kind).toBe("collective");
    expect(asset.sourceAuthority).toBe(asset.ownerReserve);
    expect(asset.upgradeControl).toEqual({
      kind: "collective-safe",
      admin: asset.token.factoryDeployment.admin,
    });
  });
  it("commits all four approved offer references in the documented order instead of reusing one as the catalog", () => {
    const asset = route().assets[0]!;
    const [session, claude] = asset.service.offers!;
    const digest = keccak256(
      encodeAbiParameters(
        [
          { type: "string" },
          { type: "string" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "bytes32" },
        ],
        [
          "green-goods:pilot-issuer-terms:v1",
          "pilot-2026-10-27-r2",
          session!.serviceTermsRef,
          session!.remedyTermsRef,
          claude!.serviceTermsRef,
          claude!.remedyTermsRef,
        ]
      )
    );
    expect(digest).toBe("0x0796ab9551f0ee87573201def5a23110952779469a5f13ef428ec76c7dd90f25");
    expect(asset.service.terms.digest).toBe(digest);
    expect(
      asset.service.offers!.flatMap((offer) => [offer.serviceTermsRef, offer.remedyTermsRef])
    ).not.toContain(digest);
  });
  it.each([
    "address",
    "runtimeCodeHash",
  ] as const)("rejects a changed implementation %s even for recovery", (field) => {
    const r = route();
    if (field === "address")
      r.assets[0]!.token.implementation.address = "0x0000000000000000000000000000000000000001";
    else r.assets[0]!.token.implementation.runtimeCodeHash = `0x${"1".repeat(64)}`;
    expect(() => issuerAsset(r, "green-goods", true)).toThrow("receipt-backed service asset");
  });
  it("pins approval provenance to the operating terms, revised budget and funded-seat decisions", () => {
    const asset = route().assets[0]!;
    expect(asset.service.approval.reference).toBe("https://linear.app/green-goods/issue/COM-46");
    expect(asset.service.approval.digest).toBe(
      "0xffbe49e30f5c90dc2dc5629129a34570d2fda082800237a9f7235a36875a4672"
    );
  });
});
