import {
  SERVICE_ISSUER_ROUTES,
  type ServiceIssuerAsset,
  type ServiceIssuerDeskRecord,
  type ServiceIssuerDraftRecord,
  type ServiceIssuerRoute,
  serviceIssuerDraftApproval,
  type VoucherHolding,
  type VoucherWalletSnapshot,
} from "@green-goods/shared/commitment-pooling";
import type { ItemRowTone } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { Address } from "@green-goods/shared/types/domain";
import type { IssuerListing } from "@/components/Features/Vouchers/serviceIssuerPresentation";

/** A reviewed asset with the route that lists it, keyed as Your Services keys its rows. */
export interface CatalogAsset {
  key: string;
  route: ServiceIssuerRoute;
  asset: ServiceIssuerAsset;
}

/** Every reviewed asset of every live route, in the catalog's order. */
export function catalogAssets(
  routes: readonly ServiceIssuerRoute[] = SERVICE_ISSUER_ROUTES
): CatalogAsset[] {
  return routes.flatMap((route, r) =>
    route.assets.map((asset, a) => ({ key: `asset:${r}:${a}`, route, asset }))
  );
}

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

/** The first exchange pool of the route that lists the asset, where its standing is read. */
export function listingPoolId({ route, asset }: CatalogAsset): string | undefined {
  return route.pools.find((pool) => pool.listings.some((listing) => listing.assetId === asset.id))
    ?.id;
}

/** Where a draft stands, as its row and its onboarding card both read it. */
export type DraftState = "review" | "approved" | "changed" | "declined";

export function draftState({ draft, approval, declinedAt }: ServiceIssuerDraftRecord): DraftState {
  if (declinedAt) return "declined";
  const coverage = serviceIssuerDraftApproval(draft, approval);
  if (coverage === "current") return "approved";
  if (coverage === "outdated" || (draft.terms.revision > 1 && draft.changed.length > 0))
    return "changed";
  return "review";
}

/** The signed-in member's own drafts: a draft is theirs to approve or decline. */
export function ownDrafts(
  records: readonly ServiceIssuerDeskRecord[],
  member: Address | undefined
): ServiceIssuerDeskRecord[] {
  return member ? records.filter(({ draft }) => same(draft.member, member)) : [];
}

/** The member's own services: the individual assets whose reserve is their account. */
export function ownServiceAssets(
  assets: readonly CatalogAsset[],
  member: Address | undefined
): CatalogAsset[] {
  return member
    ? assets.filter(({ asset }) => asset.kind === "individual" && same(asset.ownerReserve, member))
    : [];
}

/** What the wallet holds of one issuer, with the reviewed asset it exchanges as, when listed. */
export interface HeldVoucherRow {
  key: string;
  holding: VoucherHolding;
  listed: CatalogAsset | null;
}

/**
 * The wallet's holdings as rows, zero balances included: the view leaves an issuer the account
 * holds none of out, as the wallet does, except the row the member has open, which an exchange
 * of the whole balance would otherwise unmount before its receipt. A holding opens its exchange
 * only when a live route lists its token in an exchange pool; otherwise it is a record.
 */
export function heldVoucherRows(
  wallet: VoucherWalletSnapshot | undefined,
  assets: readonly CatalogAsset[]
): HeldVoucherRow[] {
  if (!wallet || wallet.evidence === "unavailable") return [];
  return wallet.holdings.map((holding) => {
    const { chainId, token } = holding.issuer.asset;
    const listed =
      assets.find(
        (entry) => same(entry.asset.token.address, token) && listingPoolId(entry) !== undefined
      ) ?? null;
    return { key: `holding:${chainId}:${token.toLowerCase()}`, holding, listed };
  });
}

/** A draft's pill: what waits on the member, or where the setup stands. */
export const DRAFT_PILL: Record<DraftState, { id: string; tone: ItemRowTone }> = {
  review: { id: "app.voucher.ob.st.draft", tone: "warning" },
  approved: { id: "app.voucher.ob.st.setup", tone: "info" },
  changed: { id: "app.voucher.ob.st.changed", tone: "warning" },
  declined: { id: "app.voucher.ob.st.declined", tone: "neutral" },
};

/** A listed service's pill: where the token stands in the pool; none while that is unread. */
export const LISTING_PILL: Record<IssuerListing, { id: string; tone: ItemRowTone } | null> = {
  setup: { id: "app.voucher.ob.st.setup", tone: "info" },
  listed: { id: "app.voucher.ms.p.listed", tone: "success" },
  paused: { id: "app.voucher.ms.p.paused", tone: "warning" },
  delisted: { id: "app.voucher.ms.p.delisted", tone: "error" },
  unavailable: null,
};
