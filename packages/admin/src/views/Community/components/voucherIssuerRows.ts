import {
  issuerPoolStatus,
  type ServiceIssuerAsset,
  type ServiceIssuerDraftRecord,
  type ServiceIssuerListings,
  type ServiceIssuerPoolListing,
  type ServiceIssuerPool,
  type ServiceIssuerPoolPolicy,
  type ServiceIssuerRoute,
  serviceIssuerDraftApproval,
  serviceIssuerListingKey,
} from "@green-goods/shared/commitment-pooling";

export type VoucherIssuerStatus =
  | "draft"
  | "waiting"
  | "changed"
  | "declined"
  | "approved"
  | "setup"
  | "listed"
  | "delisted"
  | "unread";

export interface VoucherIssuerRow {
  key: string;
  kind: "individual" | "collective";
  status: VoucherIssuerStatus;
  /** The reviewed metadata, once the steward has completed it; a bare draft has none yet. */
  route?: ServiceIssuerRoute;
  asset?: ServiceIssuerAsset;
  pool?: ServiceIssuerPool;
  policy?: ServiceIssuerPoolPolicy;
  listing?: ServiceIssuerPoolListing;
  record?: ServiceIssuerDraftRecord;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Where a draft stands before its token exists: only the member's own approval moves it on. */
function draftStatus(record: ServiceIssuerDraftRecord): VoucherIssuerStatus {
  if (record.declinedAt !== null) return "declined";
  if (record.draft.sentAt === null) return "draft";
  const approval = serviceIssuerDraftApproval(record.draft, record.approval);
  return approval === "current"
    ? "approved"
    : approval === "outdated" || record.draft.terms.revision > 1
      ? "changed"
      : "waiting";
}

/**
 * One row per issuer and pool: each independent listing (admitted, a holding
 * limit, or a zero limit: setup until the stewards record a delisting), then the drafts no
 * reviewed asset carries yet. A draft pairs only with its member, symbol and exact signed pool.
 * Legacy drafts without a pool remain independent historical records; no listing inherits them.
 */
export function voucherIssuerRows(
  routes: readonly ServiceIssuerRoute[],
  records: readonly ServiceIssuerDraftRecord[],
  listings: ServiceIssuerListings | undefined
): VoucherIssuerRow[] {
  const paired = new Set<ServiceIssuerDraftRecord>();
  const assets = routes.flatMap((route) =>
    route.pools.flatMap((pool) =>
      pool.listings.flatMap((policy): VoucherIssuerRow[] => {
        const asset = route.assets.find((candidate) => candidate.id === policy.assetId);
        if (!asset) return [];
        const record = records.find(
          (r) =>
            same(r.draft.member, asset.ownerReserve) &&
            r.draft.terms.token.symbol === asset.symbol &&
            r.draft.terms.exchangePool?.chainId === pool.chainId &&
            r.draft.terms.exchangePool.id === pool.id &&
            same(r.draft.terms.exchangePool.address, pool.deployment.address)
        );
        if (record) paired.add(record);
        const key = serviceIssuerListingKey(route.service.id, pool.id, asset.id);
        const listing = listings?.get(key);
        return [
          {
            key,
            kind: asset.kind,
            status: listing ? issuerPoolStatus(listing, policy) : "unread",
            route,
            asset,
            pool,
            policy,
            listing,
            record,
          },
        ];
      })
    )
  );
  const drafts = records
    .filter((record) => !paired.has(record))
    .map(
      (record): VoucherIssuerRow => ({
        key: `draft:${record.draft.id}`,
        kind: "individual",
        status: draftStatus(record),
        record,
      })
    );
  return [...assets, ...drafts];
}
