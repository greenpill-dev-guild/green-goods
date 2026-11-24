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
import {
  issuerAmount,
  issuerBooks,
  issuerCount,
  issuerPlainAmount,
  issuerUnitWords,
} from "./serviceIssuerPresentation";

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
  poolName?: string;
  asset: ServiceIssuerAsset;
  assets: readonly ServiceIssuerAsset[];
  busy: boolean;
  intent?: IssuerIntent;
  booking?: ServiceIssuerBooking;
  onClose: () => void;
  onConfirm: (review: Review) => void;
}

/** The acts that name a pool: the exchange runs in it, and an approval is for it. */
const POOL_ACTS = ["exchange", "approveExchange", "revokeExchange"];

/**
 * Command Surface: one immutable review with its five-minute expiry, the exact account and the
 * exact call, under the member's own words for the act. Signing waits for explicit consent.
 *
 * An exchange reads as the exchange sheet does: what you spend and receive in the issuers' own
 * words, the fee, what the received voucher books, the pool and the deadline. Contract addresses,
 * the signing account and the review's own expiry fold under Transaction details, and the consent
 * sits last, right above the acts, so a disabled act is explained where the eye lands.
 */
export function ServiceIssuerReview({
  review,
  poolName,
  asset,
  assets,
  booking,
  intent,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const intl = useIntl();
  const { formatMessage, formatDate, locale } = intl;
  const text = (key: string, values?: Record<string, string>) =>
    formatMessage({ id: `app.profile.issuer.${key}` }, values);
  const ms = (key: string, values?: Record<string, string>) =>
    formatMessage({ id: `app.voucher.ms.${key}` }, values);
  const [agreed, setAgreed] = useState(false);
  const id = useId();
  const action = review.action;
  const amount = (value: bigint) => issuerAmount(value, asset, intl);
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
  // The pool an act names: the exchange's own contract, or the one an approval is for.
  const poolArg = POOL_ACTS.includes(action.kind)
    ? action.kind === "exchange"
      ? review.call.address
      : review.call.args[0]
    : null;
  const poolContract = typeof poolArg === "string" ? poolArg : null;
  const pool = poolName ?? review.actor.poolId ?? text("unknown");
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
  } else if (action.kind !== "exchange") {
    facts.push({ label: text("asset"), value: asset.name });
  }
  if ("amount" in action && action.kind !== "exchange")
    facts.push({
      label: text(action.kind === "approveExchange" ? "allowUpTo" : "amount"),
      value: amount(action.amount),
    });
  if (action.kind === "authorizeReturn")
    facts.push({ label: ms("fl.back"), value: amount(action.ceiling) });
  if (action.kind === "exchange" && output) {
    const gross = review.expected.grossOutput;
    const fee = typeof gross === "bigint" ? gross - action.quotedOutput : null;
    const books = issuerBooks(output, intl);
    facts.push(
      {
        label: formatMessage({ id: "app.voucher.ex.spend" }),
        value: issuerAmount(action.amount, asset, intl),
      },
      {
        label: formatMessage({ id: "app.voucher.ex.receive" }),
        value:
          action.minimumOutput < action.quotedOutput
            ? detailed(
                issuerAmount(action.quotedOutput, output, intl),
                formatMessage(
                  { id: "app.voucher.ex.sh.atLeast" },
                  {
                    min: issuerCount(action.minimumOutput, output.decimals, locale),
                    outUnit: issuerUnitWords(action.minimumOutput, output, intl),
                  }
                )
              )
            : issuerAmount(action.quotedOutput, output, intl),
      },
      {
        label: formatMessage({ id: "app.voucher.ex.f.fees" }),
        value:
          fee === null
            ? text("feesUnknown")
            : fee > 0n
              ? issuerAmount(fee, output, intl)
              : formatMessage({ id: "app.voucher.ex.f.feesZero" }),
      },
      ...(books.length > 0
        ? [
            {
              label: formatMessage({ id: "app.voucher.service.books" }),
              value: (
                <ul className="space-y-1">
                  {books.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ),
            },
          ]
        : []),
      { label: formatMessage({ id: "app.voucher.exchange.pool" }), value: pool },
      { label: text("deadline"), value: moment(action.deadline) }
    );
  } else if (poolContract !== null) {
    facts.push({ label: formatMessage({ id: "app.voucher.exchange.pool" }), value: pool });
  }
  if (review.continuation)
    facts.push({
      label: formatMessage({ id: "app.voucher.exchange.residue" }),
      value: amount(review.continuation.intermediateResidue),
    });
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
    : {
        title: text(`actions.${kind}`),
        cta:
          action.kind === "exchange"
            ? text("exchangeCta", {
                amount: issuerPlainAmount(action.amount, asset.decimals, intl),
              })
            : action.kind === "approveExchange"
              ? text("approveExchangeCta", {
                  amount: issuerPlainAmount(action.amount, asset.decimals, intl),
                })
              : action.kind === "revokeExchange"
                ? text("revokeExchangeCta")
                : text("confirm"),
        check: text("consent"),
        note: null,
      };
  // The exact call, for anyone checking it: addresses, hashes and the review's own expiry.
  const details: [string, string][] = [
    [text("network"), "Gnosis (100)"],
    [text("token"), asset.token.address],
    [text("destination"), review.call.address],
    ...(poolContract !== null && poolContract !== review.call.address
      ? [[text("poolContract"), poolContract] as [string, string]]
      : []),
    [text("method"), review.call.functionName],
    [text("nativeValue"), (review.call.value ?? 0n).toString()],
    ...("setupId" in action
      ? [
          [text("setup"), action.setupId] as [string, string],
          [text("authorization"), action.authorizationHash] as [string, string],
        ]
      : []),
    ...(booking
      ? [
          [text("terms"), booking.authorization.serviceTermsRef] as [string, string],
          [text("unitHash"), booking.authorization.unitLabelHash] as [string, string],
          [text("remedy"), booking.authorization.remedyTermsRef] as [string, string],
        ]
      : [
          [
            text("terms"),
            `${asset.service.terms.reference ?? text("unknown")} (${asset.service.terms.digest ?? text("unknown")})`,
          ] as [string, string],
        ]),
    [text("signingAccount"), review.actor.address],
    [text("expires"), moment(review.expiresAt)],
    [text("reviewId"), review.fingerprint],
  ];
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
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-text-sub-600">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
        <p className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.voucher.c.passkey" })}
        </p>
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
      </div>
    </DialogShell>
  );
}
