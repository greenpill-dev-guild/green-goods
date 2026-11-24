import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { RiCoupon3Line, RiTaskLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { formatVoucherMessage } from "./serviceBooking";
import { detailed } from "./ServiceRedeemSheet";
import type { ServiceRewardsView } from "./serviceRewards";

/** Why the sheet's agreement didn't go: the reward changed since review, or the prompt closed. */
export type EarnedAgreeOutcome = "changed" | "nothingSent" | null;

export interface EarnedRewardAgreeSheetProps {
  sheet: NonNullable<ServiceRewardsView["agreeSheet"]>;
  /** The request's own title, the work the reward is for. */
  work: string;
  open: boolean;
  outcome: EarnedAgreeOutcome;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree: () => void;
}

/**
 * Agree to the Rewards: the request's work and the voucher it pays, as the member agrees to them
 * from their own account before taking the request up (PRD-1322). Agreeing and taking it up are
 * two prompts; the page takes it up once the agreement lands.
 */
export function EarnedRewardAgreeSheet({
  sheet,
  work,
  open,
  outcome,
  isPending,
  onOpenChange,
  onAgree,
}: EarnedRewardAgreeSheetProps) {
  const intl = useIntl();
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      title={sheet.title}
      size="md"
      sheetSize="half"
      actions={{
        primary: { label: sheet.cta, loading: isPending, onClick: onAgree },
        secondary: {
          label: intl.formatMessage({ id: "app.serviceAccess.cancel" }),
          disabled: isPending,
          onClick: () => onOpenChange(false),
        },
      }}
    >
      <div className="space-y-4" data-component="EarnedRewardAgreeSheet">
        {outcome === "changed" ? (
          <Alert variant="warning" className="p-3">
            {intl.formatMessage({ id: "app.serviceAccess.changed" })}
          </Alert>
        ) : outcome === "nothingSent" ? (
          <Alert
            variant="info"
            title={formatVoucherMessage(intl, "pay.n.cancel.t")}
            className="p-3"
          >
            {formatVoucherMessage(intl, "pay.n.cancel.b")}
          </Alert>
        ) : null}
        <FactList frame="inset">
          <FactRow
            icon={<RiTaskLine />}
            label={sheet.work}
            value={<span className="line-clamp-2">{work}</span>}
            valueTitle={work}
          />
          <FactRow
            icon={<RiCoupon3Line />}
            label={sheet.vouchers}
            value={detailed(sheet.value, sheet.detail)}
          />
        </FactList>
        <p className="type-body text-text-sub-600">{sheet.consent}</p>
      </div>
    </DialogShell>
  );
}
