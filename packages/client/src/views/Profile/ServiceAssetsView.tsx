import {
  type ServiceIssuerDeskRecord,
  useServiceIssuerOperations,
} from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { ItemRow, ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { Address } from "@green-goods/shared/types/domain";
import { RiCoupon3Line, RiHandHeartLine } from "@remixicon/react";
import { type ReactNode, useId, useState } from "react";
import { useIntl } from "react-intl";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import {
  issuerCapacity,
  issuerCount,
  issuerListing,
} from "@/components/Features/Vouchers/serviceIssuerPresentation";
import { formatVouchers } from "@/views/Home/WalletSheet/voucherWallet";
import { ServiceAssetPanel } from "./ServiceAssetPanel";
import { ServiceIssuerOnboarding } from "./ServiceIssuerOnboarding";
import {
  type CatalogAsset,
  DRAFT_PILL,
  draftState,
  type HeldVoucherRow,
  LISTING_PILL,
} from "./serviceAssetRows";

export interface ServiceAssetsViewProps {
  member: Address | undefined;
  /** Keys each opened panel, so a changed account or profile starts its reads over. */
  identity: string;
  drafts: {
    records: readonly ServiceIssuerDeskRecord[];
    /** Whether the desk has answered once; before that, drafts a steward sent wait unseen. */
    loaded: boolean;
    loading: boolean;
    failed: boolean;
    canSign: boolean;
    approving: boolean;
    onCheck: () => void;
    onApprove: (record: ServiceIssuerDeskRecord) => Promise<unknown>;
    onDecline: (record: ServiceIssuerDeskRecord) => void;
  };
  /** The member's own listed services, from the live routes. */
  services: readonly CatalogAsset[];
  /** What the member's wallet holds, each with the reviewed asset it exchanges as. */
  holdings: readonly HeldVoucherRow[];
  /** The wallet read behind the holdings, or none where this build reads no vouchers. */
  wallet: "reading" | "failed" | "ready" | "none";
  onRefreshWallet: () => Promise<unknown>;
  /** No live route, no draft and no wallet: the block says why, and reads nothing. */
  unconfigured: boolean;
}

const PANEL_CLASS = "gg-card gg-item-row-page flex flex-col gap-3 p-3";

/**
 * Your Services as two lists under one sentence (DL-159): the services the member offers, a
 * draft or a listed asset each with its state in the row's pill, and the vouchers they hold,
 * counted per issuer as the wallet counts them. A row opens its panel in place: a draft's
 * terms to approve, a service's bookings and acts, a holding's exchange. Nothing is read before
 * the member asks for drafts, since the desk signs to answer; the wallet is read as the wallet
 * sheet reads it.
 */
export function ServiceAssetsView({
  member,
  identity,
  drafts,
  services,
  holdings,
  wallet,
  onRefreshWallet,
  unconfigured,
}: ServiceAssetsViewProps) {
  const { formatMessage } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const [open, setOpen] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const offeredId = useId();
  const heldId = useId();
  const toggle = (key: string) => {
    setOpen((current) => (current === key ? null : key));
    setContinuing(false);
  };
  /** A delivered voucher's own row, when the catalog lists it: a second exchange opens there. */
  const continueWith = (routeId: string, assetId: string) => {
    const row =
      services.find(({ route, asset }) => route.service.id === routeId && asset.id === assetId) ??
      holdings.find(
        ({ listed }) => listed?.route.service.id === routeId && listed.asset.id === assetId
      );
    if (!row) return;
    setOpen(row.key);
    setContinuing(true);
  };
  const panel = (key: string, { route, asset }: CatalogAsset, account: Address) => (
    <ServiceAssetPanel
      key={`${identity}:${key}`}
      actor={{ address: account, routeId: route.service.id, assetId: asset.id }}
      assets={route.assets}
      pools={route.pools}
      continuing={continuing}
      onContinue={(assetId) => continueWith(route.service.id, assetId)}
      onRefresh={onRefreshWallet}
    />
  );
  const lead = (
    <div className="flex items-center gap-3">
      <Avatar>
        <RiCoupon3Line className="h-4 w-4 text-primary-on-surface" aria-hidden="true" />
      </Avatar>
      <p className="min-w-0 flex-1 text-sm text-text-strong-950">{text("body")}</p>
    </div>
  );
  if (unconfigured || !member)
    return (
      <Card>
        <div className="flex w-full flex-col gap-3">
          {lead}
          <p className="text-xs text-text-sub-600">{text("unconfigured")}</p>
        </div>
      </Card>
    );
  const nothingOffered = drafts.records.length === 0 && services.length === 0;
  return (
    <div className="flex flex-col gap-4" data-component="ServiceAssetsView">
      {lead}
      <Group id={offeredId} label={text("offered")}>
        {drafts.records.map((record) => {
          const key = `draft:${record.draft.id}`;
          return (
            <DraftRow key={key} record={record} open={open === key} onToggle={() => toggle(key)}>
              <ServiceIssuerOnboarding
                key={`${identity}:${record.draft.id}:${record.revision}`}
                record={record}
                canSign={drafts.canSign}
                approving={drafts.approving}
                onApprove={async () => {
                  await drafts.onApprove(record);
                }}
                onDecline={() => drafts.onDecline(record)}
              />
            </DraftRow>
          );
        })}
        {services.map((entry) => (
          <OwnServiceRow
            key={entry.key}
            member={member}
            entry={entry}
            open={open === entry.key}
            onToggle={() => toggle(entry.key)}
          >
            {panel(entry.key, entry, member)}
          </OwnServiceRow>
        ))}
      </Group>
      {nothingOffered ? (
        <p className="type-meta text-text-soft-400">
          {text(drafts.loaded ? "offerNone" : "offerEmpty")}
        </p>
      ) : null}
      {drafts.failed ? (
        <Alert variant="error">
          {formatMessage({ id: "app.voucher.exchange.servicesFailed" })}
        </Alert>
      ) : null}
      <div>
        <Button
          type="button"
          emphasis="secondary"
          size="sm"
          loading={drafts.loading}
          onClick={drafts.onCheck}
        >
          {formatMessage({ id: "app.voucher.exchange.loadServices" })}
        </Button>
      </div>
      <Group id={heldId} label={text("holding")}>
        {wallet === "reading" ? (
          <li aria-busy="true">
            <ItemRowSkeleton lead="icon" amount />
          </li>
        ) : null}
        {holdings.map((row) => (
          <HeldRow key={row.key} row={row} open={open === row.key} onToggle={() => toggle(row.key)}>
            {row.listed ? panel(row.key, row.listed, member) : null}
          </HeldRow>
        ))}
      </Group>
      {wallet === "failed" ? (
        <Alert variant="warning">
          <div className="flex flex-col items-start gap-2">
            <p>{formatMessage({ id: "app.voucher.wl.unavailable" })}</p>
            <Button
              type="button"
              emphasis="secondary"
              size="sm"
              onClick={() => void onRefreshWallet()}
            >
              {text("refresh")}
            </Button>
          </div>
        </Alert>
      ) : null}
      {wallet !== "reading" && wallet !== "failed" && holdings.length === 0 ? (
        <p className="type-meta text-text-soft-400">
          {formatMessage({ id: "app.voucher.wl.empty" })}
        </p>
      ) : null}
    </div>
  );
}

/** One of the two lists, named by a line in the eyebrow role, never by a heading of its own. */
function Group({ id, label, children }: { id: string; label: string; children: ReactNode }) {
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
function DraftRow({
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
function OwnServiceRow({
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
function HeldRow({
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
