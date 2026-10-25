import type {
  ServiceIssuerAsset,
  ServiceIssuerBooking,
  ServiceIssuerReview as Review,
} from "@green-goods/shared/commitment-pooling";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { issuerAmount } from "./serviceIssuerPresentation";

interface Props {
  review: Review;
  asset: ServiceIssuerAsset;
  assets: readonly ServiceIssuerAsset[];
  busy: boolean;
  booking?: ServiceIssuerBooking;
  onClose: () => void;
  onConfirm: (review: Review) => void;
}

/** Command Surface: one immutable review, with the shared sheet action bar. */
export function ServiceIssuerReview({
  review,
  asset,
  assets,
  booking,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const { formatMessage, formatDate, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const [agreed, setAgreed] = useState(false);
  const id = useId();
  const action = review.action;
  const output =
    action.kind === "exchange" ? assets.find((a) => a.id === action.outputAssetId) : undefined;
  const kind =
    action.kind === "configureReserve"
      ? action.enabled
        ? "enableReserve"
        : "disableReserve"
      : action.kind;
  const facts = [
    [text("asset"), `${asset.name} (${asset.symbol})`],
    [text("signingAccount"), review.actor.address],
    [text("network"), "Gnosis (100)"],
    [text("token"), asset.token.address],
    [
      text("expires"),
      `${formatDate(Number(review.expiresAt) * 1000, { dateStyle: "medium", timeStyle: "short" })} (${review.expiresAt})`,
    ],
  ];
  if ("amount" in action) facts.push([text("amount"), issuerAmount(action.amount, asset, locale)]);
  if (action.kind === "exchange" && output) {
    facts.push([text("estimatedOutput"), issuerAmount(action.quotedOutput, output, locale)]);
    facts.push([text("minimum"), issuerAmount(action.minimumOutput, output, locale)]);
    facts.push([
      text("deadline"),
      `${formatDate(Number(action.deadline) * 1000, { dateStyle: "medium", timeStyle: "short" })} (${action.deadline})`,
    ]);
  }
  if ("setupId" in action) {
    facts.push([text("setup"), action.setupId], [text("authorization"), action.authorizationHash]);
    if ("ceiling" in action)
      facts.push([text("returnCeiling"), issuerAmount(action.ceiling, asset, locale)]);
  }
  if (booking)
    facts.push(
      [text("holder"), booking.authorization.holder],
      [
        text("service"),
        `${booking.authorization.serviceUnits} ${booking.reviewedTermsMatch ? (asset.service.unit ?? text("unknown")) : text("unknown")}`,
      ],
      [text("booked"), issuerAmount(booking.authorization.voucherUnits, asset, locale)],
      [text("terms"), booking.authorization.serviceTermsRef],
      [text("unitHash"), booking.authorization.unitLabelHash],
      [text("remedy"), booking.authorization.remedyTermsRef]
    );
  else
    facts.push([
      text("terms"),
      `${asset.service.terms.reference ?? text("unknown")} (${asset.service.terms.digest ?? text("unknown")})`,
    ]);
  return (
    <DialogShell
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      preventClose={busy}
      title={text(`actions.${kind}`)}
      sheetSize="tall"
      actions={{
        primary: {
          label: text("confirm"),
          disabled: !agreed,
          loading: busy,
          onClick: () => {
            if (agreed && !busy) onConfirm(review);
          },
        },
        secondary: { label: text("cancel"), disabled: busy, onClick: onClose },
      }}
    >
      <div className="space-y-4">
        <p className="text-sm text-text-sub-600">{text("reviewHelp")}</p>
        <dl className="space-y-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-text-sub-600">{label}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
        </dl>
        {action.kind === "exchange" ? <p className="text-sm">{text("exactOutput")}</p> : null}
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-3">{text("transactionDetails")}</summary>
          <dl className="space-y-2 break-all">
            {[
              [text("destination"), review.call.address],
              [text("method"), review.call.functionName],
              [text("nativeValue"), (review.call.value ?? 0n).toString()],
              [text("reviewId"), review.fingerprint],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-text-sub-600">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
        <label htmlFor={id} className="flex min-h-11 items-start gap-3 text-sm">
          <input
            id={id}
            type="checkbox"
            checked={agreed}
            disabled={busy}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 accent-[var(--color-primary-on-surface)]"
          />
          <span>{text("consent")}</span>
        </label>
      </div>
    </DialogShell>
  );
}
