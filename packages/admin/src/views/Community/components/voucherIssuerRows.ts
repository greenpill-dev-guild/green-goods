import {
  issuerPoolStatus,
  type ServiceIssuerAsset,
  type ServiceIssuerDraftRecord,
  type ServiceIssuerListings,
  type ServiceIssuerPoolListing,
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
  listing?: ServiceIssuerPoolListing;
  record?: ServiceIssuerDraftRecord;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Where a draft stands before its token exists: only the member's own approval moves it on. */
function draftStatus(record: ServiceIssuerDraftRecord): VoucherIssuerStatus {
  if (record.declinedAt !== null) return "declined";
  if (record.draft.sentAt === null) return "draft";
  const approval = serviceIssuerDraftApproval(record.draft, record.approval);
  return approval === "current" ? "approved" : approval === "outdated" ? "changed" : "waiting";
}

/**
 * One row per issuer: the reviewed assets, each with its pool listing (admitted, a holding
 * limit, or a zero limit once delisted), then the drafts no reviewed asset carries yet. A draft
 * pairs with the asset its member owns under the same symbol.
 */
export function voucherIssuerRows(
  routes: readonly ServiceIssuerRoute[],
  records: readonly ServiceIssuerDraftRecord[],
  listings: ServiceIssuerListings | undefined
): VoucherIssuerRow[] {
  const paired = new Set<ServiceIssuerDraftRecord>();
  const assets = routes.flatMap((route) =>
    route.assets.map((asset): VoucherIssuerRow => {
      const record = records.find(
        (r) =>
          same(r.draft.member, asset.ownerReserve) && r.draft.terms.token.symbol === asset.symbol
      );
      if (record) paired.add(record);
      const listing = listings?.get(serviceIssuerListingKey(route.service.id, asset.id));
      return {
        key: `${route.service.id}:${asset.id}`,
        kind: asset.kind,
        status: listing ? issuerPoolStatus(listing) : "unread",
        route,
        asset,
        listing,
        record,
      };
    })
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
