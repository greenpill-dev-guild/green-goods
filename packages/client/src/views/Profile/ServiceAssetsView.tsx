import type { ServiceIssuerDeskRecord } from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { Address } from "@green-goods/shared/types/domain";
import { RiCoupon3Line } from "@remixicon/react";
import { useCallback, useId, useState } from "react";
import { useIntl } from "react-intl";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import { ServiceAssetPanel } from "./ServiceAssetPanel";
import { DraftRow, HeldRow, OwnServiceRow, RowGroup } from "./ServiceAssetRow";
import { ServiceIssuerOnboarding } from "./ServiceIssuerOnboarding";
import type { CatalogAsset, HeldVoucherRow } from "./serviceAssetRows";

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
  /** What the member's wallet holds, zero balances included, each with the asset it exchanges as. */
  holdings: readonly HeldVoucherRow[];
  /** The wallet read behind the holdings, or none where this build reads no vouchers. */
  wallet: "reading" | "failed" | "ready" | "none";
  onRefreshWallet: () => Promise<unknown>;
  /** No live route, no draft and no wallet: the block says why, and reads nothing. */
  unconfigured: boolean;
}

/**
 * Your Services as two lists under one sentence (DL-159): the services the member offers, a
 * draft or a listed asset each with its state in the row's pill, and the vouchers they hold,
 * counted per issuer as the wallet counts them. A row opens its panel in place: a draft's
 * terms to approve, a service's bookings and acts, a holding's exchange. Nothing is read before
 * the member asks for drafts, since the desk signs to answer; the wallet is read as the wallet
 * sheet reads it, and where this build reads no vouchers the holdings list is not drawn at all,
 * so an unread wallet never reads as an empty one.
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
  // A holding's row shows itself while its balance, the pool's permission to spend it, or the
  // member's opening it says so (the open row stays through the refresh an exchange of the whole
  // balance triggers). The rows report the permission, which only their reads know, so the empty
  // line is drawn only when no row is shown.
  const [permitted, setPermitted] = useState<Record<string, boolean>>({});
  const onPermitted = useCallback(
    (key: string, value: boolean) =>
      setPermitted((current) => (current[key] === value ? current : { ...current, [key]: value })),
    []
  );
  const anyHeld = holdings.some(
    (row) => row.holding.available > 0n || row.key === open || permitted[row.key]
  );
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
  const panel = (
    key: string,
    { route, asset }: CatalogAsset,
    account: Address,
    onRefresh: () => Promise<unknown> = onRefreshWallet
  ) => (
    <ServiceAssetPanel
      key={`${identity}:${key}`}
      actor={{ address: account, routeId: route.service.id, assetId: asset.id }}
      assets={route.assets}
      pools={route.pools}
      continuing={continuing}
      onContinue={(assetId) => continueWith(route.service.id, assetId)}
      onRefresh={onRefresh}
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
      <RowGroup id={offeredId} label={text("offered")}>
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
            panel={(refreshRow) =>
              panel(entry.key, entry, member, async () => {
                await onRefreshWallet();
                await refreshRow();
              })
            }
          />
        ))}
      </RowGroup>
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
      {wallet === "none" ? null : (
        <RowGroup id={heldId} label={text("holding")}>
          {wallet === "reading" ? (
            <li aria-busy="true">
              <ItemRowSkeleton lead="icon" amount />
            </li>
          ) : null}
          {holdings.map((row) => (
            <HeldRow
              key={row.key}
              member={member}
              row={row}
              open={open === row.key}
              onToggle={() => toggle(row.key)}
              onPermitted={onPermitted}
            >
              {row.listed ? panel(row.key, row.listed, member) : null}
            </HeldRow>
          ))}
        </RowGroup>
      )}
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
      {wallet === "ready" && !anyHeld ? (
        <p className="type-meta text-text-soft-400">
          {formatMessage({ id: "app.voucher.wl.empty" })}
        </p>
      ) : null}
    </div>
  );
}
