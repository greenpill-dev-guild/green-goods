import { encodeAbiParameters, keccak256 } from "viem";
import { SERVICE_LIVE_ROUTES } from "./service-access-live-config";
import { GREEN_GOODS_ISSUER_DEPLOYMENT } from "./service-issuer-live-pins";
import type { ServiceIssuerAsset, ServiceIssuerRoute } from "./service-issuer-types";

const revision = "pilot-2026-10-27-r2";
const reference = "https://linear.app/green-goods/issue/COM-46";
const voucher = 1_000_000n;
// Exact statement hashes and quantities from the approved offer publishing runbook.
const offers = [
  {
    unit: "minutes",
    serviceUnits: 45n,
    voucherUnits: 2n * voucher,
    serviceTermsRef: "0x1616a8f3b5173f56d7c0a7bb7f00c45a64e0e1b4b463d81502d1379f51b20f13",
    remedyTermsRef: "0x0fe1184e5b2d1f6f38ed6a58872bd3c85673c8598aefef09af3bd45f976b4dd6",
    // COM-46 approves ten sessions; #1377 records the published facilitator, language and calendar.
    capacity: 20n * voucher,
  },
  {
    unit: "seat days",
    serviceUnits: 30n,
    voucherUnits: 10n * voucher,
    serviceTermsRef: "0xa18d37ab4b89aac3790bf980f50ae2581d7975899e4fed4c0b5af73afdc0a3c0",
    remedyTermsRef: "0x0e13b8482cd3d5d32ba1c72e0e6b8bf72b0da71c5c325d314e50ee554e98aba1",
    // COM-46 confirms permission and ten funded seat-periods.
    capacity: 100n * voucher,
  },
] as const satisfies NonNullable<ServiceIssuerAsset["service"]["offers"]>;

// keccak256(abi.encode(domain, revision, session-service, session-remedy, Claude-service, Claude-remedy)).
// A catalog commitment is not any offer's on-chain serviceTermsRef or remedyTermsRef.
const termsDigest = keccak256(
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
      revision,
      offers[0].serviceTermsRef,
      offers[0].remedyTermsRef,
      offers[1].serviceTermsRef,
      offers[1].remedyTermsRef,
    ]
  )
);
const approvals = [
  "30e7e60d-133f-4f80-9f63-3aee6c15bdb2",
  "9492b2aa-58b5-4132-b6ab-aa86d68be138",
  "be58f395-2da8-44ab-92fa-3d136e64cc5b",
] as const;
// Public approval identities bind this catalog; they are not signatures or a capacity attestation.
const approvalDigest = keccak256(
  encodeAbiParameters(
    [
      { type: "string" },
      { type: "string" },
      { type: "bytes32" },
      { type: "string" },
      { type: "string[]" },
    ],
    ["green-goods:pilot-issuer-approval:v1", revision, termsDigest, reference, approvals]
  )
);
const service = SERVICE_LIVE_ROUTES.find(
  (route) => route.id === "green-goods-tech-and-sun-voucher-pilot"
);
if (!service) throw new Error("Reviewed pilot service route unavailable");
const deployment = GREEN_GOODS_ISSUER_DEPLOYMENT;

/** Green Goods only. Confirmed service capacity is separate from issuance, allowance and pool limits. */
export const GREEN_GOODS_ISSUER_ROUTE: ServiceIssuerRoute = {
  service,
  factory: deployment.factory,
  adapterSource: deployment.adapterSource,
  adapter: deployment.adapter,
  pool: deployment.pool,
  assets: [
    {
      id: "green-goods",
      kind: "collective",
      ownerReserve: deployment.token.owner,
      sourceAuthority: deployment.token.owner,
      token: deployment.token,
      name: "Green Goods Service Voucher",
      symbol: "GGV",
      decimals: 6,
      service: {
        unit: "GGV",
        terms: {
          reference:
            "https://github.com/greenpill-dev-guild/green-goods/blob/f8ff5d0286cc1e91e99e70d71749265394e3ef77/.plans/backlog/cosmo-local-credit-interop/pilot-issuer-terms.md",
          digest: termsDigest,
        },
        approval: { reference, digest: approvalDigest },
        offers,
        // Ten sessions at 2 GGV plus ten funded Claude seat-periods at 10 GGV.
        capacity: 120n * voucher,
      },
      delisting: null,
      initialSupply: 120n * voucher,
      adapterAllowance: 110n * voucher,
      poolHoldingCap: 120n * voucher,
      priceIndex: 1_000_000n,
      // The factory admin is the existing Green Goods Safe-controlled timelock, not a replacement Safe.
      upgradeControl: { kind: "collective-safe", admin: deployment.token.factoryDeployment.admin },
    },
  ],
};
