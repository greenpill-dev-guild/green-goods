import type {
  ServiceIssuerAction,
  ServiceIssuerAsset,
  ServiceIssuerBooking,
  ServiceIssuerBookings as Bookings,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { issuerAmount, parseIssuerAmount } from "./serviceIssuerPresentation";

interface Props {
  bookings: Bookings;
  asset: ServiceIssuerAsset;
  disabled: boolean;
  onReview: (action: ServiceIssuerAction) => void;
}

/** Only canonically validated issuer records can supply booking authorization inputs. */
export function ServiceIssuerBookings({ bookings, asset, disabled, onReview }: Props) {
  const { formatMessage } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  return (
    <section className="space-y-3 border-t border-stroke-soft-200 pt-4">
      <h4 className="text-sm font-semibold leading-5 text-text-strong-950">{text("bookings")}</h4>
      <p className="text-xs text-text-sub-600">{text("bookingsIncomplete")}</p>
      {bookings.status !== "observed" ? (
        <p className="text-sm">
          {text(bookings.status === "partial" ? "bookingsPartial" : "bookingsUnavailable")}
        </p>
      ) : null}
      {bookings.records.length === 0 && bookings.status === "observed" ? (
        <p className="text-sm">{text("noObservedBookings")}</p>
      ) : null}
      <ul className="divide-y divide-stroke-soft-200">
        {bookings.records.map((record) => (
          <li key={`${record.setupId}:${record.authorizationHash}`} className="py-4 first:pt-0">
            <IssuerBooking record={record} asset={asset} disabled={disabled} onReview={onReview} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function IssuerBooking({
  record,
  asset,
  disabled,
  onReview,
}: Omit<Props, "bookings"> & { record: ServiceIssuerBooking }) {
  const { formatMessage, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const [ceiling, setCeiling] = useState("");
  const id = useId();
  const amount = parseIssuerAmount(ceiling, asset.decimals);
  const authorization = record.authorization;
  const unit = record.reviewedTermsMatch
    ? (asset.service.unit ?? text("unknown"))
    : text("unknown");
  const binding = { setupId: record.setupId, authorizationHash: record.authorizationHash };
  const allocation = record.finalAllocation;
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {text("promise")} #{authorization.commitmentId.toString()}
      </p>
      <dl className="space-y-2 text-sm">
        {[
          [text("service"), `${authorization.serviceUnits} ${unit}`],
          [text("booked"), issuerAmount(authorization.voucherUnits, asset, locale)],
          [text("phase"), text(`phases.${record.result.phase}`)],
          [text("returnCeiling"), issuerAmount(record.issuerReturnCeiling, asset, locale)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-text-sub-600">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {!record.reviewedTermsMatch ? <p className="text-sm">{text("historicalTerms")}</p> : null}
      {allocation ? (
        <div className="space-y-1 text-sm">
          <p>{text("fixedAllocation")}</p>
          <p>
            {text("delivered")}: {allocation.allocation.approvedDeliveredServiceUnits.toString()} /{" "}
            {authorization.serviceUnits.toString()} {unit}
          </p>
          <p>
            {text("returnToIssuer")}:{" "}
            {issuerAmount(allocation.allocation.releaseVoucherUnits, asset, locale)} (
            {text(`legs.${allocation.release.state}`)})
          </p>
          <p>
            {text("refundToHolder")}:{" "}
            {issuerAmount(allocation.allocation.refundVoucherUnits, asset, locale)} (
            {text(`legs.${allocation.refund.state}`)})
          </p>
        </div>
      ) : null}
      <details className="text-xs">
        <summary className="min-h-11 cursor-pointer py-3">{text("bookingDetails")}</summary>
        <dl className="space-y-2 break-all">
          {[
            [text("holder"), authorization.holder],
            [text("setup"), record.setupId],
            [text("authorization"), record.authorizationHash],
            [text("terms"), authorization.serviceTermsRef],
            [text("unitHash"), authorization.unitLabelHash],
            [text("remedy"), authorization.remedyTermsRef],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-text-sub-600">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
      {record.approvalEligible ? (
        <Button
          type="button"
          disabled={disabled}
          onClick={() => onReview({ kind: "approveBooking", ...binding })}
        >
          {text("actions.approveBooking")}
        </Button>
      ) : null}
      {record.returnEligible ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              !disabled &&
              amount !== null &&
              amount > record.issuerReturnCeiling &&
              amount <= authorization.voucherUnits
            )
              onReview({ kind: "authorizeReturn", ...binding, ceiling: amount });
          }}
        >
          <label htmlFor={id} className="block space-y-1 text-sm">
            <span>
              {text("newReturnCeiling")} ({asset.symbol})
            </span>
            <TextInput
              id={id}
              inputMode="decimal"
              required
              value={ceiling}
              disabled={disabled}
              aria-describedby={`${id}-help`}
              onChange={(event) => setCeiling(event.target.value)}
            />
          </label>
          <p id={`${id}-help`} className="text-xs text-text-sub-600">
            {text("returnHelp")}
          </p>
          <Button
            type="submit"
            disabled={
              disabled ||
              amount === null ||
              amount <= record.issuerReturnCeiling ||
              amount > authorization.voucherUnits
            }
          >
            {text("actions.authorizeReturn")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
