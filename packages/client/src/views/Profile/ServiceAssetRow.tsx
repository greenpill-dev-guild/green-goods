import {
  type ServiceIssuerDeskRecord,
  useServiceIssuerOperations,
} from "@green-goods/shared/commitment-pooling";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { Address } from "@green-goods/shared/types/domain";
import { RiCoupon3Line, RiHandHeartLine } from "@remixicon/react";
import { type ReactNode, useId } from "react";
import { useIntl } from "react-intl";
import {
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
 * A service the member lists: where its token stands in the pool, read from the chain, and
 * what is booked and left to deliver once the bookings are verified. The read is the panel's
 * own, so opening the row adds nothing to it.
 */
export function OwnServiceRow({
  member,
  entry,
  open,
  onToggle,
  children,
}: {
  member: Address;
  entry: CatalogAsset;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const intl = useIntl();
  const panelId = useId();
  const operations = useServiceIssuerOperations({
    address: member,
    routeId: entry.route.service.id,
    assetId: entry.asset.id,
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
          {children}
        </div>
      ) : null}
    </li>
  );
}

/**
 * What the member holds of one issuer, as the wallet writes it, with its amount in the right
 * slot (DL-113). A holding the live routes list opens its exchange; one they don't is a record.
 */
export function HeldRow({
  row,
  open,
  onToggle,
  children,
}: {
  row: HeldVoucherRow;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const intl = useIntl();
  const panelId = useId();
  const { issuer, available } = row.holding;
  const listed = row.listed !== null;
  return (
    <li className="flex flex-col gap-2" data-row="holding" data-listed={listed ? "true" : "false"}>
      <ItemRow
        lead={{ kind: "icon", icon: <RiCoupon3Line /> }}
        title={intl.formatMessage(
          { id: "app.voucher.wl.unitMany" },
          { issuer: issuer.name, gender: issuer.gender ?? "other" }
        )}
        details={[issuer.name]}
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
