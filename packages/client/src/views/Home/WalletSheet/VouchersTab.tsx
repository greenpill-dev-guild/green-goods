import {
  useCommitment,
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
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
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
import { PWA_SHEET_SCROLL_CLASSNAME } from "@/components/Pwa/sheetScrollStyles";
import {
  formatVouchers,
  selectVoucherWalletRows,
  voucherBookingPath,
  voucherIssuerOf,
} from "./voucherWallet";

export interface VouchersTabProps {
  wallet: VoucherWalletSnapshot;
  /** Closes the wallet before a row opens a booking or a garden over Home. */
  onClose: () => void;
}

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
 */
export function VouchersTab({ wallet, onClose }: VouchersTabProps) {
  const intl = useIntl();
  const navigate = useNavigate();
  const [open, setOpen] = useState<Address | null>(null);
  const rows = selectVoucherWalletRows(wallet);
  const issuerName = (account: Address) =>
    voucherIssuerOf(wallet, account)?.name ?? shortAccount(account);
  // The sheet sits over Home, so it closes before the screen it opens would show under it.
  const go = (path: string) => {
    onClose();
    navigate(path, { state: { from: "home" } });
  };
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
              <li key={`holding-${holding.issuer.account}`}>
                <VoucherHoldingRow
                  holding={holding}
                  open={open === holding.issuer.account}
                  onToggle={() =>
                    setOpen(open === holding.issuer.account ? null : holding.issuer.account)
                  }
                  onBook={() => go(`/home/${holding.issuer.garden}`)}
                />
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-start gap-2 type-meta text-text-soft-400">
          <RiHandHeartLine aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{intl.formatMessage({ id: "app.voucher.wl.where" })}</span>
        </p>
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
          </FactList>
          <Button type="button" emphasis="primary" size="sm" onClick={onBook}>
            {intl.formatMessage({ id: "app.voucher.wl.book" })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
