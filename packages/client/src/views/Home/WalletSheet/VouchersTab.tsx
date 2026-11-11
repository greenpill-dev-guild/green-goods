import {
  useCommitment,
  useVoucherAwards,
  useCommitmentMetadataFor,
  type VoucherBookingEscrow,
  type VoucherHolding,
  type VoucherIssuer,
  type VoucherPendingReturn,
  type VoucherWalletSnapshot,
} from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { ItemRow, ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { Address } from "@green-goods/shared/types/domain";
import {
  RiArrowGoBackLine,
  RiCalendarCheckLine,
  RiCoupon3Line,
  RiHandHeartLine,
} from "@remixicon/react";
import { useId, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { voucherServiceDescriptions } from "@/components/Features/Commitments/voucherServices";
import { PWA_SHEET_SCROLL_CLASSNAME } from "@/components/Pwa/sheetScrollStyles";
import {
  formatVouchers,
  selectVoucherWalletRows,
  voucherBookingPath,
  voucherIssuerOf,
} from "./voucherWallet";

export interface VouchersTabProps {
  /** The account's vouchers, once the read answers; until then the tab holds its rows' places. */
  wallet: VoucherWalletSnapshot | undefined;
  /** The read failed outright, or waits offline, with no answer to show. */
  failed?: boolean;
  /** Closes the wallet before a row opens a booking or a garden over Home. */
  onClose: () => void;
}

/** How many empty frames hold the list's place while the read runs (DL-056). */
const LOADING_ROWS = 2;

const shortAccount = (account: Address) => `${account.slice(0, 6)}…${account.slice(-4)}`;

/** The issuer's vouchers by name ("Tech and Sun vouchers"); Portuguese agrees with its gender. */
function unitName(intl: IntlShape, issuer: VoucherIssuer) {
  return intl.formatMessage(
    { id: "app.voucher.wl.unitMany" },
    { issuer: issuer.name, gender: issuer.gender ?? "other" }
  );
}

/**
 * The wallet's Vouchers tab (PRD-1297 surface 4, `SWallet`). The wallet is account-wide while
 * the Promises sheet shows only the active garden, so a booking's row here is the way back to a
 * booking at any garden (decision 11). Item rows carry their amounts in the right slot (DL-113).
 * The wallet lists the tab before its read answers (DL-167), so until then it holds its rows'
 * places with empty frames and the note under them, and a failed read says so in the rows' place.
 */
export function VouchersTab({ wallet, failed = false, onClose }: VouchersTabProps) {
  const intl = useIntl();
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  // The sheet sits over Home, so it closes before the screen it opens would show under it.
  const go = (path: string) => {
    onClose();
    navigate(path, { state: { from: "home" } });
  };
  const where = (
    <p className="flex items-start gap-2 type-meta text-text-soft-400">
      <RiHandHeartLine aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{intl.formatMessage({ id: "app.voucher.wl.where" })}</span>
    </p>
  );

  if (wallet?.evidence === "unavailable" || (!wallet && failed))
    return (
      <div className={PWA_SHEET_SCROLL_CLASSNAME}>
        <div className="p-4">
          <Alert variant="warning">
            {intl.formatMessage({ id: "app.voucher.wl.unavailable" })}
          </Alert>
        </div>
      </div>
    );

  if (!wallet)
    return (
      <div className={PWA_SHEET_SCROLL_CLASSNAME}>
        <div className="flex flex-col gap-3 p-4">
          <ul className="flex flex-col gap-(--gg-list-gap)" aria-busy="true">
            {Array.from({ length: LOADING_ROWS }, (_, index) => (
              <li key={index}>
                <ItemRowSkeleton lead="icon" amount />
              </li>
            ))}
          </ul>
          {where}
        </div>
      </div>
    );

  const rows = selectVoucherWalletRows(wallet);
  const issuerName = (account: Address) =>
    voucherIssuerOf(wallet, account)?.name ?? shortAccount(account);
  const empty = rows.bookings.length + rows.returns.length + rows.holdings.length === 0;

  return (
    <div className={PWA_SHEET_SCROLL_CLASSNAME}>
      <div className="flex flex-col gap-3 p-4">
        {wallet.complete ? null : (
          <Alert variant="warning">{intl.formatMessage({ id: "app.voucher.wl.partial" })}</Alert>
        )}
        {empty ? (
          <EmptyState
            placement="sheet"
            icon={<RiCoupon3Line />}
            title={intl.formatMessage({ id: "app.voucher.wl.empty" })}
          />
        ) : (
          <ul className="flex flex-col gap-(--gg-list-gap)">
            {rows.bookings.map((escrow) => (
              <li key={`booking-${escrow.booking.setupId}`}>
                <VoucherBookingRow
                  escrow={escrow}
                  issuer={issuerName(escrow.issuer)}
                  onOpen={() => go(voucherBookingPath(escrow.booking))}
                />
              </li>
            ))}
            {rows.returns.map((back) => (
              <li key={`return-${back.booking.setupId}`}>
                <VoucherReturnRow
                  back={back}
                  issuer={issuerName(back.issuer)}
                  onOpen={() => go(voucherBookingPath(back.booking))}
                />
              </li>
            ))}
            {rows.holdings.map((holding) => (
              <li key={`holding-${holding.issuer.asset.chainId}-${holding.issuer.asset.token}`}>
                <VoucherHoldingRow
                  holding={holding}
                  open={open === `${holding.issuer.asset.chainId}:${holding.issuer.asset.token}`}
                  onToggle={() =>
                    setOpen(
                      open === `${holding.issuer.asset.chainId}:${holding.issuer.asset.token}`
                        ? null
                        : `${holding.issuer.asset.chainId}:${holding.issuer.asset.token}`
                    )
                  }
                  onBook={() => go(`/home/${holding.issuer.garden}`)}
                />
              </li>
            ))}
          </ul>
        )}
        {wallet.evidence === "onchain" ? <VoucherAwardReceipts wallet={wallet} /> : null}
        {where}
      </div>
    </div>
  );
}

interface BookingRowProps {
  issuer: string;
  onOpen: () => void;
}

/** A voucher a booking holds: its offer's title, Booked, and what the escrow holds for it. */
function VoucherBookingRow({
  escrow,
  issuer,
  onOpen,
}: BookingRowProps & { escrow: VoucherBookingEscrow }) {
  const intl = useIntl();
  const { commitment } = useCommitment({
    chainId: escrow.booking.sourceChainId,
    commitmentId: escrow.booking.commitmentId,
  });
  const title = useCommitmentMetadataFor(commitment ?? undefined)?.title;
  return (
    <ItemRow
      lead={{ kind: "icon", icon: <RiCalendarCheckLine /> }}
      title={title ?? intl.formatMessage({ id: "app.voucher.wl.bk.untitled" })}
      status={{ label: intl.formatMessage({ id: "app.voucher.wl.bk.booked" }), tone: "info" }}
      edge="info"
      details={[issuer]}
      // In the asset the escrow recorded, which holds for an issuer the wallet no longer lists.
      amount={{
        value: formatVouchers(escrow.held, escrow.asset.decimals, intl.locale),
        caption: intl.formatMessage({ id: "app.voucher.wl.bk.cap" }),
      }}
      onOpen={onOpen}
    />
  );
}

/** A return on its way back, pending until its transfer arrives; it opens its booking. */
function VoucherReturnRow({
  back,
  issuer,
  onOpen,
}: BookingRowProps & { back: VoucherPendingReturn }) {
  const intl = useIntl();
  const { commitment } = useCommitment({
    chainId: back.booking.sourceChainId,
    commitmentId: back.booking.commitmentId,
  });
  const title = useCommitmentMetadataFor(commitment ?? undefined)?.title;
  const amount = formatVouchers(back.amount, back.asset.decimals, intl.locale);
  const failed = back.state === "failed";
  return (
    <ItemRow
      lead={{ kind: "icon", icon: <RiArrowGoBackLine /> }}
      title={intl.formatMessage({ id: "app.voucher.wl.back" }, { n: amount })}
      status={{
        label: intl.formatMessage({
          id: failed ? "app.voucher.wl.failed" : "app.voucher.wl.pending",
        }),
        tone: failed ? "error" : "info",
      }}
      edge={failed ? "error" : "info"}
      // What it comes back from leads, as the lab writes it; a narrow row shows only the first.
      details={
        title
          ? [intl.formatMessage({ id: "app.voucher.wl.backFrom" }, { title }), issuer]
          : [issuer]
      }
      amount={{ value: amount, caption: intl.formatMessage({ id: "app.voucher.wl.coming" }) }}
      onOpen={onOpen}
    />
  );
}

/** What the account holds of one issuer; it opens in place to book from the issuer's garden. */
function VoucherHoldingRow({
  holding,
  open,
  onToggle,
  onBook,
}: {
  holding: VoucherHolding;
  open: boolean;
  onToggle: () => void;
  onBook: () => void;
}) {
  const intl = useIntl();
  const panelId = useId();
  const { issuer } = holding;
  return (
    <div className="flex flex-col gap-2">
      <ItemRow
        lead={{ kind: "icon", icon: <RiCoupon3Line /> }}
        title={unitName(intl, issuer)}
        details={[issuer.name]}
        amount={{
          value: formatVouchers(holding.available, issuer.asset.decimals, intl.locale),
          caption: intl.formatMessage({ id: "app.voucher.wl.avail" }),
        }}
        onOpen={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
      />
      {open ? (
        <div id={panelId} className="gg-card gg-item-row-page flex flex-col gap-3 p-3">
          <FactList frame="inset">
            <FactRow
              label={intl.formatMessage({ id: "app.voucher.wl.f.issuer" })}
              value={issuer.name}
            />
            <FactRow
              label={intl.formatMessage({ id: "app.voucher.service.books" })}
              value={
                <ul className="space-y-1">
                  {voucherServiceDescriptions(issuer, issuer.asset.decimals, intl).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              }
            />
          </FactList>
          {issuer.exchanges?.length ? (
            <ul className="space-y-1 text-xs text-text-sub-600">
              {issuer.exchanges.map((exchange) => (
                <li key={exchange.poolAddress}>
                  {exchange.name}:{" "}
                  {intl.formatMessage({
                    id:
                      exchange.status === "listed"
                        ? "app.voucher.ms.p.listed"
                        : exchange.status === "delisted"
                          ? "app.voucher.ms.p.delisted"
                          : "app.profile.issuer.unknown",
                  })}
                </li>
              ))}
            </ul>
          ) : null}
          <Button type="button" emphasis="primary" size="sm" onClick={onBook}>
            {intl.formatMessage({ id: "app.voucher.wl.book" })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Award receipts describe provenance only; their amounts are never added to current holdings. */
function VoucherAwardReceipts({ wallet }: { wallet: VoucherWalletSnapshot }) {
  const intl = useIntl();
  const awards = useVoucherAwards();
  const t = (key: string) => intl.formatMessage({ id: `app.voucher.exchange.${key}` });
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("awardHistory")}</h3>
      {/* What the section holds, before anything is loaded, so a recipient told to look here finds it. */}
      {awards.load.isSuccess ? null : (
        <p className="type-meta text-text-soft-400">{t("awardsHere")}</p>
      )}
      <Button
        type="button"
        emphasis="secondary"
        size="sm"
        loading={awards.load.isPending}
        onClick={() => awards.load.mutate()}
      >
        {t("loadAwards")}
      </Button>
      {awards.isLimited ? (
        <p role="status" className="text-sm">
          {t("awardLimited")}
        </p>
      ) : null}
      {awards.load.isError ? (
        <p role="alert" className="text-sm">
          {t("awardFailed")}
        </p>
      ) : null}
      {awards.load.isSuccess && !awards.records.length ? (
        <p className="text-sm">{t("noAwards")}</p>
      ) : null}
      <ul className="space-y-2">
        {awards.records
          .filter(
            (record) =>
              record.state === "confirmed" &&
              record.award.recipient.toLowerCase() === wallet.account.toLowerCase()
          )
          .map((record) => {
            const issuer = wallet.issuers.find(
              (entry) => entry.asset.token.toLowerCase() === record.award.token.toLowerCase()
            );
            return (
              <li key={`${record.award.reserve}:${record.award.awardId}`} className="text-sm">
                <p>{record.award.reason}</p>
                <p>
                  {issuer
                    ? `${formatVouchers(BigInt(record.award.amount), issuer.asset.decimals, intl.locale)} ${issuer.name}`
                    : `${record.award.amount} ${intl.formatMessage({ id: "app.profile.issuer.baseUnits" })}`}
                </p>
                {record.award.reference ? (
                  <p className="break-words text-xs">{record.award.reference}</p>
                ) : null}
                {record.transactionHash ? (
                  <a
                    className="underline underline-offset-4"
                    href={`https://gnosisscan.io/tx/${record.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("receipt")}
                  </a>
                ) : null}
              </li>
            );
          })}
      </ul>
    </section>
  );
}
