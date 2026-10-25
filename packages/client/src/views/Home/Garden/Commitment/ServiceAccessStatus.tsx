import type { ServiceAccessSnapshot } from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { useIntl } from "react-intl";
import { formatServiceAccessAmount } from "./serviceAccessPresentation";

// Ambient: canonical service, payment and voucher records remain independent facts.
export function ServiceAccessStatus({ snapshot }: { snapshot: ServiceAccessSnapshot }) {
  const { formatMessage, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.serviceAccess.${key}` });
  const offer = snapshot.offer;
  const purchase = snapshot.personalPurchase;
  const paymentAsset = snapshot.personalPaymentAccount?.asset ?? purchase?.asset;
  const amount = (value: bigint, asset = paymentAsset) =>
    formatServiceAccessAmount(value, asset, locale, text("baseUnits"));
  return (
    <>
      {offer ? (
        <dl className="space-y-2 text-sm">
          <Fact label={text("service")}>
            {offer.serviceUnits.toString()} {offer.unitLabel}
          </Fact>
          <Fact label={text("payment")}>
            {text(`route.${offer.route}`)}
            {offer.route === "personal-gd"
              ? ` · ${amount(offer.gdPrice)}`
              : offer.voucher
                ? ` · ${amount(offer.voucher.units, offer.voucher.asset)}`
                : ""}
          </Fact>
          <Fact label={text("revision")}>{offer.revision.toString()}</Fact>
        </dl>
      ) : null}
      {snapshot.consent?.state === "pending" ? (
        <p role="status" className="text-sm text-text-sub-600">
          {text("requestPending")}
        </p>
      ) : null}
      {purchase ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">{text("funding")}</h3>
          <p role="status" className="text-sm">
            {text(`purchase.${purchase.state}`)}
          </p>
          {purchase.outcome !== "none" ? (
            <p className="text-sm">{text(`outcome.${purchase.outcome}`)}</p>
          ) : null}
          {purchase.paymentObservation !== "none" && !purchase.deposit ? (
            <p role="status" className="text-sm text-text-sub-600">
              {text(
                purchase.paymentObservation === "observed-awaiting-steward"
                  ? "awaitingSteward"
                  : "pending"
              )}
            </p>
          ) : null}
          <dl className="space-y-2 text-sm">
            <Fact label={text("gross")}>
              {amount(purchase.disclosedGrossAmount, purchase.asset)}
            </Fact>
            <Fact label={text("net")}>{amount(purchase.disclosedNetAmount, purchase.asset)}</Fact>
          </dl>
          <p className="text-xs text-text-sub-600">{text("custody")}</p>
        </div>
      ) : null}
      {snapshot.acceptancePolicy.earned.status === "bound" ? (
        <Alert variant="info" title={text("earnedTitle")}>
          <p>{text("reason.earned-consent-unavailable")}</p>
          <dl className="mt-2 space-y-2 break-all text-xs">
            <Fact label={text("revision")}>
              {snapshot.acceptancePolicy.earned.revision?.toString()}
            </Fact>
            <Fact label={text("termsHash")}>{snapshot.acceptancePolicy.earned.termsHash}</Fact>
            <Fact label={text("earnedCreator")}>{snapshot.acceptancePolicy.earned.creator}</Fact>
            <Fact label={text("earnedParticipant")}>
              {snapshot.acceptancePolicy.earned.participant ?? text("unknown")}
            </Fact>
            <Fact label={text("earnedCreatorConsent")}>
              {snapshot.acceptancePolicy.earned.creatorConsentRevision?.toString() ??
                text("unknown")}
            </Fact>
            <Fact label={text("earnedParticipantConsent")}>
              {snapshot.acceptancePolicy.earned.participantConsentRevision?.toString() ??
                text("unknown")}
            </Fact>
          </dl>
        </Alert>
      ) : null}
      {snapshot.sourceBlock ? (
        <p className="text-xs text-text-sub-600">
          {text("sourceLatest")}: {snapshot.sourceBlock.number.toString()}
        </p>
      ) : null}
      {offer?.route === "voucher" ? (
        <p className="text-xs text-text-sub-600">{text("fulfilledWarning")}</p>
      ) : null}
      <details className="text-xs text-text-sub-600">
        <summary>{text("terms")}</summary>
        <dl className="mt-2 space-y-2 break-all">
          <Fact label={text("buyer")}>{snapshot.capabilities.sourceBuyer}</Fact>
          {purchase ? (
            <>
              <Fact label={text("depositor")}>{purchase.authorizedDepositor}</Fact>
              <Fact label={text("refundAccount")}>{purchase.refundAccount}</Fact>
              <Fact label={text("custodySafe")}>{purchase.custodySafe}</Fact>
            </>
          ) : null}

          {offer ? (
            <>
              <Fact label={text("terms")}>{offer.serviceTermsRef}</Fact>
              <Fact label={text("remedy")}>{offer.remedyTermsRef}</Fact>
            </>
          ) : null}
        </dl>
      </details>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <dt className="text-xs text-text-sub-600">{label}</dt>
      <dd className="min-w-0 break-words text-text-strong-950">{children}</dd>
    </div>
  );
}
