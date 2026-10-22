import type {
  ServiceAccessAction,
  ServiceAccessSnapshot,
} from "@green-goods/shared/commitment-pooling";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress, zeroAddress } from "viem";
import { formatServiceAccessAmount, serviceAssetHasUnits } from "./serviceAccessPresentation";

interface ServiceConsentSheetProps {
  open: boolean;
  mode: "request" | "funding";
  snapshot: ServiceAccessSnapshot;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (action: ServiceAccessAction) => void;
}

// Command: review one canonical service revision before requesting or funding it.
export function ServiceConsentSheet({
  open,
  mode,
  snapshot,
  isPending,
  onOpenChange,
  onConfirm,
}: ServiceConsentSheetProps) {
  const { formatMessage, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.serviceAccess.${key}` });
  const form = useRef<HTMLFormElement>(null);
  const reviewed = useRef<string | null>(null);
  const [garden, setGarden] = useState("");
  const [holder, setHolder] = useState("");
  const [depositor, setDepositor] = useState("");
  const [refund, setRefund] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState(false);
  const offer = snapshot.offer;
  const quote = snapshot.personalFeeQuote;
  const purchase = snapshot.personalPurchase;
  const paymentAccount = snapshot.personalPaymentAccount;
  const paymentAsset = paymentAccount?.asset ?? purchase?.asset;
  const amount = (value: bigint) =>
    formatServiceAccessAmount(value, paymentAsset, locale, text("baseUnits"));
  const reviewKey = JSON.stringify(
    [
      mode,
      snapshot.key,
      offer,
      snapshot.consent,
      snapshot.nextRequestNonce,
      quote,
      purchase,
      paymentAccount,
      snapshot.capabilities,
      snapshot.eligibleBuyerGardens,
    ],
    (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value)
  );

  useEffect(() => {
    if (!open) {
      reviewed.current = null;
      return;
    }
    setChanged(reviewed.current !== null && reviewed.current !== reviewKey);
    reviewed.current = reviewKey;
    setAgreed(false);
    setError(false);
    setGarden(snapshot.eligibleBuyerGardens[0]?.address ?? "");
    setHolder(snapshot.capabilities.gnosisHolder ?? snapshot.key.buyer);
    setDepositor(snapshot.capabilities.celoDepositor ?? snapshot.key.buyer);
    setRefund(snapshot.key.buyer);
  }, [
    open,
    reviewKey,
    snapshot.key.buyer,
    snapshot.eligibleBuyerGardens,
    snapshot.capabilities.gnosisHolder,
    snapshot.capabilities.celoDepositor,
  ]);

  if (!offer) return null;
  const funding = mode === "funding";
  const allowed = snapshot.availableActions.includes(funding ? "pledgePersonal" : "requestClaim");
  const submit = () => {
    if (!agreed || isPending || !allowed || reviewed.current !== reviewKey) return;
    if (funding) {
      if (!isAddress(depositor) || !isAddress(refund)) {
        setError(true);
        return;
      }
      if (!quote || !snapshot.consent || !serviceAssetHasUnits(paymentAsset)) return;
      onConfirm({
        action: "pledgePersonal",
        expectedClaimHash: snapshot.consent.claimHash,
        authorizedDepositor: depositor,
        refundAccount: refund,
        reviewedFee: quote,
      });
      return;
    }
    if (!isAddress(garden) || (offer.route === "voucher" && !isAddress(holder))) {
      setError(true);
      return;
    }
    onConfirm({
      action: "requestClaim",
      expectedRevision: offer.revision,
      expectedTermsHash: offer.termsHash,
      requestNonce: snapshot.nextRequestNonce,
      buyerGarden: garden,
      voucherHolder: offer.route === "voucher" && isAddress(holder) ? holder : zeroAddress,
    });
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      title={text(funding ? "actions.pledgePersonal" : "consentTitle")}
      size="md"
      sheetSize="tall"
      actions={{
        primary: {
          label: text(funding ? "confirm" : "request"),
          loading: isPending,
          disabled:
            !allowed ||
            (funding
              ? !quote || !serviceAssetHasUnits(paymentAsset)
              : snapshot.eligibleBuyerGardens.length === 0),
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
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        {changed ? (
          <p role="status" className="text-sm text-warning-dark">
            {text("changed")}
          </p>
        ) : null}
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-text-sub-600">{text("service")}</dt>
            <dd>
              {offer.serviceUnits.toString()} {offer.unitLabel}
            </dd>
          </div>
          <div>
            <dt className="text-text-sub-600">{text("revision")}</dt>
            <dd>{offer.revision.toString()}</dd>
          </div>
          <div>
            <dt className="text-text-sub-600">{text("payment")}</dt>
            <dd>
              {text(`route.${offer.route}`)} ·{" "}
              {offer.route === "personal-gd"
                ? amount(offer.gdPrice)
                : offer.voucher
                  ? formatServiceAccessAmount(
                      offer.voucher.units,
                      offer.voucher.asset,
                      locale,
                      text("baseUnits")
                    )
                  : ""}
            </dd>
          </div>
          {funding && quote ? (
            <>
              <div>
                <dt className="text-text-sub-600">{text("gross")}</dt>
                <dd>{amount(quote.totalDebit)}</dd>
              </div>
              <div>
                <dt className="text-text-sub-600">{text("net")}</dt>
                <dd>{amount(quote.recipientAmount)}</dd>
              </div>
            </>
          ) : null}
        </dl>
        {funding && quote ? (
          <p className="text-sm text-text-sub-600">{text("custody")}</p>
        ) : offer.route === "voucher" ? (
          <p className="text-sm text-text-sub-600">{text("mutualRemedy")}</p>
        ) : null}
        {funding ? (
          <>
            <label className="block space-y-1">
              <span className="text-sm">{text("depositor")}</span>
              <TextInput
                value={depositor}
                onChange={(event) => {
                  setDepositor(event.target.value);
                  setAgreed(false);
                  setError(false);
                }}
                required
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">{text("refundAccount")}</span>
              <TextInput
                value={refund}
                onChange={(event) => {
                  setRefund(event.target.value);
                  setAgreed(false);
                  setError(false);
                }}
                required
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </>
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{text("buyerGarden")}</legend>
              {snapshot.eligibleBuyerGardens.map((option) => (
                <label key={option.address} className="flex min-h-11 items-center gap-3">
                  <input
                    type="radio"
                    name="service-buyer-garden"
                    value={option.address}
                    checked={garden === option.address}
                    onChange={() => {
                      setGarden(option.address);
                      setAgreed(false);
                    }}
                    required
                    className="accent-[var(--color-primary-on-surface)]"
                  />
                  <span className="text-sm">{option.name}</span>
                </label>
              ))}
              {snapshot.eligibleBuyerGardens.length === 0 ? (
                <p className="text-sm">{text("noGarden")}</p>
              ) : null}
            </fieldset>
            {offer.route === "voucher" ? (
              <div className="space-y-1">
                <label htmlFor="service-voucher-holder" className="block text-sm">
                  {text("holder")}
                </label>
                <TextInput
                  id="service-voucher-holder"
                  value={holder}
                  onChange={(event) => {
                    setHolder(event.target.value);
                    setAgreed(false);
                    setError(false);
                  }}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="service-holder-hint"
                />
                <p id="service-holder-hint" className="text-xs text-text-sub-600">
                  {text("holderHint")}
                </p>
              </div>
            ) : null}
          </>
        )}
        <details className="text-xs text-text-sub-600">
          <summary>{text("terms")}</summary>
          <p className="mt-2 break-all">{offer.serviceTermsRef}</p>
          <p className="mt-2">{text("remedy")}</p>
          <p className="break-all">{offer.remedyTermsRef}</p>
          {funding && paymentAccount ? (
            <>
              <p className="mt-2">{text("custodySafe")}</p>
              <p className="break-all">{paymentAccount.custodySafe}</p>
            </>
          ) : null}
        </details>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            required
            className="mt-1 accent-[var(--color-primary-on-surface)]"
          />
          <span>{text("consent")}</span>
        </label>
        {error ? (
          <p role="alert" className="text-sm text-error-base">
            {text("addressError")}
          </p>
        ) : null}
      </form>
    </DialogShell>
  );
}
