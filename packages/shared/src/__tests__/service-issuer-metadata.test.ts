import { describe, expect, it } from "vitest";
import { encodeAbiParameters, keccak256 } from "viem";
import {
  SERVICE_ISSUER_ROUTES,
  issuerAsset,
  serviceIssuerIssuanceLimit,
  issuerPool,
  issuerPoolPolicy,
  issuerConfiguration,
} from "../modules/commitment-pooling/service-issuer-metadata";

import { serviceIssuerExchangeChoices } from "../modules/commitment-pooling/service-issuer-checkout";
import { readLiveVoucherWallet } from "../modules/commitment-pooling/service-access-wallet";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import { liveVoucherFixture } from "./fixtures/live-voucher";

const VOUCHER = 1_000_000n;
const route = () => structuredClone(SERVICE_ISSUER_ROUTES[0]!);

describe("reviewed Green Goods production issuer metadata", () => {
  it("offers live checkout only through the desired service's explicit pool listings", async () => {
    const f = liveVoucherFixture();
    const catalog = f.issuerRoutes[0]!;
    const target = catalog.assets[0]!;
    const snapshot = createServiceRehearsalSnapshot({
      sourceChainId: 42161,
      coreModule: catalog.service.core.address,
      commitmentId: 1027n,
      buyer: f.wallet.account,
    });
    snapshot.evidence = "onchain";
    snapshot.offer!.voucher = {
      asset: {
        chainId: 100,
        token: target.token.address,
        symbol: target.symbol,
        decimals: target.decimals,
      },
      issuer: target.ownerReserve,
      units: 2_000_000n,
    };
    const wallet = await readLiveVoucherWallet(f.wallet, {
      routes: [f.route],
      issuerRoutes: f.issuerRoutes,
      chain: f.chain,
      reader: f.reader,
    });
    wallet.holdings[0]!.available = 1_000_000n;
    expect(serviceIssuerExchangeChoices(snapshot, wallet, f.issuerRoutes)).toMatchObject([
      {
        poolId: "green-goods",
        input: { id: "tech-and-sun" },
        output: { id: "green-goods" },
        held: 3n,
        requiredOutput: 1_000_000n,
      },
    ]);
    wallet.holdings[0]!.available = 2_000_000n;
    expect(serviceIssuerExchangeChoices(snapshot, wallet, f.issuerRoutes)).toEqual([]);
    wallet.holdings[0]!.available = 0n;
    catalog.pools[0]!.listings = catalog.pools[0]!.listings.filter(
      (listing) => listing.assetId !== "tech-and-sun"
    );
    expect(serviceIssuerExchangeChoices(snapshot, wallet, f.issuerRoutes)).toEqual([]);
    snapshot.evidence = "local-rehearsal";
    expect(serviceIssuerExchangeChoices(snapshot, wallet)).toEqual([]);
  });
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
    const r = route();
    const asset = r.assets[0]!;
    const listing = issuerPoolPolicy(issuerPool(r, "green-goods"), asset.id);
    expect([
      asset.initialSupply,
      asset.adapterAllowance,
      listing.poolHoldingCap,
      listing.priceIndex,
    ]).toEqual([120n * VOUCHER, 110n * VOUCHER, 120n * VOUCHER, 1_000_000n]);
    expect(asset.service.capacity).toBe(120n * VOUCHER);
    expect(listing.delisting).toBeNull();
  });
  it("admits the existing TSV identity for holder exchange without inventing confirmed TAS capacity", () => {
    const r = route();
    expect(r.assets.map((asset) => asset.id)).toEqual(["green-goods", "tech-and-sun"]);
    const tas = issuerAsset(r, "tech-and-sun", true);
    expect(tas.service.capacity).toBeNull();
    expect(() => issuerAsset(r, "tech-and-sun")).toThrow("capacity");
    expect(tas.ownerReserve).not.toBe(tas.sourceAuthority);
    expect(issuerPoolPolicy(issuerPool(r, "green-goods"), tas.id).poolHoldingCap).toBe(
      20n * VOUCHER
    );
    expect(() => issuerPool(r, "tech-and-sun")).toThrow("pool");
    const asset = issuerAsset(r, "green-goods", true);
    expect(asset.kind).toBe("collective");
    expect(asset.sourceAuthority).toBe(asset.ownerReserve);
    expect(asset.upgradeControl).toEqual({
      kind: "collective-safe",
      admin: asset.token.factoryDeployment.admin,
    });
  });
  it("keeps one issuer record while pool curation and review fingerprints remain independent", () => {
    const r = route();
    const gg = r.pools[0]!;
    const tas = {
      ...structuredClone(gg),
      id: "tech-and-sun",
      name: "TAS test pool",
      deployment: {
        ...gg.deployment,
        address: "0x0000000000000000000000000000000000000001" as const,
      },
    };
    r.pools = [gg, tas];
    const issuerBefore = issuerConfiguration(r);
    const ggBefore = issuerConfiguration(r, gg.id);
    const tasBefore = issuerConfiguration(r, tas.id);
    tas.listings[0]!.poolHoldingCap = 10n * VOUCHER;
    expect(issuerConfiguration(r)).toBe(issuerBefore);
    expect(issuerConfiguration(r, gg.id)).toBe(ggBefore);
    expect(issuerConfiguration(r, tas.id)).not.toBe(tasBefore);
    expect(r.assets).toHaveLength(2);
    expect(issuerPoolPolicy(gg, "green-goods").poolHoldingCap).toBe(120n * VOUCHER);
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
