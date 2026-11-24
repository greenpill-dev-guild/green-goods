import {
  type ServiceAccessAction,
  type ServiceAccessSnapshot,
  type ServiceVoucherSetup,
  selectServiceAccessAction,
} from "@green-goods/shared/commitment-pooling";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { useEffect, useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { formatServiceAccessAmount, serviceAssetHasUnits } from "./serviceAccessPresentation";
import {
  serviceReviewFingerprint,
  type VoucherReviewKind,
  voucherReviewAction,
} from "./serviceVoucherReview";
import { VoucherSetupFacts } from "./VoucherSetupFacts";

interface VoucherSetupSheetProps {
  open: boolean;
  snapshot: ServiceAccessSnapshot;
  setup?: ServiceVoucherSetup;
  kind?: VoucherReviewKind;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (action: ServiceAccessAction) => void;
}

/** Review exact source setup or one already-authorized recovery; no client clock decisions. */
export function VoucherSetupSheet({
  open,
  snapshot,
  setup,
  kind,
  isPending,
  onOpenChange,
  onConfirm,
}: VoucherSetupSheetProps) {
  const { formatMessage, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.serviceAccess.${key}` });
  const form = useRef<HTMLFormElement>(null);
  const reviewed = useRef<string | null>(null);
  const id = useId();
  const [deadline, setDeadline] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(false);
  const fingerprint = `${kind}:${serviceReviewFingerprint(snapshot, setup)}`;
  useEffect(() => {
    reviewed.current = fingerprint;
    setDeadline("");
    setAgreed(false);
    setError(false);
  }, [open, fingerprint]);
  const preparation = !setup;
  const offer = snapshot.offer;
  const action: ServiceAccessAction | null =
    setup && kind
      ? voucherReviewAction(setup, kind)
      : offer && snapshot.consent && /^\d+$/.test(deadline)
        ? {
            action: "prepareVoucherSetup",
            expectedRevision: offer.revision,
            expectedTermsHash: offer.termsHash,
            expectedClaimHash: snapshot.consent.claimHash,
            expectedRequestNonce: snapshot.consent.requestNonce,
            acceptanceDeadline: BigInt(deadline),
          }
        : null;
  const unavailable = setup
    ? !action || !setup.availableActions.some((kind) => kind === action.action)
    : !snapshot.availableActions.includes("prepareVoucherSetup") ||
      snapshot.sourceTimestamp === null;
  const requiresUnits =
    kind === "approveVoucherAllowance" ||
    kind === "presentVoucherSetup" ||
    kind === "release" ||
    kind === "refund";
  const missingUnits = setup && requiresUnits && !serviceAssetHasUnits(setup.asset);
  const fee = action && "reviewedNativeFee" in action ? action.reviewedNativeFee : null;
  const final = setup?.destination?.finalAllocation;
  const units =
    kind === "release"
      ? final?.allocation.releaseVoucherUnits
      : kind === "refund"
        ? final?.allocation.refundVoucherUnits
        : null;
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      size="md"
      sheetSize="tall"
      title={text(
        preparation
          ? "actions.prepareVoucherSetup"
          : kind
            ? `review.${kind}`
            : "authorizationDetails"
      )}
      actions={{
        primary: {
          label: text("confirm"),
          loading: isPending,
          disabled: unavailable || Boolean(missingUnits),
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
            isPending ||
            missingUnits ||
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
        <p className="text-sm text-text-sub-600">
          {text(preparation || !kind ? "setupBody" : `reviewBody.${kind}`)}
        </p>
        {setup ? (
          <VoucherSetupFacts setup={setup} />
        ) : offer && snapshot.consent ? (
          <dl className="space-y-2 break-all text-sm">
            {[
              ["revision", offer.revision],
              ["termsHash", offer.termsHash],
              ["claimHash", snapshot.consent.claimHash],
              ["requestNonce", snapshot.consent.requestNonce],
              ["buyer", snapshot.key.buyer],
              ["authorizedHolder", snapshot.consent.voucherHolder],
              ["sourceChain", snapshot.key.sourceChainId],
              ["coreModule", snapshot.key.coreModule],
              ["buyerGarden", snapshot.consent.buyerGarden],
              ["providerGarden", offer.providerGarden],
              ["issuer", offer.voucher?.issuer],
              ["token", offer.voucher?.asset.token],
              ["destinationChain", offer.voucher?.asset.chainId],
              ["terms", offer.serviceTermsRef],
              ["remedy", offer.remedyTermsRef],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-xs text-text-sub-600">{text(String(label))}</dt>
                <dd>{value?.toString()}</dd>
              </div>
            ))}
            <div>
              <dt>{text("service")}</dt>
              <dd>
                {offer.serviceUnits.toString()} {offer.unitLabel}
              </dd>
            </div>
            {offer.voucher ? (
              <div>
                <dt>{text("presented")}</dt>
                <dd>
                  {formatServiceAccessAmount(
                    offer.voucher.units,
                    offer.voucher.asset,
                    locale,
                    text("baseUnits")
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {preparation ? (
          <>
            <p className="text-sm">
              {text("sourceTimestamp")}: {snapshot.sourceTimestamp?.toString() ?? text("unknown")}
            </p>
            <label htmlFor={id} className="block space-y-1">
              <span className="text-sm">{text("acceptanceDeadline")}</span>
              <TextInput
                id={id}
                inputMode="numeric"
                pattern="[0-9]+"
                required
                value={deadline}
                onChange={(event) => {
                  setDeadline(event.target.value);
                  setAgreed(false);
                  setError(false);
                }}
              />
            </label>
            <p className="text-xs text-text-sub-600">{text("deadlineHelp")}</p>
          </>
        ) : (
          <>
            <p className="break-all text-sm">
              {text("decisionId")}:{" "}
              {final?.decisionId ?? setup?.source.decisionId ?? text("unknown")}
            </p>
            <p className="break-all text-sm">
              {text("sourceAccount")}: {snapshot.capabilities.sourceBuyer}
            </p>
            <p className="break-all text-sm">
              {text("holderSigner")}: {snapshot.capabilities.gnosisHolder ?? text("unknown")}
            </p>
          </>
        )}
        {units !== null && units !== undefined && setup ? (
          <p className="text-sm">
            {text(kind === "release" ? "releaseFixed" : "refundFixed")}:{" "}
            {formatServiceAccessAmount(units, setup.asset, locale, text("baseUnits"))} →{" "}
            {kind === "release" ? setup.authorization.issuer : setup.authorization.holder}
          </p>
        ) : null}
        {setup && (kind === "approveVoucherAllowance" || kind === "revokeVoucherAllowance") ? (
          <dl className="space-y-2 break-all text-sm">
            <div>
              <dt>{text("currentAllowance")}</dt>
              <dd>{setup.destination?.allowance?.toString() ?? text("unknown")}</dd>
            </div>
            <div>
              <dt>{text("reviewedAllowance")}</dt>
              <dd>
                {kind === "revokeVoucherAllowance"
                  ? "0"
                  : setup.authorization.voucherUnits.toString()}{" "}
                {text("baseUnits")} · {setup.authorization.token} →{" "}
                {setup.authorization.destinationEscrow} · {text("destinationChain")}:{" "}
                {setup.authorization.destinationChainId}
              </dd>
            </div>
          </dl>
        ) : null}
        {fee !== null ? (
          <p className="text-sm">
            {text("nativeFee")}: {fee.toString()} {text("nativeBaseUnits")} · {text("feeChain")}:{" "}
            {kind === "authorization" || kind === "decision"
              ? setup?.authorization.sourceChainId
              : setup?.authorization.destinationChainId}
          </p>
        ) : null}
        {missingUnits ? (
          <p role="status" className="text-sm">
            {text("metadataUnavailable")}
          </p>
        ) : null}
        {unavailable ? (
          <p role="status" className="text-sm text-text-sub-600">
            {text("reviewUnavailable")}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-error-base">
            {text("reviewError")}
          </p>
        ) : null}
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            required
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-1 accent-[var(--color-primary-on-surface)]"
          />
          <span>{text("setupConsent")}</span>
        </label>
      </form>
    </DialogShell>
  );
}
