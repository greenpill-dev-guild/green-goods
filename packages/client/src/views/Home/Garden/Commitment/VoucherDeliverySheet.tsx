import {
  type ServiceAccessAction,
  type ServiceAccessSnapshot,
  type ServiceVoucherSetup,
  selectServiceAccessAction,
} from "@green-goods/shared/commitment-pooling";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormattedAmountInput } from "@green-goods/shared/components/Form/FormattedAmountInput";
import { validateDecimalInput } from "@green-goods/shared/utils/blockchain/vaults";
import { useEffect, useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { formatServiceAccessAmount, serviceAssetHasUnits } from "./serviceAccessPresentation";
import { boundVoucherSetup, serviceReviewFingerprint } from "./serviceVoucherReview";
import { VoucherSetupFacts } from "./VoucherSetupFacts";

interface VoucherDeliverySheetProps {
  open: boolean;
  snapshot: ServiceAccessSnapshot;
  setup: ServiceVoucherSetup;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (action: ServiceAccessAction) => void;
}

/** Holder freezes one entire allocation. Executing either fixed financial leg is a separate act. */
export function VoucherDeliverySheet({
  open,
  snapshot,
  setup,
  isPending,
  onOpenChange,
  onConfirm,
}: VoucherDeliverySheetProps) {
  const { formatMessage, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.serviceAccess.${key}` });
  const form = useRef<HTMLFormElement>(null);
  const reviewed = useRef<string | null>(null);
  const amountId = useId();
  const [service, setService] = useState("");
  const [vouchers, setVouchers] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(false);
  const fingerprint = serviceReviewFingerprint(snapshot, setup);
  useEffect(() => {
    reviewed.current = fingerprint;
    setAgreed(false);
    setError(false);
    setService("");
    setVouchers("");
  }, [open, fingerprint]);
  const known = serviceAssetHasUnits(setup.asset);
  const allowed = known && setup.availableActions.includes("finalizeVoucherAllocation");
  const amount = (value: bigint) =>
    formatServiceAccessAmount(value, setup.asset, locale, text("baseUnits"));
  const buildAction = (): ServiceAccessAction | null => {
    if (
      !vouchers.trim() ||
      !serviceAssetHasUnits(setup.asset) ||
      validateDecimalInput(vouchers, setup.asset.decimals) ||
      !/^\d+$/.test(service)
    )
      return null;
    const activation = setup.destination?.result.appliedDecisionId;
    if (!activation) return null;
    const releaseVoucherUnits = parseUnits(vouchers, setup.asset.decimals);
    return {
      ...boundVoucherSetup(setup),
      action: "finalizeVoucherAllocation",
      expectedActivationDecisionId: activation,
      allocation: {
        approvedDeliveredServiceUnits: BigInt(service),
        releaseVoucherUnits,
        refundVoucherUnits: setup.authorization.voucherUnits - releaseVoucherUnits,
      },
    };
  };
  const action = buildAction();
  const refund =
    action?.action === "finalizeVoucherAllocation" ? action.allocation.refundVoucherUnits : null;
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      size="md"
      sheetSize="tall"
      title={text("finalTitle")}
      actions={{
        primary: {
          label: text("actions.finalizeVoucherAllocation"),
          loading: isPending,
          disabled: !allowed,
          onClick: () => form.current?.requestSubmit(),
        },
        secondary: {
          label: text("cancel"),
          disabled: isPending,
          onClick: () => onOpenChange(false),
        },
      }}
    >
      <form
        ref={form}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !agreed ||
            !allowed ||
            isPending ||
            reviewed.current !== fingerprint ||
            !action ||
            !selectServiceAccessAction(snapshot, action).allowed
          ) {
            setError(true);
            return;
          }
          onConfirm(action);
        }}
      >
        <p className="text-sm text-text-sub-600">{text("finalBody")}</p>
        <p className="text-sm font-medium">{text("freezeNoTransfer")}</p>
        <p className="text-sm">
          {text("service")}: {setup.authorization.serviceUnits.toString()} {text("serviceUnits")}
        </p>
        <p className="text-sm">
          {text("presented")}: {amount(setup.authorization.voucherUnits)}
        </p>
        <p className="text-sm">
          {text("returnCeiling")}:{" "}
          {setup.destination?.issuerReturnCeiling === null ||
          setup.destination?.issuerReturnCeiling === undefined
            ? text("unknown")
            : amount(setup.destination.issuerReturnCeiling)}
        </p>
        <label className="block space-y-1">
          <span className="text-sm">{text("finalService")}</span>
          <TextInput
            value={service}
            required
            inputMode="numeric"
            pattern="[0-9]+"
            disabled={!allowed}
            onChange={(event) => {
              setService(event.target.value);
              setAgreed(false);
              setError(false);
            }}
          />
        </label>
        <div className="space-y-1">
          <label htmlFor={amountId} className="block text-sm">
            {text("finalRelease")} ({setup.asset.symbol ?? text("baseUnits")})
          </label>
          <FormattedAmountInput
            id={amountId}
            value={vouchers}
            disabled={!allowed}
            required
            onValueChange={(value) => {
              setVouchers(value);
              setAgreed(false);
              setError(false);
            }}
          />
        </div>
        <p className="text-sm">
          {text("finalRefund")}:{" "}
          {refund !== null && refund >= 0n ? amount(refund) : text("unknown")}
        </p>
        <p className="break-all text-xs text-text-sub-600">
          {text("issuer")}: {setup.authorization.issuer}
        </p>
        <p className="break-all text-xs text-text-sub-600">
          {text("authorizedHolder")}: {setup.authorization.holder}
        </p>
        <p className="text-xs text-text-sub-600">{text("returnBody")}</p>
        {!known ? (
          <p role="status" className="text-sm">
            {text("metadataUnavailable")}
          </p>
        ) : null}
        <VoucherSetupFacts setup={setup} />
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            required
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-1 accent-[var(--color-primary-on-surface)]"
          />
          <span>{text("finalConsent")}</span>
        </label>
        {error ? (
          <p role="alert" className="text-sm text-error-base">
            {text("finalError")}
          </p>
        ) : null}
      </form>
    </DialogShell>
  );
}
