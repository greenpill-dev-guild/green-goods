import type {
  ServiceIssuerAction,
  ServiceIssuerAsset,
  ServiceIssuerExchangeQuote,
  ServiceIssuerOutcome,
  ServiceIssuerReview as Review,
  ServiceIssuerSnapshot,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { ServiceIssuerForm } from "./ServiceIssuerForm";
import { ServiceIssuerReview } from "./ServiceIssuerReview";
import { ServiceIssuerBookings } from "./ServiceIssuerBookings";
import { issuerAmount } from "./serviceIssuerPresentation";

interface Props {
  snapshot?: ServiceIssuerSnapshot;
  assets: readonly ServiceIssuerAsset[];
  isLoading?: boolean;
  isError?: boolean;
  onRefresh: () => Promise<unknown>;
  onReview: (action: ServiceIssuerAction) => Promise<Review>;
  onExecute: (review: Review) => Promise<ServiceIssuerOutcome>;
  onReconcile: () => Promise<ServiceIssuerOutcome | null>;
  onQuote: (input: {
    outputAssetId: string;
    amount: bigint;
  }) => Promise<ServiceIssuerExchangeQuote>;
}

/** Command Surface: balances are observations; signing always follows a separate exact review. */
export function ServiceIssuerPanel({
  snapshot,
  assets,
  isLoading,
  isError,
  onRefresh,
  onReview,
  onExecute,
  onReconcile,
  onQuote,
}: Props) {
  const { formatMessage, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const [reviewed, setReviewed] = useState<{ generation: number; review: Review } | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [outcome, setOutcome] = useState<ServiceIssuerOutcome | null>(null);
  const [sentAction, setSentAction] = useState<ServiceIssuerAction | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(false);
  const scope =
    JSON.stringify(snapshot, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    ) ?? "";
  const current = useRef({ scope, generation: 0 });
  if (current.current.scope !== scope) {
    current.current = { scope, generation: current.current.generation + 1 };
  }
  const generation = current.current.generation;
  useEffect(() => {
    setReviewed(null);
  }, [generation]);
  const review = reviewed?.generation === generation ? reviewed.review : null;
  const run = async (operation: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      await operation();
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  if (isLoading) return <p className="text-sm text-text-sub-600">{text("loading")}</p>;
  if (isError || !snapshot || snapshot.evidence === "unavailable")
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-sub-600">{text(isError ? "readFailed" : "unconfigured")}</p>
        {isError ? (
          <Button
            type="button"
            emphasis="secondary"
            loading={busy}
            onClick={() =>
              void run(async () => {
                await onRefresh();
              })
            }
          >
            {text("refresh")}
          </Button>
        ) : null}
      </div>
    );
  const asset = snapshot.asset;
  const ownsReserve =
    asset.kind === "individual" &&
    snapshot.actor.address.toLowerCase() === asset.ownerReserve.toLowerCase() &&
    snapshot.actor.address.toLowerCase() === asset.sourceAuthority.toLowerCase();
  const pending = Boolean(snapshot.pending || outcome?.status === "pending" || uncertain);
  const amount = (value: bigint | null) =>
    value === null ? text("unknown") : issuerAmount(value, asset, locale);
  const facts = [
    [text("held"), amount(snapshot.holdingBalance)],
    [text("reserve"), amount(snapshot.issuerReserveBalance)],
    [text("reserveAllowance"), amount(snapshot.reserveAllowance)],
    [text("exchangeAllowance"), amount(snapshot.poolAllowance)],
    [text("reserveStatus"), text(snapshot.reserveEnabled ? "enabled" : "disabled")],
  ];
  const deliveredAsset =
    sentAction?.kind === "exchange"
      ? assets.find((a) => a.id === sentAction.outputAssetId)
      : undefined;
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold leading-5 text-text-strong-950">{asset.name}</h3>
      <dl className="space-y-3 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-text-sub-600">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-1 text-xs text-text-sub-600">
        <p>{text("separateBalances")}</p>
        <p>{text("owedUnknown")}</p>
        <p>{text("returnedCapacity")}</p>
      </div>
      {pending ? (
        <div className="space-y-3">
          <p role="status" className="text-sm">
            {text("pending")}
          </p>
          <Button
            type="button"
            emphasis="secondary"
            loading={busy}
            onClick={() =>
              void run(async () => {
                const pendingReview =
                  snapshot.pending?.review ??
                  (outcome?.status === "pending" ? outcome.pending.review : null);
                if (pendingReview) setSentAction(pendingReview.action);
                const result = await onReconcile();
                setOutcome(result);
                setUncertain(false);
                setReviewed(null);
              })
            }
          >
            {text("checkStatus")}
          </Button>
        </div>
      ) : (
        <ServiceIssuerForm
          key={`${snapshot.actor.address}:${asset.id}:${ownsReserve}`}
          asset={asset}
          assets={assets}
          ownsReserve={ownsReserve}
          disabled={busy}
          onQuote={onQuote}
          onReview={(action) =>
            void run(async () => {
              const expected = generation;
              const value = await onReview(action);
              if (current.current.generation === expected)
                setReviewed({ generation: expected, review: value });
            })
          }
        />
      )}
      {outcome?.status === "confirmed" ? (
        <p role="status" className="text-sm">
          {outcome.currentStateMatchesReceipt === false ? (
            <span className="block">{text("stateChangedAfterReceipt")}</span>
          ) : null}
          {outcome.deliveredOutput !== undefined ? (
            <span className="block">
              {text("actualOutput")}:{" "}
              {deliveredAsset
                ? issuerAmount(outcome.deliveredOutput, deliveredAsset, locale)
                : `${outcome.deliveredOutput} ${text("baseUnits")}`}
            </span>
          ) : null}
          <a
            className="underline underline-offset-4"
            href={`https://gnosisscan.io/tx/${outcome.transactionHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {text("confirmed")}
          </a>
        </p>
      ) : outcome?.status === "reverted" ? (
        <p role="status" className="text-sm">
          {text("reverted")}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-error-base">
          {text(uncertain ? "unconfirmed" : "actionFailed")}
        </p>
      ) : null}
      {ownsReserve ? (
        <ServiceIssuerBookings
          bookings={snapshot.bookings}
          asset={asset}
          disabled={busy || pending}
          onReview={(action) =>
            void run(async () => {
              const expected = generation;
              const value = await onReview(action);
              if (current.current.generation === expected)
                setReviewed({ generation: expected, review: value });
            })
          }
        />
      ) : null}
      <Button
        type="button"
        emphasis="tertiary"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await onRefresh();
          })
        }
      >
        {text("refresh")}
      </Button>
      {review && !pending ? (
        <ServiceIssuerReview
          key={review.fingerprint}
          review={review}
          asset={asset}
          assets={assets}
          busy={busy}
          booking={
            "setupId" in review.action
              ? snapshot.bookings.records.find(
                  (b) =>
                    "setupId" in review.action &&
                    b.setupId === review.action.setupId &&
                    b.authorizationHash === review.action.authorizationHash
                )
              : undefined
          }
          onClose={() => setReviewed(null)}
          onConfirm={(value) =>
            void run(async () => {
              if (current.current.generation !== reviewed?.generation) return;
              setSentAction(value.action);
              try {
                setOutcome(await onExecute(value));
              } catch (failure) {
                setUncertain(true);
                throw failure;
              } finally {
                setReviewed(null);
              }
            })
          }
        />
      ) : null}
    </div>
  );
}
