import {
  type ServiceIssuerDeskRecord,
  useServiceIssuerOperations,
} from "@green-goods/shared/commitment-pooling";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { Address } from "@green-goods/shared/types/domain";
import { RiCoupon3Line, RiHandHeartLine } from "@remixicon/react";
import { type ReactNode, useEffect, useId } from "react";
import { useIntl } from "react-intl";
import {
  issuerAmount,
  issuerCapacity,
  issuerCount,
  issuerListing,
} from "@/components/Features/Vouchers/serviceIssuerPresentation";
import { formatVouchers } from "@/views/Home/WalletSheet/voucherWallet";
import {
  type CatalogAsset,
  DRAFT_PILL,
  draftState,
  type HeldVoucherRow,
  LISTING_PILL,
  listingPoolId,
} from "./serviceAssetRows";

/** The opened panel's frame under its row, as the wallet opens a holding (DL-113). */
const PANEL_CLASS = "gg-card gg-item-row-page flex flex-col gap-3 p-3";

/** One of the two lists, named by a line in the eyebrow role, never by a heading of its own. */
export function RowGroup({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p id={id} className="type-label-sm text-text-soft-400">
        {label}
      </p>
      <ul aria-labelledby={id} className="flex flex-col gap-(--gg-list-gap)">
        {children}
      </ul>
    </div>
  );
}

/** A draft a steward sent: its state in the pill, who drafted it, and its terms below. */
export function DraftRow({
  record,
  open,
  onToggle,
  children,
}: {
  record: ServiceIssuerDeskRecord;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { formatMessage } = useIntl();
  const panelId = useId();
  const pill = DRAFT_PILL[draftState(record)];
  const { draft } = record;
  return (
    <li className="flex flex-col gap-2" data-row="draft">
      <ItemRow
        lead={{ kind: "icon", icon: <RiHandHeartLine /> }}
        title={draft.terms.service.title}
        status={{ label: formatMessage({ id: pill.id }), tone: pill.tone }}
        edge={pill.tone}
        details={[
          formatMessage(
            { id: "app.voucher.ob.kind" },
            { name: draft.preparedBy, garden: draft.garden }
          ),
        ]}
        onOpen={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
      />
      {open ? (
        <div id={panelId} className={PANEL_CLASS}>
          {children}
        </div>
      ) : null}
    </li>
  );
}

/**
 * A service the member lists: where its token stands in the exchange pool that lists it, read
 * from the chain, and what is booked and left to deliver once the bookings are verified. The
 * panel under it reads with the pool the member selects, so a confirmed act there also reads the
 * row again, and the row never shows yesterday's capacity beside today's booking.
 */
export function OwnServiceRow({
  member,
  entry,
  open,
  onToggle,
  panel,
}: {
  member: Address;
  entry: CatalogAsset;
  open: boolean;
  onToggle: () => void;
  /** The opened panel, handed the row's own refresh for the acts it confirms. */
  panel: (refreshRow: () => Promise<unknown>) => ReactNode;
}) {
  const intl = useIntl();
  const panelId = useId();
  const poolId = listingPoolId(entry);
  const operations = useServiceIssuerOperations({
    address: member,
    routeId: entry.route.service.id,
    assetId: entry.asset.id,
    ...(poolId ? { poolId } : {}),
  });
  const snapshot = operations.snapshot.data;
  const onchain = snapshot?.evidence === "onchain" ? snapshot : null;
  const pill = onchain ? LISTING_PILL[issuerListing(onchain)] : null;
  const capacity = onchain ? issuerCapacity(onchain) : null;
  const detail =
    capacity && capacity.booked !== null && capacity.left !== null
      ? intl.formatMessage(
          { id: "app.profile.issuer.capacityLine" },
          {
            booked: issuerCount(capacity.booked, entry.asset.decimals, intl.locale),
            left: issuerCount(capacity.left, entry.asset.decimals, intl.locale),
          }
        )
      : null;
  return (
    <li className="flex flex-col gap-2" data-row="service">
      <ItemRow
        lead={{ kind: "icon", icon: <RiHandHeartLine /> }}
        title={entry.asset.name}
        status={pill ? { label: intl.formatMessage({ id: pill.id }), tone: pill.tone } : undefined}
        edge={pill?.tone}
        details={detail ? [detail] : undefined}
        onOpen={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
      />
      {open ? (
        <div id={panelId} className={PANEL_CLASS}>
          {panel(() => operations.snapshot.refetch())}
        </div>
      ) : null}
    </li>
  );
}

/**
 * What the member holds of one issuer, as the wallet writes it, with its amount in the right
 * slot (DL-113). A holding an exchange pool lists opens its exchange; one none lists is a record.
 * A listed holding also reads what the pool may still spend of it, so a member who spent their
 * vouchers another way keeps the way to that permission, which would cover vouchers they receive:
 * the row stays while the balance, the permission or the member's opening it says so, and tells
 * the view when the permission alone keeps it, so the empty line never sits above a row.
 */
export function HeldRow({
  member,
  row,
  open,
  onToggle,
  onPermitted,
  children,
}: {
  member: Address;
  row: HeldVoucherRow;
  open: boolean;
  onToggle: () => void;
  /** Whether the pool may spend this holding, as the row reads it; the view counts it as shown. */
  onPermitted: (key: string, permitted: boolean) => void;
  children: ReactNode;
}) {
  const intl = useIntl();
  const panelId = useId();
  const { issuer, available } = row.holding;
  const { listed } = row;
  const operations = useServiceIssuerOperations(
    listed
      ? {
          address: member,
          routeId: listed.route.service.id,
          assetId: listed.asset.id,
          poolId: listingPoolId(listed),
        }
      : null
  );
  const snapshot = operations.snapshot.data;
  const allowance = snapshot?.evidence === "onchain" ? snapshot.poolAllowance : 0n;
  const permitted = allowance > 0n;
  useEffect(() => {
    onPermitted(row.key, permitted);
  }, [onPermitted, row.key, permitted]);
  if (available === 0n && !permitted && !open) return null;
  const permission =
    permitted && listed
      ? `${intl.formatMessage({ id: "app.profile.issuer.exchangeAllowance" })} ${issuerAmount(allowance, listed.asset, intl)}`
      : null;
  return (
    <li className="flex flex-col gap-2" data-row="holding" data-listed={listed ? "true" : "false"}>
      <ItemRow
        lead={{ kind: "icon", icon: <RiCoupon3Line /> }}
        title={intl.formatMessage(
          { id: "app.voucher.wl.unitMany" },
          { issuer: issuer.name, gender: issuer.gender ?? "other" }
        )}
        details={permission ? [issuer.name, permission] : [issuer.name]}
        amount={{
          value: formatVouchers(available, issuer.asset.decimals, intl.locale),
          caption: intl.formatMessage({ id: "app.voucher.wl.avail" }),
        }}
        onOpen={listed ? onToggle : undefined}
        aria-expanded={listed ? open : undefined}
        aria-controls={listed ? panelId : undefined}
      />
      {open && listed ? (
        <div id={panelId} className={PANEL_CLASS}>
          {children}
        </div>
      ) : null}
    </li>
  );
}
