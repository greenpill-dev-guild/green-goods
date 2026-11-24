import type { ServiceIssuerDeskRecord } from "../../public-contracts/service-issuer-desk";
import { SERVICE_ISSUER_DESK_POOLS } from "../../modules/commitment-pooling/service-issuer-desk-protocol";

export function issuerDeskFixture(
  member = "0x1111111111111111111111111111111111111111"
): ServiceIssuerDeskRecord {
  const pool = SERVICE_ISSUER_DESK_POOLS[0];
  return {
    revision: 1,
    createdBy: "0x2222222222222222222222222222222222222222",
    updatedAt: "2026-11-08T00:00:00Z",
    context: {
      routeId: pool.routeId,
      poolId: pool.poolId,
      garden: pool.garden.toLowerCase(),
      chainId: 100,
      sourceChainId: pool.sourceChainId,
    },
    approval: null,
    declinedAt: null,
    draft: {
      version: 1,
      id: "fixture-member-service",
      member,
      memberName: "Fictional gardener",
      preparedBy: "0x2222222222222222222222222222222222222222",
      garden: pool.garden.toLowerCase(),
      sourceChainId: pool.sourceChainId,
      sentAt: 1n,
      changed: [],
      terms: {
        revision: 1,
        service: {
          title: "Design help",
          buys: "One session",
          scope: "Remote",
          remedy: "Refund unused time",
          unit: "session",
        },
        token: { name: "Design voucher", symbol: "DV", decimals: 6 },
        capacity: { units: 6_000_000n, weeks: 4 },
        issue: { total: 6_000_000n, pool: 2_000_000n },
        rewardAllowance: 1_000_000n,
        poolHoldingCap: 6_000_000n,
        priceIndex: 1_000_000n,
        poolFee: 0n,
        exchangePool: { chainId: 100, id: pool.poolId, address: pool.deployment.address },
        replyBusinessDays: 2,
        acceptanceDays: 7,
        document: { reference: "https://example.org/terms", digest: `0x${"ab".repeat(32)}` },
      },
    },
  };
}
