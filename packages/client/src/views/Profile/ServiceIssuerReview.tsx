import type {
  ServiceIssuerAsset,
  ServiceIssuerBooking,
  ServiceIssuerReview as Review,
} from "@green-goods/shared/commitment-pooling";
import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { type ReactNode, useId, useState } from "react";
import { useIntl } from "react-intl";
import { issuerAmount } from "./serviceIssuerPresentation";

/** The member's named act a review was prepared for; a holder's exchange acts have none. */
export type IssuerIntent =
  | "approveBooking"
  | "authorizeReturn"
  | "issue"
  | "approveReserve"
  | "pause"
  | "resume"
  | "enable";

interface Props {
  review: Review;
  asset: ServiceIssuerAsset;
  assets: readonly ServiceIssuerAsset[];
  busy: boolean;
  intent?: IssuerIntent;
  booking?: ServiceIssuerBooking;
  onClose: () => void;
  onConfirm: (review: Review) => void;
}

/**
 * Command Surface: one immutable review with its five-minute expiry, the exact account and the
 * exact call, under the member's own words for the act. Signing waits for explicit consent.
 */
export function ServiceIssuerReview({
  review,
  asset,
  assets,
  booking,
  intent,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const { formatMessage, formatDate, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const ms = (key: string, values?: Record<string, string>) =>
    formatMessage({ id: `app.voucher.ms.${key}` }, values);
  const [agreed, setAgreed] = useState(false);
  const id = useId();
  const action = review.action;
  const amount = (value: bigint) => issuerAmount(value, asset, locale);
  const moment = (seconds: bigint) =>
    formatDate(Number(seconds) * 1000, { dateStyle: "medium", timeStyle: "short" });
  const output =
    action.kind === "exchange" ? assets.find((a) => a.id === action.outputAssetId) : undefined;
  const kind =
    action.kind === "configureReserve"
      ? action.enabled
        ? "enableReserve"
        : "disableReserve"
      : action.kind;
  const facts: { label: string; value: ReactNode }[] = [];
  const detailed = (value: string, detail: string) => (
    <>
      {value}
      <span className="mt-0.5 block text-xs font-normal leading-4 text-text-sub-600">{detail}</span>
    </>
  );
  if (booking) {
    facts.push(
      {
        label: ms("sh.holder"),
        value: (
          <AddressDisplay address={booking.authorization.holder}>{(name) => name}</AddressDisplay>
        ),
      },
      {
        label: ms("sh.service"),
        value: booking.reviewedTermsMatch
          ? `${booking.authorization.serviceUnits} ${asset.service.unit ?? text("unknown")}`
          : text("unknown"),
      },
      {
        label: ms("sh.vou"),
        value:
          intent === "approveBooking"
            ? detailed(amount(booking.authorization.voucherUnits), ms("sh.vouS"))
            : amount(booking.authorization.voucherUnits),
      },
      {
        label: ms("sh.due"),
        value: detailed(moment(booking.authorization.acceptanceDeadline), ms("sh.dueS")),
      },
      {
        label: formatMessage({ id: "app.voucher.c.terms" }),
        value: booking.reviewedTermsMatch
          ? detailed(ms("sh.termsV"), ms("sh.termsS"))
          : text("historicalTerms"),
      }
    );
  } else facts.push({ label: text("asset"), value: `${asset.name} (${asset.symbol})` });
  if ("amount" in action) facts.push({ label: text("amount"), value: amount(action.amount) });
  if (action.kind === "authorizeReturn")
    facts.push({ label: ms("fl.back"), value: amount(action.ceiling) });
  if (action.kind === "exchange" && output)
    facts.push(
      { label: text("estimatedOutput"), value: issuerAmount(action.quotedOutput, output, locale) },
      { label: text("minimum"), value: issuerAmount(action.minimumOutput, output, locale) },
      { label: text("deadline"), value: `${moment(action.deadline)} (${action.deadline})` }
    );
  facts.push(
    { label: text("signingAccount"), value: review.actor.address },
    { label: text("expires"), value: `${moment(review.expiresAt)} (${review.expiresAt})` }
  );
  const named = intent
    ? {
        title: ms(`rv.t.${intent}`),
        cta:
          intent === "issue" && "amount" in action
            ? ms("rv.cta.issue", { amount: amount(action.amount) })
            : ms(`rv.cta.${intent}`),
        check: intent === "approveBooking" ? ms("sh.chk") : text("consent"),
        note:
          intent === "approveBooking"
            ? ms("sh.consent")
            : intent === "pause"
              ? ms("sh.pauseB")
              : intent === "issue"
                ? ms("sh.issueNote")
                : intent === "authorizeReturn"
                  ? ms("sh.proposeNote")
                  : null,
      }
    : { title: text(`actions.${kind}`), cta: text("confirm"), check: text("consent"), note: null };
  return (
    <DialogShell
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      preventClose={busy}
      title={named.title}
      sheetSize="tall"
      actions={{
        primary: {
          label: named.cta,
          disabled: !agreed,
          loading: busy,
          onClick: () => {
            if (agreed && !busy) onConfirm(review);
          },
        },
        secondary: { label: text("cancel"), disabled: busy, onClick: onClose },
      }}
    >
      <div className="space-y-4" data-component="ServiceIssuerReview" data-kind={kind}>
        <p className="text-sm text-text-sub-600">{text("reviewHelp")}</p>
        <FactList>
          {facts.map((fact) => (
            <FactRow
              key={fact.label}
              label={fact.label}
              value={
                // Addresses and hashes wrap anywhere; words wrap between words.
                typeof fact.value === "string" && fact.value.startsWith("0x") ? (
                  <span className="break-all">{fact.value}</span>
                ) : (
                  fact.value
                )
              }
            />
          ))}
        </FactList>
        {action.kind === "exchange" ? <p className="text-sm">{text("exactOutput")}</p> : null}
        {named.note ? <p className="text-sm text-text-sub-600">{named.note}</p> : null}
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-3">{text("transactionDetails")}</summary>
          <dl className="space-y-2 break-all">
            {[
              [text("network"), "Gnosis (100)"],
              [text("token"), asset.token.address],
              [text("destination"), review.call.address],
              [text("method"), review.call.functionName],
              [text("nativeValue"), (review.call.value ?? 0n).toString()],
              ...("setupId" in action
                ? [
                    [text("setup"), action.setupId],
                    [text("authorization"), action.authorizationHash],
                  ]
                : []),
              ...(booking
                ? [
                    [text("terms"), booking.authorization.serviceTermsRef],
                    [text("unitHash"), booking.authorization.unitLabelHash],
                    [text("remedy"), booking.authorization.remedyTermsRef],
                  ]
                : [
                    [
                      text("terms"),
                      `${asset.service.terms.reference ?? text("unknown")} (${asset.service.terms.digest ?? text("unknown")})`,
                    ],
                  ]),
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
          <span>{named.check}</span>
        </label>
        <p className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.voucher.c.passkey" })}
        </p>
      </div>
    </DialogShell>
  );
}
